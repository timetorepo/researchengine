import { useReducedMotion } from 'motion/react'
import { useStore } from '@/stores/useStore'
export function useBenchoReducedMotion(): boolean {
  const system = useReducedMotion()
  const setting = useStore((s) => s.settings.reduceMotion)
  return setting || !!system
}
