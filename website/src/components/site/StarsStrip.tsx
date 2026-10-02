import { Github, Star } from 'lucide-react'
import GitHubStarsAnimation from '@/components/smoothui/github-stars-animation'
import { ButtonLink } from '@/components/ui/button'
import { SOURCE_URL, useStars, VERSION } from '@/lib/release'

/**
 * The stars band, using SmoothUI's github-stars-animation against the real
 * repository.
 *
 * The count comes from GitHub's own API in the visitor's browser. While the
 * repository is private that call answers 404, and the honest answer is to say
 * so rather than to animate a number nobody can verify: the band changes its
 * copy and still lets you star it. The moment the repository is public, the
 * avatars and the count appear with no code change.
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
                <span>
                  {count > 0 ? `${count.toLocaleString()} stars` : 'New on GitHub, and the first star is still free'}
                </span>
              )}
            </div>
          )}
        </div>

        <p className="max-w-md text-center text-[13.5px] leading-relaxed text-[var(--text-3)] sm:text-right">
          Open source, developed in the open. Version {VERSION} is what this page offers, and every release is built by
          the same workflow you can read.
        </p>

        <ButtonLink href={SOURCE_URL} rel="noreferrer" size="sm" target="_blank" variant="outline">
          <Github className="h-4 w-4" />
          Star it on GitHub
        </ButtonLink>
      </div>
    </section>
  )
}
