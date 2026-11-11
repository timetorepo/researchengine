/**
 * The component preview stage.
 *
 * A catalog hit is a name and an install line; the stage makes it a thing you
 * can look at. For the components this app vendors (SmoothUI's set, the
 * Aceternity pieces it ships) the real component renders on a stage with its
 * own light/dark switch, inside an error boundary so one misbehaving demo can
 * never take the studio down. For every other registry the card says plainly
 * that no live demo is vendored, and hands over the real install command and
 * the provider's page instead of pretending a screenshot is a preview.
 */
import React, { Suspense, useEffect, useState } from 'react'
import { Moon, Sun, ExternalLink, EyeOff, Package } from 'lucide-react'
import { liveDemoFor } from '@/lib/design/liveDemos'
import { uiProviderById, commandsFor, type UiProvider } from '@/lib/design/providers'
import type { CatalogItem } from '@/lib/design/catalog'

class DemoBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: any) { return { err: String(e?.message ?? e) } }
  render() {
    if (this.state.err) {
      return (
        <div className="text-[11px] text-center px-3" style={{ color: 'var(--text-3)' }}>
          The demo threw while rendering — the registry item is real, the local demo is not.
        </div>
      )
    }
    return this.props.children
  }
}

function LiveStage({ provider, item }: { provider: string; item: string }) {
  const [dark, setDark] = useState(true)
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)
  const [props, setProps] = useState<Record<string, any>>({})
  const [children, setChildren] = useState<React.ReactNode>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    setComp(null); setFailed(false)
    const demo = liveDemoFor(provider, item)
    if (!demo) return
    demo.load()
      .then((mod) => {
        if (!live) return
        setComp(() => demo.pick(mod))
        setProps(demo.props ?? {})
        setChildren(demo.children ?? null)
      })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [provider, item])

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Live demo — vendored in this app</span>
        <span className="flex-1" />
        <button onClick={() => setDark((d) => !d)} title={dark ? 'Judge it on light' : 'Judge it on dark'}
          className="p-1 rounded-md" style={{ color: 'var(--text-3)' }} aria-label="Toggle stage surface">
          {dark ? <Sun size={12} /> : <Moon size={12} />}
        </button>
      </div>
      <div className="cmp-stage" style={{ background: dark ? '#0d1117' : '#fafafa', color: dark ? '#e6e6e6' : '#1a1a1a' }}>
        <DemoBoundary>
          {failed && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>The demo could not load here.</div>}
          {!failed && Comp && (
            <Suspense fallback={<div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Loading the demo…</div>}>
              <Comp {...props}>{children}</Comp>
            </Suspense>
          )}
          {!failed && !Comp && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Loading the demo…</div>}
        </DemoBoundary>
      </div>
    </div>
  )
}

export function ComponentPreview({ item, manager }: { item: CatalogItem; manager: 'npm' | 'pnpm' | 'yarn' | 'bun' }) {
  const provider: UiProvider | undefined = uiProviderById(item.provider) ?? undefined
  const demo = liveDemoFor(item.provider, item.name)
  const cmds = provider ? commandsFor(provider, item.name, manager) : []

  return (
    <div data-ui="component-preview" className="flex flex-col gap-3 p-3 rounded-[12px]"
      style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ide-text, var(--text))' }}>{item.name}</div>
          <div className="text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{provider?.name} · {item.what}</div>
        </div>
        {provider && (
          <a href={provider.url} target="_blank" rel="noreferrer noopener" title={`Open ${provider.name}`}
            className="p-1.5 rounded-[7px] shrink-0" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {demo
        ? <LiveStage provider={item.provider} item={item.name} />
        : (
          <div className="flex items-start gap-2 p-3 rounded-[10px] text-[11.5px] leading-relaxed"
            style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
            <EyeOff size={13} className="mt-0.5 shrink-0" />
            <span>
              No live demo is vendored for this registry, so the stage will not fake one. Add it to the box and it lands in
              your project, where the canvas shows it for real — or open {provider?.name ?? 'the provider'} for the current version.
            </span>
          </div>
        )}

      {cmds.length > 0 && (
        <div className="flex flex-col gap-1">
          {cmds.map((c, i) => (
            <code key={i} className="text-[10.5px] font-mono px-2 py-1 rounded-[8px] truncate"
              style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-faint, var(--text-3))' }}>
              {c.command}
            </code>
          ))}
        </div>
      )}
      {cmds.length === 0 && (
        <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          <Package size={11} /> Copy-paste library — the code lives on the provider's site.
        </div>
      )}
    </div>
  )
}
