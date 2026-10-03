/**
 * For you — the recommendations feed.
 *
 * The old panel was a list of links with a reason under each one. This is the
 * other half of the app: a reader. The reference is the news feed in Perplexity
 * and any good RSS app, and the four things that make that shape work are all
 * here:
 *
 *   • a headline carries the weight, the summary is a paragraph under it, and
 *     the source is a small line — never a link farm;
 *   • stories are grouped by the day they arrived (Today, Yesterday, Earlier),
 *     because "when" is half of what makes a feed readable;
 *   • the topics you watch are a rail above the feed, and picking one filters
 *     it — a feed you cannot narrow is a firehose;
 *   • every story says which watch produced it and who published it. Nothing
 *     here is inferred from behaviour: it comes from your tags and your feeds,
 *     or it does not appear.
 *
 * Dismissing is local and permanent (a link key in localStorage): an RSS reader
 * that brings back what you threw away is worse than one that shows nothing.
 * Saving goes to the same library as everything else, and reading opens the
 * source viewer rather than a new tab.
 */
import React, { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Sparkles, RefreshCw, Star, ExternalLink, X, Rss, Hash, Clock, AlertTriangle,
  BookOpen, Compass, Check,
} from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { readJsonResponse } from '@/lib/net/json'

export interface Story {
  title: string
  link: string
  summary?: string
  at?: string
  reason: string
  /** The URL the story came from; optional because a hit may only have a title. */
  source?: string
  favicon?: string
  topic?: string
  via?: 'feed' | 'tag'
  publisher?: string
}

interface Watching { tags: string[]; feeds: { id: string; title: string; url: string }[]; topics?: string[] }

const DISMISS_KEY = 're.library.dismissed'
const readDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[] } catch { return [] }
}

/** Today / Yesterday / Earlier — the only three buckets a feed needs. */
function dayOf(at?: string): 'today' | 'yesterday' | 'earlier' | 'undated' {
  if (!at) return 'undated'
  const t = Date.parse(at)
  if (Number.isNaN(t)) return 'undated'
  const start = new Date(); start.setHours(0, 0, 0, 0)
  if (t >= start.getTime()) return 'today'
  if (t >= start.getTime() - 86400000) return 'yesterday'
  return 'earlier'
}
const DAY_LABEL: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier', undated: 'Undated' }

