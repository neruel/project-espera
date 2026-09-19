import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { ChatView } from './components/Chat/ChatView.js';
import { MemoryManager } from './components/Memory/MemoryManager.js';
import { PersonaEditor } from './components/Persona/PersonaEditor.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { ProjectsView } from './components/Projects/ProjectsView.js';
import { ContextInspectorModal } from './components/Inspector/ContextInspectorModal.js';
import {
  getInitialSession,
  saveSessionState,
  type SessionState,
} from './stores/session.js';
import { api, type ProviderInfo } from './services/api.js';
import type { AuthState } from './services/api.js';
import { LoginView } from './components/Auth/LoginView.js';
import type { Project } from '@espera/shared';

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
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

  useEffect(() => {
    saveSessionState(session);
  }, [session]);

  useEffect(() => {
    api.getAuthState().then(setAuth).catch(() => setAuth({ authenticated: false, required: false, configured: false, user: null }));
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
  }, [auth?.authenticated, auth?.required]);

  async function loadProviders() {
    try {
      const list = await api.getProviders();
      if (list.length > 0) {
        setProviders(list);
      }
    } catch (err) {
      console.error('Failed to load providers', err);
    }
  }

  async function loadPendingCount() {
    try {
      const pendings = await api.getMemories('pending');
      setPendingCount(pendings.length);
    } catch (err) {
      console.error('Failed to load pending memory count', err);
    }
  }

  async function loadConnections() {
    try {
      const connections = await api.getProviderConnections();
      setSession((previous) => ({ ...previous, connections }));
    } catch (err) {
      console.error('Failed to load provider connections', err);
    }
  }

  async function loadProjects() {
    try { setProjects(await api.getProjects()); } catch (err) { console.error('Failed to load projects', err); }
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

  if (!auth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading Espera…</div>;
  if (auth.required && !auth.authenticated) return <LoginView auth={auth} />;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-neutral-100 flex flex-col md:flex-row font-sans">
      {currentTab !== 'chat' && <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingCount={pendingCount}
          session={session}
          onToggleInspector={() => openInspector()}
          auth={auth}
          onLoggedOut={() => setAuth({ ...auth, authenticated: false, user: null })}
        />}

      <div className="flex-1 min-w-0 min-h-screen flex flex-col overflow-hidden">
        {currentTab === 'chat' && (
          <ChatView
            session={session}
            onUpdateSession={updateSession}
            providers={[...providers, ...session.connections.map(c => ({ id:c.id, name:c.name, defaultBaseUrl:c.baseUrl, models:c.models, capabilities:{supportsStreaming:true,supportsVision:false,supportsToolCalling:false} }))]}
            onOpenInspector={(convId) => openInspector(convId)}
            onNavigateToMemory={() => setCurrentTab('memory')}
            onPendingCountChange={loadPendingCount}
            pendingCount={pendingCount}
            projects={projects}
            onNavigateTab={setCurrentTab}
            auth={auth}
            onLoggedOut={() => setAuth({ ...auth, authenticated: false, user: null })}
          />
        )}

        {currentTab === 'memory' && (
          <MemoryManager onMemoryChanged={loadPendingCount} />
        )}

        {currentTab === 'persona' && <PersonaEditor />}
        {currentTab === 'projects' && <ProjectsView />}

        {currentTab === 'settings' && (
          <SettingsView
            session={session}
            onUpdateSession={updateSession}
            providers={providers}
          />
        )}
      </div>

      <ContextInspectorModal
        isOpen={session.inspectorOpen}
        conversationId={session.selectedConversationId}
        onClose={() => updateSession({ inspectorOpen: false })}
      />
    </div>
  );
}

export default App;
