/**
 * The preview frame: Phones, Tablets, Laptops, TV.
 *
 * One iframe, framed like the device it is pretending to be, scaled down to fit
 * the pane without ever scaling the page itself (the frame keeps the real pixel
 * size, so media queries and breakpoints behave exactly as they will on the
 * device — a scaled-up div would lie about every breakpoint).
 *
 * The grid overlays are the design grids the Design Mode was missing: a column
 * grid, a baseline rhythm, an 8 pt grid, and safe-area guides for phones. They
 * are drawn over the frame, never inside it, so nothing here can change the page
 * being inspected.
 */
import React, { useMemo, useState } from 'react'
import { Monitor, Smartphone, Tablet, Tv, RotateCcw, Grid3x3, AlignJustify, Columns3, Ruler } from 'lucide-react'

export interface DevicePreset {
  id: string
  label: string
  family: 'phone' | 'tablet' | 'laptop' | 'tv' | 'desktop'
  w: number
  h: number
  /** Real device scale factors, so assets can be judged honestly. */
  dpr: number
}

export const DEVICES: DevicePreset[] = [
  { id: 'phone-sm', label: 'Small phone', family: 'phone', w: 320, h: 568, dpr: 2 },
  { id: 'phone', label: 'Phone', family: 'phone', w: 390, h: 844, dpr: 3 },
  { id: 'phone-lg', label: 'Large phone', family: 'phone', w: 430, h: 932, dpr: 3 },
  { id: 'tablet', label: 'Tablet', family: 'tablet', w: 834, h: 1112, dpr: 2 },
  { id: 'tablet-lg', label: 'Large tablet', family: 'tablet', w: 1024, h: 1366, dpr: 2 },
  { id: 'laptop', label: 'Laptop', family: 'laptop', w: 1280, h: 800, dpr: 2 },
  { id: 'laptop-lg', label: 'Large laptop', family: 'laptop', w: 1512, h: 982, dpr: 2 },
  { id: 'desktop', label: 'Desktop', family: 'desktop', w: 1440, h: 900, dpr: 2 },
  { id: 'tv', label: 'TV', family: 'tv', w: 1920, h: 1080, dpr: 1 },
  { id: 'tv-4k', label: 'TV 4K', family: 'tv', w: 3840, h: 2160, dpr: 1 },
]

export const DEVICE_FAMILIES: { id: DevicePreset['family']; label: string; Icon: typeof Monitor }[] = [
  { id: 'phone', label: 'Phones', Icon: Smartphone },
  { id: 'tablet', label: 'Tablets', Icon: Tablet },
  { id: 'laptop', label: 'Laptops', Icon: Monitor },
  { id: 'tv', label: 'TV', Icon: Tv },
]

export interface GridOptions {
  columns: boolean
  baseline: boolean
  eighths: boolean
  safeArea: boolean
  /** Column count for the column grid — 4 on phones, 12 on desktop is the habit. */
  columnCount: number
}

export const defaultGrids: GridOptions = { columns: false, baseline: false, eighths: false, safeArea: false, columnCount: 12 }

export function GridOverlay({ device, grids }: { device: DevicePreset; grids: GridOptions }) {
  const narrow = device.w < 700
  const cols = narrow ? Math.min(4, grids.columnCount) : grids.columnCount
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {grids.columns && (
        <div className="absolute inset-0 flex">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex-1" style={{
              borderRight: i < cols - 1 ? '1px solid color-mix(in srgb, var(--primary) 45%, transparent)' : undefined,
              background: i % 2 === 0 ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : 'transparent',
            }} />
          ))}
        </div>
      )}
      {grids.baseline && (
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(to bottom, color-mix(in srgb, var(--danger) 35%, transparent) 1px, transparent 1px)',
          backgroundSize: '100% 8px',
        }} />
      )}
      {grids.eighths && (
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(to right, color-mix(in srgb, var(--success) 22%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--success) 22%, transparent) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }} />
      )}
      {grids.safeArea && device.family === 'phone' && (
        <>
          <div className="absolute left-0 right-0 top-0 h-[47px]" style={{ background: 'color-mix(in srgb, var(--warning) 14%, transparent)', borderBottom: '1px dashed color-mix(in srgb, var(--warning) 55%, transparent)' }} />
          <div className="absolute left-0 right-0 bottom-0 h-[34px]" style={{ background: 'color-mix(in srgb, var(--warning) 14%, transparent)', borderTop: '1px dashed color-mix(in srgb, var(--warning) 55%, transparent)' }} />
        </>
      )}
    </div>
  )
}

