import React, { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Check, Copy } from 'lucide-react'
import { highlight } from '@/lib/highlight'

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
        <span aria-live="polite">{content.split(/(\s+)/).map((part, i) => part.trim() ? <span key={i} className="re-word-focus">{part}</span> : part)}</span>
      ) : <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, className, children, ...props }) {
            const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>
            return <code className={className}>{children}</code>
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
          },
        }}
      >
        {content}
      </ReactMarkdown>}
    </div>
  )
})
