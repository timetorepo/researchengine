import { Github, Heart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { RELEASES_URL, SOURCE_URL, VERSION, useStars } from '@/lib/release'
import { scrollToSection } from '@/lib/smooth-scroll'

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean; section?: string }[] }[] = [
  {
    title: 'The app',
    links: [
      { label: 'What it does', href: '#features', section: 'features' },
      { label: 'Your library', href: '#library', section: 'library' },
      { label: 'How it works', href: '#how', section: 'how' },
      { label: 'Why it is free', href: '#compare', section: 'compare' },
      { label: 'Download', href: '#download', section: 'download' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'Source code', href: SOURCE_URL, external: true },
      { label: 'All releases', href: RELEASES_URL, external: true },
      { label: 'Install guide', href: `${SOURCE_URL}/blob/main/docs/install.md`, external: true },
      { label: 'Developer docs', href: `${SOURCE_URL}/blob/main/docs/development.md`, external: true },
      { label: 'Release notes', href: `${SOURCE_URL}/releases/tag/v${VERSION}`, external: true },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT licence', href: `${SOURCE_URL}/blob/main/LICENSE`, external: true },
      { label: 'Issues', href: `${SOURCE_URL}/issues`, external: true },
      { label: 'Contributing', href: `${SOURCE_URL}/blob/main/CONTRIBUTING.md`, external: true },
      { label: 'Made by dnishh', href: 'https://github.com/timetorepo', external: true },
    ],
  },
]

/**
 * The footer. The wordmark is the point: a visitor who scrolls to the bottom
 * should see the product's name, spelled out, at the size it deserves.
 */
export function Footer() {
  const stars = useStars()

  return (
    <footer className="relative overflow-hidden border-t border-[var(--surface-border)] pt-16">
      <div className="site-shell">
        <div className="grid gap-12 pb-14 lg:grid-cols-[1.1fr_1.4fr]">
          <div>
            <a className="flex items-center gap-3" href="#top" onClick={(e) => { e.preventDefault(); scrollToSection('top') }}>
              <img alt="" className="h-10 w-10 rounded-xl ring-1 ring-white/10" height={40} src="/icon.svg" width={40} />
              <span className="text-[17px] font-semibold">Research Engine</span>
            </a>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-[var(--text-2)]">
              The open-source research app. Ask a question, get an answer with real sources, and keep every page, note,
              quiz and draft on your own computer.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge tone="green">Free, MIT licensed</Badge>
              <Badge>Version {VERSION}</Badge>
              {stars.live && stars.count > 0 ? (
                <Badge tone="brand">
                  <Star className="h-3 w-3" /> {stars.count.toLocaleString()} on GitHub
                </Badge>
              ) : null}
            </div>
            <ButtonLink className="mt-7" href={SOURCE_URL} rel="noreferrer" target="_blank" variant="outline">
              <Github className="h-4 w-4" />
              Star the repository
            </ButtonLink>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <div className="text-[12px] font-medium tracking-[0.16em] text-[var(--text-3)] uppercase">
                  {column.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        className="site-link-underline text-[13.5px] text-[var(--text-2)] transition-colors hover:text-foreground"
                        href={link.href}
                        onClick={
                          link.section
                            ? (event) => {
                                event.preventDefault()
                                scrollToSection(link.section as string)
                              }
                            : undefined
                        }
                        {...(link.external ? { rel: 'noreferrer', target: '_blank' } : {})}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-[var(--surface-border)] py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[12.5px] text-[var(--text-3)]">
            © {new Date().getFullYear()} Research Engine, MIT licensed. No trackers on this page: no analytics, no
            cookies, no fonts fetched from anyone else.
          </p>
          <p className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)]">
            Built with <Heart className="h-3.5 w-3.5 text-[#fb7185]" /> by dnishh
          </p>
        </div>

        {/* The name, at the size it deserves. */}
        <div aria-hidden className="pointer-events-none select-none pb-4">
          <div className="text-center text-[clamp(2.6rem,13.5vw,11rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.14)]">
            ResearchEngine
          </div>
        </div>
        <div className="sr-only">Research Engine</div>
      </div>
    </footer>
  )
}
