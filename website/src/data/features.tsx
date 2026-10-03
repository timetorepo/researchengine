/**
 * The features section, in the words the README uses for the same features.
 *
 * Two rules this list keeps: every card is something the app actually does
 * today (nothing on this page is a roadmap), and each one is written for a
 * person who does not care how it is built. Terms that need unpacking carry a
 * glossary tooltip, which is what the Aceternity tooltip card is here for.
 */
import type { ReactNode } from 'react'
import { TooltipCard } from '@/components/aceternity/TooltipCard'
import {
  Bot,
  BookOpenCheck,
  Cable,
  FileText,
  FlaskConical,
  LayoutGrid,
  Mic,
  PenLine,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from 'lucide-react'

/**
 * The shelves the feature filter groups by. Six words a visitor would use
 * themselves, so the filter reads like a table of contents rather than a
 * taxonomy.
 */
export const FEATURE_KINDS = ['Research', 'Study', 'Writing', 'Power', 'Everyday', 'Privacy'] as const

export type FeatureKind = (typeof FEATURE_KINDS)[number]

export interface Feature {
  id: string
  /** Which shelf this belongs to, for the filter row. */
  kind: FeatureKind
  icon: ReactNode
  title: string
  body: ReactNode
  /** Rendered as a small pill under the body. A tag can carry a glossary tooltip. */
  tag?: ReactNode
  /** Cards that get a larger cell on wide screens. */
  wide?: boolean
}

export const FEATURES: Feature[] = [
  {
    id: 'answers',
    kind: 'Research',
    icon: <Search className="h-5 w-5" />,
    title: 'Answers with sources you can open',
    body: (
      <>
        Ask a question and the answer arrives with numbered citations. You can also tell it to answer{' '}
        <em>only</em> from one page, one PDF or your own notes.
      </>
    ),
    tag: 'Search is set up the moment you install it',
    wide: true,
  },
  {
    id: 'read-quiz',
    kind: 'Study',
    icon: <BookOpenCheck className="h-5 w-5" />,
    title: 'Turn a paper into a study session',
    body: (
      <>
        Drop in a PDF, Word file, text or Markdown document. You get a clean reading view, a summary, and a quiz
        generated from the actual text: multiple choice, true or false, fill in the blank, order it, match the pairs.
      </>
    ),
    tag: 'Timer, streaks and a shareable result card',
    wide: true,
  },
  {
    id: 'providers',
    kind: 'Research',
    icon: <Bot className="h-5 w-5" />,
    title: 'Bring any AI you already pay for',
    body: (
      <>
        Seventeen providers are built in, plus local models through Ollama or LM Studio, plus a custom slot for
        anything else.
      </>
    ),
    tag: (
      <>
        <TooltipCard
          data={{
            title: 'Free routing',
            body: 'A switch, not a provider. It sends each question to a free model you already have access to, and moves on by itself when one is busy. Ollama and LM Studio count, so a model on your own machine always wins.',
          }}
        >
          <span className="border-b border-dashed border-[var(--surface-border)]">Free routing</span>
        </TooltipCard>{' '}
        prefers a free model first
      </>
    ),
  },
  {
    id: 'library',
    kind: 'Research',
    icon: <LayoutGrid className="h-5 w-5" />,
    title: 'A library that is yours',
    body: (
      <>
        Your documents, saved pages, folders and tags in one place. Search across Wikipedia, trusted sources and your
        own files at once, and keep what matters in a folder you choose.
      </>
    ),
    tag: 'PDF, Word, text and Markdown',
  },
  {
    id: 'agents',
    kind: 'Study',
    icon: <FlaskConical className="h-5 w-5" />,
    title: 'Send a team of assistants at one topic',
    body: (
      <>
        Agent Flood puts a squad on one objective, working in parallel and filing findings into a shared pad, then hands
        you one briefing.
      </>
    ),
    tag: 'With a budget you can watch',
  },
  {
    id: 'writing',
    kind: 'Writing',
    icon: <PenLine className="h-5 w-5" />,
    title: 'Write it up in the same window',
    body: (
      <>
        A long-form article editor with AI blocks and real images from Wikimedia Commons, notebooks you can chat
        against, and a share studio that turns any answer into a picture.
      </>
    ),
    tag: 'Export everything as one ZIP',
  },
  {
    id: 'humanize',
    kind: 'Writing',
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Make it sound like you wrote it',
    body: (
      <>
        One click of Humanize rewrites a reply in plain, uneven, human prose while every fact, number and citation stays
        exactly where it was. The rewrite shows in green; the original waits behind a hover.
      </>
    ),
    tag: 'Also: a pass that tells you what reads as AI',
  },
  {
    id: 'workflows',
    kind: 'Power',
    icon: <Workflow className="h-5 w-5" />,
    title: 'Put your routine on rails',
    body: (
      <>
        A visual canvas for anything you do often: a trigger, a few AI steps, some logic, an output. Build it once, run
        it whenever, read the history.
      </>
    ),
    tag: 'Share a workflow as a single file',
  },
  {
    id: 'coding',
    kind: 'Power',
    icon: <Terminal className="h-5 w-5" />,
    title: 'Build the thing while you research it',
    body: (
      <>
        A coding workspace with an AI pair who edits alongside you and runs commands behind an approval gate, and a
        design mode where the AI can see the real screen and prove a fix.
      </>
    ),
    tag: 'Start from a sample app if you like',
  },
  {
    id: 'talk',
    kind: 'Everyday',
    icon: <Mic className="h-5 w-5" />,
    title: 'Talk to it instead of typing',
    body: (
      <>
        Dictation with three engines: your browser's own, a service you already have, or a Whisper server on your own
        machine for the confidential bits.
      </>
    ),
  },
  {
    id: 'connect',
    kind: 'Everyday',
    icon: <Cable className="h-5 w-5" />,
    title: 'Read the places your work already lives',
    body: (
      <>
        Connect Google Drive, Gmail, Calendar, GitHub, Notion, Slack or a folder on your computer. It tests the account
        against the real service before trusting it.
      </>
    ),
    tag: 'Tokens encrypted on your machine',
  },
  {
    id: 'skills',
    kind: 'Power',
    icon: <FileText className="h-5 w-5" />,
    title: 'Standards you can reuse',
    body: (
      <>
        Skills are instructions you put on any task. Three ship with it: a design pass that scores itself, a pass that
        verifies every claim against the real work, and a no-filler pass.
      </>
    ),
    tag: 'Write your own in plain language',
  },
  {
    id: 'privacy',
    kind: 'Privacy',
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Nobody is watching',
    body: (
      <>
        No account, no telemetry, no analytics. Three privacy postures decide what is even allowed to leave the machine,
        and the default scrubs secrets out of anything that does.
      </>
    ),
    wide: true,
  },
  {
    id: 'updates',
    kind: 'Privacy',
    icon: <Quote className="h-5 w-5" />,
    title: 'Updates itself, and can undo',
    body: (
      <>
        It checks for a new version, verifies the file against its published{' '}
        <TooltipCard
          data={{
            title: 'Fingerprint',
            body: 'A SHA-256 checksum, published beside the release. The app compares the file to it before unpacking anything, so a half-downloaded or tampered file never gets installed.',
          }}
        >
          <span className="border-b border-dashed border-[var(--surface-border)]">fingerprint</span>
        </TooltipCard>{' '}
        before unpacking anything, installs it, and puts the old version back if the new one cannot start. Your library
        is never part of that swap.
      </>
    ),
  },
]
