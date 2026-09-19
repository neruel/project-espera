import type { LLMProvider } from './types.js';
import { MockProvider } from './mock.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenAICompatibleProvider } from './openai.provider.js';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor() {
    this.register(new MockProvider());
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
    this.register(new GeminiProvider());
    this.register(new OpenAICompatibleProvider());
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): LLMProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    return provider;
  }

  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
}
