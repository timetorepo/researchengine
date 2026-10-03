/**
 * Library search.
 *
 * The gooey input is the front door: type a question, press Enter, and the
 * backend fans the same query out to Wikipedia's own API, to the search ladder
 * the chat already uses (SearXNG when the user runs one, then the keyless
 * engines), and to the documents already in this app. Results come back
 * labelled with where they came from and never blended together, because a
 * Wikipedia article and a blog post are not the same evidence.
 *
 * Saving is first-class: every hit can go into a folder with tags, the folders
 * are real (a table, so they survive a restart), and what you tagged becomes
 * what gets recommended — plus any RSS feed you add. Nothing is recommended
 * that you did not ask to watch.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  BookOpen, Globe, FileText, Plus, Trash2, Tag, Rss, Upload, RefreshCw, FolderPlus,
  Folder as FolderIcon, Check, Star, Sparkles, AlertTriangle, BookMarked, Loader2,
} from 'lucide-react'
import { GooeyInput } from '@/components/ui/aceternity/GooeyInput'
import AnimatedTags from '@/components/smoothui/animated-tags'
import { Button } from '@/components/ui/heroui/Button'
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/modal'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { notifyRecommendations } from '@/lib/notifications/store'
import { readJsonResponse } from '@/lib/net/json'
import { nanoid } from 'nanoid'
import { timeAgo } from '@/lib/utils'

interface Hit {
  id: string
  kind: 'wikipedia' | 'source' | 'document'
  title: string
  url?: string
  snippet?: string
  source: string
  favicon?: string
  icon?: string
}

interface Item {
  id: string
  kind: string
  title: string
  url?: string
  snippet?: string
  tags: string[]
  folderId?: string | null
  savedAt: number
  extra?: any
}

interface Folder { id: string; name: string; createdAt: number }
interface SourceStatus { id: string; label: string; state: 'pending' | 'ok' | 'error'; count: number; ms: number; reason?: string }
interface Recommendation { title: string; link: string; summary?: string; reason: string; favicon?: string }

const KIND_META: Record<string, { label: string; Icon: React.ElementType; tone: string }> = {
  wikipedia: { label: 'Wikipedia', Icon: BookOpen, tone: 'var(--primary)' },
  source: { label: 'Trusted sources', Icon: Globe, tone: 'var(--secondary)' },
  document: { label: 'Your documents', Icon: FileText, tone: 'var(--success)' },
}

/**
 * Why a search fetch itself failed. The server's own messages are already
 * sentences; this only handles the case where the request never got an answer
 * at all, which is exactly the case that used to leave the screen empty.
 */
function describeFetchError(e: unknown, url: string): string {
  const err = e as any
  if (err instanceof TypeError) {
    return `Could not reach the local server for ${url} (${String(err.message || 'the request failed')}). The backend may not be running — Settings → About has a health row.`
  }
  return String(err?.message ?? err)
}

/** The honest one-liner for a lane, used under the results. */
function sourceLine(s: SourceStatus): string {
  if (s.state === 'pending') return `${s.label}: still looking…`
  if (s.state === 'error') return `${s.label}: ${s.reason ?? 'failed'}`
  return `${s.label}: ${s.count} result${s.count === 1 ? '' : 's'} · ${s.ms} ms`
}

const WATCH_KEY = 're.library.watchTags'
const ACCEPT = '.pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.rtf,.odt,.html,.htm'

