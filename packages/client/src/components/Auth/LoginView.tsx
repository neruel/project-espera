import React from 'react';
import { Github, ShieldCheck, Sparkles } from 'lucide-react';
import type { AuthState } from '../../services/api.js';
import { api } from '../../services/api.js';

export const LoginView: React.FC<{ auth: AuthState }> = ({ auth }) => (
  <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-xl shadow-sky-950/50">E</div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Espera</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Your conversations, memory, and personal AI context in one private workspace.</p>
      </div>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
        <div className="space-y-4 mb-6">
          <div className="flex gap-3"><Sparkles className="w-5 h-5 text-sky-400 shrink-0" /><p className="text-sm text-slate-300">Switch between AI providers without losing what matters to you.</p></div>
          <div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /><p className="text-sm text-slate-300">Your account keeps your memory separate from every other user.</p></div>
        </div>
        {auth.configured ? (
          <button onClick={() => api.loginWithGitHub()} className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition">
            <Github className="w-5 h-5" /> Continue with GitHub
          </button>
        ) : (
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">GitHub sign-in is not configured yet. Add the OAuth settings to continue.</div>
        )}
        <p className="mt-4 text-center text-xs text-slate-500">Espera never stores your provider API keys.</p>
      </section>
    </div>
  </main>
);
