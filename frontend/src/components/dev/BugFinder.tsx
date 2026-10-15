/**
 * Bug finder (developer mode only).
 *
 * Alt+Shift+B starts pick mode. Hover to highlight an element, click to pick it.
 * The app then writes a bug report on its own: the page, the element (selector,
 * tag, text, a short HTML excerpt), the viewport, the browser and the time. You
 * can add a line of your own, attach a screenshot, then copy the report or
 * download it as a Markdown file (with the screenshot, if one was attached).
 *
 * The app does not take screenshots itself. Attach one you took yourself.
 */
import { useEffect, useRef, useState } from 'react'
import { Bug, Copy, Download, Image as ImageIcon, X } from 'lucide-react'
import { useExam } from '@/stores/useExam'

interface Pick {
  selector: string
  tag: string
  label: string
  text: string
  html: string
  rect: { x: number; y: number; w: number; h: number }
}

const HOTKEY = { alt: true, shift: true, key: 'b' }

/** A CSS path that identifies the element well enough to find it again. */
function selectorOf(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body && parts.length < 6) {
    let part = node.tagName.toLowerCase()
    const cls = [...node.classList].filter((c) => !/^(is|has|js)-|:/.test(c)).slice(0, 2)
    if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('')
    const parent: Element | null = node.parentElement
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === node!.tagName)
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join(' > ')
}

function describe(el: Element): Pick {
  const r = el.getBoundingClientRect()
  return {
    selector: selectorOf(el),
    tag: el.tagName.toLowerCase(),
    label: el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '',
    text: ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
    html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 400),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
  }
}

function isOwnUi(el: Element | null): boolean {
  return !!el?.closest('[data-bug-finder]')
}

function buildReport(p: Pick, note: string, attachment: string | null): string {
  const lines = [
    '# Bug report',
    '',
    note.trim() ? `**Summary:** ${note.trim()}` : '**Summary:** (add one line describing what went wrong)',
    '',
    '## Where',
    `- Page: ${location.href}`,
    `- Viewport: ${window.innerWidth}×${window.innerHeight}, device pixel ratio ${window.devicePixelRatio}`,
    `- Browser: ${navigator.userAgent}`,
    `- Time: ${new Date().toISOString()}`,
    '',
    '## Element',
    `- Selector: \`${p.selector}\``,
    `- Tag: \`${p.tag}\``,
    p.label ? `- Label: ${p.label}` : null,
    `- Box: x ${p.rect.x}, y ${p.rect.y}, ${p.rect.w}×${p.rect.h}`,
    p.text ? `- Text: ${p.text}` : null,
    '',
    '```html',
    p.html,
    '```',
    '',
    attachment ? `## Screenshot\nAttached: ${attachment}` : null,
  ]
  return lines.filter((l) => l !== null).join('\n')
}

export function BugFinder() {
  const [picking, setPicking] = useState(false)
  const [hover, setHover] = useState<DOMRect | null>(null)
  const [picked, setPicked] = useState<Pick | null>(null)
  const [note, setNote] = useState('')
  const [shot, setShot] = useState<{ name: string; url: string; blob: Blob } | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // An exam owns the screen: leave pick mode when one starts, and do not start it during one.
  useEffect(() => useExam.subscribe((s) => {
    if (s.active && !s.finished) { setPicking(false); setPicked(null) }
  }), [])

  // Hotkey: toggle pick mode. Escape leaves it or closes the report.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const examRunning = useExam.getState().active && !useExam.getState().finished
      if (examRunning) return
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === HOTKEY.key) {
        e.preventDefault()
        setPicking((v) => !v)
        setPicked(null)
      } else if (e.key === 'Escape') {
        setPicking(false)
        setPicked(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While picking: track the hovered element and capture the click.
  useEffect(() => {
    if (!picking) { setHover(null); return }
    const move = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      setHover(el && !isOwnUi(el) ? el.getBoundingClientRect() : null)
    }
    const click = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isOwnUi(el)) return
      e.preventDefault()
      e.stopPropagation()
      setPicked(describe(el))
      setNote('')
      setPicking(false)
    }
    document.addEventListener('mousemove', move, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('mousemove', move, true)
      document.removeEventListener('click', click, true)
    }
  }, [picking])

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url) }, [shot])

  const attachFile = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return
    if (shot) URL.revokeObjectURL(shot.url)
    setShot({ name: f.name, url: URL.createObjectURL(f), blob: f })
  }

  const report = picked ? buildReport(picked, note, shot?.name ?? null) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked: the download still works */ }
  }

  const download = () => {
    const save = (blob: Blob, name: string) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    save(new Blob([report], { type: 'text/markdown' }), `bug-report-${stamp}.md`)
    if (shot) save(shot.blob, shot.name)
  }

  return (
    <div data-bug-finder>
      {picking && (
        <>
          <div className="pointer-events-none fixed inset-0 z-[260] cursor-crosshair" style={{ background: 'rgba(0,0,0,0.04)' }} />
          {hover && (
            <div className="pointer-events-none fixed z-[261] rounded-[4px]"
              style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height, outline: '2px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }} />
          )}
          <div className="fixed left-1/2 top-3 z-[262] -translate-x-1/2 rounded-full px-4 py-1.5 text-[12px] flex items-center gap-2"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
            <Bug size={13} /> Click the element with the bug · Esc to cancel
          </div>
        </>
      )}

      {picked && (
        <div className="fixed bottom-4 right-4 z-[262] w-[min(420px,calc(100vw-2rem))] surface p-4 shadow-xl"
          role="dialog" aria-label="Bug report">
          <div className="flex items-center gap-2 mb-3">
            <Bug size={14} style={{ color: 'var(--primary)' }} />
            <span className="text-[13px] font-semibold flex-1">Bug report</span>
            <button type="button" aria-label="Close bug report" onClick={() => setPicked(null)} className="ide-icon-btn">
              <X size={13} />
            </button>
          </div>
          <div className="text-[11.5px] mb-2 font-mono truncate" style={{ color: 'var(--text-3)' }} title={picked.selector}>{picked.selector}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What went wrong? (one line)"
            className="w-full rounded-[10px] px-3 py-2 text-[12.5px] mb-2"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-full"
              style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
              <ImageIcon size={12} /> {shot ? 'Change screenshot' : 'Attach screenshot'}
            </button>
            {shot && <span className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{shot.name}</span>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => attachFile(e.target.files?.[0])} />
          </div>
          <pre className="max-h-[140px] overflow-auto rounded-[10px] p-2 text-[10.5px] whitespace-pre-wrap" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>{report}</pre>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={copy} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-1)' }}>
              <Copy size={12} /> {copied ? 'Copied' : 'Copy report'}
            </button>
            <button type="button" onClick={download} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full" style={{ background: 'var(--primary)', color: '#fff' }}>
              <Download size={12} /> Download
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
