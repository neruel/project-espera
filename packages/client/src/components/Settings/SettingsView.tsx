import React, { useState } from "react";
import {
  Check,
  Key,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import type { ModelDescriptor } from "@espera/shared";
import type { ProviderInfo } from "../../services/api.js";
import { api } from "../../services/api.js";
import type { ProviderConnection, SessionState } from "../../stores/session.js";
import { useLanguage } from "../../i18n.js";
import { ConfirmDialog } from "../Common/ConfirmDialog.js";

interface Props {
  session: SessionState;
  onUpdateSession: (patch: Partial<SessionState>) => void;
  providers: ProviderInfo[];
}

export const SettingsView: React.FC<Props> = ({
  session,
  onUpdateSession,
  providers,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [providerId, setProviderId] = useState("openai-compatible");
  const [name, setName] = useState("Local API connection");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [key, setKey] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [rememberCredential, setRememberCredential] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderConnection | null>(
    null,
  );
  const definition = providers.find((provider) => provider.id === providerId);

  function changeProvider(id: string) {
    setProviderId(id);
    setBaseUrl(
      providers.find((provider) => provider.id === id)?.defaultBaseUrl || "",
    );
    setModels([]);
    setStatus("");
    setRememberCredential(false);
  }

  async function discoverModels() {
    if (providerId !== "mock" && !key) {
      setStatus(t("settings.requiredDiscovery"));
      return;
    }
    setBusy(true);
    setStatus(t("settings.loadingModels"));
    try {
      const discovered =
        providerId === "mock"
          ? definition?.models || []
          : await api.listModels(providerId, key, baseUrl || undefined);
      setModels(discovered);
      setStatus(`${discovered.length} ${t("settings.modelsLoaded")}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Model discovery failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveConnection() {
    const existing = editingId
      ? session.connections.find((connection) => connection.id === editingId)
      : undefined;
    if (providerId !== "mock" && !key && !existing?.credentialStored) {
      setStatus(t("settings.requiredDiscovery"));
      return;
    }
    const manual = manualModel.trim()
      ? [
          {
            id: manualModel.trim(),
            name: manualModel.trim(),
            contextWindow: 0,
            supportsStreaming: true,
          },
        ]
      : [];
    const allModels = [
      ...models,
      ...manual.filter((item) => !models.some((model) => model.id === item.id)),
    ];
    if (!allModels.length) {
      setStatus(t("settings.discoverFirst"));
      return;
    }
    setBusy(true);
    try {
      const id = editingId || crypto.randomUUID();
      const persisted = await api.saveProviderConnection({
        id,
        name: name.trim() || providerId,
        providerId,
        baseUrl: baseUrl.trim() || undefined,
        models: allModels,
        credential: key
          ? { apiKey: key, endpointUrl: baseUrl.trim() || undefined }
          : undefined,
        rememberCredential,
      });
      const connection: ProviderConnection = persisted;
      const connections = editingId
        ? session.connections.map((item) =>
            item.id === id ? connection : item,
          )
        : [...session.connections, connection];
      onUpdateSession({
        connections,
        apiKeys: key ? { ...session.apiKeys, [id]: key } : session.apiKeys,
        connectionId: id,
        providerId,
        modelId: allModels[0].id,
      });
      setKey("");
      setManualModel("");
      setRememberCredential(false);
      setEditingId(null);
      setStatus(
        language === "ko"
          ? rememberCredential
            ? "연결과 암호화된 Key가 저장되었습니다."
            : "연결이 저장되었습니다. Key는 현재 탭에서만 사용됩니다."
          : rememberCredential
            ? "Connection and encrypted key saved."
            : "Connection saved. The key remains in this tab only.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Connection could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function editConnection(connection: ProviderConnection) {
    setEditingId(connection.id);
    setProviderId(connection.providerId);
    setName(connection.name);
    setBaseUrl(connection.baseUrl || "");
    setModels(connection.models);
    setManualModel("");
    setKey("");
    setRememberCredential(Boolean(connection.credentialStored));
    setStatus(
      language === "ko"
        ? "연결 정보를 수정 중입니다. 저장된 Key를 유지하려면 비워 두세요."
        : "Editing connection. Leave the key empty to keep the saved credential.",
    );
    document
      .querySelector(".settings-scroll")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setModels([]);
    setKey("");
    setRememberCredential(false);
    setStatus("");
  }

  async function revalidateConnection(connection: ProviderConnection) {
    if (!connection.credentialStored) {
      editConnection(connection);
      setStatus(
        language === "ko"
          ? "검증하려면 API Key를 다시 입력하고 모델 조회를 실행하세요."
          : "Enter the API key and discover models to validate this connection.",
      );
      return;
    }
    setBusy(true);
    setStatus(
      language === "ko"
        ? "저장된 Key로 연결을 확인하는 중…"
        : "Validating with the saved key…",
    );
    try {
      const result = await api.validateSavedProviderConnection(connection.id);
      setStatus(
        result.isValid
          ? language === "ko"
            ? "연결이 정상입니다."
            : "Connection is valid."
          : language === "ko"
            ? "연결 검증에 실패했습니다."
            : "Connection validation failed.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Connection validation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function removeConnection(id: string) {
    const connection = session.connections.find((item) => item.id === id);
    if (connection) setDeleteTarget(connection);
  }

  async function confirmRemoveConnection() {
    const id = deleteTarget?.id;
    if (!id || busy) return;
    setBusy(true);
    try {
      await api.deleteProviderConnection(id);
      const apiKeys = { ...session.apiKeys };
      delete apiKeys[id];
      const remaining = session.connections.filter(
        (connection) => connection.id !== id,
      );
      const next =
        session.connectionId === id
          ? remaining[0]
          : session.connections.find(
              (connection) => connection.id === session.connectionId,
            );
      onUpdateSession(
        next
          ? {
              connections: remaining,
              apiKeys,
              connectionId: next.id,
              providerId: next.providerId,
              modelId: next.models[0]?.id || "default",
            }
          : {
              connections: remaining,
              apiKeys,
              connectionId: "mock",
              providerId: "mock",
              modelId: "mock-model-a",
            },
      );
      setStatus(
        language === "ko" ? "연결이 삭제되었습니다." : "Connection deleted.",
      );
      setDeleteTarget(null);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Connection could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  function selectConnection(connection: ProviderConnection) {
    onUpdateSession({
      connectionId: connection.id,
      providerId: connection.providerId,
      modelId: connection.models[0]?.id || "default",
    });
    setStatus(
      language === "ko"
        ? `${connection.name} 연결을 선택했습니다.`
        : `${connection.name} selected.`,
    );
  }

  return (
    <main className="workspace-page settings-page">
      <header className="workspace-header">
        <div>
          <div className="workspace-eyebrow">{t("settings.control")}</div>
          <h1 className="workspace-title">{t("settings.title")}</h1>
          <p className="workspace-subtitle">{t("settings.subtitle")}</p>
        </div>
        <Sliders className="mt-1 h-5 w-5 text-neutral-600" />
      </header>
      <div className="settings-scroll">
        <div className="space-y-6">
          <section className="workspace-section">
            <div className="workspace-section-header">
              <div>
                <h2 className="workspace-section-title">
                  {t("settings.language")}
                </h2>
                <p className="workspace-section-copy">
                  {t("settings.language.help")}
                </p>
              </div>
              <div
                className="flex rounded-lg border border-neutral-700 bg-neutral-950 p-1"
                role="group"
                aria-label={t("settings.language")}
              >
                <button
                  type="button"
                  onClick={() => setLanguage("ko")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${language === "ko" ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"}`}
                >
                  {t("settings.korean")}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${language === "en" ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"}`}
                >
                  {t("settings.english")}
                </button>
              </div>
            </div>
          </section>
          <section className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
            <div>
              <p className="text-xs font-medium text-neutral-200">
                {t("settings.keyTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {language === "ko"
                  ? "기본적으로 API Key는 현재 탭에서만 사용됩니다. 아래에서 선택하면 계정에 암호화하여 저장할 수 있습니다."
                  : "API keys are used only in this tab by default. You can opt in to encrypted account storage below."}
              </p>
            </div>
          </section>
          <section className="workspace-section">
            <div className="workspace-section-header">
              <div>
                <h2 className="workspace-section-title">
                  {editingId
                    ? language === "ko"
                      ? "연결 수정"
                      : "Edit connection"
                    : t("settings.addConnection")}
                </h2>
                <p className="workspace-section-copy">
                  {editingId
                    ? language === "ko"
                      ? "이름, endpoint, 모델과 자격 증명을 다시 검증할 수 있습니다."
                      : "Update metadata, endpoint, models, and credentials."
                    : t("settings.addCopy")}
                </p>
                <p className="mt-2 text-[11px] text-neutral-600">
                  {t("settings.compatibleHint")}
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  className="workspace-button"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" />
                  {t("common.cancel")}
                </button>
              )}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-400">
                {t("settings.provider")}
                <select
                  aria-label={t("settings.provider")}
                  className="workspace-input mt-2"
                  value={providerId}
                  onChange={(event) => changeProvider(event.target.value)}
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-neutral-400">
                {t("settings.connectionName")}
                <input
                  className="workspace-input mt-2"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-neutral-400 sm:col-span-2">
                {t("settings.baseUrl")}
                <input
                  className="workspace-input mt-2 font-mono"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-400 sm:col-span-2">
                <Key className="mr-1 inline h-3 w-3" />
                {t("settings.apiKey")}
                <input
                  aria-label={t("settings.apiKey")}
                  type="password"
                  autoComplete="off"
                  className="workspace-input mt-2 font-mono"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder={
                    providerId === "mock"
                      ? t("settings.notRequiredMock")
                      : t("settings.requiredDiscovery")
                  }
                />
              </label>
              <label className="block text-xs font-medium text-neutral-400 sm:col-span-2">
                {t("settings.manualModel")}
                <input
                  className="workspace-input mt-2 font-mono"
                  value={manualModel}
                  onChange={(event) => setManualModel(event.target.value)}
                  placeholder={t("settings.manualModelHint")}
                />
              </label>
              {providerId !== "mock" && (
                <label className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={rememberCredential}
                    onChange={(event) =>
                      setRememberCredential(event.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-medium">
                      {language === "ko"
                        ? "계정에 API Key 기억하기"
                        : "Remember this API key on my account"}
                    </span>
                    <span className="mt-1 block leading-5 text-neutral-600">
                      {language === "ko"
                        ? "Worker Secret으로 암호화해 저장하고 로그인 후 자동으로 사용합니다."
                        : "The key is encrypted with a server secret and used automatically after login."}
                    </span>
                  </span>
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-neutral-800 px-5 py-4">
              <button
                className="workspace-button"
                disabled={busy || (!key && providerId !== "mock")}
                onClick={() => void discoverModels()}
              >
                <RefreshCw
                  className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />{" "}
                {t("settings.discover")}
              </button>
              <button
                className="workspace-button workspace-button-primary"
                disabled={
                  busy ||
                  (providerId !== "mock" &&
                    !key &&
                    !session.connections.find((item) => item.id === editingId)
                      ?.credentialStored)
                }
                onClick={() => void saveConnection()}
              >
                {editingId ? t("common.save") : t("settings.save")}
              </button>
              {status && (
                <p
                  className="self-center text-xs text-neutral-400"
                  role="status"
                >
                  {status}
                </p>
              )}
            </div>
            {models.length > 0 && (
              <div className="mx-5 mb-5 max-h-48 overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-400">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className="border-b border-neutral-800 px-2 py-2 last:border-0"
                  >
                    <span className="text-neutral-200">{model.name}</span>
                    <span className="ml-2 font-mono text-neutral-600">
                      {model.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="workspace-section">
            <div className="workspace-section-header">
              <div>
                <h2 className="workspace-section-title">
                  {t("settings.saved")}
                </h2>
                <p className="workspace-section-copy">
                  {t("settings.savedCopy")}
                </p>
              </div>
            </div>
            {session.connections.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">
                {t("settings.none")}
              </p>
            ) : (
              <div className="divide-y divide-neutral-800">
                {session.connections.map((connection) => (
                  <div
                    key={connection.id}
                    className={`flex items-start justify-between gap-4 px-5 py-4 ${editingId === connection.id ? "bg-neutral-800/40" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-100">
                        {connection.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {connection.providerId} · {connection.models.length}{" "}
                        models · {connection.baseUrl || "default endpoint"}
                      </p>
                      <p className="mt-2 text-[11px] text-neutral-600">
                        {connection.credentialStored
                          ? language === "ko"
                            ? "계정에 암호화 저장됨"
                            : "Encrypted key saved to account"
                          : session.apiKeys[connection.id]
                            ? t("settings.keyAvailable")
                            : t("settings.keyRequired")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg p-2 text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40"
                        title={
                          language === "ko"
                            ? "연결 검증"
                            : "Validate connection"
                        }
                        aria-label={`${language === "ko" ? "연결 검증" : "Validate"} ${connection.name}`}
                        onClick={() => void revalidateConnection(connection)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg p-2 text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40"
                        aria-label={`${language === "ko" ? "수정" : "Edit"} ${connection.name}`}
                        onClick={() => editConnection(connection)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={`rounded-lg px-2.5 py-2 text-xs transition ${session.connectionId === connection.id ? "bg-emerald-950/60 text-emerald-300" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"} disabled:opacity-40`}
                        onClick={() => selectConnection(connection)}
                      >
                        {session.connectionId === connection.id ? (
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                        ) : null}
                        {session.connectionId === connection.id
                          ? language === "ko"
                            ? "사용 중"
                            : "Active"
                          : language === "ko"
                            ? "사용"
                            : "Use"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg p-2 text-neutral-600 transition hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                        aria-label={`${t("common.delete")} ${connection.name}`}
                        onClick={() => void removeConnection(connection.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={busy}
        title={
          language === "ko"
            ? "Provider 연결을 삭제할까요?"
            : "Delete provider connection?"
        }
        description={
          language === "ko"
            ? "연결 정보와 계정에 암호화해 저장한 API Key가 함께 삭제됩니다."
            : "Connection metadata and any encrypted API key saved to the account will be deleted."
        }
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmRemoveConnection()}
      />
    </main>
  );
};
