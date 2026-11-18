import React from 'react'
import { useStore } from '@/stores/useStore'
import { LAYOUTS, PINNABLE_TOOLS, sidebarWidth, workspaceLayout } from '@/lib/shell/preferences'
import { Switch } from '@/components/ui/heroui/Switch'
import { AppleGroup } from '@/components/ui/apple/AppleCard'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'
import type { Settings } from '@/types'

export function WorkspacePreferences() {
  const settings = useStore((s) => s.settings)
  const update = (patch: Partial<Settings>) => useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }))
  return <section className="surface p-4 mb-5" aria-label="Workspace layout">
    <h3 className="text-sm font-semibold mb-1">Workspace layout</h3>
    <p className="text-xs mb-4" style={{ color: 'var(--text-2)' }}>Structure, not colour. Your theme and density stay the same. ResearchEngineOS keeps its own Dock.</p>
    <div className="grid sm:grid-cols-3 gap-2 mb-4" role="group" aria-label="Layout preset">
      {LAYOUTS.map((layout) => <button key={layout.id} aria-pressed={workspaceLayout(settings.workspaceLayout) === layout.id}
        onClick={() => update({ workspaceLayout: layout.id })} className="re-layout-choice text-left p-3 rounded-xl">
        <span className="block text-[13px] font-medium mb-1">{layout.name}</span>
        <span className="block text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{layout.description}</span>
      </button>)}
    </div>
    <label className="flex flex-wrap items-center justify-between gap-3 text-xs mb-4">Chat history view
      <ModernSelect aria-label="Chat history view" value={settings.chatHistoryView ?? 'list'} onChange={(e) => update({ chatHistoryView: e.target.value as 'list' | 'table' })}>
        <option value="list">Pinned / Recent list</option><option value="table">Detailed table</option>
      </ModernSelect>
    </label>
    <label className="block text-xs mb-4">Sidebar width · {sidebarWidth(settings.sidebarWidth)} px
      <input aria-label="Sidebar width" className="block w-full mt-2 accent-[var(--primary)]" type="range" min={216} max={360} step={8} value={sidebarWidth(settings.sidebarWidth)} onChange={(e) => update({ sidebarWidth: Number(e.target.value) })} />
      <span className="block mt-1" style={{ color: 'var(--text-3)' }}>Or drag the sidebar edge. Arrow keys resize it; double-click resets it.</span>
    </label>
    <Switch label="Workspace effects" description="Optional ASCII interaction in empty coding projects and particles after successful workflows. Off by default; disabled with reduced motion." checked={settings.workspaceEffects === true} onChange={(workspaceEffects) => update({ workspaceEffects })} />
    <h4 className="text-xs font-medium mb-2">Pin tools to navigation</h4>
    <AppleGroup>
      {PINNABLE_TOOLS.map((tool) => <Switch key={tool.to} label={tool.label} checked={settings.sidebarPinnedTools?.includes(tool.to) ?? false}
        onChange={(checked) => useStore.setState((s) => ({ settings: { ...s.settings, sidebarPinnedTools: checked ? [...new Set([...(s.settings.sidebarPinnedTools ?? []), tool.to])] : (s.settings.sidebarPinnedTools ?? []).filter((to) => to !== tool.to) } }))} />)}
    </AppleGroup>
  </section>
}
