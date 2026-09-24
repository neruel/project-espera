import React, { useEffect, useState } from 'react';
import { Archive, Check, FileText, MoreHorizontal, Pencil, Plus, Search, X } from 'lucide-react';
import type { Memory, MemoryEvidence, MemoryRevision, MemoryStatus, MemoryType, Project } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage, type TranslationKey } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Menu } from '../Common/Menu.js';
import { Modal } from '../Common/Modal.js';

interface Props {
  onMemoryChanged: () => void;
  projects?: Project[];
}

type Tab = 'pending' | 'active' | 'history';
type Sort = 'updated' | 'importance' | 'confidence';
type Details = { revisions: MemoryRevision[]; evidence: MemoryEvidence[] };

const TYPES: MemoryType[] = ['fact', 'preference', 'constraint', 'goal', 'project', 'relationship'];
const typeKey = (type: MemoryType) => `memory.type.${type}` as TranslationKey;
const statusKey = (status: MemoryStatus) => `memory.status.${status}` as TranslationKey;
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function MemoryManager({ onMemoryChanged, projects = [] }: Props) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('pending');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sort, setSort] = useState<Sort>('importance');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [editText, setEditText] = useState('');
  const [editImportance, setEditImportance] = useState(3);
  const [createOpen, setCreateOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newPredicate, setNewPredicate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Memory | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 250);
    return () => window.clearTimeout(timer);
  }, [tab, search, filterType, projectFilter, sort]);

  async function load(reset = true) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const page = await api.getMemoriesPage({
        status: tab === 'history' ? undefined : tab,
        view: tab === 'history' ? 'history' : undefined,
        type: filterType || undefined,
        projectId: projectFilter || undefined,
        query: search.trim() || undefined,
        sort,
        offset: reset ? 0 : memories.length,
        limit: 30,
      });
      setMemories((current) => (reset ? page.memories : [...current, ...page.memories]));
      setHasMore(page.hasMore);
    } catch (error) {
      setErrorMessage(errorText(error, t('memory.loadFailed')));
    } finally {
      setLoading(false);
    }
  }

  async function runAction(id: string, action: () => Promise<void>, success: string) {
    if (busyId) return;
    setBusyId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await action();
      setSuccessMessage(success);
    } catch (error) {
      setErrorMessage(errorText(error, t('memory.actionFailed')));
    } finally {
      setBusyId(null);
    }
  }

  async function approve(memory: Memory) {
    await runAction(memory.id, async () => {
      await api.approveMemory(memory.id, 'User approved from memory inbox');
      await load();
      onMemoryChanged();
    }, t('memory.approved'));
  }

  async function reject(memory: Memory) {
    await runAction(memory.id, async () => {
      await api.rejectMemory(memory.id, 'User rejected from memory inbox');
      await load();
      onMemoryChanged();
    }, t('memory.rejected'));
  }

  async function archive() {
    const memory = archiveTarget;
    if (!memory) return;
    await runAction(memory.id, async () => {
      await api.deleteMemory(memory.id, 'soft');
      await load();
      onMemoryChanged();
      setArchiveTarget(null);
    }, t('memory.archived'));
  }

  async function openDetails(memory: Memory) {
    setSelected(memory);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const result = await api.getMemoryDetails(memory.id);
      setDetails({ revisions: result.revisions, evidence: result.evidence });
    } catch (error) {
      setDetailsError(errorText(error, t('memory.detailsFailed')));
    } finally {
      setDetailsLoading(false);
    }
  }

  function beginEdit(memory: Memory) {
    setEditing(memory);
    setEditText(memory.canonicalText);
    setEditImportance(memory.importance);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editText.trim()) return;
    await runAction(editing.id, async () => {
      await api.editAndApproveMemory(editing.id, { canonicalText: editText.trim(), importance: editImportance, changeReason: 'User refined wording' });
      setEditing(null);
      await load();
      onMemoryChanged();
    }, t('memory.updatedApproved'));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!newText.trim()) return;
    await runAction('create', async () => {
      await api.createMemory({
        type: 'fact',
        subject: 'user',
        predicate: newPredicate.trim() || 'has_fact',
        canonicalText: newText.trim(),
        importance: 3,
        sensitivity: 'low',
      });
      setCreateOpen(false);
      setNewText('');
      setNewPredicate('');
      setTab('active');
      onMemoryChanged();
    }, t('memory.added'));
  }

  const projectName = (id: string | null) => (id ? projects.find((project) => project.id === id)?.name || t('memory.deletedProject') : t('memory.global'));
  const formatDate = (value: string) => new Date(value).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const busy = Boolean(busyId);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: t('memory.pending') },
    { id: 'active', label: t('memory.active') },
    { id: 'history', label: t('memory.history') },
  ];

  const formFooter = (close: () => void, formId: string) => (
    <>
      <button type="button" disabled={busy} className="btn btn-secondary" onClick={close}>{t('common.cancel')}</button>
      <button type="submit" form={formId} disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </>
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('memory.title')}</h1>
          <p className="page-desc">{t('memory.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)} disabled={busy}>
          <Plus className="h-4 w-4" />
          {t('memory.add')}
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="tabs w-fit" role="tablist" aria-label={t('memory.title')}>
          {tabs.map(({ id, label }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`tab ${tab === id ? 'tab-active' : ''}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
          <input aria-label={t('memory.search')} className="input !rounded-full !py-2 pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('memory.search')} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label={t('memory.typeFilter')} className="input !w-auto !rounded-full !py-1.5 text-[13px]" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
          <option value="">{t('memory.allTypes')}</option>
          {TYPES.map((type) => <option key={type} value={type}>{t(typeKey(type))}</option>)}
        </select>
        <select aria-label={t('memory.scopeFilter')} className="input !w-auto !rounded-full !py-1.5 text-[13px]" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
          <option value="">{t('memory.allScopes')}</option>
          <option value="global">{t('memory.globalOnly')}</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select aria-label={t('memory.sort')} className="input !w-auto !rounded-full !py-1.5 text-[13px]" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="importance">{t('memory.sort.importance')}</option>
          <option value="updated">{t('memory.sort.updated')}</option>
          <option value="confidence">{t('memory.sort.confidence')}</option>
        </select>
      </div>

      {tab === 'pending' && <p className="notice mt-5">{t('memory.pendingNotice')}</p>}

      {(errorMessage || successMessage) && (
        <div role={errorMessage ? 'alert' : 'status'} className={`mt-4 ${errorMessage ? 'alert' : 'notice flex items-center justify-between gap-3 !text-fg'}`}>
          <span className="min-w-0 flex-1">{errorMessage || successMessage}</span>
          <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label={t('common.close')} onClick={() => { setErrorMessage(null); setSuccessMessage(null); }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="mt-6" aria-busy={loading}>
        <p className="mb-2 text-xs text-fg-3">{t('memory.count', { count: memories.length })}</p>
        {loading && memories.length === 0 ? (
          <p className="empty">{t('memory.loading')}</p>
        ) : memories.length === 0 ? (
          <div className="empty">
            <p className="text-fg-2">{t('memory.empty')}</p>
            <p className="mt-1">{t('memory.emptyCopy')}</p>
          </div>
        ) : (
          <ul className="list">
            {memories.map((memory) => (
              <li key={memory.id} className="flex items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <button type="button" className="block w-full text-left text-[15px] leading-7 text-fg hover:underline hover:decoration-fg-3 hover:underline-offset-4" onClick={() => void openDetails(memory)}>
                    {memory.canonicalText}
                  </button>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3">
                    <span className="tag">{t(typeKey(memory.type))}</span>
                    <span>{projectName(memory.projectId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t('memory.confidenceValue', { value: Math.round(memory.confidence * 100) })}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(memory.updatedAt)}</span>
                    {tab === 'history' && <span className="tag">{t(statusKey(memory.status))}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {memory.status === 'pending' && (
                    <>
                      <button type="button" disabled={busy} className="btn btn-sm btn-secondary" onClick={() => void reject(memory)}>
                        <X className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t('memory.reject')}</span>
                      </button>
                      <button type="button" disabled={busy} className="btn btn-sm btn-primary" onClick={() => void approve(memory)}>
                        <Check className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{busyId === memory.id ? t('common.loading') : t('memory.approve')}</span>
                      </button>
                    </>
                  )}
                  <Menu
                    align="end"
                    label={t('memory.options')}
                    className="w-44"
                    trigger={(props) => (
                      <button type="button" {...props} className="icon-btn icon-btn-sm" aria-label={t('memory.options')}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  >
                    {(close) => (
                      <>
                        <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); void openDetails(memory); }}>
                          <FileText />
                          {t('memory.details')}
                        </button>
                        {(memory.status === 'pending' || memory.status === 'active') && (
                          <button type="button" role="menuitem" disabled={busy} className="menu-item" onClick={() => { close(); beginEdit(memory); }}>
                            <Pencil />
                            {t('memory.edit')}
                          </button>
                        )}
                        {memory.status === 'active' && (
                          <button type="button" role="menuitem" disabled={busy} className="menu-item menu-item-danger" onClick={() => { close(); setArchiveTarget(memory); }}>
                            <Archive />
                            {t('memory.archive')}
                          </button>
                        )}
                      </>
                    )}
                  </Menu>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load(false)}>{t('memory.loadMore')}</button>
          </div>
        )}
      </section>

      {editing && (
        <Modal title={t('memory.edit')} description={t('memory.editCopy')} onClose={() => setEditing(null)} locked={busy} footer={formFooter(() => setEditing(null), 'memory-edit-form')}>
          <form id="memory-edit-form" onSubmit={saveEdit} className="space-y-4">
            <label className="block">
              <span className="label">{t('memory.statement')}</span>
              <textarea autoFocus className="input mt-1.5 resize-y leading-6" rows={4} value={editText} onChange={(event) => setEditText(event.target.value)} required />
            </label>
            <label className="block">
              <span className="label">{t('memory.importance')}</span>
              <input className="input mt-1.5 !w-28" type="number" min={1} max={5} value={editImportance} onChange={(event) => setEditImportance(Number(event.target.value))} />
              <span className="hint block">{t('memory.importanceHint')}</span>
            </label>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal title={t('memory.details')} onClose={() => setSelected(null)} size="lg">
          <p className="text-[15px] leading-7 text-fg">{selected.canonicalText}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-3">
            <span className="tag">{t(typeKey(selected.type))}</span>
            <span className="tag">{t(statusKey(selected.status))}</span>
            <span>{projectName(selected.projectId)}</span>
            <span aria-hidden="true">·</span>
            <span>{t(`memory.source.${selected.sourceKind}` as TranslationKey)}</span>
          </p>
          {detailsLoading ? (
            <p className="py-10 text-center text-sm text-fg-3">{t('common.loading')}</p>
          ) : detailsError ? (
            <div className="alert mt-5" role="alert">
              <span className="min-w-0 flex-1">{detailsError}</span>
              <button type="button" className="shrink-0 font-medium underline underline-offset-2" onClick={() => void openDetails(selected)}>{t('common.retry')}</button>
            </div>
          ) : details && (
            <>
              <DetailSection title={t('memory.evidence')}>
                {details.evidence.length ? (
                  <ul className="space-y-2">
                    {details.evidence.map((item) => (
                      <li key={item.id} className="rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-fg-2">
                        <p>“{item.snippet}”</p>
                        <p className="mt-1 text-xs text-fg-3">{t('memory.evidenceSource', { conversation: item.conversationId || '—', message: item.messageId })}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-fg-3">{t('memory.noEvidence')}</p>
                )}
              </DetailSection>
              <DetailSection title={t('memory.revisions')}>
                <ul className="space-y-1.5">
                  {details.revisions.map((item) => (
                    <li key={item.id} className="text-[13px] text-fg-2">
                      <span className="text-fg">{item.previousStatus ? t(statusKey(item.previousStatus)) : t('memory.revisionNew')} → {t(statusKey(item.newStatus))}</span>
                      {item.changeReason && <span className="text-fg-3"> · {item.changeReason}</span>}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            </>
          )}
        </Modal>
      )}

      {createOpen && (
        <Modal title={t('memory.addTitle')} description={t('memory.addCopy')} onClose={() => setCreateOpen(false)} locked={busy} footer={formFooter(() => setCreateOpen(false), 'memory-create-form')}>
          <form id="memory-create-form" onSubmit={create} className="space-y-4">
            <label className="block">
              <span className="label">{t('memory.statement')}</span>
              <textarea autoFocus className="input mt-1.5 leading-6" rows={4} value={newText} onChange={(event) => setNewText(event.target.value)} placeholder={t('memory.statementPlaceholder')} required />
            </label>
            <label className="block">
              <span className="label">{t('memory.relationship')}</span>
              <input className="input mt-1.5" value={newPredicate} onChange={(event) => setNewPredicate(event.target.value)} placeholder="has_fact" />
              <span className="hint block">{t('memory.relationshipHint')}</span>
            </label>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        busy={busy}
        title={t('memory.archiveTitle')}
        description={t('memory.archiveBody')}
        confirmLabel={t('memory.archive')}
        onClose={() => { if (!busyId) setArchiveTarget(null); }}
        onConfirm={() => void archive()}
      />
    </main>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h3 className="mb-3 text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}
