import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  Terminal,
  Brain,
  Copy,
  Check,
  Square,
  Loader2,
  RotateCcw,
  Trash2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Conversation, Message, Project } from "@espera/shared";
import { api, type ProviderInfo } from "../../services/api.js";
import type { SessionState } from "../../stores/session.js";
import { useLanguage } from "../../i18n.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ConfirmDialog } from "../Common/ConfirmDialog.js";
import { useDialogAccessibility } from "../Common/useDialogAccessibility.js";

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="chat-message-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...props }) => (
            <a {...props} href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border border-neutral-700 bg-[#0b0b0d] p-3 font-mono text-xs leading-5 text-neutral-300 first:mt-0 last:mb-0">
              {children}
            </pre>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[.9em] text-neutral-200">
                {children}
              </code>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

interface ChatViewProps {
  session: SessionState;
  onUpdateSession: (partial: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationsChange: (conversations: Conversation[]) => void;
  onSelectConversation: (id: string | null) => void;
  onOpenInspector: (conversationId: string) => void;
  onNavigateToMemory: () => void;
  onPendingCountChange: () => void;
  projects: Project[];
}

export const ChatView: React.FC<ChatViewProps> = ({
  session,
  onUpdateSession,
  providers,
  conversations,
  activeConversationId,
  onConversationsChange,
  onSelectConversation,
  onOpenInspector,
  onNavigateToMemory,
  onPendingCountChange,
  projects,
}) => {
  const { t, language } = useLanguage();
  const activeConvId = activeConversationId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState("");
  const [recentExtractedCount, setRecentExtractedCount] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [mobileModelOpen, setMobileModelOpen] = useState(false);
  const mobileSheetRef = useDialogAccessibility(mobileModelOpen, () => setMobileModelOpen(false));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowOutputRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const activeQueryRef = useRef<string | null>(null);
  const regeneratingMessageIdRef = useRef<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    if (conversations.length === 0) void loadConversations();
  }, []);

  useEffect(() => {
    if (
      selectedProjectId &&
      !projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(null);
      if (activeConvId)
        void api
          .updateConversationProject(activeConvId, null)
          .catch(() => undefined);
    }
  }, [projects]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
      setRecentExtractedCount(0);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Mirror the active conversation's persisted scope. Only sync once the record is
  // known: a just-created conversation is not in `conversations` yet, and clearing
  // the scope there would make the next request mismatch the stored project.
  useEffect(() => {
    if (!activeConvId) return;
    const record = conversations.find(
      (conversation) => conversation.id === activeConvId,
    );
    if (record) setSelectedProjectId(record.projectId || null);
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!mobileModelOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileModelOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileModelOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    if (shouldFollowOutputRef.current)
      messagesEndRef.current?.scrollIntoView({
        behavior: streamDelta ? "auto" : "smooth",
      });
  }, [messages, streamDelta]);

  function handleMessageScroll() {
    const element = messagesScrollRef.current;
    if (!element) return;
    shouldFollowOutputRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  async function loadConversations() {
    try {
      const list = await api.getConversations();
      onConversationsChange(list);
      if (
        list.length > 0 &&
        (!activeConvId ||
          !list.some((conversation) => conversation.id === activeConvId))
      ) {
        const preferred =
          session.selectedConversationId &&
          list.some(
            (conversation) =>
              conversation.id === session.selectedConversationId,
          )
            ? session.selectedConversationId
            : list[0].id;
        onSelectConversation(preferred);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "The conversation could not be loaded.",
      );
    }
  }

  async function loadMessages(convId: string) {
    try {
      const page = await api.getMessagesPage(convId);
      setMessages(page.messages);
      setHasOlderMessages(page.hasMore);
    } catch (err) {
      console.error("Failed to load messages", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "The conversation could not be loaded.",
      );
    }
  }

  async function loadOlderMessages() {
    if (!activeConvId || loadingOlderMessages || !hasOlderMessages) return;
    const scroller = messagesScrollRef.current;
    const previousHeight = scroller?.scrollHeight || 0;
    setLoadingOlderMessages(true);
    try {
      const page = await api.getMessagesPage(activeConvId, messages.length);
      setMessages((current) => [...page.messages, ...current]);
      setHasOlderMessages(page.hasMore);
      requestAnimationFrame(() => {
        if (scroller)
          scroller.scrollTop += scroller.scrollHeight - previousHeight;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Older messages could not be loaded.",
      );
    } finally {
      setLoadingOlderMessages(false);
    }
  }

  async function handleProjectChange(projectId: string | null) {
    const previous = selectedProjectId;
    setSelectedProjectId(projectId);
    if (!activeConvId) return;
    try {
      const updated = await api.updateConversationProject(
        activeConvId,
        projectId,
      );
      onConversationsChange(
        conversations.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
    } catch (error) {
      setSelectedProjectId(previous);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The project scope could not be updated.",
      );
    }
  }

  async function handleSendMessage(
    e?: React.FormEvent,
    options?: { query: string; regenerateFromMessageId: string },
  ) {
    if (e) e.preventDefault();
    const query = (options?.query ?? input).trim();
    if (!query || isStreaming) return;

    if (!options) setInput("");
    shouldFollowOutputRef.current = true;
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    setStreamDelta("");
    setRecentExtractedCount(0);
    setErrorMessage(null);
    setFailedQuery(null);

    // Optimistic user message display
    const tempUserMsg: Message = {
      id: `tmp_${Date.now()}`,
      conversationId: activeConvId || "",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };
    pendingUserMessageIdRef.current = options ? null : tempUserMsg.id;
    activeQueryRef.current = query;
    regeneratingMessageIdRef.current = options?.regenerateFromMessageId || null;
    if (!options) setMessages((prev) => [...prev, tempUserMsg]);

    // session.connectionId also holds built-in provider ids (e.g. "mock"); only a
    // saved connection may be sent as connectionId, otherwise the server 404s.
    const connection = session.connections.find(
      (c) => c.id === session.connectionId,
    );
    const credential =
      connection && session.apiKeys[connection.id]
        ? {
            apiKey: session.apiKeys[connection.id],
            endpointUrl: connection.baseUrl,
          }
        : session.apiKeys[session.providerId]
          ? { apiKey: session.apiKeys[session.providerId] }
          : undefined;

    let accumulatedDelta = "";

    try {
      await api.streamChat({
        conversationId: activeConvId || undefined,
        connectionId: connection?.id,
        content: query,
        providerId: session.providerId,
        modelId: session.modelId,
        projectId: selectedProjectId,
        regenerateFromMessageId: options?.regenerateFromMessageId,
        credential,
        signal: abortControllerRef.current.signal,
        onDelta: (delta) => {
          accumulatedDelta += delta;
          setStreamDelta(accumulatedDelta);
        },
        onDone: (data) => {
          setIsStreaming(false);
          setStreamDelta("");
          setErrorMessage(null);
          pendingUserMessageIdRef.current = null;
          activeQueryRef.current = null;
          regeneratingMessageIdRef.current = null;
          if (!activeConvId) {
            onSelectConversation(data.conversationId);
            void loadConversations();
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
          if (!options)
            setMessages((current) =>
              current.filter((message) => message.id !== tempUserMsg.id),
            );
          setErrorMessage(err);
          setFailedQuery(query);
          pendingUserMessageIdRef.current = null;
          activeQueryRef.current = null;
          regeneratingMessageIdRef.current = null;
          if (activeConvId) void loadMessages(activeConvId);
          else void loadConversations();
        },
      });
    } catch (err: any) {
      setIsStreaming(false);
      if (err?.name !== "AbortError") {
        if (!options)
          setMessages((current) =>
            current.filter((message) => message.id !== tempUserMsg.id),
          );
        setErrorMessage(err?.message || "The request failed.");
        setFailedQuery(query);
        if (activeConvId) void loadMessages(activeConvId);
        else void loadConversations();
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  function stopGeneration() {
    const pendingId = pendingUserMessageIdRef.current;
    const query = activeQueryRef.current;
    const wasRegenerating = Boolean(regeneratingMessageIdRef.current);
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamDelta("");
    if (pendingId)
      setMessages((current) =>
        current.filter((message) => message.id !== pendingId),
      );
    if (query && !wasRegenerating) setFailedQuery(query);
    setErrorMessage(
      language === "ko"
        ? "응답 생성을 중단했습니다. 부분 응답은 저장하지 않았으며 다시 시도할 수 있습니다."
        : "Generation stopped. The partial response was not saved and you can retry.",
    );
    pendingUserMessageIdRef.current = null;
    activeQueryRef.current = null;
    regeneratingMessageIdRef.current = null;
  }

  function retryFailedMessage() {
    if (!failedQuery) return;
    setInput(failedQuery);
    setErrorMessage(null);
    setFailedQuery(null);
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(
        () =>
          setCopiedMessageId((current) =>
            current === message.id ? null : current,
          ),
        1600,
      );
    } catch {
      setErrorMessage(
        language === "ko"
          ? "메시지를 복사하지 못했습니다."
          : "The message could not be copied.",
      );
    }
  }

  async function regenerateMessage(message: Message, index: number) {
    const source = [...messages.slice(0, index)]
      .reverse()
      .find((item) => item.role === "user");
    if (!source || isStreaming) return;
    await handleSendMessage(undefined, {
      query: source.content,
      regenerateFromMessageId: message.id,
    });
  }

  async function deleteMessage() {
    if (!deleteTarget || !activeConvId || isStreaming) return;
    try {
      await api.deleteMessage(activeConvId, deleteTarget.id);
      setMessages((current) =>
        current.filter((message) => message.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Message could not be deleted.",
      );
    }
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  const currentProvider =
    providers.find((p) => p.id === session.connectionId) ||
    providers.find((p) => p.id === session.providerId) ||
    providers[0];
  const availableModels = currentProvider?.models || [];
  function selectProvider(id: string) {
    const provider = providers.find((item) => item.id === id);
    const connection = session.connections.find((item) => item.id === id);
    onUpdateSession({
      providerId: connection?.providerId || id,
      connectionId: id,
      modelId: provider?.models[0]?.id || "default",
    });
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden h-full relative bg-[#0b0b0d]">
      {/* Main Chat Thread */}
      <main className="flex-1 flex flex-col bg-[#0b0b0d] overflow-hidden">
        <header className="border-b border-neutral-800 bg-[#0d0d0f] px-3 py-2.5 sm:flex sm:min-h-16 sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-3 sm:mb-0">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-neutral-100 sm:max-w-xs">
                {conversations.find((c) => c.id === activeConvId)?.title ||
                  t("chat.new")}
              </h2>
              <p className="mt-0.5 hidden text-[10px] text-neutral-600 sm:block">
                {currentProvider?.name} · {session.modelId}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <button
                onClick={() => setMobileModelOpen(true)}
                className="chat-header-icon flex"
                aria-label={
                  language === "ko"
                    ? "모델과 프로젝트 선택"
                    : "Choose model and project"
                }
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              {activeConvId && (
                <button
                  onClick={() => onOpenInspector(activeConvId)}
                  title={t("nav.inspector")}
                  aria-label={t("nav.inspector")}
                  className="chat-header-icon flex"
                >
                  <Terminal className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="hidden gap-2 text-xs sm:flex sm:items-center">
            <select
              aria-label="Project scope"
              value={selectedProjectId || ""}
              onChange={(event) =>
                void handleProjectChange(event.target.value || null)
              }
              className="chat-header-select hidden sm:block sm:max-w-[150px]"
            >
              <option value="">{t("chat.global")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Provider"
              value={session.connectionId || session.providerId}
              onChange={(e) => selectProvider(e.target.value)}
              className="chat-header-select min-w-0"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Model"
              value={session.modelId}
              onChange={(e) => onUpdateSession({ modelId: e.target.value })}
              className="chat-header-select min-w-0 sm:max-w-[200px]"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {activeConvId && (
              <button
                onClick={() => onOpenInspector(activeConvId)}
                title={t("nav.inspector")}
                aria-label={t("nav.inspector")}
                className="chat-header-icon hidden sm:flex"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Pending Memory Notification Banner */}
        {recentExtractedCount > 0 && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2 text-amber-300 text-xs">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>
                방금 대화에서{" "}
                <strong>{recentExtractedCount}개의 기억 후보</strong>가
                추출되었습니다.
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
          <div
            className="flex items-center justify-between gap-3 border-b border-rose-900/60 bg-rose-950/40 px-4 py-2 text-sm text-rose-200"
            role="alert"
          >
            <span>{errorMessage}</span>
            {failedQuery && (
              <button
                className="rounded-md border border-rose-700 px-2 py-1 text-xs font-semibold hover:bg-rose-900"
                onClick={retryFailedMessage}
              >
                {t("chat.retry")}
              </button>
            )}
          </div>
        )}

        {/* Message Thread */}
        <div
          ref={messagesScrollRef}
          onScroll={handleMessageScroll}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8"
        >
          {hasOlderMessages && (
            <div className="mx-auto mb-5 flex max-w-3xl justify-center">
              <button
                type="button"
                disabled={loadingOlderMessages}
                className="workspace-button !px-3 !py-2 disabled:opacity-50"
                onClick={() => void loadOlderMessages()}
              >
                {loadingOlderMessages
                  ? t("common.loading")
                  : language === "ko"
                    ? "이전 메시지 불러오기"
                    : "Load older messages"}
              </button>
            </div>
          )}
          {messages.length === 0 && !streamDelta && (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center p-4 text-center text-neutral-500 sm:p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 text-neutral-300 shadow-lg shadow-black/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-neutral-100">
                {t("chat.empty.title")}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                {t("chat.empty.body")}
              </p>
              <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  t("chat.prompt.memory"),
                  t("chat.prompt.plan"),
                  t("chat.prompt.project"),
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3.5 text-left text-xs leading-5 text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mx-auto w-full max-w-3xl space-y-7">
            {messages.map((m, index) => (
              <div
                key={m.id}
                className={`group/message flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[82%] ${
                    m.role === "user"
                      ? "border border-neutral-600 bg-neutral-700 text-neutral-100"
                      : "border border-neutral-800 bg-neutral-900/70 text-neutral-200"
                  }`}
                >
                  <MessageContent content={m.content} />
                </div>
                <div className="mt-1.5 flex items-center gap-2 px-1 text-[10px] text-neutral-600">
                  {m.modelId && <span>{m.modelId}</span>}
                  <span>
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => void copyMessage(m)}
                    aria-label={
                      language === "ko" ? "메시지 복사" : "Copy message"
                    }
                    title={language === "ko" ? "복사" : "Copy"}
                    className="rounded p-1 text-neutral-600 opacity-100 transition hover:bg-neutral-800 hover:text-neutral-300 sm:opacity-0 sm:group-hover/message:opacity-100"
                  >
                    {copiedMessageId === m.id ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {m.role === "assistant" && (
                    <button
                      disabled={isStreaming}
                      onClick={() => void regenerateMessage(m, index)}
                      aria-label={
                        language === "ko"
                          ? "응답 재생성"
                          : "Regenerate response"
                      }
                      title={language === "ko" ? "재생성" : "Regenerate"}
                      className="rounded p-1 text-neutral-600 opacity-100 transition hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-30 sm:opacity-0 sm:group-hover/message:opacity-100"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    disabled={isStreaming}
                    onClick={() => setDeleteTarget(m)}
                    aria-label={
                      language === "ko" ? "메시지 삭제" : "Delete message"
                    }
                    title={language === "ko" ? "삭제" : "Delete"}
                    className="rounded p-1 text-neutral-600 opacity-100 transition hover:bg-rose-950/50 hover:text-rose-300 disabled:opacity-30 sm:opacity-0 sm:group-hover/message:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Streaming Live Delta */}
            {streamDelta && (
              <div className="flex flex-col items-start">
                <div className="max-w-[92%] rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm leading-6 text-neutral-200 sm:max-w-[82%]">
                  {streamDelta}
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-neutral-300 align-middle" />
                </div>
                <span className="mt-1 text-[10px] text-sky-400 px-1 flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t("chat.streaming")}</span>
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-neutral-800 bg-[#0b0b0d]/95 px-3 pb-3 pt-3 sm:px-5 sm:pb-4"
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl shadow-black/30 transition focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-700">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={t("chat.placeholder")}
                disabled={isStreaming}
                rows={1}
                className="max-h-36 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-neutral-100 placeholder-neutral-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!isStreaming && !input.trim()}
                onClick={isStreaming ? stopGeneration : undefined}
                aria-label={isStreaming ? "Stop generation" : "Send message"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${isStreaming ? "border-neutral-600 bg-neutral-700 text-neutral-100 hover:bg-neutral-600" : "border-neutral-600 bg-neutral-700 text-neutral-100 hover:bg-neutral-600 disabled:border-neutral-800 disabled:bg-neutral-800 disabled:text-neutral-600"}`}
              >
                {isStreaming ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-neutral-700">
              <span>
                {language === "ko"
                  ? "Enter 전송 · Shift+Enter 줄바꿈"
                  : "Enter to send · Shift+Enter for a new line"}
              </span>
              <span className="hidden sm:block">{t("chat.disclaimer")}</span>
            </div>
          </div>
        </form>
      </main>
      {mobileModelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={
            language === "ko"
              ? "모델과 프로젝트 선택"
              : "Choose model and project"
          }
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileModelOpen(false);
          }}
        >
<section ref={mobileSheetRef} className="w-full rounded-t-2xl border border-neutral-700 bg-[#171719] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">
                  {language === "ko" ? "대화 설정" : "Chat settings"}
                </h2>
                <p className="mt-1 text-xs text-neutral-600">
                  {currentProvider?.name} · {session.modelId}
                </p>
              </div>
              <button
                autoFocus
                aria-label={t("common.close")}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-800"
                onClick={() => setMobileModelOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-medium text-neutral-400">
                {language === "ko" ? "프로젝트 범위" : "Project scope"}
                <select
                  value={selectedProjectId || ""}
                  onChange={(event) =>
                    void handleProjectChange(event.target.value || null)
                  }
                  className="workspace-input mt-2"
                >
                  <option value="">{t("chat.global")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-neutral-400">
                Provider
                <select
                  value={session.connectionId || session.providerId}
                  onChange={(event) => selectProvider(event.target.value)}
                  className="workspace-input mt-2"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-neutral-400">
                Model
                <select
                  value={session.modelId}
                  onChange={(event) =>
                    onUpdateSession({ modelId: event.target.value })
                  }
                  className="workspace-input mt-2"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="workspace-button workspace-button-primary mt-6 w-full"
              onClick={() => setMobileModelOpen(false)}
            >
              {language === "ko" ? "완료" : "Done"}
            </button>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={false}
        title={language === "ko" ? "메시지를 삭제할까요?" : "Delete message?"}
        description={
          language === "ko"
            ? "이 메시지는 대화 기록에서 영구적으로 삭제됩니다."
            : "This message will be permanently removed from the conversation history."
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteMessage()}
      />
    </div>
  );
};
