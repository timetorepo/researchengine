import React, { useEffect, useState } from 'react'

/**
 * Aceternity-style aurora background — layered, barely-moving light.
 *
 * The three blurred gradient layers are the most expensive paint on the home
 * screen, so they stop the moment nobody can see them: the tab is hidden, or
 * the system asked for reduced motion. Resuming is automatic.
 */
function useAuroraPlay(): 'running' | 'paused' {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    const sync = () => setPaused(Boolean(document.hidden || mq?.matches))
    sync()
    mq?.addEventListener?.('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { mq?.removeEventListener?.('change', sync); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return paused ? 'paused' : 'running'
}

export function AuroraBackground({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  const play = useAuroraPlay()
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="aurora-blob" style={{
          top: '-22%', left: '-12%', width: '64vmax', height: '64vmax',
          background: 'radial-gradient(circle at center, var(--aurora-a), transparent 62%)',
          animationDuration: '90s', animationPlayState: play,
        }} />
        <div className="aurora-blob" style={{
          bottom: '-26%', right: '-14%', width: '58vmax', height: '58vmax',
          background: 'radial-gradient(circle at center, var(--aurora-b), transparent 62%)',
          animationDuration: '120s', animationDirection: 'alternate-reverse', animationPlayState: play,
        }} />
        <div className="aurora-blob" style={{
          top: '30%', left: '38%', width: '34vmax', height: '34vmax', opacity: 0.6,
          background: 'radial-gradient(circle at center, var(--aurora-a), transparent 60%)',
          animationDuration: '140s', animationDelay: '-40s', animationPlayState: play,
        }} />
      </div>
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  )
}