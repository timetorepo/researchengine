/**
 * The page's own light: three soft violet pools, a faint grid, and a grain.
 * Fixed, so the content glides over it.
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
        className="absolute top-[42%] -left-[18rem] h-[36rem] w-[36rem] rounded-full blur-[150px]"
        style={{ background: 'radial-gradient(circle, rgba(94,234,212,0.14), transparent 68%)' }}
      />
      <div
        className="absolute right-[-16rem] bottom-[-14rem] h-[40rem] w-[40rem] rounded-full blur-[150px]"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.22), transparent 68%)' }}
      />
      <div className="noise absolute inset-0 opacity-[0.035] mix-blend-soft-light" />
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: 'linear-gradient(to bottom, rgba(7,6,12,0.9), transparent)' }}
      />
    </div>
  )
}
