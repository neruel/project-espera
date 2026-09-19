import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  Terminal,
  Brain,
  ChevronDown,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import type { Conversation, Message } from '@espera/shared';
import { api, type ProviderInfo } from '../../services/api.js';
import type { SessionState } from '../../stores/session.js';

interface ChatViewProps {
  session: SessionState;
  onUpdateSession: (partial: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  onOpenInspector: (conversationId: string) => void;
  onNavigateToMemory: () => void;
  onPendingCountChange: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  session,
  onUpdateSession,
  providers,
  onOpenInspector,
  onNavigateToMemory,
  onPendingCountChange,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [recentExtractedCount, setRecentExtractedCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
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
      const conv = await api.createConversation('새 대화');
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
    setStreamDelta('');
    setRecentExtractedCount(0);

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
        credential,
        onDelta: (delta) => {
          accumulatedDelta += delta;
          setStreamDelta(accumulatedDelta);
        },
        onDone: (data) => {
          setIsStreaming(false);
          setStreamDelta('');
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
          alert(`전송 오류: ${err}`);
        },
      });
    } catch (err: any) {
      setIsStreaming(false);
      alert(`오류 발생: ${err.message}`);
    }
  }

  const currentProvider = providers.find((p) => p.id === session.connectionId) || providers.find((p) => p.id === session.providerId) || providers[0];
  const availableModels = currentProvider?.models || [];

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)] relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: Conversation List */}
      <aside
        className={`w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-20 transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 fixed inset-y-16 left-0' : '-translate-x-full md:relative md:translate-x-0'
        }`}
      >
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={handleCreateNewConversation}
            className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>새 대화 시작</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">대화 내역이 없습니다.</div>
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
                    ? 'bg-slate-800 text-sky-400 font-medium border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate flex-1">{c.title || '새 대화'}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Thread */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {/* Chat Header with Provider/Model Switcher */}
        <div className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[160px] sm:max-w-xs">
              {conversations.find((c) => c.id === activeConvId)?.title || '에스페라 대화'}
            </h2>
          </div>

          {/* Model Switcher Dropdowns */}
          <div className="flex items-center space-x-2 text-xs">
            {/* Provider Selector */}
            <select
              value={session.connectionId || session.providerId}
              onChange={(e) => {
                const newProv = e.target.value;
                const pInfo = providers.find((p) => p.id === newProv);
                const firstModel = pInfo?.models[0]?.id || 'default';
                const conn=session.connections.find(c=>c.id===newProv); onUpdateSession({ providerId: conn?.providerId || newProv, connectionId:newProv, modelId:firstModel });
              }}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
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
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[140px] sm:max-w-[200px] truncate"
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

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamDelta && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-sky-400 border border-slate-800">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">지속형 개인 AI 에스페라</h3>
              <p className="text-xs max-w-sm text-slate-400">
                대화 중 공유해주시는 중요한 프로젝트, 직업, 선호도는 자동으로 기억 후보로 저장되며, 승인 시 모든 AI 모델에서 공유됩니다.
              </p>
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
                <span>답변 스트리밍 중...</span>
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-800 bg-slate-900/80 backdrop-blur"
        >
          <div className="flex items-center space-x-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요... (예: 나는 컴퓨터공학을 전공하고 Project Espera를 개발하고 있어)"
              disabled={isStreaming}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition shadow-sm"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
