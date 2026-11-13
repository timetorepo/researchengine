import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStore } from '@/stores/useStore'
import './particles/Particles.css'
import './ascii-wake/AsciiWake.css'
const Particles = lazy(() => import('./particles/Particles').then((module) => ({ default: module.Particles })))
const AsciiWake = lazy(() => import('./ascii-wake/AsciiWake').then((module) => ({ default: module.AsciiWake })))

/** Opt-in, visible-only canvas mounts. Never pay for a hidden continuous loop. */
export function WorkspaceEffect({ kind }: { kind: 'particles' | 'ascii' }) {
  const enabled = useStore((s) => s.settings.workspaceEffects === true)
  const reduce = useStore((s) => s.settings.reduceMotion)
  const systemReduce = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (root.current) observer.observe(root.current)
    const visibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility) }
  }, [enabled, reduce, systemReduce])
  if (!enabled || reduce || systemReduce) return null
  return <div ref={root} aria-hidden="true" className="re-bencho re-workspace-effect">
    {visible && pageVisible && <Suspense fallback={null}>{kind === 'ascii' ? <AsciiWake /> : <Particles />}</Suspense>}
  </div>
}
