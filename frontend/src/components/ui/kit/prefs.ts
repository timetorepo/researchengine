// Small persisted boolean/string preference for UI toggles that do not need
// to live in the global settings store. Safe without a DOM (SSR/tests).
import { useCallback, useState } from 'react'

export function usePrefFlag(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      return raw === null ? fallback : raw === '1'
    } catch {
      return fallback
    }
  })
  const set = useCallback((v: boolean) => {
    setValue(v)
    try { localStorage.setItem(key, v ? '1' : '0') } catch { /* private mode */ }
  }, [key])
  return [value, set]
}
