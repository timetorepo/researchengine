import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlignJustify, Check, ChevronDown, EyeOff, Filter, Loader2, Plus, RefreshCw, RotateCcw, Search, Settings2, Waves } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { PROVIDERS, providerById } from '@/lib/providers/registry'
import { refreshAllModels, refreshProviderModels } from '@/lib/providers/refresh'
import { ProviderLogo } from '@/components/shared/ProviderLogo'
import { ModelLogo, modelLogoLabel } from '@/components/shared/ModelLogo'
import { modelTier, selectModels, TIER_REF, type TierFilter, type TierSort } from '@/lib/providers/tiers'
// React Bits — Micro (added unmodified, see components/ui/reactbits/micro).
import RubberSegment from '@/components/ui/reactbits/micro/RubberSegment'
import GlideSelect from '@/components/ui/reactbits/micro/GlideSelect'

/**
 * The model picker.
 *
 * Three things it does that the previous version did not, all asked for:
 *
 *   • **Every model has a mark.** A family mark where the model id names a family
 *     we can draw, otherwise the provider's own logo. (See ModelLogo.)
 *   • **Free and paid can be separated.** The filter and the sort come from
 *     `lib/providers/tiers.ts`, which explains every answer it gives, and the
 *     user's own correction (right-click a row → Mark as…) beats the rules.
 *   • **Models can be unlisted.** Hiding one stores `provider:model` in
 *     `settings.hiddenModels`; the picker keeps them in a collapsed section so
 *     nothing is ever lost, and one click puts them back.
 *
 * And the hover: rows magnify like a dock as the pointer moves down the list —
 * the hovered row grows, its neighbours a little, the rest stay put. Only
 * `transform: scale` changes, so nothing reflows underneath the pointer.
 *
 * The dock is a preference, not a law: `settings.dockAnimation` turns it off and
 * the list becomes a perfectly still one, which is what you want when you are
 * scanning a long list rather than playing with it. The switch is in the picker
 * itself (bottom bar) because that is where you notice you want it.
 */

/** How much a row grows, and how far the effect reaches (in rows). */
const DOCK_SCALE = 0.17
const DOCK_REACH = 2.2
const dockScaleFor = (distance: number) => 1 + DOCK_SCALE * Math.exp(-(distance * distance) / (DOCK_REACH * DOCK_REACH))

interface Row {
  provider: string
  providerName: string
  model: string
  ref: string
}

function TierChip({ providerId, model }: { providerId: string; model: string }) {
  const tiers = useStore((s) => s.settings.modelTiers) ?? {}
  const info = modelTier(providerId, model, tiers)
  if (!info.tier) return null
  const free = info.tier === 'free'
  return (
    <span
      title={`${free ? 'Free' : 'Paid'} — ${info.why}${info.source === 'user' ? ' (your setting)' : ''}`}
      className="px-1.5 py-[1px] rounded-full text-[9.5px] font-semibold uppercase tracking-wide shrink-0"
      style={{
        background: free ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--elevated)',
        color: free ? 'var(--success)' : 'var(--text-3)',
      }}
    >
      {free ? 'free' : 'paid'}
    </span>
  )
}

