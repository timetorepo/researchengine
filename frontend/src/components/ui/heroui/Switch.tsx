import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { Toggle } from '@/components/ui/bencho/liq-toggle/Toggle'
import '@/components/ui/bencho/liq-toggle/Toggle.css'
import { useStore } from '@/stores/useStore'

/** Shared accessible settings contract; Bencho's MIT droplet replaces the visual track. */
export function Switch({ checked, onChange, label, description, size = 'md', disabled = false }: {
  checked: boolean; onChange: (value: boolean) => void; label?: string; description?: string; size?: 'sm' | 'md'; disabled?: boolean
}) {
  const id = useId()
  const systemReduced = useReducedMotion()
  const preference = useStore((s) => s.settings.reduceMotion)
  return <div data-slot="switch" className={`re-bencho re-liquid-switch flex w-full min-h-[44px] items-center justify-between gap-4 py-2 ${disabled ? 'opacity-50' : ''}`} data-size={size}>
    {(label || description) && <div className="min-w-0 flex-1">
      {label && <label id={`${id}-label`} htmlFor={`${id}-control`} className="block text-[13.5px] font-medium cursor-pointer" onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!checked) }}>{label}</label>}
      {description && <span id={`${id}-description`} className="block mt-0.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>{description}</span>}
    </div>}
    <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} labelledBy={label ? `${id}-label` : undefined} describedBy={description ? `${id}-description` : undefined} reduced={preference || !!systemReduced} />
  </div>
}
