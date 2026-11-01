// Beui-style streaming response: text arrives in tokens and each new word fades
// up as it lands. Settled text is plain; only the newest words animate.
import { useMemo, useRef } from 'react'

export function StreamingResponse({ text, streaming, className = '' }: { text: string; streaming: boolean; className?: string }) {
  const seen = useRef(0)
  const words = useMemo(() => text.split(/(\s+)/), [text])
  const fresh = streaming ? Math.max(0, words.length - seen.current) : 0
  const freshFrom = words.length - fresh
  seen.current = words.length
  return (
    <p className={`whitespace-pre-wrap leading-relaxed text-[13.5px] ${className}`} style={{ color: 'var(--text)' }} aria-live="polite">
      {words.map((w, i) => (
        i >= freshFrom && w.trim() ? (
          <span key={i} className="inline-block" style={{ animation: 'se-fade-up 260ms ease-out both' }}>{w}</span>
        ) : <span key={i}>{w}</span>
      ))}
      {streaming && <span aria-hidden className="inline-block w-[2px] h-[1em] align-[-0.15em] ml-0.5 animate-pulse" style={{ background: 'var(--primary)' }} />}
      <style>{`@keyframes se-fade-up { from { opacity: 0; transform: translateY(3px); filter: blur(3px) } to { opacity: 1; transform: none; filter: none } }`}</style>
    </p>
  )
}
