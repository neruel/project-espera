const api = process.env.ESPERA_API_URL;
if (!api) {
  console.error('ESPERA_API_URL is required');
  process.exit(2);
}

async function request(path, init = {}) {
  const response = await fetch(`${api}${path}`, init);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} returned ${response.status}: ${body.error || text}`);
  return { response, body };
}

let projectId;
let connectionId;
try {
  const health = await request('/api/health');
  if (health.body.status !== 'ok') throw new Error('health endpoint did not report ok');

  const cors = await fetch(`${api}/api/health`, { headers: { Origin: 'https://project-espera-web.pages.dev' } });
  if (cors.headers.get('access-control-allow-origin') !== 'https://project-espera-web.pages.dev') throw new Error('production CORS origin mismatch');

  const project = await request('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Smoke ${Date.now()}`, description: 'automated production smoke scope' }) });
  projectId = project.body.project.id;

  const connection = await request('/api/providers/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Smoke ${Date.now()}`, providerId: 'openai-compatible', baseUrl: 'https://gateway.example/v1', apiKey: 'must-not-persist', models: [{ id: 'smoke-model', name: 'Smoke Model', contextWindow: 4096, supportsStreaming: true }] }) });
  connectionId = connection.body.connection.id;
  const listed = await request('/api/providers/connections');
  if (JSON.stringify(listed.body).includes('must-not-persist')) throw new Error('credential appeared in metadata response');

  const chat = await request('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'What is this project?', providerId: 'mock', modelId: 'mock-model-a', projectId, stream: false }) });
  const inspector = await request(`/api/inspector/${chat.body.conversationId}`);
  if (!inspector.body.contextRun.assembledPrompt.includes('automated production smoke scope')) throw new Error('project context was not included');
  console.log(JSON.stringify({ health: health.response.status, cors: cors.status, projectContext: true, credentialRedacted: true }));
} finally {
  if (connectionId) await fetch(`${api}/api/providers/connections/${connectionId}`, { method: 'DELETE' });
  if (projectId) await fetch(`${api}/api/projects/${projectId}`, { method: 'DELETE' });
}
