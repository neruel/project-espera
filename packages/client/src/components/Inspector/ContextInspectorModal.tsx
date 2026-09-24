import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ContextRun } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';
import { Modal } from '../Common/Modal.js';

interface ContextInspectorModalProps {
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContextInspectorModal({ conversationId, isOpen, onClose }: ContextInspectorModalProps) {
  const { t } = useLanguage();
  const [run, setRun] = useState<ContextRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRun(null);
    if (conversationId) void load(conversationId);
  }, [isOpen, conversationId]);

  async function load(id: string) {
    setLoading(true);
    setErrorMessage(null);
    try {
      setRun(await api.getContextRun(id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('inspector.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      title={t('inspector.title')}
      description={t('inspector.subtitle')}
      size="lg"
      onClose={onClose}
      footer={<button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>}
    >
      <div className="max-h-[60vh] space-y-6 overflow-y-auto">
        <p className="notice flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          {t('inspector.security')}
        </p>

        {loading ? (
          <p className="empty">{t('inspector.loading')}</p>
        ) : errorMessage ? (
          <div className="alert" role="alert">
            <span>{errorMessage}</span>
            {conversationId && (
              <button type="button" className="btn btn-sm btn-ghost !text-danger" onClick={() => void load(conversationId)}>{t('common.retry')}</button>
            )}
          </div>
        ) : !conversationId ? (
          <p className="empty">{t('inspector.chooseConversation')}</p>
        ) : !run ? (
          <div className="empty">
            <p className="text-fg-2">{t('inspector.empty')}</p>
            <p className="mt-1 text-sm text-fg-3">{t('inspector.emptyCopy')}</p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Meta label={t('inspector.provider')} value={`${run.providerId} / ${run.modelId}`} />
              <Meta label={t('inspector.persona')} value={`v${run.personaVersion}`} />
              <Meta label={t('inspector.memories')} value={String(run.selectedMemoryIds.length)} />
              <Meta label={t('inspector.tokens')} value={`~${run.tokenEstimate.toLocaleString()}`} />
            </dl>

            <section>
              <h3 className="section-title mb-2">{t('inspector.selection')}</h3>
              {run.selectedMemoryIds.length === 0 ? (
                <p className="text-sm text-fg-3">{t('inspector.noMemories')}</p>
              ) : (
                <ul className="list">
                  {run.selectedMemoryIds.map((id) => (
                    <li key={id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                      <span className="min-w-0 truncate font-mono text-[13px] text-fg">{id}</span>
                      <span className="text-fg-3">{run.selectionReasons[id] || t('inspector.defaultReason')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="section-title">{t('inspector.assembly')}</h3>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowFullPrompt((current) => !current)}>
                  {showFullPrompt ? t('inspector.showSummary') : t('inspector.showFull')}
                </button>
              </div>
              <pre className={`overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-5 text-fg-2 ${showFullPrompt ? 'max-h-96' : 'max-h-40'}`}>
                {run.assembledPrompt}
              </pre>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[13px] text-fg-3">{label}</dt>
      <dd className="mt-1 truncate font-mono text-sm text-fg" title={value}>{value}</dd>
    </div>
  );
}
