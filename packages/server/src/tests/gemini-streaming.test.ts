import { describe, expect, it, vi, afterEach } from 'vitest';
import { GeminiProvider } from '../providers/gemini.provider.js';

describe('Gemini native streaming', () => {
  afterEach(() => vi.restoreAllMocks());
  it('converts multiple SSE text deltas and usage without putting the key in the URL', async () => {
    const body=[
      'data: {"candidates":[{"content":{"parts":[{"text":"hello "}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"world"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":2,"totalTokenCount":4}}\n\n',
    ].join('');
    const fetchMock=vi.fn(async (url:string)=>new Response(body,{status:200,headers:{'content-type':'text/event-stream'}}));
    vi.stubGlobal('fetch',fetchMock);
    const chunks=[];
    for await(const chunk of new GeminiProvider().stream({modelId:'gemini-test',messages:[{role:'user',content:'hi'}],credential:{apiKey:'secret'}}))chunks.push(chunk);
    expect(chunks.map(x=>x.delta).join('')).toBe('hello world');
    expect(chunks.some(x=>x.isComplete)).toBe(true);
    expect(chunks.find(x=>x.usage)?.usage?.totalTokens).toBe(4);
    expect(fetchMock.mock.calls[0][0]).not.toContain('secret');
  });
});
