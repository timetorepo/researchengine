import { searchSettings, normalize } from '@/lib/settings/search'
/* Layout adapted from BoardUI settings-modal. Copyright (c) 2026 Mertcan Dundar Esmergul, MIT. */
import { Suspense, useEffect, useState, useRef } from 'react'
import { SearchField } from '@/components/ui/native/SearchField'
import { useUI } from '@/stores/useUI'
import { TABS, TAB_GROUPS, renderTab } from './settingsTabs'
import { SettingsNotices } from './SettingsNotices'
import { BoardOverlay } from '@/components/ui/boardui/Overlay'

/** One settings surface: existing tab IDs and persistence remain unchanged. */
export function SettingsSheet({ routeOpen = false, onRouteClose }: { routeOpen?: boolean; onRouteClose?: () => void }) {
  const open = useUI((s) => s.settingsSheet) || routeOpen
  const tab = useUI((s) => s.settingsTab)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const { results, suggestion } = searchSettings(query, TABS)
  useEffect(() => {
    if (!target || query.trim()) return
    const root = contentRef.current
    if (!root) return
    const reveal = () => {
      const el = Array.from(root.querySelectorAll<HTMLElement>('label,button,h2,h3,h4,[aria-label],span')).find(el => normalize(el.getAttribute('aria-label') || el.textContent || '') === normalize(target))
      if (!el) return false
      el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.classList.add('re-setting-search-target'); return true
    }
    const observer = new MutationObserver(() => { if (reveal()) observer.disconnect() })
    if (!reveal()) observer.observe(root, { childList: true, subtree: true })
    const timeout = setTimeout(() => observer.disconnect(), 5000)
    return () => { observer.disconnect(); clearTimeout(timeout); root.querySelectorAll('.re-setting-search-target').forEach(el => el.classList.remove('re-setting-search-target')) }
  }, [target, tab, query])
  const select = (id: string) => useUI.setState({ settingsTab: id as typeof tab })
  const close = () => {
    useUI.setState({ settingsSheet: false, settingsOpen: false, settingsClosing: false })
    if (routeOpen) onRouteClose?.()
  }
  useEffect(() => { window.addEventListener('re:close-settings', close); return () => window.removeEventListener('re:close-settings', close) }, [routeOpen, onRouteClose])
  const matching = TABS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <BoardOverlay open={open} onClose={close} title="Settings" header={
    <div className="flex-1 min-w-0 max-w-[320px]">
      <SearchField value={query} onValueChange={setQuery} placeholder="Search settings…" aria-label="Find a settings category" maxLength={100} />
    </div>
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
      <main ref={contentRef} className="bui-settings-content pane-scroll" key={tab} aria-label={`${TABS.find((item) => item.id === tab)?.label ?? 'Settings'} settings`}>
        {query.trim() ? <div aria-label="Settings search results"><h2 className="text-lg font-semibold mb-3">Settings search</h2>
          <p role="status" className="text-xs mb-3">{results.length ? `${results.length} matching settings` : 'No matching settings.'}</p>
          {suggestion && <p className="mb-4">Do you mean <button className="underline" onClick={() => setQuery(suggestion)}>{suggestion}</button>?</p>}
          <ul>{results.map(result => <li key={`${result.tab}:${result.label}`}><button className="bui-nav-button py-3" onClick={() => { select(result.tab); setTarget(result.label); setQuery('') }}>
            <span className="flex flex-col text-left"><span>{result.label}</span><small style={{ color: 'var(--text-2)' }}>{TABS.find(t => t.id === result.tab)?.label}</small></span>
          </button></li>)}</ul>
        </div> : <div><h2 className="sr-only">{TABS.find((item) => item.id === tab)?.label}</h2><SettingsNotices />
          <Suspense fallback={<p className="text-sm" role="status">Loading settings…</p>}>{renderTab(tab)}</Suspense>
        </div>}
      </main>
    </div>
  </BoardOverlay>
}
