import { describe, expect, it, vi, afterEach } from 'vitest';
import { normalizeBaseUrl, openAIBase, endpoint, safeFetch, setEndpointPolicy } from '../providers/http.js';
import { OpenAIProvider } from '../providers/openai.provider.js';
import { GeminiProvider } from '../providers/gemini.provider.js';

describe('Provider connections and endpoint security', () => {
  afterEach(() => { vi.restoreAllMocks(); setEndpointPolicy(); });

  it('normalizes OpenAI-compatible URLs without duplicating /v1', () => {
    expect(openAIBase('https://example.com/v1/')).toBe('https://example.com/v1');
    expect(openAIBase('https://example.com')).toBe('https://example.com');
    expect(openAIBase('https://factchat-cloud.mindlogic.ai/v1/gateway')).toBe('https://factchat-cloud.mindlogic.ai/v1/gateway');
    expect(endpoint(openAIBase('https://example.com/v1'), 'models')).toBe('https://example.com/v1/models');
  });

  it('allows HTTPS and localhost HTTP, but blocks unsafe schemes and URL credentials', () => {
    expect(normalizeBaseUrl('https://example.com/api', '')).toBe('https://example.com/api');
    expect(normalizeBaseUrl('http://localhost:1234/v1', '')).toBe('http://localhost:1234/v1');
    expect(() => normalizeBaseUrl('http://example.com/v1', '')).toThrow(/HTTPS/);
    expect(() => normalizeBaseUrl('file:///tmp/key', '')).toThrow();
    expect(() => normalizeBaseUrl('https://user:pass@example.com/v1', '')).toThrow(/자격증명/);
  });

  it('allows configured compatible API hosts and blocks arbitrary or private destinations', () => {
    setEndpointPolicy('allowlisted-https', 'api.example.com,not-a-wildcard.example,factchat-cloud.mindlogic.ai');
    expect(normalizeBaseUrl('https://api.example.com/v1', '')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('https://factchat-cloud.mindlogic.ai/v1/gateway', '')).toBe('https://factchat-cloud.mindlogic.ai/v1/gateway');
    expect(() => normalizeBaseUrl('https://attacker.example/v1', '')).toThrow(/not enabled/);
    expect(() => normalizeBaseUrl('https://subdomain.not-a-wildcard.example/v1', '')).toThrow(/not enabled/);
    expect(() => normalizeBaseUrl('https://127.0.0.1/v1', '')).toThrow(/not enabled/);
    expect(() => normalizeBaseUrl('https://api.example.com:8443/v1', '')).toThrow(/port/);
    expect(() => normalizeBaseUrl('https://api.example.com/v1?token=secret', '')).toThrow(/query strings/);
    expect(() => normalizeBaseUrl('https://service.localhost/v1', '')).toThrow(/not enabled/);
  });

  it('blocks IP-literal targets in public HTTPS mode', () => {
    setEndpointPolicy('public-https');
    expect(normalizeBaseUrl('https://api.example.com/v1', '')).toBe('https://api.example.com/v1');
    expect(() => normalizeBaseUrl('https://8.8.8.8/v1', '')).toThrow(/IP-literal/);
  });

  it('does not follow redirects that could leak credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } })));
    await expect(safeFetch('https://api.example/v1/models', { headers: { Authorization: 'Bearer secret' } }, 'secret'))
      .rejects.toMatchObject({ code: 'invalid_endpoint' });
  });

  it('normalizes real OpenAI model-list responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [
      { id: 'z-model', owned_by: 'vendor' }, { id: 'a-model', owned_by: 'vendor' }
    ] }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const models = await new OpenAIProvider().listModels({ apiKey: 'test-secret', endpointUrl: 'https://api.example/v1' });
    expect(models.map(m => m.id)).toEqual(['a-model', 'z-model']);
    expect(JSON.stringify(models)).not.toContain('test-secret');
  });

  it('keeps Gemini credentials in headers instead of query strings', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify({ models: [
      { name: 'models/gemini-test', displayName: 'Gemini Test', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1000 }
    ] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const models = await new GeminiProvider().listModels({ apiKey: 'gemini-secret' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('gemini-secret');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('gemini-secret');
    expect(models[0].id).toBe('gemini-test');
  });
});
