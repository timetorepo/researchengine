import { RE_SYMBOL_PATH, RE_SYMBOL_VIEWBOX } from '@/lib/brand'
export function BrandMark({ size = 24, label }: { size?: number; label?: string }) {
  return <svg width={size} height={size} viewBox={RE_SYMBOL_VIEWBOX} fill="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <path d={RE_SYMBOL_PATH} fill="var(--primary)" />
  </svg>
}
