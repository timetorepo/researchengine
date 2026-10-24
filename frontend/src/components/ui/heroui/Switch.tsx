import { Switch as HeroSwitch, Label } from '@heroui/react'

/**
 * App switch built on HeroUI v3 `Switch` (Root / Content / Control / Thumb) and `Label`.
 * Structure follows HeroUI: Content is the clickable part and wraps the control and label.
 * Colours come from the app's own CSS variables, so the global theme is unchanged.
 * Same props as the previous hand-rolled version, so existing callers keep working.
 */
export function Switch({
  checked, onChange, label, description, size = 'md', disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  description?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const knob = size === 'sm' ? 16 : 20
  const travel = w - knob - 4

  return (
    <HeroSwitch
      isSelected={checked}
      onChange={onChange}
      isDisabled={disabled}
      aria-label={label}
      className="flex w-full items-center py-1 data-[disabled=true]:opacity-50"
    >
      <HeroSwitch.Content className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-4 text-left">
        {(label || description) && (
          <span className="min-w-0">
            {label && <Label className="block text-[13.5px] font-medium">{label}</Label>}
            {description && (
              <span className="mt-0.5 block text-[11.5px]" style={{ color: 'var(--text-3)' }}>{description}</span>
            )}
          </span>
        )}
        <HeroSwitch.Control
          className="relative shrink-0 rounded-full transition-colors"
          style={{
            width: w, height: h,
            background: checked ? 'var(--primary)' : 'var(--elevated)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <HeroSwitch.Thumb
            className="absolute rounded-full bg-white transition-transform duration-200"
            style={{
              width: knob, height: knob, top: (h - knob) / 2 - 1, left: 1,
              transform: `translateX(${checked ? travel : 0}px)`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          />
        </HeroSwitch.Control>
      </HeroSwitch.Content>
    </HeroSwitch>
  )
}
