/**
 * Two leaderboards in the model picker.
 *
 * The world board is pulled live from OpenRouter's public models API and
 * ranked by value (context per dollar, free models first). The local board
 * ranks what this app actually uses — provider · model pairs from the
 * connection log, ordered by usage and reliability. Nothing here pretends to
 * be an arena score; each row says exactly what it is ranked on.
 */
import { useEffect, useState } from 'react'
import { Trophy, RefreshCw, Loader2, Globe, Cpu, ExternalLink } from 'lucide-react'
import { fetchOpenRouterModels, rankConnections, type ExternalRank, type LocalRank } from '@/lib/models/rankings'
import { useStore } from '@/stores/useStore'

export function RankingsView() {
  const [board, setBoard] = useState<'world' | 'yours'>('world')
  const [world, setWorld] = useState<ExternalRank[] | null>(null)
  const [worldErr, setWorldErr] = useState('')
  const [loading, setLoading] = useState(false)
  const log = useStore((s) => s.connectionLog)

  const load = async () => {
    setLoading(true); setWorldErr('')
    try {
      setWorld(await fetchOpenRouterModels(40))
    } catch (e: any) {
      setWorldErr(e?.message ?? 'The OpenRouter API could not be reached from here.')
    }
    setLoading(false)
  }
  useEffect(() => { if (world === null) void load() /* first open only */ }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const local: LocalRank[] = rankConnections(log ?? [])

  return (
    <div className="px-1.5 pt-1 pb-2">
      <div className="flex items-center gap-1 mb-2">
        {([['world', <Globe size={10} key="g" />, 'World'], ['yours', <Cpu size={10} key="c" />, 'Yours']] as const).map(([id, icon, label]) => (
          <button key={id} onClick={() => setBoard(id)} data-ui={`rankings-${id}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]"
            style={board === id ? { background: 'var(--primary)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>
            {icon} {label}
          </button>
        ))}
        {board === 'world' && (
          <button onClick={() => void load()} title="Refresh the live board" className="ml-auto p-1 rounded-full" style={{ color: 'var(--text-3)' }}>
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </button>
        )}
      </div>

      {board === 'world' && (
        <>
          <p className="text-[10px] mb-1.5 leading-snug" style={{ color: 'var(--text-3)' }}>
            Live from the OpenRouter API — ranked by context per dollar; free models first. Not an arena score, a price/value board.
          </p>
          {loading && !world && <div className="flex items-center gap-1.5 text-[11px] px-1 py-2" style={{ color: 'var(--text-3)' }}><Loader2 size={11} className="animate-spin" /> fetching the live model list…</div>}
          {worldErr && <p className="text-[11px] px-1 py-2 leading-snug" style={{ color: 'var(--danger, #e5484d)' }}>{worldErr}</p>}
          {world?.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] hover:bg-[var(--elevated)]">
              <span className="w-5 text-right text-[10px] font-mono shrink-0" style={{ color: i < 3 ? 'var(--primary)' : 'var(--text-3)' }}>{i + 1}</span>
              <Trophy size={10} className="shrink-0" style={{ color: i === 0 ? '#e8b64c' : i < 3 ? 'var(--text-3)' : 'var(--surface-border)' }} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] truncate" style={{ color: 'var(--text)' }}>{m.name}</div>
                <div className="text-[9.5px] truncate" style={{ color: 'var(--text-3)' }}>{m.why}{m.free ? ' · $0/M tokens' : ` · $${m.promptPerM.toFixed(2)}/$${m.completionPerM.toFixed(2)} per M`}</div>
              </div>
              {m.free && <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' }}>free</span>}
            </div>
          ))}
          {world && !world.length && !loading && <p className="text-[11px] px-1 py-2" style={{ color: 'var(--text-3)' }}>The API answered with no models.</p>}
          <a href="https://openrouter.ai/rankings" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] mt-1.5 px-1" style={{ color: 'var(--text-3)' }}>
            <ExternalLink size={9} /> Full rankings on openrouter.ai
          </a>
        </>
      )}

      {board === 'yours' && (
        <>
          <p className="text-[10px] mb-1.5 leading-snug" style={{ color: 'var(--text-3)' }}>
            Your configured providers and models, from this app's connection log — ranked on usage, success rate and freshness.
          </p>
          {local.length === 0 && (
            <p className="text-[11px] px-1 py-2 leading-snug" style={{ color: 'var(--text-3)' }}>
              Nothing to rank yet. Ask a question or compare models, and every call lands in this board.
            </p>
          )}
          {local.slice(0, 24).map((m, i) => (
            <div key={m.key} className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] hover:bg-[var(--elevated)]">
              <span className="w-5 text-right text-[10px] font-mono shrink-0" style={{ color: i < 3 ? 'var(--primary)' : 'var(--text-3)' }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] truncate" style={{ color: 'var(--text)' }}>{m.label}</div>
                <div className="text-[9.5px] truncate" style={{ color: 'var(--text-3)' }}>{m.why}</div>
              </div>
              <span className="text-[9.5px] font-mono shrink-0" style={{ color: 'var(--text-2)' }}>{m.score}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
