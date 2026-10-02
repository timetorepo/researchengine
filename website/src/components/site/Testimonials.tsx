import InlineTestimonials from '@/components/smoothui/inline-testimonials'
import { Section } from '@/components/site/Section'
import { TESTIMONIALS, TESTIMONIAL_TEXT } from '@/data/testimonials'

/**
 * SmoothUI's inline testimonials, with the quotes exactly as they arrived:
 * the names sit inside a sentence and the card opens on the name.
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
      </div>
    </Section>
  )
}
