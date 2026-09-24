import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, FileSearch, Menu as MenuIcon, PanelLeft, SquarePen } from 'lucide-react';
import type { Conversation, Message, Project } from '@espera/shared';
import { api, type ProviderInfo } from '../../services/api.js';
import type { SessionState } from '../../stores/session.js';
import { useLanguage } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Composer, type ComposerHandle } from './Composer.js';
import { MarkdownContent } from './MarkdownContent.js';
import { MessageItem } from './MessageItem.js';
import { ModelPicker } from './ModelPicker.js';
import { useChatMessages } from './useChatMessages.js';

interface ChatViewProps {
  session: SessionState;
  onUpdateSession: (partial: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationsChange: (conversations: Conversation[]) => void;
  onConversationCreated: (id: string) => void;
  onConversationsStale: () => void;
  onOpenInspector: () => void;
  onNavigateToMemory: () => void;
  onPendingCountChange: () => void;
  onManageConnections: () => void;
  onNewChat: () => void;
  onOpenSidebar: () => void;
  sidebarCollapsed: boolean;
  projects: Project[];
}

const FOLLOW_THRESHOLD = 120;

export function ChatView({
  session,
  onUpdateSession,
  providers,
  conversations,
  activeConversationId,
  onConversationsChange,
  onConversationCreated,
  onConversationsStale,
  onOpenInspector,
  onNavigateToMemory,
  onPendingCountChange,
  onManageConnections,
  onNewChat,
  onOpenSidebar,
  sidebarCollapsed,
  projects,
}: ChatViewProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const composerRef = useRef<ComposerHandle | null>(null);

  const chat = useChatMessages({
    session,
    conversationId: activeConversationId,
    projectId,
    onConversationCreated,
    onPendingCountChange,
    onConversationsStale,
  });

  // Mirror the active conversation's stored scope once its record is known; a
  // just-created conversation is not listed yet and must keep the chosen scope.
  useEffect(() => {
    if (!activeConversationId) return;
    const record = conversations.find((conversation) => conversation.id === activeConversationId);
    if (record) setProjectId(record.projectId || null);
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (projectId && !projects.some((project) => project.id === projectId)) setProjectId(null);
  }, [projects]);

  useEffect(() => {
    followRef.current = true;
    composerRef.current?.focus();
  }, [activeConversationId]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && followRef.current) element.scrollTop = element.scrollHeight;
  }, [chat.messages, chat.streamDelta, chat.isStreaming, chat.errorMessage, chat.extractedCount]);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_THRESHOLD;
    followRef.current = near;
    setAtBottom(near);
  }

  function scrollToBottom() {
    followRef.current = true;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }

  async function loadOlder() {
    const element = scrollRef.current;
    const previousHeight = element?.scrollHeight || 0;
    followRef.current = false;
    if (await chat.loadOlderMessages()) {
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - previousHeight; });
    }
  }

  async function submit() {
    followRef.current = true;
    const query = input;
    if (!query.trim()) return;
    setInput('');
    await chat.send(query);
  }

  function retry() {
    const query = chat.takeFailedQuery();
    if (query) {
      setInput(query);
      composerRef.current?.focus();
    }
  }

  async function changeProject(next: string | null) {
    const previous = projectId;
    setProjectId(next);
    if (!activeConversationId) return;
    try {
      const updated = await api.updateConversationProject(activeConversationId, next);
      onConversationsChange(conversations.map((conversation) => (conversation.id === updated.id ? updated : conversation)));
    } catch (error) {
      setProjectId(previous);
      chat.reportError(error instanceof Error ? error.message : t('chat.error.scope'));
    }
  }

  // Stable callbacks keep memoized message rows from re-rendering on every stream delta.
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const regenerate = useCallback((message: Message) => { followRef.current = true; void chatRef.current.regenerate(message); }, []);
  const copyError = useCallback(() => chatRef.current.reportError(t('chat.error.copy')), [t]);

  const isEmpty = chat.messages.length === 0 && !chat.isStreaming && !chat.loading && !activeConversationId;
  const lastAssistantId = [...chat.messages].reverse().find((message) => message.role === 'assistant')?.id;

  const composer = (
    <Composer
      ref={composerRef}
      value={input}
      onChange={setInput}
      onSubmit={() => void submit()}
      onStop={chat.stop}
      isStreaming={chat.isStreaming}
      projects={projects}
      projectId={projectId}
      onProjectChange={(next) => void changeProject(next)}
    />
  );

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
        <button type="button" className="icon-btn md:hidden" onClick={onOpenSidebar} aria-label={t('nav.openSidebar')}>
          <MenuIcon className="h-5 w-5" />
        </button>
        {sidebarCollapsed && (
          <div className="hidden items-center gap-1 md:flex">
            <button type="button" className="icon-btn" onClick={onOpenSidebar} aria-label={t('nav.openSidebar')} title={t('nav.openSidebar')}>
              <PanelLeft className="h-5 w-5" />
            </button>
            <button type="button" className="icon-btn" onClick={onNewChat} aria-label={t('chat.new')} title={t('chat.new')}>
              <SquarePen className="h-5 w-5" />
            </button>
          </div>
        )}
        <ModelPicker session={session} providers={providers} onUpdateSession={onUpdateSession} onManageConnections={onManageConnections} />
        <div className="ml-auto flex items-center gap-1">
          {activeConversationId && (
            <button type="button" className="icon-btn" onClick={onOpenInspector} aria-label={t('inspector.title')} title={t('inspector.title')}>
              <FileSearch className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="icon-btn md:hidden" onClick={onNewChat} aria-label={t('chat.new')}>
            <SquarePen className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[12vh]">
          <div className="w-full max-w-3xl">
            <h1 className="mb-8 text-center text-[28px] font-semibold tracking-[-0.02em] text-fg">{t('chat.empty.title')}</h1>
            {composer}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[t('chat.prompt.memory'), t('chat.prompt.plan'), t('chat.prompt.explain')].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => { setInput(prompt); composerRef.current?.focus(); }}
                  className="rounded-full border border-line px-3.5 py-2 text-[13px] text-fg-2 transition-colors hover:bg-[var(--hover)] hover:text-fg"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6">
              {chat.hasOlderMessages && (
                <div className="mb-6 flex justify-center">
                  <button type="button" disabled={chat.loadingOlder} className="btn btn-secondary btn-sm" onClick={() => void loadOlder()}>
                    {chat.loadingOlder ? t('common.loading') : t('chat.loadOlder')}
                  </button>
                </div>
              )}
              {chat.loading && chat.messages.length === 0 && <p className="py-10 text-center text-sm text-fg-3">{t('common.loading')}</p>}
              <div className="space-y-8">
                {chat.messages.map((message) => (
                  <div key={message.id}>
                    <MessageItem
                      message={message}
                      isLast={message.id === lastAssistantId && !chat.isStreaming}
                      busy={chat.isStreaming}
                      onRegenerate={regenerate}
                      onDelete={setDeleteTarget}
                      onCopyError={copyError}
                    />
                    {message.id === lastAssistantId && chat.extractedCount > 0 && !chat.isStreaming && (
                      <button
                        type="button"
                        onClick={onNavigateToMemory}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-[13px] text-fg transition-colors hover:bg-accent/20"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                        {t('chat.memoryCandidates', { count: chat.extractedCount })}
                        <span className="text-fg-2">· {t('chat.review')}</span>
                      </button>
                    )}
                  </div>
                ))}
                {chat.isStreaming && (
                  <div aria-live="polite" aria-busy="true">
                    {chat.streamDelta
                      ? <MarkdownContent content={chat.streamDelta} streaming />
                      : <span className="stream-caret !ml-0" aria-label={t('chat.thinking')} />}
                  </div>
                )}
                {chat.errorMessage && (
                  <div className="alert" role="alert">
                    <span className="min-w-0 flex-1">{chat.errorMessage}</span>
                    <div className="flex shrink-0 gap-1">
                      {chat.failedQuery && <button type="button" className="btn btn-sm btn-secondary !border-danger/40 !text-danger" onClick={retry}>{t('chat.retry')}</button>}
                      <button type="button" className="btn btn-sm btn-ghost !text-danger" onClick={chat.dismissError}>{t('common.close')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative shrink-0 px-3 pb-3 sm:px-4 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
            {!atBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label={t('chat.scrollToBottom')}
                className="absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-bg text-fg-2 shadow-sm transition-colors hover:text-fg"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
            <div className="mx-auto w-full max-w-3xl">
              {composer}
              <p className="mt-2 text-center text-xs text-fg-3">{t('chat.disclaimer')}</p>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('chat.deleteMessageTitle')}
        description={t('chat.deleteMessageBody')}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void chat.deleteMessage(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </main>
  );
}
