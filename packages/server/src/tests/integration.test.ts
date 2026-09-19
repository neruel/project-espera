import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import type { D1Database } from '../db/d1-interface.js';
import { createApp } from '../app.js';
import { ProviderRegistry } from '../providers/registry.js';
import { MemoryRepository } from '../db/repositories/memory.repo.js';

describe('Integration Tests - 10-Step Core Loop Scenario with MockProvider', () => {
  let db: D1Database;
  let app: ReturnType<typeof createApp>;
  let memoryRepo: MemoryRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    const registry = new ProviderRegistry();
    app = createApp(db, registry);
    memoryRepo = new MemoryRepository(db);
  });

  it('Executes the full 10-step MVP verification scenario end-to-end', async () => {
    // -------------------------------------------------------------
    // Step 1 & 2: User says "나는 컴퓨터공학을 공부하고 있고 Project Espera를 만들고 있다"
    // Message and response are stored in Conversation 1
    // -------------------------------------------------------------
    const chatReq1 = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '나는 컴퓨터공학을 공부하고 있고 Project Espera를 만들고 있다',
        providerId: 'mock',
        modelId: 'mock-model-a',
        stream: false,
      }),
    });

    const chatRes1 = await app.fetch(chatReq1);
    expect(chatRes1.status).toBe(200);
    const chatData1: any = await chatRes1.json();

    const conversationId1 = chatData1.conversationId;
    expect(conversationId1).toBeDefined();
    expect(chatData1.message.content).toContain('Project Espera');
    expect(chatData1.newPendingMemoriesCount).toBeGreaterThan(0);

    // Verify messages saved in DB
    const msgsRes1 = await app.fetch(
      new Request(`http://localhost/api/conversations/${conversationId1}/messages`)
    );
    const msgsData1: any = await msgsRes1.json();
    expect(msgsData1.messages.length).toBe(2); // User + Assistant

    // -------------------------------------------------------------
    // Step 3: Verify Memory candidates were generated in 'pending' status
    // -------------------------------------------------------------
    const pendingMemoriesRes = await app.fetch(
      new Request('http://localhost/api/memories?status=pending')
    );
    const pendingData: any = await pendingMemoriesRes.json();
    expect(pendingData.memories.length).toBeGreaterThanOrEqual(2);

    const esperMemoryCandidate = pendingData.memories.find((m: any) =>
      m.canonicalText.includes('Project Espera')
    );
    expect(esperMemoryCandidate).toBeDefined();
    expect(esperMemoryCandidate.status).toBe('pending');

    // -------------------------------------------------------------
    // Step 4: User reviews and approves the pending memory in Memory Inbox
    // -------------------------------------------------------------
    const approveRes = await app.fetch(
      new Request(`http://localhost/api/memories/${esperMemoryCandidate.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeReason: 'User confirmed active development of Espera' }),
      })
    );
    expect(approveRes.status).toBe(200);
    const approvedData: any = await approveRes.json();
    expect(approvedData.memory.status).toBe('active');

    // Verify revision history exists
    const detailRes = await app.fetch(
      new Request(`http://localhost/api/memories/${esperMemoryCandidate.id}`)
    );
    const detailData: any = await detailRes.json();
    expect(detailData.revisions.length).toBeGreaterThanOrEqual(2);
    expect(detailData.revisions[0].newStatus).toBe('active');

    // -------------------------------------------------------------
    // Step 5: Create a new distinct Conversation (Conversation 2)
    // -------------------------------------------------------------
    const newConvRes = await app.fetch(
      new Request('http://localhost/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thread on Mobile' }),
      })
    );
    const newConvData: any = await newConvRes.json();
    const conversationId2 = newConvData.conversation.id;
    expect(conversationId2).not.toBe(conversationId1);

    // -------------------------------------------------------------
    // Step 6 & 7: In Provider A (mock-model-a), ask: "내가 진행 중인 프로젝트가 무엇이지?"
    // Espera related memory is automatically injected into Context
    // -------------------------------------------------------------
    const chatReq2 = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversationId2,
        content: '내가 진행 중인 프로젝트가 무엇이지?',
        providerId: 'mock',
        modelId: 'mock-model-a',
        stream: false,
      }),
    });

    const chatRes2 = await app.fetch(chatReq2);
    expect(chatRes2.status).toBe(200);
    const chatData2: any = await chatRes2.json();

    // Check assistant answer mentions Project Espera
    expect(chatData2.message.content).toContain('Project Espera');

    // Verify ContextRun inspector recorded the injected memory
    const inspectorResA = await app.fetch(
      new Request(`http://localhost/api/inspector/${conversationId2}`)
    );
    const inspectorDataA: any = await inspectorResA.json();
    expect(inspectorDataA.contextRun.selectedMemoryIds).toContain(esperMemoryCandidate.id);
    expect(inspectorDataA.contextRun.modelId).toBe('mock-model-a');

    // -------------------------------------------------------------
    // Step 8 & 9: Switch Provider/Model to Provider B (mock-model-b)
    // Ask same question in Conversation 2 or Conversation 3
    // Context contains identical core facts
    // -------------------------------------------------------------
    const newConvRes3 = await app.fetch(
      new Request('http://localhost/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Provider B Thread' }),
      })
    );
    const conv3: any = await newConvRes3.json();
    const conversationId3 = conv3.conversation.id;

    const chatReq3 = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversationId3,
        content: '내가 진행 중인 프로젝트가 무엇이지?',
        providerId: 'mock',
        modelId: 'mock-model-b', // Switched model!
        stream: false,
      }),
    });

    const chatRes3 = await app.fetch(chatReq3);
    expect(chatRes3.status).toBe(200);
    const chatData3: any = await chatRes3.json();

    const inspectorResB = await app.fetch(
      new Request(`http://localhost/api/inspector/${conversationId3}`)
    );
    const inspectorDataB: any = await inspectorResB.json();

    // Context delivered the exact same memory ID
    expect(inspectorDataB.contextRun.selectedMemoryIds).toContain(esperMemoryCandidate.id);
    expect(inspectorDataB.contextRun.selectedMemoryIds).toEqual(
      inspectorDataA.contextRun.selectedMemoryIds
    );

    // -------------------------------------------------------------
    // Step 10: Provider-specific phrasing differs, but Project Espera name & purpose remain!
    // -------------------------------------------------------------
    expect(chatData2.message.content).toContain('현재 진행 중인 프로젝트는 [Project Espera]입니다!');
    expect(chatData3.message.content).toContain('기억된 컨텍스트에 따르면');
    expect(chatData3.message.content).toContain('[Project Espera]');
    expect(chatData2.message.content).not.toBe(chatData3.message.content); // Model B phrasing is analytical, Model A is concise
  });
});
