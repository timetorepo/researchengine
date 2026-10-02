/**
 * Placeholders and Vanish Input — Aceternity UI, vendored (R17).
 *
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/placeholders-and-vanish-input-demo
 *
 * ui.aceternity.com is unreachable from the build machine, so this is the same
 * component as published by the `xlibs-components` npm package (0.1.13 builds of
 * the Aceternity set), carried over unchanged in behaviour: the rotating
 * placeholder, the canvas that turns what you typed into pixels and scatters
 * them leftwards on submit, and the value that clears itself when the last
 * pixel is gone. The three differences from upstream are all this app's:
 *
 *   1. `motion/react` instead of `framer-motion` (one copy of the library).
 *   2. Theme tokens instead of `bg-white dark:bg-zinc-800`: this app has
 *      thirteen themes and no `.dark` class, so a fixed pair would be wrong in
 *      eleven of them.
 *   3. The canvas is skipped entirely under `prefers-reduced-motion`, where the
 *      submit simply clears the field.
 *
 * Provenance and the upstream package digest: scripts/aceternity-sources.json.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface Pixel { x: number; y: number; r: number; color: string }

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  submitLabel = 'Send',
  className,
  autoFocus = false,
}: {
  placeholders: string[]
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (value: string) => void
  submitLabel?: string
  className?: string
  autoFocus?: boolean
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAnimation = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % Math.max(1, placeholders.length))
    }, 3000)
  }, [placeholders.length])

  // Placeholders pause in a hidden tab: a background timer that keeps swapping
  // text is work nobody can see.
  useEffect(() => {
    startAnimation()
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      } else if (document.visibilityState === 'visible') {
        startAnimation()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [placeholders, startAnimation])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const newDataRef = useRef<Pixel[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [animating, setAnimating] = useState(false)
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const draw = useCallback(() => {
    if (!inputRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = 800
    canvas.height = 800
    ctx.clearRect(0, 0, 800, 800)
    const styles = getComputedStyle(inputRef.current)
    const fontSize = parseFloat(styles.getPropertyValue('font-size')) || 16
    ctx.font = `${fontSize * 2}px ${styles.fontFamily}`
    ctx.fillStyle = styles.color || '#fff'
    ctx.fillText(value, 16, 40)
    const imageData = ctx.getImageData(0, 0, 800, 800)
    const pixelData = imageData.data
    const next: Pixel[] = []
    for (let y = 0; y < 800; y++) {
      const row = 4 * y * 800
      for (let x = 0; x < 800; x++) {
        const i = row + 4 * x
        if (pixelData[i] !== 0 && pixelData[i + 1] !== 0 && pixelData[i + 2] !== 0) {
          next.push({ x, y, r: 1, color: `rgba(${pixelData[i]}, ${pixelData[i + 1]}, ${pixelData[i + 2]}, ${pixelData[i + 3]})` })
        }
      }
    }
    newDataRef.current = next
  }, [value])

  useEffect(() => { draw() }, [value, draw])

  const animate = useCallback((start: number) => {
    const step = (pos = 0) => {
      requestAnimationFrame(() => {
        const next: Pixel[] = []
        for (const current of newDataRef.current) {
          if (current.x < pos) { next.push(current); continue }
          if (current.r <= 0) { current.r = 0; continue }
          current.x += Math.random() > 0.5 ? 1 : -1
          current.y += Math.random() > 0.5 ? 1 : -1
          current.r -= 0.05 * Math.random()
          next.push(current)
        }
        newDataRef.current = next
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800)
          for (const { x, y, r, color } of newDataRef.current) {
            if (x > pos) {
              ctx.beginPath()
              ctx.rect(x, y, r, r)
              ctx.fillStyle = color
              ctx.strokeStyle = color
              ctx.stroke()
            }
          }
        }
        if (newDataRef.current.length > 0) step(pos - 8)
        else { setAnimating(false); setValue('') }
      })
    }
    step(start)
  }, [])

  const submit = () => {
    const text = inputRef.current?.value || ''
    if (!text.trim()) return
    if (reduce) { setValue(''); onSubmit(text) ; return }
    setAnimating(true)
    draw()
    const maxX = newDataRef.current.reduce((prev, c) => (c.x > prev ? c.x : prev), 0)
    animate(maxX)
    onSubmit(text)
  }

  return (
    <form
      className={cn('relative w-full max-w-xl mx-auto h-12 rounded-[999px] overflow-hidden transition duration-200', className)}
      style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
      onSubmit={(e) => { e.preventDefault(); submit() }}>
      <canvas
        aria-hidden
        ref={canvasRef}
        className={cn('absolute pointer-events-none text-base transform scale-50 top-[20%] left-2 origin-top-left pr-20', !animating ? 'opacity-0' : 'opacity-100')}
      />
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => { if (!animating) { setValue(e.target.value); onChange?.(e) } }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !animating) { e.preventDefault(); submit() } }}
        type="text"
        aria-label={placeholders[0] || 'Input'}
        className={cn('w-full relative text-[13.5px] z-50 border-none bg-transparent h-full rounded-[999px] focus:outline-none focus:ring-0 pl-4 sm:pl-10 pr-20', animating && 'text-transparent')}
        style={{ color: 'var(--text)' }}
      />
      <button
        disabled={!value}
        type="submit"
        aria-label={submitLabel}
        className="absolute right-2 top-1/2 z-50 -translate-y-1/2 h-8 w-8 rounded-full disabled:opacity-40 transition duration-200 flex items-center justify-center"
        style={{ background: 'var(--primary)', color: 'var(--primary-ink, #fff)' }}>
        <motion.svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <motion.path d="M5 12l14 0" initial={{ strokeDasharray: '50%', strokeDashoffset: '50%' }} animate={{ strokeDashoffset: value ? 0 : '50%' }} transition={{ duration: 0.3, ease: 'linear' }} />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </motion.svg>
      </button>
      <div className="absolute inset-0 flex items-center rounded-full pointer-events-none">
        <AnimatePresence mode="wait">
          {!value && (
            <motion.p
              key={`placeholder-${currentPlaceholder}`}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'linear' }}
              className="text-[13.5px] font-normal pl-4 sm:pl-12 text-left w-[calc(100%-2rem)] truncate"
              style={{ color: 'var(--text-3)' }}>
              {placeholders[currentPlaceholder] ?? ''}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  )
}
