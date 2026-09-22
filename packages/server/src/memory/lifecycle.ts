import type { MemoryRepository } from '../db/repositories/memory.repo.js';
import type { MemoryExtractor } from './extractor.js';
import type { MemoryDeduplicator } from './deduplicator.js';
import type { LLMProvider } from '../providers/types.js';
import type { Memory, ProviderCredential } from '@espera/shared';

export class MemoryLifecycleCoordinator {
  constructor(
    private memoryRepo: MemoryRepository,
    private extractor: MemoryExtractor,
    private deduplicator: MemoryDeduplicator
  ) {}

  async processTurn(params: {
    userId: string;
    projectId?: string | null;
    messageId: string;
    userMessage: string;
    assistantMessage: string;
    provider: LLMProvider;
    credential?: ProviderCredential;
    modelId?: string;
  }): Promise<Memory[]> {
    const candidates = await this.extractor.extract(
      params.userMessage,
      params.assistantMessage,
      params.provider,
      params.credential,
      params.modelId
    );

    if (candidates.length === 0) {
      return [];
    }

    const existing = await this.memoryRepo.getMemories(params.userId);
    const created: Memory[] = [];

    for (const candidate of candidates) {
      const check = this.deduplicator.checkCandidate(candidate, existing);
      if (check.isDuplicate) {
        continue;
      }

      const mem = await this.memoryRepo.createCandidate({
        userId: params.userId,
        projectId: params.projectId,
        type: candidate.type,
        subject: candidate.subject,
        predicate: candidate.predicate,
        valueJson: candidate.valueJson,
        canonicalText: candidate.canonicalText,
        sourceKind: candidate.sourceKind,
        confidence: candidate.confidence,
        importance: candidate.importance,
        sensitivity: candidate.sensitivity,
        evidenceSnippet: candidate.snippet,
        messageId: params.messageId,
      });

      created.push(mem);
    }

    return created;
  }
}
