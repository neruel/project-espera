import React, { useEffect, useRef, useState } from 'react';

interface MenuProps {
  /** Renders the trigger; spread `props` onto the button so aria state and toggling stay wired. */
  trigger: (props: { onClick: () => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean }, open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
  label?: string;
}

/** Lightweight dropdown: outside click and Escape close it, arrow keys move between items. */
export function Menu({ trigger, children, align = 'start', side = 'bottom', className = '', label }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)') || [])];
    const frame = requestAnimationFrame(() => (panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') || items()[0])?.focus());
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % list.length : (index - 1 + list.length) % list.length;
      list[next]?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const close = () => setOpen(false);
  const position = `${side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} ${align === 'start' ? 'left-0' : 'right-0'}`;

  return (
    <div ref={rootRef} className="relative">
      {trigger({ onClick: () => setOpen((value) => !value), 'aria-haspopup': 'menu', 'aria-expanded': open }, open)}
      {open && (
        <div ref={panelRef} role="menu" aria-label={label} className={`popover absolute ${position} ${className}`}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