export function ModelPicker() {
  const ui = useUI()
  const settings = useStore((s) => s.settings)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // The filter and the order are remembered between openings: re-picking your
  // view every time the picker opens is exactly the clunkiness this replaced.
  const filter = (settings.modelTierFilter ?? 'all') as TierFilter
  const sort = (settings.modelSort ?? 'provider') as TierSort
  const setFilter = (v: TierFilter) => patchSettings({ modelTierFilter: v })
  const setSort = (v: TierSort) => patchSettings({ modelSort: v })
  const [showHidden, setShowHidden] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const [curProvider, curModel] = settings.defaultModel.split(':')
  const providerModels = settings.providerModels ?? {}
  const tiers = settings.modelTiers ?? {}
  const hidden = useMemo(() => new Set(settings.hiddenModels ?? []), [settings.hiddenModels])
  const patchSettings = (patch: any) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))

  const hasAnyModels = PROVIDERS.some((p) => (providerModels[p.id]?.length ?? 0) > 0)

  // Every model the app knows about, with its provider, tier and visibility.
  const allRows: Row[] = useMemo(() => PROVIDERS.flatMap((p) =>
    (providerModels[p.id] ?? []).map((m) => ({
      provider: p.id, providerName: p.name, model: m, ref: `${p.id}:${m}`,
    }))), [providerModels])

  // Search, filter, sort and unlisting all live in one pure function
  // (lib/providers/tiers.ts → selectModels) so the list's behaviour is tested
  // without a browser.
  const selection = useMemo(() => selectModels(allRows, {
    hidden: settings.hiddenModels ?? [],
    overrides: tiers,
    filter, sort, query,
  }), [allRows, settings.hiddenModels, tiers, filter, sort, query])

  const sorted = selection.visible
  const hiddenRows = selection.hidden

  // Grouped by provider for display; the dock index runs continuously across
  // groups, which is what makes the magnification feel like one strip.
  const groups = useMemo(() => {
    if (sort !== 'provider') return [{ provider: '__flat', providerName: '', rows: sorted }]
    const order: string[] = []
    const byProvider = new Map<string, typeof sorted>()
    for (const row of sorted) {
      if (!byProvider.has(row.provider)) { byProvider.set(row.provider, []); order.push(row.provider) }
      byProvider.get(row.provider)!.push(row)
    }
    return order.map((id) => ({
      provider: id,
      providerName: byProvider.get(id)![0].providerName,
      rows: byProvider.get(id)!,
    }))
  }, [sorted, sort])

  const hiddenModels = (settings.hiddenModels ?? [])
  const hideModel = (ref: string) => patchSettings({ hiddenModels: [...hiddenModels, ref] })
  const unhideModel = (ref: string) => patchSettings({ hiddenModels: hiddenModels.filter((r) => r !== ref) })
  const setTier = (ref: string, tier: 'free' | 'paid') => patchSettings({ modelTiers: { ...tiers, [ref]: tier } })

  const openProviders = () => { setOpen(false); ui.openSettings('providers') }
  const refresh = async () => { setRefreshing(true); try { await refreshAllModels() } finally { setRefreshing(false) } }

  const freeCount = selection.counts.free
  const paidCount = selection.counts.paid

  // The dock: row at `index` scales by its distance from the hovered row — when
  // the dock is switched on. Off means scale stays exactly 1 and the rows are
  // still (the hover background is then the only feedback).
  const dockOn = settings.dockAnimation !== false
  let index = -1
  const renderRow = (row: Row) => {
    index += 1
    const i = index
    const distance = hovered === null ? Number.POSITIVE_INFINITY : Math.abs(i - hovered)
    const scale = dockOn ? dockScaleFor(distance) : 1
    const active = settings.defaultModel === row.ref
    const isHidden = hidden.has(row.ref)
    return (
      <motion.div
        key={row.ref}
        onMouseEnter={() => (dockOn ? setHovered(i) : undefined)}
        className="relative flex items-center rounded-[10px]"
        style={{ originX: 0, zIndex: scale > 1.02 ? 5 : 1 }}
        animate={{ scale }}
        transition={dockOn
          ? { type: 'spring', stiffness: 480, damping: 30, mass: 0.6 }
          : { duration: 0 }}
      >
        <button
          role="option"
          aria-selected={active}
          onClick={() => { patchSettings({ defaultModel: row.ref }); setOpen(false) }}
          onContextMenu={(e) => {
            // Right-click is the quiet way to say "this one is actually paid".
            e.preventDefault()
            const info = modelTier(row.provider, row.model, tiers)
            setTier(row.ref, info.tier === 'free' ? 'paid' : 'free')
          }}
          title={`${modelLogoLabel(row.model, row.providerName)} — right-click to mark it ${modelTier(row.provider, row.model, tiers).tier === 'free' ? 'paid' : 'free'}`}
          className="flex-1 min-w-0 flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-[10px] text-left transition-colors hover:bg-[var(--surface)]"
        >
          <span className="shrink-0 flex items-center justify-center" style={{ width: 16, height: 16 }}>
            <ModelLogo model={row.model} provider={row.provider} size={15} />
          </span>
          <span className="flex-1 min-w-0 truncate font-mono text-[12px]" style={{ color: active ? 'var(--primary)' : 'var(--text-2)' }}>
            {row.model}
          </span>
          <TierChip providerId={row.provider} model={row.model} />
          {active && <Check size={13} className="shrink-0" />}
        </button>
        <button
          aria-label={`Unlist ${row.model}`}
          title="Unlist this model (nothing is deleted — it moves to the hidden list)"
          onClick={() => (isHidden ? unhideModel(row.ref) : hideModel(row.ref))}
          className="mr-1 p-1 rounded-[8px] opacity-0 group-hover:opacity-100 hover:bg-[var(--elevated)] focus:opacity-100"
          style={{ color: 'var(--text-3)' }}
        >
          <EyeOff size={12} />
        </button>
      </motion.div>
    )
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors hover:bg-[var(--elevated)]"
        style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}
        aria-haspopup="listbox" aria-expanded={open}
      >
        {curProvider ? <ProviderLogo id={curProvider} size={14} /> : <Plus size={14} style={{ color: 'var(--text-3)' }} />}
        <span className="max-w-[180px] truncate">{curModel || 'Add models'}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }} className="inline-flex">
          <ChevronDown size={13} style={{ color: 'var(--text-3)' }} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full mt-2 w-80 max-h-[62vh] overflow-y-auto surface-elevated p-1.5 z-50"
            style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.5)' }}
            role="listbox"
            onMouseLeave={() => setHovered(null)}
          >
            {/* Search + the free/paid control + sort */}
            <div className="sticky top-0 z-10 px-1.5 pt-1.5 pb-1" style={{ background: 'var(--elevated)' }}>
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-[10px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
                <Search size={13} style={{ color: 'var(--text-3)' }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={open}
                  placeholder="Search models" aria-label="Search models"
                  className="w-full bg-transparent outline-none text-[12px]" />
                {query && <button onClick={() => setQuery('')} aria-label="Clear model search" style={{ color: 'var(--text-3)' }}>×</button>}
              </div>
              {hasAnyModels && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {/* Rubber Segment and Glide Select are React Bits — Micro
                      components, used as published. */}
                  <RubberSegment
                    aria-label="Free or paid models"
                    items={[
                      { value: 'all', label: 'All' },
                      { value: 'free', label: freeCount ? `Free ${freeCount}` : 'Free' },
                      { value: 'paid', label: paidCount ? `Paid ${paidCount}` : 'Paid' },
                    ]}
                    value={filter}
                    onChange={(v) => setFilter(v as TierFilter)}
                    size="sm"
                    trackColor="var(--surface)"
                    thumbColor="var(--elevated)"
                    textColor="var(--text-2)"
                    activeTextColor="var(--text)"
                    radius={999}
                  />
                  <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                    <Filter size={11} />
                    <GlideSelect
                      options={[
                        { value: 'provider', label: 'By provider' },
                        { value: 'name', label: 'By name' },
                        { value: 'free-first', label: 'Free first' },
                      ]}
                      value={sort}
                      onChange={(v) => setSort(v as TierSort)}
                      size="sm"
                      placement="bottom"
                      align="right"
                      menuWidth={160}
                      accentColor="var(--primary)"
                      surfaceColor="var(--elevated)"
                      highlightColor="var(--surface)"
                      textColor="var(--text-2)"
                      ariaLabel="Sort models"
                    />
                  </span>
                </div>
              )}
            </div>

            {!hasAnyModels ? (
              <div className="flex flex-col items-center text-center px-4 py-6">
                <button onClick={openProviders} aria-label="Add models"
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5 transition-transform hover:scale-105"
                  style={{ background: 'var(--primary)', color: '#fff' }}>
                  <Plus size={18} />
                </button>
                <div className="text-[13px] font-medium mb-0.5">Add models</div>
                <div className="text-[11.5px] leading-snug mb-3" style={{ color: 'var(--text-3)' }}>
                  Connect a provider — model names are fetched live, never hardcoded.
                </div>
                <button onClick={openProviders} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'var(--elevated)', color: 'var(--text)' }}>
                  Add API keys
                </button>
              </div>
            ) : (
              <>
                {groups.map((group) => (
                  <div key={group.provider} className="mb-1">
                    {sort === 'provider' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                        <ProviderLogo id={group.provider} size={12} /> {group.providerName}
                        {group.rows.length === 0 && (
                          <button
                            onClick={async (e) => { e.stopPropagation(); try { await refreshProviderModels(group.provider) } catch { /* surfaced elsewhere */ } }}
                            className="ml-auto flex items-center gap-1 font-normal normal-case hover:underline" style={{ color: 'var(--primary)' }}>
                            <Plus size={11} /> Add models
                          </button>
                        )}
                      </div>
                    )}
                    <div className="group">
                      {group.rows.map(renderRow)}
                    </div>
                  </div>
                ))}

                {!sorted.length && (
                  <div className="px-3 py-5 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>
                    {query.trim() ? `No models match “${query}”.` : filter === 'all' ? 'No models here yet.' : `No ${filter} models.`}
                    {filter !== 'all' && (
                      <button onClick={() => setFilter('all')} className="block mx-auto mt-1.5 text-[11.5px] hover:underline" style={{ color: 'var(--primary)' }}>
                        Show all models
                      </button>
                    )}
                  </div>
                )}

                {/* Unlisted models: never deleted, one click away */}
                {hiddenModels.length > 0 && (
                  <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <button
                      onClick={() => setShowHidden((s) => !s)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] text-[11.5px] hover:bg-[var(--surface)]"
                      style={{ color: 'var(--text-3)' }}
                    >
                      <EyeOff size={12} />
                      {hiddenModels.length} unlisted model{hiddenModels.length === 1 ? '' : 's'}
                      <motion.span animate={{ rotate: showHidden ? 180 : 0 }} className="ml-auto inline-flex">
                        <ChevronDown size={12} />
                      </motion.span>
                    </button>
                    <AnimatePresence>
                      {showHidden && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }} className="overflow-hidden">
                          {(hiddenRows.length ? hiddenRows : allRows.filter((r) => hidden.has(r.ref))).map((row) => {
                            const p = providerById(row.provider)
                            return (
                              <div key={row.ref} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
                                <ModelLogo model={row.model} provider={row.provider} size={14} />
                                <span className="flex-1 min-w-0 truncate font-mono text-[11.5px]">{row.model}</span>
                                <span className="text-[10.5px] shrink-0">{p?.name}</span>
                                <button onClick={() => unhideModel(row.ref)} title="Put it back in the list"
                                  className="p-1 rounded-[8px] hover:bg-[var(--elevated)]" style={{ color: 'var(--primary)' }}>
                                  <RotateCcw size={11} />
                                </button>
                              </div>
                            )
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

            <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <button onClick={refresh} disabled={refreshing}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)] disabled:opacity-60"
                style={{ color: 'var(--text-2)' }}>
                {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {refreshing ? 'Fetching models…' : 'Refresh models'}
              </button>
              <button onClick={openProviders}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)]"
                style={{ color: 'var(--primary)' }}>
                <Settings2 size={14} /> Manage providers…
              </button>
              {hasAnyModels && (
                <button
                  onClick={() => patchSettings({ dockAnimation: !dockOn })}
                  role="switch"
                  aria-checked={dockOn}
                  title={dockOn
                    ? 'Rows grow under the pointer like a dock. Turn it off for a still list.'
                    : 'The list is still. Turn the dock back on if you miss it.'}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] hover:bg-[var(--surface)]"
                  style={{ color: 'var(--text-2)' }}
                >
                  {dockOn ? <Waves size={14} /> : <AlignJustify size={14} />}
                  Dock animation
                  <span
                    className="ml-auto relative w-[30px] h-[17px] rounded-full transition-colors shrink-0"
                    style={{ background: dockOn ? 'var(--primary)' : 'var(--surface-border)' }}
                  >
                    <motion.span
                      className="absolute top-[2px] w-[13px] h-[13px] rounded-full"
                      style={{ background: '#fff' }}
                      animate={{ left: dockOn ? 15 : 2 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                    />
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
