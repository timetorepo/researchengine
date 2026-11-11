import { Switch as HeroSwitch, Label } from '@heroui/react'

/**
 * App switch built on HeroUI v3 `Switch` (Root / Content / Control / Thumb) and `Label`.
 * Structure follows HeroUI: Content is the clickable part and wraps the control and label.
 * Colours come from the app's own CSS variables, so the global theme is unchanged.
 * The toggle takes the iOS proportions (51×31 at medium) and the green "on" state
 * from the Apple references in docs/design-references/ios26-notes.md. Same props as
 * the previous hand-rolled version, so existing callers keep working.
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
  // iOS proportions: 51×31 at medium, 40×24 at small. The knob is 2px inside the track.
  const w = size === 'sm' ? 40 : 51
  const h = size === 'sm' ? 24 : 31
  const knob = size === 'sm' ? 20 : 27
  const travel = w - knob - 4

  return (
    <HeroSwitch
      isSelected={checked}
      onChange={onChange}
      isDisabled={disabled}
      aria-label={label}
      className="flex w-full min-h-[44px] items-center py-1 data-[disabled=true]:opacity-50"
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
            background: checked ? 'var(--success, #34C759)' : 'color-mix(in srgb, var(--text) 16%, var(--elevated))',
            border: 'none',
          }}
        >
          <HeroSwitch.Thumb
            className="absolute rounded-full bg-white transition-transform duration-200"
            style={{
              width: knob, height: knob, top: (h - knob) / 2, left: 2,
              transform: `translateX(${checked ? travel : 0}px)`,
              boxShadow: '0 3px 8px rgba(0,0,0,0.28), 0 1px 1px rgba(0,0,0,0.12)',
            }}
          />
        </HeroSwitch.Control>
      </HeroSwitch.Content>
    </HeroSwitch>
  )
}
