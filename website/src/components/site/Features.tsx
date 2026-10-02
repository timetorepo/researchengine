import { motion } from 'motion/react'
import { TooltipCard } from '@/components/aceternity/TooltipCard'
import { Badge } from '@/components/ui/badge'
import { FEATURES, type Feature } from '@/data/features'
import { cn } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as const

/** The glossary strip: the tooltip card, on text, for the words a page like this throws around. */
const GLOSSARY = [
  {
    term: 'tokens',
    body: 'The unit AI providers bill in. Roughly three quarters of a word each. Every answer in the app reports how many it used, so a month of research never surprises you.',
  },
  {
    term: 'local model',
    body: 'An AI running on your own computer through Ollama or LM Studio. Slower than a big hosted model, private by definition, and free after the download.',
  },
  {
    term: 'citations',
    body: 'A numbered link back to the exact page a sentence came from. Click one in the app and the source opens beside the answer.',
  },
  {
    term: 'agent',
    body: 'An AI given a goal and a set of tools, allowed to work for several steps without being asked again. Agent Flood runs a squad of them at once.',
  },
  {
    term: 'MIT licence',
    body: 'The most permissive common open-source licence. Use it, change it, ship it, sell it, teach with it. Keep the copyright notice and you are done.',
  },
]

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  return (
    <motion.article
      className={cn(
        'panel group relative flex flex-col gap-3 p-6 transition-colors duration-300 hover:border-[rgba(124,92,255,0.35)]',
        feature.wide && 'lg:col-span-2',
      )}
      initial={{ opacity: 0, y: 22 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.55, ease: EASE }}
      viewport={{ once: true, margin: '-60px' }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[rgba(124,92,255,0.12)] text-[#c4b5fd] transition-transform duration-300 group-hover:-translate-y-0.5">
        {feature.icon}
      </div>
      <h3 className="text-[17px] font-medium">{feature.title}</h3>
      <p className="text-[14.5px] leading-relaxed text-[var(--text-2)]">{feature.body}</p>
      {feature.tag ? (
        <div className="mt-auto pt-2">
          <Badge tone="brand">{feature.tag}</Badge>
        </div>
      ) : null}
    </motion.article>
  )
}

export function Features() {
  return (
    <section className="site-section scroll-mt-24" id="features">
      <div className="site-shell">
        <motion.header
          className="max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: EASE }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 text-[12px] font-medium tracking-[0.18em] text-[var(--text-3)] uppercase">
            What it does
          </div>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold">
            A library, a study desk and a writing room in one window
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)] sm:text-base">
            Everything below is in the app today. It is made for people who think for a living: researchers, students,
            teachers, analysts, journalists and writers.
          </p>
        </motion.header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard feature={feature} index={index} key={feature.id} />
          ))}
        </div>

        <motion.div
          className="panel mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5, ease: EASE }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] leading-relaxed text-[var(--text-3)] sm:w-52 sm:shrink-0">
            Words this page uses, in plain English. Hover or focus one.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {GLOSSARY.map((entry) => (
              <TooltipCard
                data={{ title: entry.term, body: entry.body, source: 'Research Engine, glossary' }}
                key={entry.term}
              >
                <span className="cursor-help border-b border-dashed border-[var(--surface-border)] text-[14px] text-[var(--text-2)] transition-colors hover:text-foreground">
                  {entry.term}
                </span>
              </TooltipCard>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
