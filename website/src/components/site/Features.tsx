import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { FileText, Mic, ShieldCheck } from 'lucide-react'
import { FeaturesBento, type BentoCell } from '@/components/aceternity/FeaturesSection'
import { TooltipCard } from '@/components/aceternity/TooltipCard'
import { Reveal, SectionHeading } from '@/components/site/Section'
import { FEATURES, FEATURE_KINDS, type FeatureKind } from '@/data/features'
import { cn } from '@/lib/utils'

/**
 * What it does.
 *
 * Two halves, doing two jobs. The top half is Aceternity's features-section
 * bento: four unequal cells, three of them holding a real screenshot of the app,
 * because the pictures argue better than adjectives do. The bottom half is a
 * plain list of everything else, filtered by shelf, with no cards at all: a
 * grid of fourteen identical boxes is what makes a page look generated, and the
 * copy underneath it is good enough to be read as prose.
 */

const PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Groq',
  'Mistral',
  'xAI',
  'DeepSeek',
  'Kimi',
  'GLM',
  'MiniMax',
  'NVIDIA',
  'OpenRouter',
  'Together',
  'Inception',
  'Ollama',
  'LM Studio',
]

/** A screenshot in a quiet frame: the same window chrome the app uses. */
function ShotFrame({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[#0b0913] shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--surface-border)] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-white/15" />
        <span className="h-2 w-2 rounded-full bg-white/15" />
        <span className="h-2 w-2 rounded-full bg-white/15" />
      </div>
      <img alt={alt} className="block w-full" loading="lazy" src={src} />
    </div>
  )
}

const CELLS: BentoCell[] = [
  {
    id: 'answers',
    title: 'Ask a question, get an answer with sources you can open',
    body: 'Every claim carries a numbered link back to the page it came from. You can also tell it to answer only from one document, or only from your own notes.',
    className: 'lg:col-span-4 lg:border-r',
    skeleton: (
      <div className="mt-2">
        <ShotFrame
          alt="A Research Engine answer with its numbered sources listed beside it"
          src="/shots/shot-1.webp"
        />
        <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[var(--text-3)]">
          {['1 Wikipedia', '2 Your library', '3 Saved page'].map((chip) => (
            <span className="rounded-full border border-[var(--surface-border)] bg-white/5 px-2.5 py-1" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'library',
    title: 'A library that is yours',
    body: 'PDF, Word, text and Markdown, read in place and searchable. Nothing is uploaded anywhere.',
    className: 'lg:col-span-2',
    skeleton: (
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {[
          { label: 'PDF', note: 'papers' },
          { label: 'DOCX', note: 'Word files' },
          { label: 'MD', note: 'notes, vaults' },
          { label: 'TXT', note: 'transcripts' },
        ].map((file) => (
          <div
            className="rounded-lg border border-[var(--surface-border)] bg-white/[0.03] p-3 transition-colors hover:border-[rgba(124,92,255,0.35)]"
            key={file.label}
          >
            <FileText className="h-4 w-4 text-[#c4b5fd]" />
            <div className="mt-2 text-[13px] font-medium">{file.label}</div>
            <div className="text-[11px] text-[var(--text-3)]">{file.note}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'read-quiz',
    title: 'Turn a paper into a study session',
    body: 'A clean reading view, a summary, and a quiz built from the actual text: multiple choice, true or false, fill in the blank, order it, match the pairs.',
    className: 'lg:col-span-3 lg:border-r lg:border-t',
    skeleton: (
      <div className="mt-2">
        <ShotFrame alt="Reading a document in Research Engine with the study tools beside it" src="/shots/shot-2.webp" />
      </div>
    ),
  },
  {
    id: 'providers',
    title: 'Bring the AI you already pay for, or none at all',
    body: 'Seventeen providers are built in, plus models on your own machine, plus a custom slot for anything else. Free routing sends each question to a free model first.',
    className: 'lg:col-span-3 lg:border-t',
    skeleton: (
      <div className="mt-4">
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map((name) => (
            <span
              className="rounded-md border border-[var(--surface-border)] bg-white/[0.03] px-2 py-1 text-[11.5px] text-[var(--text-2)]"
              key={name}
            >
              {name}
            </span>
          ))}
          <span className="rounded-md border border-[rgba(124,92,255,0.35)] bg-[rgba(124,92,255,0.12)] px-2 py-1 text-[11.5px] text-[#c4b5fd]">
            + your own
          </span>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-3)]">
          Keys are encrypted on your machine. A local model through Ollama or LM Studio needs no key at all.
        </p>
      </div>
    ),
  },
]

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

/** The four cells that are drawn in the bento, so the list below does not repeat them. */
const IN_BENTO = new Set(CELLS.map((cell) => cell.id))

export function Features() {
  const [filter, setFilter] = useState<'All' | FeatureKind>('All')
  const reduced = useReducedMotion()

  const listed = FEATURES.filter((feature) => !IN_BENTO.has(feature.id)).filter(
    (feature) => filter === 'All' || feature.kind === filter,
  )

  return (
    <section className="site-section scroll-mt-24" id="features">
      <div className="site-shell">
        <SectionHeading
          eyebrow="What it does"
          lead="Every line below is something the shipped build does today, written for the person who will use it rather than the person who built it."
          title="A library, a study desk and a writing room in one window"
        />

        <FeaturesBento cells={CELLS} />

        <Reveal className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="text-[17px] font-medium">And the rest of it</h3>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter features by what you are doing">
              {(['All', ...FEATURE_KINDS] as const).map((kind) => {
                const active = filter === kind
                const count =
                  kind === 'All'
                    ? FEATURES.filter((f) => !IN_BENTO.has(f.id)).length
                    : FEATURES.filter((f) => !IN_BENTO.has(f.id) && f.kind === kind).length
                if (count === 0) return null
                return (
                  <button
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[12.5px] transition-colors',
                      active
                        ? 'border-[rgba(124,92,255,0.45)] bg-[rgba(124,92,255,0.16)] text-foreground'
                        : 'border-[var(--surface-border)] text-[var(--text-2)] hover:border-[rgba(124,92,255,0.3)] hover:text-foreground',
                    )}
                    key={kind}
                    onClick={() => setFilter(kind)}
                    type="button"
                  >
                    {kind}
                    <span className="ml-1.5 text-[11px] text-[var(--text-3)]">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <ul className="mt-7 divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)]">
            {listed.map((feature, index) => (
              <motion.li
                animate={{ opacity: 1 }}
                className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[minmax(0,15rem)_1fr]"
                initial={{ opacity: 0 }}
                key={feature.id}
                transition={{ delay: reduced ? 0 : Math.min(index * 0.03, 0.24), duration: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-white/[0.03] text-[#c4b5fd]">
                    {feature.icon}
                  </span>
                  <div className="text-[15px] font-medium">{feature.title}</div>
                </div>
                <div>
                  <p className="text-[14.5px] leading-relaxed text-[var(--text-2)]">{feature.body}</p>
                  {feature.tag ? (
                    <p className="mt-2 text-[12.5px] text-[var(--text-3)]">{feature.tag}</p>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-10">
          <div className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
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
          </div>
        </Reveal>

        <Reveal className="mt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[var(--text-3)]">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> No account, no telemetry, no analytics
            </span>
            <span className="inline-flex items-center gap-2">
              <Mic className="h-3.5 w-3.5" /> Dictation with three engines, one of them offline
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
