import { useEffect, useRef, useState } from 'react';
import type { Message } from '@espera/shared';
import { api } from '../../services/api.js';
import type { SessionState } from '../../stores/session.js';
import { useLanguage } from '../../i18n.js';

interface Options {
  session: SessionState;
  conversationId: string | null;
  projectId: string | null;
  onConversationCreated: (id: string) => void;
  onPendingCountChange: () => void;
  /** Called whenever a request settles so the conversation list can refresh titles and order. */
  onConversationsStale: () => void;
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** Owns the message thread for one conversation: paging, streaming, retry, regenerate, and delete. */
export function useChatMessages({ session, conversationId, projectId, onConversationCreated, onPendingCountChange, onConversationsStale }: Options) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDelta, setStreamDelta] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Pending memory candidates extracted from the latest reply, keyed to that reply's conversation. */
  const [extractedCount, setExtractedCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const activeQueryRef = useRef<string | null>(null);
  const regeneratingRef = useRef(false);
  const createdConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Keep the memory chip when this effect runs only because the first reply created the conversation.
    if (conversationId !== createdConversationIdRef.current) setExtractedCount(0);
    createdConversationIdRef.current = null;
    setErrorMessage(null);
    setFailedQuery(null);
    if (conversationId) void loadMessages(conversationId);
    else {
      setMessages([]);
      setHasOlderMessages(false);
    }
  }, [conversationId]);

  async function loadMessages(id: string) {
    setLoading(true);
    try {
      const page = await api.getMessagesPage(id);
      setMessages(page.messages);
      setHasOlderMessages(page.hasMore);
    } catch (error) {
      setErrorMessage(errorText(error, t('chat.error.load')));
    } finally {
      setLoading(false);
    }
  }

  /** Returns true when older messages were prepended so the caller can preserve scroll position. */
  async function loadOlderMessages() {
    if (!conversationId || loadingOlder || !hasOlderMessages) return false;
    setLoadingOlder(true);
    try {
      const page = await api.getMessagesPage(conversationId, messages.length);
      setMessages((current) => [...page.messages, ...current]);
      setHasOlderMessages(page.hasMore);
      return true;
    } catch (error) {
      setErrorMessage(errorText(error, t('chat.error.older')));
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }

  function resetStreamRefs() {
    pendingUserMessageIdRef.current = null;
    activeQueryRef.current = null;
    regeneratingRef.current = false;
  }

  async function send(query: string, regenerateFromMessageId?: string) {
    query = query.trim();
    if (!query || isStreaming) return false;

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    setStreamDelta('');
    setExtractedCount(0);
    setErrorMessage(null);
    setFailedQuery(null);

    const tempUserMessage: Message = {
      id: `tmp_${Date.now()}`,
      conversationId: conversationId || '',
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };
    pendingUserMessageIdRef.current = regenerateFromMessageId ? null : tempUserMessage.id;
    activeQueryRef.current = query;
    regeneratingRef.current = Boolean(regenerateFromMessageId);
    if (!regenerateFromMessageId) setMessages((previous) => [...previous, tempUserMessage]);

    // session.connectionId also holds built-in provider ids (e.g. "mock"); only a
    // saved connection may be sent as connectionId, otherwise the server 404s.
    const connection = session.connections.find((item) => item.id === session.connectionId);
    const credential = connection && session.apiKeys[connection.id]
      ? { apiKey: session.apiKeys[connection.id], endpointUrl: connection.baseUrl }
      : session.apiKeys[session.providerId]
        ? { apiKey: session.apiKeys[session.providerId] }
        : undefined;

    const fail = (message: string) => {
      setIsStreaming(false);
      setStreamDelta('');
      if (!regenerateFromMessageId) setMessages((current) => current.filter((message) => message.id !== tempUserMessage.id));
      setErrorMessage(message);
      setFailedQuery(query);
      resetStreamRefs();
      if (conversationId) void loadMessages(conversationId);
      onConversationsStale();
    };

    let accumulated = '';
    try {
      await api.streamChat({
        conversationId: conversationId || undefined,
        connectionId: connection?.id,
        content: query,
        providerId: session.providerId,
        modelId: session.modelId,
        projectId,
        regenerateFromMessageId,
        credential,
        signal: abortControllerRef.current.signal,
        onDelta: (delta) => {
          accumulated += delta;
          setStreamDelta(accumulated);
        },
        onDone: (data) => {
          setIsStreaming(false);
          setStreamDelta('');
          resetStreamRefs();
          if (data.newPendingMemoriesCount > 0) {
            setExtractedCount(data.newPendingMemoriesCount);
            onPendingCountChange();
          }
          // A new conversation's thread is loaded by the conversationId effect.
          if (conversationId) void loadMessages(data.conversationId);
          else {
            createdConversationIdRef.current = data.conversationId;
            onConversationCreated(data.conversationId);
          }
          onConversationsStale();
        },
        onError: (error) => fail(error),
      });
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') fail(errorText(error, t('chat.error.request')));
    } finally {
      abortControllerRef.current = null;
    }
    return true;
  }

  function stop() {
    const pendingId = pendingUserMessageIdRef.current;
    const query = activeQueryRef.current;
    const wasRegenerating = regeneratingRef.current;
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamDelta('');
    if (pendingId) setMessages((current) => current.filter((message) => message.id !== pendingId));
    if (query && !wasRegenerating) setFailedQuery(query);
    setErrorMessage(t('chat.stopped'));
    resetStreamRefs();
  }

  async function regenerate(message: Message) {
    const index = messages.findIndex((item) => item.id === message.id);
    const source = messages.slice(0, index).reverse().find((item) => item.role === 'user');
    if (!source || isStreaming) return;
    await send(source.content, message.id);
  }

  async function deleteMessage(message: Message) {
    if (!conversationId || isStreaming) return;
    try {
      await api.deleteMessage(conversationId, message.id);
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (error) {
      setErrorMessage(errorText(error, t('chat.error.delete')));
    }
  }

  /** Hands the failed prompt back to the composer and clears the error. */
  function takeFailedQuery() {
    const query = failedQuery;
    setErrorMessage(null);
    setFailedQuery(null);
    return query;
  }

  return {
    messages,
    loading,
    isStreaming,
    streamDelta,
    errorMessage,
    failedQuery,
    hasOlderMessages,
    loadingOlder,
    extractedCount,
    send,
    stop,
    regenerate,
    deleteMessage,
    loadOlderMessages,
    takeFailedQuery,
    dismissError: () => setErrorMessage(null),
    reportError: setErrorMessage,
  };
}
