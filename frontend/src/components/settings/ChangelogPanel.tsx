/**
 * Every version, as a page you select — not a wall of text.
 *
 * The Updates tab used to describe only the update in front of you. This is the
 * record behind it: all twenty-nine published versions, newest first, in a rail
 * on the left, and the selected version rendered on the right as a page with its
 * own sections, dates and counts.
 *
 * Three decisions worth naming:
 *
 *   • the data is bundled (`lib/updates/changelog.ts`, generated from the GitHub
 *     release bodies and committed). The repository is private and the app is
 *     offline-first: a changelog that needs the network is not a changelog.
 *   • the rail is a real list with keyboard navigation — ↑/↓ move between
 *     versions, Home jumps to the running build, End to the first release — and
 *     the search box filters by number or by any word in the notes.
 *   • no motion repeats. Selecting a version slides the content from the side you
 *     travelled (older ones from the right, newer from the left); the section
 *     cards stagger in; the counts tick up; the row highlight glides. Four
 *     different movements for four different events.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Search, Star, Flag, Wrench, Sparkles, MinusCircle, RefreshCw, ArrowLeft, ArrowRight,
  Tag, ExternalLink, ChevronRight, Package,
} from 'lucide-react'
import { CHANGELOG, kindOf, findRelease, type ChangeKind, type Release } from '@/lib/updates/changelog'

const KIND: Record<ChangeKind, { label: string; Icon: React.ElementType; tone: string }> = {
  added: { label: 'new', Icon: Sparkles, tone: 'var(--success)' },
  fixed: { label: 'fixed', Icon: Wrench, tone: 'var(--warning)' },
  changed: { label: 'changed', Icon: RefreshCw, tone: 'var(--primary)' },
  polish: { label: 'polish', Icon: Star, tone: 'var(--secondary)' },
  removed: { label: 'removed', Icon: MinusCircle, tone: 'var(--danger)' },
}

const pretty = (v: string) => v.split('.').slice(0, 3).join('.')
const when = (date: string) => {
  const d = new Date(`${date}T00:00:00`)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A tiny count that ticks up — the one number worth animating here. */
function Tick({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) { setN(value); return }
    let frame = 0
    const from = n
    const start = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 420)
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <>{n}</>
}

