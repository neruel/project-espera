import type { Memory, MemoryCandidate } from '@espera/shared';

export interface DeduplicationResult {
  isDuplicate: boolean;
  isConflict: boolean;
  conflictingMemoryId?: string;
  reason?: string;
}

export class MemoryDeduplicator {
  checkCandidate(candidate: MemoryCandidate, existingMemories: Memory[]): DeduplicationResult {
    const candidateSubj = candidate.subject.trim().toLowerCase();
    const candidatePred = candidate.predicate.trim().toLowerCase();
    const candidateText = candidate.canonicalText.trim().toLowerCase();

    for (const existing of existingMemories) {
      // Ignore deleted or rejected memories for duplication
      if (existing.status === 'deleted' || existing.status === 'rejected') {
        continue;
      }

      const existingSubj = existing.subject.trim().toLowerCase();
      const existingPred = existing.predicate.trim().toLowerCase();
      const existingText = existing.canonicalText.trim().toLowerCase();

      // Exact text match -> duplicate
      if (candidateText === existingText) {
        return {
          isDuplicate: true,
          isConflict: false,
          conflictingMemoryId: existing.id,
          reason: `Exact text duplicate of existing memory (${existing.id})`,
        };
      }

      // Same subject and predicate
      if (candidateSubj === existingSubj && candidatePred === existingPred) {
        const candidateValStr = JSON.stringify(candidate.valueJson).toLowerCase();
        const existingValStr = JSON.stringify(existing.valueJson).toLowerCase();

        if (candidateValStr === existingValStr) {
          return {
            isDuplicate: true,
            isConflict: false,
            conflictingMemoryId: existing.id,
            reason: `Duplicate subject/predicate and value of (${existing.id})`,
          };
        } else {
          // Same subject & predicate, but different value -> Potential Conflict / Update
          return {
            isDuplicate: false,
            isConflict: true,
            conflictingMemoryId: existing.id,
            reason: `Conflicting value for subject "${candidate.subject}" and predicate "${candidate.predicate}" with memory (${existing.id})`,
          };
        }
      }
    }

    return {
      isDuplicate: false,
      isConflict: false,
    };
  }
}
