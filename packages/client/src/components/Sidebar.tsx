import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, FolderClosed, MoreHorizontal, PanelLeft, Pencil, Search, SquarePen, Trash2, UserRound, X } from 'lucide-react';
import type { Conversation } from '@espera/shared';
import { api, type AuthState } from '../services/api.js';
import { useLanguage, type TranslationKey } from '../i18n.js';
import { AccountMenu } from './Account/AccountMenu.js';
import { ConfirmDialog } from './Common/ConfirmDialog.js';
import { Logo } from './Common/Logo.js';
import { Menu } from './Common/Menu.js';

export type Page = 'chat' | 'memory' | 'persona' | 'projects';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  pendingCount: number;
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (conversation: Conversation) => Promise<void>;
  onConversationsChange: (conversations: Conversation[]) => void;
  auth: AuthState;
  onLoggedOut: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onOpen: () => void;
  onCloseMobile: () => void;
}

const DAY = 24 * 60 * 60 * 1000;

function groupConversations(conversations: Conversation[], language: string, t: (key: TranslationKey) => string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const groups = new Map<string, Conversation[]>();
  const sorted = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const conversation of sorted) {
    const date = new Date(conversation.updatedAt);
    const time = date.getTime();
    const label = time >= today ? t('sidebar.today')
      : time >= today - DAY ? t('sidebar.yesterday')
        : time >= today - 7 * DAY ? t('sidebar.last7')
          : time >= today - 30 * DAY ? t('sidebar.last30')
            : date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long' });
    groups.set(label, [...(groups.get(label) || []), conversation]);
  }
  return [...groups.entries()];
}

const navItems = [
  { page: 'projects', icon: FolderClosed, key: 'nav.projects' },
  { page: 'memory', icon: BookMarked, key: 'nav.memory' },
  { page: 'persona', icon: UserRound, key: 'nav.persona' },
] as const;

