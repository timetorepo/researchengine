import { Slider as GlassSlider } from 'glisse'
import type { InputHTMLAttributes } from 'react'
import { useLiquidGlass } from '@/lib/design/useLiquidGlass'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'> & {
  value: number; onValueChange: (value: number) => void; min?: number; max?: number; step?: number
}
/** Both implementations retain a real range input, including native keyboard increments. */
export function Slider({ value, onValueChange, ...props }: Props) {
  const glass = useLiquidGlass()
  return glass ? <GlassSlider {...props} value={value} onValueChange={onValueChange} />
    : <input {...props} type="range" value={value} onChange={event => onValueChange(event.currentTarget.valueAsNumber)} />
}
