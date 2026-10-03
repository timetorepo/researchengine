/**
 * The board — Stitch-style, in the app.
 *
 * Directions sit side by side as cards you can compare, instead of three
 * paragraphs in a chat that scroll away. Each card carries the things that
 * decide a design: the idea in one sentence, the type, the palette as real
 * values, the motion rule, and the components it would use — and those
 * components can go straight into the dependency box.
 */
import React, { useState } from 'react'
import { Plus, Check, Trash2, Sparkles, ClipboardCopy, Box } from 'lucide-react'
import { useDesign } from '@/stores/useDesign'
import { briefAsPrompt, suggestDirections } from '@/lib/design/suggest'
import { CATALOG } from '@/lib/design/catalog'
import { uiProviderById, commandsFor } from '@/lib/design/providers'

export function DesignBoard({ onOpenBrief }: { onOpenBrief?: () => void }) {
  const brief = useDesign((s) => s.brief)
  const directions = useDesign((s) => s.directions)
  const addDirection = useDesign((s) => s.addDirection)
  const chooseDirection = useDesign((s) => s.chooseDirection)
  const removeDirection = useDesign((s) => s.removeDirection)
  const addToBox = useDesign((s) => s.addToBox)
  const manager = useDesign((s) => s.manager)
  const [copied, setCopied] = useState(false)

  const chosen = directions.find((d) => d.chosen) ?? null

  const suggest = () => {
    for (const d of suggestDirections(brief)) addDirection(d)
  }

  const copyPrompt = async () => {
    if (!chosen) return
    const text = [
      briefAsPrompt(brief),
      '',
      `CHOSEN DIRECTION — ${chosen.title} (${chosen.style})`,
      chosen.idea,
      `Type: ${chosen.type}`,
      `Palette: ${chosen.palette.join(' · ')}`,
      `Motion: ${chosen.motion}`,
      `Components: ${chosen.components.join(', ') || 'none chosen yet'}`,
    ].join('\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch { /* blocked */ }
  }

  const addComponent = (label: string) => {
    // Labels are "ProviderName — item". Find the pair and put the right line in
    // the box, using the provider's own command builder.
    const [providerName, item] = label.split(' — ')
    const provider = CATALOG.find((c) => c.name === item)
    const p = provider ? uiProviderById(provider.provider) : null
    if (p && item) {
      addToBox({ provider: p.id, item, what: provider?.what ?? '' })
      // and make the command visible immediately by touching the manager
      void commandsFor(p, item, manager)
    }
  }

  return (
    <div className="flex flex-col gap-3 min-h-0" data-design-board>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>Design board</span>
        <span className="text-[11px]" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
          {directions.length ? `${directions.length} direction${directions.length === 1 ? '' : 's'}` : 'no directions yet'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {!directions.length && onOpenBrief && (
            <button onClick={onOpenBrief} className="text-[11px] underline decoration-dotted" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
              answer the brief first
            </button>
          )}
          <button onClick={suggest}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg, white)' }}>
            <Sparkles size={11} /> Suggest three directions
          </button>
        </div>
      </div>

      {!directions.length ? (
        <div className="p-3 rounded-[10px] text-[12px] leading-relaxed" style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-dim, var(--text-2))' }}>
          Directions appear here as cards: an idea, a type pairing, a palette with real values, a motion rule and the
          components to build it with. Press <b>Suggest three directions</b> to start from the brief, then edit — the
          suggestion is a starting point, not a decision.
        </div>
      ) : (
        <div className="min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 pr-1">
          {directions.map((d) => (
            <div key={d.id} className="p-3 rounded-[12px] flex flex-col gap-2"
              style={{
                background: 'var(--ide-hover, var(--elevated))',
                border: `1px solid ${d.chosen ? 'color-mix(in srgb, var(--primary) 55%, transparent)' : 'var(--ide-line, var(--surface-border))'}`,
              }} data-direction={d.id}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--ide-text, var(--text))' }}>{d.title}</div>
                  <div className="text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--ide-faint, var(--text-3))' }}>{d.style}</div>
                </div>
                <button onClick={() => removeDirection(d.id)} title="Remove" className="p-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
                  <Trash2 size={11} />
                </button>
              </div>

              <p className="text-[11.5px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{d.idea}</p>

              <div>
                <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Type</div>
                <p className="text-[11px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{d.type}</p>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Palette</div>
                <div className="flex flex-wrap items-center gap-1">
                  {(d.palette ?? []).map((p) => {
                    const hex = /#[0-9a-f]{3,8}/i.exec(p)?.[0] ?? null
                    return (
                      <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono"
                        style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-dim, var(--text-2))' }}>
                        {hex && <span className="w-2.5 h-2.5 rounded-full" style={{ background: hex, border: '1px solid var(--ide-line, var(--surface-border))' }} />}
                        {p}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Motion</div>
                <p className="text-[11px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>{d.motion}</p>
              </div>

              {d.components.length > 0 && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: 'var(--ide-faint, var(--text-3))' }}>Components</div>
                  <div className="flex flex-wrap gap-1">
                    {(d.components ?? []).map((c) => (
                      <button key={c} onClick={() => addComponent(c)} title="Put this component's install line in the box"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px]"
                        style={{ background: 'var(--ide-surface, var(--surface))', color: 'var(--ide-dim, var(--text-2))' }}>
                        <Box size={9} /> {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => chooseDirection(d.id)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11.5px] font-medium"
                style={{
                  background: d.chosen ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'var(--ide-surface, var(--surface))',
                  color: d.chosen ? 'var(--success)' : 'var(--ide-text, var(--text))',
                }}>
                {d.chosen ? <><Check size={11} /> Chosen — build this one</> : <>Build this direction</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {chosen && (
        <div className="p-2.5 rounded-[10px] flex items-center gap-2" style={{ background: 'var(--ide-surface, var(--surface))', border: '1px solid var(--ide-line, var(--surface-border))' }}>
          <span className="text-[11.5px]" style={{ color: 'var(--ide-dim, var(--text-2))' }}>
            <b style={{ color: 'var(--ide-text, var(--text))' }}>{chosen.title}</b> is the direction. Attach it to your next message, or copy the block.
          </span>
          <button onClick={copyPrompt} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-[7px] text-[11px]"
            style={{ background: 'var(--ide-hover, var(--elevated))', color: 'var(--ide-text, var(--text))' }}>
            {copied ? <Check size={11} /> : <ClipboardCopy size={11} />} {copied ? 'Copied' : 'Copy brief + direction'}
          </button>
        </div>
      )}
    </div>
  )
}
