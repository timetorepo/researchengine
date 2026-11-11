/**
 * The empty chat: a quiet illustration of tokens streaming from a prompt into a
 * reply, a message box, and a few suggestion chips. It shows on a new chat and
 * again whenever every message has been deleted.
 *
 * Modelled on the Illos AI chat empty state (its layout and idea); the artwork
 * here is original SVG. Motion is off under reduced motion.
 */
import { Sparkles, Sigma } from 'lucide-react'
import { useReducedMotion } from 'motion/react'

const CHIPS = ['Summarise a document', 'Draft a reply', 'Explain this error']
const MATH_CHIPS = ['Solve step by step', 'Check my working', 'Graph this function']

function TokenStream({ still }: { still: boolean }) {
  // A line from the prompt bubble to the reply card; dots travel along it.
  const dots = [0, 1, 2, 3, 4, 5]
  return (
    <svg viewBox="0 0 320 120" className="w-full h-[120px]" aria-hidden>
      <rect x="6" y="18" width="104" height="30" rx="15" fill="var(--elevated)" stroke="var(--surface-border)" />
      <rect x="20" y="30" width="60" height="6" rx="3" fill="var(--text-3)" opacity="0.6" />
      <rect x="212" y="10" width="102" height="94" rx="14" fill="var(--elevated)" stroke="var(--surface-border)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="226" y={28 + i * 18} width={i === 2 ? 46 : 72} height="6" rx="3" fill="var(--text-3)" opacity={i === 2 ? 0.35 : 0.55} />
      ))}
      <path id="stream" d="M112 33 C 150 33, 170 60, 210 60" fill="none" stroke="var(--surface-border)" strokeWidth="1.5" strokeDasharray="3 4" />
      {dots.map((i) => (
        <circle key={i} r="2.6" fill="var(--primary)" opacity="0.9">
          {!still && (
            <animateMotion dur="2.8s" begin={`${(i * 0.45).toFixed(2)}s`} repeatCount="indefinite" path="M112 33 C 150 33, 170 60, 210 60" />
          )}
          {still && <animateMotion dur="1s" begin="0s" repeatCount="1" path="M112 33 C 150 33, 170 60, 210 60" />}
        </circle>
      ))}
    </svg>
  )
}

export function ChatEmptyState({ math = false, onPick }: { math?: boolean; onPick?: (text: string) => void }) {
  const reduce = useReducedMotion()
  const chips = math ? MATH_CHIPS : CHIPS
  return (
    <div className="max-w-[640px] mx-auto px-4 pt-12 pb-8 text-center" data-testid="chat-empty-state">
      <div className="mx-auto max-w-[420px]">
        <TokenStream still={!!reduce} />
      </div>
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] mt-2 mb-3"
        style={{ background: math ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'var(--elevated)' }}>
        {math ? <Sigma size={18} strokeWidth={1.5} style={{ color: 'var(--warning)' }} /> : <Sparkles size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />}
      </div>
      <h2 className="text-[16px] font-medium" style={{ color: 'var(--text)' }}>
        {math ? 'Work through it step by step' : 'Ask anything'}
      </h2>
      <p className="text-[13px] mt-1" style={{ color: 'var(--text-2)' }}>
        {math ? 'Rendered LaTeX, one step at a time.' : 'Toggle Search for cited answers, Flow for token-efficient ones.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => onPick?.(c)}
            className="px-3 py-1.5 rounded-full text-[12px] transition-colors hover:bg-[var(--elevated)]"
            style={{ border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
            {c}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] mt-5" style={{ color: 'var(--text-3)' }}>
        Type <code className="px-1 rounded" style={{ background: 'var(--elevated)' }}>/</code> for skills or <code className="px-1 rounded" style={{ background: 'var(--elevated)' }}>@</code> for connected sources
      </p>
    </div>
  )
}
