// Beui-style expanding arrow button: a compact arrow that opens to show its
// label and slides the arrow forward on hover or focus.
import { ArrowRight } from 'lucide-react'

export function ExpandingArrowButton({ label, onClick, type = 'button', disabled = false }: {
  label: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="group inline-flex items-center h-10 pl-4 pr-3 rounded-full text-[13px] font-medium transition-[padding] duration-300 disabled:opacity-50 hover:pr-4 focus-visible:pr-4"
      style={{ background: 'var(--primary)', color: '#fff' }}>
      <span>{label}</span>
      <span className="grid place-items-center w-6 h-6 ml-2 overflow-hidden">
        <ArrowRight size={15} aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5" />
      </span>
    </button>
  )
}
