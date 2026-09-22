import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Edit3,
  FolderKanban,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Conversation, Memory, Project } from "@espera/shared";
import { api } from "../../services/api.js";
import { useLanguage } from "../../i18n.js";
import { ConfirmDialog } from "../Common/ConfirmDialog.js";
import { useDialogAccessibility } from "../Common/useDialogAccessibility.js";

type Contents = { conversations: Conversation[]; memories: Memory[] };
export const ProjectsView: React.FC<{
  onProjectsChanged?: () => Promise<void> | void;
}> = ({ onProjectsChanged }) => {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, Contents>>({});
  const [contentsLoading, setContentsLoading] = useState(false);
  const editingDialogRef = useDialogAccessibility(Boolean(editing), () => { if (!saving) setEditing(null); });

  async function load() {
    try {
      setProjects(await api.getProjects());
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Projects could not be loaded.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setStatus("");
    try {
      const project = await api.createProject(name.trim(), description.trim());
      setProjects((current) => [project, ...current]);
      await onProjectsChanged?.();
      setName("");
      setDescription("");
      setStatus(
        language === "ko" ? "프로젝트를 만들었습니다." : "Project created.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Project could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }
  async function remove() {
    if (!deleting || saving) return;
    setSaving(true);
    try {
      await api.deleteProject(deleting.id);
      setProjects((current) =>
        current.filter((item) => item.id !== deleting.id),
      );
      setDeleting(null);
      await onProjectsChanged?.();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Project could not be deleted.",
      );
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
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await onProjectsChanged?.();
      setEditing(null);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Project could not be updated.",
      );
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
      setStatus(
        error instanceof Error
          ? error.message
          : "Project contents could not be loaded.",
      );
    } finally {
      setContentsLoading(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <div className="workspace-eyebrow">{t("common.workspace")}</div>
          <h1 className="workspace-title">{t("projects.title")}</h1>
          <p className="workspace-subtitle">{t("projects.subtitle")}</p>
        </div>
        <button
          aria-label="Focus project form"
          className="workspace-button workspace-button-primary"
          type="button"
          onClick={() =>
            document.getElementById("create-project-name")?.focus()
          }
        >
          <Plus className="h-4 w-4" />
          {t("projects.create")}
        </button>
      </header>
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section className="workspace-section min-h-[220px]">
          <div className="workspace-section-header">
            <div>
              <h2 className="workspace-section-title">
                {t("projects.library")}
              </h2>
              <p className="workspace-section-copy">
                {t("projects.libraryCopy")}
              </p>
            </div>
            <span className="workspace-muted">{projects.length}</span>
          </div>
          <div className="divide-y divide-neutral-800">
            {projects.length === 0 && <Empty t={t} />}
            {projects.map((project) => (
              <article
                key={project.id}
                className="transition hover:bg-white/[.02]"
              >
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void toggleContents(project)}
                    aria-expanded={expandedId === project.id}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-neutral-600 transition ${expandedId === project.id ? "rotate-180" : ""}`}
                      />
                      <h3 className="truncate text-sm font-medium text-neutral-100">
                        {project.name}
                      </h3>
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-500">
                        {project.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 pl-5 text-xs leading-5 text-neutral-500">
                      {project.description || t("projects.noDescription")}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={`${language === "ko" ? "수정" : "Edit"} ${project.name}`}
                      className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-800 hover:text-neutral-200"
                      onClick={() => setEditing({ ...project })}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`${t("common.delete")} ${project.name}`}
                      className="rounded-lg p-2 text-neutral-600 hover:bg-red-950/40 hover:text-red-300"
                      onClick={() => setDeleting(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {expandedId === project.id && (
                  <ProjectContents
                    contents={contents[project.id]}
                    loading={contentsLoading}
                    language={language}
                  />
                )}
              </article>
            ))}
          </div>
        </section>
        <form onSubmit={create} className="workspace-section h-fit p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
              <Plus className="h-4 w-4 text-neutral-300" />
            </div>
            <div>
              <h2 className="workspace-section-title">
                {t("projects.create")}
              </h2>
              <p className="workspace-section-copy">
                {t("projects.createCopy")}
              </p>
            </div>
          </div>
          <label className="mb-4 block text-xs font-medium text-neutral-400">
            {t("projects.name")}
            <input
              id="create-project-name"
              className="workspace-input mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label className="mb-4 block text-xs font-medium text-neutral-400">
            {t("projects.description")}
            <textarea
              className="workspace-input mt-2 resize-none"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={4}
            />
          </label>
          <button
            className="workspace-button workspace-button-primary w-full"
            disabled={creating}
          >
            <Plus className="h-4 w-4" />
            {creating ? t("common.loading") : t("projects.create")}
          </button>
          {status && (
            <p className="mt-3 text-xs text-neutral-400" role="status">
              {status}
            </p>
          )}
        </form>
      </div>
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={language === "ko" ? "프로젝트 수정" : "Edit project"}
        >
          <form
            ref={editingDialogRef as React.RefObject<HTMLFormElement | null>}
            onSubmit={saveEdit}
            className="workspace-section w-full max-w-lg p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="workspace-section-title">
                {language === "ko" ? "프로젝트 수정" : "Edit project"}
              </h2>
              <button
                type="button"
                aria-label={t("common.close")}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-800"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-4 block text-xs text-neutral-400">
              {t("projects.name")}
              <input
                autoFocus
                className="workspace-input mt-2"
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
                maxLength={100}
                required
              />
            </label>
            <label className="mb-4 block text-xs text-neutral-400">
              {t("projects.description")}
              <textarea
                className="workspace-input mt-2"
                rows={4}
                value={editing.description}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
                maxLength={2000}
              />
            </label>
            <label className="mb-5 block text-xs text-neutral-400">
              Status
              <select
                className="workspace-input mt-2"
                value={editing.status}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    status: event.target.value as Project["status"],
                  })
                }
              >
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="workspace-button"
                onClick={() => setEditing(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                disabled={saving}
                className="workspace-button workspace-button-primary"
              >
                <Check className="h-4 w-4" />
                {saving ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        busy={saving}
        title={language === "ko" ? "프로젝트를 삭제할까요?" : "Delete project?"}
        description={
          deleting
            ? language === "ko"
              ? `${deleting.name} 프로젝트를 삭제합니다. 연결된 대화와 기억은 유지되며 Global 범위로 이동합니다.`
              : `${deleting.name} will be deleted. Linked conversations and memories remain and move to Global scope.`
            : ""
        }
        onClose={() => {
          if (!saving) setDeleting(null);
        }}
        onConfirm={() => void remove()}
      />
    </main>
  );
};

const Empty = ({ t }: { t: (key: string) => string }) => (
  <div className="px-5 py-16 text-center">
    <FolderKanban className="mx-auto h-8 w-8 text-neutral-700" />
    <p className="mt-3 text-sm text-neutral-400">{t("projects.empty")}</p>
    <p className="mt-1 text-xs text-neutral-600">{t("projects.emptyCopy")}</p>
  </div>
);
function ProjectContents({
  contents,
  loading,
  language,
}: {
  contents?: Contents;
  loading: boolean;
  language: string;
}) {
  if (loading && !contents)
    return (
      <div className="border-t border-neutral-800 px-10 py-4 text-xs text-neutral-600">
        Loading…
      </div>
    );
  if (!contents) return null;
  return (
    <div className="grid gap-4 border-t border-neutral-800 bg-neutral-950/30 px-10 py-4 sm:grid-cols-2">
      <div>
        <h4 className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
          <MessageSquare className="h-3.5 w-3.5" />
          {language === "ko" ? "연결된 대화" : "Conversations"} ·{" "}
          {contents.conversations.length}
        </h4>
        {contents.conversations.length ? (
          contents.conversations.slice(0, 5).map((item) => (
            <p key={item.id} className="mt-2 truncate text-xs text-neutral-500">
              {item.title}
            </p>
          ))
        ) : (
          <p className="mt-2 text-xs text-neutral-700">—</p>
        )}
      </div>
      <div>
        <h4 className="text-[11px] font-semibold text-neutral-400">
          {language === "ko" ? "프로젝트 기억" : "Project memories"} ·{" "}
          {contents.memories.length}
        </h4>
        {contents.memories.length ? (
          contents.memories.slice(0, 5).map((item) => (
            <p key={item.id} className="mt-2 truncate text-xs text-neutral-500">
              {item.canonicalText}
            </p>
          ))
        ) : (
          <p className="mt-2 text-xs text-neutral-700">—</p>
        )}
      </div>
    </div>
  );
}
