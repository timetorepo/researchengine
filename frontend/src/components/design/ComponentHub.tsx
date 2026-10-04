/**
 * The component hub: every provider, one search box, and the box.
 *
 * Search runs over the local catalog, which means it answers on the first
 * keystroke with no network at all. The provider's own site is one click away
 * for whatever the catalog does not list, and the provider's own CLI search
 * command is shown for the registries that publish one — so "not in the
 * catalog" is never a dead end, it is a copied command.
 */
import React, { useMemo, useState } from 'react'
import { Search, Plus, Check, ExternalLink, Filter, Info, Eye } from 'lucide-react'
import { UI_PROVIDERS, commandsFor, searchCommandFor, uiProviderById, type UiProvider } from '@/lib/design/providers'
import { searchCatalog, type CatalogItem } from '@/lib/design/catalog'
import { useDesign } from '@/stores/useDesign'
import { DependencyBox } from './DependencyBox'
import { ComponentPreview } from './ComponentPreview'

export function ComponentHub({ compact = false, initialQuery = '' }: {
  compact?: boolean
  /** Arriving from the Library's UI vertical, already searching for one thing. */
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [preview, setPreview] = useState<CatalogItem | null>(null)
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const box = useDesign((s) => s.box)
  const manager = useDesign((s) => s.manager)
  const addToBox = useDesign((s) => s.addToBox)

  const results = useMemo(() => searchCatalog(query, providerFilter.length ? providerFilter : null), [query, providerFilter])
  const providerOf = (id: string) => uiProviderById(id)

  const add = (provider: UiProvider, item: string, what: string, isPackage = false) => {
    addToBox({ provider: provider.id, item, what, isPackage })
    setAdded(`${provider.id}:${item}`)
    setTimeout(() => setAdded((k) => (k === `${provider.id}:${item}` ? null : k)), 1200)
  }

  const inBox = (provider: string, item: string) => box.some((b) => b.provider === provider && b.item === item)

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3 min-h-0'}>
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--ide-faint, var(--text-3))' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 300+ components — pricing table, marquee, chart, hero, dropzone…"
              className="ide-input w-full pl-8"
            />
          </div>
          <button onClick={() => setShowFilters((v) => !v)} title="Filter by provider"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11.5px]"
            style={{
              background: showFilters || providerFilter.length ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--ide-hover, var(--elevated))',
              color: providerFilter.length ? 'var(--primary)' : 'var(--ide-dim, var(--text-2))',
            }}>
            <Filter size={12} /> {providerFilter.length ? `${providerFilter.length} providers` : `All ${UI_PROVIDERS.length}`}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-1 p-2 rounded-[10px]" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
            {UI_PROVIDERS.map((p) => {
              const on = providerFilter.includes(p.id)
              return (
                <button key={p.id}
                  onClick={() => setProviderFilter((f) => (on ? f.filter((x) => x !== p.id) : [...f, p.id]))}
                  className="px-2 py-0.5 rounded-full text-[10.5px]"
                  style={{
                    background: on ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--ide-surface, var(--surface))',
                    color: on ? 'var(--primary)' : 'var(--ide-dim, var(--text-2))',
                  }}>
                  {p.name}
                </button>
              )
            })}
            {providerFilter.length > 0 && (
              <button onClick={() => setProviderFilter([])} className="px-2 py-0.5 text-[10.5px] underline" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                clear
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-1">
          {!results.length && (
            <div className="p-3 rounded-[10px] text-[12px]" style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
              Nothing in the local catalog matches "{query}". That does not mean it does not exist —
              open the provider and search there, or copy its CLI search command from the provider list below.
            </div>
          )}
          {results.map((item) => {
            const provider = providerOf(item.provider)
            if (!provider) return null
            const cmds = commandsFor(provider, item.name, manager)
            const saved = inBox(provider.id, item.name)
            return (
              <div key={item.id} className="group flex items-start gap-2 p-2 rounded-[10px]"
                style={{ background: 'var(--ide-hover, var(--elevated))' }} data-catalog-item={item.id}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-faint, var(--text-3))' }}>
                      {provider.name}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{item.what}</p>
                  {cmds[0] && (
                    <code className="text-[10.5px] font-mono mt-1 block truncate" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{cmds[0].command}</code>
                  )}
                  {provider.kind === 'copy' && (
                    <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                      Copy-paste library — open the site for the code{provider.needs?.length ? '; the runtime packages can go in the box' : ''}.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreview(item)}
                    title="Preview it here"
                    className="p-1.5 rounded-[7px]"
                    style={{
                      color: preview?.id === item.id ? 'var(--primary)' : 'var(--ide-faint, var(--text-3))',
                      background: preview?.id === item.id ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent',
                    }}>
                    <Eye size={12} />
                  </button>
                  <a href={provider.kind === 'copy' || provider.kind === 'package' ? provider.url : `${provider.url}`}
                    target="_blank" rel="noreferrer noopener" title={`Open ${provider.name}`}
                    className="p-1.5 rounded-[7px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => add(provider, item.name, item.what)}
                    disabled={saved}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] text-[11px]"
                    style={{
                      background: saved ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--ide-surface, var(--surface))',
                      color: saved ? 'var(--success)' : 'var(--ide-text, var(--text))',
                    }}>
                    {saved ? <Check size={11} /> : <Plus size={11} />} {saved ? 'In box' : 'Add'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Providers the catalog cannot search into — kept visible on purpose. */}
        <details className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          <summary className="cursor-pointer">All {UI_PROVIDERS.length} providers, and how each one installs</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {UI_PROVIDERS.map((p) => {
              const cmd = commandsFor(p, p.kind === 'namespace' ? '<component>' : '', manager)[0]?.command
              const search = searchCommandFor(p, 'button', manager)
              return (
                <div key={p.id} className="p-2 rounded-[9px]" style={{ background: 'var(--ide-hover, var(--elevated))' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{p.name}</span>
                    <span className="text-[10px] px-1.5 rounded-full" style={{ background: 'var(--ide-surface, var(--surface))' }}>{p.kind}</span>
                    <a href={p.url} target="_blank" rel="noreferrer noopener" className="ml-auto" style={{ color: 'var(--primary)' }}>open ↗</a>
                  </div>
                  <p className="mt-0.5" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{p.what}</p>
                  {cmd && <code className="block mt-1 text-[10.5px] font-mono truncate" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{cmd}</code>}
                  {search && <code className="block text-[10.5px] font-mono truncate" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{search}</code>}
                  {p.note && <p className="mt-0.5 flex items-start gap-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}><Info size={10} className="mt-[2px]" /> {p.note}</p>}
                  {(p.kind === 'package' || p.kind === 'copy') && p.pkg !== undefined && (
                    <button onClick={() => add(p, p.pkg!, `${p.name} package`, true)} className="mt-1 text-[10.5px]" style={{ color: 'var(--primary)' }}>
                      add the package to the box
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      </div>

      {!compact && (
        <div className="flex flex-col gap-2.5 xl:sticky xl:top-0 h-fit">
          {/* The stage: a catalog hit you can look at, not just install. */}
          {preview && <ComponentPreview item={preview} manager={manager} />}
          <div className="p-2.5 rounded-[12px]" style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
            <DependencyBox compact />
          </div>
        </div>
      )}
      {compact && (
        <div className="p-2.5 rounded-[12px]" style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
          <DependencyBox compact />
        </div>
      )}
    </div>
  )
}
