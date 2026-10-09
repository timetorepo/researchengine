import { useEffect, useMemo, useState } from 'react'
import { BookMarked, Download, RefreshCw, Search } from 'lucide-react'
import { PERSONAS_MANIFEST, personaText, CODING_PERSONA_SLUG } from '@/lib/personas'
import { useStore } from '@/stores/useStore'

/**
 * The persona library: every system prompt in the upstream archive, browsable
 * offline. Vendored ones open their full text here; the rest open once the
 * machine mirrors the archive (one command, then this tab sees everything).
 */
export function PersonasTab() {
  const [q, setQ] = useState('')
  const [vendor, setVendor] = useState<string>('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [openText, setOpenText] = useState<string | null>(null)
  const [openPath, setOpenPath] = useState<string>('')
  const [mirror, setMirror] = useState<{ present: boolean; count: number } | null>(null)
  const defaultPersonaId = useStore((s) => s.settings.defaultPersonaId ?? '')

  useEffect(() => {
    fetch('/api/personas/local').then((r) => r.json()).then(setMirror).catch(() => setMirror({ present: false, count: 0 }))
  }, [])

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
    setOpenSlug(slug); setOpenPath(path); setOpenText(null)
    if (slug) { setOpenText(await personaText(slug)); return }
    const r = await fetch(`/api/personas/text?path=${encodeURIComponent(path)}`).then((x) => x.json()).catch(() => null)
    setOpenText(r?.text ? `${r.text}${r.truncated ? '\n\n(truncated at 200k chars)' : ''}` : null)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Personas</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--text-2)' }}>
        {PERSONAS_MANIFEST.length} system prompts from the public archive, archived for research into what frontier products sound like.
        Attach one to a chat and the model answers in its voice, on top of your own prompts.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts, products, vendors"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[12.5px] outline-none"
            style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }} />
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}
          onClick={() => fetch('/api/personas/local').then((r) => r.json()).then(setMirror).catch(() => {})}>
          <RefreshCw size={12} />
          {mirror === null ? 'checking mirror…' : mirror.present ? `full mirror: ${mirror.count} prompts` : 'mirror not synced'}
        </button>
      </div>

      {!mirror?.present && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl text-[11px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-3)' }}>
          <Download size={12} className="mt-0.5 shrink-0" />
          <span>
            The vendored set below opens offline. For the whole archive on this machine run
            <code className="mx-1 font-mono" style={{ color: 'var(--text-2)' }}>node scripts/sync-personas.mjs</code>
            once; the library then serves every entry.
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
              {p.slug ? 'in app' : 'mirror'}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>Nothing matches.</div>}
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
        <span>Default persona for new chats:</span>
        <select value={defaultPersonaId}
          onChange={(e) => useStore.setState((s) => ({ settings: { ...s.settings, defaultPersonaId: e.target.value } }))}
          className="px-2 py-1 rounded-lg text-[11px] outline-none"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }}>
          <option value="">none (Research Engine voice)</option>
          {PERSONAS_MANIFEST.filter((p) => p.slug).map((p) => (
            <option key={p.slug} value={p.slug}>{p.vendor} / {p.title.slice(0, 48)}</option>
          ))}
        </select>
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>coding chats default to {CODING_PERSONA_SLUG} unless a chat picks otherwise</span>
      </div>

      {openSlug !== null && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-6" style={{ background: 'rgb(0 0 0 / .5)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenSlug(null) }}>
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
              <span className="text-[12.5px] font-medium flex-1 truncate" style={{ color: 'var(--text-1)' }}>{openPath}</span>
              <button className="px-2.5 py-1 rounded-lg text-[10.5px]"
                style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                onClick={() => { useStore.setState((s) => ({ settings: { ...s.settings, defaultPersonaId: openSlug || undefined } })); setOpenSlug(null) }}>
                make default
              </button>
              <button className="px-2.5 py-1 rounded-lg text-[10.5px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}
                onClick={() => setOpenSlug(null)}>close</button>
            </div>
            <pre className="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
              {openText ?? 'sync the mirror to read this one: node scripts/sync-personas.mjs'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
