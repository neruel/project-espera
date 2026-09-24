import React, { useEffect, useRef } from 'react';
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
  return (
    <div className="dialog-backdrop z-[90]" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="dialog max-w-md p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
        <p id="confirm-description" className="mt-2 text-sm leading-6 text-fg-2">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" disabled={busy} className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" disabled={busy} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {busy ? t('common.loading') : (confirmLabel || t('common.delete'))}
          </button>
        </div>
      </section>
    </div>
  );
}
