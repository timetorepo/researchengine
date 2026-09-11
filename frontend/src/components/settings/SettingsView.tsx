import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  KeyRound, Plug, Search, Palette, Cpu, Wind, Wand2, Users, Database, Keyboard, Info, ArrowLeft,
} from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { ProvidersTab } from './ProvidersTab'
import { IntegrationsTab } from './IntegrationsTab'
import { SearchTab } from './SearchTab'
import { AppearanceTab } from './AppearanceTab'
import { ModelsTab } from './ModelsTab'
import { FlowTab } from './FlowTab'
import { SkillsTab } from './SkillsTab'
import { AgentsTab } from './AgentsTab'
import { DataTab } from './DataTab'
import { ShortcutsTab } from './ShortcutsTab'
import { AboutTab } from './AboutTab'

const TABS = [
  { id: 'providers', label: 'Providers', icon: KeyRound },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'flow', label: 'AIFlowEngine', icon: Wind },
  { id: 'skills', label: 'Skills', icon: Wand2 },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
]

export function SettingsView() {
  const ui = useUI()
  const tab = ui.settingsTab
  const navigate = useNavigate()

  useEffect(() => { ui.set({ settingsOpen: true }) }, [])

  const close = () => { ui.set({ settingsOpen: false }); navigate('/') }

  return (
    <motion.div className="h-full flex overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      {/* Tab rail */}
      <aside className="w-[200px] shrink-0 hidden sm:flex flex-col p-3 gap-0.5 overflow-y-auto" style={{ borderRight: '1px solid var(--surface-border)' }}>
        <button onClick={close} className="flex items-center gap-2 px-3 py-2 mb-2 text-[12.5px] rounded-[10px] hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={14} /> Back
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => ui.set({ settingsTab: t.id })}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-left transition-colors"
            style={{
              background: tab === t.id ? 'var(--elevated)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-2)',
            }}
          >
            <t.icon size={15} strokeWidth={1.5} style={{ color: tab === t.id ? 'var(--primary)' : 'var(--text-3)' }} />
            {t.label}
          </button>
        ))}
      </aside>

      {/* Mobile tab bar */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sm:hidden flex gap-1 overflow-x-auto no-scrollbar p-2" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => ui.set({ settingsTab: t.id })}
              className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap"
              style={{ background: tab === t.id ? 'var(--elevated)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-3)' }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-[680px] mx-auto px-5 py-6">
            {tab === 'providers' && <ProvidersTab />}
            {tab === 'integrations' && <IntegrationsTab />}
            {tab === 'search' && <SearchTab />}
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'models' && <ModelsTab />}
            {tab === 'flow' && <FlowTab />}
            {tab === 'skills' && <SkillsTab />}
            {tab === 'agents' && <AgentsTab />}
            {tab === 'data' && <DataTab />}
            {tab === 'shortcuts' && <ShortcutsTab />}
            {tab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
