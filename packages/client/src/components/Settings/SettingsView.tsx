import React, { useState } from 'react';
import { Key, RefreshCw, ShieldCheck, Sliders, Trash2 } from 'lucide-react';
import type { ProviderInfo } from '../../services/api.js';
import type { ModelDescriptor } from '@espera/shared';
import { api } from '../../services/api.js';
import type { ProviderConnection, SessionState } from '../../stores/session.js';

interface Props { session: SessionState; onUpdateSession: (patch: Partial<SessionState>) => void; providers: ProviderInfo[]; }

export const SettingsView: React.FC<Props> = ({ session, onUpdateSession, providers }) => {
  const [providerId, setProviderId] = useState('openai-compatible');
  const [name, setName] = useState('Local API connection');
  const [baseUrl, setBaseUrl] = useState('http://localhost:1234/v1');
  const [key, setKey] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const definition = providers.find((provider) => provider.id === providerId);

  function changeProvider(id: string) {
    setProviderId(id);
    setBaseUrl(providers.find((provider) => provider.id === id)?.defaultBaseUrl || '');
    setModels([]);
    setStatus('');
  }

  async function discoverModels() {
    setBusy(true); setStatus('Loading models…');
    try {
      const discovered = providerId === 'mock' ? (definition?.models || []) : await api.listModels(providerId, key, baseUrl || undefined);
      setModels(discovered); setStatus(`${discovered.length} model(s) loaded.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Model discovery failed.'); }
    finally { setBusy(false); }
  }

  async function saveConnection() {
    const manual = manualModel.trim() ? [{ id: manualModel.trim(), name: manualModel.trim(), contextWindow: 0, supportsStreaming: true }] : [];
    const allModels = [...models, ...manual.filter((item) => !models.some((model) => model.id === item.id))];
    if (!allModels.length) { setStatus('Discover models or enter a manual model ID first.'); return; }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const persisted = await api.saveProviderConnection({ id, name: name.trim() || providerId, providerId, baseUrl: baseUrl.trim() || undefined, models: allModels });
      const connection: ProviderConnection = persisted;
      onUpdateSession({ connections: [...session.connections, connection], apiKeys: { ...session.apiKeys, [id]: key }, connectionId: id, providerId, modelId: allModels[0].id });
      setKey(''); setManualModel(''); setStatus('Connection metadata saved to D1. The API key remains in this tab only.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Connection could not be saved.'); }
    finally { setBusy(false); }
  }

  async function removeConnection(id: string) {
    if (!window.confirm('Delete this provider connection metadata?')) return;
    setBusy(true);
    try {
      await api.deleteProviderConnection(id);
      const apiKeys = { ...session.apiKeys }; delete apiKeys[id];
      onUpdateSession({ connections: session.connections.filter((connection) => connection.id !== id), apiKeys, connectionId: 'mock', providerId: 'mock', modelId: 'mock-model-a' });
      setStatus('Connection deleted.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Connection could not be deleted.'); }
    finally { setBusy(false); }
  }

  return <main className="flex-1 w-full max-w-5xl mx-auto overflow-y-auto p-4 sm:p-6 space-y-6">
    <header><h1 className="flex items-center gap-2 text-xl font-bold text-white"><Sliders className="text-sky-400" /> Provider connections</h1><p className="mt-1 text-sm text-slate-400">Keep connection metadata persistent while keeping API keys in this browser tab only.</p></header>
    <div className="flex gap-3 rounded-xl border border-sky-800 bg-sky-950/30 p-4 text-sm text-slate-300"><ShieldCheck className="shrink-0 text-sky-400" /><p>Keys are never written to D1, Web Storage, URLs, logs, or context runs. After a reload, re-enter the key before using a non-Mock provider.</p></div>
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-semibold text-white">Add connection</h2><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm text-slate-300">Provider<select className="field" value={providerId} onChange={(event) => changeProvider(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label className="text-sm text-slate-300">Connection name<input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-sm text-slate-300 sm:col-span-2">API base URL<input className="field font-mono" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label className="text-sm text-slate-300 sm:col-span-2"><Key className="mr-1 inline h-3 w-3" /> API key<input type="password" autoComplete="off" className="field font-mono" value={key} onChange={(event) => setKey(event.target.value)} placeholder={providerId === 'mock' ? 'Not required for Mock' : 'Required for discovery and chat'} /></label>
    </div><div className="flex flex-wrap gap-2"><button className="btn" disabled={busy || (!key && providerId !== 'mock')} onClick={discoverModels}><RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Discover models</button></div>
    {models.length > 0 && <div className="max-h-48 overflow-auto rounded-lg border border-slate-700 p-2 text-xs text-slate-300">{models.map((model) => <div key={model.id} className="border-b border-slate-800 py-1 last:border-0">{model.name} <span className="text-slate-500">{model.id}</span></div>)}</div>}
    <label className="text-sm text-slate-300">Manual model ID<input className="field font-mono" value={manualModel} onChange={(event) => setManualModel(event.target.value)} placeholder="For servers without a models endpoint" /></label><button className="btn bg-sky-600 hover:bg-sky-500" disabled={busy} onClick={saveConnection}>Save connection</button>{status && <p className="text-sm text-amber-300" role="status">{status}</p>}</section>
    <section className="space-y-3"><h2 className="font-semibold text-white">Saved connections</h2>{session.connections.length === 0 && <p className="text-sm text-slate-500">No saved connections yet.</p>}{session.connections.map((connection) => <div key={connection.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4"><div><p className="font-semibold text-slate-100">{connection.name}</p><p className="mt-1 text-xs text-slate-400">{connection.providerId} · {connection.models.length} models · {connection.baseUrl || 'default endpoint'}</p><p className="mt-1 text-xs text-emerald-400">Metadata saved · key {session.apiKeys[connection.id] ? 'available in this tab' : 're-entry required'}</p></div><button className="rounded-lg p-2 text-rose-400 hover:bg-rose-950" aria-label={`Delete ${connection.name}`} onClick={() => removeConnection(connection.id)}><Trash2 className="h-4 w-4" /></button></div>)}</section>
  </main>;
};
