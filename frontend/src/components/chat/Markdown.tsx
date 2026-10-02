import React, { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { LinkPreview } from '@/components/ui/aceternity/LinkPreview'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'
import { highlight } from '@/lib/highlight'
import { CssLink } from '@/components/ui/skiper/CssLink'
// SmoothUI's AIResponse — used for the plain-text streaming path below.
import AIResponse from '@/components/smoothui/ai-response'

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = String(children ?? '').replace(/\n$/, '')
  const lang = (className ?? '').replace('language-', '') || 'text'

  return (
    <div className="relative group/code my-2">
      <div className="flex items-center justify-between px-3.5 py-1.5 rounded-t-[14px] text-[10.5px] font-mono"
        style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
        <span>{lang}</span>
        <button
          aria-label="Copy code"
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="flex items-center gap-1 hover:text-[var(--text)] transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </div>
  )
}

export const Markdown = memo(function Markdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const plainStreaming = streaming && !/[`#*_\[\]]/.test(content)
  return (
    <div className={`md-body ${streaming ? 'md-streaming' : ''}`}>
      {plainStreaming ? (
        // SmoothUI's AIResponse animates a word when the word *arrives* rather
        // than on a fixed timer, so the entrance can never drift out of step
        // with the stream it is describing. Markdown takes over the moment the
        // answer contains any markup to render.
        <AIResponse text={content} isStreaming />
      ) : <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, className, children, ...props }) {
            const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>
            return <code className={className}>{children}</code>
          },
          // Links in an answer are the way out of it, so they get the real
          // treatment: the rule is drawn in CSS instead of by the browser, the
          // external marker arrives on hover, and citations read as chips.
          //
          // A link that leaves the app also becomes a preview: hovering it asks
          // the local server what the page says about itself (robots.txt first,
          // then its own Open Graph tags) and shows a card. Everything stays a
          // link, so it is never a dead end if the preview is refused.
          a({ href, children }) {
            const text = Array.isArray(children) ? children.join('') : String(children ?? '')
            const cite = /^\s*\[?\d{1,2}\]?\s*$/.test(text)
            const link = <CssLink href={href ?? '#'} variant={cite ? 'chip' : 'inline'}>{children}</CssLink>
            const external = !!href && /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)
            if (!external || cite) return link
            return <LinkPreview url={href}>{link}</LinkPreview>
          },
        }}
      >
        {content}
      </ReactMarkdown>}
    </div>
  )
})
