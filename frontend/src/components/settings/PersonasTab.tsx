import { useEffect, useMemo, useState } from 'react'
import { ROLE_FAMILIES, familyById } from '@/lib/ecc/roles'
import { BookMarked, Download, RefreshCw, Search } from 'lucide-react'
import { PERSONAS_MANIFEST } from '@/content/personas/manifest'
import { personaText, CODING_PERSONA_SLUG } from '@/lib/personas'
import {
  allPrompts, sortPrompts, filterPrompts, promptCounts, knownModels, formatChars,
  type PromptEntry, type PromptSort,
} from '@/lib/prompts/index'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

/**
 * The persona library: every system prompt in the upstream archive. The
 * flagship set reads offline; the full archive is one sync away, pulled onto
 * this machine by the app itself.
 */
export function PersonasTab() {
  const [q, setQ] = useState('')
  const [vendor, setVendor] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [openText, setOpenText] = useState<string | null>(null)
  const [openPath, setOpenPath] = useState('')
  const [mirror, setMirror] = useState<{ present: boolean; count: number } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const defaultPersonaId = useStore((s) => s.settings.defaultPersonaId ?? '')
  const defaultRoleId = useStore((s) => s.settings.defaultRoleId ?? '')
  const ui = useUI()

  const refreshMirror = () =>
    fetch('/api/personas/local').then((r) => r.json()).then(setMirror).catch(() => setMirror({ present: false, count: 0 }))

  useEffect(() => { void refreshMirror() }, [])

  const syncArchive = async () => {
    setSyncing(true)
    const r = await fetch('/api/personas/sync', { method: 'POST' })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: 'The app server did not answer.' }))
    setSyncing(false)
    if (r.ok) {
      ui.toast('Archive synced', `${r.count} prompts are on this machine now.`, 'success')
      void refreshMirror()
    } else {
      ui.toast('Sync failed', r.error ?? 'Try again in a moment.', 'danger')
    }
  }

  const vendors = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of PERSONAS_MANIFEST) counts.set(p.vendor, (counts.get(p.vendor) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return PERSONAS_MANIFEST
      .filter((p) => (!vendor || p.vendor === vendor) && (!s || p.title.toLowerCase().includes(s) || p.path.toLowerCase().includes(s)))
      .slice(0, 200)
  }, [q, vendor])

  const open = async (slug: string, path: string) => {
    setOpenSlug(slug)
    setOpenPath(path)
    setOpenText(null)
    if (slug) { setOpenText(await personaText(slug)); return }
    const r = await fetch(`/api/personas/text?path=${encodeURIComponent(path)}`).then((x) => x.json()).catch(() => null)
    setOpenText(r?.text ? `${r.text}${r.truncated ? '\n\n(truncated at 200k characters)' : ''}` : (r?.error ?? null))
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Personas</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--text-2)' }}>
        {PERSONAS_MANIFEST.length} system prompts from the public archive. Attach one to a chat and the model answers in its voice, on top of your own prompts.
      </p>

      <ModelIndex />

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts, products, vendors"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[12.5px] outline-none"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] disabled:opacity-50"
          disabled={syncing}
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
          onClick={() => void syncArchive()}>
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'syncing the archive…' : mirror?.present ? `full archive: ${mirror.count} prompts` : 'sync the full archive'}
        </button>
      </div>

      {!mirror?.present && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl text-[11px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
          <Download size={12} className="mt-0.5 shrink-0" />
          <span>
            Flagship prompts open offline. Sync the full archive once (about 28 MB, needs git) and every entry here reads in full.
          </span>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap mb-3">
        <button onClick={() => setVendor('')}
          className="px-2.5 py-1 rounded-full text-[10.5px]"
          style={{ background: !vendor ? 'var(--primary)' : 'var(--elevated)', color: !vendor ? 'white' : 'var(--text-2)' }}>
          all · {PERSONAS_MANIFEST.length}
        </button>
        {vendors.map(([v, n]) => (
          <button key={v} onClick={() => setVendor(v === vendor ? '' : v)}
            className="px-2.5 py-1 rounded-full text-[10.5px]"
            style={{ background: vendor === v ? 'var(--primary)' : 'var(--elevated)', color: vendor === v ? 'white' : 'var(--text-2)' }}>
            {v} · {n}
          </button>
        ))}
      </div>

      <div className="surface overflow-hidden">
        {rows.map((p, i) => (
          <button key={p.path} onClick={() => open(p.slug, p.path)}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-[var(--elevated)]"
            style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
            <BookMarked size={12} className="shrink-0" style={{ color: p.slug ? 'var(--primary)' : 'var(--text-3)' }} />
            <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text-1)' }}>{p.title}</span>
            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-3)' }}>{p.vendor}{p.product ? ` / ${p.product}` : ''}</span>
            <span className="text-[9.5px] shrink-0 px-1.5 py-[1px] rounded-full"
              style={{ background: p.slug ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--elevated)', color: p.slug ? 'var(--success)' : 'var(--text-3)' }}>
              {p.slug ? 'in app' : 'archive'}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>Nothing matches.</div>}
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11.5px] flex-wrap" style={{ color: 'var(--text-2)' }}>
        <span>Default persona for new chats:</span>
        <select value={defaultPersonaId}
          onChange={(e) => useStore.setState((s) => ({ settings: { ...s.settings, defaultPersonaId: e.target.value || undefined } }))}
          className="px-2 py-1 rounded-lg text-[11px] outline-none"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
          <option value="">none (Research Engine voice)</option>
          {PERSONAS_MANIFEST.filter((p) => p.slug).map((p) => (
            <option key={p.slug} value={p.slug}>{p.vendor} / {p.title.slice(0, 48)}</option>
          ))}
        </select>
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>coding chats use {CODING_PERSONA_SLUG} unless a chat picks another</span>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[11.5px] flex-wrap" style={{ color: 'var(--text-2)' }}>
        <span>Default role for new chats:</span>
        <select value={defaultRoleId}
          onChange={(e) => useStore.setState((s) => ({ settings: { ...s.settings, defaultRoleId: e.target.value || undefined } }))}
          aria-label="Default role for new chats"
          className="px-2 py-1 rounded-lg text-[11px] outline-none"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
          <option value="">none</option>
          {ROLE_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{familyById(defaultRoleId)?.blurb ?? 'Picks the ECC methods that fit each question.'}</span>
      </div>

      {openSlug !== null && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-6" style={{ background: 'rgb(0 0 0 / .5)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenSlug(null) }}>
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-[12.5px] font-medium flex-1 truncate" style={{ color: 'var(--text-1)' }}>{openPath}</span>
              {openSlug && (
                <button className="px-2.5 py-1 rounded-lg text-[10.5px]"
                  style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                  onClick={() => { useStore.setState((s) => ({ settings: { ...s.settings, defaultPersonaId: openSlug } })); setOpenSlug(null) }}>
                  make default
                </button>
              )}
              <button className="px-2.5 py-1 rounded-lg text-[10.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                onClick={() => setOpenSlug(null)}>close</button>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
              {openText ?? 'Loading…'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Every system prompt in the app, sorted and named.
 *
 * The archive's own names are machine-made: `claude-code-fable-5-1` tells you
 * nothing until you have decoded it. This lists all of them, in every source,
 * with the model spelled out, so "which of my prompts is the Fable 5.1 one" is
 * a question you can answer by looking rather than by knowing the archive.
 *
 * A prompt with no model in its name says so, rather than being given a
 * plausible-sounding one.
 */
function ModelIndex() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<PromptSort>('name')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const all = useMemo(() => allPrompts(), [])
  const shown = useMemo(() => sortPrompts(filterPrompts(all, q), sort, dir), [all, q, sort, dir])
  const counts = promptCounts(all)
  const models = useMemo(() => knownModels(all), [all])

  const sorts: { id: PromptSort; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'model', label: 'Model' },
    { id: 'vendor', label: 'Vendor' },
    { id: 'size', label: 'Size' },
  ]

  return (
    <div className="surface p-4 mb-5">
      <div className="text-[13px] font-medium mb-0.5">Every system prompt, named</div>
      <div className="text-[11.5px] mb-3" style={{ color: 'var(--text-2)' }}>
        {all.length} prompts across {counts.master} master prompts, {counts.persona} archive entries,
        {' '}{counts.skill} built-in skills and {counts.pack} upstream packs, covering {models.length} named models.
        A prompt whose name carries no model is shown without one rather than given a guess.
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, model or vendor"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[12.5px] outline-none"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
        </div>
        {sorts.map((s2) => (
          <button key={s2.id}
            onClick={() => { if (sort === s2.id) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(s2.id); setDir('asc') } }}
            className="px-2.5 py-1.5 rounded-full text-[11.5px]"
            style={{
              background: sort === s2.id ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--elevated)',
              color: sort === s2.id ? 'var(--primary)' : 'var(--text-3)',
            }}>
            {s2.label}{sort === s2.id ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-auto rounded-xl" style={{ border: '1px solid var(--surface-border)' }}>
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0" style={{ background: 'var(--elevated)' }}>
            <tr style={{ color: 'var(--text-3)' }}>
              <th className="text-left font-medium px-2.5 py-1.5">Name</th>
              <th className="text-left font-medium px-2.5 py-1.5">Model</th>
              <th className="text-left font-medium px-2.5 py-1.5 hidden sm:table-cell">From</th>
              <th className="text-right font-medium px-2.5 py-1.5 hidden sm:table-cell">Size</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 300).map((p) => <PromptRow key={p.id} p={p} />)}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="px-3 py-4 text-center" style={{ color: 'var(--text-3)' }}>No prompt matches "{q}".</div>
        )}
        {shown.length > 300 && (
          <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
            Showing the first 300 of {shown.length}. Narrow the search to see the rest.
          </div>
        )}
      </div>
    </div>
  )
}

function PromptRow({ p }: { p: PromptEntry }) {
  const kindLabel = p.kind === 'master' ? 'master' : p.kind === 'skill' ? 'skill' : p.kind === 'pack' ? 'pack' : 'archive'
  return (
    <tr style={{ borderTop: '1px solid var(--surface-border)' }}>
      <td className="px-2.5 py-1.5">
        <div className="truncate" style={{ color: 'var(--text-1)' }}>{p.name}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>
          {kindLabel}{p.vendored ? '' : ' · not on this machine'}
        </div>
      </td>
      <td className="px-2.5 py-1.5" style={{ color: p.model ? 'var(--text-1)' : 'var(--text-3)' }}>
        {p.model ?? 'no model in the name'}
      </td>
      <td className="px-2.5 py-1.5 hidden sm:table-cell truncate" style={{ color: 'var(--text-3)' }}>
        {p.product ? `${p.vendor} / ${p.product}` : p.vendor}
      </td>
      <td className="px-2.5 py-1.5 text-right hidden sm:table-cell tabular-nums" style={{ color: 'var(--text-3)' }}>
        {formatChars(p.chars)}
      </td>
    </tr>
  )
}
