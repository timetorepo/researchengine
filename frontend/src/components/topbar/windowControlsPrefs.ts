import { useEffect, useState } from 'react'

/**
 * Window control style for the top bar. Off by default: the usual set of icon
 * buttons. On: three macOS-style traffic lights (close, minimise, full screen)
 * at the start of the bar. The choice lives in localStorage so it survives a
 * reload, and a window event keeps every mounted reader in step without a
 * page refresh.
 */
export const WINDOW_CONTROLS_PREF = 'research-engine.window-controls'
export const WINDOW_CONTROLS_EVENT = 'research-engine:window-controls'

export function readTrafficLights(): boolean {
  try {
    return localStorage.getItem(WINDOW_CONTROLS_PREF) === 'traffic'
  } catch {
    return false
  }
}

export function setTrafficLights(on: boolean): void {
  try {
    localStorage.setItem(WINDOW_CONTROLS_PREF, on ? 'traffic' : 'standard')
  } catch { /* private mode: the choice lasts for this session only */ }
  window.dispatchEvent(new CustomEvent(WINDOW_CONTROLS_EVENT, { detail: on }))
}

/** True when the traffic-light style is chosen. Updates when the setting changes. */
export function useTrafficLights(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(readTrafficLights)
  useEffect(() => {
    const onChange = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail))
    window.addEventListener(WINDOW_CONTROLS_EVENT, onChange)
    return () => window.removeEventListener(WINDOW_CONTROLS_EVENT, onChange)
  }, [])
  return [on, setTrafficLights]
}
