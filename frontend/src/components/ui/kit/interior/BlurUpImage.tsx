// Interior-style blur-up image: a soft, blurred placeholder shows while the
// real image loads, then sharpens into place.
import { useState } from 'react'

export function BlurUpImage({ src, alt, className = '', style, onClick }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties; onClick?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onClick={onClick}
      className={`${className} transition-[filter,opacity] duration-500`}
      style={{ ...style, filter: loaded ? 'blur(0px)' : 'blur(14px)', opacity: loaded ? 1 : 0.6, transform: loaded ? 'none' : 'scale(1.02)' }} />
  )
}
