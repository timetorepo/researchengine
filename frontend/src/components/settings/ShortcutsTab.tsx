import { ShortcutRecorder } from '@/components/ui/uiarc/shortcut-recorder/shortcut-recorder'
import React, { useEffect, useState } from 'react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const ROWS: [string, string][] = [
  [`${mod} + K`, 'Command palette / search everything'],
  [`${mod} + B`, 'Toggle sidebar'],
  [`${mod} + N`, 'New chat'],
  [`${mod} + Shift + N`, 'New chat with web search'],
  [`${mod} + M`, 'Toggle Math Mode'],
  [`${mod} + F`, 'Toggle AIFlowEngine'],
  [`${mod} + Shift + A`, 'Open Agent Flood planner'],
  [`${mod} + Shift + S`, 'Open Settings'],
  [`${mod} + /`, 'Show shortcuts'],
  [`${mod} + Enter`, 'Send with web search'],
  ['/ in input', 'Skill picker'],
  ['@ in input', 'Integration source picker'],
  ['Esc', 'Close overlay'],
  ['↑ in empty input', 'Edit last message'],
  [`${mod} + Space`, 'Spotlight palette (ResearchEngineOS)'],
]

const specOf = (e: React.KeyboardEvent) => {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.metaKey) parts.push('meta')
  if (e.shiftKey) parts.push('shift')
  const k = e.key.toLowerCase()
  if (!['control', 'alt', 'meta', 'shift'].includes(k)) parts.push(k.length === 1 || k.length > 1 ? k : k)
  return parts.join('+')
}

export function ShortcutsTab() {
  const switchKey = useStore((s) => s.settings.sessionSwitchKey ?? 'alt+shift')
  const [recording, setRecording] = useState(false)
  useEffect(() => { if (!recording) return }, [recording])
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Shortcuts</h2>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-2)' }}>Full keyboard control. Every action reachable without the mouse.</p>
      <div className="surface overflow-hidden">
        {ROWS.map(([k, desc], i) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: i < ROWS.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
            <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{desc}</span>
            <kbd className="text-[11px] font-mono px-2 py-1 rounded-[8px]" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>{k}</kbd>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-3 mt-3 surface">
        <div>
          <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>Session switcher (iOS-style card switcher)</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>Press it to open, again to step between sessions, Enter to land.</div>
        </div>
        <ShortcutRecorder
          label="Session switcher shortcut"
          hideLabel
          value={switchKey}
          defaultValue="alt+shift"
          bindings={[]}
          onValueChange={(v) => useStore.setState((st) => ({ settings: { ...st.settings, sessionSwitchKey: v ?? 'alt+shift' } }))}
          description="Record the key combination that opens the session switcher."
        />
      </div>
      <p className="text-[11px] mt-3 italic" style={{ color: 'var(--text-3)' }}>
        A few shortcuts aren't listed here. The curious may enjoy /secrets.
      </p>
    </div>
  )
}
