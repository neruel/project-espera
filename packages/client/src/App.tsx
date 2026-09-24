import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar.js';
import { ChatView } from './components/Chat/ChatView.js';
import {
  getInitialSession,
  saveSessionState,
  type SessionState,
} from './stores/session.js';
import { api, type ProviderInfo } from './services/api.js';
import type { AuthState } from './services/api.js';
import { LoginView } from './components/Auth/LoginView.js';
import type { Conversation, Project } from '@espera/shared';

const MemoryManager = lazy(() => import('./components/Memory/MemoryManager.js').then((module) => ({ default: module.MemoryManager })));
const PersonaEditor = lazy(() => import('./components/Persona/PersonaEditor.js').then((module) => ({ default: module.PersonaEditor })));
const SettingsView = lazy(() => import('./components/Settings/SettingsView.js').then((module) => ({ default: module.SettingsView })));
const ProjectsView = lazy(() => import('./components/Projects/ProjectsView.js').then((module) => ({ default: module.ProjectsView })));
const ContextInspectorModal = lazy(() => import('./components/Inspector/ContextInspectorModal.js').then((module) => ({ default: module.ContextInspectorModal })));

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'chat' | 'memory' | 'persona' | 'projects' | 'settings'>('chat');
  const [session, setSession] = useState<SessionState>(getInitialSession);
  const [providers, setProviders] = useState<ProviderInfo[]>([
    {
      id: 'mock',
      name: 'Mock Provider (Test Engine)',
      models: [
        { id: 'mock-model-a', name: 'Mock Model Alpha (Fast)', contextWindow: 32000, supportsStreaming: true },
        { id: 'mock-model-b', name: 'Mock Model Beta (Elaborate)', contextWindow: 64000, supportsStreaming: true },
      ],
      capabilities: { supportsStreaming: true, supportsVision: false, supportsToolCalling: false },
    },
  ]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const authInitializationStarted = useRef(false);

  useEffect(() => {
    saveSessionState(session);
  }, [session]);

  async function loadAuth() {
    setAuthError(null);
    try { setAuth(await api.getAuthState()); }
    catch (error) { setAuthError(error instanceof Error ? error.message : 'Authentication status could not be loaded'); }
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
        setAuthError(error instanceof Error ? error.message : 'GitHub login could not be completed');
      }
    })();
    const onAuthRequired = () => setAuth((current) => current ? { ...current, authenticated: false, user: null } : current);
    window.addEventListener('espera:auth-required', onAuthRequired);
    return () => window.removeEventListener('espera:auth-required', onAuthRequired);
  }, []);

  useEffect(() => {
    if (!auth || (auth.required && !auth.authenticated)) return;
    loadProviders();
    loadPendingCount();
    loadConnections();
    loadProjects();
    loadConversations();
  }, [auth?.authenticated, auth?.required]);

  async function loadProviders() {
    try {
      const list = await api.getProviders();
      if (list.length > 0) {
        setProviders(list);
      }
    } catch (err) {
      console.error('Failed to load providers', err);
      setWorkspaceError(err instanceof Error ? err.message : 'Providers could not be loaded');
    }
  }

  async function loadPendingCount() {
    try {
      const pendings = await api.getMemories('pending');
      setPendingCount(pendings.length);
    } catch (err) {
      console.error('Failed to load pending memory count', err);
      setWorkspaceError(err instanceof Error ? err.message : 'Memory status could not be loaded');
    }
  }

  async function loadConnections() {
    try {
      const connections = await api.getProviderConnections();
      setSession((previous) => ({ ...previous, connections }));
    } catch (err) {
      console.error('Failed to load provider connections', err);
      setWorkspaceError(err instanceof Error ? err.message : 'Provider connections could not be loaded');
    }
  }

  async function loadProjects() {
    try { setProjects(await api.getProjects()); } catch (err) { console.error('Failed to load projects', err); setWorkspaceError(err instanceof Error ? err.message : 'Projects could not be loaded'); }
  }

  async function loadConversations() {
    try {
      const list = await api.getConversations();
      setConversations(list);
      const selected = session.selectedConversationId;
      if (selected && list.some((conversation) => conversation.id === selected)) return;
      if (list[0]) updateSession({ selectedConversationId: list[0].id });
      else updateSession({ selectedConversationId: null });
    } catch (err) { console.error('Failed to load conversations', err); setWorkspaceError(err instanceof Error ? err.message : 'Conversations could not be loaded'); }
  }

  async function retryWorkspaceLoad() { setWorkspaceError(null); await Promise.all([loadProviders(), loadPendingCount(), loadConnections(), loadProjects(), loadConversations()]); }

  function startNewConversation() { updateSession({ selectedConversationId: null }); }

  function selectConversation(id: string) { updateSession({ selectedConversationId: id }); setCurrentTab('chat'); }

  async function deleteConversation(conversation: Conversation) {
    await api.deleteConversation(conversation.id);
    const next = conversations.filter((item) => item.id !== conversation.id);
    setConversations(next);
    if (session.selectedConversationId === conversation.id) updateSession({ selectedConversationId: next[0]?.id || null });
  }

  function updateSession(partial: Partial<SessionState>) {
    setSession((prev) => ({ ...prev, ...partial }));
  }

  function openInspector(conversationId?: string) {
    updateSession({
      inspectorOpen: true,
      selectedConversationId: conversationId || session.selectedConversationId,
    });
  }

  if (authError) return <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] p-6 text-neutral-100"><section className="workspace-section w-full max-w-md p-6 text-center"><h1 className="text-base font-semibold">Espera에 연결할 수 없습니다</h1><p className="mt-3 text-sm leading-6 text-neutral-500">{authError}</p><p className="mt-2 text-xs text-neutral-600">인증 상태를 확인하지 못한 경우 작업 공간을 열지 않습니다.</p><button className="workspace-button workspace-button-primary mt-6" onClick={() => void loadAuth()}>다시 시도</button></section></main>;
  if (!auth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading Espera…</div>;
  if (auth.required && !auth.authenticated) return <LoginView auth={auth} />;

  return (
    <div className="h-screen overflow-hidden bg-[#0b0b0d] text-neutral-100 flex flex-col md:flex-row font-sans">
      {workspaceError && <div className="fixed right-4 top-4 z-[80] max-w-sm rounded-xl border border-rose-900/70 bg-rose-950/90 p-4 text-sm text-rose-100 shadow-2xl" role="alert"><p>{workspaceError}</p><div className="mt-3 flex gap-2"><button className="workspace-button !border-rose-800" onClick={() => void retryWorkspaceLoad()}>다시 시도</button><button className="workspace-button" onClick={() => setWorkspaceError(null)}>닫기</button></div></div>}
      <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingCount={pendingCount}
          conversations={conversations}
          activeConversationId={session.selectedConversationId}
          onCreateConversation={startNewConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          onConversationsChange={setConversations}
          session={session}
          auth={auth}
          onLoggedOut={() => setAuth({ ...auth, authenticated: false, user: null })}
        />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"><Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-neutral-600">Loading…</div>}>
        {currentTab === 'chat' && (
          <ChatView
            session={session}
            onUpdateSession={updateSession}
            providers={[...providers, ...session.connections.map(c => ({ id:c.id, name:c.name, defaultBaseUrl:c.baseUrl, models:c.models, capabilities:{supportsStreaming:true,supportsVision:false,supportsToolCalling:false} }))]}
            conversations={conversations}
            activeConversationId={session.selectedConversationId}
            onConversationsChange={setConversations}
            onSelectConversation={(id) => updateSession({ selectedConversationId: id })}
            onOpenInspector={(convId) => openInspector(convId)}
            onNavigateToMemory={() => setCurrentTab('memory')}
            onPendingCountChange={loadPendingCount}
            projects={projects}
          />
        )}

        {currentTab === 'memory' && (
          <MemoryManager onMemoryChanged={loadPendingCount} projects={projects} />
        )}

        {currentTab === 'persona' && <PersonaEditor />}
        {currentTab === 'projects' && <ProjectsView onProjectsChanged={loadProjects} />}

        {currentTab === 'settings' && (
          <SettingsView
            session={session}
            onUpdateSession={updateSession}
            providers={providers}
          />
        )}
      </Suspense></div>

      {session.inspectorOpen && <Suspense fallback={null}><ContextInspectorModal
        isOpen={session.inspectorOpen}
        conversationId={session.selectedConversationId}
        onClose={() => updateSession({ inspectorOpen: false })}
      /></Suspense>}
    </div>
  );
}

export default App;
