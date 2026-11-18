import { SegmentedControl as GlassSegments } from 'glisse'
import { useLiquidGlass } from '@/lib/design/useLiquidGlass'
import { useId, type ReactNode } from 'react'
export interface Segment { value: string; label: ReactNode; disabled?: boolean }
/** Native radio inputs own arrow-key navigation and selection semantics. */
export function SegmentedControl({ items, value, onChange, label }: { items: Segment[]; value: string; onChange: (value: string) => void; label: string }) {
  const glass = useLiquidGlass()
  const name = useId()
  if (glass && !items.some(item => item.disabled)) return <GlassSegments aria-label={label} items={items} value={value} onValueChange={onChange} />
  return <div className="re-native-segments" role="radiogroup" aria-label={label}>
    {items.map((item) => <label key={item.value} className="re-native-segment" data-selected={value === item.value} data-disabled={item.disabled || undefined}>
      <input type="radio" name={name} value={item.value} checked={value === item.value} disabled={item.disabled} onChange={() => onChange(item.value)} />
      <span>{item.label}</span>
    </label>)}
  </div>
}
