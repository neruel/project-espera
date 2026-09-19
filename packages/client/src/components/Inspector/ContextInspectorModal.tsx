import React, { useState, useEffect } from 'react';
import { Terminal, X, ShieldAlert, Cpu, Database, Eye, Layers } from 'lucide-react';
import type { ContextRun } from '@espera/shared';
import { api } from '../../services/api.js';

interface ContextInspectorModalProps {
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ContextInspectorModal: React.FC<ContextInspectorModalProps> = ({
  conversationId,
  isOpen,
  onClose,
}) => {
  const [run, setRun] = useState<ContextRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadContextRun(conversationId);
    }
  }, [isOpen, conversationId]);

  async function loadContextRun(convId: string) {
    setIsLoading(true);
    try {
      const data = await api.getContextRun(convId);
      setRun(data);
    } catch (err) {
      console.error('Failed to load context run', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-sky-950 border border-sky-800 text-sky-400 font-mono">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Developer Context Inspector</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  Read-Only Audit Log
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                대화 시점에 LLM으로 실제 전달된 컨텍스트 구성 및 메모리 선택 이유를 검사합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div className="bg-emerald-950/20 border-b border-emerald-900/30 px-5 py-2 flex items-center space-x-2 text-[11px] text-emerald-300">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>보안 불변식: 본 인스펙터에는 API Key 및 민감한 자격 증명이 절대 노출되지 않습니다.</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">인스펙터 스냅샷 로드 중...</div>
          ) : !run ? (
            <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              이 대화에는 아직 기록된 Context Run 스냅샷이 없습니다. 메시지를 1회 이상 전송해주세요.
            </div>
          ) : (
            <>
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Provider & Model</span>
                  <span className="font-semibold text-sky-400 mt-1 block font-mono truncate">
                    {run.providerId} / {run.modelId}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Persona Version</span>
                  <span className="font-semibold text-indigo-400 mt-1 block font-mono">
                    v{run.personaVersion}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Selected Memories</span>
                  <span className="font-semibold text-amber-400 mt-1 block font-mono">
                    {run.selectedMemoryIds.length}건
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Estimated Tokens</span>
                  <span className="font-semibold text-emerald-400 mt-1 block font-mono">
                    ~{run.tokenEstimate.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Memory Selection Reasons */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>주입된 활성 기억 목록 및 선택 사유</span>
                </h3>

                {run.selectedMemoryIds.length === 0 ? (
                  <p className="text-slate-500 text-[11px] italic">
                    선택된 활성 기억이 없습니다. (질문과 연관된 활성 기억이 없거나 예산 초과)
                  </p>
                ) : (
                  <div className="space-y-2">
                    {run.selectedMemoryIds.map((id) => (
                      <div
                        key={id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <span className="font-mono text-sky-300 text-[11px]">{id}</span>
                        <span className="text-slate-400 text-[11px] font-mono">
                          사유: <strong className="text-slate-200">{run.selectionReasons[id] || 'default_active'}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assembled Prompt Preview */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>합성된 시스템 프롬프트 (Prompt Assembly)</span>
                  </h3>
                  <button
                    onClick={() => setShowFullPrompt(!showFullPrompt)}
                    className="text-[11px] text-sky-400 hover:text-sky-300"
                  >
                    {showFullPrompt ? '간략히 보기' : '전체 펼치기'}
                  </button>
                </div>

                <div
                  className={`bg-slate-900 border border-slate-800/80 rounded-lg p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap ${
                    showFullPrompt ? 'max-h-96' : 'max-h-36'
                  } overflow-y-auto`}
                >
                  {run.assembledPrompt}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
