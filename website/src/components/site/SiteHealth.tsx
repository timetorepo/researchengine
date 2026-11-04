import { useCallback, useEffect, useState } from 'react'
import { MetricCard } from '@/components/uiarc/metric-card/metric-card'
import { InViewTitle } from '@/components/uiarc/in-view-title/in-view-title'
import { Eyebrow } from '@/components/site/Section'

/**
 * SEO and load measurements of this very page, taken in the visitor's browser
 * when it opens and on demand. Nothing is sent anywhere: it reads the document
 * the search engine and the link-preview crawlers also read.
 */

const REQUIRED_OG = ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:url']

interface Measurements {
  titleLength: number
  descriptionLength: number
  ogPresent: number
  structuredBlocks: number
  imagesTotal: number
  imagesWithAlt: number
  h1Count: number
  loadMs: number
}

function measure(): Measurements {
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? ''
  const og = new Set(Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property]')).map((m) => m.getAttribute('property')))
  const structured = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')).filter((s) => {
    try { JSON.parse(s.textContent ?? ''); return true } catch { return false }
  })
  const images = Array.from(document.querySelectorAll('img'))
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return {
    titleLength: document.title.length,
    descriptionLength: description.length,
    ogPresent: REQUIRED_OG.filter((k) => og.has(k)).length,
    structuredBlocks: structured.length,
    imagesTotal: images.length,
    imagesWithAlt: images.filter((i) => i.hasAttribute('alt')).length,
    h1Count: document.querySelectorAll('h1').length,
    loadMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
  }
}

export function SiteHealth() {
  const [m, setM] = useState<Measurements | null>(null)
  const [runs, setRuns] = useState(0)

  const run = useCallback(() => {
    setM(measure())
    setRuns((r) => r + 1)
  }, [])

  // Measure after the page has settled, so the load number is the real one.
  useEffect(() => {
    const t = window.setTimeout(run, 400)
    return () => window.clearTimeout(t)
  }, [run])

  const altPct = m && m.imagesTotal ? Math.round((m.imagesWithAlt / m.imagesTotal) * 100) : 0
  const titleOk = !!m && m.titleLength >= 30 && m.titleLength <= 60
  const descOk = !!m && m.descriptionLength >= 70 && m.descriptionLength <= 160
  const passed = m ? [titleOk, descOk, m.ogPresent === REQUIRED_OG.length, m.structuredBlocks > 0, altPct === 100, m.h1Count === 1].filter(Boolean).length : 0

  return (
    <section className="site-section scroll-mt-24" id="health">
      <div className="site-shell">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Measured, not claimed</Eyebrow>
          <InViewTitle
            as="h2"
            variant="word"
            text="How this page reads to search and to link previews"
            className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold [text-wrap:balance]"
          />
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)] sm:text-base">
            These numbers are read from this page in your browser, now. Nothing is sent anywhere, and no tracking runs.
          </p>
        </div>

        {m ? (
          <>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Checks passing" value={passed} suffix={` of 6`} context="Title, description, social tags, structured data, image text and one heading." />
              <MetricCard label="Title length" value={m.titleLength} suffix=" chars" context="Search results show about 60 characters; 30 to 60 is the target." change={titleOk ? 'within target' : 'outside target'} />
              <MetricCard label="Description length" value={m.descriptionLength} suffix=" chars" context="The snippet under the link. 70 to 160 characters is the target." change={descOk ? 'within target' : 'outside target'} />
              <MetricCard label="Social tags" value={m.ogPresent} suffix={` of ${REQUIRED_OG.length}`} context="Open Graph tags that link previews read: type, name, title, description, image and URL." />
              <MetricCard label="Structured data" value={m.structuredBlocks} suffix=" blocks" context="JSON-LD blocks that describe the app and its publisher for search engines." />
              <MetricCard label="Images with alt text" value={altPct} suffix="%" context={`${m.imagesWithAlt} of ${m.imagesTotal} images are described for screen readers and search.`} />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[12.5px] text-[var(--text-3)]">
              <span>Page ready in {m.loadMs} ms in this browser</span>
              <span aria-hidden>·</span>
              <span>Measured {runs} time{runs === 1 ? '' : 's'}</span>
              <button
                type="button"
                onClick={run}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--elevated)] px-4 py-1.5 font-medium text-[var(--text)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97]"
              >
                Measure again
              </button>
            </div>
          </>
        ) : (
          <div className="mt-12 text-center text-[13px] text-[var(--text-3)]">Measuring this page…</div>
        )}
      </div>
    </section>
  )
}
