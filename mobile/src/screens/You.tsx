// Screen: You. Job: every preference reachable, every posture visible. Spec:
// docs/mobile/screens/you-settings.md. R1 ships Appearance (all 12 themes,
// surfaces, motion), a live Performance readout (quality ladder + governor
// state), and the honest "arrives in R..." rows for everything else. Nothing
// here greys out; future rows explain themselves (00-principles #3).
import React, { useEffect, useMemo, useState } from 'react'
import { THEMES, applyTheme } from '../lib/theme'
import { useStore } from '../lib/store'
import { SegmentedControl, SwitchRow, PressButton } from '../components/base'
import { ThemeCard } from '../components/cards'
import type { Quality } from '../lib/quality'

export function You({ governor }: { governor?: ReturnType<import('../lib/quality').createGovernor> }) {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.update)
  const toast = useStore((s) => s.toast)
  const [perf, setPerf] = useState<{ quality: Quality; median: number } | null>(null)

  useEffect(() => {
    if (!governor) return
    const unsub = governor.subscribe((g) => setPerf({ quality: g.quality, median: g.median }))
    return () => { unsub() }
  }, [governor])

  const favSet = useMemo(() => new Set(settings.themeFavorites), [settings.themeFavorites])

  const rows: [string, string, () => void][] = [
    ['Providers and keys', '11 providers, keys in the secure store, demo engine first. Arrives in R3.', () => toast('Providers', 'Provider wiring lands in R3. The demo engine answers meanwhile, and says so.')],
    ['Companion', 'Pair your computer for full-scale floods. Arrives in R6.', () => toast('Companion', 'Pairing arrives in R6: QR, pins, scopes, revocation both ways.')],
    ['Models on this device', 'Quick, Balanced, Deep. Download, verify, delete. Arrives in R5.', () => toast('On-device models', 'The model manager arrives in R5 with three size classes.')],
    ['Notifications', 'Off by default. Flood done, export done, study timer. Nothing else.', () => undefined],
    ['Data', 'Export and import your library as one ZIP. Store format today, folder format in R2.', () => toast('Library export', 'The mobile ZIP matches the desktop format from R2; before that, desktop Settings > Data owns it.')],
  ]

  return (
    <div className="screen">
      <header className="toprow"><span className="toprow-name">You</span></header>

      <h2 className="section-title">Profile</h2>
      <label className="row row-input">
        <span className="row-text"><span className="row-label">Shown in the greeting</span></span>
        <input value={settings.profileName} onChange={(e) => update({ profileName: e.target.value })} aria-label="Profile name" />
      </label>

      <h2 className="section-title">Appearance</h2>
      <div className="themegrid" role="listbox" aria-label="Themes">
        {THEMES.map((t) => (
          <ThemeCard key={t.id} theme={t as any}
            selected={settings.theme === t.id} favourite={favSet.has(t.id)}
            onPick={() => { applyTheme(t.id, { reduceMotion: settings.reduceMotion }); update({ theme: t.id }) }}
            onFav={() => update({ themeFavorites: favSet.has(t.id) ? settings.themeFavorites.filter((f) => f !== t.id) : [...settings.themeFavorites, t.id] })}
          />
        ))}
      </div>
      <SegmentedControl label="Surface" value={settings.surface} onChange={(v) => update({ surface: v })}
        options={[{ id: 'off', name: 'Solid' }, { id: 'blur', name: 'Frosted' }, { id: 'liquid', name: 'Glass' }]} />
      <SwitchRow label="Reduce motion" hint="Collapses animation to opacity" checked={settings.reduceMotion}
        onChange={(v) => { update({ reduceMotion: v }); applyTheme(settings.theme, { reduceMotion: v }) }} />
      <SwitchRow label="Compact density" checked={settings.compact}
        onChange={(v) => { update({ compact: v }); applyTheme(settings.theme, { compact: v, reduceMotion: settings.reduceMotion }) }} />
      <SwitchRow label="Haptics" checked={settings.haptics} onChange={(v) => update({ haptics: v })} />

      <h2 className="section-title">Privacy Shield</h2>
      <div className="card">
        <p className="row-label">Privated</p>
        <p className="row-hint">Scans every interaction, redacts secrets from anything leaving this device. Chats stay on the phone until you send them.</p>
        <PressButton variant="quiet" onClick={() => toast('Privacy Shield', 'The three postures port over with the secure core (R2/R3). Enforcement moves into Rust so a UI bug cannot bypass it.')}>Postures</PressButton>
      </div>

      <h2 className="section-title">Performance</h2>
      <div className="card" data-c="PerfCard">
        <p className="row-label">
          {perf ? `Holding at ${perf.quality}, median ${perf.median.toFixed(1)} ms` : 'Sampling frames'}
        </p>
        <p className="row-hint">The ladder changes fidelity only. No feature is ever hidden for performance.</p>
        <SegmentedControl label="Quality override" value={(settings.qualityOverride) as Quality | 'auto'}
          onChange={(v) => { update({ qualityOverride: v }); if (v !== 'auto') governor?.force(v as Quality) }}
          options={[{ id: 'auto', name: 'Auto' }, { id: 'full', name: 'Full' }, { id: 'lean', name: 'Lean' }, { id: 'minimum', name: 'Minimum' }]} />
      </div>

      <h2 className="section-title">Everything else</h2>
      <div className="list">
        {rows.map(([label, hint, run]) => (
          <button key={label} className="row press-tap" onClick={run}>
            <span className="row-text"><span className="row-label">{label}</span><span className="row-hint">{hint}</span></span>
          </button>
        ))}
      </div>

      <h2 className="section-title">About</h2>
      <div className="card">
        <p className="row-label">Research Engine · 0.16.0-beta.1</p>
        <p className="row-hint">Built on React, Vite, Zustand and Tauri. Your data lives on this device. License: the repository is all-rights-reserved at this version, and this screen says so.</p>
      </div>
    </div>
  )
}
