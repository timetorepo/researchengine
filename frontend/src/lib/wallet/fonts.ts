/**
 * Uploaded card typefaces. A font is registered with the browser under a name
 * derived from its bytes, so the same file is loaded once however many cards
 * use it, and a changed file gets a new name.
 */
export const CUSTOM_FONT_MAX_BYTES = 1024 * 1024
export const CUSTOM_FONT_TYPES = ['.ttf', '.otf', '.woff', '.woff2']

const loaded = new Map<string, Promise<void>>()

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** The CSS family name for an uploaded font. */
export function customFamilyName(dataUrl: string): string {
  return `wallet-font-${hash(dataUrl)}`
}

/**
 * Registers the font with the document and resolves once it can be drawn.
 * Rejects if the file is not a font the browser can read.
 */
export function ensureCustomFont(dataUrl: string): Promise<string> {
  const family = customFamilyName(dataUrl)
  let p = loaded.get(family)
  if (!p) {
    p = (async () => {
      const face = new FontFace(family, `url("${dataUrl}")`)
      await face.load()
      document.fonts.add(face)
    })()
    loaded.set(family, p)
    p.catch(() => loaded.delete(family))
  }
  return p.then(() => family)
}

/** Reads a picked file as a data URL, after checking its name and size. */
export function readFontFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (!CUSTOM_FONT_TYPES.some((t) => lower.endsWith(t))) return Promise.reject(new Error('Use a .ttf, .otf, .woff or .woff2 file.'))
  if (file.size > CUSTOM_FONT_MAX_BYTES) return Promise.reject(new Error('Fonts must be 1 MB or smaller.'))
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(file)
  })
}
