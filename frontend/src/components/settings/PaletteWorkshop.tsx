import { MagneticSelect } from '@/components/ui/bencho/magnet-select/MagneticSelect'
import '@/components/ui/bencho/magnet-select/MagneticSelect.css'
import { useCallback, useState } from 'react'
import { Palette } from '@/components/ui/bencho/palette/Palette'
import '@/components/ui/bencho/palette/Palette.css'
import { paletteCSS, paletteTokens, contrast } from '@/lib/design/paletteTheme'
import { useStore } from '@/stores/useStore'
import { download } from '@/lib/utils'
import { Switch } from '@/components/ui/heroui/Switch'

export function PaletteWorkshop() {
  const saved = useStore((s) => s.settings.customPaletteTheme)
  const [count, setCount] = useState(4)
  const [colours, setColours] = useState<string[]>([])
  const [name, setName] = useState('My research palette')
  const receive = useCallback((next: string[]) => setColours(next), [])
  const tokens = paletteTokens(colours)
  return <section className="surface p-4 mb-5" aria-label="Palette workshop">
    <h3 className="text-sm font-semibold">Palette workshop</h3>
    <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-2)' }}>Roll a colour family, edit its colours, then save or export a theme. Nothing changes until you apply it.</p>
    <div className="re-bencho overflow-x-auto py-3"><span className="text-xs block mb-2">Number of colours</span><MagneticSelect size="Small" options={["3 colours", "4 colours", "5 colours"]} selected={count - 3} onSelect={(index) => setCount(index + 3)} /><Palette count={count} onPaletteChange={receive} /></div>
    <div className="flex flex-wrap gap-3 my-3">{colours.map((colour, i) => <label key={i} className="text-xs flex items-center gap-2">
      <input type="color" aria-label={`Palette colour ${i + 1}`} value={colour} onChange={(e) => setColours((previous) => previous.map((c, index) => index === i ? e.target.value : c))} />{colour}
    </label>)}</div>
    <label className="block text-xs mb-3">Theme name<input aria-label="Palette theme name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="block mt-1 w-full rounded-lg px-3 py-2 bg-[var(--elevated)]" /></label>
    {tokens && <div className="rounded-xl p-4 mb-3 text-sm" style={{ background: tokens['--surface'], color: tokens['--text'], border: `1px solid ${tokens['--surface-border']}` }}>
      <strong>{name || 'Research palette'}</strong><p className="text-xs mt-1">A preview of your reading surface and text.</p>
      <p className="text-xs mt-2">Text contrast: {contrast(tokens['--text'], tokens['--surface']).toFixed(1)}:1</p>
    </div>}
    <div className="flex flex-wrap gap-2 text-xs">
      <button disabled={!tokens} className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => useStore.setState((s) => ({ settings: { ...s.settings, customPaletteTheme: { enabled: true, name: name.trim() || 'Research palette', colours } } }))}>Apply palette theme</button>
      <button disabled={!tokens} className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => download('research-palette.css', paletteCSS(name, colours), 'text/css')}>Export theme CSS</button>
      <button disabled={!tokens} className="px-3 py-2 rounded-lg bg-[var(--elevated)]" onClick={() => download('research-palette.json', JSON.stringify({ version: 1, name, colours, tokens }, null, 2), 'application/json')}>Export theme JSON</button>
    </div>
    {saved && <Switch label={`Use palette theme: ${saved.name}`} description="Turn off to restore your selected colour theme. Layout stays unchanged." checked={saved.enabled} onChange={(enabled) => useStore.setState((s) => ({ settings: { ...s.settings, customPaletteTheme: { ...saved, enabled } } }))} />}
  </section>
}
