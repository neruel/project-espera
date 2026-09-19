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

export function createChatRoutes(db: D1Database, registry: ProviderRegistry) {
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

  router.post('/', async (c) => {
    const rawBody = await c.req.json();
    const parseResult = SendMessageSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json({ error: 'Invalid request body', details: parseResult.error.flatten() }, 400);
    }
    const body = parseResult.data;

    // Retrieve credential from header (Session-only BYOK)
    let credential = undefined;
    const credHeader = c.req.header('X-Espera-Credential');
    if (credHeader) {
      try {
        credential = JSON.parse(credHeader);
      } catch {
        // invalid credential header JSON
      }
    }

    // Ensure default user and persona
    const user = await userRepo.ensureUser('user_default', 'Espera User');
    const persona = await personaRepo.ensureDefaultPersona(user.id);

    // Ensure conversation
    let convId = body.conversationId;
    if (!convId) {
      const conv = await convRepo.createConversation(
        user.id,
        body.content.slice(0, 30) || 'New Conversation',
        body.projectId
      );
      convId = conv.id;
    }

    // 1. Save user message
    const userMsg = await convRepo.addMessage({
      conversationId: convId,
      role: 'user',
      content: body.content,
      providerId: body.providerId,
      modelId: body.modelId,
    });

    // 2. Fetch active memories & recent messages
    const activeMemories = await memoryRepo.getActiveMemories(user.id, body.projectId);
    const recentMessages = await convRepo.getRecentMessages(convId, 10);

    // 3. Compose context using ContextEngine
    const project = body.projectId ? await projectRepo.get(body.projectId, user.id) : null;
    const composition = contextEngine.compose({
      userId: user.id,
      conversationId: convId,
      currentQuery: body.content,
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

    const provider = registry.get(body.providerId);

    // 4. Handle response: Streaming or non-streaming
    if (body.stream) {
      return streamSSE(c, async (stream) => {
        let fullAssistantReply = '';

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
          const assistantMsg = await convRepo.addMessage({
            conversationId: convId,
            role: 'assistant',
            content: fullAssistantReply,
            providerId: body.providerId,
            modelId: body.modelId,
          });

          // Trigger asynchronous memory candidate extraction
          const newCandidates = await memoryCoordinator.processTurn({
            userId: user.id,
            projectId: body.projectId,
            messageId: assistantMsg.id,
            userMessage: body.content,
            assistantMessage: fullAssistantReply,
            provider,
            credential,
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
        } catch (err: any) {
          console.error('[ChatRoute] Stream error:', err);
          await stream.writeSSE({
            data: JSON.stringify({ error: err.message || 'Streaming failed' }),
            event: 'error',
          });
        }
      });
    } else {
      // Non-streaming response
      const response = await provider.generate({
        modelId: body.modelId,
        messages: composition.messages,
        credential,
      });

      const assistantMsg = await convRepo.addMessage({
        conversationId: convId,
        role: 'assistant',
        content: response.content,
        providerId: body.providerId,
        modelId: body.modelId,
      });

      // Extract memories
      const newCandidates = await memoryCoordinator.processTurn({
        userId: user.id,
        projectId: body.projectId,
        messageId: assistantMsg.id,
        userMessage: body.content,
        assistantMessage: response.content,
        provider,
        credential,
      });

      return c.json({
        conversationId: convId,
        message: assistantMsg,
        contextRunId: composition.contextRun.id,
        newPendingMemoriesCount: newCandidates.length,
      });
    }
  });

  return router;
}
