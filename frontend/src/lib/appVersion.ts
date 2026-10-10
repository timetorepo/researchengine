/**
 * "Which version am I running?" — answered once, for every surface that asks.
 *
 * The obvious answer is the constant Vite bakes in from `package.json`, and for
 * a normal `npm run build` that is the right answer. But it is not the only way
 * this app runs: a desktop shell, a stripped binary and a hand-unpacked folder
 * can all end up serving a bundle whose `__APP_VERSION__` came out empty, and
 * the old fallback for that case was the literal string `0.0.0-dev`. People
 * running a perfectly good install were told they were on a development build.
 *
 * So the fallback is now a real lookup: if the baked-in stamp is missing, ask the
 * server — `/api/health` reports the version stamped into the frontend it is
 * serving, and the version declared by the code it is running. One request, one
 * cache, shared by the top bar, About, Updates and the developer report.
 */
import { useEffect, useState } from 'react'

/** The version Vite baked into this bundle. Empty when it could not be resolved. */
export const BUNDLE_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__.trim() : ''
/** Version + build stamp of the bundle in this tab. */
export const BUNDLE_BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

const PLACEHOLDERS = new Set(['', '0.0.0-dev', 'dev', 'unknown'])

/** A version string we are willing to show a human. */
export function isRealVersion(v?: string | null): boolean {
  return !!v && !PLACEHOLDERS.has(String(v).trim())
}

interface HealthWeb {
  web?: {
    served?: { version?: string; buildId?: string; builtAt?: string } | null
    source?: string
    mode?: string
  }
}

let pending: Promise<string> | null = null
const listeners = new Set<(v: string) => void>()
let resolved = ''

/** What the server says it is serving. Resolved at most once per page load. */
export function serverVersion(): Promise<string> {
  if (pending) return pending
  pending = fetch('/api/health', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() as Promise<HealthWeb> : null))
    .then((d) => {
      const served = d?.web?.served?.version
      const source = d?.web?.source
      const value = isRealVersion(served) ? String(served)
        : isRealVersion(source) ? String(source)
        : ''
      if (value) {
        resolved = value
        for (const fn of listeners) fn(value)
      }
      return value
    })
    .catch(() => '')
  return pending
}

/**
 * The running version, synchronously, for code that is not a component (a
 * copyable report, a toast). Never returns a placeholder: when nothing is known
 * yet it says `dev`, and says it only until the lookup lands.
 */
export function runningVersion(): string {
  return isRealVersion(BUNDLE_VERSION) ? BUNDLE_VERSION : resolved || 'dev'
}

/** Reactive form of {@link runningVersion}. */
export function useRunningVersion(): string {
  const [value, setValue] = useState(runningVersion)
  useEffect(() => {
    if (isRealVersion(BUNDLE_VERSION)) return
    const fn = (v: string) => setValue(v)
    listeners.add(fn)
    void serverVersion().then((v) => { if (v) setValue(v) })
    return () => { listeners.delete(fn) }
  }, [])
  return value
}

/** `/api/health` exposed to whoever needs the whole picture (About's staleness card). */
export async function healthWeb(): Promise<NonNullable<HealthWeb['web']> | null> {
  try {
    const r = await fetch('/api/health')
    if (!r.ok) return null
    const d = await r.json() as HealthWeb
    return d.web ?? null
  } catch {
    return null
  }
}
