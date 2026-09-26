import React, { useState } from 'react';
import { LogOut, Settings, Trash2 } from 'lucide-react';
import { api, type AuthState } from '../../services/api.js';
import { useLanguage, describeError } from '../../i18n.js';
import { ConfirmDialog } from '../Common/ConfirmDialog.js';
import { Menu } from '../Common/Menu.js';

interface AccountMenuProps {
  auth: AuthState;
  onLoggedOut: () => void;
  onOpenSettings: () => void;
}

export function AccountMenu({ auth, onLoggedOut, onOpenSettings }: AccountMenuProps) {
  const { t } = useLanguage();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const user = auth.authenticated ? auth.user : null;

  // Without a signed-in user (local development) there is no account, only settings.
  if (!user) {
    return (
      <button type="button" className="nav-row" onClick={onOpenSettings}>
        <Settings />
        {t('nav.settings')}
      </button>
    );
  }

  const initials = user.name.trim().slice(0, 1).toUpperCase() || 'U';

  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
      onLoggedOut();
    } finally {
      setLoggingOut(false);
    }
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await api.deleteAccount();
      window.location.reload();
    } catch (error) {
      setDeleteError(describeError(t, error, t('account.deleteFailed')));
      setDeletingAccount(false);
    }
  }

  return (
    <>
      <Menu
        side="top"
        label={t('common.account')}
        className="w-full"
        trigger={(props, open) => (
          <button type="button" {...props} aria-label={t('common.account')} className={`nav-row h-12 ${open ? 'nav-row-active' : ''}`}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{initials}</span>}
            <span className="min-w-0 flex-1 truncate">{user.name}</span>
          </button>
        )}
      >
        {(close) => (
          <>
            <p className="menu-label truncate">{user.email || t('common.githubAccount')}</p>
            <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); onOpenSettings(); }}>
              <Settings />
              {t('nav.settings')}
            </button>
            <div className="menu-separator" />
            <button type="button" role="menuitem" disabled={loggingOut} className="menu-item" onClick={() => void logout()}>
              <LogOut />
              {loggingOut ? t('common.loading') : t('common.signOut')}
            </button>
            <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={() => { close(); setDeleteError(''); setDeleteAccountOpen(true); }}>
              <Trash2 />
              {t('account.delete')}
            </button>
          </>
        )}
      </Menu>
      <ConfirmDialog
        open={deleteAccountOpen}
        title={t('account.deleteTitle')}
        description={`${t('account.deleteConfirm')}${deleteError ? ` ${deleteError}` : ''}`}
        confirmLabel={t('account.delete')}
        busy={deletingAccount}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={() => void deleteAccount()}
      />
    </>
  );
}
