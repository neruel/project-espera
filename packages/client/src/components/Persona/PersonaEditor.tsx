import React, { useEffect, useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import type { Persona, PersonaRevision } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage, type TranslateFn } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Modal } from '../Common/Modal.js';

export function PersonaEditor() {
  const { t, language } = useLanguage();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [revisions, setRevisions] = useState<PersonaRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<PersonaRevision | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PersonaRevision | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', instructions: '', tone: '', principles: '', reason: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setErrorMessage(null);
    try {
      const [current, history] = await Promise.all([api.getPersona(), api.getPersonaRevisions()]);
      setPersona(current);
      setRevisions(history);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('persona.loadFailed'));
    }
  }

  function startEditing() {
    if (!persona) return;
    setForm({
      name: persona.name,
      instructions: persona.instructions,
      tone: persona.toneAndManner,
      principles: persona.principles.join('\n'),
      reason: t('persona.defaultReason'),
    });
    setEditing(true);
    setErrorMessage(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!persona || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await api.updatePersona({
        name: form.name.trim(),
        instructions: form.instructions.trim(),
        toneAndManner: form.tone.trim(),
        principles: form.principles.split('\n').map((item) => item.trim()).filter(Boolean),
        changeReason: form.reason.trim(),
      });
      setPersona(updated);
      setRevisions(await api.getPersonaRevisions());
      setEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('persona.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!restoreTarget || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      setPersona(await api.restorePersonaRevision(restoreTarget.version));
      setRevisions(await api.getPersonaRevisions());
      setSelectedRevision(null);
      setRestoreTarget(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('persona.restoreFailed'));
      setRestoreTarget(null);
    } finally {
      setSaving(false);
    }
  }

  const setField = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const formatDate = (value: string) => new Date(value).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (!persona) {
    return (
      <main className="page">
        {errorMessage ? (
          <div className="alert" role="alert">
            <span>{errorMessage}</span>
            <button type="button" className="btn btn-sm btn-ghost !text-danger" onClick={() => void load()}>{t('common.retry')}</button>
          </div>
        ) : (
          <p className="empty">{t('common.loading')}</p>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('persona.title')}</h1>
          <p className="page-desc">{t('persona.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startEditing}>
          <Pencil className="h-4 w-4" />
          {t('persona.edit')}
        </button>
      </header>

      {errorMessage && !editing && <div className="alert mb-6" role="alert">{errorMessage}</div>}

      <section className="rounded-2xl border border-line p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="section-title">{persona.name}</h2>
          <span className="tag">{t('persona.version', { version: persona.version })}</span>
        </div>
        <PersonaContent instructions={persona.instructions} tone={persona.toneAndManner} principles={persona.principles} t={t} />
      </section>

      <section className="mt-10">
        <h2 className="section-title mb-3">{t('persona.revisions')}</h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-fg-3">{t('persona.noRevisions')}</p>
        ) : (
          <ul className="list">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <button type="button" className="flex w-full items-baseline gap-4 py-3 text-left transition-colors hover:bg-[var(--hover)] sm:px-2" onClick={() => setSelectedRevision(revision)}>
                  <span className="w-10 shrink-0 text-sm font-medium tabular-nums text-fg">v{revision.version}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{revision.changeReason}</span>
                  <span className="shrink-0 text-xs text-fg-3">{formatDate(revision.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <Modal
          title={t('persona.editTitle')}
          description={t('persona.editCopy')}
          size="lg"
          locked={saving}
          onClose={() => setEditing(false)}
        >
          <form onSubmit={save} className="space-y-4">
            {errorMessage && <div className="alert" role="alert">{errorMessage}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">{t('persona.name')}</span>
                <input className="input mt-1.5" value={form.name} onChange={setField('name')} required />
              </label>
              <label className="block">
                <span className="label">{t('persona.reason')}</span>
                <input className="input mt-1.5" value={form.reason} onChange={setField('reason')} required />
              </label>
            </div>
            <label className="block">
              <span className="label">{t('persona.instructions')}</span>
              <textarea className="input mt-1.5 resize-y" rows={4} value={form.instructions} onChange={setField('instructions')} required />
            </label>
            <label className="block">
              <span className="label">{t('persona.tone')}</span>
              <textarea className="input mt-1.5 resize-y" rows={3} value={form.tone} onChange={setField('tone')} required />
            </label>
            <label className="block">
              <span className="label">{t('persona.principles')}</span>
              <textarea className="input mt-1.5 resize-y" rows={5} value={form.principles} onChange={setField('principles')} required />
              <span className="hint block">{t('persona.principlesHint')}</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={saving} className="btn btn-secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? t('common.loading') : t('persona.saveAs', { version: persona.version + 1 })}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedRevision && (
        <Modal
          title={t('persona.version', { version: selectedRevision.version })}
          description={`${selectedRevision.changeReason} · ${formatDate(selectedRevision.createdAt)}`}
          size="lg"
          // The restore confirmation owns Escape while it is open.
          onClose={() => { if (!restoreTarget) setSelectedRevision(null); }}
          footer={(
            <button type="button" disabled={saving} className="btn btn-primary" onClick={() => setRestoreTarget(selectedRevision)}>
              <RotateCcw className="h-4 w-4" />
              {t('persona.restore')}
            </button>
          )}
        >
          <PersonaContent instructions={selectedRevision.instructions} tone={selectedRevision.toneAndManner} principles={selectedRevision.principles} t={t} />
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        danger={false}
        busy={saving}
        title={t('persona.restoreTitle', { version: restoreTarget?.version ?? '' })}
        description={t('persona.restoreBody')}
        confirmLabel={t('persona.restoreConfirm')}
        onClose={() => { if (!saving) setRestoreTarget(null); }}
        onConfirm={() => void restore()}
      />
    </main>
  );
}

function PersonaContent({ instructions, tone, principles, t }: { instructions: string; tone: string; principles: string[]; t: TranslateFn }) {
  return (
    <dl className="space-y-5">
      <div>
        <dt className="text-[13px] font-medium text-fg-3">{t('persona.instructions')}</dt>
        <dd className="mt-1.5 whitespace-pre-wrap text-[15px] leading-7 text-fg">{instructions}</dd>
      </div>
      <div>
        <dt className="text-[13px] font-medium text-fg-3">{t('persona.tone')}</dt>
        <dd className="mt-1.5 whitespace-pre-wrap text-[15px] leading-7 text-fg">{tone}</dd>
      </div>
      <div>
        <dt className="text-[13px] font-medium text-fg-3">{t('persona.principles')}</dt>
        <dd className="mt-1.5">
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-7 text-fg marker:text-fg-3">
            {principles.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
