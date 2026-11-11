// Custom background helpers. Uploaded images are downscaled + re-encoded so the
// local database stays small (everything persists to localStorage).

const MAX_DIM = 1600
const QUALITY = 0.82

export async function fileToBackgroundUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  let w: number, h: number, source: CanvasImageSource
  if (bitmap) {
    w = bitmap.width; h = bitmap.height; source = bitmap
  } else {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    w = img.naturalWidth; h = img.naturalHeight; source = img
  }

  const scale = Math.min(1, MAX_DIM / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, cw, ch)
  if (bitmap) bitmap.close()

  // JPEG keeps the data URL small; PNG fallback preserves transparency
  const isPng = file.type === 'image/png'
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', QUALITY)
}

export const SOLID_PRESETS = [
  '#0A0A0B', '#101828', '#1a1430', '#0d1f1a', '#241a10',
  '#FAFAFA', '#eef2f7', '#f3efe7', '#eaf3ef', '#f6eef2',
]
