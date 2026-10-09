import { lazy, Suspense } from 'react'
import React from 'react'
import { KeyRound, Plug, Search, Palette, Cpu, Wind, Wand2, Users, Database, Keyboard, Info, Gauge, Code, UserRound, Terminal, ArrowDownToLine, Mic, Bell, Store, BookMarked } from 'lucide-react'
import { ProfileTab } from './ProfileTab'
import { CodingTab } from './CodingTab'
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
import { McpPanel } from '@/components/ide/McpPanel'
import { AboutTab } from './AboutTab'
import { PerformanceTab } from './PerformanceTab'
import { DeveloperTab } from './DeveloperTab'
import { UpdatesTab } from './UpdatesTab'
import { VoiceTab } from './VoiceTab'
import { NotificationsTab } from './NotificationsTab'

export const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'providers', label: 'Providers', icon: KeyRound },
  { id: 'updates', label: 'Updates', icon: ArrowDownToLine },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'flow', label: 'AIFlowEngine', icon: Wind },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'skills', label: 'Skills', icon: Wand2 },
  { id: 'mcp', label: 'MCP Servers', icon: Store },
  { id: 'personas', label: 'Personas', icon: BookMarked },
  { id: 'coding', label: 'Coding & MCP', icon: Code },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'developer', label: 'Developer', icon: Terminal },
  { id: 'about', label: 'About', icon: Info },
]

const PersonasTab = lazy(() => import('./PersonasTab').then((m) => ({ default: m.PersonasTab })))

export function McpTab() {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>MCP Servers</h2>
      <p className="text-[13px] mb-3" style={{ color: 'var(--text-2)' }}>
        Tool servers for the agent, in coding sessions and in chats. Install from the catalog with one click, test the connection, and the model gets the tools on its next turn.
      </p>
      <div className="flex-1 min-h-0 surface overflow-hidden"><McpPanel /></div>
    </div>
  )
}

export function renderTab(tab: string): React.ReactNode {
  switch (tab) {
    case 'profile': return <ProfileTab />
    case 'providers': return <ProvidersTab />
    case 'updates': return <UpdatesTab />
    case 'integrations': return <IntegrationsTab />
    case 'voice': return <VoiceTab />
    case 'notifications': return <NotificationsTab />
    case 'search': return <SearchTab />
    case 'appearance': return <AppearanceTab />
    case 'models': return <ModelsTab />
    case 'flow': return <FlowTab />
    case 'performance': return <PerformanceTab />
    case 'skills': return <SkillsTab />
    case 'mcp': return <McpTab />
    case 'personas': return <Suspense fallback={null}><PersonasTab /></Suspense>
    case 'coding': return <CodingTab />
    case 'agents': return <AgentsTab />
    case 'data': return <DataTab />
    case 'shortcuts': return <ShortcutsTab />
    case 'developer': return <DeveloperTab />
    case 'about': return <AboutTab />
    default: return <ProvidersTab />
  }
}
