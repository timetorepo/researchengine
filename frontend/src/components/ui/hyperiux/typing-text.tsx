// Typing text: types a line out one character at a time, then holds, with a
// blinking caret. Used as a loading style in Settings → Flow ("Typing").
// Inspired by Hyperiux Vault's "Typing Text" on 21st.dev
// (https://21st.dev/@hyperiux/components/typing-text). Rebuilt here from its
// description; it is not a copy of the upstream source.
import { useEffect, useState } from 'react'

export function TypingText({
  text,
  speed = 38,
  className,
  style,
}: {
  text: string
  /** Milliseconds per character. */
  speed?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [count, setCount] = useState(reduce ? text.length : 0)

  useEffect(() => {
    if (reduce) { setCount(text.length); return }
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setCount(i)
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, reduce])

  return (
    <span className={className} style={style} aria-label={text} role="status">
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span aria-hidden="true" className="hyperiux-caret" style={{ display: 'inline-block', width: '0.08em', marginLeft: '0.08em', height: '1em', verticalAlign: '-0.12em', background: 'currentColor', animation: reduce ? 'none' : 'hyperiux-blink 1s steps(1) infinite' }} />
      <style>{'@keyframes hyperiux-blink{50%{opacity:0}}'}</style>
    </span>
  )
}
