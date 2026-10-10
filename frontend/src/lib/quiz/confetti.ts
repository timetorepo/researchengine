// Featherweight canvas confetti — no dependency, ~50 particles, 1.1s lifetime.
export function burstConfetti(x: number, y: number, colors: string[] = ['#34D399', '#6C8EEF', '#FBBF24', '#A78BFA', '#22D3EE']) {
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9999',
  })
  document.body.appendChild(canvas)
  // A canvas that refuses to give us a context (very old browser, a locked-down
  // webview, a test DOM) must not throw inside a click handler — the answer is
  // already graded by then.
  const ctx = canvas.getContext('2d')
  if (!ctx) { canvas.remove(); return }
  ctx.scale(dpr, dpr)

  const n = 6 + Math.floor(Math.random() * 2) // 5-7 particles per spec
  const parts = Array.from({ length: n }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 7,
    vy: -(3 + Math.random() * 5),
    w: 5 + Math.random() * 4,
    h: 7 + Math.random() * 5,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
  }))

  const t0 = performance.now()
  const tick = (t: number) => {
    const el = (t - t0) / 1000
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of parts) {
      p.vy += 0.28 // gravity
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      p.life = Math.max(0, 1 - el / 1.1)
      ctx.save()
      ctx.globalAlpha = p.life * 0.6 // fade at 60% opacity per spec
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (el < 1.15) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
