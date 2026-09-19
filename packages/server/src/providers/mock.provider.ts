import type { LLMProvider } from './types.js';
import type {
  ModelDescriptor,
  ProviderCapabilities,
  ProviderCredential,
  ProviderGenerateRequest,
  ProviderResponse,
  ProviderStreamChunk,
} from '@espera/shared';

export class MockProvider implements LLMProvider {
  public readonly id = 'mock';
  public readonly name = 'Mock Provider (Test Engine)';

  async listModels(): Promise<ModelDescriptor[]> {
    return [
      {
        id: 'mock-model-a',
        name: 'Mock Model Alpha (Fast & Concise)',
        contextWindow: 32000,
        supportsStreaming: true,
        pricingTier: 'free',
      },
      {
        id: 'mock-model-b',
        name: 'Mock Model Beta (Elaborate & Analytical)',
        contextWindow: 64000,
        supportsStreaming: true,
        pricingTier: 'free',
      },
    ];
  }

  async validateCredential(credential: ProviderCredential): Promise<boolean> {
    // In mock mode, any key or empty key is accepted
    return true;
  }

  async generate(request: ProviderGenerateRequest): Promise<ProviderResponse> {
    const text = this.synthesizeResponse(request);
    return {
      content: text,
      modelId: request.modelId,
      usage: {
        promptTokens: 50,
        completionTokens: text.length,
        totalTokens: 50 + text.length,
      },
    };
  }

  async *stream(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk> {
    const fullText = this.synthesizeResponse(request);
    const words = fullText.split(' ');

    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      yield { delta: chunk, isComplete: false };
    }
    yield { delta: '', isComplete: true };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsVision: false,
      supportsToolCalling: false,
    };
  }

  private synthesizeResponse(request: ProviderGenerateRequest): string {
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user')?.content || '';

    const systemPrompt = request.messages.find((m) => m.role === 'system')?.content || '';
    const isModelB = request.modelId === 'mock-model-b';

    // Scenario 1: Introduction
    if (
      lastUserMessage.includes('컴퓨터공학') &&
      (lastUserMessage.includes('Espera') || lastUserMessage.includes('에스페라'))
    ) {
      if (isModelB) {
        return '컴퓨터공학을 전공하시며 Project Espera를 개발하고 계시는군요. 모델 독립적인 지속형 AI 아키텍처 구축을 심층적으로 지원하겠습니다.';
      }
      return '반갑습니다! 컴퓨터공학 전공 지식을 바탕으로 Project Espera를 훌륭하게 완성하실 수 있도록 돕겠습니다.';
    }

    // Scenario 2: Memory Retrieval Question
    if (
      lastUserMessage.includes('프로젝트') &&
      (lastUserMessage.includes('무엇') || lastUserMessage.includes('뭐'))
    ) {
      // Check if Espera is in the injected context (memory or persona)
      if (systemPrompt.includes('Project Espera') || systemPrompt.includes('Espera') || systemPrompt.includes('에스페라')) {
        if (isModelB) {
          return '기억된 컨텍스트에 따르면, 사용자님께서 현재 진행하고 계신 프로젝트는 [Project Espera]입니다. 지속형 기억과 페르소나를 관리하는 시스템입니다.';
        }
        return '현재 진행 중인 프로젝트는 [Project Espera]입니다!';
      }
      return '현재 등록된 프로젝트 정보가 기억에 없습니다.';
    }

    // Default response showing model identity and context continuity
    const stylePrefix = isModelB
      ? '[Beta Analysis] '
      : '[Alpha Response] ';

    return `${stylePrefix}수신된 요청을 처리했습니다: "${lastUserMessage.slice(0, 50)}"`;
  }
}
