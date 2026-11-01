import { useEffect } from 'react'
import { AskSection } from '@/components/site/AskSection'
import { BackgroundFX } from '@/components/site/BackgroundFX'
import { GalleryProvider } from '@/components/site/ScreenshotGallery'
import { Backend } from '@/components/site/Backend'
import { Compare } from '@/components/site/Compare'
import { DownloadSection } from '@/components/site/DownloadSection'
import { Faq } from '@/components/site/Faq'
import { Features } from '@/components/site/Features'
import { Footer } from '@/components/site/Footer'
import { Hero } from '@/components/site/Hero'
import { HowItWorks } from '@/components/site/HowItWorks'
import { LibrarySection } from '@/components/site/LibrarySection'
import { Nav } from '@/components/site/Nav'
import { Showcase } from '@/components/site/Showcase'
import { SiteHealth } from '@/components/site/SiteHealth'
import { StarsStrip } from '@/components/site/StarsStrip'
import { Tour } from '@/components/site/Tour'
import { Testimonials } from '@/components/site/Testimonials'
import { destroySmoothScroll, initSmoothScroll } from '@/lib/smooth-scroll'

/**
 * The site, in the order a visitor reads it: what it is, that it is real, what
 * it does, what it looks like, where your files go, how to start, what people
 * said, why it is free, and the download.
 */
export default function App() {
  useEffect(() => {
    initSmoothScroll()
    return () => destroySmoothScroll()
  }, [])

  return (
    <GalleryProvider>
      <BackgroundFX />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <AskSection />
          <StarsStrip />
          <Features />
          <Tour />
          <Showcase />
          <Backend />
          <LibrarySection />
          <HowItWorks />
          <Testimonials />
          <Compare />
          <Faq />
          <SiteHealth />
          <DownloadSection />
        </main>
        <Footer />
      </div>
    </GalleryProvider>
  )
}
