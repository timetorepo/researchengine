/**
 * CRM: a dashboard over Twenty. It reads the latest records live (totals, the
 * newest people and companies, a 14-day chart and how complete the records
 * are), finds people or companies by name, and adds a person.
 *
 * Nothing is stored here: every number comes from Twenty when the page opens,
 * and the Refresh button asks again. The counts that are sampled (the 14-day
 * chart and the coverage bars) describe the latest 60 records of each kind,
 * and the page says so.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Button, ButtonGroup, toast } from '@heroui/react'
import { Briefcase, Building2, Loader2, Plus, RefreshCw, Search, UserRound } from 'lucide-react'
import { crmCreate, crmOverview, crmSearch, type CrmOverviewKind } from '@/lib/services/client'
import { serviceReady } from '@/lib/services/config'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { openMarketplace } from '@/lib/composio/sync'
import { useUI } from '@/stores/useUI'

type View = 'overview' | 'people' | 'companies'
interface Overview { people: CrmOverviewKind; companies: CrmOverviewKind }
interface Row { id: string; name: string; detail: string; createdAt?: string }

const muted = { color: 'var(--text-3)' } as const
const card = { background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-card)' } as const
const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Shares of the latest rows that have a field filled in, as whole percentages. */
function pct(n: number, of: number): number {
  return of > 0 ? Math.round((n / of) * 100) : 0
}

export function CrmPage() {
  const ready = serviceReady('twenty')
  const [view, setView] = useState<View>('overview')
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Row[] | null>(null)
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    setError(null)
    const res = await crmOverview()
    setLoading(false)
    if (res.ok) setData(res.data as Overview)
    else setError(res.error)
  }, [ready])

  useEffect(() => { void load() }, [load])

  // Search runs once two letters are typed (Twenty needs at least two).
  useEffect(() => {
    const needle = q.trim()
    if (view === 'overview' || needle.length < 2) { setFound(null); return }
    const kind = view === 'people' ? 'people' : 'companies'
    let alive = true
    setSearching(true)
    const id = window.setTimeout(async () => {
      const res = await crmSearch(kind, needle)
      if (!alive) return
      setSearching(false)
      setFound(res.ok ? res.data.records : [])
      if (!res.ok) setError(res.error)
    }, 260)
    return () => { alive = false; window.clearTimeout(id); setSearching(false) }
  }, [q, view])

  const people = data?.people
  const companies = data?.companies
  const newPeople = people ? people.last14.reduce((a, b) => a + b, 0) : 0
  const newCompanies = companies ? companies.last14.reduce((a, b) => a + b, 0) : 0

  if (!ready) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-5 py-6 md:px-8 space-y-4">
          <Header />
          <InlineAlert status="accent" title="Connect Twenty to see your CRM">
            Add the Twenty key once in the Marketplace, under Built in. The dashboard then reads your people and companies live.{' '}
            <button type="button" className="underline underline-offset-2 font-medium" style={{ color: 'var(--primary)' }}
              onClick={() => { useUI.setState({ connectorsTab: 'builtin' }); openMarketplace() }}>
              Open Marketplace
            </button>
          </InlineAlert>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <Header />
          </div>
          <ButtonGroup size="sm" aria-label="CRM views">
            {(['overview', 'people', 'companies'] as const).map((v) => (
              <Button key={v} variant={view === v ? 'primary' : 'ghost'} onPress={() => { setView(v); setQ('') }}>
                {v === 'overview' ? 'Overview' : v === 'people' ? 'People' : 'Companies'}
              </Button>
            ))}
          </ButtonGroup>
          <Button size="sm" variant="ghost" onPress={() => void load()} isDisabled={loading} aria-label="Refresh CRM">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
          </Button>
        </div>

        {error && <p role="alert" className="text-[12px]" style={{ color: 'var(--danger, #e5484d)' }}>{error}</p>}

        {view !== 'overview' && (
          <div className="space-y-3">
            <div className="relative max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${view}`}
                placeholder={view === 'people' ? 'Search people by name' : 'Search companies by name'}
                className="w-full pl-8 pr-3 py-2 rounded-[12px] text-[12.5px] outline-none" style={field} />
            </div>
            <RowsCard
              title={q.trim().length >= 2 ? `Results for “${q.trim()}”` : view === 'people' ? 'Newest people' : 'Newest companies'}
              rows={(q.trim().length >= 2 ? found : (view === 'people' ? people?.recent : companies?.recent)) ?? []}
              loading={searching || (!data && loading)}
              kind={view === 'people' ? 'people' : 'companies'}
              empty={q.trim().length >= 2 ? 'Nothing matches that name.' : 'No records yet.'}
            />
          </div>
        )}

        {view === 'overview' && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="People" value={people?.total} hint="in Twenty" icon={<UserRound size={14} />} />
              <Kpi label="Companies" value={companies?.total} hint="in Twenty" icon={<Building2 size={14} />} />
              <Kpi label="New people" value={data ? newPeople : undefined} hint="last 14 days, latest 60" icon={<Plus size={14} />} accent />
              <Kpi label="New companies" value={data ? newCompanies : undefined} hint="last 14 days, latest 60" icon={<Briefcase size={14} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Chart: new records per day */}
              <section className="lg:col-span-2 p-4" style={card} aria-label="New records per day">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-[13px] font-semibold">New records</h2>
                    <p className="text-[11px]" style={muted}>Per day, last 14 days</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]" style={muted}>
                    <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} /> People</span>
                    <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: 'var(--text-3)' }} /> Companies</span>
                  </div>
                </div>
                {data ? <Chart a={people?.last14 ?? []} b={companies?.last14 ?? []} /> : <div className="h-[160px] flex items-center justify-center" style={muted}><Loader2 size={16} className="animate-spin" /></div>}
              </section>

              {/* Coverage: how complete the records are */}
              <section className="p-4 space-y-3" style={card} aria-label="How complete the records are">
                <div>
                  <h2 className="text-[13px] font-semibold">How complete</h2>
                  <p className="text-[11px]" style={muted}>Latest {people?.coverage.sample ?? 60} people and {companies?.coverage.sample ?? 60} companies</p>
                </div>
                {people && companies ? (
                  <div className="space-y-3">
                    <Bar label="People with email" value={pct(people.coverage.email, people.coverage.sample)} />
                    <Bar label="People with a job title" value={pct(people.coverage.jobTitle, people.coverage.sample)} />
                    <Bar label="People linked to a company" value={pct(people.coverage.company, people.coverage.sample)} />
                    <Bar label="Companies with a domain" value={pct(companies.coverage.domain, companies.coverage.sample)} />
                  </div>
                ) : <p className="text-[12px]" style={muted}>Loading</p>}
              </section>

              {/* Newest records */}
              <section className="lg:col-span-2" aria-label="Newest records">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <RowsCard title="Newest people" rows={people?.recent ?? []} loading={!data && loading} kind="people" empty="No people yet." compact />
                  <RowsCard title="Newest companies" rows={companies?.recent ?? []} loading={!data && loading} kind="companies" empty="No companies yet." compact />
                </div>
              </section>

              <AddPerson onAdded={() => void load()} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="text-[22px] font-semibold" style={{ letterSpacing: '-0.02em' }}>CRM</h1>
      <p className="text-[12.5px] mt-0.5" style={muted}>Your people and companies in Twenty, read live.</p>
    </div>
  )
}

