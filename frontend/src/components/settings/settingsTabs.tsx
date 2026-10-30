import { WalletTab } from './WalletTab'
import { lazy, Suspense } from 'react'
import React from 'react'
import { Wallet, KeyRound, Plug, Search, Palette, Cpu, Wind, Wand2, Users, Database, Keyboard, Info, Gauge, Code, UserRound, Terminal, ArrowDownToLine, Mic, Bell, Store, BookMarked, ShieldCheck, Route, Split } from 'lucide-react'
import { ProfileTab } from './ProfileTab'
import { CodingTab } from './CodingTab'
import { ProvidersTab } from './ProvidersTab'
import { SearchTab } from './SearchTab'
import { AppearanceTab } from './AppearanceTab'
import { ModelsTab } from './ModelsTab'
import { FlowTab } from './FlowTab'
import { SkillsTab } from './SkillsTab'
import { AgentsTab } from './AgentsTab'
import { DataTab } from './DataTab'
import { ShortcutsTab } from './ShortcutsTab'
import { AboutTab } from './AboutTab'
import { PerformanceTab } from './PerformanceTab'
import { DeveloperTab } from './DeveloperTab'
import { UpdatesTab } from './UpdatesTab'
import { VoiceTab } from './VoiceTab'
import { NotificationsTab } from './NotificationsTab'
import { SecurityTab } from './SecurityTab'
import { SnaffyTab } from './SnaffyTab'
import { JevTab } from './JevTab'

export const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'providers', label: 'Providers', icon: KeyRound },
  { id: 'updates', label: 'Updates', icon: ArrowDownToLine },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'snaffy', label: 'Snaffy', icon: Route },
  { id: 'jev', label: 'Jev', icon: Split },
  { id: 'flow', label: 'AIFlowEngine', icon: Wind },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'skills', label: 'Skills', icon: Wand2 },
  { id: 'personas', label: 'Personas', icon: BookMarked },
  { id: 'coding', label: 'Coding', icon: Code },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'developer', label: 'Developer', icon: Terminal },
  { id: 'about', label: 'About', icon: Info },
]

const PersonasTab = lazy(() => import('./PersonasTab').then((m) => ({ default: m.PersonasTab })))

export function renderTab(tab: string): React.ReactNode {
  switch (tab) {
    case 'profile': return <ProfileTab />
    case 'providers': return <ProvidersTab />
    case 'updates': return <UpdatesTab />
    case 'voice': return <VoiceTab />
    case 'notifications': return <NotificationsTab />
    case 'search': return <SearchTab />
    case 'appearance': return <AppearanceTab />
    case 'models': return <ModelsTab />
    case 'snaffy': return <SnaffyTab />
    case 'jev': return <JevTab />
    case 'flow': return <FlowTab />
    case 'performance': return <PerformanceTab />
    case 'skills': return <SkillsTab />
    case 'personas': return <Suspense fallback={null}><PersonasTab /></Suspense>
    case 'coding': return <CodingTab />
    case 'agents': return <AgentsTab />
    case 'data': return <DataTab />
    case 'security': return <SecurityTab />
    case 'shortcuts': return <ShortcutsTab />
    case 'developer': return <DeveloperTab />
    case 'wallet': return <WalletTab />
    case 'about': return <AboutTab />
    default: return <ProvidersTab />
  }
}
