import React, { useState, useEffect } from 'react';
import { Sparkles, Edit3, History, Check, Save, ShieldAlert } from 'lucide-react';
import type { Persona, PersonaRevision } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';

export const PersonaEditor: React.FC = () => {
  const { t } = useLanguage();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [revisions, setRevisions] = useState<PersonaRevision[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editTone, setEditTone] = useState('');
  const [editPrinciples, setEditPrinciples] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPersona();
  }, []);

  async function loadPersona() {
    try {
      const p = await api.getPersona();
      setPersona(p);
      const revs = await api.getPersonaRevisions();
      setRevisions(revs);
    } catch (err) {
      console.error('Failed to load persona', err);
    }
  }

  function startEditing() {
    if (!persona) return;
    setEditName(persona.name);
    setEditInstructions(persona.instructions);
    setEditTone(persona.toneAndManner);
    setEditPrinciples(persona.principles.join('\n'));
    setEditReason('Manual persona update');
    setIsEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const principlesArray = editPrinciples
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const updated = await api.updatePersona({
        name: editName.trim(),
        instructions: editInstructions.trim(),
        toneAndManner: editTone.trim(),
        principles: principlesArray,
        changeReason: editReason.trim() || 'User updated persona',
      });

      setPersona(updated);
      setIsEditing(false);
      const revs = await api.getPersonaRevisions();
      setRevisions(revs);
    } catch (err: any) {
      alert(`페르소나 저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (!persona) {
    return <div className="p-8 text-center text-xs text-slate-500">페르소나 정보 불러오는 중...</div>;
  }

  return (
    <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <span>{t('persona.title')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-mono">
              v{persona.version}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('persona.subtitle')}
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={startEditing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition self-start sm:self-auto"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('persona.edit')}</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">페르소나 지침 수정 (새 버전 생성)</h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              취소
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">페르소나 이름</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">변경 사유 (감사 로그용)</label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="예: 어조를 조금 더 직관적이고 분석적으로 변경"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">기본 지침 (System Instructions)</label>
            <textarea
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">어조 및 태도 (Tone & Manner)</label>
            <textarea
              value={editTone}
              onChange={(e) => setEditTone(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">핵심 원칙들 (줄바꿈으로 구분)</label>
            <textarea
              value={editPrinciples}
              onChange={(e) => setEditPrinciples(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>새 버전 저장 (v{persona.version + 1})</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Active Persona Overview */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Instructions</span>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed">{persona.instructions}</p>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Tone & Manner</span>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed">{persona.toneAndManner}</p>
              </div>

              <div className="border-t border-slate-800/80 pt-3">
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Core Principles</span>
                <ul className="mt-2 space-y-1.5">
                  {persona.principles.map((p, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                      <span className="text-sky-400 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Version History Sidebar */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-indigo-400" />
              <span>버전 변경 이력 (Revisions)</span>
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {revisions.map((rev) => (
                <div
                  key={rev.id}
                  className={`p-3 rounded-xl border text-xs ${
                    rev.version === persona.version
                      ? 'bg-sky-950/30 border-sky-800/50 text-slate-200'
                      : 'bg-slate-900 border-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sky-400 font-mono">v{rev.version}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{rev.changeReason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
