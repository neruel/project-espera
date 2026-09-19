import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  Terminal,
  Brain,
  FolderKanban,
  Sliders,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import type { Conversation, Message, Project } from '@espera/shared';
import { api, type ProviderInfo } from '../../services/api.js';
import type { SessionState } from '../../stores/session.js';
import { useLanguage } from '../../i18n.js';
import type { AuthState } from '../../services/api.js';
import { AccountMenu } from '../Account/AccountMenu.js';

interface ChatViewProps {
  session: SessionState;
  onUpdateSession: (partial: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  onOpenInspector: (conversationId: string) => void;
  onNavigateToMemory: () => void;
  onPendingCountChange: () => void;
  pendingCount: number;
  projects: Project[];
  onNavigateTab: (tab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings') => void;
  auth: AuthState;
  onLoggedOut: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  session,
  onUpdateSession,
  providers,
  onOpenInspector,
  onNavigateToMemory,
  onPendingCountChange,
  pendingCount,
  projects,
  onNavigateTab,
  auth,
  onLoggedOut,
}) => {
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [recentExtractedCount, setRecentExtractedCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
      setSelectedProjectId(conversations.find((conversation) => conversation.id === activeConvId)?.projectId || null);
      setRecentExtractedCount(0);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamDelta]);

  async function loadConversations() {
    try {
      const list = await api.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const msgs = await api.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }

  async function handleCreateNewConversation() {
    try {
      const conv = await api.createConversation('New Conversation', selectedProjectId);
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      setStreamDelta('');
      setRecentExtractedCount(0);
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    setStreamDelta('');
    setRecentExtractedCount(0);
    setErrorMessage(null);
    setFailedQuery(null);

    // Optimistic user message display
    const tempUserMsg: Message = {
      id: `tmp_${Date.now()}`,
      conversationId: activeConvId || '',
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const connection = session.connections.find(c => c.id === session.connectionId || c.id === session.providerId);
    const credential = connection && session.apiKeys[connection.id]
      ? { apiKey: session.apiKeys[connection.id], endpointUrl: connection.baseUrl }
      : session.apiKeys[session.providerId] ? { apiKey: session.apiKeys[session.providerId] } : undefined;

    let accumulatedDelta = '';

    try {
      await api.streamChat({
        conversationId: activeConvId || undefined,
        content: query,
        providerId: session.providerId,
        modelId: session.modelId,
        projectId: selectedProjectId,
        credential,
        signal: abortControllerRef.current.signal,
        onDelta: (delta) => {
          accumulatedDelta += delta;
          setStreamDelta(accumulatedDelta);
        },
        onDone: (data) => {
          setIsStreaming(false);
          setStreamDelta('');
          setErrorMessage(null);
          if (!activeConvId) {
            setActiveConvId(data.conversationId);
            loadConversations();
          }
          if (data.newPendingMemoriesCount > 0) {
            setRecentExtractedCount(data.newPendingMemoriesCount);
            onPendingCountChange();
          }
          // Reload real messages from DB
          loadMessages(data.conversationId);
        },
        onError: (err) => {
          setIsStreaming(false);
          setMessages((current) => current.filter((message) => message.id !== tempUserMsg.id));
          setErrorMessage(err);
          setFailedQuery(query);
        },
      });
    } catch (err: any) {
      setIsStreaming(false);
      if (err?.name !== 'AbortError') {
        setMessages((current) => current.filter((message) => message.id !== tempUserMsg.id));
        setErrorMessage(err?.message || 'The request failed.');
        setFailedQuery(query);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamDelta('');
  }

  function retryFailedMessage() {
    if (!failedQuery) return;
    setInput(failedQuery);
    setErrorMessage(null);
    setFailedQuery(null);
  }

  const currentProvider = providers.find((p) => p.id === session.connectionId) || providers.find((p) => p.id === session.providerId) || providers[0];
  const availableModels = currentProvider?.models || [];

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden h-full relative bg-[#0b0b0d]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Unified ChatGPT-style workspace sidebar */}
      <aside
        className={`w-72 bg-[#101012] border-r border-neutral-800 flex flex-col z-20 transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 fixed inset-y-16 left-0' : '-translate-x-full md:relative md:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-black">E</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">Project Espera</div><div className="truncate text-[10px] text-neutral-500">{t('brand.tagline')}</div></div>
          {sidebarOpen && <button type="button" aria-label="Close conversations" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-white md:hidden"><X className="h-4 w-4" /></button>}
        </div>
        <div className="space-y-1 border-b border-neutral-800 p-3">
          <button
            onClick={handleCreateNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            <Plus className="w-4 h-4" />
            <span>{t('chat.new')}</span>
          </button>
          <button onClick={() => onNavigateTab('projects')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"><FolderKanban className="h-4 w-4" />{t('nav.projects')}</button>
          <button onClick={() => onNavigateTab('memory')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"><Brain className="h-4 w-4" />{t('nav.memory')}{pendingCount > 0 && <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">{pendingCount}</span>}</button>
          <button onClick={() => onNavigateTab('persona')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"><Sparkles className="h-4 w-4" />{t('nav.persona')}</button>
          <button onClick={() => onNavigateTab('settings')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"><Sliders className="h-4 w-4" />{t('nav.settings')}</button>
        </div>

        <div className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-600">{t('chat.conversations')}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">{t('chat.emptyConversations')}</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveConvId(c.id);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center space-x-2.5 text-xs transition ${
                  activeConvId === c.id
                    ? 'bg-neutral-800 text-white font-medium'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{c.title || t('chat.new')}</span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-neutral-800 p-3"><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">Account</p><AccountMenu auth={auth} onLoggedOut={onLoggedOut} /></div>
      </aside>

      {/* Main Chat Thread */}
      <main className="flex-1 flex flex-col bg-[#090d16] overflow-hidden">
        {/* Chat Header with Provider/Model Switcher */}
        <div className="min-h-14 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-3 bg-[#0d1422]/80 backdrop-blur">
          <div className="flex items-center space-x-2">
            {!sidebarOpen && <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open conversations"
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            ><Menu className="w-5 h-5" /></button>}
            <h2 className="text-sm font-semibold text-slate-100 truncate max-w-[160px] sm:max-w-xs">
              {conversations.find((c) => c.id === activeConvId)?.title || t('chat.conversation')}
            </h2>
          </div>

          {/* Model Switcher Dropdowns */}
          <div className="flex items-center space-x-2 text-xs">
            <select
              aria-label="Project scope"
              value={selectedProjectId || ''}
              onChange={(event) => setSelectedProjectId(event.target.value || null)}
              className="hidden max-w-[150px] rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 sm:block"
            >
              <option value="">{t('chat.global')}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {/* Provider Selector */}
            <select
              value={session.connectionId || session.providerId}
              onChange={(e) => {
                const newProv = e.target.value;
                const pInfo = providers.find((p) => p.id === newProv);
                const firstModel = pInfo?.models[0]?.id || 'default';
                const conn=session.connections.find(c=>c.id===newProv); onUpdateSession({ providerId: conn?.providerId || newProv, connectionId:newProv, modelId:firstModel });
              }}
              className="bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Model Selector */}
            <select
              value={session.modelId}
              onChange={(e) => onUpdateSession({ modelId: e.target.value })}
              className="bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40 max-w-[140px] sm:max-w-[200px] truncate"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* Inspector Quick Button */}
            {activeConvId && (
              <button
                onClick={() => onOpenInspector(activeConvId)}
                title="이 대화의 컨텍스트 구성 검사"
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-400 border border-slate-700"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Pending Memory Notification Banner */}
        {recentExtractedCount > 0 && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2 text-amber-300 text-xs">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>
                방금 대화에서 <strong>{recentExtractedCount}개의 기억 후보</strong>가 추출되었습니다.
              </span>
            </div>
            <button
              onClick={onNavigateToMemory}
              className="text-xs font-semibold text-amber-400 underline hover:text-amber-300 ml-2"
            >
              기억 보관소에서 검토 &rarr;
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center justify-between gap-3 border-b border-rose-900/60 bg-rose-950/40 px-4 py-2 text-sm text-rose-200" role="alert">
            <span>{errorMessage}</span>
            {failedQuery && <button className="rounded-md border border-rose-700 px-2 py-1 text-xs font-semibold hover:bg-rose-900" onClick={retryFailedMessage}>{t('chat.retry')}</button>}
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-5">
          {messages.length === 0 && !streamDelta && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 flex items-center justify-center text-sky-300 border border-sky-500/20 shadow-xl shadow-sky-950/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-100">{t('chat.empty.title')}</h3>
              <p className="mt-2 text-sm max-w-md leading-6 text-slate-400">
                {t('chat.empty.body')}
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xl">
                {[t('chat.prompt.memory'), t('chat.prompt.plan'), t('chat.prompt.project')].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setInput(prompt)} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-left text-xs text-slate-300 hover:border-sky-500/40 hover:bg-slate-800 transition">{prompt}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none shadow-md shadow-sky-600/10'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {m.content}
              </div>
              <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-500 px-1">
                {m.modelId && <span>{m.modelId}</span>}
                <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}

          {/* Streaming Live Delta */}
          {streamDelta && (
            <div className="flex flex-col items-start">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed bg-slate-900 border border-sky-900/50 text-slate-200 rounded-bl-none">
                {streamDelta}
                <span className="inline-block w-1.5 h-4 bg-sky-400 ml-1 animate-pulse align-middle" />
              </div>
              <span className="mt-1 text-[10px] text-sky-400 px-1 flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('chat.streaming')}</span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-slate-800 bg-[#0d1422]/90 backdrop-blur"
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center space-x-2 rounded-2xl border border-slate-700/80 bg-slate-950 p-2 shadow-xl shadow-black/20 focus-within:border-sky-500/60 focus-within:ring-4 focus-within:ring-sky-500/5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.placeholder')}
              disabled={isStreaming}
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!isStreaming && !input.trim()}
              onClick={isStreaming ? stopGeneration : undefined}
              aria-label={isStreaming ? 'Stop generation' : 'Send message'}
              className="p-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white transition shadow-sm"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-600">Espera can make mistakes. Review important memories before approving them.</p>
          </div>
        </form>
      </main>
    </div>
  );
};
