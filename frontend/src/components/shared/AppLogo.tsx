import React, { useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { fmt } from '@/lib/utils'

export function AppLogo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  const pressStart = useRef(0)
  const timer = useRef<any>(null)
  const ui = useUI()
  const lifetime = useStore((s) => s.tokensSavedLifetime)

  // Easter egg: long-press 3s → sonar ping + lifetime tokens saved
  const onPointerDown = () => {
    pressStart.current = Date.now()
    timer.current = setTimeout(() => {
      ui.set({ sonar: true })
      ui.toast('Sonar ping', `AIFlowEngine has saved ${fmt(lifetime)} tokens across all sessions.`, 'success')
      setTimeout(() => ui.set({ sonar: false }), 1600)
    }, 3000)
  }
  const onPointerUp = () => clearTimeout(timer.current)

  return (
    <div
      className="flex items-center gap-2.5 select-none relative"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {ui.sonar && (
        <span className="absolute -inset-2 pointer-events-none" style={{ width: size + 16, height: size + 16 }}>
          <span className="sonar-ring" />
          <span className="sonar-ring" style={{ animationDelay: '200ms' }} />
        </span>
      )}
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Research Engine">
        <rect width="32" height="32" rx="8" fill="var(--elevated)" stroke="var(--surface-border)" />
        <path d="M16 6 L25 12 L16 18 L7 12 Z" fill="var(--primary)" />
        <path d="M16 14 L25 20 L16 26 L7 20 Z" fill="var(--secondary)" opacity="0.85" />
      </svg>
      {withName && (
        <div className="leading-none">
          <div className="font-semibold tracking-tight text-[15px]" style={{ letterSpacing: '-0.02em' }}>Research Engine</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>Local · Private</div>
        </div>
      )}
    </div>
  )
}