interface Props {
  /** The URL to frame. The preview server's own URL, or any page. */
  url: string
  title?: string
  /** Start on this device. */
  initial?: string
  /** Height of the pane, for the scale-to-fit maths. */
  paneHeight?: number
  className?: string
}

export function DevicePreview({ url, title = 'Preview', initial = 'phone', paneHeight = 560, className = '' }: Props) {
  const [deviceId, setDeviceId] = useState(initial)
  const [landscape, setLandscape] = useState(false)
  const [grids, setGrids] = useState<GridOptions>(defaultGrids)
  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[1]
  const w = landscape ? device.h : device.w
  const h = landscape ? device.w : device.h

  // Scale the frame to fit the pane. The iframe keeps its real CSS size; only
  // the transform changes, so nothing inside the page is lied to.
  const scale = useMemo(() => {
    const maxW = 980
    const maxH = Math.max(240, paneHeight - 24)
    return Math.min(1, maxW / w, maxH / h)
  }, [w, h, paneHeight])

  const toggle = (k: keyof Omit<GridOptions, 'columnCount'>) => setGrids((g) => ({ ...g, [k]: !g[k] }))

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-device-preview>
      <div className="flex flex-wrap items-center gap-1.5">
        {DEVICE_FAMILIES.map((f) => (
          <div key={f.id} className="flex items-center gap-1">
            <f.Icon size={12} style={{ color: 'var(--ide-faint, var(--text-3))' }} />
            {DEVICES.filter((d) => d.family === f.id).map((d) => (
              <button key={d.id} onClick={() => setDeviceId(d.id)}
                title={`${d.w}×${d.h}`}
                className="px-2 py-1 rounded-[7px] text-[11px]"
                style={{
                  background: deviceId === d.id ? 'var(--ide-hover, var(--elevated))' : 'transparent',
                  color: deviceId === d.id ? 'var(--ide-text, var(--text))' : 'var(--ide-dim, var(--text-3))',
                  border: `1px solid ${deviceId === d.id ? 'var(--ide-line, var(--surface-border))' : 'transparent'}`,
                }}>
                {d.label}
              </button>
            ))}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <IconToggle on={grids.columns} onClick={() => toggle('columns')} Icon={Columns3} label="Column grid" />
          <IconToggle on={grids.baseline} onClick={() => toggle('baseline')} Icon={AlignJustify} label="Baseline rhythm" />
          <IconToggle on={grids.eighths} onClick={() => toggle('eighths')} Icon={Grid3x3} label="8 pt grid" />
          <IconToggle on={grids.safeArea} onClick={() => toggle('safeArea')} Icon={Ruler} label="Safe areas" />
          <button onClick={() => setLandscape((v) => !v)} title="Rotate"
            className="p-1.5 rounded-[7px]" style={{ color: 'var(--ide-dim, var(--text-3))' }}>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--ide-faint, var(--text-3))' }}>
        <span>{device.label}</span>
        <span>{w}×{h}</span>
        <span>×{device.dpr} dpr</span>
        {scale < 1 && <span>shown at {Math.round(scale * 100)}%</span>}
        {grids.columns && (
          <span className="flex items-center gap-1">
            {w < 700 ? 4 : grids.columnCount} columns
            <button className="underline decoration-dotted" onClick={() => setGrids((g) => ({ ...g, columnCount: g.columnCount === 12 ? 16 : g.columnCount === 16 ? 6 : 12 }))}>
              change
            </button>
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 grid place-items-start justify-center overflow-auto">
        <div style={{ width: w * scale, height: h * scale }}>
          <div className="relative overflow-hidden bg-white"
            style={{
              width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left',
              borderRadius: device.family === 'phone' ? 34 : device.family === 'tablet' ? 18 : device.family === 'tv' ? 6 : 10,
              border: '1px solid var(--ide-line, var(--surface-border))',
              boxShadow: '0 18px 60px rgba(0,0,0,.35)',
            }}>
            <iframe title={title} src={url} className="w-full h-full border-0" style={{ background: 'white' }} />
            <GridOverlay device={{ ...device, w, h }} grids={grids} />
          </div>
        </div>
      </div>
    </div>
  )
}

function IconToggle({ on, onClick, Icon, label }: { on: boolean; onClick: () => void; Icon: typeof Monitor; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-pressed={on}
      className="p-1.5 rounded-[7px]"
      style={{
        background: on ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent',
        color: on ? 'var(--primary)' : 'var(--ide-dim, var(--text-3))',
      }}>
      <Icon size={12} />
    </button>
  )
}
