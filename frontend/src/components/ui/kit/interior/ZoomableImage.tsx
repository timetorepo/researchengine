// A blur-up image that opens in the lightbox when clicked. Used wherever the
// app shows a picture the user may want to see bigger (chat, image lab).
import { useCallback, useState } from 'react'
import { BlurUpImage } from './BlurUpImage'
import { Lightbox } from './Lightbox'

export function ZoomableImage({ src, alt, className = '', style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <BlurUpImage src={src} alt={alt} className={`${className} cursor-zoom-in`} style={style} onClick={() => setOpen(true)} />
      <Lightbox src={open ? src : null} alt={alt} onClose={close} />
    </>
  )
}
