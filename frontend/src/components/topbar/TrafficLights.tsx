import React, { useEffect, useState } from 'react'
import { fullscreenSupported, isFullscreen, onFullscreenChange, toggleFullscreen } from '@/lib/dom/fullscreen'
import { useUI } from '@/stores/useUI'

/**
 * Three macOS-style window controls for the top bar, shown when the
 * traffic-light style is chosen in Settings → Appearance.
 *
 * They act inside the app, because the web view cannot close or minimise its
 * own window:
 *   red    — close: dismisses the open dialog, panel or menu (Escape)
 *   yellow — minimise: collapses or opens the sidebar
 *   green  — full screen: the same toggle as the icon beside it
 * Each light shows its symbol when the group is hovered, as on macOS, and
 * every light has a label and a tooltip, so the meaning never depends on colour.
 */
export function TrafficLights() {
  const [hover, setHover] = useState(false)
  const [full, setFull] = useState(false)
  const [supported] = useState(fullscreenSupported())
  const collapsed = useUI((s) => s.sidebarCollapsed)
  useEffect(() => {
    if (!supported) return
    setFull(isFullscreen())
    return onFullscreenChange(() => setFull(isFullscreen()))
  }, [supported])

  const close = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  const minimise = () => useUI.getState().toggleSidebar()
  const zoom = () => { if (supported) void toggleFullscreen() }

  const lights = [
    { id: 'close', label: 'Close the open panel', color: '#FF5F57', glyph: '×', onClick: close, disabled: false },
    { id: 'minimise', label: collapsed ? 'Show the sidebar' : 'Collapse the sidebar', color: '#FEBC2E', glyph: '−', onClick: minimise, disabled: false },
    { id: 'zoom', label: full ? 'Leave full screen' : 'Full screen', color: '#28C840', glyph: full ? '↙' : '↗', onClick: zoom, disabled: !supported },
  ]

  return (
    <div
      role="group"
      aria-label="Window controls"
      data-ui="traffic-lights"
      className="flex items-center gap-2 pl-1 pr-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {lights.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={l.onClick}
          disabled={l.disabled}
          aria-label={l.label}
          title={l.label}
          data-light={l.id}
          className="relative grid place-items-center w-3 h-3 rounded-full transition-[filter] duration-150 hover:brightness-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{
            background: l.color,
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
            ['--tw-ring-color' as string]: l.color,
          }}
        >
          <span
            aria-hidden="true"
            className="text-[9px] leading-none font-semibold select-none"
            style={{ color: 'rgba(0,0,0,0.55)', opacity: hover && !l.disabled ? 1 : 0, transition: 'opacity 120ms' }}
          >
            {l.glyph}
          </span>
        </button>
      ))}
    </div>
  )
}

export default TrafficLights
