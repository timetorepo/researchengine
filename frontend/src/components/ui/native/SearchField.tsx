import { SearchField as GlassSearchField } from 'glisse'
import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { useLiquidGlass } from '@/lib/design/useLiquidGlass'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value: string; onValueChange: (value: string) => void
}
export function SearchField({ value, onValueChange, className = '', ...props }: Props) {
  const glass = useLiquidGlass()
  if (glass) return <GlassSearchField {...props} className={className} value={value} onValueChange={onValueChange} />
  return <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
    <input {...props} type="search" className={`bui-field w-full ${className}`} style={{ paddingInlineStart: 36, ...props.style }} value={value} onChange={event => onValueChange(event.currentTarget.value)} />
  </div>
}
