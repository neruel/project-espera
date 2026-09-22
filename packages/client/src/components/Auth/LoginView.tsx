import React from 'react';
import { Github, ShieldCheck, Sparkles } from 'lucide-react';
import type { AuthState } from '../../services/api.js';
import { api } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';

export const LoginView: React.FC<{ auth: AuthState }> = ({ auth }) => {
  const { t } = useLanguage();
  return (
  <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-xl shadow-sky-950/50">E</div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('auth.welcome')}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{t('auth.body')}</p>
      </div>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
        <div className="space-y-4 mb-6">
          <div className="flex gap-3"><Sparkles className="w-5 h-5 text-sky-400 shrink-0" /><p className="text-sm text-slate-300">Switch between AI providers without losing what matters to you.</p></div>
          <div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /><p className="text-sm text-slate-300">Your account keeps your memory separate from every other user.</p></div>
        </div>
        {auth.configured ? (
          <button onClick={() => api.loginWithGitHub()} className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-600 bg-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:bg-neutral-600">
            <Github className="w-5 h-5" /> {t('auth.github')}
          </button>
        ) : (
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{t('auth.notConfigured')}</div>
        )}
        <p className="mt-4 text-center text-xs text-slate-500">Espera never stores your provider API keys.</p>
      </section>
    </div>
  </main>
  );
};
