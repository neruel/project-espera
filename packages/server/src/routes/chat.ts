import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { SendMessageSchema } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { PersonaRepository } from '../db/repositories/persona.repo.js';
import { ConversationRepository } from '../db/repositories/conversation.repo.js';
import { MemoryRepository } from '../db/repositories/memory.repo.js';
import { ContextRunRepository } from '../db/repositories/context-run.repo.js';
import { ContextEngine } from '../context/engine.js';
import { ProviderRegistry } from '../providers/registry.js';
import { MemoryLifecycleCoordinator } from '../memory/lifecycle.js';
import { MemoryExtractor } from '../memory/extractor.js';
import { MemoryDeduplicator } from '../memory/deduplicator.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { requestUserId } from '../auth/service.js';
import { ProviderConnectionRepository } from '../db/repositories/provider-connection.repo.js';
import type { Message } from '@espera/shared';
import { ProviderError } from '../providers/http.js';

export function createChatRoutes(db: D1Database, registry: ProviderRegistry, credentialEncryptionKey?: string) {
  const router = new Hono();

  const userRepo = new UserRepository(db);
  const personaRepo = new PersonaRepository(db);
  const convRepo = new ConversationRepository(db);
  const memoryRepo = new MemoryRepository(db);
  const contextRunRepo = new ContextRunRepository(db);
  const contextEngine = new ContextEngine();
  const memoryCoordinator = new MemoryLifecycleCoordinator(
    memoryRepo,
    new MemoryExtractor(),
    new MemoryDeduplicator()
  );
  const projectRepo = new ProjectRepository(db);
  const connectionRepo = new ProviderConnectionRepository(db);

  router.post('/', async (c) => {
    const rawBody = await c.req.json().catch(() => null);
    const parseResult = SendMessageSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: 'Invalid request body', details: parseResult.error.flatten() }, 400);
    }
    const body = parseResult.data;

    // Resolve the provider before any write: an unknown id must not leave an
    // orphaned user message behind a 500.
    let provider;
    try {
      provider = registry.get(body.providerId);
    } catch {
      return c.json({ error: 'Unknown provider' }, 400);
    }

    // Retrieve credential from header (Session-only BYOK)
    let credential = undefined;
    const credHeader = c.req.header('X-Espera-Credential');
    if (credHeader) {
      try {
        const parsed = JSON.parse(credHeader) as { apiKey?: unknown; endpointUrl?: unknown };
        if (typeof parsed.apiKey !== 'string' || !parsed.apiKey || parsed.apiKey.length > 10_000) return c.json({ error: 'Invalid credential header' }, 400);
        if (parsed.endpointUrl !== undefined && (typeof parsed.endpointUrl !== 'string' || parsed.endpointUrl.length > 2048)) return c.json({ error: 'Invalid credential endpoint' }, 400);
        credential = { apiKey: parsed.apiKey, endpointUrl: parsed.endpointUrl as string | undefined };
      } catch {
        return c.json({ error: 'Invalid credential header' }, 400);
      }
    }

    if (body.connectionId) {
      const connectionProviderId = await connectionRepo.getProviderId(body.connectionId, requestUserId(c));
      if (!connectionProviderId) return c.json({ error: 'Provider connection not found' }, 404);
      if (connectionProviderId !== body.providerId) return c.json({ error: 'Provider connection does not match providerId' }, 409);
      if (!credential) credential = await connectionRepo.getCredential(body.connectionId, requestUserId(c), credentialEncryptionKey) || undefined;
    }

    // Resolve the authenticated owner once and validate every referenced resource.
    const userId = requestUserId(c);
    const user = await userRepo.ensureUser(userId, 'Espera User');
    const persona = await personaRepo.ensureDefaultPersona(user.id);

    if (body.projectId && !(await projectRepo.get(body.projectId, user.id))) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Ensure conversation
    let convId = body.conversationId;
    let projectId = body.projectId;
    if (convId) {
      const existing = await convRepo.getConversation(convId, user.id);
      if (!existing) return c.json({ error: 'Conversation not found' }, 404);
      if (projectId !== undefined && existing.projectId !== projectId) {
        return c.json({ error: 'Conversation project scope does not match the request' }, 409);
      }
      // Omitted projectId: inherit the conversation's own project scope.
      projectId = existing.projectId;
    } else {
      const conv = await convRepo.createConversation(
        user.id,
        body.content.slice(0, 30) || 'New Conversation',
        projectId
      );
      convId = conv.id;
    }

    // 1. Save a new user message, or reuse the source user message for regeneration.
    let userMsg: Message;
    let createdUserMessage = false;
    let regenerationTarget: Message | null = null;
    if (body.regenerateFromMessageId) {
      regenerationTarget = await convRepo.getMessage(body.regenerateFromMessageId, convId);
      if (!regenerationTarget || regenerationTarget.role !== 'assistant') return c.json({ error: 'Assistant message not found' }, 404);
      const source = await convRepo.getPreviousUserMessage(regenerationTarget.id, convId);
      if (!source) return c.json({ error: 'Source user message not found' }, 409);
      userMsg = source;
    } else {
      userMsg = await convRepo.addMessage({ conversationId: convId, role: 'user', content: body.content, providerId: body.providerId, modelId: body.modelId });
      createdUserMessage = true;
    }

    // 2. Fetch active memories & recent messages
    const activeMemories = await memoryRepo.getActiveMemories(user.id, projectId);
    const recentMessages = (await convRepo.getRecentMessages(convId, 30)).filter((message) => message.id !== regenerationTarget?.id);

    // 3. Compose context using ContextEngine
    const project = projectId ? await projectRepo.get(projectId, user.id) : null;
    const composition = contextEngine.compose({
      userId: user.id,
      conversationId: convId,
      currentQuery: userMsg.content,
      persona,
      project,
      activeMemories,
      recentMessages,
      providerId: body.providerId,
      modelId: body.modelId,
    });

    // Set real message ID on the ContextRun snapshot
    composition.contextRun.messageId = userMsg.id;
    await contextRunRepo.saveRun(composition.contextRun);

    // 4. Handle response: Streaming or non-streaming
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        let fullAssistantReply = '';
        let responsePersisted = false;

        try {
          const streamIterable = provider.stream({
            modelId: body.modelId,
            messages: composition.messages,
            credential,
            signal: c.req.raw.signal,
          });

          for await (const chunk of streamIterable) {
            if (chunk.delta) {
              fullAssistantReply += chunk.delta;
              await stream.writeSSE({
                data: JSON.stringify({ delta: chunk.delta }),
                event: 'message',
              });
            }
            if (chunk.isComplete) {
              break;
            }
          }

          // Save assistant message to D1
          const assistantMsg = regenerationTarget
            ? await convRepo.updateMessage(regenerationTarget.id, convId, { content: fullAssistantReply, providerId: body.providerId, modelId: body.modelId })
            : await convRepo.addMessage({ conversationId: convId, role: 'assistant', content: fullAssistantReply, providerId: body.providerId, modelId: body.modelId });
          responsePersisted = true;

          // Trigger asynchronous memory candidate extraction
          const newCandidates = await memoryCoordinator.processTurn({
            userId: user.id,
            projectId,
            messageId: assistantMsg.id,
            userMessage: userMsg.content,
            assistantMessage: fullAssistantReply,
            provider,
            credential,
            modelId: body.modelId,
          });

          await stream.writeSSE({
            data: JSON.stringify({
              done: true,
              conversationId: convId,
              messageId: assistantMsg.id,
              contextRunId: composition.contextRun.id,
              newPendingMemoriesCount: newCandidates.length,
            }),
            event: 'done',
          });
        } catch (err: unknown) {
          console.error('[ChatRoute] Stream error:', err instanceof Error ? err.name : 'unknown_error');
          if (createdUserMessage && !responsePersisted) await convRepo.deleteMessage(userMsg.id, convId);
          const message = err instanceof ProviderError ? err.message : 'Streaming failed';
          try { await stream.writeSSE({ data: JSON.stringify({ error: message }), event: 'error' }); } catch { /* client disconnected */ }
        }
      });
    } else {
      try {
        // Non-streaming response
        const response = await provider.generate({
          modelId: body.modelId,
          messages: composition.messages,
          credential,
        });

        const assistantMsg = regenerationTarget
          ? await convRepo.updateMessage(regenerationTarget.id, convId, { content: response.content, providerId: body.providerId, modelId: body.modelId })
          : await convRepo.addMessage({ conversationId: convId, role: 'assistant', content: response.content, providerId: body.providerId, modelId: body.modelId });

        const newCandidates = await memoryCoordinator.processTurn({
          userId: user.id,
          projectId,
          messageId: assistantMsg.id,
          userMessage: userMsg.content,
          assistantMessage: response.content,
          provider,
          credential,
          modelId: body.modelId,
        });

        return c.json({
          conversationId: convId,
          message: assistantMsg,
          contextRunId: composition.contextRun.id,
          newPendingMemoriesCount: newCandidates.length,
        });
      } catch (error) {
        if (createdUserMessage) await convRepo.deleteMessage(userMsg.id, convId);
        throw error;
      }
    }
  });

  return router;
}
