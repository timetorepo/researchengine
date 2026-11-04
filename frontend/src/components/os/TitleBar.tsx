import React from 'react'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'
import { AppLogo } from '@/components/shared/AppLogo'
import { PrivacyShield } from '@/components/sidebar/Sidebar'

export function TitleBar() {
  const ui = useUI()
  const minimized = ui.osMinimized
  const integrations = useStore((s) => s.integrations)
  const anyIntegration = Object.values(integrations).some((i) => i.connected)

  const minimize = () => ui.set({ osMinimized: !minimized })
  const maximize = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const close = () => ui.toast('Hidden to tray', 'Research Engine keeps running. Click the orb to bring it back.', 'info')

  return (
    <div
      className="h-11 shrink-0 flex items-center px-4 gap-3 glass relative z-40"
      style={{ borderBottom: '1px solid var(--surface-border)' }}
    >
      <div className="flex items-center gap-2">
        <button aria-label="Close (hide to tray)" onClick={close} className="w-3 h-3 rounded-full transition-transform hover:scale-110" style={{ background: '#ff5f57' }} />
        <button aria-label="Minimize" onClick={minimize} className="w-3 h-3 rounded-full transition-transform hover:scale-110" style={{ background: '#febc2e' }} />
        <button aria-label="Maximize" onClick={maximize} className="w-3 h-3 rounded-full transition-transform hover:scale-110" style={{ background: '#28c840' }} />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2">
        <AppLogo size={20} withName={false} />
      </div>
      {/* Privacy surface stays reachable even though the OS sidebar is hidden */}
      <div className="ml-auto flex items-center gap-1">
        <PrivacyShield compact amber={anyIntegration} />
        <span className="text-[11px] pl-1" style={{ color: 'var(--text-3)' }}>ResearchEngineOS</span>
      </div>
    </div>
  )
}
