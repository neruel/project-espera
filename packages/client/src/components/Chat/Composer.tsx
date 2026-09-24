import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { ArrowUp, Check, ChevronDown, Folder, Square } from 'lucide-react';
import type { Project } from '@espera/shared';
import { useLanguage } from '../../i18n.js';
import { Menu } from '../Common/Menu.js';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  projects: Project[];
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

export interface ComposerHandle {
  focus: () => void;
}

const MAX_HEIGHT = 220;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSubmit, onStop, isStreaming, projects, projectId, onProjectChange },
  ref,
) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }));

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
    element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!isStreaming) onSubmit();
  }

  const project = projects.find((item) => item.id === projectId);
  const canSend = value.trim().length > 0;

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); if (!isStreaming) onSubmit(); }}
      className="rounded-[28px] bg-white px-3 pb-2.5 pt-3 shadow-[0_4px_20px_rgb(0_0_0/6%)] ring-1 ring-black/10 dark:bg-surface dark:shadow-none dark:ring-0"
    >
      <label htmlFor="composer-input" className="sr-only">{t('chat.placeholder')}</label>
      <textarea
        id="composer-input"
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('chat.placeholder')}
        rows={1}
        autoFocus
        className="block max-h-[220px] w-full resize-none bg-transparent px-2.5 py-1.5 text-base leading-6 text-fg outline-none placeholder:text-fg-3"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Menu
          side="top"
          label={t('chat.projectScope')}
          className="max-h-72 w-64 overflow-y-auto"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`${t('chat.projectScope')}: ${project?.name || t('chat.global')}`}
              className={`inline-flex h-9 max-w-[14rem] items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors hover:bg-[var(--hover)] ${project ? 'text-fg' : 'text-fg-2'}`}
            >
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{project?.name || t('chat.global')}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-3" />
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="menu-label">{t('chat.projectScope')}</p>
              {[{ id: null, name: t('chat.global') }, ...projects].map((item) => (
                <button
                  key={item.id ?? 'global'}
                  type="button"
                  role="menuitemradio"
                  aria-checked={item.id === projectId}
                  className="menu-item"
                  onClick={() => { onProjectChange(item.id); close(); }}
                >
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.id === projectId && <Check className="!text-fg" />}
                </button>
              ))}
            </>
          )}
        </Menu>
        {isStreaming ? (
          <button type="button" onClick={onStop} aria-label={t('chat.stop')} className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition-opacity hover:opacity-80">
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!canSend} aria-label={t('chat.send')} className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition-opacity hover:opacity-80 disabled:bg-fg/15 disabled:text-bg dark:disabled:bg-fg/20">
            <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </form>
  );
});
