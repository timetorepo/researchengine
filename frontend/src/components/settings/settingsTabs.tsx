import { lazy, Suspense } from 'react'
import React from 'react'
import { BarChart3, Wallet, KeyRound, Plug, Search, Palette, Cpu, Wind, Wand2, Users, Database, Keyboard, Info, Gauge, Code, UserRound, Terminal, ArrowDownToLine, Mic, Bell, Store, BookMarked, ShieldCheck, Route, Split, Brain } from 'lucide-react'

const WalletTab = lazy(() => import('./WalletTab').then((m) => ({ default: m.WalletTab })))
const ProfileTab = lazy(() => import('./ProfileTab').then((m) => ({ default: m.ProfileTab })))
const CodingTab = lazy(() => import('./CodingTab').then((m) => ({ default: m.CodingTab })))
const ProvidersTab = lazy(() => import('./ProvidersTab').then((m) => ({ default: m.ProvidersTab })))
const SearchTab = lazy(() => import('./SearchTab').then((m) => ({ default: m.SearchTab })))
const AppearanceTab = lazy(() => import('./AppearanceTab').then((m) => ({ default: m.AppearanceTab })))
const ModelsTab = lazy(() => import('./ModelsTab').then((m) => ({ default: m.ModelsTab })))
const FlowTab = lazy(() => import('./FlowTab').then((m) => ({ default: m.FlowTab })))
const SkillsTab = lazy(() => import('./SkillsTab').then((m) => ({ default: m.SkillsTab })))
const AgentsTab = lazy(() => import('./AgentsTab').then((m) => ({ default: m.AgentsTab })))
const DataTab = lazy(() => import('./DataTab').then((m) => ({ default: m.DataTab })))
const ShortcutsTab = lazy(() => import('./ShortcutsTab').then((m) => ({ default: m.ShortcutsTab })))
const AboutTab = lazy(() => import('./AboutTab').then((m) => ({ default: m.AboutTab })))
const PerformanceTab = lazy(() => import('./PerformanceTab').then((m) => ({ default: m.PerformanceTab })))
const DeveloperTab = lazy(() => import('./DeveloperTab').then((m) => ({ default: m.DeveloperTab })))
const UpdatesTab = lazy(() => import('./UpdatesTab').then((m) => ({ default: m.UpdatesTab })))
const VoiceTab = lazy(() => import('./VoiceTab').then((m) => ({ default: m.VoiceTab })))
const NotificationsTab = lazy(() => import('./NotificationsTab').then((m) => ({ default: m.NotificationsTab })))
const SecurityTab = lazy(() => import('./SecurityTab').then((m) => ({ default: m.SecurityTab })))
const SnaffyTab = lazy(() => import('./SnaffyTab').then((m) => ({ default: m.SnaffyTab })))
const JevTab = lazy(() => import('./JevTab').then((m) => ({ default: m.JevTab })))
const UsageTab = lazy(() => import('./UsageTab').then((m) => ({ default: m.UsageTab })))
const MemoryTab = lazy(() => import('./MemoryTab').then((m) => ({ default: m.MemoryTab })))

/**
 * The rail, grouped. Fewer things are in front of a person at once: the groups below
 * are what they see, and the tabs under `advanced` sit behind one "Advanced" toggle.
 * Every tab id and label is unchanged, so links that name a tab still land on it, and
 * opening a tab from a link shows it even while Advanced is closed.
 */
export const TAB_GROUPS: { label: string; tabs: string[]; advanced?: boolean }[] = [
  { label: 'You', tabs: ['profile', 'memory', 'appearance', 'voice', 'notifications', 'shortcuts'] },
  { label: 'AI', tabs: ['providers', 'models', 'search', 'skills', 'personas', 'agents', 'coding', 'usage'] },
  { label: 'Data and safety', tabs: ['data', 'security'] },
  { label: 'App', tabs: ['updates', 'about'] },
  { label: 'Advanced', tabs: ['snaffy', 'jev', 'flow', 'performance', 'wallet', 'developer'], advanced: true },
]

export const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'memory', label: 'Memory', icon: Brain },
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
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'developer', label: 'Developer', icon: Terminal },
  { id: 'about', label: 'About', icon: Info },
]

const PersonasTab = lazy(() => import('./PersonasTab').then((m) => ({ default: m.PersonasTab })))

export function renderTab(tab: string): React.ReactNode {
  switch (tab) {
    case 'profile': return <ProfileTab />
    case 'memory': return <MemoryTab />
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
    case 'usage': return <UsageTab />
    default: return <ProvidersTab />
  }
}
