// Screen: Home. Job: get into a question in one thumb-reach; show what to pick
// up. Spec: docs/mobile/screens/home.md. Data is empty in R1 by design; the
// empty states carry real copy, not placeholders.
import React from 'react'
import { PressButton, EmptyState } from '../components/base'
import { useStore } from '../lib/store'

export function Home({ onAsk, now = new Date() }: { onAsk: () => void; now?: Date }) {
  const settings = useStore((s) => s.settings)
  const hour = now.getHours()
  const lateNight = hour >= 22 || hour < 5
  return (
    <div className="screen">
      <header className="toprow">
        <span className="toprow-name">{settings.profileName || 'Researcher'}</span>
        <button className="iconbtn press-tap" aria-label="Commands"
          onClick={() => useStore.getState().toast('Commands', 'The command sheet lands with the chat pipeline (R3).')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {lateNight && <h1 data-c="Greeting" className="display">Late work session?</h1>}

      <button data-c="ComposerEntry" className="composer-entry press-tap" onClick={onAsk}>
        <span aria-hidden className="composer-orb" />
        Ask Research Engine
      </button>

      <section aria-label="Pick up where you left off">
        <h2 className="section-title">Pick up from your recent work</h2>
        <EmptyState
          title="Nothing yet. Your first answer will show up here."
          body="Chats, reader positions and quiz streaks appear once there is work to pick up."
          action={{ label: 'Ask something', run: onAsk }}
        />
      </section>

      <section aria-label="Offline demo">
        <div data-c="DemoCard" className="card demo-card grad-research">
          <div className="row-text">
            <span className="row-label">No key yet? Try the offline demo</span>
            <span className="row-hint">It runs on this device and says so. Real providers plug in later.</span>
          </div>
          <PressButton variant="primary" onClick={onAsk}>Try it</PressButton>
        </div>
      </section>
    </div>
  )
}
