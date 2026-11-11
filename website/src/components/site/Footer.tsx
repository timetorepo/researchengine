import { ArrowUp, Download, Github, HardDriveDownload, Heart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { RELEASES_URL, SOURCE_URL, VERSION, useStars } from '@/lib/release'
import { scrollToSection } from '@/lib/smooth-scroll'

/**
 * The footer: the biggest single piece of the page, because it is where a
 * visitor who has scrolled all the way down decides what to do next.
 *
 * Two rules it keeps:
 *
 *   • every link works. The in-page ones scroll to sections that exist, and the
 *     ones that leave the site point at files that are really in the repository
 *     (`src/data/links.ts` lists them and `scripts/site-test.mts` checks each one
 *     against this checkout) or at pages anyone can open;
 *   • it does not send a visitor to GitHub as the primary action. The repository
 *     is private while the app is in beta, so a stranger who follows a "star it"
 *     button lands on a 404 that is not their fault. The primary button here is
 *     the download; GitHub is offered as what it is, labelled.
 */
const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean; section?: string }[] }[] = [
  {
    title: 'The app',
    links: [
      { label: 'Ask it something', href: '#ask', section: 'ask' },
      { label: 'What it does', href: '#features', section: 'features' },
      { label: 'Your library', href: '#library', section: 'library' },
      { label: 'How it works', href: '#how', section: 'how' },
      { label: 'Look inside', href: '#look', section: 'look' },
      { label: 'The engine', href: '#backend', section: 'backend' },
      { label: 'Why it is free', href: '#compare', section: 'compare' },
      { label: 'Questions', href: '#faq', section: 'faq' },
      { label: 'Download', href: '#download', section: 'download' },
    ],
  },
  {
    title: 'Get it',
    links: [
      { label: `Version ${VERSION}`, href: '#download', section: 'download' },
      { label: 'Windows installer (.exe)', href: '#download', section: 'download' },
      { label: 'Linux package (.deb)', href: '#download', section: 'download' },
      { label: 'Linux AppImage', href: '#download', section: 'download' },
      { label: 'Portable builds', href: '#download', section: 'download' },
      { label: 'All releases on GitHub', href: RELEASES_URL, external: true },
    ],
  },
  {
    title: 'Read',
    links: [
      { label: 'Install guide', href: `${SOURCE_URL}/blob/main/docs/install.md`, external: true },
      { label: 'Developer docs', href: `${SOURCE_URL}/blob/main/docs/development.md`, external: true },
      { label: 'Design sources', href: `${SOURCE_URL}/blob/main/docs/design-sources.md`, external: true },
      { label: 'README', href: `${SOURCE_URL}#readme`, external: true },
      {
        label: 'Release notes',
        href: `${SOURCE_URL}/releases/tag/v${VERSION}`,
        external: true,
      },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'Source code', href: SOURCE_URL, external: true },
      { label: 'MIT licence', href: `${SOURCE_URL}/blob/main/LICENSE`, external: true },
      { label: 'Issues', href: `${SOURCE_URL}/issues`, external: true },
      { label: 'Releases', href: RELEASES_URL, external: true },
      { label: 'Made by dnishh', href: 'https://github.com/timetorepo', external: true },
    ],
  },
]

export function Footer() {
  const { count, live } = useStars()

  return (
    <footer className="relative overflow-hidden border-t border-[var(--surface-border)]">
      {/* The last call to action, at the top edge of the footer. */}
      <div className="site-shell">
        <div className="panel relative -mt-px flex flex-col gap-6 overflow-hidden p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[clamp(1.3rem,2.6vw,1.8rem)] leading-tight font-semibold">
              Get Research Engine {VERSION}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--text-2)]">
              One installer, no account, no email address. It runs on Windows 10/11 and on Linux, and everything you make
              in it stays in a folder on your own machine.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download') }} size="lg">
              <Download className="h-4.5 w-4.5" />
              Download for free
            </ButtonLink>
            <ButtonLink href={SOURCE_URL} rel="noreferrer" size="lg" target="_blank" variant="outline">
              <Github className="h-4.5 w-4.5" />
              Source on GitHub
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="site-shell pt-14">
        <div className="grid gap-12 pb-14 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <a
              className="flex items-center gap-3"
              href="#top"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('top')
              }}
            >
              <img alt="" className="h-10 w-10 rounded-xl ring-1 ring-white/10" height={40} src="/icon.svg" width={40} />
              <span className="text-[17px] font-semibold">Research Engine</span>
            </a>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-[var(--text-2)]">
              The open-source research app. Ask a question, get an answer with real sources, and keep every page, note,
              quiz and draft on your own computer.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge tone="green">Free, MIT licensed</Badge>
              <Badge>Version {VERSION}</Badge>
              {live && count > 0 ? (
                <Badge tone="brand">
                  <Star className="h-3 w-3" /> {count.toLocaleString()} on GitHub
                </Badge>
              ) : (
                <Badge>Source on GitHub</Badge>
              )}
            </div>

            <p className="mt-5 max-w-sm text-[12px] leading-relaxed text-[var(--text-3)]">
              The repository is private while the app is in beta. That is why there is no star count here yet: this page
              only shows numbers it can read.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="#download" onClick={(e) => { e.preventDefault(); scrollToSection('download') }} variant="outline">
                <HardDriveDownload className="h-4 w-4" />
                Download
              </ButtonLink>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--surface-border)] px-5 text-sm text-[var(--text-2)] transition-colors hover:text-foreground active:bg-white/10"
                onClick={() => scrollToSection('top')}
                type="button"
              >
                <ArrowUp className="h-4 w-4" />
                Back to top
              </button>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <div className="text-[12px] font-medium tracking-[0.16em] text-[var(--text-3)] uppercase">
                  {column.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
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
