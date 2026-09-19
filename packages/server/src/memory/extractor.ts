import {
  MemoryCandidateSchema,
  type MemoryCandidate,
} from '@espera/shared';
import type { LLMProvider } from '../providers/types.js';
import type { ProviderCredential } from '@espera/shared';

const FORBIDDEN_KEYWORDS = [
  '우울', '불안', '심리', '정치', '종교', '성적', '연애', '기분나쁨', '화남',
  'depression', 'anxiety', 'politics', 'religion', 'sexual orientation'
];

export class MemoryExtractor {
  async extract(
    userMessage: string,
    assistantMessage: string,
    provider: LLMProvider,
    credential?: ProviderCredential
  ): Promise<MemoryCandidate[]> {
    try {
      // MockProvider deterministic path for automated testing & offline execution
      if (provider.id === 'mock') {
        return this.extractFromMock(userMessage);
      }

      // Real LLM provider extraction with structured schema
      return await this.extractWithLLM(userMessage, assistantMessage, provider, credential);
    } catch (err) {
      console.error('[MemoryExtractor] Extraction failed safely (chat not impacted):', err);
      return [];
    }
  }

  private extractFromMock(userMessage: string): MemoryCandidate[] {
    const candidates: MemoryCandidate[] = [];

    if (userMessage.includes('컴퓨터공학')) {
      candidates.push({
        type: 'fact',
        subject: '사용자',
        predicate: '전공 분야',
        valueJson: '컴퓨터공학',
        canonicalText: '사용자는 컴퓨터공학을 공부하고 있다.',
        sourceKind: 'explicit_user_statement',
        confidence: 1.0,
        importance: 4,
        sensitivity: 'low',
        snippet: userMessage.slice(0, 200),
      });
    }

    if (userMessage.includes('Project Espera') || userMessage.includes('Espera') || userMessage.includes('에스페라')) {
      candidates.push({
        type: 'project',
        subject: '사용자',
        predicate: '진행 프로젝트',
        valueJson: 'Project Espera',
        canonicalText: '사용자는 Project Espera를 개발하고 있다.',
        sourceKind: 'explicit_user_statement',
        confidence: 1.0,
        importance: 5,
        sensitivity: 'low',
        snippet: userMessage.slice(0, 200),
      });
    }

    return candidates;
  }

  private async extractWithLLM(
    userMessage: string,
    assistantMessage: string,
    provider: LLMProvider,
    credential?: ProviderCredential
  ): Promise<MemoryCandidate[]> {
    const systemPrompt = `You are the Espera Memory Extraction Engine.
Analyze the user message and extract long-term facts, ongoing projects, preferences, and technical constraints.

RULES:
1. ONLY extract durable facts stated or clearly implied (e.g. career, major, active projects, technical preferences).
2. NEVER extract subjective feelings, temporary mood, mental state, politics, religion, or health details.
3. If no durable facts exist, return an empty array: {"candidates": []}.
4. Return pure JSON matching this schema:
{
  "candidates": [
    {
      "type": "fact" | "preference" | "constraint" | "goal" | "project" | "relationship",
      "subject": string,
      "predicate": string,
      "valueJson": any,
      "canonicalText": string (in Korean if user spoke Korean, concise 1 sentence),
      "sourceKind": "explicit_user_statement" | "inferred_from_conversation",
      "confidence": number (0.0 to 1.0),
      "importance": integer (1 to 5),
      "sensitivity": "low" | "medium" | "high",
      "snippet": string
    }
  ]
}`;

    const promptText = `User: ${userMessage}\nAssistant: ${assistantMessage}`;
    const response = await provider.generate({
      modelId: (await provider.listModels())[0].id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ],
      temperature: 0.1,
      credential,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const rawObj = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(rawObj.candidates)) return [];

    const validCandidates: MemoryCandidate[] = [];
    for (const item of rawObj.candidates) {
      const parsed = MemoryCandidateSchema.safeParse(item);
      if (parsed.success) {
        // Enforce forbidden filter
        const isForbidden = FORBIDDEN_KEYWORDS.some(
          (kw) =>
            parsed.data.canonicalText.toLowerCase().includes(kw) ||
            parsed.data.subject.toLowerCase().includes(kw) ||
            parsed.data.predicate.toLowerCase().includes(kw)
        );
        if (!isForbidden) {
          validCandidates.push(parsed.data);
        }
      }
    }

    return validCandidates;
  }
}