export function Sidebar({
  page,
  onNavigate,
  pendingCount,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onConversationsChange,
  auth,
  onLoggedOut,
  onOpenSettings,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onOpen,
  onCloseMobile,
}: SidebarProps) {
  const { t, language } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? conversations.filter((item) => item.title.toLowerCase().includes(query)) : conversations;
    return groupConversations(filtered, language, t);
  }, [conversations, search, language, t]);

  function openSearch() {
    onOpen();
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearch('');
  }

  const shortcutsRef = useRef({ openSearch, onNewChat, onToggleCollapsed });
  shortcutsRef.current = { openSearch, onNewChat, onToggleCollapsed };
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && event.shiftKey && key === 'o') { event.preventDefault(); shortcutsRef.current.onNewChat(); }
      else if (mod && event.shiftKey && key === 's') { event.preventDefault(); shortcutsRef.current.onToggleCollapsed(); }
      else if (mod && !event.shiftKey && key === 'k') { event.preventDefault(); shortcutsRef.current.openSearch(); }
      else if (key === '/' && !typing && !mod) { event.preventDefault(); shortcutsRef.current.openSearch(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseMobile(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  function navigate(next: Page) {
    onNavigate(next);
    onCloseMobile();
  }

  function selectConversation(id: string) {
    onSelectConversation(id);
    onCloseMobile();
  }

  function beginRename(conversation: Conversation) {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
    setStatus(null);
  }

  async function saveRename(conversation: Conversation) {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title || title === conversation.title) return;
    try {
      const updated = await api.updateConversationTitle(conversation.id, title);
      onConversationsChange(conversations.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('sidebar.renameFailed'));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDeleteConversation(deleteTarget);
      setDeleteTarget(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('sidebar.deleteFailed'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const hidden = `${mobileOpen ? 'translate-x-0' : '-translate-x-full max-md:invisible'} ${collapsed ? 'md:invisible md:w-0' : 'md:w-[260px]'}`;

  return (
    <>
      {mobileOpen && <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onCloseMobile} />}
      <aside
        aria-label={t('nav.sidebar')}
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 overflow-hidden bg-sidebar transition-[transform,width] duration-200 ease-out md:relative md:z-auto md:translate-x-0 ${hidden}`}
      >
        <div className="flex h-full w-[280px] flex-col md:w-[260px]">
          <div className="flex h-14 shrink-0 items-center justify-between px-3">
            <button type="button" onClick={onNewChat} className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-fg" aria-label={t('chat.new')}>
              <Logo className="h-7 w-7" />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">Espera</span>
            </button>
            <button type="button" className="icon-btn hidden md:inline-flex" onClick={onToggleCollapsed} aria-label={t('nav.closeSidebar')} title={`${t('nav.closeSidebar')} (Ctrl+Shift+S)`}>
              <PanelLeft className="h-5 w-5" />
            </button>
            <button type="button" className="icon-btn md:hidden" onClick={onCloseMobile} aria-label={t('nav.closeSidebar')}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-0.5 px-2 pb-3">
            <button type="button" className="nav-row group" onClick={() => { onNewChat(); onCloseMobile(); }}>
              <SquarePen />
              <span className="flex-1">{t('chat.new')}</span>
              <kbd className="hidden text-xs text-fg-3 group-hover:inline">Ctrl Shift O</kbd>
            </button>
            {searchOpen ? (
              <div className="flex h-9 items-center gap-3 rounded-lg bg-[var(--active)] px-2.5">
                <Search className="h-[18px] w-[18px] shrink-0 text-fg-2" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}
                  onBlur={() => { if (!search) setSearchOpen(false); }}
                  aria-label={t('sidebar.search')}
                  placeholder={t('sidebar.search')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
                />
                <button type="button" className="text-fg-3 hover:text-fg" onMouseDown={(event) => event.preventDefault()} onClick={closeSearch} aria-label={t('common.close')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" className="nav-row group" onClick={openSearch}>
                <Search />
                <span className="flex-1">{t('sidebar.search')}</span>
                <kbd className="hidden text-xs text-fg-3 group-hover:inline">Ctrl K</kbd>
              </button>
            )}
            <div className="h-2" />
            {navItems.map(({ page: target, icon: Icon, key }) => (
              <button
                key={target}
                type="button"
                aria-current={page === target ? 'page' : undefined}
                className={`nav-row ${page === target ? 'nav-row-active' : ''}`}
                onClick={() => navigate(target)}
              >
                <Icon />
                <span className="flex-1">{t(key)}</span>
                {target === 'memory' && pendingCount > 0 && (
                  <span className="rounded-full bg-accent/15 px-1.5 text-xs font-medium tabular-nums text-fg" aria-label={t('sidebar.pending', { count: pendingCount })}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {groups.length === 0 && (
              <p className="px-2.5 py-3 text-sm text-fg-3">{search ? t('sidebar.noMatches') : t('sidebar.empty')}</p>
            )}
            {groups.map(([label, items]) => (
              <section key={label} className="mb-4">
                <h2 className="sticky top-0 z-10 bg-sidebar px-2.5 pb-1 pt-2 text-xs font-medium text-fg-3">{label}</h2>
                {items.map((conversation) => {
                  const active = page === 'chat' && conversation.id === activeConversationId;
                  const title = conversation.title || t('chat.untitled');
                  if (editingId === conversation.id) {
                    return (
                      <input
                        key={conversation.id}
                        autoFocus
                        value={editingTitle}
                        maxLength={200}
                        aria-label={t('sidebar.rename')}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onFocus={(event) => event.target.select()}
                        onBlur={() => void saveRename(conversation)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                          if (event.key === 'Escape') { event.stopPropagation(); setEditingId(null); }
                        }}
                        className="h-9 w-full rounded-lg border border-fg-3 bg-bg px-2.5 text-sm text-fg outline-none"
                      />
                    );
                  }
                  return (
                    <div key={conversation.id} className={`group relative flex h-9 items-center rounded-lg transition-colors ${active ? 'bg-[var(--active)]' : 'hover:bg-[var(--hover)]'}`}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        aria-current={active ? 'page' : undefined}
                        className="h-full min-w-0 flex-1 truncate px-2.5 text-left text-sm text-fg"
                        title={title}
                      >
                        {title}
                      </button>
                      <div className={`pr-1 ${active ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:has-[[aria-expanded=true]]:opacity-100'}`}>
                        <Menu
                          align="end"
                          label={title}
                          className="w-44"
                          trigger={(props) => (
                            <button type="button" {...props} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-2 hover:text-fg" aria-label={t('sidebar.options', { title })}>
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); beginRename(conversation); }}>
                                <Pencil />
                                {t('sidebar.rename')}
                              </button>
                              <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={() => { close(); setDeleteTarget(conversation); }}>
                                <Trash2 />
                                {t('common.delete')}
                              </button>
                            </>
                          )}
                        </Menu>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
            {status && <p role="status" className="px-2.5 text-xs text-danger">{status}</p>}
          </div>

          <div className="shrink-0 px-2 pb-2 pt-1">
            <AccountMenu auth={auth} onLoggedOut={onLoggedOut} onOpenSettings={() => { onOpenSettings(); onCloseMobile(); }} />
          </div>
        </div>
      </aside>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('sidebar.deleteTitle')}
        description={t('sidebar.deleteBody', { title: deleteTarget?.title || t('chat.untitled') })}
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
