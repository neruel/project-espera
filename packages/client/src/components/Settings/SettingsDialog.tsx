import React, { useRef, useState } from 'react';
import { Check, Monitor, Moon, MoreHorizontal, Plug, RefreshCw, Settings2, Sun, X } from 'lucide-react';
import type { ModelDescriptor } from '@espera/shared';
import { api, type ProviderInfo } from '../../services/api.js';
import type { ProviderConnection, SessionState } from '../../stores/session.js';
import { useLanguage, type Language } from '../../i18n.js';
import type { ThemePreference } from '../../theme.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Menu } from '../Common/Menu.js';
import { useDialogAccessibility } from '../Common/useDialogAccessibility.js';

export type SettingsTab = 'general' | 'connections';

interface Props {
  initialTab: SettingsTab;
  session: SessionState;
  onUpdateSession: (patch: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onClose: () => void;
}

export function SettingsDialog({ initialTab, session, onUpdateSession, providers, theme, onThemeChange, onClose }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  // A confirmation dialog owns Escape while it is open.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useDialogAccessibility(true, () => { if (!confirmOpen) onClose(); });

  const tabs = [
    { id: 'general', icon: Settings2, label: t('settings.general') },
    { id: 'connections', icon: Plug, label: t('settings.connections') },
  ] as const;

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirmOpen) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="dialog flex h-[min(640px,88vh)] max-w-3xl flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 id="settings-title" className="text-lg font-semibold">{t('settings.title')}</h2>
          <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav role="tablist" aria-label={t('settings.title')} className="flex shrink-0 gap-1 overflow-x-auto p-2 md:w-48 md:flex-col md:p-3">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`nav-row w-auto shrink-0 md:w-full ${tab === id ? 'nav-row-active' : ''}`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:py-3 md:pl-2 md:pr-6">
            {tab === 'general'
              ? <GeneralSettings theme={theme} onThemeChange={onThemeChange} />
              : <ConnectionSettings session={session} onUpdateSession={onUpdateSession} providers={providers} onConfirmOpenChange={setConfirmOpen} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-fg-3">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function GeneralSettings({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (theme: ThemePreference) => void }) {
  const { language, setLanguage, t } = useLanguage();
  const themes = [
    { id: 'system', icon: Monitor, label: t('settings.theme.system') },
    { id: 'light', icon: Sun, label: t('settings.theme.light') },
    { id: 'dark', icon: Moon, label: t('settings.theme.dark') },
  ] as const;
  const languages: { id: Language; label: string }[] = [
    { id: 'ko', label: '한국어' },
    { id: 'en', label: 'English' },
  ];
  return (
    <div>
      <Row label={t('settings.theme')}>
        <div className="tabs" role="radiogroup" aria-label={t('settings.theme')}>
          {themes.map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => onThemeChange(id)} className={`tab inline-flex items-center gap-1.5 ${theme === id ? 'tab-active' : ''}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </Row>
      <Row label={t('settings.language')} description={t('settings.language.help')}>
        <div className="tabs" role="radiogroup" aria-label={t('settings.language')}>
          {languages.map(({ id, label }) => (
            <button key={id} type="button" role="radio" aria-checked={language === id} onClick={() => setLanguage(id)} className={`tab ${language === id ? 'tab-active' : ''}`}>
              {label}
            </button>
          ))}
        </div>
      </Row>
      <Row label={t('settings.shortcuts')}>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-[13px]">
          {[
            ['settings.shortcut.newChat', 'Ctrl Shift O'],
            ['settings.shortcut.search', 'Ctrl K'],
            ['settings.shortcut.sidebar', 'Ctrl Shift S'],
          ].map(([key, keys]) => (
            <React.Fragment key={key}>
              <dt className="text-fg-2">{t(key as 'settings.shortcut.newChat')}</dt>
              <dd className="text-right font-mono text-xs text-fg-3">{keys}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Row>
    </div>
  );
}

interface ConnectionProps {
  session: SessionState;
  onUpdateSession: (patch: Partial<SessionState>) => void;
  providers: ProviderInfo[];
  onConfirmOpenChange: (open: boolean) => void;
}

// Common OpenAI-compatible gateways; each host must also be on the server's endpoint allowlist.
const COMPATIBLE_PRESETS = [
  { name: 'FactChat', baseUrl: 'https://factchat-cloud.mindlogic.ai/v1/gateway' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
] as const;

function ConnectionSettings({ session, onUpdateSession, providers, onConfirmOpenChange }: ConnectionProps) {
  const { t } = useLanguage();
  const [providerId, setProviderId] = useState('openai-compatible');
  const [name, setName] = useState('API connection');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [key, setKey] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [rememberCredential, setRememberCredential] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(session.connections.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTargetState] = useState<ProviderConnection | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const definition = providers.find((provider) => provider.id === providerId);
  const editing = editingId ? session.connections.find((connection) => connection.id === editingId) : undefined;
  const keyMissing = providerId !== 'mock' && !key && !editing?.credentialStored;

  function setDeleteTarget(connection: ProviderConnection | null) {
    setDeleteTargetState(connection);
    onConfirmOpenChange(Boolean(connection));
  }

  function changeProvider(id: string) {
    setProviderId(id);
    setBaseUrl(providers.find((provider) => provider.id === id)?.defaultBaseUrl || '');
    setModels([]);
    setStatus('');
    setRememberCredential(false);
  }

  async function discoverModels() {
    if (providerId !== 'mock' && !key) {
      setStatus(t('settings.requiredDiscovery'));
      return;
    }
    setBusy(true);
    setStatus(t('settings.loadingModels'));
    try {
      const discovered = providerId === 'mock' ? definition?.models || [] : await api.listModels(providerId, key, baseUrl || undefined);
      setModels(discovered);
      setStatus(t('settings.modelsLoaded', { count: discovered.length }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('settings.discoverFailed'));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setModels([]);
    setKey('');
    setManualModel('');
    setRememberCredential(false);
  }

  async function saveConnection() {
    if (keyMissing) {
      setStatus(t('settings.requiredDiscovery'));
      return;
    }
    const manual = manualModel.trim() ? [{ id: manualModel.trim(), name: manualModel.trim(), contextWindow: 0, supportsStreaming: true }] : [];
    const allModels = [...models, ...manual.filter((item) => !models.some((model) => model.id === item.id))];
    if (!allModels.length) {
      setStatus(t('settings.discoverFirst'));
      return;
    }
    setBusy(true);
    try {
      const id = editingId || crypto.randomUUID();
      const connection: ProviderConnection = await api.saveProviderConnection({
        id,
        name: name.trim() || providerId,
        providerId,
        baseUrl: baseUrl.trim() || undefined,
        models: allModels,
        credential: key ? { apiKey: key, endpointUrl: baseUrl.trim() || undefined } : undefined,
        rememberCredential,
      });
      const connections = editingId ? session.connections.map((item) => (item.id === id ? connection : item)) : [...session.connections, connection];
      onUpdateSession({
        connections,
        apiKeys: key ? { ...session.apiKeys, [id]: key } : session.apiKeys,
        connectionId: id,
        providerId,
        modelId: allModels[0].id,
      });
      setStatus(rememberCredential ? t('settings.savedEncrypted') : t('settings.savedTabOnly'));
      resetForm();
      setFormOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('settings.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function editConnection(connection: ProviderConnection, message = t('settings.editing')) {
    setEditingId(connection.id);
    setProviderId(connection.providerId);
    setName(connection.name);
    setBaseUrl(connection.baseUrl || '');
    setModels(connection.models);
    setManualModel('');
    setKey('');
    setRememberCredential(Boolean(connection.credentialStored));
    setStatus(message);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function revalidate(connection: ProviderConnection) {
    if (!connection.credentialStored) {
      editConnection(connection, t('settings.validateNeedsKey'));
      return;
    }
    setBusy(true);
    setStatus(t('settings.validating'));
    try {
      const result = await api.validateSavedProviderConnection(connection.id);
      setStatus(result.isValid ? t('settings.valid') : t('settings.invalid'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('settings.invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    const id = deleteTarget?.id;
    if (!id || busy) return;
    setBusy(true);
    try {
      await api.deleteProviderConnection(id);
      const apiKeys = { ...session.apiKeys };
      delete apiKeys[id];
      const remaining = session.connections.filter((connection) => connection.id !== id);
      const next = session.connectionId === id ? remaining[0] : session.connections.find((connection) => connection.id === session.connectionId);
      onUpdateSession(next
        ? { connections: remaining, apiKeys, connectionId: next.id, providerId: next.providerId, modelId: next.models[0]?.id || 'default' }
        : { connections: remaining, apiKeys, connectionId: 'mock', providerId: 'mock', modelId: 'mock-model-a' });
      if (editingId === id) resetForm();
      setStatus(t('settings.deleted'));
      setDeleteTarget(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('settings.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  function selectConnection(connection: ProviderConnection) {
    onUpdateSession({ connectionId: connection.id, providerId: connection.providerId, modelId: connection.models[0]?.id || 'default' });
  }

  return (
    <div className="pt-3">
      <p className="text-[13px] leading-6 text-fg-2">{t('settings.keyPolicy')}</p>

      <div className="mt-5">
        {session.connections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-fg-3">{t('settings.none')}</p>
        ) : (
          <ul className="list">
            {session.connections.map((connection) => {
              const active = session.connectionId === connection.id;
              return (
                <li key={connection.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-fg">
                      <span className="truncate">{connection.name}</span>
                      {active && <span className="tag shrink-0">{t('settings.inUse')}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-fg-3">
                      {t('settings.connectionMeta', { provider: connection.providerId, count: connection.models.length })}
                      {' · '}
                      {connection.credentialStored ? t('settings.keyEncrypted') : session.apiKeys[connection.id] ? t('settings.keyAvailable') : t('settings.keyRequired')}
                    </p>
                  </div>
                  {!active && (
                    <button type="button" disabled={busy} className="btn btn-secondary btn-sm" onClick={() => selectConnection(connection)}>
                      {t('settings.use')}
                    </button>
                  )}
                  <Menu
                    align="end"
                    label={connection.name}
                    trigger={(props) => (
                      <button type="button" {...props} disabled={busy} className="icon-btn icon-btn-sm" aria-label={t('settings.connectionOptions', { name: connection.name })}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); void revalidate(connection); }}>
                          <RefreshCw />
                          {t('settings.validate')}
                        </button>
                        <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); editConnection(connection); }}>
                          <Settings2 />
                          {t('settings.edit')}
                        </button>
                        <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={() => { close(); setDeleteTarget(connection); }}>
                          <X />
                          {t('common.delete')}
                        </button>
                      </>
                    )}
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!formOpen && (
        <button type="button" className="btn btn-secondary mt-4" onClick={() => { resetForm(); setStatus(''); setFormOpen(true); }}>
          <Plug className="h-4 w-4" />
          {t('settings.addConnection')}
        </button>
      )}
      {status && !formOpen && <p role="status" className="mt-3 text-[13px] text-fg-2">{status}</p>}

      {formOpen && (
        <div ref={formRef} className="mt-6 scroll-mt-4 rounded-2xl border border-line p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="section-title">{editingId ? t('settings.editConnection') : t('settings.addConnection')}</h3>
              <p className="hint">{t('settings.compatibleHint')}</p>
            </div>
            {session.connections.length > 0 && (
              <button type="button" className="icon-btn icon-btn-sm -mr-1 -mt-1" aria-label={t('common.cancel')} onClick={() => { resetForm(); setStatus(''); setFormOpen(false); }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {providerId === 'openai-compatible' && (
            <div className="mt-4">
              <span className="label">{t('settings.presets')}</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {COMPATIBLE_PRESETS.map((preset) => {
                  const selected = baseUrl === preset.baseUrl;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      aria-pressed={selected}
                      className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setName(preset.name); setBaseUrl(preset.baseUrl); setModels([]); setStatus(''); }}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t('settings.provider')}</span>
              <select className="input mt-1.5" value={providerId} onChange={(event) => changeProvider(event.target.value)}>
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">{t('settings.connectionName')}</span>
              <input className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t('settings.baseUrl')}</span>
              <input className="input mt-1.5 font-mono text-[13px]" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t('settings.apiKey')}</span>
              <input
                type="password"
                autoComplete="off"
                className="input mt-1.5 font-mono text-[13px]"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={providerId === 'mock' ? t('settings.notRequiredMock') : editing?.credentialStored ? t('settings.keepSavedKey') : t('settings.requiredDiscovery')}
              />
              <span className="hint block">{t('settings.keySentTo')}</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">{t('settings.manualModel')}</span>
              <input className="input mt-1.5 font-mono text-[13px]" value={manualModel} onChange={(event) => setManualModel(event.target.value)} placeholder={t('settings.manualModelHint')} />
            </label>
            {providerId !== 'mock' && (
              <label className="flex items-start gap-3 sm:col-span-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--fg))]" checked={rememberCredential} onChange={(event) => setRememberCredential(event.target.checked)} />
                <span>
                  <span className="block text-sm text-fg">{t('settings.remember')}</span>
                  <span className="hint block !mt-0.5">{t('settings.rememberHint')}</span>
                </span>
              </label>
            )}
          </div>

          {models.length > 0 && (
            <ul className="mt-4 max-h-40 overflow-auto rounded-xl bg-surface px-3 py-1 text-[13px]">
              {models.map((model) => (
                <li key={model.id} className="flex items-baseline gap-2 border-b border-line py-1.5 last:border-0">
                  <Check className="h-3.5 w-3.5 shrink-0 self-center text-success" />
                  <span className="truncate text-fg">{model.name}</span>
                  <span className="truncate font-mono text-xs text-fg-3">{model.id}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary" disabled={busy || (!key && providerId !== 'mock')} onClick={() => void discoverModels()}>
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {t('settings.discover')}
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || keyMissing} onClick={() => void saveConnection()}>
              {editingId ? t('common.save') : t('settings.save')}
            </button>
            {status && <p role="status" className="basis-full text-[13px] text-fg-2 sm:basis-auto">{status}</p>}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={busy}
        title={t('settings.deleteTitle')}
        description={t('settings.deleteBody')}
        onClose={() => { if (!busy) setDeleteTarget(null); }}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
