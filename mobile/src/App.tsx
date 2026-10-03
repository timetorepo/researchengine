// Shell: three destinations + Ask, snackbar region, design-preview escape
// hatch on dev builds (?design=1 or #/design). Routing is deliberately small:
// hash-based tabs in R1, deep links arrive with the navigation layer (R3+).
import React, { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { AskSheet } from './screens/AskSheet'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { You } from './screens/You'
import { Snackbar } from './components/base'
import { useStore } from './lib/store'
import type { QualityGovernor } from './lib/quality'

const TABS: Tab[] = ['home', 'library', 'you']

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '')
  return (TABS as string[]).includes(h) ? (h as Tab) : 'home'
}

export function App({ governor }: { governor?: QualityGovernor }) {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [askOpen, setAskOpen] = useState(false)
  const snacks = useStore((s) => s.snacks)
  const dismiss = useStore((s) => s.dismiss)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="app-root">
      <main className="app-content pane-scroll" key={tab}>
        {tab === 'home' && <Home onAsk={() => setAskOpen(true)} />}
        {tab === 'library' && <Library />}
        {tab === 'you' && <You governor={governor} />}
      </main>
      <div className="snack-region" aria-live="polite">
        {snacks.map((s) => <Snackbar key={s.id} snack={s} onDismiss={dismiss} />)}
      </div>
      <TabBar tab={tab} onTab={setTab} onAsk={() => setAskOpen((v) => !v)} askOpen={askOpen} />
      <AskSheet open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  )
}
