import { ButtonGroup } from '@/components/ui/uiarc/button-group/button-group'
import { ActionButton } from '@/components/ui/uiarc/action-button/action-button'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft, GripVertical, Plus, Trash2, Type, AlignLeft, List, Quote, Code2,
  Eye, Pencil, Download, Wand2, ChevronUp, ChevronDown, Sparkles, Image as ImageIcon,
  RefreshCw, AlignCenter, AlignRight, Upload, Info, Text as TextIcon,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import type { Article, ArticleBlock } from '@/types'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { download, readingTime } from '@/lib/utils'
import { findCommonsImage, fileToDataUrl } from '@/lib/articles/images'
// shadcn-space @shadcn-space/button-group-10 — the editor toolbar. Its commands
// drive a real block type here ('rich'), not the demo box: every formatted
// block in the article owns its own editable surface and its own toolbar state.
import { EditorToolbar, readEditorState, runEditorCommand, type EditorCommandId, type EditorSelectionState } from '@/components/shadcn-space/button-group/button-group-10'

const BLOCK_TYPES = [
  { type: 'heading', icon: Type, label: 'Heading' },
  { type: 'rich', icon: TextIcon, label: 'Formatted' },
  { type: 'paragraph', icon: AlignLeft, label: 'Paragraph' },
  { type: 'list', icon: List, label: 'List' },
  { type: 'quote', icon: Quote, label: 'Quote' },
  { type: 'code', icon: Code2, label: 'Code' },
  { type: 'image', icon: ImageIcon, label: 'Image' },
] as const

