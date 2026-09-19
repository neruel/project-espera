import type { LLMProvider } from './types.js';
import type {
  ModelDescriptor,
  ProviderCapabilities,
  ProviderCredential,
  ProviderGenerateRequest,
  ProviderResponse,
  ProviderStreamChunk,
} from '@espera/shared';
import { endpoint, normalizeBaseUrl, safeFetch, statusError } from './http.js';

export class AnthropicProvider implements LLMProvider {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic Claude';

  async listModels(credential?: ProviderCredential): Promise<ModelDescriptor[]> {
    if (!credential?.apiKey) return [];
    const base=normalizeBaseUrl(credential.endpointUrl, 'https://api.anthropic.com/v1').replace(/\/messages$/, '');
    const res=await safeFetch(endpoint(base, 'models'), { headers: { 'x-api-key': credential.apiKey, 'anthropic-version':'2023-06-01' } }, credential.apiKey);
    if (!res.ok) throw statusError(res.status);
    const data:any=await res.json();
    return (data.data||[]).map((m:any)=>({id:m.id,name:m.display_name||m.id,contextWindow:0,supportsStreaming:true,available:true}));
  }

  async validateCredential(credential: ProviderCredential): Promise<boolean> {
    try { await this.listModels(credential); return true; } catch { return false; }
  }

  async generate(request: ProviderGenerateRequest): Promise<ProviderResponse> {
    const apiKey = request.credential?.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API Key is required');
    }

    const systemMsg = request.messages.find((m) => m.role === 'system')?.content;
    const chatMsgs = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const requestUrl = endpoint(normalizeBaseUrl(request.credential?.endpointUrl, 'https://api.anthropic.com/v1').replace(/\/messages$/, ''), 'messages');
    const payload = {
      model: request.modelId,
      system: systemMsg,
      messages: chatMsgs,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    };

    const res = await safeFetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw statusError(res.status);

    const data: any = await res.json();
    const content = (data.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    return {
      content,
      modelId: request.modelId,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *stream(request: ProviderGenerateRequest): AsyncIterable<ProviderStreamChunk> {
    const apiKey = request.credential?.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API Key is required for streaming');
    }

    const systemMsg = request.messages.find((m) => m.role === 'system')?.content;
    const chatMsgs = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const requestUrl = endpoint(normalizeBaseUrl(request.credential?.endpointUrl, 'https://api.anthropic.com/v1').replace(/\/messages$/, ''), 'messages');
    const payload = {
      model: request.modelId,
      system: systemMsg,
      messages: chatMsgs,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    const res = await safeFetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) throw statusError(res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield { delta: parsed.delta.text, isComplete: false };
          } else if (parsed.type === 'message_stop') {
            yield { delta: '', isComplete: true };
            return;
          }
        } catch {
          // ignore chunk parse error
        }
      }
    }

    yield { delta: '', isComplete: true };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsVision: true,
      supportsToolCalling: true,
    };
  }
}
