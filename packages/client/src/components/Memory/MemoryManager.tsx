import React, { useState, useEffect } from 'react';
import {
  Brain,
  Check,
  Edit2,
  X,
  Trash2,
  Plus,
  Clock,
  FileText,
  AlertCircle,
  Tag,
  Shield,
  Search,
} from 'lucide-react';
import type { Memory, MemoryEvidence, MemoryRevision } from '@espera/shared';
import { api } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';

interface MemoryManagerProps {
  onMemoryChanged: () => void;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({ onMemoryChanged }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Detail Modal State
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [detailRevisions, setDetailRevisions] = useState<MemoryRevision[]>([]);
  const [detailEvidence, setDetailEvidence] = useState<MemoryEvidence[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit Modal State
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editCanonicalText, setEditCanonicalText] = useState('');
  const [editImportance, setEditImportance] = useState(3);
  const [editChangeReason, setEditChangeReason] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Create Manual Memory Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newType, setNewType] = useState('fact');
  const [newSubject, setNewSubject] = useState('사용자');
  const [newPredicate, setNewPredicate] = useState('');
  const [newText, setNewText] = useState('');
  const [newImportance, setNewImportance] = useState(3);

  useEffect(() => {
    loadMemories();
  }, [tab]);

  async function loadMemories() {
    setIsLoading(true);
    try {
      let statusQuery = '';
      if (tab === 'pending') statusQuery = 'pending';
      else if (tab === 'active') statusQuery = 'active';

      const list = await api.getMemories(statusQuery);
      if (tab === 'history') {
        setMemories(list.filter((m) => m.status === 'rejected' || m.status === 'superseded' || m.status === 'deleted'));
      } else {
        setMemories(list);
      }
    } catch (err) {
      console.error('Failed to load memories', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await api.approveMemory(id, 'User approved from memory inbox');
      await loadMemories();
      onMemoryChanged();
    } catch (err: any) {
      alert(`승인 실패: ${err.message}`);
    }
  }

  async function handleReject(id: string) {
    try {
      await api.rejectMemory(id, 'User rejected from memory inbox');
      await loadMemories();
      onMemoryChanged();
    } catch (err: any) {
      alert(`거절 실패: ${err.message}`);
    }
  }

  async function handleDelete(id: string, mode: 'soft' | 'hard') {
    if (!confirm(mode === 'hard' ? '이 기억을 영구 삭제하시겠습니까?' : '이 기억을 비활성화하시겠습니까?')) {
      return;
    }
    try {
      await api.deleteMemory(id, mode);
      await loadMemories();
      onMemoryChanged();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  }

  async function openDetailModal(memory: Memory) {
    setSelectedMemory(memory);
    setIsDetailOpen(true);
    try {
      const details = await api.getMemoryDetails(memory.id);
      setDetailRevisions(details.revisions || []);
      setDetailEvidence(details.evidence || []);
    } catch (err) {
      console.error('Failed to fetch details', err);
    }
  }

  function openEditModal(memory: Memory) {
    setEditingMemory(memory);
    setEditCanonicalText(memory.canonicalText);
    setEditImportance(memory.importance);
    setEditChangeReason('User refined wording');
    setIsEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMemory || !editCanonicalText.trim()) return;

    try {
      await api.editAndApproveMemory(editingMemory.id, {
        canonicalText: editCanonicalText.trim(),
        importance: editImportance,
        changeReason: editChangeReason.trim() || 'User manual edit',
      });
      setIsEditOpen(false);
      await loadMemories();
      onMemoryChanged();
    } catch (err: any) {
      alert(`수정 실패: ${err.message}`);
    }
  }

  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    if (!newPredicate.trim() || !newText.trim()) return;

    try {
      await api.createMemory({
        type: newType,
        subject: newSubject.trim(),
        predicate: newPredicate.trim(),
        canonicalText: newText.trim(),
        importance: newImportance,
        sensitivity: 'low',
      });
      setIsCreateOpen(false);
      setNewPredicate('');
      setNewText('');
      setTab('active');
      await loadMemories();
      onMemoryChanged();
    } catch (err: any) {
      alert(`기억 생성 실패: ${err.message}`);
    }
  }

