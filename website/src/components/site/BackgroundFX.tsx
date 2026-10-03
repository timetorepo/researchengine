/**
 * The page's own light: one soft pool at the top, a faint grid, and a grain.
 *
 * It used to be three pools and a teal wash, which is what made the whole page
 * read as a gradient rather than as a document. A single light source behind the
 * hero does the same job and lets the sections below be plain.
 */
export function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-[0.55]" />
      <div
        className="absolute -top-[26rem] left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.34), transparent 66%)' }}
      />
      <div
        className="absolute right-[-16rem] bottom-[-16rem] h-[40rem] w-[40rem] rounded-full blur-[160px] opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.18), transparent 70%)' }}
      />
      <div className="noise absolute inset-0 opacity-[0.035] mix-blend-soft-light" />
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: 'linear-gradient(to bottom, rgba(7,6,12,0.9), transparent)' }}
      />
    </div>
  )
}
