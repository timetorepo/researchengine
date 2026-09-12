import { PROVIDERS } from './registry'
import { fetchProviderModels } from './stream'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'

/**
 * Fast, parallel model discovery. Every configured provider is fetched at
 * once (Promise.allSettled) through the backend proxy and each result lands
 * in the store the moment it resolves — the UI fills progressively instead
 * of waiting for the slowest provider. The Dynamic Island mirrors the
 * refresh as a running skill so the AIFlowEngine status surface stays live.
 */
export async function refreshAllModels(): Promise<{ ok: number; failed: number }> {
  const s = useStore.getState().settings
  const candidates = PROVIDERS.filter((p) => {
    const conf = s.providers[p.id]
    // keyless locals always; keyed providers only when a key is present
    return !p.needsKey || !!conf?.apiKey
  })
  if (candidates.length === 0) {
    useUI.getState().toast('No providers configured', 'Add an API key under Providers to fetch models.', 'info')
    return { ok: 0, failed: 0 }
  }

  useUI.setState((u) => ({ island: { kind: 'skill', name: 'Fetching models' } as any }))
  let ok = 0
  let failed = 0

  await Promise.allSettled(
    candidates.map(async (p) => {
      const conf = useStore.getState().settings.providers[p.id]
      try {
        const models = await fetchProviderModels(p.id, conf?.apiKey ?? '', conf?.baseUrl)
        ok++
        useStore.setState((st) => ({
          settings: { ...st.settings, providerModels: { ...st.settings.providerModels, [p.id]: models } },
        }))
      } catch {
        failed++
        useStore.setState((st) => ({
          settings: { ...st.settings, providerModels: { ...st.settings.providerModels, [p.id]: [] } },
        }))
      }
    }),
  )

  useUI.setState((u) => ({ island: { kind: 'idle' } as any }))
  useUI.getState().toast(
    failed === 0 ? 'Models up to date' : 'Model refresh finished',
    `${ok} provider${ok === 1 ? '' : 's'} refreshed${failed ? `, ${failed} unreachable` : ''}.`,
    failed === 0 ? 'success' : 'info',
  )
  return { ok, failed }
}

/** Fetch models for a single provider and store them. */
export async function refreshProviderModels(providerId: string): Promise<string[]> {
  const s = useStore.getState().settings
  const conf = s.providers[providerId]
  const models = await fetchProviderModels(providerId, conf?.apiKey ?? '', conf?.baseUrl)
  useStore.setState((st) => ({
    settings: { ...st.settings, providerModels: { ...st.settings.providerModels, [providerId]: models } },
  }))
  return models
}
