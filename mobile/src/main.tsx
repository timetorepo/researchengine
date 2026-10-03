import React from 'react'
import { createRoot } from 'react-dom/client'
import '@re/tokens/tokens.css'
import './styles/app.css'
import { App } from './App'
import { DesignPreview } from './screens/DesignPreview'
import { applyTheme } from './lib/theme'
import { useStore } from './lib/store'
import { createGovernor } from './lib/quality'
import { setHapticsEnabled } from './lib/haptics'

const settings = useStore.getState().settings
applyTheme(settings.theme, { fontScale: settings.fontScale, compact: settings.compact, reduceMotion: settings.reduceMotion })
setHapticsEnabled(settings.haptics)

// Refresh rate probe: matchMedia resolution data on Android WebView, a 20-frame
// rAF estimate elsewhere. The authoritative value comes from re-core in R2; this
// is what the JS governor starts with, and the readout labels it as an estimate.
function probeHz(): Promise<number> {
  return new Promise<number>((res) => {
    let n = 0
    let t0 = 0
    let last = 0
    const step = (t: number) => {
      if (!t0) t0 = t
      last = t
      if (++n >= 20) res(n >= 2 ? 1000 / ((last - t0) / (n - 1)) : 60)
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

const governor = createGovernor(60)
if (settings.qualityOverride !== 'auto') governor.force(settings.qualityOverride)
governor.start()
probeHz().then((hz) => governor.setRefresh(Math.round(hz))).catch(() => undefined)

const params = new URLSearchParams(window.location.search)
const isDesign = params.get('design') === '1' || window.location.hash.startsWith('#/design')
const isDev = import.meta.env?.DEV ?? false

createRoot(document.getElementById('root')!).render(
  isDesign && isDev
    ? <DesignPreview />
    : <App governor={governor} />,
)
