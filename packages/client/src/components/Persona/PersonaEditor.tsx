import React, { useEffect, useState } from "react";
import { Edit3, History, RotateCcw, Save, Sparkles, X } from "lucide-react";
import type { Persona, PersonaRevision } from "@espera/shared";
import { api } from "../../services/api.js";
import { useLanguage } from "../../i18n.js";
import { ConfirmDialog } from "../Common/ConfirmDialog.js";
import { useDialogAccessibility } from "../Common/useDialogAccessibility.js";

export const PersonaEditor: React.FC = () => {
  const { t, language } = useLanguage();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [revisions, setRevisions] = useState<PersonaRevision[]>([]);
  const [selectedRevision, setSelectedRevision] =
    useState<PersonaRevision | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PersonaRevision | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    instructions: "",
    tone: "",
    principles: "",
    reason: "",
  });
  const revisionDialogRef = useDialogAccessibility(Boolean(selectedRevision), () => setSelectedRevision(null));

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setErrorMessage(null);
    try {
      const [current, history] = await Promise.all([
        api.getPersona(),
        api.getPersonaRevisions(),
      ]);
      setPersona(current);
      setRevisions(history);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Persona could not be loaded.",
      );
    }
  }
  function startEditing() {
    if (!persona) return;
    setForm({
      name: persona.name,
      instructions: persona.instructions,
      tone: persona.toneAndManner,
      principles: persona.principles.join("\n"),
      reason: language === "ko" ? "사용자 직접 수정" : "Manual persona update",
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
        principles: form.principles
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        changeReason: form.reason.trim(),
      });
      setPersona(updated);
      setRevisions(await api.getPersonaRevisions());
      setEditing(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Persona could not be saved.",
      );
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Persona revision could not be restored.",
      );
    } finally {
      setSaving(false);
    }
  }
  const setField =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  if (!persona)
    return (
      <main className="workspace-page">
        {errorMessage ? (
          <div
            className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
            role="alert"
          >
            {errorMessage}
            <button className="ml-3 underline" onClick={() => void load()}>
              {language === "ko" ? "다시 시도" : "Retry"}
            </button>
          </div>
        ) : (
          <div className="workspace-muted">{t("common.loading")}</div>
        )}
      </main>
    );
  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <div className="workspace-eyebrow">{t("persona.identity")}</div>
          <h1 className="workspace-title">
            {t("persona.title")}{" "}
            <span className="ml-2 align-middle rounded-full border border-neutral-700 px-2 py-1 text-xs font-normal text-neutral-500">
              v{persona.version}
            </span>
          </h1>
          <p className="workspace-subtitle">{t("persona.subtitle")}</p>
        </div>
        {!editing && (
          <button
            className="workspace-button workspace-button-primary"
            onClick={startEditing}
          >
            <Edit3 className="h-4 w-4" />
            {t("persona.edit")}
          </button>
        )}
      </header>
      {errorMessage && (
        <div
          className="mt-4 rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      {editing ? (
        <form onSubmit={save} className="workspace-section mt-7 p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="workspace-section-title">
                {t("persona.editTitle")}
              </h2>
              <p className="workspace-section-copy">{t("persona.editCopy")}</p>
            </div>
            <button
              type="button"
              disabled={saving}
              className="workspace-button"
              onClick={() => setEditing(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("persona.name")}
              value={form.name}
              onChange={setField("name")}
            />
            <Field
              label={t("persona.reason")}
              value={form.reason}
              onChange={setField("reason")}
            />
            <Area
              label={t("persona.instructions")}
              value={form.instructions}
              onChange={setField("instructions")}
              rows={4}
            />
            <Area
              label={t("persona.tone")}
              value={form.tone}
              onChange={setField("tone")}
              rows={3}
            />
            <Area
              label={t("persona.principles")}
              value={form.principles}
              onChange={setField("principles")}
              rows={5}
              mono
            />
          </div>
          <div className="mt-6 flex justify-end border-t border-neutral-800 pt-5">
            <button
              className="workspace-button workspace-button-primary"
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving
                ? t("common.loading")
                : `${t("persona.saveRevision")} v${persona.version + 1}`}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="workspace-section p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800">
                <Sparkles className="h-4 w-4 text-neutral-200" />
              </div>
              <div>
                <h2 className="workspace-section-title">
                  {t("persona.previewTitle")}
                </h2>
                <p className="workspace-section-copy">
                  {t("persona.previewCopy")}
                </p>
              </div>
            </div>
            <PersonaContent
              instructions={persona.instructions}
              tone={persona.toneAndManner}
              principles={persona.principles}
              t={t}
            />
          </section>
          <aside className="workspace-section h-fit">
            <div className="workspace-section-header">
              <div>
                <h2 className="workspace-section-title">
                  {t("persona.revisions")}
                </h2>
                <p className="workspace-section-copy">
                  {language === "ko"
                    ? "버전을 선택해 내용을 비교하세요."
                    : "Select a version to compare."}
                </p>
              </div>
              <History className="h-4 w-4 text-neutral-600" />
            </div>
            <div className="max-h-96 divide-y divide-neutral-800 overflow-y-auto">
              {revisions.map((revision) => (
                <button
                  key={revision.id}
                  className="block w-full px-4 py-4 text-left hover:bg-neutral-800/50"
                  onClick={() => setSelectedRevision(revision)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200">
                      v{revision.version}
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      {new Date(revision.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {revision.changeReason}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
      {selectedRevision && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Persona version ${selectedRevision.version}`}
        >
          <section ref={revisionDialogRef} className="workspace-section max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="workspace-section-title">
                  v{selectedRevision.version}
                </h2>
                <p className="workspace-section-copy">
                  {selectedRevision.changeReason}
                </p>
              </div>
              <button
                aria-label={t("common.close")}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-800"
                onClick={() => setSelectedRevision(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5">
              <PersonaContent
                instructions={selectedRevision.instructions}
                tone={selectedRevision.toneAndManner}
                principles={selectedRevision.principles}
                t={t}
              />
            </div>
            <div className="mt-6 flex justify-end border-t border-neutral-800 pt-4">
              <button
                disabled={saving}
                className="workspace-button workspace-button-primary"
                onClick={() => setRestoreTarget(selectedRevision)}
              >
                <RotateCcw className="h-4 w-4" />
                {language === "ko" ? "이 버전 복원" : "Restore this version"}
              </button>
            </div>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        danger={false}
        busy={saving}
        title={
          language === "ko"
            ? `v${restoreTarget?.version}을 복원할까요?`
            : `Restore v${restoreTarget?.version}?`
        }
        description={
          language === "ko"
            ? "선택한 내용으로 새 revision을 생성하며 기존 이력은 유지됩니다."
            : "A new revision is created and existing history is preserved."
        }
        confirmLabel={language === "ko" ? "복원" : "Restore"}
        onClose={() => {
          if (!saving) setRestoreTarget(null);
        }}
        onConfirm={() => void restore()}
      />
    </main>
  );
};

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) => (
  <label className="block text-xs font-medium text-neutral-400">
    {label}
    <input
      className="workspace-input mt-2"
      value={value}
      onChange={onChange}
      required
    />
  </label>
);
const Area = ({
  label,
  value,
  onChange,
  rows,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  rows: number;
  mono?: boolean;
}) => (
  <label className="block text-xs font-medium text-neutral-400 sm:col-span-2">
    {label}
    <textarea
      className={`workspace-input mt-2 resize-y ${mono ? "font-mono" : ""}`}
      rows={rows}
      value={value}
      onChange={onChange}
      required
    />
  </label>
);
function PersonaContent({
  instructions,
  tone,
  principles,
  t,
}: {
  instructions: string;
  tone: string;
  principles: string[];
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="workspace-eyebrow">{t("persona.instructions")}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-200">
          {instructions}
        </p>
      </div>
      <div className="border-t border-neutral-800 pt-5">
        <div className="workspace-eyebrow">{t("persona.tone")}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
          {tone}
        </p>
      </div>
      <div className="border-t border-neutral-800 pt-5">
        <div className="workspace-eyebrow">{t("persona.principles")}</div>
        <ul className="mt-3 space-y-2">
          {principles.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex gap-3 text-sm leading-6 text-neutral-300"
            >
              <span className="text-neutral-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
