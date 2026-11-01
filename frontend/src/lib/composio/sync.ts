/**
 * Keeps the connected-app count and the "connected / disconnected" notices
 * current, wherever the person is in the app. The Marketplace page uses the same
 * read; it no longer owns the polling, because the sidebar count must stay right
 * on every other screen too.
 */
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import {
  composioUserId, hasComposioUserId, isActiveAccount, listComposioAccounts, listComposioApps, type ComposioAccount,
} from './client'
import { snapshotOf, useComposioActivity } from './activity'

/** Read the accounts once, update the sidebar count, and announce what changed. */
export async function syncConnectorAccounts(): Promise<ComposioAccount[]> {
  // Without a user id there is nothing to list yet; the marketplace asks for it.
  if (!hasComposioUserId()) { useUI.setState({ connectorsCount: 0 }); return [] }
  const userId = composioUserId()
  const acc = await listComposioAccounts()
  const now = Date.now()
  useUI.setState({ connectorsCount: acc.filter(isActiveAccount).length })
  const changes = useComposioActivity.getState().observe(userId, snapshotOf(acc, isActiveAccount), now)
  if (changes.length) {
    const names = new Map((await listComposioApps().catch(() => [])).map((a) => [a.slug, a.name]))
    for (const e of changes.slice(0, 3)) {
      const name = names.get(e.toolkit) ?? e.toolkit
      useUI.getState().toast(
        e.kind === 'connected' ? `${name} connected` : `${name} disconnected`,
        e.kind === 'connected' ? 'Added to your connected services.' : 'Removed from your connected services.',
        e.kind === 'connected' ? 'success' : 'info',
      )
    }
  }
  return acc
}

/**
 * Start the background sync. It runs every ten seconds while the Marketplace is
 * open and every thirty seconds elsewhere, and again when the window regains
 * focus. Returns a function that stops it.
 */
export function startConnectorSync(): () => void {
  let last = 0
  const tick = (force = false) => {
    const onMarketplace = window.location.hash.startsWith('#/marketplace')
    if (!force && Date.now() - last < (onMarketplace ? 10_000 : 30_000)) return
    last = Date.now()
    if (!useStore.getState().settings.composio?.token) { useUI.setState({ connectorsCount: 0 }); return }
    void syncConnectorAccounts().catch(() => { /* try again on the next tick */ })
  }
  const id = window.setInterval(() => tick(), 10_000)
  const onBack = () => { if (!document.hidden) tick(true) }
  window.addEventListener('focus', onBack)
  document.addEventListener('visibilitychange', onBack)
  tick(true)
  return () => {
    window.clearInterval(id)
    window.removeEventListener('focus', onBack)
    document.removeEventListener('visibilitychange', onBack)
  }
}

/** Go to the Marketplace, or to one app's page in it. */
export function openMarketplace(slug?: string) {
  window.location.hash = slug ? `#/marketplace/${encodeURIComponent(slug)}` : '#/marketplace'
}

/**
 * The sign-in window lands back here with ?composio=connected. Strip the mark and
 * report it, so the app can take the person back to the Marketplace.
 */
export function consumeComposioReturn(): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('composio') !== 'connected') return false
  url.searchParams.delete('composio')
  window.history.replaceState(null, '', url.toString())
  return true
}
