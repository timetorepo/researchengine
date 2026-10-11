import { useState } from 'react'
import { X } from 'lucide-react'
import { generatePalette } from '@usespaceui/gradients'
import { saveCard } from '@/lib/wallet/cards'
import type { CardBackground, CardFont, WalletCard, WalletField } from '@/lib/wallet/types'
import { WalletCardView } from './WalletCardView'
import { ensureCustomFont, readFontFile, CUSTOM_FONT_TYPES } from '@/lib/wallet/fonts'

const FONTS: { id: CardFont; label: string }[] = [
  { id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }, { id: 'mono', label: 'Mono' }, { id: 'display', label: 'Display' },
]
const BACKGROUNDS: { id: CardBackground; label: string }[] = [
  { id: 'gradient', label: 'Gradient' }, { id: 'solid', label: 'Solid' }, { id: 'image', label: 'Picture' },
]

/**
 * Every part of a card can be changed: its name, its details, its colours, its
 * type, its text colour and a picture behind it. The preview is the card, so
 * what you see here is what the wallet shows.
 */
export function CardEditor({ card, onClose }: { card: WalletCard; onClose: () => void }) {
  const [draft, setDraft] = useState<WalletCard>(() => structuredClone(card))
  const style = draft.style
  const setStyle = (patch: Partial<WalletCard['style']>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }))
  const setField = (i: number, patch: Partial<WalletField>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }))

  const onImage = (file: File | undefined) => {
    if (!file || file.size > 2 * 1024 * 1024) return
    const r = new FileReader()
    r.onload = () => setStyle({ image: String(r.result), background: 'image' })
    r.readAsDataURL(file)
  }

  const [fontError, setFontError] = useState('')
  const onFont = async (file: File | undefined) => {
    if (!file) return
    setFontError('')
    let data: string
    try {
      data = await readFontFile(file)
    } catch (e) {
      setFontError(e instanceof Error ? e.message : 'Could not read that file.')
      return
    }
    try {
      await ensureCustomFont(data) // rejects if the browser cannot read this file as a font
    } catch {
      setFontError('That file is not a font the browser can read.')
      return
    }
    setStyle({ font: 'custom', fontData: data, fontName: file.name })
  }

  const input = 'w-full rounded-[10px] px-3 py-2 text-[13px] outline-none'
  const inputStyle = { background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-1)' }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" style={{ background: 'color-mix(in srgb, var(--bg) 60%, transparent)', backdropFilter: 'blur(10px)' }} onMouseDown={onClose}>
      <div className="surface relative max-h-[90vh] w-full max-w-[860px] overflow-y-auto rounded-[22px] p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Customise card">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full" style={{ color: 'var(--text-3)' }}><X size={15} /></button>
        <h2 className="mb-5 text-[17px] font-semibold">Customise card</h2>

        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <label className="block text-[12px]" style={{ color: 'var(--text-3)' }}>Name
              <input className={`${input} mt-1`} style={inputStyle} value={draft.title} maxLength={40} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="block text-[12px]" style={{ color: 'var(--text-3)' }}>Line under the name
              <input className={`${input} mt-1`} style={inputStyle} value={draft.subtitle} maxLength={60} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
            </label>

            <div>
              <div className="mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Details (up to four)</div>
              <div className="space-y-2">
                {draft.fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                    <input className={input} style={inputStyle} aria-label={`Detail ${i + 1} label`} value={f.label} maxLength={20} onChange={(e) => setField(i, { label: e.target.value })} />
                    <input className={input} style={inputStyle} aria-label={`Detail ${i + 1} value`} value={f.value} maxLength={40} onChange={(e) => setField(i, { value: e.target.value })} />
                    <button type="button" aria-label="Remove detail" className="px-2 text-[12px]" style={{ color: 'var(--text-3)' }}
                      onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }))}>✕</button>
                  </div>
                ))}
                {draft.fields.length < 4 && (
                  <button type="button" className="text-[12px] underline underline-offset-4" style={{ color: 'var(--text-2)' }}
                    onClick={() => setDraft((d) => ({ ...d, fields: [...d.fields, { label: 'Label', value: 'Value' }] }))}>Add a detail</button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Background</div>
              <div className="flex gap-2">
                {BACKGROUNDS.map((b) => (
                  <button key={b.id} type="button" aria-pressed={style.background === b.id} onClick={() => setStyle({ background: b.id })}
                    className="rounded-full px-3 py-1.5 text-[12px]" style={{ background: style.background === b.id ? 'var(--primary)' : 'var(--elevated)', color: style.background === b.id ? '#fff' : 'var(--text-2)' }}>{b.label}</button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]" style={{ color: 'var(--text-3)' }}>
                <label className="flex items-center gap-2">{style.background === 'solid' ? 'Colour' : 'From'}
                  <input type="color" value={style.from} onChange={(e) => setStyle({ from: e.target.value })} className="h-8 w-10 cursor-pointer rounded" />
                </label>
                {style.background === 'gradient' && (
                  <label className="flex items-center gap-2">To
                    <input type="color" value={style.to} onChange={(e) => setStyle({ to: e.target.value })} className="h-8 w-10 cursor-pointer rounded" />
                  </label>
                )}
                <label className="flex items-center gap-2">Text
                  <input type="color" value={style.text} onChange={(e) => setStyle({ text: e.target.value })} className="h-8 w-10 cursor-pointer rounded" />
                </label>
                <button type="button" onClick={() => {
                  const p = generatePalette(Math.floor(Math.random() * 1e9), { mode: 'nice' })
                  const [a, b] = [p.colors[0], p.colors[1] ?? p.colors[0]]
                  setStyle({ from: a, to: b, text: readableText(a) })
                }} className="rounded-full px-3 py-1.5" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  Shuffle colours
                </button>
                <label className="cursor-pointer rounded-full px-3 py-1.5" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  {style.image ? 'Change picture' : 'Upload picture'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { onImage(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                {style.image && <button type="button" onClick={() => setStyle({ image: undefined, background: 'gradient' })} className="underline underline-offset-4">Remove picture</button>}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Typeface</div>
              <div className="flex flex-wrap gap-2">
                {FONTS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={style.font === f.id} onClick={() => setStyle({ font: f.id })}
                    className="rounded-full px-3 py-1.5 text-[12px]" style={{ background: style.font === f.id ? 'var(--primary)' : 'var(--elevated)', color: style.font === f.id ? '#fff' : 'var(--text-2)' }}>{f.label}</button>
                ))}
                {style.font === 'custom' && style.fontData && (
                  <button type="button" aria-pressed className="rounded-full px-3 py-1.5 text-[12px]"
                    style={{ background: 'var(--primary)', color: '#fff' }} title={style.fontName}>
                    {style.fontName ? style.fontName.slice(0, 24) : 'Your font'}
                  </button>
                )}
                <label className="cursor-pointer rounded-full px-3 py-1.5 text-[12px]" style={{ background: 'var(--elevated)', color: 'var(--text-2)' }}>
                  {style.fontData ? 'Change font' : 'Upload font'}
                  <input type="file" accept={CUSTOM_FONT_TYPES.join(',')} className="hidden" onChange={(e) => { onFont(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                {style.fontData && (
                  <button type="button" onClick={() => setStyle({ font: 'sans', fontData: undefined, fontName: undefined })} className="text-[12px] underline underline-offset-4" style={{ color: 'var(--text-3)' }}>Remove font</button>
                )}
              </div>
              {fontError && <p role="alert" className="mt-2 text-[12px]" style={{ color: 'var(--danger, #d9534f)' }}>{fontError}</p>}
              <p className="mt-2 text-[11.5px]" style={{ color: 'var(--text-3)' }}>TTF, OTF, WOFF or WOFF2, up to 1 MB. Stored only on this device.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Preview</div>
            <WalletCardView title={draft.title} subtitle={draft.subtitle} fields={draft.fields} style={draft.style} />
            <button type="button" onClick={() => { saveCard(draft); onClose() }}
              className="w-full rounded-full py-2.5 text-[13px] font-medium active:scale-[0.98]" style={{ background: 'var(--primary)', color: '#fff' }}>
              Save card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Dark text on light colours, white on dark, so the card stays readable after a shuffle. */
function readableText(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1d1d1f' : '#ffffff'
}
