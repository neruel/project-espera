import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Trash2, UserRound } from 'lucide-react';
import { api, type AuthState } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';

export const AccountMenu: React.FC<{ auth: AuthState; onLoggedOut: () => void }> = ({ auth, onLoggedOut }) => {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLanguage();
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  if (!auth.authenticated || !auth.user) return null;
  const initials = auth.user.name.trim().slice(0, 1).toUpperCase() || 'U';
  async function deleteAccount() {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await api.deleteAccount();
      window.location.reload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account could not be deleted.');
      setDeletingAccount(false);
    }
  }
  return <div ref={menuRef} className="relative w-full">
    <button type="button" onClick={() => setOpen((value) => !value)} className="account-trigger" aria-label={t('common.account')} aria-haspopup="menu" aria-expanded={open}>
      {auth.user.avatarUrl ? <img src={auth.user.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-700 text-xs font-bold text-neutral-200">{initials}</span>}
      <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-medium text-neutral-200">{auth.user.name}</span><span className="mt-0.5 block truncate text-[10px] text-neutral-600">{auth.user.email || t('common.githubAccount')}</span></span>
      <ChevronDown className={`h-4 w-4 text-neutral-600 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="menu" className="account-popover">
      <div className="flex items-center gap-2.5 border-b border-neutral-800 px-3 py-3"><UserRound className="h-4 w-4 shrink-0 text-neutral-500" /><div className="min-w-0"><p className="truncate text-xs font-medium text-neutral-200">{auth.user.name}</p><p className="mt-0.5 truncate text-[10px] text-neutral-600">{auth.user.email || t('common.githubAccount')}</p></div></div>
      <button role="menuitem" disabled={loggingOut} onClick={async () => { setLoggingOut(true); try { await api.logout(); onLoggedOut(); } finally { setLoggingOut(false); } }} className="account-menu-item"><LogOut className="h-4 w-4" /> {loggingOut ? t('common.loading') : t('common.signOut')}</button>
      <button role="menuitem" onClick={() => { setOpen(false); setDeleteError(''); setDeleteAccountOpen(true); }} className="account-menu-item !text-rose-300"><Trash2 className="h-4 w-4" /> {t('account.delete')}</button>
    </div>}
    <ConfirmDialog
      open={deleteAccountOpen}
      title={t('account.deleteTitle')}
      description={`${t('account.deleteConfirm')}${deleteError ? ` ${deleteError}` : ''}`}
      confirmLabel={t('account.delete')}
      busy={deletingAccount}
      onClose={() => setDeleteAccountOpen(false)}
      onConfirm={() => void deleteAccount()}
    />
  </div>;
};
