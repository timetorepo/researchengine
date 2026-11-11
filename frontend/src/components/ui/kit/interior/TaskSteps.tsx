// Interior-style task steps: a vertical checklist where completed steps tick,
// the current step pulses, and a failed step turns red. Props follow the
// interior.dev API: steps, current, failed, label.
import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'

export type Step = { label: string; detail?: string }

export function TaskSteps({ steps, current, failed, label = 'Progress' }: {
  steps: Step[]; current: number; failed?: number; label?: string
}) {
  return (
    <ol aria-label={label} className="space-y-3">
      {steps.map((s, i) => {
        const isFailed = failed === i
        const done = !isFailed && i < current
        const active = !isFailed && i === current
        const color = isFailed ? 'var(--danger, #dc2626)' : done ? 'var(--success, #16a34a)' : active ? 'var(--primary)' : 'var(--text-3)'
        return (
          <li key={s.label} className="flex items-start gap-3" aria-current={active ? 'step' : undefined}>
            <span className="relative grid place-items-center w-5 h-5 rounded-full shrink-0 mt-0.5"
              style={{ border: `1.5px solid ${color}`, color }}>
              {done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} aria-hidden /></motion.span>}
              {isFailed && <X size={12} aria-hidden />}
              {active && <motion.span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.25 }}
                animate={{ scale: [1, 1.8], opacity: [0.35, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
            </span>
            <div className="min-w-0">
              <div className="text-[13px]" style={{ color: done || active || isFailed ? 'var(--text)' : 'var(--text-3)', fontWeight: active ? 600 : 400 }}>{s.label}</div>
              {s.detail && <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{s.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
