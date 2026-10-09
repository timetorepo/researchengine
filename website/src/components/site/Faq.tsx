import BasicAccordion from '@/components/smoothui/basic-accordion'
import { Section } from '@/components/site/Section'
import { FAQS } from '@/data/faqs'
import { SOURCE_URL } from '@/lib/release'

/**
 * The FAQ, on SmoothUI's accordion. The questions are the ones this project has
 * actually been asked, and the answers match the README word for word in the
 * places where a wrong answer would matter (data location, updates, platforms).
 */
export function Faq() {
  return (
    <Section
      eyebrow="Questions"
      id="faq"
      lead="Short answers to the things people ask before they install anything. The longer versions live in the repository's README."
      title="Questions people ask first"
    >
      <div className="mx-auto mt-12 max-w-3xl">
        <BasicAccordion
          allowMultiple
          items={FAQS.map((faq) => ({ id: faq.id, title: faq.title, content: faq.content }))}
        />
        <p className="mt-6 text-center text-[13px] text-[var(--text-3)]">
          Something still unclear?{' '}
          <a
            className="site-link-underline text-[var(--text-2)]"
            href={`${SOURCE_URL}/issues`}
            rel="noreferrer"
            target="_blank"
          >
            Open an issue
          </a>{' '}
          and the answer stays in public where the next person can find it.
        </p>
      </div>
    </Section>
  )
}