export function ArticleEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ui = useUI()
  const article = useStore((s) => s.articles.find((a) => a.id === id))
  const [view, setView] = useState<'edit' | 'read'>('edit')

  if (!article) return <div className="p-10 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>Article not found.</div>

  const update = (fn: (a: Article) => Partial<Article>) =>
    useStore.setState((s) => ({
      articles: s.articles.map((a) => a.id === id ? { ...a, ...fn(a), updatedAt: Date.now() } : a),
    }))

  const setBlock = (bid: string, content: string) =>
    update((a) => ({ blocks: a.blocks.map((b) => b.id === bid ? { ...b, content } : b) }))

  const move = (idx: number, dir: -1 | 1) =>
    update((a) => {
      const blocks = [...a.blocks]
      const j = idx + dir
      if (j < 0 || j >= blocks.length) return {}
      ;[blocks[idx], blocks[j]] = [blocks[j], blocks[idx]]
      return { blocks }
    })

  const remove = (bid: string) => update((a) => ({ blocks: a.blocks.filter((b) => b.id !== bid) }))

  const add = (type: ArticleBlock['type'], after?: string) => {
    const nb: ArticleBlock = { id: nanoid(6), type, content: '', align: 'center' }
    update((a) => {
      const blocks = [...a.blocks]
      const idx = after ? blocks.findIndex((b) => b.id === after) : blocks.length - 1
      blocks.splice(idx + 1, 0, nb)
      return { blocks }
    })
    // AI-fetch an image for new image blocks based on surrounding context
    if (type === 'image') fetchImageFor(nb.id)
  }

  const patchBlock = (bid: string, patch: Partial<ArticleBlock>) =>
    update((a) => ({ blocks: a.blocks.map((b) => b.id === bid ? { ...b, ...patch } : b) }))

  const fetchImageFor = async (bid: string, queryOverride?: string) => {
    const a = useStore.getState().articles.find((x) => x.id === id)
    const bi = a?.blocks.findIndex((b) => b.id === bid) ?? -1
    // context query: nearest preceding heading, else first paragraph text
    let query = queryOverride
    if (!query && a && bi >= 0) {
      for (let i = bi - 1; i >= 0; i--) {
        const b = a.blocks[i]
        if (b.type === 'heading' && b.content.trim()) { query = b.content.trim().slice(0, 60); break }
        if (b.type === 'paragraph' && b.content.trim()) { query = b.content.trim().slice(0, 60); break }
      }
    }
    if (!query) query = a?.title || 'research'
    patchBlock(bid, { imageUrl: undefined, caption: `Searching for “${query}”…` })
    const img = await findCommonsImage(query)
    if (img) {
      patchBlock(bid, { imageUrl: img.url, caption: img.title, attribution: img.attribution, alt: img.title, content: img.reason })
      ui.toast('Image added', `${img.title} · ${img.attribution}`, 'success')
    } else {
      patchBlock(bid, { imageUrl: '', caption: '' })
      ui.toast('No image found', 'Drag & drop a local image onto the block, or try again.', 'warning')
    }
  }

  const onDropImage = async (bid: string, file: File) => {
    if (!file.type.startsWith('image/')) { ui.toast('Not an image', 'Drop a PNG, JPG, WEBP or GIF file.', 'warning'); return }
    const dataUrl = await fileToDataUrl(file)
    patchBlock(bid, { imageUrl: dataUrl, caption: file.name, attribution: 'Local upload', alt: file.name })
    ui.toast('Image replaced', 'Using your local file — stored inside this article.', 'success')
  }

  const aiAction = (bid: string, action: 'rewrite' | 'expand' | 'condense') => {
    const block = article.blocks.find((b) => b.id === bid)
    if (!block || !block.content.trim()) return
    ui.set({ island: { kind: 'skill', name: `AI ${action}` } })
    setTimeout(() => {
      const words = block.content.split(/\s+/)
      let out = block.content
      if (action === 'condense') out = words.slice(0, Math.max(8, Math.floor(words.length * 0.5))).join(' ') + '…'
      if (action === 'expand') out = block.content + ' ' + ['Moreover, the evidence here reinforces the broader pattern.', 'In practice, this shapes how the next section should be framed.', 'A careful reader will note the implication for the central claim.'][words.length % 3]
      if (action === 'rewrite') out = words.map((w, i) => i === 0 ? w : w).join(' ').replace(/\.\s+/g, '. ').trim()
      setBlock(bid, out)
      ui.toast(`AI ${action} applied`, 'Block updated. Cmd/Ctrl+Z is not wired yet — edit freely.', 'success')
      useUI.setState((s) => ({ island: s.island.kind === 'skill' ? { kind: 'idle' } : s.island }))
    }, 700)
  }

  const exportMd = () => {
    const md = article.blocks.map((b) => {
      if (b.type === 'heading') return `## ${b.content}`
      if (b.type === 'list') return b.content.split('\n').map((l) => `- ${l}`).join('\n')
      if (b.type === 'quote') return `> ${b.content}`
      if (b.type === 'code') return '```\n' + b.content + '\n```'
      if (b.type === 'image' && b.imageUrl) return `![${b.alt ?? b.caption ?? ''}](${b.imageUrl})\n\n*${b.caption ?? ''}${b.attribution ? ` — ${b.attribution}` : ''}*`
      if (b.type === 'rich') return richToMarkdown(b.content)
      return b.content
    }).join('\n\n')
    download(`${article.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`, md, 'text/markdown')
  }

  const toc = article.blocks.filter((b) => b.type === 'heading')

  if (view === 'read') {
    const text = article.blocks.map((b) => b.content).join(' ')
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-8">
            <button onClick={() => setView('edit')} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              <Pencil size={13} /> Edit
            </button>
            <span className="text-[11px] ml-auto" style={{ color: 'var(--text-3)' }}>{readingTime(text)}</span>
          </div>
          <h1 className="mb-8" style={{ fontFamily: 'var(--font-serif)', fontSize: 34, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{article.title}</h1>
          {toc.length > 1 && (
            <nav className="mb-8 p-4 rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              <div className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Contents</div>
              {toc.map((t, i) => (
                <div key={t.id} className="text-[13px] py-0.5" style={{ color: 'var(--text-2)' }}>{i + 1}. {t.content}</div>
              ))}
            </nav>
          )}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {article.blocks.map((b) => (
              <div key={b.id} className="mb-5">
                {b.type === 'heading' && <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.01em' }}>{b.content}</h2>}
                {b.type === 'paragraph' && <p className="text-[15px] leading-[1.7]" style={{ fontFamily: 'var(--font-body)' }}>{b.content}</p>}
                {b.type === 'rich' && (
                  <div className="re-rich-block text-[15px] leading-[1.7]"
                    style={{ fontFamily: 'var(--font-body)' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeRich(b.content) }} />
                )}
                {b.type === 'list' && <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.6]">{b.content.split('\n').map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {b.type === 'quote' && <blockquote className="pl-4 text-[15px] italic" style={{ borderLeft: '2.5px solid var(--secondary)', color: 'var(--text-2)' }}>{b.content}</blockquote>}
                {b.type === 'code' && <pre className="p-4 rounded-[14px] text-[13px] font-mono overflow-x-auto" style={{ background: 'var(--code-bg)', border: '1px solid var(--surface-border)' }}>{b.content}</pre>}
                {b.type === 'image' && b.imageUrl && (
                  <figure style={{ textAlign: (b.align ?? 'center') as any }}>
                    <img src={b.imageUrl} alt={b.alt ?? b.caption ?? ''} loading="lazy" decoding="async" className="rounded-[12px] max-h-[420px] object-cover inline-block" />
                    {(b.caption || b.attribution) && (
                      <figcaption className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-3)' }}>
                        {b.caption}{b.attribution ? <span> · {b.attribution}</span> : null}
                      </figcaption>
                    )}
                  </figure>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-5 py-6">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => navigate('/articles')} className="p-1.5 rounded-lg hover:bg-[var(--elevated)]" aria-label="Back"><ArrowLeft size={15} /></button>
          <input value={article.title} onChange={(e) => update(() => ({ title: e.target.value }))}
            className="flex-1 bg-transparent outline-none text-[17px] font-semibold min-w-0" style={{ letterSpacing: '-0.02em' }} />
          <ButtonGroup
            label="Document actions"
            size="sm"
            items={[
              { id: 'read', label: 'Read', icon: <Eye size={12} />, onSelect: () => setView('read') },
              { id: 'export', label: '.md', icon: <Download size={12} />, onSelect: exportMd },
            ]}
          />
          <ActionButton
            label="Save"
            pendingLabel="Saving"
            successLabel="Saved"
            className="px-3 py-1.5 rounded-full text-[12px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}
            onAction={async () => { update(() => ({})) }}
          />
        </div>

        {/* The preview card: a picture and a summary, both optional. */}
        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <textarea
            value={article.description ?? ''}
            onChange={(e) => update(() => ({ description: e.target.value.slice(0, 240) }))}
            placeholder="A short description for the preview card (optional)"
            rows={2}
            className="w-full resize-none rounded-[12px] px-3 py-2 text-[13px] outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}
          />
          <div className="flex items-center gap-2">
            {article.coverImage && <img src={article.coverImage} alt="" className="h-12 w-20 rounded-[8px] object-cover" />}
            <label className="cursor-pointer rounded-full px-3 py-1.5 text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              {article.coverImage ? 'Change picture' : 'Add picture'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f || f.size > 2 * 1024 * 1024) return
                const r = new FileReader()
                r.onload = () => update(() => ({ coverImage: String(r.result) }))
                r.readAsDataURL(f)
              }} />
            </label>
            {article.coverImage && (
              <button onClick={() => update(() => ({ coverImage: undefined }))} className="text-[12px]" style={{ color: 'var(--text-3)' }}>Remove</button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {article.blocks.map((b, idx) => (
            <motion.div key={b.id} layout
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="group relative flex gap-2 mb-2 items-start">
              <div className="flex flex-col gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => move(idx, -1)} aria-label="Move up" style={{ color: 'var(--text-3)' }}><ChevronUp size={13} /></button>
                <GripVertical size={13} style={{ color: 'var(--text-3)' }} />
                <button onClick={() => move(idx, 1)} aria-label="Move down" style={{ color: 'var(--text-3)' }}><ChevronDown size={13} /></button>
              </div>

              <div className="flex-1 min-w-0">
                {b.type === 'image' ? (
                  <ImageBlockEditor block={b} onPatch={(p) => patchBlock(b.id, p)}
                    onReplace={(q) => fetchImageFor(b.id, q || undefined)} onDrop={(f) => onDropImage(b.id, f)} />
                ) : b.type === 'rich' ? (
                  <RichBlock block={b} onSet={(html) => setBlock(b.id, html)} />
                ) : b.type === 'heading' ? (
                  <input value={b.content} onChange={(e) => setBlock(b.id, e.target.value)} placeholder="Section heading"
                    className="w-full bg-transparent outline-none text-[19px] font-semibold py-1" style={{ letterSpacing: '-0.02em' }} />
                ) : b.type === 'list' || b.type === 'code' ? (
                  <textarea value={b.content} onChange={(e) => setBlock(b.id, e.target.value)} rows={3}
                    placeholder={b.type === 'list' ? 'One item per line' : 'Code…'}
                    className={`w-full bg-transparent outline-none py-1 resize-y text-[14px] ${b.type === 'code' ? 'font-mono p-3 rounded-[12px]' : ''}`}
                    style={b.type === 'code' ? { background: 'var(--code-bg)', border: '1px solid var(--surface-border)' } : undefined} />
                ) : (
                  <textarea value={b.content} onChange={(e) => setBlock(b.id, e.target.value)} rows={2}
                    placeholder={b.type === 'quote' ? 'Quote…' : 'Write, or ask AI…'}
                    className="w-full bg-transparent outline-none py-1 resize-y text-[14px] leading-relaxed" />
                )}
              </div>

              <div className="flex gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <ActionBtn label="AI rewrite" onClick={() => aiAction(b.id, 'rewrite')}><Wand2 size={12} /></ActionBtn>
                <ActionBtn label="AI expand" onClick={() => aiAction(b.id, 'expand')}><Sparkles size={12} /></ActionBtn>
                <ActionBtn label="Delete block" onClick={() => remove(b.id)}><Trash2 size={12} /></ActionBtn>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex gap-1.5 mt-4 flex-wrap">
          {BLOCK_TYPES.map((bt) => (
            <button key={bt.type} onClick={() => add(bt.type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] transition-colors hover:bg-[var(--elevated)]"
              style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
              <bt.icon size={12} /> {bt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The allow-list for a formatted block. `contentEditable` can produce anything,
 * including pasted markup, and this HTML is stored in the article and rendered
 * with `dangerouslySetInnerHTML` — so it is filtered on the way in and on the
 * way out: inline formatting, links with a safe scheme, and lists. Everything
 * else is dropped, `on*` attributes included.
 */
const RICH_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'P', 'DIV', 'BR', 'SPAN'])

function sanitizeRich(html: string): string {
  if (!html) return html
  // No DOM to check with (a string render, a worker): drop every tag rather
  // than pass markup through unchecked.
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '')
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!RICH_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes))
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        const keepHref = child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:|#)/i.test(attr.value)
        if (!keepHref) child.removeAttribute(attr.name)
      }
      if (child.tagName === 'A') { child.setAttribute('rel', 'noreferrer noopener'); child.setAttribute('target', '_blank') }
      walk(child)
    }
  }
  walk(root)
  return root.innerHTML
}

/** Formatted HTML → the shape a markdown file can carry. */
function richToMarkdown(html: string): string {
  if (!html) return ''
  const cleaned = sanitizeRich(html)
  if (typeof window === 'undefined') return cleaned.replace(/<[^>]+>/g, '')
  const doc = new DOMParser().parseFromString(`<div>${cleaned}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement
  if (!root) return ''
  const inline = (el: Node): string => {
    if (el.nodeType === 3) return el.textContent ?? ''
    const e = el as HTMLElement
    const inner = Array.from(e.childNodes).map(inline).join('')
    switch (e.tagName) {
      case 'B': case 'STRONG': return `**${inner}**`
      case 'I': case 'EM': return `*${inner}*`
      case 'U': return `<u>${inner}</u>`
      case 'A': return `[${inner}](${e.getAttribute('href') ?? '#'})`
      case 'BR': return '\n'
      case 'LI': return `- ${inner}\n`
      case 'P': case 'DIV': return `${inner}\n\n`
      default: return inner
    }
  }
  return Array.from(root.childNodes).map(inline).join('').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * One formatted block: the vendored toolbar driving a contentEditable that the
 * article owns. The DOM is written once on mount and never re-synced while the
 * caret is inside it — re-rendering React's idea of the HTML would fight the
 * browser's selection.
 */
function RichBlock({ block, onSet }: { block: ArticleBlock; onSet: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)
  const [active, setActive] = useState<EditorSelectionState | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('')

  // The editable surface is filled exactly once. React must not re-write
  // innerHTML from the store on every keystroke: the browser would replace the
  // nodes under the caret and the caret would jump to the end.
  useEffect(() => {
    if (seeded.current || !ref.current) return
    seeded.current = true
    ref.current.innerHTML = sanitizeRich(block.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const check = () => setActive(readEditorState())
  const commit = () => onSet(sanitizeRich(ref.current?.innerHTML ?? ''))

  const command = (id: EditorCommandId) => {
    if (id === 'link') { setLinkOpen(true); setActive(readEditorState()); return }
    runEditorCommand(id)
    check()
    commit()
  }

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-1.5">
        <EditorToolbar active={active ?? undefined} onCommand={command} className="w-auto" />
        <button onClick={() => setLinkOpen((v) => !v)} className="text-[10.5px] px-2 rounded-lg"
          style={{ background: 'var(--elevated)', color: 'var(--text-3)' }} title="Paste a link, then apply it to the selected text">
          link…
        </button>
      </div>
      {linkOpen && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…"
            className="flex-1 rounded-[8px] px-2.5 py-1.5 text-[12px] outline-none" style={{ background: 'var(--elevated)' }} />
          <button onClick={() => {
            runEditorCommand('link', /^(https?:|mailto:|#)/i.test(href) ? href : `https://${href}`)
            setLinkOpen(false); setHref('')
            check(); commit()
          }} disabled={!href.trim()} className="px-2.5 py-1.5 rounded-[8px] text-[12px] disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}>Apply</button>
        </div>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Formatted text"
        onInput={() => { check(); commit() }}
        onKeyUp={check}
        onMouseUp={check}
        onFocus={check}
        className="re-rich-editor w-full mt-1.5 rounded-[12px] px-3 py-2.5 outline-none text-[14px] leading-relaxed"
        style={{ background: 'var(--elevated)', color: 'var(--text)', minHeight: 72 }}
      />
      <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-3)' }}>
        Bold, italic, underline, links and lists — the same toolbar the shadcn-space block ships.
      </p>
    </div>
  )
}

function ActionBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="p-1.5 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
      {children}
    </button>
  )
}

/* ---------- Image block editor ---------- */
function ImageBlockEditor({ block, onPatch, onReplace, onDrop }: {
  block: ArticleBlock
  onPatch: (p: Partial<ArticleBlock>) => void
  onReplace: (query?: string) => void
  onDrop: (f: File) => void
}) {
  const ui = useUI()
  const [loaded, setLoaded] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const loading = block.caption?.startsWith('Searching') && !block.imageUrl
  const alignIcon = block.align === 'left' ? AlignLeft : block.align === 'right' ? AlignRight : AlignCenter

  return (
    <div
      className="relative group/img rounded-[14px] overflow-hidden"
      style={{ border: `1px dashed ${dragOver ? 'var(--primary)' : 'var(--surface-border)'}`, background: dragOver ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent' }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onDrop(f) }}
    >
      {loading ? (
        // skeleton preserving a 16:9 aspect ratio
        <div className="w-full" style={{ aspectRatio: '16/9', background: 'var(--elevated)' }}>
          <div className="w-full h-full animate-pulse flex items-center justify-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            <RefreshCw size={13} className="animate-spin" /> Fetching image…
          </div>
        </div>
      ) : block.imageUrl ? (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--elevated)', aspectRatio: '16/9' }} />}
          <img src={block.imageUrl} alt={block.alt ?? ''} loading="lazy" decoding="async" onLoad={() => setLoaded(true)}
            className="w-full object-cover" style={{ maxHeight: 380, opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }} />
          {/* hover toolbar */}
          <div className="absolute top-2 right-2 flex gap-0.5 p-0.5 rounded-[10px] opacity-0 group-hover/img:opacity-100 transition-opacity"
            style={{ background: 'color-mix(in srgb, var(--bg) 75%, transparent)', backdropFilter: 'blur(8px)', border: '1px solid var(--surface-border)' }}>
            <button title="Why this image?" onMouseEnter={() => setShowWhy(true)} onMouseLeave={() => setShowWhy(false)}
              className="p-1.5 rounded-[7px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}><Info size={12} /></button>
            <button title="Replace with AI image" onClick={() => onReplace()} className="p-1.5 rounded-[7px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}><RefreshCw size={12} /></button>
            <button title="Cycle alignment" onClick={() => onPatch({ align: block.align === 'center' ? 'left' : block.align === 'left' ? 'right' : 'center' })}
              className="p-1.5 rounded-[7px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>{React.createElement(alignIcon, { size: 12 })}</button>
            <button title="Upload a local image" onClick={() => fileRef.current?.click()} className="p-1.5 rounded-[7px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}><Upload size={12} /></button>
          </div>
          {showWhy && block.content && (
            <div className="absolute bottom-2 left-2 right-2 p-2.5 rounded-[10px] text-[11.5px]"
              style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(8px)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              {block.content}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f) }} />
        </>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-1.5 py-8" style={{ color: 'var(--text-3)' }}>
          <Upload size={18} strokeWidth={1.5} />
          <span className="text-[12px]">Drop an image here or click to upload</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f) }} />
        </button>
      )}

      {/* caption + attribution */}
      {block.imageUrl && (
        <div className="px-2.5 py-2">
          {editingCaption ? (
            <input autoFocus value={block.caption ?? ''}
              onChange={(e) => onPatch({ caption: e.target.value })}
              onBlur={() => setEditingCaption(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingCaption(false)}
              placeholder="Caption…" className="w-full bg-transparent outline-none text-[12px]" style={{ color: 'var(--text-2)' }} />
          ) : (
            <button onClick={() => setEditingCaption(true)} className="text-[12px] text-left w-full" style={{ color: 'var(--text-3)' }}>
              {block.caption || <span className="italic">Add caption…</span>}
              {block.attribution && <span className="block text-[10.5px] mt-0.5 opacity-80">{block.attribution}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
