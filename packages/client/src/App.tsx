import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu as MenuIcon } from 'lucide-react';
import type { Conversation, Project } from '@espera/shared';
import { Sidebar, type Page } from './components/Sidebar.js';
import { ChatView } from './components/Chat/ChatView.js';
import { LoginView } from './components/Auth/LoginView.js';
import { Logo } from './components/Common/Logo.js';
import type { SettingsTab } from './components/Settings/SettingsDialog.js';
import { getInitialSession, saveSessionState, type SessionState } from './stores/session.js';
import { api, type AuthState, type ProviderInfo } from './services/api.js';
import { useLanguage, describeError } from './i18n.js';
import { useTheme } from './theme.js';

const MemoryManager = lazy(() => import('./components/Memory/MemoryManager.js').then((module) => ({ default: module.MemoryManager })));
const PersonaEditor = lazy(() => import('./components/Persona/PersonaEditor.js').then((module) => ({ default: module.PersonaEditor })));
const ProjectsView = lazy(() => import('./components/Projects/ProjectsView.js').then((module) => ({ default: module.ProjectsView })));
const SettingsDialog = lazy(() => import('./components/Settings/SettingsDialog.js').then((module) => ({ default: module.SettingsDialog })));
const ContextInspectorModal = lazy(() => import('./components/Inspector/ContextInspectorModal.js').then((module) => ({ default: module.ContextInspectorModal })));

const SIDEBAR_KEY = 'espera_sidebar_collapsed';

const MOCK_PROVIDER: ProviderInfo = {
  id: 'mock',
  name: 'Mock Provider (Test Engine)',
  models: [
    { id: 'mock-model-a', name: 'Mock Model Alpha (Fast)', contextWindow: 32000, supportsStreaming: true },
    { id: 'mock-model-b', name: 'Mock Model Beta (Elaborate)', contextWindow: 64000, supportsStreaming: true },
  ],
  capabilities: { supportsStreaming: true, supportsVision: false, supportsToolCalling: false },
};

function readCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
}

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

