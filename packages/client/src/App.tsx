import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { ChatView } from './components/Chat/ChatView.js';
import { MemoryManager } from './components/Memory/MemoryManager.js';
import { PersonaEditor } from './components/Persona/PersonaEditor.js';
import { SettingsView } from './components/Settings/SettingsView.js';
import { ContextInspectorModal } from './components/Inspector/ContextInspectorModal.js';
import {
  getInitialSession,
  saveSessionState,
  type SessionState,
} from './stores/session.js';
import { api, type ProviderInfo } from './services/api.js';

export function App() {
  const [currentTab, setCurrentTab] = useState<'chat' | 'memory' | 'persona' | 'settings'>('chat');
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

  useEffect(() => {
    saveSessionState(session);
  }, [session]);

  useEffect(() => {
    loadProviders();
    loadPendingCount();
    loadConnections();
  }, []);

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

  function updateSession(partial: Partial<SessionState>) {
    setSession((prev) => ({ ...prev, ...partial }));
  }

  function openInspector(conversationId?: string) {
    updateSession({
      inspectorOpen: true,
      selectedConversationId: conversationId || session.selectedConversationId,
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingCount}
        session={session}
        onToggleInspector={() => openInspector()}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentTab === 'chat' && (
          <ChatView
            session={session}
            onUpdateSession={updateSession}
            providers={[...providers, ...session.connections.map(c => ({ id:c.id, name:c.name, defaultBaseUrl:c.baseUrl, models:c.models, capabilities:{supportsStreaming:true,supportsVision:false,supportsToolCalling:false} }))]}
            onOpenInspector={(convId) => openInspector(convId)}
            onNavigateToMemory={() => setCurrentTab('memory')}
            onPendingCountChange={loadPendingCount}
          />
        )}

        {currentTab === 'memory' && (
          <MemoryManager onMemoryChanged={loadPendingCount} />
        )}

        {currentTab === 'persona' && <PersonaEditor />}

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
