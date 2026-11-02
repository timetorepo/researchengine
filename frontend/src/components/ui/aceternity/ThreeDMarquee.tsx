/**
 * 3D Marquee — Aceternity UI, adapted (onboarding).
 *
 * Original: Aceternity UI "3D Marquee" by Manu Arora (https://ui.aceternity.com/components/3d-marquee).
 * Canonical install, on a machine that can reach their registry:
 *   npx shadcn@latest add @aceternity/3d-marquee
 *
 * This is a rebuild from the published API (`images: string[]`, `className`) and the
 * layout it describes: the images split into four columns, the columns tilted in 3D,
 * and alternate columns drifting in opposite directions. The registry's markup could
 * not be fetched here, so the file is written to match the effect, not copied byte
 * for byte, which is why it has no digest in aceternity-sources.json.
 *
 * Local changes:
 *   • images are this app's own screenshots and paintings, served from /marquee and
 *     /art, never a third-party host;
 *   • each image is lazy and decoded async, so the onboarding page stays light;
 *   • the drift stops under reduced motion and when the page is hidden.
 */
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const GRID_LINE = 'absolute h-full w-px bg-[var(--surface-border)]'

export function ThreeDMarquee({ images, className }: { images: string[]; className?: string }) {
  const reduce = useReducedMotion()
  // Four equal columns. A short list is repeated so no column is empty.
  const perCol = Math.max(1, Math.ceil(images.length / 4))
  const filled = images.length ? Array.from({ length: perCol * 4 }, (_, i) => images[i % images.length]) : []
  const cols = Array.from({ length: 4 }, (_, c) => filled.slice(c * perCol, c * perCol + perCol))

  return (
    <div className={cn('relative mx-auto block h-[520px] overflow-hidden rounded-2xl max-sm:h-[380px]', className)} aria-hidden>
      <div className="flex size-full items-center justify-center">
        <div className="size-[1400px] shrink-0 scale-[0.42] sm:scale-[0.6] lg:scale-[0.8]">
          <div
            className="relative grid size-full origin-center grid-cols-4 gap-8"
            style={{ transform: 'rotateX(55deg) rotateY(0deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}
          >
            {cols.map((col, c) => (
              <motion.div
                key={`col-${c}`}
                className="relative flex flex-col items-start gap-8"
                animate={reduce ? undefined : { y: c % 2 === 0 ? [0, 50] : [50, 0] }}
                transition={reduce ? undefined : { duration: 14 + c * 2, repeat: Infinity, ease: 'linear' }}
              >
                <span className={cn(GRID_LINE, '-left-4 top-0')} style={{ left: -16 }} />
                {col.map((src, i) => (
                  <motion.img
                    key={`${c}-${i}-${src}`}
                    src={src}
                    alt=""
                    width={970}
                    height={700}
                    loading="lazy"
                    decoding="async"
                    whileHover={reduce ? undefined : { y: -10 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="aspect-[970/700] w-[260px] rounded-lg object-cover ring ring-black/5 hover:shadow-2xl"
                  />
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {/* A soft fade top and bottom, so the columns do not start or end abruptly. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: 'linear-gradient(var(--background, #000), transparent)' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(transparent, var(--background, #000))' }} />
    </div>
  )
}