export function LibrarySearch({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const ui = useUI()
  const [hits, setHits] = useState<Hit[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [pending, setPending] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [ranFor, setRanFor] = useState('')
  const [tookMs, setTookMs] = useState<number | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const seq = useRef(0)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const polls = useRef(0)
  const [items, setItems] = useState<Item[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [watchTags, setWatchTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]') as string[] } catch { return [] }
  })
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [recHint, setRecHint] = useState<string>('')
  const [recBusy, setRecBusy] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [feedUrl, setFeedUrl] = useState('')
  const [saveFor, setSaveFor] = useState<Hit | Recommendation | null>(null)
  const [saveFolder, setSaveFolder] = useState<string>('')
  const [saveTags, setSaveTags] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const fileRef = useRef<HTMLInputElement>(null)
  const lastQuery = useRef('')

  /* ------------------------------------------------------------ loading --- */

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/library/items')
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json() as { items: Item[]; folders: Folder[] }
      setItems(json.items ?? [])
      setFolders(json.folders ?? [])
    } catch {
      // The server keeps the record; when it is not up yet the panel simply
      // shows nothing rather than an invented cache.
      setItems([]); setFolders([])
    }
  }, [])

  const recommendations = useCallback(async () => {
    setRecBusy(true)
    try {
      const qs = watchTags.length ? `?tags=${encodeURIComponent(watchTags.join(','))}` : ''
      const res = await fetch(`/api/library/recommendations${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`)
      const json = await res.json() as { recommendations: Recommendation[]; hint?: string; notes?: string[] }
      setRecs(json.recommendations ?? [])
      // The server says which feeds or tags it could not reach, and that is
      // more useful than a shrug — it is the difference between "nothing to
      // recommend" and "the source refused to answer".
      setRecHint(json.hint ?? (json.notes?.length ? json.notes.join(' · ') : ''))
      // The bell only hears about this when the user switched it on. The store
      // keeps one per day, so opening the Library five times is not five
      // notifications.
      if (useStore.getState().settings.notifyRecommendations === true && (json.recommendations?.length ?? 0) > 0) {
        notifyRecommendations(json.recommendations.length, json.recommendations.slice(0, 3).map((r) => r.title))
      }
    } catch (e) {
      setRecs([]); setRecHint(describeFetchError(e, '/api/library/recommendations'))
    } finally { setRecBusy(false) }
  }, [watchTags])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void recommendations() }, [recommendations])
  useEffect(() => { try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchTags)) } catch { /* private mode */ } }, [watchTags])

  /* -------------------------------------------------------------- search --- */

  /**
   * One search. The server answers inside ~200 ms with whatever is ready and
   * names the lanes that are still running, so this paints something
   * immediately and then asks once more to collect the slow sources.
   *
   * Every exit path writes `ranFor`, including the failures. That was the bug
   * behind "I type and nothing happens": the error path never set it, and the
   * empty state was gated on it, so a failed search rendered nothing at all —
   * no results, no reason, no way back.
   */
  const runSearch = useCallback(async (q: string, opts: { refresh?: boolean; poll?: number } = {}) => {
    const clean = q.trim()
    if (clean.length < 2) return
    const run = ++seq.current
    lastQuery.current = clean
    onQuery(clean)
    setBusy(true)
    setSearchError(null)
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    try {
      const url = `/api/library/search?q=${encodeURIComponent(clean)}${opts.refresh ? '&refresh=1' : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}${body ? ` — ${body.slice(0, 160)}` : ''}`)
      }
      // Not `res.json()`: a response that is not JSON has to say what it was —
      // an older server answering with the app shell, an empty body, a truncated
      // stream. See lib/net/json.ts; that message is what the user reported.
      const json: any = await readJsonResponse(res, url, {
        retryHint: 'Search again from Settings → About if the server version looks older than the app.',
      })
      if (run !== seq.current) return
      setHits(Array.isArray(json.hits) ? json.hits : [])
      setNotes(Array.isArray(json.notes) ? json.notes : [])
      setSources(Array.isArray(json.sources) ? json.sources : [])
      setPending(Array.isArray(json.pending) ? json.pending : [])
      setRanFor(clean)
      setTookMs(typeof json.tookMs === 'number' ? json.tookMs : Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0))
      const stillRunning: string[] = Array.isArray(json.pending) ? json.pending : []
      if (stillRunning.length && (opts.poll ?? 0) < 6) {
        // The lanes are already running on the server; this only picks them up.
        const next = (opts.poll ?? 0) + 1
        setTimeout(() => { if (run === seq.current) void runSearch(clean, { poll: next }) }, next === 1 ? 420 : 700)
      }
    } catch (e) {
      if (run !== seq.current) return
      setHits([]); setSources([]); setPending([]); setNotes([])
      setSearchError(describeFetchError(e, `/api/library/search?q=${encodeURIComponent(clean)}`))
      setRanFor(clean)
      setTookMs(Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0))
    } finally {
      if (run === seq.current) setBusy(false)
    }
  }, [onQuery])

  // Typing runs the search too, debounced — the field and the results should
  // never disagree, and pressing Enter only skips the wait.
  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) return
    if (clean === ranFor && !searchError) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { void runSearch(clean) }, 220)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  /* -------------------------------------------------------------- saving --- */

  const openSave = (hit: Hit | Recommendation) => {
    setSaveFor(hit)
    setSaveFolder(folderFilter !== 'all' ? folderFilter : '')
    const guessTag = watchTags[0] ?? ''
    setSaveTags(guessTag)
  }

  const save = async () => {
    if (!saveFor) return
    const isRec = 'reason' in saveFor
    const body = {
      id: `lib_${nanoid(8)}`,
      kind: isRec ? 'source' : (saveFor as Hit).kind,
      title: isRec ? (saveFor as Recommendation).title : (saveFor as Hit).title,
      url: isRec ? (saveFor as Recommendation).link : (saveFor as Hit).url,
      snippet: isRec ? (saveFor as Recommendation).summary : (saveFor as Hit).snippet,
      tags: [...new Set([...saveTags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean), ...(isRec ? [] : [])])],
      folderId: saveFolder || undefined,
      extra: isRec ? { reason: (saveFor as Recommendation).reason } : undefined,
    }
    try {
      const res = await fetch('/api/library/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(String(res.status))
      ui.toast('Saved', saveFolder ? 'Filed in a folder you chose.' : 'Saved to the library.', 'success')
      setSaveFor(null)
      await load()
      if (body.tags.length) void recommendations()
    } catch {
      ui.toast('Could not save', 'The local server did not answer.', 'danger')
    }
  }

  const makeFolder = async () => {
    const name = newFolder.trim()
    if (!name) return
    try {
      const res = await fetch('/api/library/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `fold_${nanoid(6)}`, name }) })
      const json = await res.json() as { folder: Folder }
      setFolders((f) => [...f, json.folder])
      setSaveFolder(json.folder.id)
      setNewFolder('')
      ui.toast('Folder created', name, 'success')
    } catch { ui.toast('Could not create the folder', 'The local server did not answer.', 'danger') }
  }

  const removeItem = async (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id))
    try { await fetch(`/api/library/items/${id}`, { method: 'DELETE' }) } catch { /* it will come back on reload */ }
  }

  const removeFolder = async (id: string) => {
    setFolders((f) => f.filter((x) => x.id !== id))
    setItems((list) => list.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)))
    setFolderFilter('all')
    try { await fetch(`/api/library/folders/${id}`, { method: 'DELETE' }) } catch { /* same */ }
  }

  const addFeed = async () => {
    try {
      const res = await fetch('/api/library/feeds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: feedUrl.trim() }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'The feed did not load')
      setFeedOpen(false); setFeedUrl('')
      ui.toast('Feed added', json.item.title, 'success')
      await load(); void recommendations()
    } catch (e: any) { ui.toast('Feed failed', String(e?.message ?? e).slice(0, 140), 'danger') }
  }

  const upload = async (file: File) => {
    try {
      const { extractText } = await import('@/lib/documents/extract')
      ui.toast('Reading the file', file.name, 'info')
      const text = await extractText(file)
      if (!text.trim()) { ui.toast('Nothing to read', 'That file has no extractable text.', 'warning'); return }
      const res = await fetch('/api/library/upload', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: file.name, text, bytes: file.size, type: file.type, folderId: folderFilter !== 'all' ? folderFilter : undefined, tags: watchTags.slice(0, 3) }),
      })
      if (!res.ok) throw new Error(String(res.status))
      ui.toast('Imported', `${file.name} is in the library and searchable.`, 'success')
      await load(); void recommendations()
    } catch (e: any) { ui.toast('Import failed', String(e?.message ?? e).slice(0, 140), 'danger') }
  }

  /* --------------------------------------------------------------- view --- */

  const grouped = useMemo(() => {
    const g: Record<string, Hit[]> = { wikipedia: [], source: [], document: [] }
    for (const h of hits) (g[h.kind] ??= []).push(h)
    return g
  }, [hits])

  const visibleItems = useMemo(
    () => (folderFilter === 'all' ? items : items.filter((i) => (i.folderId ?? 'none') === folderFilter)),
    [items, folderFilter],
  )

  const knownTags = useMemo(
    () => [...new Set([...watchTags, ...items.flatMap((i) => i.tags ?? [])])].slice(0, 24),
    [watchTags, items],
  )

  return (
    <div className="flex flex-col gap-5" data-ui="library-search">
      {/* the front door */}
      <div className="flex flex-wrap items-center gap-3">
        <GooeyInput
          placeholder="Search everything…"
          collapsedWidth={200}
          expandedWidth={440}
          expandedOffset={44}
          onSubmit={(v) => void runSearch(v)}
          value={query}
          onValueChange={(v) => onQuery(v)}
        />
        <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Wikipedia · trusted sources · your own documents
        </span>
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} title="Import a PDF, a Word file, or any text document"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <Upload size={12} /> Add your own
        </button>
        <button onClick={() => setFeedOpen(true)} title="Add an RSS or Atom feed to watch"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <Rss size={12} /> Add a feed
        </button>
      </div>

      {/* What happened, in one line per source. This is the part that used to
          be invisible: a failed search rendered nothing at all. */}
      {(busy || ranFor) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          {busy && <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Searching…</span>}
          {!busy && tookMs !== null && <span>Answered in {tookMs} ms</span>}
          {/* The lane chips stay up while the follow-up poll runs, so "still
              looking" is visible rather than implied by a spinner. */}
          {sources.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5"
              style={{ color: s.state === 'error' ? 'var(--warning)' : 'var(--text-3)' }}>
              {s.state === 'error' ? <AlertTriangle size={11} /> : s.state === 'ok' ? <Check size={11} /> : <Loader2 size={11} className="animate-spin" />}
              {sourceLine(s)}
            </span>
          ))}
        </div>
      )}

      {searchError && (
        <div className="surface p-4" style={{ borderColor: 'color-mix(in srgb, var(--danger) 40%, var(--surface-border))' }}>
          <div className="flex items-center gap-2 text-[13px] font-medium mb-1" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={14} /> Search could not run
          </div>
          <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>{searchError}</p>
          <button onClick={() => void runSearch(ranFor, { refresh: true })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )}

      {!busy && !searchError && ranFor && hits.length === 0 && (
        <div className="surface p-4">
          <div className="text-[12.5px] font-medium mb-1">Nothing for “{ranFor}” yet</div>
          <p className="text-[12px] leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
            {pending.length
              ? 'Some sources are still answering — the results appear here as they land.'
              : 'Try fewer words, or check the reasons below. Your own documents and anything saved are always searched, offline.'}
          </p>
          {notes.length > 0 && (
            <ul className="text-[11.5px] mb-3 space-y-0.5" style={{ color: 'var(--text-3)' }}>
              {notes.map((n, i) => <li key={i} className="flex items-start gap-1.5"><AlertTriangle size={11} className="mt-0.5 shrink-0" /> {n}</li>)}
            </ul>
          )}
          <button onClick={() => void runSearch(ranFor, { refresh: true })} disabled={busy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium disabled:opacity-50"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <RefreshCw size={12} /> Search again
          </button>
        </div>
      )}

      {notes.length > 0 && hits.length > 0 && (
        <div className="flex items-start gap-2 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          <AlertTriangle size={12} className="mt-0.5" /> <span>{notes.join(' ')}</span>
        </div>
      )}

      {(['wikipedia', 'source', 'document'] as const).map((kind) => {
        const list = grouped[kind] ?? []
        if (!list.length) return null
        const meta = KIND_META[kind]
        return (
          <div key={kind}>
            <div className="flex items-center gap-2 mb-2">
              <meta.Icon size={13} style={{ color: meta.tone }} />
              <h3 className="text-[12.5px] font-medium">{meta.label}</h3>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {list.map((h) => (
                  <motion.div key={h.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="surface p-3 flex items-start gap-3">
                    {h.favicon
                      ? <img src={h.favicon} alt="" width={16} height={16} className="rounded-[4px] mt-0.5" referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                      : <meta.Icon size={15} className="mt-0.5" style={{ color: meta.tone }} />}
                    <div className="min-w-0 flex-1">
                      <a href={h.url} target="_blank" rel="noreferrer noopener" className="text-[13px] font-medium leading-snug hover:underline" style={{ color: 'var(--text)' }}>
                        {h.title}
                      </a>
                      {h.snippet && <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{h.snippet}</p>}
                      <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{h.source}</span>
                    </div>
                    <button onClick={() => openSave(h)} title="Save to the library"
                      className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
                      style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                      <Star size={11} /> Save
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )
      })}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 mt-1">
        {/* what you saved, in folders */}
        <div className="surface p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <BookMarked size={13} style={{ color: 'var(--primary)' }} />
            <h3 className="text-[12.5px] font-medium flex-1">Saved ({items.length})</h3>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{folders.length} folder{folders.length === 1 ? '' : 's'}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setFolderFilter('all')}
              className="px-2.5 py-1 rounded-full text-[11.5px]"
              style={{ background: folderFilter === 'all' ? 'var(--elevated)' : 'transparent', border: '1px solid var(--surface-border)', color: folderFilter === 'all' ? 'var(--text)' : 'var(--text-3)' }}>
              Everything
            </button>
            {folders.map((f) => (
              <span key={f.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11.5px]"
                style={{ background: folderFilter === f.id ? 'var(--elevated)' : 'transparent', border: '1px solid var(--surface-border)', color: folderFilter === f.id ? 'var(--text)' : 'var(--text-3)' }}>
                <FolderIcon size={11} />
                <button onClick={() => setFolderFilter(f.id)}>{f.name}</button>
                <button onClick={() => void removeFolder(f.id)} title="Delete this folder (its items stay)" style={{ color: 'var(--text-3)' }}><Trash2 size={10} /></button>
              </span>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              Nothing saved here yet. Every result above can go into a folder with tags, and your own files can be imported with “Add your own”.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
              {visibleItems.map((it) => (
                <div key={it.id} className="flex items-start gap-2 px-2 py-1.5 rounded-[9px]" style={{ background: 'var(--elevated)' }}>
                  {KIND_META[it.kind]?.Icon
                    ? React.createElement(KIND_META[it.kind].Icon, { size: 12, className: 'mt-0.5 shrink-0', style: { color: KIND_META[it.kind].tone } })
                    : <FileText size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] truncate">{it.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]" style={{ color: 'var(--text-3)' }}>
                      <span>{timeAgo(it.savedAt)}</span>
                      {folders.find((f) => f.id === it.folderId) && <span>· {folders.find((f) => f.id === it.folderId)?.name}</span>}
                      {it.tags.map((t) => <span key={t} className="px-1.5 rounded-full" style={{ background: 'var(--surface)' }}>#{t}</span>)}
                    </div>
                  </div>
                  <button onClick={() => void removeItem(it.id)} title="Remove from the library" style={{ color: 'var(--text-3)' }}><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* what to watch + what came back */}
        <div className="surface p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles size={13} style={{ color: 'var(--secondary)' }} />
            <h3 className="text-[12.5px] font-medium flex-1">Recommendations</h3>
            <button onClick={() => void recommendations()} title="Look again" className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              <RefreshCw size={11} className={recBusy ? 'animate-spin' : ''} />
            </button>
          </div>

          <p className="text-[11px] mb-2" style={{ color: 'var(--text-3)' }}>
            Tags you want to see. Recommendations are pulled from Wikipedia and your feeds using these — they are off unless you add something here.
          </p>
          {knownTags.length > 0 ? (
            <div className="[&>div]:!w-full [&>div]:!p-0 [&>div]:!gap-2">
              <AnimatedTags initialTags={knownTags} selectedTags={watchTags} onChange={(sel: string[]) => setWatchTags(sel)} />
            </div>
          ) : (
            <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>
              Tag something you save, or add a feed, and it will show up here as a button you can switch on.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-1.5 max-h-[240px] overflow-y-auto pr-1">
            {recs.map((r, i) => (
              <div key={`${r.link}-${i}`} className="px-2 py-1.5 rounded-[9px]" style={{ background: 'var(--elevated)' }}>
                <div className="flex items-start gap-2">
                  {r.favicon
                    ? <img src={r.favicon} alt="" width={13} height={13} className="rounded-[3px] mt-0.5" referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                    : <Globe size={12} className="mt-0.5" style={{ color: 'var(--text-3)' }} />}
                  <a href={r.link} target="_blank" rel="noreferrer noopener" className="text-[12px] leading-snug hover:underline flex-1" style={{ color: 'var(--text)' }}>{r.title}</a>
                  <button onClick={() => openSave(r)} title="Save this" style={{ color: 'var(--text-3)' }}><Star size={11} /></button>
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>{r.reason}</div>
              </div>
            ))}
            {!recs.length && !recBusy && (
              <div className="flex items-start gap-2">
                <p className="text-[11px] flex-1" style={{ color: recHint && /could not|did not|refused|dropped|offline|HTTP/i.test(recHint) ? 'var(--warning)' : 'var(--text-3)' }}>
                  {recHint || 'Nothing to recommend yet.'}
                </p>
                <button onClick={() => void recommendations()} title="Look again" className="shrink-0 text-[11px] flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                  <RefreshCw size={10} /> Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* save dialog: folder + tags, never a native prompt */}
      <Modal isOpen={!!saveFor} onClose={() => setSaveFor(null)} size="md">
        <ModalContent>
          <ModalHeader className="text-[14px]">Save to the library</ModalHeader>
          <ModalBody>
            <p className="text-[12.5px] mb-1" style={{ color: 'var(--text-2)' }}>{saveFor?.title}</p>
            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--text-3)' }}>Folder</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => setSaveFolder('')} className="px-2.5 py-1 rounded-full text-[11.5px]"
                style={{ background: !saveFolder ? 'var(--elevated)' : 'transparent', border: '1px solid var(--surface-border)' }}>
                No folder
              </button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => setSaveFolder(f.id)} className="px-2.5 py-1 rounded-full text-[11.5px] flex items-center gap-1"
                  style={{ background: saveFolder === f.id ? 'var(--elevated)' : 'transparent', border: '1px solid var(--surface-border)' }}>
                  <FolderIcon size={10} /> {f.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="…or a new folder"
                className="flex-1 rounded-[10px] px-3 py-2 text-[12.5px] outline-none" style={{ background: 'var(--elevated)' }} />
              <Button size="sm" variant="ghost" onClick={() => void makeFolder()} disabled={!newFolder.trim()} startContent={<FolderPlus size={12} />}>Create</Button>
            </div>
            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--text-3)' }}>Tags (comma separated — these drive recommendations)</label>
            <div className="flex items-center gap-2">
              <Tag size={13} style={{ color: 'var(--text-3)' }} />
              <input value={saveTags} onChange={(e) => setSaveTags(e.target.value)} placeholder="fusion energy, methodology"
                className="flex-1 rounded-[10px] px-3 py-2 text-[12.5px] outline-none" style={{ background: 'var(--elevated)' }} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="md" onClick={() => setSaveFor(null)}>Cancel</Button>
            <Button size="md" onClick={() => void save()} startContent={<Check size={13} />}>Save it</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* feed dialog */}
      <Modal isOpen={feedOpen} onClose={() => setFeedOpen(false)} size="md">
        <ModalContent>
          <ModalHeader className="text-[14px]">Add an RSS or Atom feed</ModalHeader>
          <ModalBody>
            <p className="text-[12px] mb-2" style={{ color: 'var(--text-2)' }}>
              Anything the feed publishes shows up under Recommendations, and its entries can be saved like any other result.
            </p>
            <input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://example.org/feed.xml"
              className="w-full rounded-[10px] px-3 py-2 text-[12.5px] outline-none" style={{ background: 'var(--elevated)' }} />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="md" onClick={() => setFeedOpen(false)}>Cancel</Button>
            <Button size="md" onClick={() => void addFeed()} disabled={!feedUrl.trim()} startContent={<Plus size={13} />}>Add feed</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
