/* Layout adapted from BoardUI settings-modal. Copyright (c) 2026 Mertcan Dundar Esmergul, MIT. */
import { Suspense, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useUI } from '@/stores/useUI'
import { TABS, TAB_GROUPS, renderTab } from './settingsTabs'
import { SettingsNotices } from './SettingsNotices'
import { BoardOverlay } from '@/components/ui/boardui/Overlay'

/** One settings surface: existing tab IDs and persistence remain unchanged. */
export function SettingsSheet({ routeOpen = false, onRouteClose }: { routeOpen?: boolean; onRouteClose?: () => void }) {
  const open = useUI((s) => s.settingsSheet) || routeOpen
  const tab = useUI((s) => s.settingsTab)
  const [query, setQuery] = useState('')
  const select = (id: string) => useUI.setState({ settingsTab: id as typeof tab })
  const close = () => {
    useUI.setState({ settingsSheet: false, settingsOpen: false, settingsClosing: false })
    if (routeOpen) onRouteClose?.()
  }
  useEffect(() => { window.addEventListener('re:close-settings', close); return () => window.removeEventListener('re:close-settings', close) }, [routeOpen, onRouteClose])
  const matching = TABS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <BoardOverlay open={open} onClose={close} title="Settings" header={
    <label className="relative flex-1 max-w-[320px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
      <input className="bui-field w-full" style={{ paddingInlineStart: 36 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a settings category" aria-label="Find a settings category" /></label>
  }>
    <div className="bui-settings-layout">
      <nav aria-label="Settings categories" className="bui-settings-rail pane-scroll">
        {TAB_GROUPS.map((group) => {
          const tabs = group.tabs.map((id) => matching.find((item) => item.id === id)).filter((item) => !!item)
          return tabs.length > 0 && <section key={group.label}><h3 className="bui-group-label">{group.label}</h3>
            {tabs.map((item) => <button key={item.id} className="bui-nav-button" aria-current={tab === item.id ? 'page' : undefined} onClick={() => select(item.id)}><item.icon size={16} aria-hidden="true" />{item.label}</button>)}
          </section>
        })}
        {!matching.length && <p className="text-xs p-3" role="status">No matching category.</p>}
      </nav>
      <label className="bui-mobile-tabs text-xs">Settings category
        <select className="bui-field w-full mt-1" aria-label="Settings category" value={tab} onChange={(e) => select(e.target.value)}>{matching.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </label>
      <main className="bui-settings-content pane-scroll" key={tab} aria-label={`${TABS.find((item) => item.id === tab)?.label ?? 'Settings'} settings`}>
        <div><h2 className="sr-only">{TABS.find((item) => item.id === tab)?.label}</h2><SettingsNotices />
          <Suspense fallback={<p className="text-sm" role="status">Loading settings…</p>}>{renderTab(tab)}</Suspense>
        </div>
      </main>
    </div>
  </BoardOverlay>
}
