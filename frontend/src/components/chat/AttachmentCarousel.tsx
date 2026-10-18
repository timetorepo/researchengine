/**
 * The photos you sent with one message, one at a time. Used when there are two
 * or more, so a message with six screenshots does not stack six full-size
 * images above the chat. Arrows and dots move between them; the caption says
 * which one this is.
 */
import { Carousel } from '@/components/ui/untitledui/carousel-base'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function AttachmentCarousel({ images }: { images: { name: string; dataUrl: string }[] }) {
  return (
    <div className="relative w-full max-w-[min(420px,100%)]" data-ui="attachment-carousel">
      <Carousel.Root opts={{ align: 'start', loop: false }} aria-label={`${images.length} photos you sent`}>
        <Carousel.Content>
          {images.map((img, i) => (
            <Carousel.Item key={`${img.name}-${i}`}>
              <figure className="m-0">
                <img src={img.dataUrl} alt={img.name} title={img.name}
                  className="w-full max-h-[280px] object-contain rounded-[12px] bg-black/5"
                  style={{ border: '1px solid var(--surface-border)' }} />
                <figcaption className="mt-1.5 text-[11px] truncate" style={{ color: 'var(--text-3)' }}>
                  {i + 1} of {images.length} · {img.name}
                </figcaption>
              </figure>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <div className="flex items-center justify-between gap-2 mt-2">
          <Carousel.PrevTrigger className="p-1.5 rounded-full disabled:opacity-30" style={{ background: 'var(--elevated)' }}>
            <ChevronLeft size={14} />
          </Carousel.PrevTrigger>
          <Carousel.IndicatorGroup className="flex items-center gap-1.5">
            {images.map((_, i) => (
              <Carousel.Indicator key={i} index={i}
                className={({ isSelected }) => `h-1.5 rounded-full transition-all ${isSelected ? 'w-4' : 'w-1.5 opacity-50'}`}
                style={{ background: 'var(--primary)' }} />
            ))}
          </Carousel.IndicatorGroup>
          <Carousel.NextTrigger className="p-1.5 rounded-full disabled:opacity-30" style={{ background: 'var(--elevated)' }}>
            <ChevronRight size={14} />
          </Carousel.NextTrigger>
        </div>
      </Carousel.Root>
    </div>
  )
}
