import React, { useEffect, useState } from "react";
import {
  Brain,
  Check,
  Edit3,
  FileText,
  Info,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  Memory,
  MemoryEvidence,
  MemoryRevision,
  Project,
} from "@espera/shared";
import { api } from "../../services/api.js";
import { useLanguage } from "../../i18n.js";
import { ConfirmDialog } from "../Common/ConfirmDialog.js";
import { useDialogAccessibility } from "../Common/useDialogAccessibility.js";

interface Props {
  onMemoryChanged: () => void;
  projects?: Project[];
}
type Details = { revisions: MemoryRevision[]; evidence: MemoryEvidence[] };
export const MemoryManager: React.FC<Props> = ({
  onMemoryChanged,
  projects = [],
}) => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<"pending" | "active" | "history">("pending");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sort, setSort] = useState<"updated" | "importance" | "confidence">("importance");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [editText, setEditText] = useState("");
  const [editImportance, setEditImportance] = useState(3);
  const [createOpen, setCreateOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newPredicate, setNewPredicate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Memory | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => void load(true), 250); return () => window.clearTimeout(timer); }, [tab, search, filterType, projectFilter, sort]);
  async function load(reset = true) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const page = await api.getMemoriesPage({ status: tab === "history" ? undefined : tab, view: tab === "history" ? "history" : undefined, type: filterType || undefined, projectId: projectFilter || undefined, query: search.trim() || undefined, sort, offset: reset ? 0 : memories.length, limit: 30 });
      setMemories((current) => reset ? page.memories : [...current, ...page.memories]);
      setHasMore(page.hasMore);
    } catch (error) {
      setErrorMessage(message(error, "Memory could not be loaded."));
    } finally {
      setLoading(false);
    }
  }
  async function runAction(
    id: string,
    action: () => Promise<void>,
    success: string,
  ) {
    if (busyId) return;
    setBusyId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await action();
      setSuccessMessage(success);
    } catch (error) {
      setErrorMessage(message(error, "Memory action failed."));
    } finally {
      setBusyId(null);
    }
  }
  async function approve(memory: Memory) {
    await runAction(
      memory.id,
      async () => {
        await api.approveMemory(memory.id, "User approved from memory inbox");
        await load();
        onMemoryChanged();
      },
      language === "ko"
        ? "Memory를 승인했습니다. 이후 모든 Provider의 Context에서 사용할 수 있습니다."
        : "Memory approved. It can now be used in context across providers.",
    );
  }
  async function reject(memory: Memory) {
    await runAction(
      memory.id,
      async () => {
        await api.rejectMemory(memory.id, "User rejected from memory inbox");
        await load();
        onMemoryChanged();
      },
      language === "ko"
        ? "Memory 후보를 거절했습니다."
        : "Memory candidate rejected.",
    );
  }
  async function archive() {
    const memory = archiveTarget;
    if (!memory) return;
    await runAction(
      memory.id,
      async () => {
        await api.deleteMemory(memory.id, "soft");
        await load();
        onMemoryChanged();
        setArchiveTarget(null);
      },
      language === "ko" ? "Memory를 보관 처리했습니다." : "Memory archived.",
    );
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
      setDetailsError(message(error, "Memory details could not be loaded."));
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
    await runAction(
      editing.id,
      async () => {
        await api.editAndApproveMemory(editing.id, {
          canonicalText: editText.trim(),
          importance: editImportance,
          changeReason: "User refined wording",
        });
        setEditing(null);
        await load();
        onMemoryChanged();
      },
      language === "ko"
        ? "Memory를 수정하고 승인했습니다."
        : "Memory updated and approved.",
    );
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!newText.trim()) return;
    await runAction(
      "create",
      async () => {
        await api.createMemory({
          type: "fact",
          subject: "user",
          predicate: newPredicate.trim() || "has_fact",
          canonicalText: newText.trim(),
          importance: 3,
          sensitivity: "low",
        });
        setCreateOpen(false);
        setNewText("");
        setNewPredicate("");
        setTab("active");
        onMemoryChanged();
      },
      language === "ko"
        ? "활성 Memory를 추가했습니다."
        : "Active memory added.",
    );
  }
  const visible = memories;
  const projectName = (id: string | null) =>
    id
      ? projects.find((project) => project.id === id)?.name ||
        (language === "ko" ? "삭제된 프로젝트" : "Deleted project")
      : language === "ko"
        ? "전역"
        : "Global";

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <div className="workspace-eyebrow">{t("memory.continuity")}</div>
          <h1 className="workspace-title">{t("memory.title")}</h1>
          <p className="workspace-subtitle">{t("memory.subtitle")}</p>
        </div>
        <button
          className="workspace-button workspace-button-primary"
          onClick={() => setCreateOpen(true)}
          disabled={Boolean(busyId)}
        >
          <Plus className="h-4 w-4" />
          {t("memory.add")}
        </button>
      </header>
      {(errorMessage || successMessage) && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${errorMessage ? "border-rose-900/60 bg-rose-950/30 text-rose-200" : "border-emerald-900/60 bg-emerald-950/20 text-emerald-300"}`}
          role={errorMessage ? "alert" : "status"}
        >
          <span>{errorMessage || successMessage}</span>
          <button
            aria-label={t("common.close")}
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          {(
            [
              ["pending", t("memory.pending")],
              ["active", t("memory.active")],
              ["history", t("memory.history")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-2 text-xs ${tab === id ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-600" />
          <input
            aria-label={t("memory.search")}
            className="workspace-input pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("memory.search")}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <select aria-label={language === "ko" ? "Memory 유형" : "Memory type"} className="workspace-input" value={filterType} onChange={(event) => setFilterType(event.target.value)}><option value="">{language === "ko" ? "모든 유형" : "All types"}</option>{["fact","preference","constraint","goal","project","relationship"].map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <select aria-label={language === "ko" ? "프로젝트 범위" : "Project scope"} className="workspace-input" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">{language === "ko" ? "모든 범위" : "All scopes"}</option><option value="global">{language === "ko" ? "전역만" : "Global only"}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select aria-label={language === "ko" ? "정렬" : "Sort"} className="workspace-input" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="importance">{language === "ko" ? "중요도순" : "Importance"}</option><option value="updated">{language === "ko" ? "최근 수정순" : "Recently updated"}</option><option value="confidence">{language === "ko" ? "신뢰도순" : "Confidence"}</option></select>
      </div>
      {tab === "pending" && (
        <div className="mt-4 flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs leading-5 text-neutral-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          <p>
            {language === "ko"
              ? "승인한 Memory는 현재 프로젝트 또는 전역 Context에 포함되며, 선택한 모든 AI Provider에 전달될 수 있습니다. 민감한 정보는 승인 전에 반드시 확인하세요."
              : "Approved memories enter project or global context and may be sent to any selected AI provider. Review sensitive information before approval."}
          </p>
        </div>
      )}
      <section className="workspace-section mt-4 overflow-hidden">
        <div className="workspace-section-header">
          <div>
            <h2 className="workspace-section-title">
              {tab === "pending"
                ? t("memory.reviewQueue")
                : tab === "active"
                  ? t("memory.activeView")
                  : t("memory.historyView")}
            </h2>
            <p className="workspace-section-copy">
              {visible.length}
              {t("memory.count")}
            </p>
          </div>
          <Brain className="h-4 w-4 text-neutral-600" />
        </div>
        {loading ? (
          <State text={t("memory.loading")} />
        ) : visible.length === 0 ? (
          <State text={t("memory.empty")} />
        ) : (
          <div className="divide-y divide-neutral-800">
            {visible.map((memory) => (
              <article
                key={memory.id}
                className="px-5 py-5 hover:bg-white/[.02]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge>{memory.type}</Badge>
                      <Badge>{projectName(memory.projectId)}</Badge>
                      <span className="text-[11px] text-neutral-600">
                        {memory.sourceKind.replaceAll("_", " ")}
                      </span>
                      <span className="text-[11px] text-neutral-600">
                        {t("memory.confidence")}{" "}
                        {Math.round(memory.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-neutral-200">
                      {memory.canonicalText}
                    </p>
                    <p className="mt-2 text-xs text-neutral-600">
                      {memory.subject} → {memory.predicate} ·{" "}
                      {new Date(memory.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge>{memory.status}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Action onClick={() => void openDetails(memory)}>
                    <FileText className="h-3.5 w-3.5" />
                    {t("common.details")}
                  </Action>
                  {memory.status === "pending" && (
                    <>
                      <Action
                        disabled={Boolean(busyId)}
                        onClick={() => beginEdit(memory)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {t("memory.edit")}
                      </Action>
                      <Action
                        disabled={Boolean(busyId)}
                        onClick={() => void reject(memory)}
                      >
                        <X className="h-3.5 w-3.5" />
                        {language === "ko" ? "거절" : "Reject"}
                      </Action>
                      <Action
                        primary
                        disabled={Boolean(busyId)}
                        onClick={() => void approve(memory)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {busyId === memory.id
                          ? t("common.loading")
                          : language === "ko"
                            ? "승인"
                            : "Approve"}
                      </Action>
                    </>
                  )}
                  {memory.status === "active" && (
                    <>
                      <Action
                        disabled={Boolean(busyId)}
                        onClick={() => beginEdit(memory)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {t("memory.edit")}
                      </Action>
                      <Action
                        disabled={Boolean(busyId)}
                        onClick={() => setArchiveTarget(memory)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {language === "ko" ? "보관" : "Archive"}
                      </Action>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {hasMore && !loading && <div className="flex justify-center border-t border-neutral-800 p-4"><button className="workspace-button" onClick={() => void load(false)}>{language === "ko" ? "더 불러오기" : "Load more"}</button></div>}
      </section>
      {editing && (
        <Modal
          title={language === "ko" ? "Memory 수정" : "Edit memory"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={saveEdit}>
            <textarea
              autoFocus
              className="workspace-input resize-y"
              rows={4}
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              required
            />
            <label className="mt-4 block text-xs text-neutral-400">
              Importance
              <input
                className="workspace-input mt-2"
                type="number"
                min={1}
                max={5}
                value={editImportance}
                onChange={(event) =>
                  setEditImportance(Number(event.target.value))
                }
              />
            </label>
            <Footer
              busy={Boolean(busyId)}
              t={t}
              close={() => setEditing(null)}
            />
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={language === "ko" ? "Memory 상세" : "Memory details"}
          onClose={() => setSelected(null)}
        >
          <p className="text-sm leading-6 text-neutral-200">
            {selected.canonicalText}
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            {projectName(selected.projectId)} ·{" "}
            {selected.sourceKind.replaceAll("_", " ")}
          </p>
          {detailsLoading ? (
            <State text={t("common.loading")} />
          ) : detailsError ? (
            <div className="mt-5 rounded-lg border border-rose-900/50 p-3 text-xs text-rose-300">
              {detailsError}
              <button
                className="ml-2 underline"
                onClick={() => void openDetails(selected)}
              >
                Retry
              </button>
            </div>
          ) : (
            details && (
              <>
                <Detail title={t("memory.evidence")}>
                  {details.evidence.length ? (
                    details.evidence.map((item) => (
                      <div
                        key={item.id}
                        className="mt-2 rounded-lg bg-neutral-950 p-3 text-xs text-neutral-400"
                      >
                        <p>“{item.snippet}”</p>
                        <p className="mt-2 font-mono text-[10px] text-neutral-700">
                          conversation {item.conversationId || '—'} · message {item.messageId}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-xs text-neutral-600">
                      {t("memory.noEvidence")}
                    </p>
                  )}
                </Detail>
                <Detail title={t("memory.revisions")}>
                  {details.revisions.map((item) => (
                    <p key={item.id} className="mt-2 text-xs text-neutral-500">
                      {item.previousStatus || "new"} → {item.newStatus} ·{" "}
                      {item.changeReason}
                    </p>
                  ))}
                </Detail>
              </>
            )
          )}
        </Modal>
      )}
      {createOpen && (
        <Modal
          title={t("memory.addTitle")}
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={create}>
            <label className="block text-xs text-neutral-400">
              {t("memory.statement")}
              <textarea
                autoFocus
                className="workspace-input mt-2"
                rows={4}
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-xs text-neutral-400">
              {t("memory.relationship")}
              <input
                className="workspace-input mt-2"
                value={newPredicate}
                onChange={(event) => setNewPredicate(event.target.value)}
              />
            </label>
            <Footer
              busy={Boolean(busyId)}
              t={t}
              close={() => setCreateOpen(false)}
            />
          </form>
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        busy={Boolean(busyId)}
        title={language === "ko" ? "Memory를 보관할까요?" : "Archive memory?"}
        description={
          language === "ko"
            ? "Context에서는 제외되지만 revision history에는 유지됩니다."
            : "It will leave model context but remain in revision history."
        }
        confirmLabel={language === "ko" ? "보관" : "Archive"}
        onClose={() => {
          if (!busyId) setArchiveTarget(null);
        }}
        onConfirm={() => void archive()}
      />
    </main>
  );
};

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-500">
    {children}
  </span>
);
const State = ({ text }: { text: string }) => (
  <div className="p-12 text-center text-sm text-neutral-600">{text}</div>
);
const Action = ({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) => (
  <button
    disabled={disabled}
    className={`workspace-button !px-2.5 !py-1.5 disabled:opacity-40 ${primary ? "workspace-button-primary" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);
const Detail = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mt-6 border-t border-neutral-800 pt-5">
    <h3 className="text-xs font-semibold text-neutral-300">{title}</h3>
    {children}
  </div>
);
const Footer = ({
  busy,
  t,
  close,
}: {
  busy: boolean;
  t: (key: string) => string;
  close: () => void;
}) => (
  <div className="mt-5 flex justify-end gap-2">
    <button
      type="button"
      disabled={busy}
      className="workspace-button"
      onClick={close}
    >
      {t("common.cancel")}
    </button>
    <button
      disabled={busy}
      className="workspace-button workspace-button-primary"
    >
      {busy ? t("common.loading") : t("common.save")}
    </button>
  </div>
);
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useDialogAccessibility(true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section ref={dialogRef} className="workspace-section max-h-[85vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="workspace-section-title">{title}</h2>
          <button
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-800"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
