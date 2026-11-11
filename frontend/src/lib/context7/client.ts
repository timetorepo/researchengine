/**
 * Context7 documentation search, from the browser. It works with no setup: the
 * server calls Context7 anonymously, which has lower limits. A key (optional)
 * is encrypted with the vault like the other keys, sent per request, and never
 * stored on the server.
 */
import { getVaultPassphrase } from '@/lib/crypto/session'
import { encryptWithPassphrase } from '@/lib/crypto/vault'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'

export interface DocsHit { library: string; title: string; code: string[]; info: string }

export function context7Configured(): boolean {
  return !!useStore.getState().settings.context7?.token
}

export async function saveContext7Key(raw: string): Promise<void> {
  const key = raw.trim()
  const pass = getVaultPassphrase()
  const token = key ? (pass ? await encryptWithPassphrase(key, pass) : key) : undefined
  useStore.setState((s) => ({ settings: { ...s.settings, context7: token ? { token } : {} } }))
}

async function keyHeader(): Promise<Record<string, string>> {
  const stored = useStore.getState().settings.context7?.token
  const key = stored ? await usableKey(stored) : ''
  return key ? { 'x-re-context7-key': key } : {}
}

/** Search current documentation. Returns [] when nothing matches. */
export async function searchDocs(query: string, library?: string): Promise<{ ok: true; hits: DocsHit[] } | { ok: false; error: string }> {
  const params = new URLSearchParams({ query })
  if (library?.trim()) params.set('library', library.trim())
  try {
    const res = await fetch(`/api/context7/search?${params}`, { headers: await keyHeader() })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok) return { ok: false, error: typeof body.error === 'string' ? body.error : `Context7 answered ${res.status}.` }
    return { ok: true, hits: Array.isArray(body.hits) ? body.hits : [] }
  } catch {
    return { ok: false, error: 'The local server did not answer.' }
  }
}
