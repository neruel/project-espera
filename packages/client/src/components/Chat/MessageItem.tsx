import React, { memo, useState } from 'react';
import { Check, Copy, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import type { Message } from '@espera/shared';
import { useLanguage } from '../../i18n.js';
import { Menu } from '../Common/Menu.js';
import { MarkdownContent } from './MarkdownContent.js';

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  busy: boolean;
  onRegenerate: (message: Message) => void;
  onDelete: (message: Message) => void;
  onCopyError: () => void;
}

export const MessageItem = memo(function MessageItem({ message, isLast, busy, onRegenerate, onDelete, onCopyError }: MessageItemProps) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const time = new Date(message.createdAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      onCopyError();
    }
  }

  const actions = (
    <div
      className={`flex items-center gap-0.5 text-fg-2 transition-opacity focus-within:opacity-100 ${isUser ? 'justify-end' : '-ml-2'} ${isLast && !isUser ? '' : 'sm:opacity-0 sm:group-hover:opacity-100'}`}
    >
      <button type="button" className="icon-btn icon-btn-sm" onClick={() => void copy()} aria-label={t('chat.copy')} title={t('chat.copy')}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      {!isUser && (
        <button type="button" className="icon-btn icon-btn-sm" disabled={busy} onClick={() => onRegenerate(message)} aria-label={t('chat.regenerate')} title={t('chat.regenerate')}>
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
      <Menu
        side={isLast ? 'top' : 'bottom'}
        align={isUser ? 'end' : 'start'}
        label={t('chat.moreActions')}
        trigger={(props) => (
          <button type="button" {...props} className="icon-btn icon-btn-sm" aria-label={t('chat.moreActions')} title={t('chat.moreActions')}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      >
        {(close) => (
          <>
            <p className="menu-label">{[message.modelId, time].filter(Boolean).join(' · ')}</p>
            <button type="button" role="menuitem" disabled={busy} className="menu-item menu-item-danger" onClick={() => { close(); onDelete(message); }}>
              <Trash2 />
              {t('chat.deleteMessage')}
            </button>
          </>
        )}
      </Menu>
    </div>
  );

  if (isUser) {
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-surface px-5 py-2.5 text-base leading-7 text-fg sm:max-w-[75%]">
          {message.content}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-2">
      <MarkdownContent content={message.content} />
      {actions}
    </div>
  );
});
