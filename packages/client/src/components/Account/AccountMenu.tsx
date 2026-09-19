import React, { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { api, type AuthState } from '../../services/api.js';

export const AccountMenu: React.FC<{ auth: AuthState; onLoggedOut: () => void }> = ({ auth, onLoggedOut }) => {
  const [open, setOpen] = useState(false);
  if (!auth.authenticated || !auth.user) return null;
  const initials = auth.user.name.trim().slice(0, 1).toUpperCase() || 'U';
  return <div className="relative">
    <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 hover:bg-slate-800 transition" aria-label="Account menu">
      {auth.user.avatarUrl ? <img src={auth.user.avatarUrl} alt="" className="w-7 h-7 rounded-lg" /> : <span className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-xs font-bold">{initials}</span>}
      <span className="hidden sm:block max-w-28 truncate text-sm text-slate-200">{auth.user.name}</span><ChevronDown className="w-4 h-4 text-slate-500" />
    </button>
    {open && <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50">
      <div className="px-3 py-2 border-b border-slate-800 mb-1"><p className="text-sm text-slate-200 truncate">{auth.user.name}</p><p className="text-xs text-slate-500 truncate">{auth.user.email || 'GitHub account'}</p></div>
      <button onClick={async () => { await api.logout(); onLoggedOut(); }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"><LogOut className="w-4 h-4" /> Sign out</button>
    </div>}
  </div>;
};
