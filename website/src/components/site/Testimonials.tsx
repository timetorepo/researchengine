import InlineTestimonials from '@/components/smoothui/inline-testimonials'
import { Section } from '@/components/site/Section'
import { INSTAGRAM_PROFILES, TESTIMONIALS, TESTIMONIAL_TEXT } from '@/data/testimonials'

/**
 * SmoothUI's inline testimonials, with the quotes exactly as they arrived, and
 * a row under it that links to each person's Instagram profile.
 */
export function Testimonials() {
  return (
    <Section
      eyebrow="Early users"
      id="voices"
      lead="Three people were handed a build and asked to break it. Their words, not ours."
      title="What people said when they tried it"
    >
      <div className="panel mx-auto mt-12 max-w-3xl px-6 py-10 text-center sm:px-10">
        {/* The component brings its own paragraph and blockquote; wrapping it in
            another <p> would nest them, which the DOM does not allow. */}
        <div className="text-[clamp(1.05rem,2.4vw,1.5rem)] leading-relaxed [&_button]:font-semibold [&_button]:text-[#c4b5fd] [&_button]:underline [&_button]:decoration-dotted [&_button]:underline-offset-4">
          <InlineTestimonials avatarSize={26} testimonials={TESTIMONIALS} text={TESTIMONIAL_TEXT} />
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-3" aria-label="Instagram profiles">
          {INSTAGRAM_PROFILES.map((p) => {
            const person = TESTIMONIALS.find((t) => t.id === p.handle)
            return (
              <li key={p.handle}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full border border-[var(--surface-border)] bg-[var(--elevated)] py-1.5 pr-4 pl-1.5 text-[13.5px] font-medium transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  <img src={person?.avatar} alt="" width={28} height={28} className="size-7 rounded-full" loading="lazy" />
                  <span>@{p.handle}</span>
                  <span aria-hidden className="text-[var(--text-3)]">on Instagram ↗</span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}
