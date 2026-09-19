import React, { useState } from 'react';
import { Brain, FolderKanban, Menu, MessageSquare, Plus, Settings, Sparkles, Terminal, X } from 'lucide-react';
import type { Conversation } from '@espera/shared';
import type { SessionState } from '../stores/session.js';
import type { AuthState } from '../services/api.js';
import { AccountMenu } from './Account/AccountMenu.js';
import { useLanguage } from '../i18n.js';

interface NavbarProps {
  currentTab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings';
  onSelectTab: (tab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings') => void;
  pendingCount: number;
  session: SessionState;
  onToggleInspector: () => void;
  auth: AuthState;
  onLoggedOut: () => void;
}

const navItems = [
  { id: 'chat', icon: MessageSquare, key: 'nav.chat' },
  { id: 'projects', icon: FolderKanban, key: 'nav.projects' },
  { id: 'memory', icon: Brain, key: 'nav.memory' },
  { id: 'persona', icon: Sparkles, key: 'nav.persona' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, pendingCount, session, onToggleInspector, auth, onLoggedOut }) => {
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  React.useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ conversations: Conversation[]; activeId: string | null }>).detail;
      setConversations(detail.conversations);
      setActiveConversationId(detail.activeId);
    };
    window.addEventListener('espera:conversations-updated', update);
    return () => window.removeEventListener('espera:conversations-updated', update);
  }, []);

  function select(tab: NavbarProps['currentTab']) {
    onSelectTab(tab);
    setMobileOpen(false);
  }

  function createConversation() {
    window.dispatchEvent(new CustomEvent('espera:new-conversation'));
    setMobileOpen(false);
  }

  function selectConversation(id: string) {
    window.dispatchEvent(new CustomEvent('espera:select-conversation', { detail: id }));
    setMobileOpen(false);
  }

  const navigation = () => (
    <>
      <button onClick={createConversation} className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-800 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"><Plus className="h-4 w-4" />{t('chat.new')}</button>
      <div className="space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">Workspace</p>
        {navItems.map(({ id, icon: Icon, key }) => (
          <button key={id} onClick={() => select(id)} className={`group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${currentTab === id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}>
            <Icon className={`h-[18px] w-[18px] ${currentTab === id ? 'text-neutral-100' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
            <span className="flex-1 text-left">{t(key)}</span>
            {id === 'memory' && pendingCount > 0 && <span className="min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-black">{pendingCount}</span>}
          </button>
        ))}
      </div>
      <div className="my-5 border-t border-neutral-800" />
      <div className="min-h-0 flex-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">{t('chat.conversations')}</p>
        <div className="max-h-[min(32vh,320px)] space-y-1 overflow-y-auto">
          {conversations.length === 0 ? <p className="px-3 py-2 text-xs text-neutral-600">{t('chat.emptyConversations')}</p> : conversations.map((conversation) => <button key={conversation.id} onClick={() => selectConversation(conversation.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${activeConversationId === conversation.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}><MessageSquare className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{conversation.title || t('chat.new')}</span></button>)}
        </div>
      </div>
      <div className="my-5 border-t border-neutral-800" />
      <div className="space-y-1">
        <button onClick={() => select('settings')} className={`group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${currentTab === 'settings' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'}`}>
          <Settings className="h-[18px] w-[18px] text-neutral-500 group-hover:text-neutral-300" /><span className="flex-1 text-left">{t('nav.settings')}</span>
        </button>
        <button onClick={onToggleInspector} className="group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100 transition">
          <Terminal className="h-[18px] w-[18px] text-neutral-500 group-hover:text-neutral-300" /><span className="flex-1 text-left">{t('nav.inspector')}</span>
        </button>
      </div>
    </>
  );

  const sidebar = (mobile = false) => (
    <aside className={`${mobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl shadow-black/60' : 'hidden md:flex w-64 shrink-0'} flex-col border-r border-neutral-800 bg-[#101012] p-3`}>
      <div className="flex items-center gap-2 px-2 py-3">
        <Sparkles className="h-5 w-5 shrink-0 text-neutral-200" aria-hidden="true" />
        <div className="min-w-0 truncate text-sm font-semibold text-white">Project Espera</div>
        {mobile && <button aria-label={currentTab === 'chat' ? 'Close conversations' : 'Close navigation'} onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-white"><X className="h-4 w-4" /></button>}
      </div>
      <div className="my-3 border-t border-neutral-800" />
      <nav className="flex min-h-0 flex-1 flex-col">{navigation()}</nav>
      <div className="border-t border-neutral-800 pt-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">Account</p>
        <AccountMenu auth={auth} onLoggedOut={onLoggedOut} />
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-neutral-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{session.providerId} · {session.modelId}</div>
      </div>
    </aside>
  );

  return <>
    {mobileOpen && <><div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobileOpen(false)} />{sidebar(true)}</>}
    {sidebar()}
    <div className="flex h-14 shrink-0 items-center border-b border-neutral-800 bg-[#101012] px-3 md:hidden">
      <button aria-label={currentTab === 'chat' ? 'Open conversations' : 'Open navigation'} onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"><Menu className="h-5 w-5" /></button>
      <div className="ml-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-neutral-200" aria-hidden="true" /><span className="text-sm font-semibold text-white">Project Espera</span></div>
    </div>
  </>;
};
