// Scramble link button: on hover, the label scrambles through random glyphs and
// settles back. Colours come from the theme variables, so every theme gets its
// own accent, and the type uses the app's UI font.
// Inspired by Hyperiux Vault's "Scramble Link Button" on 21st.dev
// (https://21st.dev/@hyperiux/components/scramble-link-button). Rebuilt here from
// its description; it is not a copy of the upstream source.
import { useRef, useState, type AnchorHTMLAttributes } from 'react'

const GLYPHS = '!<>-_\\/[]{}—=+*^?#ABCDEFGHJKMNPQRSTUVWXYZ0123456789'

export function ScrambleLinkButton({
  children,
  href,
  onClick,
  ...rest
}: { children: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [label, setLabel] = useState(children)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scramble = () => {
    if (timer.current) clearInterval(timer.current)
    let frame = 0
    const total = children.length * 3
    timer.current = setInterval(() => {
      frame += 1
      const settled = Math.floor(frame / 3)
      setLabel(children.split('').map((ch, i) => (
        i < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      )).join(''))
      if (frame >= total) { if (timer.current) clearInterval(timer.current); setLabel(children) }
    }, 28)
  }

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={scramble}
      onFocus={scramble}
      {...rest}
      className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        fontFamily: 'var(--font-ui)',
        color: 'var(--primary)',
        background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
        fontVariantNumeric: 'tabular-nums',
        ...(rest.style ?? {}),
      }}
    >
      <span aria-label={children}>{label}</span>
      <span aria-hidden="true">→</span>
    </a>
  )
}