  const filtered = memories.filter(
    (m) =>
      m.canonicalText.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      m.predicate.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full overflow-y-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Brain className="w-5 h-5 text-sky-400" />
            <span>{t('memory.title')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('memory.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow self-start sm:self-auto transition"
        >
          <Plus className="w-4 h-4" />
          <span>{t('memory.add')}</span>
        </button>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 my-6">
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              tab === 'pending'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📥 {t('memory.pending')}
          </button>
          <button
            onClick={() => setTab('active')}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              tab === 'active'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧠 {t('memory.active')}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-3 py-2 rounded-lg font-medium transition ${
              tab === 'history'
                ? 'bg-slate-800 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🗄️ {t('memory.history')}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('memory.search')}
            className="w-full sm:w-64 pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Memory List Cards */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">기억 목록 불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
          표시할 기억 항목이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between transition ${
                m.status === 'pending'
                  ? 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700/60'
                  : m.status === 'active'
                  ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950 border-slate-800/50 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                      {m.type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      중요도: <strong className="text-amber-400">{'★'.repeat(m.importance)}</strong>
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      m.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : m.status === 'pending'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-100 leading-relaxed mb-3">
                  {m.canonicalText}
                </p>

                <div className="text-[11px] text-slate-400 space-y-1 mb-4">
                  <div>
                    <span className="text-slate-500">속성: </span>
                    <code className="text-sky-300 font-mono">{m.subject}</code> &rarr;{' '}
                    <code className="text-indigo-300 font-mono">{m.predicate}</code>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <button
                  onClick={() => openDetailModal(m)}
                  className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center space-x-1"
                >
                  <FileText className="w-3 h-3" />
                  <span>출처/이력</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  {m.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openEditModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center space-x-1 border border-slate-700 transition"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>수정</span>
                      </button>
                      <button
                        onClick={() => handleReject(m.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] flex items-center space-x-1 border border-rose-800/50 transition"
                      >
                        <X className="w-3 h-3" />
                        <span>거절</span>
                      </button>
                      <button
                        onClick={() => handleApprove(m.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center space-x-1 shadow transition"
                      >
                        <Check className="w-3 h-3" />
                        <span>승인</span>
                      </button>
                    </>
                  )}

                  {m.status === 'active' && (
                    <>
                      <button
                        onClick={() => openEditModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center space-x-1 border border-slate-700 transition"
                      >
                        <Edit2 className="w-3 h-3 text-sky-400" />
                        <span>수정</span>
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, 'soft')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-[11px] border border-slate-700 transition"
                        title="기억 비활성화"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit & Approve Modal */}
      {isEditOpen && editingMemory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <span>기억 수정 및 승인</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">정규화된 사실 문장 (Canonical Text)</label>
              <textarea
                value={editCanonicalText}
                onChange={(e) => setEditCanonicalText(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">중요도 (1~5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={editImportance}
                  onChange={(e) => setEditImportance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">수정 사유</label>
                <input
                  type="text"
                  value={editChangeReason}
                  onChange={(e) => setEditChangeReason(e.target.value)}
                  placeholder="예: 문장 표현 명확화"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow"
              >
                수정 후 활성화
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Details & Revisions Audit Modal */}
      {isDetailOpen && selectedMemory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>기억 상세 및 감사 이력</span>
              </h3>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Canonical Statement</span>
              <p className="text-xs text-slate-200 mt-1 font-medium">{selectedMemory.canonicalText}</p>
            </div>

            {/* Evidence snippets */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>추출 근거 대화 스니펫 (Evidence)</span>
              </h4>
              {detailEvidence.length === 0 ? (
                <p className="text-xs text-slate-500 italic">등록된 직접 대화 근거가 없습니다.</p>
              ) : (
                detailEvidence.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                    "{ev.snippet}"
                  </div>
                ))
              )}
            </div>

            {/* Revisions timeline */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>변경 및 승인 이력 (Revisions Log)</span>
              </h4>
              <div className="space-y-2">
                {detailRevisions.map((rev) => (
                  <div key={rev.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-sky-400">
                        {rev.previousStatus || 'none'} &rarr; {rev.newStatus}
                      </span>
                      <span>{new Date(rev.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{rev.changeReason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Memory Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateManual}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-sky-400" />
                <span>수동 기억 직접 등록</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">유형</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                >
                  <option value="fact">fact (사실)</option>
                  <option value="project">project (프로젝트)</option>
                  <option value="preference">preference (선호도)</option>
                  <option value="constraint">constraint (제약조건)</option>
                  <option value="goal">goal (목표)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">속성명 (Predicate)</label>
                <input
                  type="text"
                  value={newPredicate}
                  onChange={(e) => setNewPredicate(e.target.value)}
                  placeholder="예: 관심 기술 스택"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">정규 문장 (Canonical Text)</label>
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="예: 사용자는 Cloudflare 생태계와 Rust에 관심이 많다."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow"
              >
                즉시 활성 등록
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
