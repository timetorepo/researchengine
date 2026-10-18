/**
 * Bots settings: pause every routine, point web access at your own SearXNG and
 * headless browser, and move bots between devices with an export file.
 *
 * Export is a plain JSON file with every bot, group and project, including each
 * thread and memory. Import adds them with new ids, so nothing already here is
 * overwritten.
 */
import { useRef, useState } from 'react'
import { Download, Upload, Loader2 } from 'lucide-react'
import { useBots } from '@/lib/bots/store'
import { makeBundle, readBundle } from '@/lib/bots/logic'
import { webSearch } from '@/lib/bots/web'
import { Switch } from '@/components/ui/heroui/Switch'
import { useUI } from '@/stores/useUI'

const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' }

export function BotsSettings() {
  const settings = useBots((s) => s.settings)
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [testing, setTesting] = useState(false)

  const exportAll = () => {
    const s = useBots.getState()
    const bundle = makeBundle({ bots: s.bots, rooms: s.rooms, projects: s.projects }, Date.now())
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-engine-bots-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    ui.toast('Bots exported', `${s.bots.length} bots, ${s.rooms.length} groups, ${s.projects.length} projects.`, 'success')
  }

  const importFile = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text())
      const res = readBundle(raw)
      if (!res.ok) { ui.toast('Not imported', res.error, 'warning'); return }
      const counts = useBots.getState().importBundle(res.data)
      ui.toast('Bots imported', `${counts.bots} bots, ${counts.rooms} groups, ${counts.projects} projects added. Existing ones are unchanged.`, 'success')
    } catch {
      ui.toast('Not imported', 'That file is not valid JSON.', 'warning')
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await webSearch('research engine test')
      if (res.ok) ui.toast('Search works', `${res.results.length} results came back.`, 'success')
      else ui.toast('Search did not answer', res.error, 'warning')
    } finally { setTesting(false) }
  }

  return (
    <div className="surface p-4 grid gap-5 lg:grid-cols-2" data-ui="bots-settings">
      <section className="space-y-3">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Routines</div>
        <Switch checked={settings.paused} label="Pause all routines" description="Stops every scheduled routine. Chats and group chats keep working."
          onChange={(v) => useBots.getState().setSettings({ paused: v })} />
      </section>

      <section className="space-y-3">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Web access</div>
        <label className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          SearXNG address (recommended, e.g. http://localhost:8080)
          <input value={settings.searxng} onChange={(e) => useBots.getState().setSettings({ searxng: e.target.value.trim() })}
            placeholder="Empty uses the server default" className="mt-1 w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={field} />
        </label>
        <label className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Headless browser in Docker (e.g. http://localhost:3000)
          <input value={settings.browserUrl} onChange={(e) => useBots.getState().setSettings({ browserUrl: e.target.value.trim() })}
            placeholder="Empty reads pages directly" className="mt-1 w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={field} />
        </label>
        <p className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
          Run SearXNG with Docker (its official image) and paste its address here. A browser container such as browserless/chrome must expose POST /content. Empty fields use the built-in reader.
        </p>
        <button type="button" onClick={() => void test()} disabled={testing} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] disabled:opacity-50" style={{ background: 'var(--elevated)' }}>
          {testing && <Loader2 size={12} className="animate-spin" />} Test search
        </button>
      </section>

      <section className="space-y-3 lg:col-span-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Move bots</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)' }}>
            <Download size={12} /> Export all bots
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]" style={{ background: 'var(--elevated)' }}>
            <Upload size={12} /> Import a bots file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Bots file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
        </div>
        <p className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>The export includes every thread and memory in plain text. Keep the file private.</p>
      </section>
    </div>
  )
}
