/**
 * Leaving Settings, as a motion rather than a cut.
 *
 * Settings is a full page, so closing it means navigating — and a route change
 * in this app is an *entry* animation (deliberately: an exit-gated transition
 * can strand the incoming page if it ever fails to finish). That is fine for
 * normal navigation, but Back is a button the user pressed while looking at the
 * page, and it should visibly put the page away before the next one arrives.
 *
 * So the exit plays here, on the page, and the navigation happens at the end of
 * it. One flag in the store drives the whole thing, so every close path — Back,
 * Escape, the command palette — gets the same motion.
 */
import { useUI } from '@/stores/useUI'
import { DUR } from '@/lib/ui/handoff'

/** How long the page takes to leave. Kept in step with DUR.slow. */
export const SETTINGS_EXIT_MS = DUR.slow * 1000

/** Play the exit, then hand control back to the caller to navigate. */
export function closeSettings(out: () => void): void {
  const ui = useUI.getState()
  if (ui.settingsClosing) return
  useUI.setState({ settingsClosing: true })
  window.setTimeout(() => {
    useUI.setState({ settingsClosing: false, settingsOpen: false })
    out()
  }, SETTINGS_EXIT_MS)
}
