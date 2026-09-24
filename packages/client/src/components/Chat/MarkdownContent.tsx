import React, { memo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Check, Copy } from 'lucide-react';
import { useLanguage } from '../../i18n.js';

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const code = React.Children.toArray(children)[0];
  const className = React.isValidElement<{ className?: string }>(code) ? code.props.className || '' : '';
  const language = /language-([\w-]+)/.exec(className)?.[1];

  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl bg-[rgb(var(--code-bg))] ring-1 ring-line/60">
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-fg-3">
        <span className="font-mono">{language || 'text'}</span>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:text-fg">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('chat.copied') : t('chat.copyCode')}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const components: Components = {
  a: ({ node: _node, href, children, ...props }) => (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  // Never auto-load remote images from model output: a prompt-injected reply could
  // leak context through the image URL. Show a link the user can open deliberately.
  img: ({ src, alt }) => (typeof src === 'string' && src
    ? <a href={src} target="_blank" rel="noopener noreferrer">{alt || src}</a>
    : null),
};

/** Memoized so a streaming reply does not re-render every earlier message. */
export const MarkdownContent = memo(function MarkdownContent({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
      {streaming && <span className="stream-caret" aria-hidden="true" />}
    </div>
  );
});
