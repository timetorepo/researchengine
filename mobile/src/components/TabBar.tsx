// Three destinations + one raised Ask (docs/mobile/04 §1; anti-patterns 1+2:
// no five-tab bar, no hamburger). Labels at Caption 11 under 24 pt icons
// (Dribbble measurement, translated to tokens, not pixels).
import React from 'react'
import { haptic } from '../lib/haptics'

export type Tab = 'home' | 'library' | 'you'

const ICONS: Record<Tab | 'ask', React.ReactNode> = {
  home: <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  library: <><path d="M5 4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v17H5z" /><path d="M12 4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v17h-5z" /><path d="m18.5 5 1.7 16.2" /></>,
  you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  ask: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
}

function Icon({ name, size = 24 }: { name: Tab | 'ask'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[name]}</svg>
  )
}

export function TabBar({ tab, onTab, onAsk, askOpen }:
  { tab: Tab; onTab: (t: Tab) => void; onAsk: () => void; askOpen?: boolean }) {
  const item = (t: Tab, label: string) => (
    <button key={t} data-c="TabItem" data-state={t === tab ? 'on' : 'off'}
      className={`tabitem press-tap ${t === tab ? 'tabitem-on' : ''}`}
      onPointerDown={() => haptic('press')}
      onClick={() => { onTab(t); if (window.location.hash.slice(2) !== t) window.location.hash = `/${t}` }}
      aria-current={t === tab ? 'page' : undefined}>
      <Icon name={t} /><span className="tabitem-label">{label}</span>
    </button>
  )
  return (
    <nav data-c="TabBar" className="tabbar" aria-label="Primary">
      {item('home', 'Home')}
      {item('library', 'Library')}
      <span className="tabbar-askwrap">
        <button data-c="AskButton" data-state={askOpen ? 'open' : 'closed'}
          className="askbtn press-tap" aria-label="Ask Research Engine"
          onPointerDown={() => haptic('press')} onClick={onAsk}>
          <Icon name="ask" size={22} />
        </button>
      </span>
      {item('you', 'You')}
      <span aria-hidden className="tabbar-ghost" />
    </nav>
  )
}
