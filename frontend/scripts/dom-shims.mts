/**
 * Environment shims shared by the jsdom suites.
 *
 * The app ships Voice by Jakub Antalik (voice-glow) around the composer, and
 * that component animates SVG filter values per frame. jsdom parses SVG but
 * implements none of its animated-value interfaces, and it has no layout engine
 * either — so the suites that mount the real app need two small shims before
 * anything renders, or a background animation frame takes the process down.
 *
 * Import and call this right after the JSDOM window exists.
 */
export function applyVoiceGlowShims(win: any) {
  if (!win.MutationObserver) {
    win.MutationObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
  }
  if (!(globalThis as any).MutationObserver) (globalThis as any).MutationObserver = win.MutationObserver

  const animatedNumber = () => ({
    _v: 0,
    get baseVal() { return this._v },
    set baseVal(v: number) { this._v = v },
  })
  for (const prop of ['scale', 'dx', 'dy', 'baseFrequency', 'stdDeviation']) {
    try {
      Object.defineProperty(win.SVGElement.prototype, prop, {
        configurable: true,
        get() { return animatedNumber() },
      })
    } catch { /* already defined by another suite in the same process */ }
  }
}