export function ChangelogPanel({ runningVersion }: { runningVersion?: string }) {
  const reduce = useReducedMotion()
  const running = useMemo(() => (runningVersion ? findRelease(runningVersion) : undefined), [runningVersion])
  const [selected, setSelected] = useState<string>(() => CHANGELOG[0]?.version ?? '')
  const [q, setQ] = useState('')
  const railRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return CHANGELOG
    return CHANGELOG.filter((r) =>
      r.version.includes(needle.replace(/^v/, ''))
      || r.name.toLowerCase().includes(needle)
      || r.summary.toLowerCase().includes(needle)
      || r.sections.some((s) => s.items.some((i) => `${i.label ?? ''} ${i.text}`.toLowerCase().includes(needle))))
  }, [q])

  const index = filtered.findIndex((r) => r.version === selected)
  const release: Release | undefined = filtered[index] ?? filtered[0]
  const direction = useRef(0)   // -1 = older (we moved down the list), 1 = newer

  const go = (delta: number) => {
    const at = filtered.findIndex((r) => r.version === (release?.version ?? ''))
    const next = filtered[Math.max(0, Math.min(filtered.length - 1, at + delta))]
    if (!next || next.version === release?.version) return
    direction.current = delta > 0 ? -1 : 1
    setSelected(next.version)
  }

  // Keyboard: the rail is the control that matters, so it owns the arrows.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
    else if (e.key === 'Home' && running) { e.preventDefault(); setSelected(running.version) }
    else if (e.key === 'End') { e.preventDefault(); setSelected(CHANGELOG[CHANGELOG.length - 1]?.version ?? '') }
  }

  // Bring the selected row into view inside the rail only — the frame is not
  // allowed to move (lib/dom/scroll.ts).
  useEffect(() => {
    const rail = railRef.current
    if (!rail || !release) return
    const row = rail.querySelector<HTMLElement>(`[data-version="${release.version}"]`)
    if (!row) return
    const rTop = rail.getBoundingClientRect().top
    const rowTop = row.getBoundingClientRect().top
    const offset = rowTop - rTop
    if (offset < 0) rail.scrollTop += offset - 6
    else if (offset + row.offsetHeight > rail.clientHeight) rail.scrollTop += offset + row.offsetHeight - rail.clientHeight + 6
  }, [release])

  return (
    <div className="flex flex-col gap-3" data-ui="changelog" onKeyDown={onKey} tabIndex={-1}>
      <div className="flex flex-wrap items-center gap-2">
        <Package size={13} style={{ color: 'var(--primary)' }} />
        <h3 className="text-[13px] font-medium">Everything that has shipped</h3>
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          {CHANGELOG.length} versions · {CHANGELOG[CHANGELOG.length - 1]?.version} to {CHANGELOG[0]?.version}
        </span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Version or a word from the notes"
            className="rounded-full pl-7 pr-3 py-1.5 text-[11.5px] outline-none w-[220px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
        </div>
      </div>

      <div className="flex gap-3 min-h-[520px]">
        {/* the rail */}
        <div ref={railRef} className="w-[224px] shrink-0 overflow-y-auto rounded-[16px] p-1.5"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', maxHeight: 560 }}>
          {filtered.length === 0 && (
            <p className="text-[11px] p-2" style={{ color: 'var(--text-3)' }}>No version matches “{q}”.</p>
          )}
          {filtered.map((r) => {
            const active = r.version === release?.version
            const isRunning = running?.version === r.version
            return (
              <button key={r.version} data-version={r.version} onClick={() => { direction.current = CHANGELOG.indexOf(r) > CHANGELOG.indexOf(release as Release) ? -1 : 1; setSelected(r.version) }}
                className="relative w-full text-left px-2.5 py-2 rounded-[12px]"
                style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}>
                {active && (
                  <motion.span layoutId="cl-row" className="absolute inset-0 rounded-[12px]"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}
                    transition={{ type: 'spring', stiffness: 560, damping: 44 }} />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <span className="text-[11.5px] font-medium tabular-nums">v{pretty(r.version)}</span>
                  {isRunning && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' }}>running</span>
                  )}
                  <span className="flex-1" />
                  <span className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>{r.counts.items}</span>
                </span>
                <span className="relative z-10 block text-[10.5px] truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {r.name || r.summary}
                </span>
                <span className="relative z-10 block text-[9.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>{when(r.date)}</span>
              </button>
            )
          })}
        </div>

        {/* the page for the selected version */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {release && (
              <motion.div key={release.version}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 26 * direction.current }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 * direction.current }}
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                className="surface p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                    <Tag size={9} /> v{pretty(release.version)}
                    {/-beta|-alpha/.test(release.tag) && <span style={{ color: 'var(--text-3)' }}>· {release.tag.replace(/^v?\d+(\.\d+)+-/, '')}</span>}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{when(release.date)}</span>
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                    <ChevronRight size={10} /> {release.counts.sections} sections · <Tick value={release.counts.items} /> notes
                  </span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <button onClick={() => go(-1)} disabled={filtered.findIndex((r) => r.version === release.version) === 0}
                      title="Newer (↑)" className="p-1.5 rounded-full disabled:opacity-30"
                      style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}><ArrowLeft size={11} /></button>
                    <button onClick={() => go(1)} disabled={filtered.findIndex((r) => r.version === release.version) === filtered.length - 1}
                      title="Older (↓)" className="p-1.5 rounded-full disabled:opacity-30"
                      style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}><ArrowRight size={11} /></button>
                    <a href={release.url} target="_blank" rel="noreferrer noopener" title="This release on GitHub"
                      className="p-1.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}><ExternalLink size={11} /></a>
                  </div>
                </div>

                <h4 className="text-[16px] font-semibold mt-2.5 leading-snug" style={{ letterSpacing: '-0.01em' }}>
                  {release.name || `Version ${pretty(release.version)}`}
                </h4>
                <p className="text-[12.5px] leading-relaxed mt-1.5" style={{ color: 'var(--text-2)' }}>{release.summary}</p>
                {running?.version === release.version && (
                  <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                    <Flag size={10} /> This is the version you are running.
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-3">
                  {release.sections.map((section, si) => {
                    const kind = KIND[kindOf(section.title)]
                    return (
                      <motion.section key={section.title + si}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(0.28, si * 0.06) }}
                        className="rounded-[14px] p-3"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: `color-mix(in srgb, ${kind.tone} 16%, transparent)`, color: kind.tone }}>
                            <kind.Icon size={9} /> {kind.label}
                          </span>
                          <h5 className="text-[12.5px] font-medium flex-1">{section.title}</h5>
                          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{section.items.length}</span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {section.items.map((item, ii) => (
                            <li key={ii} className="flex items-start gap-2 text-[12px] leading-[1.6]" style={{ color: 'var(--text-2)' }}>
                              <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: kind.tone }} />
                              <span>
                                {item.label && <b className="font-medium" style={{ color: 'var(--text)' }}>{item.label} — </b>}
                                {item.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </motion.section>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10.5px] mt-2 flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
            <span>↑ ↓ move between versions · Home goes to the running build · End goes to the first release</span>
            <span className="flex-1" />
            <span>{CHANGELOG.filter((r) => r.date === release?.date).length > 1 ? 'Several versions shipped on this date.' : ''}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChangelogPanel
