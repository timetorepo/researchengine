/**
 * The onboarding feature carousel, drawn rather than photographed.
 *
 * Aceternity's Apple Cards Carousel wants card faces; a stock photo of a
 * laptop on a desk would say nothing about this app and would not follow the
 * theme. So each card face is a small drawn diagram built from the app's own
 * CSS variables — a citation list, a marked-up page, an editor with three
 * panes, a fan of agents — and it repaints with the theme the user is picking
 * two steps earlier.
 */
import React from 'react'
import { Check } from 'lucide-react'
import type { AppleCard } from '@/components/ui/aceternity/AppleCardsCarousel'

const FACE = 'relative h-full w-full overflow-hidden'

function Art({ children, from, to }: { children: React.ReactNode; from: string; to: string }) {
  return (
    <div className={FACE} style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}>
      <svg viewBox="0 0 224 300" className="absolute inset-0 h-full w-full" aria-hidden>
        {children}
      </svg>
    </div>
  )
}

/** Shared helper: a stack of text lines, the visual shorthand for "content". */
function Lines({ x, y, w, n, gap = 12, color }: { x: number; y: number; w: number; n: number; gap?: number; color: string }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i % 3 === 2 ? w * 0.62 : i % 2 === 1 ? w * 0.85 : w}
          height={4}
          rx={2}
          fill={color}
        />
      ))}
    </>
  )
}

const ICON = 'var(--text)'

const ART = {
  sources: (
    <Art from="color-mix(in srgb, var(--primary) 22%, var(--elevated))" to="var(--elevated)">
      <rect x={28} y={40} width={168} height={96} rx={10} fill="var(--surface)" opacity={0.9} />
      <Lines x={44} y={58} w={136} n={5} color="color-mix(in srgb, var(--text-3) 55%, transparent)" />
      <rect x={28} y={156} width={168} height={30} rx={8} fill="color-mix(in srgb, var(--primary) 18%, var(--surface))" />
      <circle cx={46} cy={171} r={7} fill="color-mix(in srgb, var(--primary) 40%, transparent)" />
      <Lines x={62} y={163} w={104} n={2} gap={10} color="color-mix(in srgb, var(--primary) 45%, transparent)" />
      <rect x={28} y={200} width={168} height={58} rx={10} fill="color-mix(in srgb, var(--surface) 80%, transparent)" />
      <Lines x={44} y={218} w={136} n={3} color="color-mix(in srgb, var(--text-3) 45%, transparent)" />
    </Art>
  ),
  quiz: (
    <Art from="color-mix(in srgb, var(--success) 20%, var(--elevated))" to="var(--elevated)">
      <rect x={30} y={36} width={164} height={228} rx={12} fill="var(--surface)" opacity={0.92} />
      <Lines x={48} y={58} w={128} n={4} color="color-mix(in srgb, var(--text-3) 50%, transparent)" />
      <rect x={48} y={112} width={128} height={16} rx={4} fill="color-mix(in srgb, var(--primary) 22%, transparent)" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={48} y={148 + i * 36} width={128} height={26} rx={7} fill="var(--elevated)" />
          <circle cx={62} cy={161 + i * 36} r={7} fill={i === 1 ? 'color-mix(in srgb, var(--success) 70%, transparent)' : 'var(--surface-border)'} />
          {i === 1 && <path d="M58.6 161l2.4 2.5 4.5-5" stroke="var(--bg)" strokeWidth={2} fill="none" strokeLinecap="round" />}
        </g>
      ))}
    </Art>
  ),
  ide: (
    <Art from="color-mix(in srgb, var(--secondary) 20%, var(--elevated))" to="var(--elevated)">
      <rect x={22} y={44} width={180} height={132} rx={10} fill="var(--surface)" opacity={0.92} />
      <rect x={22} y={44} width={180} height={22} rx={10} fill="color-mix(in srgb, var(--text-3) 16%, transparent)" />
      <circle cx={36} cy={55} r={3.4} fill="var(--danger)" opacity={0.7} />
      <circle cx={48} cy={55} r={3.4} fill="var(--warning)" opacity={0.7} />
      <circle cx={60} cy={55} r={3.4} fill="var(--success)" opacity={0.7} />
      <Lines x={36} y={80} w={120} n={6} gap={13} color="color-mix(in srgb, var(--secondary) 40%, transparent)" />
      <Lines x={164} y={80} w={26} n={3} gap={13} color="color-mix(in srgb, var(--text-3) 40%, transparent)" />
      <rect x={22} y={190} width={86} height={66} rx={10} fill="var(--surface)" opacity={0.85} />
      <rect x={116} y={190} width={86} height={66} rx={10} fill="var(--surface)" opacity={0.85} />
      <Lines x={34} y={206} w={62} n={3} gap={12} color="color-mix(in srgb, var(--primary) 35%, transparent)" />
      <Lines x={128} y={206} w={62} n={3} gap={12} color="color-mix(in srgb, var(--success) 35%, transparent)" />
    </Art>
  ),
  flood: (
    <Art from="color-mix(in srgb, var(--warning) 18%, var(--elevated))" to="var(--elevated)">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (Math.PI / 4) * i
        const cx = 112 + Math.cos(a) * 66
        const cy = 150 + Math.sin(a) * 66
        return (
          <g key={i}>
            <line x1={112} y1={150} x2={cx} y2={cy} stroke="color-mix(in srgb, var(--warning) 35%, transparent)" strokeWidth={1.4} />
            <circle cx={cx} cy={cy} r={i % 2 ? 13 : 9} fill="color-mix(in srgb, var(--warning) 26%, var(--surface))" stroke="color-mix(in srgb, var(--warning) 45%, transparent)" />
          </g>
        )
      })}
      <circle cx={112} cy={150} r={24} fill="color-mix(in srgb, var(--warning) 34%, var(--surface))" stroke="color-mix(in srgb, var(--warning) 60%, transparent)" strokeWidth={1.6} />
      <Lines x={54} y={252} w={116} n={2} gap={11} color="color-mix(in srgb, var(--text-3) 45%, transparent)" />
    </Art>
  ),
  local: (
    <Art from="color-mix(in srgb, var(--primary) 16%, var(--elevated))" to="var(--elevated)">
      {Array.from({ length: 7 }).map((_, r) =>
        Array.from({ length: 5 }).map((__, c) => (
          <circle key={`${r}-${c}`} cx={40 + c * 36} cy={54 + r * 34} r={1.6} fill="color-mix(in srgb, var(--text-3) 40%, transparent)" />
        )),
      )}
      <path
        d="M112 96l46 16v42c0 30-20 52-46 60-26-8-46-30-46-60v-42z"
        fill="color-mix(in srgb, var(--primary) 20%, var(--surface))"
        stroke="color-mix(in srgb, var(--primary) 55%, transparent)"
        strokeWidth={2}
      />
      <path d="M98 172l10 11 22-26" stroke="color-mix(in srgb, var(--primary) 80%, transparent)" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={44} y={240} width={136} height={26} rx={13} fill="color-mix(in srgb, var(--surface) 85%, transparent)" />
    </Art>
  ),
  tech: (
    <Art from="color-mix(in srgb, var(--secondary) 16%, var(--elevated))" to="var(--elevated)">
      <polyline
        points="30,206 62,186 90,196 120,150 148,164 178,112 196,124"
        fill="none"
        stroke="color-mix(in srgb, var(--secondary) 70%, transparent)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="30,206 62,186 90,196 120,150 148,164 178,112 196,124 196,224 30,224" fill="color-mix(in srgb, var(--secondary) 12%, transparent)" />
      <Lines x={30} y={52} w={92} n={2} gap={13} color="color-mix(in srgb, var(--text-3) 45%, transparent)" />
      <rect x={30} y={90} width={64} height={22} rx={11} fill="color-mix(in srgb, var(--secondary) 22%, var(--surface))" />
      <rect x={104} y={90} width={92} height={22} rx={11} fill="color-mix(in srgb, var(--surface) 85%, transparent)" />
    </Art>
  ),
}

export const ONBOARDING_FEATURES: AppleCard[] = [
  {
    category: 'Research',
    title: 'Answers with their sources',
    art: ART.sources,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          One question goes out to several providers and search engines at once. The answer comes back with the
          citations attached, so you can check it rather than trust it.
        </p>
        <ul className="space-y-1.5">
          {['SearXNG search that works on its own — no keys, no setup', 'Source strip under every answer, jumps to the page', 'Long answers summarise themselves into the context meter'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    category: 'Read & Quiz',
    title: 'Any paper becomes a quiz',
    art: ART.quiz,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          Drop a PDF on the home screen. It is parsed, rewritten into study language, highlighted in three tiers and
          turned into a quiz with explanations — offline, in the app.
        </p>
        <ul className="space-y-1.5">
          {['Serif reader with a progress rail and annotations', 'Toggle back to the original any time', 'Quiz built like Apple made it: one card, no clutter'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    category: 'Coding',
    title: 'A coding IDE, built in',
    art: ART.ide,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          Cursor × Devin, inside the same app: parallel agents, multi-file inline edits, Claude Code slash commands
          and a <code className="font-mono">/handoff</code> that moves a session between local and cloud.
        </p>
        <ul className="space-y-1.5">
          {['Several agents on one task, each with its own panel', 'Inline diffs you accept or reject per hunk', 'Design preview with a resizable frame'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    category: 'Agent Flood',
    title: 'Twelve agents, one question',
    art: ART.flood,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          For the questions that need more than one pass, Flood fans out a checklist of sub-questions, works them in
          parallel and folds the results into one answer.
        </p>
        <ul className="space-y-1.5">
          {['A checklist you can read while it works', "Every agent's findings kept, with its source", 'Stops when you tell it to; nothing keeps running'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    category: 'Local-first',
    title: 'Your key, your device',
    art: ART.local,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          Bring your own provider key, or run everything against a local model. Keys are encrypted with AES-GCM, and
          your chats never leave the machine unless you export them.
        </p>
        <ul className="space-y-1.5">
          {['No account, no telemetry, no background pings', 'Works fully offline with Ollama or the demo model', 'Settings → Data exports or wipes everything'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    category: 'New Tech',
    title: 'Fast, cheap and current',
    art: ART.tech,
    content: (
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <p>
          FreeRoute points a chat at the best free model you have a key for, and falls back when it fails. New Tech
          mode asks the cheap, fast models first — the answer arrives sooner and costs less.
        </p>
        <ul className="space-y-1.5">
          {['Free models first, paid only if you ask', 'Your own timeout per provider, in seconds', 'Token count on every response'].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} /> {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
]