export function App() {
  const { t } = useLanguage();
  const { preference: theme, setPreference: setTheme } = useTheme();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('chat');
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [session, setSession] = useState<SessionState>(getInitialSession);
  const [providers, setProviders] = useState<ProviderInfo[]>([MOCK_PROVIDER]);
  const [pendingCount, setPendingCount] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const authInitializationStarted = useRef(false);

  useEffect(() => { saveSessionState(session); }, [session]);

  useEffect(() => {
    try {
      if (collapsed) localStorage.setItem(SIDEBAR_KEY, '1');
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch { /* storage unavailable */ }
  }, [collapsed]);

  async function loadAuth() {
    setAuthError(null);
    try { setAuth(await api.getAuthState()); }
    catch (error) { setAuthError(describeError(t, error, t('app.authFailed'))); }
  }

  useEffect(() => {
    if (authInitializationStarted.current) return;
    authInitializationStarted.current = true;
    const handoff = api.consumeGithubHandoff();
    void (async () => {
      try {
        if (handoff) await api.exchangeGithubHandoff(handoff);
        await loadAuth();
      } catch (error) {
        setAuthError(describeError(t, error, t('app.githubFailed')));
      }
    })();
    const onAuthRequired = () => setAuth((current) => (current ? { ...current, authenticated: false, user: null } : current));
    window.addEventListener('espera:auth-required', onAuthRequired);
    return () => window.removeEventListener('espera:auth-required', onAuthRequired);
  }, []);

  useEffect(() => {
    if (!auth || (auth.required && !auth.authenticated)) return;
    void loadWorkspace();
  }, [auth?.authenticated, auth?.required]);

  function fail(error: unknown, fallback: string) {
    console.error(fallback, error);
    setWorkspaceError(describeError(t, error, fallback));
  }

  async function loadProviders() {
    try {
      const list = await api.getProviders();
      if (list.length > 0) setProviders(list);
    } catch (error) { fail(error, t('app.error.providers')); }
  }

  const loadPendingCount = useCallback(async () => {
    try { setPendingCount((await api.getMemories('pending')).length); }
    catch (error) { fail(error, t('app.error.memory')); }
  }, [t]);

  async function loadConnections() {
    try {
      const connections = await api.getProviderConnections();
      setSession((previous) => ({ ...previous, connections }));
    } catch (error) { fail(error, t('app.error.connections')); }
  }

  async function loadProjects() {
    try { setProjects(await api.getProjects()); }
    catch (error) { fail(error, t('app.error.projects')); }
  }

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.getConversations();
      setConversations(list);
      // Read the latest selection instead of a stale closure: drop it only if it no longer exists.
      setSession((previous) => (
        previous.selectedConversationId && !list.some((conversation) => conversation.id === previous.selectedConversationId)
          ? { ...previous, selectedConversationId: null }
          : previous
      ));
    } catch (error) { fail(error, t('app.error.conversations')); }
  }, [t]);

  async function loadWorkspace() {
    setWorkspaceError(null);
    await Promise.all([loadProviders(), loadPendingCount(), loadConnections(), loadProjects(), loadConversations()]);
  }

  const updateSession = useCallback((partial: Partial<SessionState>) => setSession((previous) => ({ ...previous, ...partial })), []);

  const newChat = useCallback(() => {
    updateSession({ selectedConversationId: null });
    setPage('chat');
    setMobileOpen(false);
  }, [updateSession]);

  function selectConversation(id: string) {
    updateSession({ selectedConversationId: id });
    setPage('chat');
  }

  async function deleteConversation(conversation: Conversation) {
    await api.deleteConversation(conversation.id);
    setConversations((current) => current.filter((item) => item.id !== conversation.id));
    setSession((previous) => (previous.selectedConversationId === conversation.id ? { ...previous, selectedConversationId: null } : previous));
  }

  const openSidebar = useCallback(() => {
    if (isDesktop()) setCollapsed(false);
    else setMobileOpen(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isDesktop()) setCollapsed((value) => !value);
    else setMobileOpen((value) => !value);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const chatProviders = useMemo(() => [
    ...providers,
    ...session.connections.map((connection) => ({
      id: connection.id,
      name: connection.name,
      defaultBaseUrl: connection.baseUrl,
      models: connection.models,
      capabilities: { supportsStreaming: true, supportsVision: false, supportsToolCalling: false },
    })),
  ], [providers, session.connections]);

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
        <section className="w-full max-w-sm text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="mt-6 text-xl font-semibold">{t('app.unreachable')}</h1>
          <p className="mt-2 text-sm leading-6 text-fg-2">{authError}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => void loadAuth()}>{t('chat.retry')}</button>
        </section>
      </main>
    );
  }
  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg" role="status" aria-label={t('common.loading')}>
        <Logo className="h-9 w-9 animate-pulse text-fg-3" />
      </div>
    );
  }
  if (auth.required && !auth.authenticated) return <LoginView auth={auth} />;

  const pageTitle = page === 'memory' ? t('nav.memory') : page === 'persona' ? t('nav.persona') : t('nav.projects');

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg text-fg">
      <Sidebar
        page={page}
        onNavigate={setPage}
        pendingCount={pendingCount}
        conversations={conversations}
        activeConversationId={session.selectedConversationId}
        onNewChat={newChat}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onConversationsChange={setConversations}
        auth={auth}
        onLoggedOut={() => setAuth({ ...auth, authenticated: false, user: null })}
        onOpenSettings={() => setSettingsTab('general')}
        collapsed={collapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={mobileOpen}
        onOpen={openSidebar}
        onCloseMobile={closeMobile}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {page === 'chat' ? (
          <ChatView
            session={session}
            onUpdateSession={updateSession}
            providers={chatProviders}
            conversations={conversations}
            activeConversationId={session.selectedConversationId}
            onConversationsChange={setConversations}
            onConversationCreated={(id) => updateSession({ selectedConversationId: id })}
            onConversationsStale={() => void loadConversations()}
            onOpenInspector={() => updateSession({ inspectorOpen: true })}
            onNavigateToMemory={() => setPage('memory')}
            onPendingCountChange={() => void loadPendingCount()}
            onManageConnections={() => setSettingsTab('connections')}
            onNewChat={newChat}
            onOpenSidebar={openSidebar}
            sidebarCollapsed={collapsed}
            projects={projects}
          />
        ) : (
          <>
            <header className={`flex h-14 shrink-0 items-center gap-1 px-2 ${collapsed ? '' : 'md:hidden'}`}>
              <button type="button" className="icon-btn" onClick={openSidebar} aria-label={t('nav.openSidebar')}>
                <MenuIcon className="h-5 w-5" />
              </button>
              <span className="px-1 text-[15px] font-medium">{pageTitle}</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<p className="py-16 text-center text-sm text-fg-3">{t('common.loading')}</p>}>
                {page === 'memory' && <MemoryManager onMemoryChanged={() => void loadPendingCount()} projects={projects} />}
                {page === 'persona' && <PersonaEditor />}
                {page === 'projects' && <ProjectsView onProjectsChanged={() => void loadProjects()} />}
              </Suspense>
            </div>
          </>
        )}
      </div>

      {workspaceError && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-elevated px-4 py-3 text-sm text-fg shadow-[var(--shadow)]">
          <span className="min-w-0 flex-1">{workspaceError}</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void loadWorkspace()}>{t('chat.retry')}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWorkspaceError(null)}>{t('common.close')}</button>
        </div>
      )}

      <Suspense fallback={null}>
        {settingsTab && (
          <SettingsDialog
            initialTab={settingsTab}
            session={session}
            onUpdateSession={updateSession}
            providers={providers}
            theme={theme}
            onThemeChange={setTheme}
            onClose={() => setSettingsTab(null)}
          />
        )}
        {session.inspectorOpen && (
          <ContextInspectorModal
            isOpen={session.inspectorOpen}
            conversationId={session.selectedConversationId}
            onClose={() => updateSession({ inspectorOpen: false })}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
