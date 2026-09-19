import type { ProviderCredential } from '@espera/shared';
import net from 'node:net';

export type ProviderErrorCode = 'invalid_endpoint' | 'endpoint_blocked' | 'dns_resolution_failed' | 'invalid_credential' | 'permission_denied' | 'model_not_found' | 'rate_limited' | 'provider_unavailable' | 'timeout' | 'network_error' | 'invalid_response' | 'stream_interrupted' | 'unknown_error';
export class ProviderError extends Error { constructor(public code: ProviderErrorCode, message: string, public status = 502) { super(message); } }

let configuredEndpointPolicy: string | undefined;
export function setEndpointPolicy(policy?: string): void { configuredEndpointPolicy = policy; }

function blockedIp(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'metadata.google.internal' || h === 'metadata') return true;
  const version = net.isIP(h);
  if (!version) return false;
  if (version === 4) { const p = h.split('.').map(Number); return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] >= 224 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127); }
  return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:10.') || h.startsWith('::ffff:192.168.');
}

export function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const raw = (value || fallback).trim().replace(/\/+$/, '');
  if (raw.length > 2048) throw new ProviderError('invalid_endpoint', 'Endpoint URL is too long', 400);
  let url: URL;
  try { url = new URL(raw); } catch { throw new ProviderError('invalid_endpoint', 'Invalid API base URL', 400); }
  if (url.username || url.password) throw new ProviderError('invalid_endpoint', 'URL 자격증명은 허용되지 않습니다', 400);
  if (url.hash) throw new ProviderError('invalid_endpoint', 'Endpoint fragments are not allowed', 400);
  const policy = configuredEndpointPolicy || process.env.ESPERA_ENDPOINT_POLICY || (process.env.NODE_ENV === 'production' ? 'official-only' : 'development-local');
  const official = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com'].includes(url.hostname);
  const local = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname) || blockedIp(url.hostname);
  if (policy === 'official-only' && !official) throw new ProviderError('endpoint_blocked', 'Only official provider endpoints are allowed', 400);
  if (policy !== 'development-local' && url.protocol !== 'https:') throw new ProviderError('endpoint_blocked', 'HTTPS is required by the endpoint policy', 400);
  if (policy !== 'development-local' && local) throw new ProviderError('endpoint_blocked', 'Private and loopback endpoints are not allowed', 400);
  if (url.protocol !== 'https:' && !(policy === 'development-local' && local)) throw new ProviderError('invalid_endpoint', 'HTTPS is required except for development-local endpoints', 400);
  if (url.port && !['80', '443', '1234', '8000', '8080', '8787'].includes(url.port)) throw new ProviderError('invalid_endpoint', 'Endpoint port is not allowed', 400);
  return url.toString().replace(/\/$/, '');
}
export function endpoint(base: string, path: string) { return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`; }
export function openAIBase(value?: string) { const base = normalizeBaseUrl(value, 'https://api.openai.com/v1'); return base.endsWith('/v1') ? base : `${base}/v1`; }
export async function safeFetch(url: string, init: RequestInit, apiKey?: string) { try { const response = await fetch(url, { ...init, redirect: 'manual' }); if (response.status >= 300 && response.status < 400) throw new ProviderError('invalid_endpoint', 'Provider redirects are not allowed', 400); return response; } catch (error) { if (error instanceof ProviderError) throw error; const message = error instanceof Error ? error.message : 'network failure'; throw new ProviderError('network_error', apiKey ? message.replaceAll(apiKey, '[REDACTED]') : message); } }
export function statusError(status: number): ProviderError { if (status === 401) return new ProviderError('invalid_credential', 'Invalid API key', 401); if (status === 403) return new ProviderError('permission_denied', 'Permission denied', 403); if (status === 404) return new ProviderError('model_not_found', 'Endpoint or model not found', 404); if (status === 429) return new ProviderError('rate_limited', 'Rate limit exceeded', 429); return new ProviderError(status >= 500 ? 'provider_unavailable' : 'invalid_response', `Provider request failed (${status})`, status); }
export function authHeaders(credential: ProviderCredential): Record<string, string> { const headers: Record<string, string> = {}; if (credential.apiKey) headers.Authorization = `Bearer ${credential.apiKey}`; return headers; }