function Kpi({ label, value, hint, icon, accent = false }: { label: string; value?: number; hint: string; icon: ReactNode; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      className="p-4 min-w-0" style={{ ...card, ...(accent ? { borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)' } : {}) }}>
      <div className="flex items-center gap-2 text-[11.5px]" style={muted}>
        <span style={{ color: accent ? 'var(--primary)' : 'var(--text-3)' }}>{icon}</span> {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
        {value === undefined ? <span className="inline-block h-6 w-14 rounded-md animate-pulse" style={{ background: 'var(--elevated)' }} /> : value.toLocaleString()}
      </div>
      <div className="text-[10.5px] mt-0.5 truncate" style={muted}>{hint}</div>
    </motion.div>
  )
}

/** Two lines over 14 days, drawn with SVG. Drawn in on open; no library needed. */
function Chart({ a, b }: { a: number[]; b: number[] }) {
  const W = 640, H = 160, P = 8
  const max = Math.max(1, ...a, ...b)
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, a.length - 1)
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path(a)} L${x(a.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" role="img" aria-label="New people and companies per day">
      <defs>
        <linearGradient id="crm-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="var(--surface-border)" strokeDasharray="3 4" />
      ))}
      {a.length > 0 && (
        <>
          <motion.path d={area} fill="url(#crm-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
          <motion.path d={path(a)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
          <motion.path d={path(b)} fill="none" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }} />
        </>
      )}
    </svg>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1">
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span className="tabular-nums" style={muted}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
        <motion.div className="h-full rounded-full" style={{ background: 'var(--primary)' }}
          initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

function RowsCard({ title, rows, loading, kind, empty, compact = false }: {
  title: string; rows: Row[]; loading: boolean; kind: 'people' | 'companies'; empty: string; compact?: boolean
}) {
  return (
    <section className="p-4" style={card} aria-label={title}>
      <h2 className="text-[13px] font-semibold mb-2">{title}</h2>
      {loading ? (
        <div className="py-6 flex justify-center" style={muted}><Loader2 size={15} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-[12px] py-4" style={muted}>{empty}</p>
      ) : (
        <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
          {rows.slice(0, compact ? 6 : 50).map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-[10px] hover:bg-[var(--elevated)] transition-colors min-w-0">
              <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10.5px] font-semibold"
                style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                {kind === 'people' ? initials(r.name) : (r.name.charAt(0).toUpperCase() || '?')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium truncate">{r.name || 'Untitled'}</span>
                {r.detail && <span className="block text-[11px] truncate" style={muted}>{r.detail.replace(/^https?:\/\//, '')}</span>}
              </span>
              {r.createdAt && <span className="text-[10.5px] shrink-0 tabular-nums" style={muted}>{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddPerson({ onAdded }: { onAdded: () => void }) {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!first.trim()) { setErr('Add a first name.'); return }
    setBusy(true); setErr(null)
    const res = await crmCreate({ kind: 'people', firstName: first.trim(), lastName: last.trim() || undefined, email: email.trim() || undefined })
    setBusy(false)
    if (!res.ok) { setErr(res.error); return }
    setFirst(''); setLast(''); setEmail('')
    toast.success('Person added', { description: 'It is in Twenty now.', timeout: 4000 })
    onAdded()
  }

  return (
    <section className="p-4 space-y-2.5" style={card} aria-label="Add a person">
      <h2 className="text-[13px] font-semibold">Add a person</h2>
      <input value={first} onChange={(e) => setFirst(e.target.value)} aria-label="First name" placeholder="First name"
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none" style={field} />
      <input value={last} onChange={(e) => setLast(e.target.value)} aria-label="Last name" placeholder="Last name"
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none" style={field} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" placeholder="Email (optional)" type="email"
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[12px] outline-none" style={field} />
      {err && <p role="alert" className="text-[11px]" style={{ color: 'var(--danger, #e5484d)' }}>{err}</p>}
      <Button size="sm" variant="primary" onPress={() => void save()} isDisabled={busy} className="w-full">
        {busy && <Loader2 size={12} className="animate-spin" />} Add person
      </Button>
    </section>
  )
}
