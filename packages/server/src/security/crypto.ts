/**
 * BYOK Security & Encryption Utilities
 * Uses Web Crypto API (AES-GCM 256) compatible with Cloudflare Workers edge runtime.
 */

export function maskApiKey(key: string): string {
  if (!key) return '****';
  if (key.startsWith('Bearer ')) {
    return `Bearer ${maskApiKey(key.slice(7))}`;
  }
  if (key.length < 8) return '****';
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export function sanitizeLogData<T extends Record<string, any>>(data: T): T {
  const sensitiveKeys = ['apikey', 'authorization', 'x-espera-credential', 'secret', 'password', 'key'];
  const sanitized: any = Array.isArray(data) ? [] : {};

  for (const [k, v] of Object.entries(data)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      sanitized[k] = typeof v === 'string' ? maskApiKey(v) : '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeLogData(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized as T;
}

export async function encryptSecret(
  plaintext: string,
  masterKeyBase64: string
): Promise<{ ciphertext: string; nonce: string; version: number }> {
  const rawKey = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedBuf)));
  const nonce = btoa(String.fromCharCode(...iv));

  return {
    ciphertext,
    nonce,
    version: 1,
  };
}

export async function decryptSecret(
  ciphertext: string,
  nonce: string,
  masterKeyBase64: string
): Promise<string> {
  const rawKey = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0));
  const encryptedBuf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedBuf
  );

  return new TextDecoder().decode(decryptedBuf);
}
