import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../i18n.js';
import { useDialogAccessibility } from './useDialogAccessibility.js';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevents closing while a request is in flight. */
  locked?: boolean;
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({ title, description, onClose, children, footer, size = 'md', locked = false }: ModalProps) {
  const { t } = useLanguage();
  const close = () => { if (!locked) onClose(); };
  const dialogRef = useDialogAccessibility(true, close);
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className={`dialog ${widths[size]}`}>
        <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-fg-2">{description}</p>}
          </div>
          <button type="button" disabled={locked} aria-label={t('common.close')} onClick={close} className="icon-btn -mr-2 -mt-1">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-6 pb-6 pt-3">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-6 pb-6">{footer}</footer>}
      </section>
    </div>
  );
}
