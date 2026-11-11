// dqnamo-style scramble text: characters cycle through random glyphs and
// settle into the target string, left to right.
import { useEffect, useState } from 'react'

const GLYPHS = '!<>-_\\/[]{}—=+*^?#0123456789ABCDEFabcdef'

export function ScrambleText({ text, duration = 900, className = '' }: { text: string; duration?: number; className?: string }) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setOut(text); return }
    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const settled = Math.floor(p * text.length)
      let s = ''
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ' || i < settled) s += text[i]
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      setOut(s)
      if (p < 1) raf = requestAnimationFrame(frame)
      else setOut(text)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [text, duration])
  return <span className={className} aria-label={text}><span aria-hidden>{out}</span></span>
}
