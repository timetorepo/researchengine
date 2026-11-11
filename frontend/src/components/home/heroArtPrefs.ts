import { useEffect, useState } from 'react'

/**
 * The painted picture behind the home-screen headline. Off by default: the
 * headline sits on the normal surface. Turn it on in Settings → Appearance.
 * The choice is stored in localStorage, and a window event keeps every
 * mounted reader in step without a reload.
 */
export const HERO_ART_PREF = 'research-engine.home-hero-art'
export const HERO_ART_EVENT = 'research-engine:home-hero-art'

export function readHeroArt(): boolean {
  try {
    return localStorage.getItem(HERO_ART_PREF) === '1'
  } catch {
    return false
  }
}

export function setHeroArt(on: boolean): void {
  try {
    localStorage.setItem(HERO_ART_PREF, on ? '1' : '0')
  } catch { /* private mode: the choice lasts for this session only */ }
  window.dispatchEvent(new CustomEvent(HERO_ART_EVENT, { detail: on }))
}

/** True when the hero picture is shown. Updates when the setting changes. */
export function useHeroArt(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(readHeroArt)
  useEffect(() => {
    const onChange = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail))
    window.addEventListener(HERO_ART_EVENT, onChange)
    return () => window.removeEventListener(HERO_ART_EVENT, onChange)
  }, [])
  return [on, setHeroArt]
}
