// Pixel text fill: a headline set in a pixel face, filled with a stepped colour
// sweep that moves across the letters. The face is Silkscreen, bundled through
// @fontsource so nothing is fetched at run time.
// Inspired by Hyperiux Vault's "Pixel Text Fill" on 21st.dev
// (https://21st.dev/@hyperiux/components/pixel-text-fill). Rebuilt here from its
// description; it is not a copy of the upstream source.
import '@fontsource/silkscreen/400.css'

export function PixelTextFill({ children, className, style }: { children: string; className?: string; style?: React.CSSProperties }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <>
      <span
        className={className}
        aria-label={children}
        style={{
          fontFamily: "'Silkscreen', var(--font-ui), monospace",
          letterSpacing: '0.04em',
          backgroundImage: 'linear-gradient(90deg, var(--primary), var(--secondary, var(--primary)), var(--success, var(--primary)), var(--primary))',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: reduce ? 'none' : 'hyperiux-pixel-sweep 4s steps(12) infinite',
          imageRendering: 'pixelated',
          ...style,
        }}
      >
        {children}
      </span>
      <style>{'@keyframes hyperiux-pixel-sweep{from{background-position:0% 0}to{background-position:-300% 0}}'}</style>
    </>
  )
}
