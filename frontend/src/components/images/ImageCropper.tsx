import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as Cropper from '@zriz/react/cropper'
import type { Cropper as CropperApi } from '@zriz/core'
import { exportCrop } from '@zriz/core/dom'
import { FlipHorizontal, RotateCcw, Undo2 } from 'lucide-react'
import { BoardOverlay } from '@/components/ui/boardui/Overlay'
import { useStore } from '@/stores/useStore'
import '@zriz/react/styles.css'

function ImageCropper({ file, avatar, finish }: { file: File; avatar: boolean; finish: (file: File | null) => void }) {
  const api = useRef<CropperApi>(null)
  const abort = useRef(new AbortController())
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const motion = useStore((s) => s.settings.reduceMotion)
  useEffect(() => () => abort.current.abort(), [])
  const close = () => { abort.current.abort(); finish(null) }
  const apply = async () => {
    if (!api.current || !ready || busy) return
    setBusy(true); setError('')
    try {
      const result = await exportCrop(api.current, { type: 'image/png', ...(avatar ? { maxSize: { width: 512, height: 512 } } : {}), signal: abort.current.signal })
      if (!abort.current.signal.aborted) finish(new File([result.blob], `${file.name.replace(/\.[^.]+$/, '')}-cropped.png`, { type: result.type }))
    } catch (e) {
      if (!abort.current.signal.aborted) { setError(e instanceof Error ? e.message : 'Export failed. Try another image.'); setBusy(false) }
    }
  }
  return <BoardOverlay open onClose={close} title={avatar ? 'Crop profile photo' : 'Edit image'}>
    <div className="p-4 space-y-3" aria-busy={busy}>
      <p className="text-xs text-[var(--text-2)]">Processed on this device. Drag to position; use the handles to crop. Applying creates a still image.{avatar ? ' Your photo is saved at up to 512 × 512 pixels.' : ' Use original preserves animation and the original file.'}</p>
      <Cropper.Root src={file} actionsRef={api} defaultValue={{ aspect: avatar ? 1 : 'free' }} motion={motion ? 'reduce' : 'auto'} disabled={busy} svg={false}
        onLoad={() => setReady(true)} onError={(e) => { setReady(false); setError(e.message) }}>
        <Cropper.Viewport style={{ width: '100%', height: 'min(44vh, 360px)', padding: 28, background: '#151515', borderRadius: 12 }}>
          <Cropper.Image /><Cropper.Mask />
          <Cropper.Area aria-label="Crop area"><Cropper.Grid />
            <Cropper.Handle position="top-left" /><Cropper.Handle position="top-right" />
            <Cropper.Handle position="bottom-left" /><Cropper.Handle position="bottom-right" />
            {avatar && <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed white', pointerEvents: 'none' }} />}
          </Cropper.Area>
        </Cropper.Viewport>
        <div className="flex flex-wrap gap-2 py-3">
          <Cropper.Rotate className="bui-button" aria-label="Rotate left"><RotateCcw size={16} /> Rotate</Cropper.Rotate>
          <Cropper.Flip className="bui-button" aria-label="Flip horizontally"><FlipHorizontal size={16} /> Flip</Cropper.Flip>
          <Cropper.Reset className="bui-button"><Undo2 size={16} /> Reset</Cropper.Reset>
        </div>
        <Cropper.Dial aria-label="Straighten" style={{ width: '100%', margin: '12px 0' }}><Cropper.DialTicks /></Cropper.Dial>
        <p className="text-xs text-[var(--text-2)]">Zoom</p>
        <Cropper.Zoom aria-label="Zoom" style={{ width: '100%', height: 28, background: 'var(--elevated)', borderRadius: 14 }}><Cropper.ZoomThumb style={{ width: 20, height: 20, background: 'var(--primary)', borderRadius: '50%' }} /></Cropper.Zoom>
        <Cropper.Announcer announce={(value) => `Crop updated. Rotation ${Math.round(value.rotation)} degrees.`} />
      </Cropper.Root>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error} Try a PNG, JPEG or WebP.{!avatar && ' You can also use the original file.'}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button className="bui-button" onClick={close}>Cancel</button>
        {!avatar && <button className="bui-button" disabled={busy} onClick={() => finish(file)}>Use original</button>}
        <button className="bui-button" disabled={!ready || busy} onClick={() => void apply()}>{busy ? 'Exporting…' : 'Apply crop'}</button>
      </div>
    </div>
  </BoardOverlay>
}

export function openImageCropper(file: File, avatar: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let settled = false
    const finish = (result: File | null) => {
      if (settled) return
      settled = true
      resolve(result)
      setTimeout(() => { root.unmount(); host.remove(); if (previous?.isConnected) previous.focus() }, 0)
    }
    root.render(<ImageCropper file={file} avatar={avatar} finish={finish} />)
  })
}
