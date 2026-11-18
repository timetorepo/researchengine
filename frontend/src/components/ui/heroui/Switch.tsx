import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStore } from '@/stores/useStore'

/** Compact platform-like visual, native button keyboard behaviour, controlled state. */
export function Switch({ checked, onChange, label, description, size = 'md', disabled = false }: {
  checked: boolean; onChange: (value: boolean) => void; label?: string; description?: string; size?: 'sm' | 'md'; disabled?: boolean
}) {
  const id = useId()
  const systemReduced = useReducedMotion()
  const reduced = useStore((s) => s.settings.reduceMotion) || !!systemReduced
  return <div data-slot="switch" className="re-native-switch" data-size={size} data-reduced-motion={reduced} data-disabled={disabled}>
    {(label || description) && <div className="min-w-0 flex-1">
      {label && <label id={`${id}-label`} htmlFor={`${id}-control`} className="block text-[13px] font-medium cursor-pointer">{label}</label>}
      {description && <span id={`${id}-description`} className="block mt-0.5 text-[12px]" style={{ color: 'var(--text-2)' }}>{description}</span>}
    </div>}
    <button id={`${id}-control`} type="button" role="switch" aria-checked={checked} disabled={disabled}
      aria-labelledby={label ? `${id}-label` : undefined} aria-label={label ? undefined : 'Toggle setting'}
      aria-describedby={description ? `${id}-description` : undefined} data-slot="switch-control"
      onClick={() => onChange(!checked)}>
      <span data-slot="switch-thumb" aria-hidden="true" />
    </button>
  </div>
}
