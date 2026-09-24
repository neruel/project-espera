import React, { useEffect, useState } from 'react';
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Conversation, Memory, Project } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Modal } from '../Common/Modal.js';

type Contents = { conversations: Conversation[]; memories: Memory[] };

const STATUSES = ['active', 'completed', 'archived'] as const;
const statusKey = { active: 'projects.status.active', completed: 'projects.status.completed', archived: 'projects.status.archived' } as const;

export function ProjectsView({ onProjectsChanged }: { onProjectsChanged?: () => Promise<void> | void }) {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, Contents>>({});
  const [contentsLoading, setContentsLoading] = useState(false);

  async function load() {
    try {
      setProjects(await api.getProjects());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('projects.error.load'));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { void load(); }, []);

  function closeCreate() {
    setCreateOpen(false);
    setName('');
    setDescription('');
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setStatus('');
    try {
      const project = await api.createProject(name.trim(), description.trim());
      setProjects((current) => [project, ...current]);
      await onProjectsChanged?.();
      closeCreate();
      setStatus(t('projects.created'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('projects.error.create'));
    } finally {
      setCreating(false);
    }
  }

  async function remove() {
    if (!deleting || saving) return;
    setSaving(true);
    try {
      await api.deleteProject(deleting.id);
      setProjects((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      await onProjectsChanged?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('projects.error.delete'));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editing.name.trim() || saving) return;
    setSaving(true);
    try {
      const updated = await api.updateProject(editing.id, {
        name: editing.name.trim(),
        description: editing.description.trim(),
        status: editing.status,
      });
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await onProjectsChanged?.();
      setEditing(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('projects.error.update'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleContents(project: Project) {
    if (expandedId === project.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(project.id);
    if (contents[project.id]) return;
    setContentsLoading(true);
    try {
      const value = await api.getProjectContents(project.id);
      setContents((current) => ({ ...current, [project.id]: value }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('projects.error.contents'));
    } finally {
      setContentsLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('projects.title')}</h1>
          <p className="page-desc">{t('projects.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('projects.new')}
        </button>
      </header>

      {status && <p role="status" className="mb-4 text-[13px] text-fg-2">{status}</p>}

      {loaded && projects.length === 0 ? (
        <div className="empty">
          <p className="text-fg-2">{t('projects.empty')}</p>
          <p className="mt-1">{t('projects.emptyCopy')}</p>
        </div>
      ) : (
        <ul className="list">
          {projects.map((project) => {
            const expanded = expandedId === project.id;
            return (
              <li key={project.id} className="group">
                <div className="flex items-start gap-2 py-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    onClick={() => void toggleContents(project)}
                    aria-expanded={expanded}
                  >
                    <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-fg-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-medium text-fg">{project.name}</h2>
                        {project.status !== 'active' && <span className="tag shrink-0">{t(statusKey[project.status])}</span>}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-5 text-fg-3">
                        {project.description || t('projects.noDescription')}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                    <button type="button" className="icon-btn icon-btn-sm" aria-label={`${t('common.edit')} ${project.name}`} title={t('common.edit')} onClick={() => setEditing({ ...project })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="icon-btn icon-btn-sm hover:!text-danger" aria-label={`${t('common.delete')} ${project.name}`} title={t('common.delete')} onClick={() => setDeleting(project)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {expanded && <ProjectContents contents={contents[project.id]} loading={contentsLoading} />}
              </li>
            );
          })}
        </ul>
      )}

      {createOpen && (
        <Modal title={t('projects.new')} onClose={closeCreate} locked={creating}>
          <form onSubmit={create} className="space-y-4">
            <label className="block">
              <span className="label">{t('projects.name')}</span>
              <input autoFocus className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
            </label>
            <label className="block">
              <span className="label">{t('projects.description')}</span>
              <textarea className="input mt-1.5 resize-none" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-secondary" disabled={creating} onClick={closeCreate}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
                {creating ? t('common.loading') : t('projects.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={t('projects.editTitle')} onClose={() => setEditing(null)} locked={saving}>
          <form onSubmit={saveEdit} className="space-y-4">
            <label className="block">
              <span className="label">{t('projects.name')}</span>
              <input autoFocus className="input mt-1.5" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={100} required />
            </label>
            <label className="block">
              <span className="label">{t('projects.description')}</span>
              <textarea className="input mt-1.5 resize-none" rows={4} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} maxLength={2000} />
            </label>
            <label className="block">
              <span className="label">{t('projects.status')}</span>
              <select className="input mt-1.5" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as Project['status'] })}>
                {STATUSES.map((value) => <option key={value} value={value}>{t(statusKey[value])}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        busy={saving}
        title={t('projects.deleteTitle')}
        description={deleting ? t('projects.deleteBody', { name: deleting.name }) : ''}
        onClose={() => { if (!saving) setDeleting(null); }}
        onConfirm={() => void remove()}
      />
    </main>
  );
}

function ProjectContents({ contents, loading }: { contents?: Contents; loading: boolean }) {
  const { t } = useLanguage();
  if (loading && !contents) return <p className="pb-4 pl-6 text-[13px] text-fg-3">{t('common.loading')}</p>;
  if (!contents) return null;
  const columns = [
    { title: t('projects.conversations', { count: contents.conversations.length }), items: contents.conversations.slice(0, 5).map((item) => ({ id: item.id, text: item.title })) },
    { title: t('projects.memories', { count: contents.memories.length }), items: contents.memories.slice(0, 5).map((item) => ({ id: item.id, text: item.canonicalText })) },
  ];
  return (
    <div className="grid gap-5 pb-5 pl-6 sm:grid-cols-2">
      {columns.map((column) => (
        <div key={column.title} className="min-w-0">
          <h3 className="text-xs font-medium text-fg-3">{column.title}</h3>
          {column.items.length
            ? <ul className="mt-2 space-y-1.5">{column.items.map((item) => <li key={item.id} className="truncate text-[13px] text-fg-2">{item.text}</li>)}</ul>
            : <p className="mt-2 text-[13px] text-fg-3">—</p>}
        </div>
      ))}
    </div>
  );
}
