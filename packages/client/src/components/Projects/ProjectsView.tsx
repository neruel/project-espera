import React, { useEffect, useState } from 'react';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import type { Project } from '@espera/shared';
import { api } from '../../services/api.js';

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');

  async function load() { try { setProjects(await api.getProjects()); } catch (error) { setStatus(error instanceof Error ? error.message : 'Projects could not be loaded.'); } }
  useEffect(() => { void load(); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try { const project = await api.createProject(name.trim(), description.trim()); setProjects((current) => [project, ...current]); setName(''); setDescription(''); setStatus('Project created.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Project could not be created.'); }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete project “${project.name}”? Conversations will remain but lose this scope.`)) return;
    try { await api.deleteProject(project.id); setProjects((current) => current.filter((item) => item.id !== project.id)); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Project could not be deleted.'); }
  }

  return <main className="flex-1 w-full max-w-5xl mx-auto overflow-y-auto p-4 sm:p-6 space-y-6">
    <header><h1 className="flex items-center gap-2 text-xl font-bold text-white"><FolderKanban className="text-sky-400" /> Projects</h1><p className="mt-1 text-sm text-slate-400">Keep long-running work separate so memory and context can stay project-scoped.</p></header>
    <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-semibold text-white">Create project</h2><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" maxLength={100} required /><textarea className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs in this project?" maxLength={2000} rows={3} /><button className="btn bg-sky-600 hover:bg-sky-500" type="submit"><Plus className="h-4 w-4" /> Create project</button></form>
    {status && <p className="text-sm text-amber-300" role="status">{status}</p>}
    <section className="grid gap-3 sm:grid-cols-2">{projects.length === 0 && <p className="text-sm text-slate-500">No projects yet.</p>}{projects.map((project) => <article key={project.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-100">{project.name}</h2><span className="mt-2 inline-block rounded-full border border-emerald-800 px-2 py-0.5 text-[11px] text-emerald-400">{project.status}</span></div><button aria-label={`Delete ${project.name}`} className="rounded-lg p-2 text-rose-400 hover:bg-rose-950" onClick={() => remove(project)}><Trash2 className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-relaxed text-slate-400">{project.description || 'No description yet.'}</p><p className="mt-4 text-xs text-slate-600">Updated {new Date(project.updatedAt).toLocaleDateString()}</p></article>)}</section>
  </main>;
};
