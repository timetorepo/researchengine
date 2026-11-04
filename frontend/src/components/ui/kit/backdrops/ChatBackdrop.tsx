/**
 * The chat's optional animated backdrop. It renders nothing unless the person
 * turned one on, and it never takes pointer events or sits above the text.
 */
import { useChatBackdrop } from './useChatBackdrop'
import { HalftoneFlow } from './HalftoneFlow'
import { RecursiveErosion } from './RecursiveErosion'

export function ChatBackdrop({ className = '' }: { className?: string }) {
  const [kind] = useChatBackdrop()
  if (kind === 'off') return null
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ opacity: 0.85 }}>
      {kind === 'halftone' ? <HalftoneFlow /> : <RecursiveErosion />}
    </div>
  )
}
