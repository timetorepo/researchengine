import { useId, type ReactNode } from 'react'
export interface Segment { value: string; label: ReactNode; disabled?: boolean }
/** Native radio inputs own arrow-key navigation and selection semantics. */
export function SegmentedControl({ items, value, onChange, label }: { items: Segment[]; value: string; onChange: (value: string) => void; label: string }) {
  const name = useId()
  return <div className="re-native-segments" role="radiogroup" aria-label={label}>
    {items.map((item) => <label key={item.value} className="re-native-segment" data-selected={value === item.value} data-disabled={item.disabled || undefined}>
      <input type="radio" name={name} value={item.value} checked={value === item.value} disabled={item.disabled} onChange={() => onChange(item.value)} />
      <span>{item.label}</span>
    </label>)}
  </div>
}
