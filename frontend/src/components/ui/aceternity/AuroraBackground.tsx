import React from 'react'

/** Aceternity-style aurora background — layered, barely-moving light. */
export function AuroraBackground({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="aurora-blob" style={{
          top: '-22%', left: '-12%', width: '64vmax', height: '64vmax',
          background: 'radial-gradient(circle at center, var(--aurora-a), transparent 62%)',
          animationDuration: '90s',
        }} />
        <div className="aurora-blob" style={{
          bottom: '-26%', right: '-14%', width: '58vmax', height: '58vmax',
          background: 'radial-gradient(circle at center, var(--aurora-b), transparent 62%)',
          animationDuration: '120s', animationDirection: 'alternate-reverse',
        }} />
        <div className="aurora-blob" style={{
          top: '30%', left: '38%', width: '34vmax', height: '34vmax', opacity: 0.6,
          background: 'radial-gradient(circle at center, var(--aurora-a), transparent 60%)',
          animationDuration: '140s', animationDelay: '-40s',
        }} />
      </div>
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  )
}
