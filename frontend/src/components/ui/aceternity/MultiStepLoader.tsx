/**
 * Multi Step Loader — Aceternity UI, vendored (R17).
 *
 * Canonical install: `npx shadcn@latest add @aceternity/multi-step-loader-demo`.
 * The registry host is unreachable from the build machine, so this carries the
 * component as published in the `xlibs-components` npm package: the fixed
 * full-screen panel, the stacked list of states where the current one is lit
 * and its neighbours fade with distance, and the tick that fills in as each
 * state passes.
 *
 * Differences from upstream, all deliberate:
 *   • `motion/react` rather than `framer-motion`.
 *   • Theme colours instead of `text-black dark:text-lime-500`; this app has
 *     thirteen themes and no `.dark` class.
 *   • An `onDone` callback, because the onboarding step it serves has to know
 *     when the animation has finished rather than guess at a timeout.
 *   • `duration` is per state and the loop can be turned off, which the app
 *     uses for a one-shot "setting things up" pass.
 */
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface LoadingState { text: string }

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={cn('w-5 h-5', className)}>
    <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const CheckFilled = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={cn('w-5 h-5', className)}>
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
  </svg>
)

function LoaderCore({ loadingStates, value = 0 }: { loadingStates: LoadingState[]; value?: number }) {
  return (
    <div className="flex relative justify-start max-w-xl mx-auto flex-col">
      {loadingStates.map((state, index) => {
        const distance = Math.abs(index - value)
        const opacity = Math.max(1 - distance * 0.2, 0)
        const active = value === index
        return (
          <motion.div
            key={index}
            className="text-left flex gap-2 mb-3 items-center"
            initial={{ opacity: 0, y: -(value * 34) }}
            animate={{ opacity, y: -(value * 34) }}
            transition={{ duration: 0.45 }}>
            <span style={{ color: index <= value ? 'var(--primary)' : 'var(--text-3)' }}>
              {index > value ? <CheckIcon /> : <CheckFilled className={active ? 'animate-pulse' : undefined} />}
            </span>
            <span className="text-[13.5px]" style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}>{state.text}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export function MultiStepLoader({
  loadingStates,
  loading = true,
  duration = 900,
  loop = false,
  onDone,
  className,
}: {
  loadingStates: LoadingState[]
  loading?: boolean
  duration?: number
  loop?: boolean
  onDone?: () => void
  className?: string
}) {
  const [currentState, setCurrentState] = useState(0)
  const doneRef = React.useRef(false)

  useEffect(() => {
    if (!loading) { setCurrentState(0); doneRef.current = false; return }
    if (doneRef.current) return
    const timeout = setTimeout(() => {
      setCurrentState((prev) => {
        if (prev === loadingStates.length - 1) {
          if (loop) return 0
          doneRef.current = true
          onDone?.()
          return prev
        }
        return prev + 1
      })
    }, duration)
    return () => clearTimeout(timeout)
  }, [currentState, loading, loop, loadingStates.length, duration, onDone])

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn('w-full h-full fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl', className)}
          style={{ background: 'color-mix(in srgb, var(--bg) 72%, transparent)' }}>
          <div className="h-96 relative flex items-center">
            <LoaderCore value={currentState} loadingStates={loadingStates} />
          </div>
          {/* The fade at the edges is what makes the list feel like it has
              depth rather than being a floating column of text. */}
          <div className="absolute inset-x-0 bottom-0 z-20 h-1/3 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }} />
          <div className="absolute inset-x-0 top-0 z-20 h-1/3 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MultiStepLoader
