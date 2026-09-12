import React from 'react'
import {
  KeyRound, Plug, Search, Palette, Cpu, Wind, Wand2, Users, Database, Keyboard, Info,
} from 'lucide-react'
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

export const TABS = [
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

export function renderTab(tab: string): React.ReactNode {
  switch (tab) {
    case 'providers': return <ProvidersTab />
    case 'integrations': return <IntegrationsTab />
    case 'search': return <SearchTab />
    case 'appearance': return <AppearanceTab />
    case 'models': return <ModelsTab />
    case 'flow': return <FlowTab />
    case 'skills': return <SkillsTab />
    case 'agents': return <AgentsTab />
    case 'data': return <DataTab />
    case 'shortcuts': return <ShortcutsTab />
    case 'about': return <AboutTab />
    default: return <ProvidersTab />
  }
}
