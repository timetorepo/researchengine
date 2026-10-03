import { Github, Star } from 'lucide-react'
import GitHubStarsAnimation from '@/components/smoothui/github-stars-animation'
import { ButtonLink } from '@/components/ui/button'
import { SOURCE_URL, useStars, VERSION } from '@/lib/release'

/**
 * The stars band, using SmoothUI's github-stars-animation against the real
 * repository.
 *
 * The count comes from GitHub's own API in the visitor's browser, and when it
 * answers there is nothing this band can honestly claim about a star count. It
 * used to say "new on GitHub" and "be the first to star it", which asserts two
 * things the page cannot verify: that the project is new, and that nobody has
 * starred it. The repository is private while the app is in beta, so GitHub
 * reports no stars for it at all. What is left is what is true: the source is on
 * GitHub, the licence is MIT, and the count appears here by itself the day the
 * repository is public.
 */
export function StarsStrip() {
  const { count, stargazers, live, loading } = useStars()

  return (
    <section className="relative border-y border-[var(--surface-border)] bg-[rgba(255,255,255,0.015)] py-9">
      <div className="site-shell flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-5">
          {live && count > 0 ? (
            <GitHubStarsAnimation
              countClassName="text-[15px] text-foreground"
              maxAvatars={6}
              owner="timetorepo"
              repo="researchengine"
              starCount={count}
              stargazers={stargazers}
            />
          ) : (
            <div className="flex items-center gap-2.5 text-[15px] text-[var(--text-2)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--surface-border)] bg-white/5">
                <Star className="h-4 w-4 text-[#fbbf24]" />
              </span>
              {loading ? (
                <span className="inline-block h-5 w-40 animate-pulse rounded bg-white/10" />
              ) : (
                <span>Stars appear here, from GitHub, once the repository is public</span>
              )}
            </div>
          )}
        </div>

        <p className="max-w-md text-center text-[13.5px] leading-relaxed text-[var(--text-3)] sm:text-right">
          The repository is private while the app is in beta, so GitHub reports no stars for it yet, and this page will
          not invent a number. The code, the licence and the release notes are on GitHub; version {VERSION} is what this
          page offers.
        </p>

        <ButtonLink href={SOURCE_URL} rel="noreferrer" size="sm" target="_blank" variant="outline">
          <Github className="h-4 w-4" />
          Open the repository
        </ButtonLink>
      </div>
    </section>
  )
}
