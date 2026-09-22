import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../../i18n.js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, danger = true, onConfirm, onClose }: ConfirmDialogProps) {
  const { t } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const dialog = cancelRef.current?.closest('[role="alertdialog"]');
        const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, busy, onClose]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="workspace-section w-full max-w-md p-5 shadow-2xl shadow-black/50">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-rose-950/60 text-rose-300' : 'bg-neutral-800 text-neutral-300'}`}><AlertTriangle className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1"><h2 id="confirm-title" className="text-sm font-semibold text-neutral-100">{title}</h2><p id="confirm-description" className="mt-2 text-xs leading-5 text-neutral-500">{description}</p></div>
        <button type="button" disabled={busy} aria-label={t('common.close')} onClick={onClose} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button ref={cancelRef} type="button" disabled={busy} className="workspace-button" onClick={onClose}>{t('common.cancel')}</button><button type="button" disabled={busy} className={`workspace-button ${danger ? '!border-rose-900 !bg-rose-950/50 !text-rose-200 hover:!bg-rose-900/60' : 'workspace-button-primary'}`} onClick={onConfirm}>{busy ? t('common.loading') : (confirmLabel || t('common.delete'))}</button></div>
    </section>
  </div>;
}