export function RecommendationsPanel({ recs, hint, busy, tookMs, watching, notes, onRefresh, onSave, onOpen }: {
  recs: Story[]
  hint?: string
  busy: boolean
  tookMs: number | null
  watching?: Watching
  notes?: string[]
  onRefresh: () => void
  onSave: (r: Story) => void
  onOpen: (r: Story) => void
}) {
  const reduce = useReducedMotion()
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed())
  const [topic, setTopic] = useState<string>('all')
  const [saved, setSaved] = useState<string[]>([])

  const keyOf = (r: Story) => r.link || r.title
  const topics = useMemo(() => {
    const fromStories = recs.map((r) => r.topic).filter(Boolean) as string[]
    return [...new Set([...(watching?.topics ?? []), ...fromStories])]
  }, [recs, watching])

  const shown = useMemo(() => {
    const kept = recs.filter((r) => !dismissed.includes(keyOf(r)))
    return topic === 'all' ? kept : kept.filter((r) => r.topic === topic)
  }, [recs, dismissed, topic])

  const groups = useMemo(() => {
    const order: ('today' | 'yesterday' | 'earlier' | 'undated')[] = ['today', 'yesterday', 'earlier', 'undated']
    return order
      .map((d) => ({ day: d, items: shown.filter((r) => dayOf(r.at) === d) }))
      .filter((g) => g.items.length > 0)
  }, [shown])

  const dismiss = useCallback((r: Story) => {
    const key = keyOf(r)
    setDismissed((list) => {
      const next = [...list, key].slice(-200)
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of recs) {
      if (dismissed.includes(keyOf(r))) continue
      if (r.topic) m.set(r.topic, (m.get(r.topic) ?? 0) + 1)
    }
    return m
  }, [recs, dismissed])

  return (
    <div className="surface p-3.5" data-ui="recommendations-feed">
      {/* header: what this feed is watching, in numbers, not adjectives */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} style={{ color: 'var(--secondary)' }} />
        <h3 className="text-[12.5px] font-medium flex-1">For you</h3>
        <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
          {watching?.tags.length ?? 0} tag{(watching?.tags.length ?? 0) === 1 ? '' : 's'} · {watching?.feeds.length ?? 0} feed{(watching?.feeds.length ?? 0) === 1 ? '' : 's'}
          {tookMs !== null && !busy ? ` · ${tookMs} ms` : ''}
        </span>
        <button onClick={onRefresh} title="Look again" className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
          <RefreshCw size={11} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* the topic rail — the watch list, as a filter rather than a caption */}
      {(topics.length > 1 || (watching?.tags.length ?? 0) > 1) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1">
          <button onClick={() => setTopic('all')}
            className="relative shrink-0 px-2.5 py-1 rounded-full text-[11px]"
            style={{ color: topic === 'all' ? 'var(--text)' : 'var(--text-3)' }}>
            {topic === 'all' && (
              <motion.span layoutId="rec-topic" className="absolute inset-0 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--secondary) 18%, var(--surface))', border: '1px solid color-mix(in srgb, var(--secondary) 38%, transparent)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
            )}
            <span className="relative z-10">Everything</span>
          </button>
          {topics.map((t) => (
            <button key={t} onClick={() => setTopic(t)}
              className="relative shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]"
              style={{ color: topic === t ? 'var(--text)' : 'var(--text-3)' }}>
              {topic === t && (
                <motion.span layoutId="rec-topic" className="absolute inset-0 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--secondary) 18%, var(--surface))', border: '1px solid color-mix(in srgb, var(--secondary) 38%, transparent)' }}
                  transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
              )}
              <span className="relative z-10 flex items-center gap-1">
                {t.startsWith('#') ? <Hash size={9} /> : <Rss size={9} />}
                {t.replace(/^#/, '')}
                <span style={{ color: 'var(--text-3)' }}>{counts.get(t) ?? 0}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* the feed */}
      <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
        {busy && !recs.length && (
          <div className="flex flex-col gap-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <motion.div className="h-2.5 rounded-full" style={{ background: 'var(--elevated)', width: '62%' }}
                  animate={reduce ? {} : { opacity: [0.4, 0.85, 0.4] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.12 }} />
                <motion.div className="h-2 rounded-full" style={{ background: 'var(--elevated)', width: '90%' }}
                  animate={reduce ? {} : { opacity: [0.4, 0.85, 0.4] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.12 + 0.06 }} />
              </div>
            ))}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.day}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text-3)' }}>{DAY_LABEL[g.day]}</span>
              <span className="flex-1 h-px" style={{ background: 'var(--surface-border)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{g.items.length}</span>
            </div>
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {g.items.map((r, i) => {
                  const key = keyOf(r)
                  const isSaved = saved.includes(key)
                  return (
                    <motion.article
                      key={key}
                      layout
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.26, delay: reduce ? 0 : Math.min(0.2, i * 0.03) }}
                      className="group relative py-2.5"
                      style={{ borderTop: '1px solid var(--surface-border)' }}>
                      {r.favicon && (
                        <img src={r.favicon} alt="" width={13} height={13} className="rounded-[3px] absolute left-0 top-3.5"
                          referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                      <div className={r.favicon ? 'pl-5' : ''}>
                        <h4 className="text-[13.5px] leading-snug font-medium">
                          {r.link
                            ? <button onClick={() => onOpen(r)} className="text-left hover:underline" style={{ color: 'var(--text)' }}>{r.title}</button>
                            : <span style={{ color: 'var(--text)' }}>{r.title}</span>}
                        </h4>
                        {r.summary && (
                          <p className="text-[12px] leading-[1.6] mt-1 line-clamp-2" style={{ color: 'var(--text-2)' }}>{r.summary}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                          <span style={{ color: 'var(--text-2)' }}>{r.publisher ?? r.topic ?? 'a source'}</span>
                          {r.at && <><Clock size={9} /><span>{timeAgo(Date.parse(r.at))}</span></>}
                          <span
                            className="px-1.5 py-0.5 rounded-full"
                            style={{
                              background: r.via === 'feed' ? 'color-mix(in srgb, var(--secondary) 14%, transparent)' : 'color-mix(in srgb, var(--primary) 14%, transparent)',
                              color: 'var(--text-2)',
                            }}>
                            {r.reason}
                          </span>
                        </div>
                      </div>

                      {/* actions fade in on hover, like a reader's row tools */}
                      <div className="flex items-center gap-1 absolute right-0 top-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={() => { onSave(r); setSaved((s) => [...s, key]) }}
                          title={isSaved ? 'Saved' : 'Save to the library'}
                          className="p-1.5 rounded-full"
                          style={{ background: 'var(--elevated)', color: isSaved ? 'var(--secondary)' : 'var(--text-2)' }}>
                          {isSaved ? <Check size={11} /> : <Star size={11} />}
                        </button>
                        {r.link && (
                          <button onClick={() => onOpen(r)} title="Read it here" className="p-1.5 rounded-full"
                            style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                            <BookOpen size={11} />
                          </button>
                        )}
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noreferrer noopener" title="Open in your browser"
                            className="p-1.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <button onClick={() => dismiss(r)} title="Not interested — never show this again"
                          className="p-1.5 rounded-full" style={{ background: 'var(--elevated)', color: 'var(--text-3)' }}>
                          <X size={11} />
                        </button>
                      </div>
                    </motion.article>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}

        {!busy && shown.length === 0 && (
          <div className="pt-1">
            <p className="text-[11.5px] leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
              {recs.length > 0 && dismissed.length > 0 && topic === 'all'
                ? 'Everything here has been dismissed. Nothing comes back from the bin — add a tag or a feed to see something new.'
                : hint && /could not|did not|refused|offline|HTTP/i.test(hint)
                  ? hint
                  : watching?.tags.length || watching?.feeds.length
                    ? (topic === 'all' ? 'Nothing new from what you watch. The tags and feeds on this screen are the whole list — recommendations never guess.' : `Nothing new under ${topic.replace(/^#/, '')} right now.`)
                    : 'This feed is empty because nothing is being watched yet. Add a tag to something you save, or an RSS feed, and stories appear here — one row per source, dated, and never invented.'}
            </p>
            {/* The reason a feed is empty and the way to ask again, together —
                a refresh icon alone is not a retry when something failed. */}
            <button onClick={onRefresh} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium disabled:opacity-50"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              <RefreshCw size={11} className={busy ? 'animate-spin' : ''} /> Retry
            </button>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {watching?.tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  <Hash size={9} />{t}
                </span>
              ))}
              {watching?.feeds.map((f) => (
                <span key={f.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  <Rss size={9} />{f.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {notes && notes.length > 0 && (
          <ul className="text-[10.5px] space-y-0.5" style={{ color: 'var(--text-3)' }}>
            {notes.map((n, i) => <li key={i} className="flex items-start gap-1.5"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{n}</li>)}
          </ul>
        )}

        {/* the hunt: a deliberate action, not a recommendation pretending to be one */}
        {topics.length > 0 && (
          <div className="pt-1 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <span className="flex items-center gap-1.5 text-[10.5px] pt-2" style={{ color: 'var(--text-3)' }}>
              <Compass size={10} /> Hunt for inspiration on
            </span>
            {topics.slice(0, 4).map((t) => {
              const q = t.replace(/^#/, '')
              return (
                <a key={t} href={`https://refero.design/?q=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer noopener"
                  className="mt-2 px-2 py-0.5 rounded-full text-[10.5px] hover:underline"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  {q} in Refero
                </a>
              )
            })}
            {topics[0] && (
              <a href={`https://www.awwwards.com/websites/?text=${encodeURIComponent(topics[0].replace(/^#/, ''))}`} target="_blank" rel="noreferrer noopener"
                className="mt-2 px-2 py-0.5 rounded-full text-[10.5px] hover:underline"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                {topics[0].replace(/^#/, '')} on Awwwards
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RecommendationsPanel
