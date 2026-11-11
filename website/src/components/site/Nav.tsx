import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, Github, Menu, Star, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { useStars, RELEASES_URL, SOURCE_URL, VERSION } from '@/lib/release'
import { scrollToSection } from '@/lib/smooth-scroll'
import { cn } from '@/lib/utils'

const LINKS = [
  { id: 'ask', label: 'Ask it something' },
  { id: 'features', label: 'What it does' },
  { id: 'library', label: 'Your library' },
  { id: 'how', label: 'How it works' },
  { id: 'compare', label: 'Why it is free' },
  { id: 'faq', label: 'Questions' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const stars = useStars()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault()
    setOpen(false)
    scrollToSection(id)
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-[var(--surface-border)] bg-[rgba(7,6,12,0.72)] backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="site-shell flex h-[68px] items-center justify-between gap-4">
        <a className="group flex items-center gap-2.5" href="#top" onClick={go('top')}>
          <img alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/10" height={32} src="/icon.svg" width={32} />
          <span className="text-[15px] font-semibold tracking-tight">
            Research<span className="text-[var(--text-3)] group-hover:text-[var(--text-2)]">Engine</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.id}
              className="site-link-underline text-[13.5px] text-[var(--text-2)] transition-colors hover:text-foreground"
              href={`#${link.id}`}
              onClick={go(link.id)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            className="hidden items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/5 px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors hover:bg-white/10 hover:text-foreground sm:inline-flex"
            href={SOURCE_URL}
            rel="noreferrer"
            target="_blank"
            title="The source, on GitHub. Private while the app is in beta."
          >
            {/* A gold star means a number the page actually read from GitHub. When
                there is none, the pill says what is true instead: the source is
                on GitHub. */}
            {stars.live && !stars.loading ? (
              <>
                <Star className="h-3.5 w-3.5 fill-current text-[#fbbf24]" />
                <span className="tabular-nums">{stars.count.toLocaleString()}</span>
              </>
            ) : (
              <>
                <Github className="h-3.5 w-3.5" />
                <span>{stars.loading ? 'Source' : 'Source on GitHub'}</span>
              </>
            )}
          </a>
          <ButtonLink href="#download" onClick={go('download')} size="sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Get it</span>
          </ButtonLink>
          <button
            aria-expanded={open}
            aria-label={open ? 'Close the menu' : 'Open the menu'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-2)] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden border-t border-[var(--surface-border)] bg-[rgba(7,6,12,0.96)] backdrop-blur-xl lg:hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="site-shell flex flex-col divide-y divide-[var(--surface-border)] py-2">
              {LINKS.map((link) => (
                <a
                  key={link.id}
                  className="py-3 text-sm text-[var(--text-2)]"
                  href={`#${link.id}`}
                  onClick={go(link.id)}
                >
                  {link.label}
                </a>
              ))}
              <a className="py-3 text-sm text-[var(--text-2)]" href={RELEASES_URL} rel="noreferrer" target="_blank">
                Releases <span className="text-[var(--text-3)]">({VERSION})</span>
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
