import { useSyncExternalStore } from 'react'
import { useStore } from '@/stores/useStore'
const query = '(prefers-reduced-transparency: reduce), (forced-colors: active), (prefers-reduced-motion: reduce)'
const subscribe = (notify: () => void) => { const media = matchMedia(query); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify) }
const snapshot = () => matchMedia(query).matches
/** Accessibility overrides apply even to the independent experimental navigation. */
export function useStaticMaterials() {
  const reduced = useStore(s => s.settings.reduceMotion || s.settings.theme === 'high-contrast')
  const opaque = useSyncExternalStore(subscribe, snapshot, () => true)
  return !!reduced || opaque
}
/** Preserve the saved request; accessibility preferences temporarily override material. */
export function useLiquidGlass() {
  const requested = useStore(s => s.settings.liquidGlassRedesign === true)
  const staticMaterials = useStaticMaterials()
  return requested && !staticMaterials
}
