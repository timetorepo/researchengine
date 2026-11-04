import { useState } from 'react'
import { InViewTitle } from '@/components/uiarc/in-view-title/in-view-title'
import { MagazineScroller } from '@/components/ui/magazine-scroller'
import { Eyebrow } from '@/components/site/Section'
import { SCREENS, TOUR_POINTS } from '@/data/screens'
import { cn } from '@/lib/utils'

/**
 * A tour of the shipped app. The posters are the four real screenshots; a
 * click on one (or on its chapter button) opens what it shows. The scroller
 * keeps no selection of its own, so the poster's accessible name is the key:
 * each one is labelled with the screenshot's description.
 */
export function Tour() {
  const [activeId, setActiveId] = useState(SCREENS[0].id)
  const active = SCREENS.find((s) => s.id === activeId) ?? SCREENS[0]
  const detail = TOUR_POINTS[active.id]

  const pickFromPoster = (e: React.MouseEvent<HTMLDivElement>) => {
    const label = (e.target as HTMLElement).closest('article')?.getAttribute('aria-label')
    const hit = SCREENS.find((s) => s.alt === label)
    if (hit) setActiveId(hit.id)
  }

  return (
    <section className="site-section scroll-mt-24" id="tour">
      <div className="site-shell">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>A tour</Eyebrow>
          <InViewTitle
            as="h2"
            variant="blur"
            text="One window, four kinds of work"
            className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold [text-wrap:balance]"
          />
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)] sm:text-base">
            Drag the posters, or press one to read what it does. These are the shipped app, not mockups.
          </p>
        </div>

        <div className="mt-12 -mx-4 sm:mx-0" onClickCapture={pickFromPoster}>
          <MagazineScroller
            images={SCREENS.map((s) => ({ src: s.src, alt: s.alt }))}
            height="min(62vh, 520px)"
            cardWidth={220}
            cardHeight={300}
          />
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
          <div role="group" aria-label="Chapters" className="flex flex-row flex-wrap gap-2 md:flex-col">
            {SCREENS.map((s, i) => {
              const on = s.id === active.id
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left text-[13.5px] transition-[transform,background,border-color] duration-150 active:scale-[0.98]',
                    on
                      ? 'border-[var(--primary)] bg-[var(--elevated)] font-semibold'
                      : 'border-[var(--surface-border)] bg-transparent text-[var(--text-2)] hover:bg-[var(--elevated)]',
                  )}
                >
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--surface)] text-[11px] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  {TOUR_POINTS[s.id]?.title}
                </button>
              )
            })}
          </div>

          <div className="panel p-6 sm:p-7" aria-live="polite">
            <div className="text-[12px] font-medium tracking-[0.14em] text-[var(--text-3)] uppercase">{detail?.title}</div>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--text)]">{active.caption}</p>
            <ul className="mt-5 space-y-3">
              {detail?.points.map((p) => (
                <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-[var(--text-2)]">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
