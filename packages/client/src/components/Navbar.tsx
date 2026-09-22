import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Check,
  FolderKanban,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '@espera/shared';
import type { SessionState } from '../stores/session.js';
import type { AuthState } from '../services/api.js';
import { AccountMenu } from './Account/AccountMenu.js';
import { api } from '../services/api.js';
import { useLanguage } from '../i18n.js';
import { ConfirmDialog } from './Common/ConfirmDialog.js';

interface NavbarProps {
  currentTab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings';
  onSelectTab: (tab: NavbarProps['currentTab']) => void;
  pendingCount: number;
  session: SessionState;
  conversations: Conversation[];
  activeConversationId: string | null;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (conversation: Conversation) => Promise<void>;
  onConversationsChange: (conversations: Conversation[]) => void;
  auth: AuthState;
  onLoggedOut: () => void;
}

const navItems = [
  { id: 'projects', icon: FolderKanban, key: 'nav.projects' },
  { id: 'memory', icon: Brain, key: 'nav.memory' },
  { id: 'persona', icon: Sparkles, key: 'nav.persona' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  session,
  conversations,
  activeConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onConversationsChange,
  auth,
  onLoggedOut,
}) => {
  const { t, language } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => !query || conversation.title.toLowerCase().includes(query));
  }, [conversations, search]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        createConversation();
      } else if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  function selectTab(tab: NavbarProps['currentTab']) {
    onSelectTab(tab);
    setMobileOpen(false);
  }

  function createConversation() {
    onCreateConversation();
    selectTab('chat');
  }

  function selectConversation(id: string) {
    onSelectConversation(id);
    setMobileOpen(false);
  }

  function requestDeleteConversation(event: React.MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    if (!deletingId) setDeleteTarget(conversation);
  }

  async function deleteConversation() {
    const conversation = deleteTarget;
    if (!conversation || deletingId) return;
    setDeletingId(conversation.id);
    try {
      await onDeleteConversation(conversation);
      setDeleteTarget(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Conversation could not be deleted');
    } finally {
      setDeletingId(null);
    }
  }

  function beginRename(event: React.MouseEvent, conversation: Conversation) {
    event.stopPropagation();
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
    setStatus(null);
  }

  async function saveRename(conversation: Conversation) {
    const title = editingTitle.trim();
    if (!title || title === conversation.title) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await api.updateConversationTitle(conversation.id, title);
      onConversationsChange(conversations.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Conversation title could not be updated');
    }
  }

  const conversationList = (
    <div className="sidebar-conversation-scroll">
      {filteredConversations.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <MessageSquare className="mx-auto h-5 w-5 text-neutral-700" />
          <p className="mt-3 text-xs text-neutral-500">
            {search ? (language === 'ko' ? '일치하는 대화가 없습니다.' : 'No matching conversations.') : t('chat.emptyConversations')}
          </p>
        </div>
      ) : (
        filteredConversations.map((conversation) => {
          const active = activeConversationId === conversation.id;
          return (
            <div key={conversation.id} className={`sidebar-conversation group ${active ? 'sidebar-conversation-active' : ''}`}>
              {editingId === conversation.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1"
                  onSubmit={(event) => { event.preventDefault(); void saveRename(conversation); }}
                >
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-neutral-600 bg-neutral-950 px-2 py-1.5 text-xs text-white outline-none focus:border-neutral-400"
                    maxLength={200}
                  />
                  <button type="submit" aria-label={language === 'ko' ? '저장' : 'Save'} className="sidebar-action text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <>
                  <button onClick={() => selectConversation(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <MessageSquare className={`h-4 w-4 shrink-0 ${active ? 'text-neutral-200' : 'text-neutral-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] ${active ? 'text-neutral-100' : 'text-neutral-400'}`}>{conversation.title || t('chat.new')}</span>
                      <span className="mt-1 block text-[10px] text-neutral-600">{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                    </span>
                  </button>
                  <div className="sidebar-actions">
                    <button aria-label={`${language === 'ko' ? '이름 수정' : 'Rename'} ${conversation.title}`} title={language === 'ko' ? '이름 수정' : 'Rename'} onClick={(event) => beginRename(event, conversation)} className="sidebar-action">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button disabled={deletingId === conversation.id} aria-label={`${t('chat.delete')} ${conversation.title || t('chat.new')}`} title={t('chat.delete')} onClick={(event) => requestDeleteConversation(event, conversation)} className="sidebar-action hover:!text-red-300 disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const navigation = (
    <>
      <button onClick={createConversation} className="sidebar-new-chat">
        <Plus className="h-4 w-4" />
        <span>{t('chat.new')}</span>
        <span className="sidebar-shortcut">Ctrl K</span>
      </button>

      <div className="sidebar-nav-section">
        <p className="sidebar-section-label">{t('common.workspace')}</p>
        <button onClick={() => selectTab('chat')} className={`sidebar-nav-item ${currentTab === 'chat' ? 'sidebar-nav-item-active' : ''}`}>
          <MessageSquare className="h-4 w-4" />
          <span className="flex-1 text-left">{t('nav.chat')}</span>
          {conversations.length > 0 && <span className="sidebar-count">{conversations.length}</span>}
        </button>
        {navItems.map(({ id, icon: Icon, key }) => (
          <button key={id} onClick={() => selectTab(id)} className={`sidebar-nav-item ${currentTab === id ? 'sidebar-nav-item-active' : ''}`}>
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{t(key)}</span>
            {id === 'memory' && pendingCount > 0 && <span className="sidebar-badge">{pendingCount}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-recent-header">
        <p className="sidebar-section-label">{t('chat.conversations')}</p>
        <span className="sidebar-count">{conversations.length}</span>
      </div>
      <label className="sidebar-search">
        <Search className="h-4 w-4 shrink-0" />
        <input ref={searchInputRef} aria-label={language === 'ko' ? '대화 검색' : 'Search conversations'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'ko' ? '대화 검색' : 'Search chats'} />
        <kbd>/</kbd>
      </label>
      {conversationList}
      {status && <p role="status" className="mt-2 px-2 text-[11px] text-rose-300">{status}</p>}
    </>
  );

  const sidebar = (mobile = false) => (
    <aside className={`sidebar-shell ${mobile ? 'sidebar-shell-mobile' : 'sidebar-shell-desktop'}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark"><Sparkles className="h-4 w-4" /></div>
        <span>Project Espera</span>
        {mobile && <button aria-label={currentTab === 'chat' ? 'Close conversations' : 'Close navigation'} onClick={() => setMobileOpen(false)} className="sidebar-mobile-close"><X className="h-4 w-4" /></button>}
      </div>
      <nav className="sidebar-content">{navigation}</nav>
      <div className="sidebar-footer">
        <button onClick={() => selectTab('settings')} className={`sidebar-nav-item ${currentTab === 'settings' ? 'sidebar-nav-item-active' : ''}`}><Settings className="h-4 w-4" /><span className="flex-1 text-left">{t('nav.settings')}</span></button>
        <div className="sidebar-session-label">{session.providerId} · {session.modelId}</div>
        <div className="sidebar-account"><AccountMenu auth={auth} onLoggedOut={onLoggedOut} /></div>
      </div>
    </aside>
  );

  return <>
    {mobileOpen && <><div aria-hidden="true" className="sidebar-overlay md:hidden" onClick={() => setMobileOpen(false)} />{sidebar(true)}</>}
    {sidebar()}
    <div className="sidebar-mobile-bar md:hidden"><button aria-label={currentTab === 'chat' ? 'Open conversations' : 'Open navigation'} onClick={() => setMobileOpen(true)} className="sidebar-menu-button"><Menu className="h-5 w-5" /></button><span className="font-semibold text-neutral-100">Project Espera</span></div>
    <ConfirmDialog open={Boolean(deleteTarget)} title={language === 'ko' ? '대화를 삭제할까요?' : 'Delete conversation?'} description={t('chat.deleteConfirm')} confirmLabel={t('common.delete')} busy={Boolean(deletingId)} onClose={() => { if (!deletingId) setDeleteTarget(null); }} onConfirm={() => void deleteConversation()} />
  </>;
};
