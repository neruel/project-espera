import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import type { D1Database } from '../db/d1-interface.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { PersonaRepository } from '../db/repositories/persona.repo.js';
import { MemoryRepository } from '../db/repositories/memory.repo.js';
import { ContextEngine } from '../context/engine.js';
import { MockProvider } from '../providers/mock.provider.js';
import { MemoryDeduplicator } from '../memory/deduplicator.js';
import {
  MemoryCandidateSchema,
  type Memory,
  type Persona,
} from '@espera/shared';
import { maskApiKey, sanitizeLogData } from '../security/crypto.js';

describe('Unit Tests - Project Espera Core Subsystems', () => {
  let db: D1Database;
  let userRepo: UserRepository;
  let personaRepo: PersonaRepository;
  let memoryRepo: MemoryRepository;
  let contextEngine: ContextEngine;
  let defaultPersona: Persona;

  beforeEach(async () => {
    db = await createTestDatabase();
    userRepo = new UserRepository(db);
    personaRepo = new PersonaRepository(db);
    memoryRepo = new MemoryRepository(db);
    contextEngine = new ContextEngine();

    const user = await userRepo.ensureUser('test_user', 'Tester');
    defaultPersona = await personaRepo.ensureDefaultPersona(user.id);
  });

  // Test 1: Provider Adapter Normalization
  it('1. Provider Adapter normalizes models, responses, and stream chunks', async () => {
    const provider = new MockProvider();
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(2);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('contextWindow');

    const res = await provider.generate({
      modelId: 'mock-model-a',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(res).toHaveProperty('content');
    expect(res.modelId).toBe('mock-model-a');

    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      modelId: 'mock-model-a',
      messages: [{ role: 'user', content: 'Hello' }],
    })) {
      if (chunk.delta) chunks.push(chunk.delta);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toBe(res.content);
  });

  // Test 2 & 3: Context Engine selects only active memories & excludes pending/rejected/deleted
  it('2 & 3. Context Engine selects only active memories and excludes pending, rejected, and deleted ones', () => {
    const activeMemory: Memory = {
      id: 'mem_1',
      userId: 'test_user',
      projectId: null,
      type: 'fact',
      subject: '사용자',
      predicate: '전공',
      valueJson: '컴퓨터공학',
      canonicalText: '사용자는 컴퓨터공학을 공부하고 있다.',
      sourceKind: 'explicit_user_statement',
      confidence: 1.0,
      importance: 5,
      sensitivity: 'low',
      status: 'active',
      validFrom: new Date().toISOString(),
      validUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pendingMemory: Memory = {
      ...activeMemory,
      id: 'mem_2',
      canonicalText: '사용자는 고양이를 키운다.',
      status: 'pending',
    };

    const rejectedMemory: Memory = {
      ...activeMemory,
      id: 'mem_3',
      canonicalText: '사용자는 주식을 한다.',
      status: 'rejected',
    };

    const deletedMemory: Memory = {
      ...activeMemory,
      id: 'mem_4',
      canonicalText: '사용자는 테니스를 친다.',
      status: 'deleted',
    };

    const result = contextEngine.compose({
      userId: 'test_user',
      conversationId: 'conv_1',
      currentQuery: '내 전공이 뭐지?',
      persona: defaultPersona,
      activeMemories: [activeMemory, pendingMemory, rejectedMemory, deletedMemory],
      recentMessages: [],
      providerId: 'mock',
      modelId: 'mock-model-a',
    });

    // Only active memory mem_1 should be selected
    expect(result.contextRun.selectedMemoryIds).toEqual(['mem_1']);
    expect(result.contextRun.selectedMemoryIds).not.toContain('mem_2');
    expect(result.contextRun.selectedMemoryIds).not.toContain('mem_3');
    expect(result.contextRun.selectedMemoryIds).not.toContain('mem_4');
    expect(result.messages[0].content).toContain('사용자는 컴퓨터공학을 공부하고 있다.');
    expect(result.messages[0].content).not.toContain('사용자는 고양이를 키운다.');
  });

  // Test 4: Memory candidate JSON validation via Zod
  it('4. Memory candidate JSON validation enforces strict schema and rejects malformed inputs', () => {
    const validCandidate = {
      type: 'fact',
      subject: '사용자',
      predicate: '프로젝트',
      valueJson: { name: 'Espera' },
      canonicalText: '사용자는 Project Espera를 개발 중이다.',
      sourceKind: 'explicit_user_statement',
      confidence: 0.95,
      importance: 5,
      sensitivity: 'low',
      snippet: '나는 Project Espera를 개발 중이야',
    };

    const parsed = MemoryCandidateSchema.safeParse(validCandidate);
    expect(parsed.success).toBe(true);

    // Invalid importance (> 5)
    const invalidImportance = { ...validCandidate, importance: 99 };
    expect(MemoryCandidateSchema.safeParse(invalidImportance).success).toBe(false);

    // Invalid type
    const invalidType = { ...validCandidate, type: 'gossip' };
    expect(MemoryCandidateSchema.safeParse(invalidType).success).toBe(false);

    // Missing required fields
    const missingField = { subject: '사용자' };
    expect(MemoryCandidateSchema.safeParse(missingField).success).toBe(false);
  });

  // Test 5: Duplicate memory detection
  it('5. MemoryDeduplicator correctly identifies duplicate memories', () => {
    const deduplicator = new MemoryDeduplicator();

    const existing: Memory[] = [
      {
        id: 'mem_existing',
        userId: 'test_user',
        projectId: null,
        type: 'fact',
        subject: '사용자',
        predicate: '전공',
        valueJson: '컴퓨터공학',
        canonicalText: '사용자는 컴퓨터공학을 공부하고 있다.',
        sourceKind: 'explicit_user_statement',
        confidence: 1.0,
        importance: 4,
        sensitivity: 'low',
        status: 'active',
        validFrom: new Date().toISOString(),
        validUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const duplicateCandidate = {
      type: 'fact' as const,
      subject: '사용자',
      predicate: '전공',
      valueJson: '컴퓨터공학',
      canonicalText: '사용자는 컴퓨터공학을 공부하고 있다.',
      sourceKind: 'inferred_from_conversation' as const,
      confidence: 0.9,
      importance: 4,
      sensitivity: 'low' as const,
      snippet: '전공이 컴퓨터공학입니다',
    };

    const check = deduplicator.checkCandidate(duplicateCandidate, existing);
    expect(check.isDuplicate).toBe(true);
    expect(check.isConflict).toBe(false);
    expect(check.conflictingMemoryId).toBe('mem_existing');
  });

  // Test 6: Conflict memory detection
  it('6. MemoryDeduplicator correctly identifies conflicting memory facts for the same predicate', () => {
    const deduplicator = new MemoryDeduplicator();

    const existing: Memory[] = [
      {
        id: 'mem_role',
        userId: 'test_user',
        projectId: null,
        type: 'fact',
        subject: '사용자',
        predicate: '직무',
        valueJson: '백엔드 엔지니어',
        canonicalText: '사용자의 직무는 백엔드 엔지니어이다.',
        sourceKind: 'explicit_user_statement',
        confidence: 1.0,
        importance: 4,
        sensitivity: 'low',
        status: 'active',
        validFrom: new Date().toISOString(),
        validUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const conflictCandidate = {
      type: 'fact' as const,
      subject: '사용자',
      predicate: '직무',
      valueJson: '데이터 과학자',
      canonicalText: '사용자의 직무는 데이터 과학자이다.',
      sourceKind: 'explicit_user_statement' as const,
      confidence: 0.9,
      importance: 4,
      sensitivity: 'low' as const,
      snippet: '데이터 과학자로 직무를 바꿨어',
    };

    const check = deduplicator.checkCandidate(conflictCandidate, existing);
    expect(check.isDuplicate).toBe(false);
    expect(check.isConflict).toBe(true);
    expect(check.conflictingMemoryId).toBe('mem_role');
  });

  // Test 7: Memory revision creation upon approval
  it('7. Memory approval and editing produces immutable revision audit records in D1', async () => {
    // 1. Create candidate memory (pending)
    const candidate = await memoryRepo.createCandidate({
      userId: 'test_user',
      type: 'project',
      subject: '사용자',
      predicate: '개발 프로젝트',
      valueJson: 'Project Espera',
      canonicalText: '사용자는 Project Espera를 만들고 있다.',
      evidenceSnippet: 'Project Espera를 개발 중이야',
      messageId: 'msg_source_1',
    });
    expect(candidate.status).toBe('pending');

    // 2. Approve memory
    const approved = await memoryRepo.approveMemory(candidate.id, 'Confirmed by user in inbox');
    expect(approved.status).toBe('active');

    let revisions = await memoryRepo.getRevisions(candidate.id);
    expect(revisions.length).toBe(2); // Initial creation + approval
    expect(revisions[0].newStatus).toBe('active');
    expect(revisions[0].changeReason).toBe('Confirmed by user in inbox');

    // 3. Edit and approve with custom text
    const edited = await memoryRepo.editAndApproveMemory(
      candidate.id,
      {
        canonicalText: '사용자는 개인용 지속형 AI Project Espera를 총괄 개발하고 있다.',
        importance: 5,
        changeReason: 'User refined canonical phrasing',
      }
    );
    expect(edited.canonicalText).toContain('총괄 개발');

    revisions = await memoryRepo.getRevisions(candidate.id);
    expect(revisions.length).toBe(3);
    expect(revisions[0].newCanonicalText).toContain('총괄 개발');
    expect(revisions[0].changeReason).toBe('User refined canonical phrasing');
  });

  // Test 8: Provider change preserves identical context memory
  it('8. Context Engine delivers identical memory context even when Provider or Model changes', () => {
    const memory: Memory = {
      id: 'mem_durable',
      userId: 'test_user',
      projectId: null,
      type: 'project',
      subject: '사용자',
      predicate: '프로젝트',
      valueJson: 'Project Espera',
      canonicalText: '사용자는 Project Espera를 구축하고 있다.',
      sourceKind: 'user_confirmed',
      confidence: 1.0,
      importance: 5,
      sensitivity: 'low',
      status: 'active',
      validFrom: new Date().toISOString(),
      validUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Context composition for Mock Provider Model A
    const resA = contextEngine.compose({
      userId: 'test_user',
      conversationId: 'conv_1',
      currentQuery: '내 프로젝트가 무엇이지?',
      persona: defaultPersona,
      activeMemories: [memory],
      recentMessages: [],
      providerId: 'mock',
      modelId: 'mock-model-a',
    });

    // Context composition for Mock Provider Model B (or OpenAI)
    const resB = contextEngine.compose({
      userId: 'test_user',
      conversationId: 'conv_2',
      currentQuery: '내 프로젝트가 무엇이지?',
      persona: defaultPersona,
      activeMemories: [memory],
      recentMessages: [],
      providerId: 'mock',
      modelId: 'mock-model-b',
    });

    expect(resA.contextRun.selectedMemoryIds).toEqual(resB.contextRun.selectedMemoryIds);
    expect(resA.messages[0].content).toBe(resB.messages[0].content);
    expect(resA.messages[0].content).toContain('Project Espera');
  });

  // Test 9: API Key leakage prevention in logs/serialization
  it('9. Security utilities mask API keys and sanitize sensitive fields from logs and objects', () => {
    const rawKey = 'sk-proj-1234567890abcdefghijklmnop';
    const masked = maskApiKey(rawKey);

    expect(masked).toBe('sk-p...mnop');
    expect(masked).not.toContain('1234567890abcdef');

    const logPayload = {
      event: 'chat_request',
      userId: 'user_1',
      apiKey: rawKey,
      headers: {
        'x-espera-credential': rawKey,
        authorization: `Bearer ${rawKey}`,
      },
      content: 'Hello AI',
    };

    const sanitized = sanitizeLogData(logPayload);
    expect(sanitized.apiKey).toBe('sk-p...mnop');
    expect(sanitized.headers['x-espera-credential']).toBe('sk-p...mnop');
    expect(sanitized.headers.authorization).toBe(`Bearer ${masked}`);
    expect(sanitized.content).toBe('Hello AI');

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain(rawKey);
  });
});
