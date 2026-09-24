import React from 'react';
import { Github } from 'lucide-react';
import { api, type AuthState } from '../../services/api.js';
import { useLanguage } from '../../i18n.js';
import { Logo } from '../Common/Logo.js';

export function LoginView({ auth }: { auth: AuthState }) {
  const { t } = useLanguage();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-6 py-12 text-fg">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto h-12 w-12" />
        <h1 className="mt-8 text-[28px] font-semibold tracking-[-0.02em]">{t('auth.welcome')}</h1>
        <p className="mt-3 text-[15px] leading-7 text-fg-2">{t('auth.body')}</p>
        <div className="mt-10">
          {auth.configured ? (
            <button type="button" onClick={() => api.loginWithGitHub()} className="btn btn-primary h-12 w-full text-[15px]">
              <Github className="h-5 w-5" />
              {t('auth.github')}
            </button>
          ) : (
            <p className="notice">{t('auth.notConfigured')}</p>
          )}
        </div>
        <p className="mt-6 text-xs leading-5 text-fg-3">{t('auth.keyNote')}</p>
      </div>
    </main>
  );
}
