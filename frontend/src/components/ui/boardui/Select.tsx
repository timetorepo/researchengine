/* BoardUI select layout adaptation (MIT). Base UI replaces its React Aria dependency. */
import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { useMemo, type ReactNode, type CSSProperties } from 'react'
export interface BoardOption { value: string; label: string; disabled?: boolean; icon?: ReactNode; hint?: string }
export interface BoardSelectProps {
  options?: BoardOption[]; align?: 'left' | 'right'
  value: string; onChange: (e: { target: { value: string } }) => void; children?: ReactNode; disabled?: boolean
  className?: string; style?: CSSProperties; 'aria-label'?: string; title?: string; id?: string; placeholder?: string
}
export function BoardSelect({ value, onChange, children, disabled, className, style, placeholder, options: provided, align = 'left', ...rest }: BoardSelectProps) {
  const options = useMemo<BoardOption[]>(() => provided ?? readOptions(children), [children, provided])
  return <Select.Root value={value} onValueChange={(next) => { if (next !== null) onChange({ target: { value: next } }) }} disabled={disabled} items={options}>
    <Select.Trigger {...rest} className={`bui-button min-w-0 justify-between ${className ?? ''}`} style={style}>
      <span className="inline-flex min-w-0 items-center gap-2">{options.find((item) => item.value === value)?.icon}<Select.Value placeholder={placeholder} /></span><Select.Icon><ChevronDown size={14} /></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Positioner sideOffset={6} className="z-[220]" alignItemWithTrigger={false} align={align === 'right' ? 'end' : 'start'}>
      <Select.Popup className="bui-select-popup"><Select.List>{options.map((item) => <Select.Item key={item.value} value={item.value} disabled={item.disabled} className="bui-select-item"><span className="inline-flex items-center gap-2 min-w-0">{item.icon}<span><Select.ItemText>{item.label}</Select.ItemText>{item.hint && <span className="block text-[11px] text-[var(--text-3)]">{item.hint}</span>}</span></span><Select.ItemIndicator><Check size={14} /></Select.ItemIndicator></Select.Item>)}</Select.List></Select.Popup>
    </Select.Positioner></Select.Portal>
  </Select.Root>
}
import { Children, isValidElement } from 'react'
export function readOptions(children: ReactNode): { value: string; label: string; disabled?: boolean }[] {
  const out: { value: string; label: string; disabled?: boolean }[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string; disabled?: boolean }>(child)) return
    if (child.type === 'optgroup') { out.push(...readOptions(child.props.children)); return }
    if (child.type !== 'option') return
    const label = Children.toArray(child.props.children).join('')
    out.push({ value: String(child.props.value ?? label), label, disabled: child.props.disabled })
  })
  return out
}
