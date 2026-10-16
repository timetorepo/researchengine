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
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {Palette, Copy, 
  BookOpen, Globe, FileText, Plus, Trash2, Tag, Tags, Rss, Upload, RefreshCw, FolderPlus, ExternalLink, ChevronLeft,
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
import { SourceViewer, type OpenSource } from '@/components/library/SourceViewer'
import FolderReveal from '@/components/smoothui/folder-reveal'
import GlassFolder from '@/components/ui/glass-folder/GlassFolder'
import { RecommendationsPanel } from '@/components/library/RecommendationsPanel'
// The registry index the design hub already uses — one catalogue, searched from
// two places, rather than a second list that drifts from the first.
import { componentHits } from '@/lib/design/component-search'
import { copyText } from '@/lib/utils'

// The matcher is shared with the agent's tool and the design hub; re-exported so
// the Library keeps one obvious entry point for "what components match this".
export { componentHits, expandPattern, PATTERN_TERMS, searchComponents } from '@/lib/design/component-search'

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

interface Folder { id: string; name: string; createdAt: number; color?: string }

/** The five skins the folder component ships, each with its face colour. */
const FOLDER_SWATCHES: { id: string; label: string; face: string }[] = [
  { id: 'blue', label: 'Blue (the default)', face: 'oklch(0.687 0.170 252.1)' },
  { id: 'green', label: 'Green', face: 'oklch(0.68 0.12 156)' },
  { id: 'manila', label: 'Manila', face: 'oklch(0.87 0.068 85)' },
  { id: 'brand', label: 'Rose', face: 'oklch(0.72 0.17 352)' },
  { id: 'slate', label: 'Slate', face: 'oklch(0.68 0.016 262)' },
]
interface SourceStatus { id: string; label: string; state: 'pending' | 'ok' | 'error'; count: number; ms: number; reason?: string }
interface Recommendation { title: string; link: string; summary?: string; reason: string; favicon?: string; at?: string; topic?: string; via?: 'feed' | 'tag'; publisher?: string }
interface Watching { tags: string[]; feeds: { id: string; title: string; url: string }[]; topics?: string[] }

/** A vertical of the small search engine inside the app. */
interface MiniHit {
  id: string; vertical: string; title: string; url: string
  snippet?: string; source: string; action?: 'open' | 'read'
}
interface MiniGroup { vertical: string; label: string; state: 'ok' | 'error' | 'empty'; ms: number; hits: MiniHit[]; reason?: string; note?: string }

/** Every group carries how it should be treated, because they are not equivalents. */
const MINI_META: Record<string, { tone: string; Icon: React.ElementType; external: boolean }> = {
  web: { tone: 'var(--primary)', Icon: Globe, external: true },
  wikipedia: { tone: 'var(--primary)', Icon: BookOpen, external: false },
  screens: { tone: 'var(--secondary)', Icon: Sparkles, external: true },
  ui: { tone: 'var(--secondary)', Icon: Sparkles, external: true },
  docs: { tone: 'var(--success)', Icon: FileText, external: true },
}

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

/**
 * What a saved item looks like inside a folder. It is deliberately small: the
 * fanned folder is a preview, the folder's own list is where you read. Two lines
 * and the kind, so an open folder reads like a stack of pins rather than a list.
 */
/**
 * The other half of "search the UI of apps": the components this app already
 * knows how to install, searched by pattern word. `pricing table` finds the
 * tables and cards, `carousel` finds the carousels, `empty state` finds the
 * states — and every hit names the registry it comes from, because "a component"
 * with no provenance is not something you can act on.
 *
 * Exported so the regression suite can call it directly: it is pure, and the
 * catalogue behind it is the same one the design hub shows.
 */
/**
 * Screen words are not component words. "Empty state", "onboarding" and
 * "settings screen" are how people describe what they want to build; a registry
 * is indexed by what things are called. This is the small, honest bridge between
 * the two — a fixed map, not a model, and it only ever *adds* search terms, so a
 * query that already matches still matches.
 */
function FolderCard({ title, kind }: { title: string; kind: string }) {
  return (
    <div className="w-full h-full px-2 py-1.5 flex flex-col justify-between" data-ui="folder-card">
      <span className="text-[9.5px] leading-[1.25] line-clamp-3" style={{ color: 'var(--text)' }}>{title}</span>
      <span className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{kind}</span>
    </div>
  )
}

const WATCH_KEY = 're.library.watchTags'
const ACCEPT = '.pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.rtf,.odt,.html,.htm'

export function LibrarySearch({ query, onQuery, folder, onFolder }: {
  query: string
  onQuery: (q: string) => void
  /** The open folder, owned by the Library view so its scroll keeper can see it. */
  folder: string
  onFolder: (id: string) => void
}) {
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
  const [recNotes, setRecNotes] = useState<string[]>([])
  const [recTime, setRecTime] = useState<number | null>(null)
  const [watching, setWatching] = useState<Watching | undefined>(undefined)
  const [recBusy, setRecBusy] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [feedUrl, setFeedUrl] = useState('')
  const [viewerFor, setViewerFor] = useState<OpenSource | null>(null)
  const [mini, setMini] = useState<MiniGroup[]>([])
  const [miniBusy, setMiniBusy] = useState(false)
  const navigate = useNavigate()
  const [saveFor, setSaveFor] = useState<Hit | Recommendation | null>(null)
  const [saveFolder, setSaveFolder] = useState<string>('')
  const [saveTags, setSaveTags] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [folderInput, setFolderInput] = useState(false)
  const [newFolderColor, setNewFolderColor] = useState('blue')
  const [paletteFor, setPaletteFor] = useState<string | null>(null)
  // Two folder looks for the same shelf: the blue SmoothUI folder, and a
  // frosted-glass folder. The choice is kept on this device.
  const [folderTheme, setFolderTheme] = useState<'classic' | 'glass'>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('re.library.folderTheme') === 'glass' ? 'glass' : 'classic')
  const chooseFolderTheme = (t: 'classic' | 'glass') => {
    setFolderTheme(t)
    try { localStorage.setItem('re.library.folderTheme', t) } catch { /* private mode */ }
  }
  const folderFilter = folder
  const setFolderFilter = onFolder
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
      const json = await readJsonResponse(res, '/api/library/recommendations', {
        retryHint: 'The feed needs the local server; Settings → About has a health row.',
      }) as { recommendations: Recommendation[]; hint?: string; notes?: string[]; watching?: Watching; tookMs?: number }
      setRecs(json.recommendations ?? [])
      setWatching(json.watching)
      setRecNotes(json.notes ?? [])
      setRecTime(typeof json.tookMs === 'number' ? json.tookMs : null)
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
      void runMini(q)
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
      setHits([]); setSources([]); setPending([]); setNotes([]); setMini([])
      setSearchError(describeFetchError(e, `/api/library/search?q=${encodeURIComponent(clean)}`))
      setRanFor(clean)
      setTookMs(Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0))
    } finally {
      if (run === seq.current) setBusy(false)
    }
  }, [onQuery])

  const changeQuery = useCallback((v: string) => onQuery(v), [onQuery])
  const submitSearch = useCallback((v: string) => { void runSearch(v) }, [runSearch])

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

  /* ------------------------------------------------- the small engine ------ */

  /**
   * The expanded half of the Library search: the same query, run through the
   * app's own small engine. It answers in two beats — the local verticals come
   * back with the first call, the network ones on the follow-up — which is the
   * same "still looking" contract the lanes above already use.
   */
  const runMini = useCallback(async (q: string) => {
    setMiniBusy(true)
    try {
      const res = await fetch(`/api/library/mini-search?q=${encodeURIComponent(q)}`)
      const json = await res.json().catch(() => null) as { results?: MiniGroup[]; pending?: string[] } | null
      if (!json?.results) throw new Error(`HTTP ${res.status}`)
      const local = componentHits(q)
      setMini(json.results.map((g) => g.vertical === 'ui' && local.length
        ? { ...g, hits: [...local, ...g.hits], note: `${local.length} component${local.length === 1 ? '' : 's'} from this app's own registry index, then the reference libraries.` }
        : g))
      if (json.pending?.length) {
        await new Promise((r) => setTimeout(r, 900))
        const again = await fetch(`/api/library/mini-search?q=${encodeURIComponent(q)}`)
        const second = await again.json().catch(() => null) as { results?: MiniGroup[] } | null
        if (second?.results) {
          const local = componentHits(q)
          setMini(second.results.map((g) => g.vertical === 'ui' && local.length
            ? { ...g, hits: [...local, ...g.hits], note: `${local.length} component${local.length === 1 ? '' : 's'} from this app's own registry index, then the reference libraries.` }
            : g))
        }
      }
    } catch {
      // The lanes above already explain a dead server; this half stays quiet.
      setMini([])
    } finally { setMiniBusy(false) }
  }, [])

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
      const res = await fetch('/api/library/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: `fold_${nanoid(6)}`, name, color: newFolderColor }) })
      const json = await res.json() as { folder: Folder }
      setFolders((f) => [...f, json.folder])
      setSaveFolder(json.folder.id)
      setNewFolder('')
      ui.toast('Folder created', name, 'success')
    } catch { ui.toast('Could not create the folder', 'The local server did not answer.', 'danger') }
  }

  /** Repaint a folder: optimistic locally, persisted through the PATCH route. */
  const setFolderColor = async (id: string, color: string | null) => {
    setPaletteFor(null)
    setFolders((cur) => cur.map((f) => f.id === id ? { ...f, color: color ?? undefined } : f))
    try {
      const res = await fetch(`/api/library/folders/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ color }) })
      if (!res.ok) throw new Error()
    } catch {
      ui.toast('Colour not saved', 'The folder keeps it for this session only.', 'warning')
    }
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
      <SourceViewer
        source={viewerFor}
        onClose={() => setViewerFor(null)}
        onSave={(s) => openSave({ id: `hit_${nanoid(6)}`, kind: (s.kind === 'wikipedia' ? 'wikipedia' : 'source'), title: s.title || s.url, url: s.url, source: s.url })}
      />
      {/* the front door */}
      <div className="flex flex-wrap items-center gap-3">
        <GooeyInput
          placeholder="Search everything…"
          collapsedWidth={200}
          expandedWidth={440}
          expandedOffset={44}
          onSubmit={submitSearch}
          value={query}
          onValueChange={changeQuery}
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
                      {/* The title opens the reader rather than a new tab: the
                          whole point of the Library is that a source can be
                          read here, and the panel keeps a way out to a real
                          browser for the pages that need one. */}
                      <button onClick={() => setViewerFor({ url: h.url ?? '', title: h.title, favicon: h.favicon, kind: h.kind })}
                        className="text-[13px] font-medium leading-snug text-left hover:underline" style={{ color: 'var(--text)' }}>
                        {h.title}
                      </button>
                      {h.snippet && <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{h.snippet}</p>}
                      <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{h.source}</span>
                    </div>
                    {h.url && (
                      <button onClick={() => setViewerFor({ url: h.url ?? '', title: h.title, favicon: h.favicon, kind: h.kind })}
                        title="Open and read this source here"
                        className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                        <BookOpen size={11} /> Open
                      </button>
                    )}
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

      {/* The expanded half: the app's own small engine. Each vertical keeps its
          own label and its own way out, because a catalogue search is not a
          document and pretending they are the same would be the dishonest part. */}
      {(miniBusy || mini.length > 0) && (
        <div className="flex flex-col gap-4" data-ui="library-mini">
          <div className="flex items-center gap-2">
            <Globe size={13} style={{ color: 'var(--secondary)' }} />
            <h3 className="text-[12.5px] font-medium">The app's own search</h3>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              web · screens and references · app interfaces · docs
            </span>
            {miniBusy && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
          </div>

          {mini.map((g) => {
            const meta = MINI_META[g.vertical] ?? MINI_META.web
            return (
              <div key={g.vertical}>
                <div className="flex items-center gap-2 mb-2">
                  <meta.Icon size={13} style={{ color: meta.tone }} />
                  <h4 className="text-[12px] font-medium">{g.label}</h4>
                  <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {g.state === 'ok' ? `${g.hits.length} · ${g.ms} ms` : g.state}
                  </span>
                </div>
                {g.state !== 'ok' && (
                  <p className="text-[11.5px] mb-1" style={{ color: 'var(--text-3)' }}>
                    {g.reason ?? 'Nothing matched in this vertical.'}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {(g.hits ?? []).map((h) => (
                    <motion.div key={h.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="surface p-3 flex items-start gap-3">
                      <meta.Icon size={15} className="mt-0.5 shrink-0" style={{ color: meta.tone }} />
                      <div className="min-w-0 flex-1">
                        {h.url.startsWith('app://') ? (
                          <button onClick={() => navigate(`/code?hub=${encodeURIComponent(h.title)}`)}
                            title="Preview it in design mode's component hub"
                            className="text-[13px] font-medium leading-snug text-left hover:underline" style={{ color: 'var(--text)' }}>
                            {h.title}
                          </button>
                        ) : h.action === 'read' ? (
                          <button onClick={() => setViewerFor({ url: h.url, title: h.title, kind: h.vertical as any })}
                            className="text-[13px] font-medium leading-snug text-left hover:underline" style={{ color: 'var(--text)' }}>
                            {h.title}
                          </button>
                        ) : (
                          <a href={h.url} target="_blank" rel="noreferrer noopener"
                            className="text-[13px] font-medium leading-snug hover:underline" style={{ color: 'var(--text)' }}>
                            {h.title}
                          </a>
                        )}
                        {h.snippet && <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{h.snippet}</p>}
                        <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{h.source}</span>
                      </div>
                      {!h.url.startsWith('app://') && (
                        meta.external
                          ? <a href={h.url} target="_blank" rel="noreferrer noopener" title="Opens in your browser — this library is searched by its own URL"
                              className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
                              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                              <ExternalLink size={11} /> Open
                            </a>
                          : <button onClick={() => setViewerFor({ url: h.url, title: h.title, kind: h.vertical as any })} title="Read it here"
                              className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
                              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
                              <BookOpen size={11} /> Read
                            </button>
                      )}
                    </motion.div>
                  ))}
                </div>
                {g.note && <p className="text-[10.5px] mt-1.5 leading-snug" style={{ color: 'var(--text-3)' }}>{g.note}</p>}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 mt-1">
        {/* what you saved, in folders — a shelf of blue folders you can open */}
        <div className="surface p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <BookMarked size={13} style={{ color: 'var(--primary)' }} />
            <h3 className="text-[12.5px] font-medium flex-1">
              Saved ({items.length})
              {folderFilter !== 'all' && <span style={{ color: 'var(--text-3)' }}> · inside {folders.find((f) => f.id === folderFilter)?.name ?? 'a folder'}</span>}
            </h3>
            <div className="flex items-center gap-0.5 rounded-full p-0.5" role="group" aria-label="Folder look" style={{ background: 'var(--elevated)' }}>
              {(['classic', 'glass'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={folderTheme === t} onClick={() => chooseFolderTheme(t)}
                  className="px-2 py-0.5 rounded-full text-[10.5px] capitalize"
                  style={{ background: folderTheme === t ? 'var(--surface)' : 'transparent', color: folderTheme === t ? 'var(--text)' : 'var(--text-3)' }}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setFolderInput((v) => !v)} title="Make a folder" className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
              <FolderPlus size={11} /> New folder
            </button>
          </div>

          {folderInput && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 shrink-0" title="Pick the folder's colour">
                {FOLDER_SWATCHES.map((sw) => (
                  <button key={sw.id} title={sw.label} onClick={() => setNewFolderColor(sw.id)}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: sw.face,
                      outline: newFolderColor === sw.id ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.15)',
                      outlineOffset: 1,
                    }} />
                ))}
              </div>
              <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { void makeFolder(); setFolderInput(false) } }}
                placeholder="Thesis, fusion energy, Q3…"
                className="flex-1 rounded-[10px] px-3 py-1.5 text-[12px] outline-none"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
              <Button size="sm" variant="ghost" onClick={() => { void makeFolder(); setFolderInput(false) }} disabled={!newFolder.trim()}>Make it</Button>
            </div>
          )}

          {/*
            The shelf. Blue folders, hover fans one open, a click reads what is
            inside it (the list below switches to that folder and the folder
            stays open). The shelf keeps its own height whatever is selected —
            choosing a folder must not change the height of the page, because a
            page that gets shorter is a page the browser scrolls to the top.
          */}
          <div className="flex items-end gap-1 overflow-x-auto pb-6 pt-1"
            style={{ minHeight: 208 }}>
            {folders.map((f, fi) => {
              const inside = items.filter((i) => (i.folderId ?? 'none') === f.id)
              const selected = folderFilter === f.id
              if (folderTheme === 'glass') {
                return (
                  <div key={f.id} className="shrink-0 flex flex-col items-center gap-2" style={{ width: 200 }}>
                    <GlassFolder
                      label={f.name}
                      meta={`${inside.length} save${inside.length === 1 ? '' : 's'}`}
                      tone={f.color === 'slate' ? 'dark' : 'light'}
                      appearDelay={fi * 90}
                      open={selected}
                      onOpenChange={() => setFolderFilter(selected ? 'all' : f.id)}
                      onFileOpen={() => setFolderFilter(f.id)}
                      files={inside.slice(-4).map((i) => ({ id: i.id, name: i.title, meta: i.kind }))}
                      menu={[{ label: 'Delete folder (saves stay)', danger: true, onSelect: () => void removeFolder(f.id) }]}
                    />
                  </div>
                )
              }
              return (
                <div key={f.id} className="shrink-0 flex flex-col items-center gap-2"
                  style={{ width: 150 }}>
                  <div className="relative rounded-[28px] px-1.5 pt-1.5"
                    style={{
                      background: selected ? 'color-mix(in srgb, #6C8EEF 14%, transparent)' : 'transparent',
                      border: `1px solid ${selected ? 'color-mix(in srgb, #6C8EEF 45%, transparent)' : 'transparent'}`,
                      cornerShape: 'superellipse(1.7)',
                    } as React.CSSProperties}>
                    <FolderReveal
                      color={(f.color && ['blue', 'green', 'manila', 'brand', 'slate'].includes(f.color) ? f.color : 'blue') as 'blue' | 'green' | 'manila' | 'brand' | 'slate'}
                      trigger="hover"
                      size={132}
                      spread={34}
                      rotation={5}
                      label={f.name}
                      open={selected ? true : undefined}
                      onActivate={() => setFolderFilter(selected ? 'all' : f.id)}
                      items={inside.slice(-3).map((i) => ({
                        id: i.id,
                        color: 'var(--surface)',
                        content: <FolderCard title={i.title} kind={i.kind} />,
                      }))}
                    />
                    <button onClick={() => setPaletteFor(paletteFor === f.id ? null : f.id)} title="Change this folder's colour"
                      data-ui={`folder-palette-${f.id}`}
                      className="absolute -left-0.5 -top-0.5 z-30 p-1 rounded-full opacity-0 hover:opacity-100 focus:opacity-100"
                      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
                      <Palette size={10} />
                    </button>
                    {paletteFor === f.id && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-1.5 py-1 rounded-full"
                        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', boxShadow: '0 6px 24px rgba(0,0,0,0.18)' }}>
                        {FOLDER_SWATCHES.map((sw) => (
                          <button key={sw.id} title={sw.label}
                            onClick={() => void setFolderColor(f.id, sw.id === 'blue' ? null : sw.id)}
                            className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                            style={{
                              background: sw.face,
                              outline: (f.color ?? 'blue') === sw.id ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.15)',
                              outlineOffset: 1,
                            }} />
                        ))}
                      </div>
                    )}
                    <button onClick={() => void removeFolder(f.id)} title="Delete this folder (its saves stay)"
                      className="absolute -right-0.5 -top-0.5 z-30 p-1 rounded-full opacity-0 hover:opacity-100 focus:opacity-100"
                      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <span className="text-[10.5px] truncate max-w-[140px]" style={{ color: selected ? 'var(--text)' : 'var(--text-3)' }}>
                    {inside.length} save{inside.length === 1 ? '' : 's'}
                  </span>
                </div>
              )
            })}
            {!folders.length && (
              <p className="text-[11.5px] pb-4" style={{ color: 'var(--text-3)' }}>
                No folders yet. Make one above, then save any result into it — the folder fans open under your pointer showing its three most recent saves, and a click opens it.
              </p>
            )}
          </div>

          {folderFilter !== 'all' && (
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setFolderFilter('all')} className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                <ChevronLeft size={11} /> All saves
              </button>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {visibleItems.length} in {folders.find((f) => f.id === folderFilter)?.name}
              </span>
            </div>
          )}

          {visibleItems.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              {folderFilter === 'all'
                ? 'Nothing saved here yet. Every result above can go into a folder with tags, and your own files can be imported with “Add your own”.'
                : 'This folder is empty. Save a result into it from the search above.'}
            </p>
          ) : (
            <>
            {visibleItems.filter((i) => i.kind === 'component' && i.extra?.command).length > 0 && (
              <button
                onClick={async () => {
                  const cmds = visibleItems.filter((i) => i.kind === 'component' && i.extra?.command).map((i) => i.extra.command as string)
                  const ok = await copyText(cmds.join(' && '))
                  ui.toast(ok ? 'Install commands copied' : 'Copy blocked', ok ? `${cmds.length} command${cmds.length === 1 ? '' : 's'}, ready to paste in a terminal.` : 'Select them from the rows below instead.', ok ? 'success' : 'warning')
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11px] font-medium mb-1.5 w-fit"
                style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}
                data-ui="copy-component-installs">
                <Copy size={11} /> Copy {visibleItems.filter((i) => i.kind === 'component' && i.extra?.command).length} install command{visibleItems.filter((i) => i.kind === 'component' && i.extra?.command).length === 1 ? '' : 's'}
              </button>
            )}
            <div className="flex flex-col gap-1.5 min-h-[200px] max-h-[320px] overflow-y-auto pr-1">
              {visibleItems.map((it) => (
                <div key={it.id} className="flex items-start gap-2 px-2 py-1.5 rounded-[9px]" style={{ background: 'var(--elevated)' }}>
                  {KIND_META[it.kind]?.Icon
                    ? React.createElement(KIND_META[it.kind].Icon, { size: 12, className: 'mt-0.5 shrink-0', style: { color: KIND_META[it.kind].tone } })
                    : <FileText size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} />}
                  <div className="min-w-0 flex-1">
{it.kind === 'component' && it.url?.startsWith('app://component')
                      ? <button onClick={() => navigate(`/code?hub=${encodeURIComponent(it.extra?.item ?? it.title)}`)}
                          title="Open its preview in design mode"
                          className="text-[12px] truncate text-left hover:underline block max-w-full" style={{ color: 'var(--text)' }}>{it.title}</button>
                      : it.url
                        ? <button onClick={() => setViewerFor({ url: it.url as string, title: it.title, kind: (it.kind as any) })}
                            className="text-[12px] truncate text-left hover:underline block max-w-full" style={{ color: 'var(--text)' }}>{it.title}</button>
                        : <div className="text-[12px] truncate">{it.title}</div>}
                    {it.kind === 'component' && it.extra?.command && (
                      <code className="block text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{it.extra.command}</code>
                    )}
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
            </>
          )}
        </div>

        {/* what to watch + what came back */}
        <div className="surface p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <Tags size={13} style={{ color: 'var(--secondary)' }} />
            <h3 className="text-[12.5px] font-medium flex-1">What to watch</h3>
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

        </div>

        {/* the feed itself, full width under both panels: a reader needs the
            room, and a headline deserves a line of its own */}
        <div className="lg:col-span-2">
          <RecommendationsPanel
            recs={recs}
            hint={recHint}
            busy={recBusy}
            tookMs={recTime}
            watching={watching}
            notes={recNotes}
            onRefresh={() => void recommendations()}
            onSave={(r) => openSave(r as any)}
            onOpen={(r) => setViewerFor({ url: r.link, title: r.title, kind: 'source' })}
          />
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
