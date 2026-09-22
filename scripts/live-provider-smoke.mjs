if (process.env.ESPERA_LIVE_TESTS !== '1') {
  console.error('Live provider smoke is disabled. Set ESPERA_LIVE_TESTS=1 explicitly.');
  process.exit(2);
}
const api = process.env.ESPERA_API_URL;
const cookie = process.env.ESPERA_SESSION_COOKIE;
if (!api || !cookie) throw new Error('ESPERA_API_URL and ESPERA_SESSION_COOKIE are required');
const maximum = Math.min(Math.max(Number(process.env.ESPERA_LIVE_MAX_REQUESTS) || 3, 1), 3);
const candidates = [
  ['openai', process.env.OPENAI_API_KEY, undefined],
  ['anthropic', process.env.ANTHROPIC_API_KEY, undefined],
  ['gemini', process.env.GEMINI_API_KEY, undefined],
  ['openai-compatible', process.env.OPENAI_COMPATIBLE_API_KEY, process.env.OPENAI_COMPATIBLE_BASE_URL],
].filter(([, key]) => key).slice(0, maximum);
if (!candidates.length) throw new Error('No live provider key was configured');
const results = [];
for (const [providerId, apiKey, endpointUrl] of candidates) {
  const response = await fetch(`${api}/api/providers/models`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ providerId, credential: { apiKey, endpointUrl } }) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${providerId} discovery failed: ${body.error?.message || body.error || response.status}`);
  results.push({ providerId, models: body.models?.length || 0 });
}
console.log(JSON.stringify({ requests: results.length, tokenGeneratingRequests: 0, results }));
