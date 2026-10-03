// The composer (docs/mobile/05: "Composer"; ancestor: frontend InputBar.tsx).
// Extracted from AskSheet so the design preview can render it standalone in
// every mode state. Real send wiring arrives with the chat pipeline (R3);
// until then the button states the honest next-round copy (09-states rules).
import React, { useState } from 'react'
import { ModeChip, PressButton } from './base'
import { haptic } from '../lib/haptics'
import { useStore } from '../lib/store'
import providersJson from '../../../packages/types/types.json'

const MODES = [
  { id: 'search', label: 'Search', title: 'Web search with citations' },
  { id: 'quality', label: 'Quality', title: 'Longer, thoroughly cited answers' },
  { id: 'math', label: 'Math', title: 'Step-by-step LaTeX' },
  { id: 'replicate', label: 'Replicate', title: 'Staged replication research plan' },
] as const

export function Composer({ variant = 'sheet' }: { variant?: 'sheet' | 'inline' }) {
  const [modes, setModes] = useState<Record<string, boolean>>({})
  const [text, setText] = useState('')
  const toast = useStore((s) => s.toast)
  const providers = providersJson.providers as { id: string; name: string }[]
  const toggle = (id: string) => { haptic('press'); setModes((m) => ({ ...m, [id]: !m[id] })) }

  return (
    <div data-c="Composer" data-variant={variant} className="composer">
      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Ask, or type / for skills, @ for sources"
        rows={variant === 'sheet' ? 3 : 2} aria-label="Question"
      />
      <div className="composer-row">
        <ModeChip label="Flow" active title="AIFlowEngine shaping" onToggle={() => undefined} />
        {MODES.map((m) => (
          <ModeChip key={m.id} label={m.label} title={m.title}
            tone={m.id === 'math' ? 'warning' : 'brand'}
            active={!!modes[m.id]} onToggle={() => toggle(m.id)} />
        ))}
      </div>
      <div className="composer-row">
        <button data-c="AttachButton" className="iconbtn press-tap" aria-label="Add photo or file"
          onClick={() => toast('Attachments', 'The photo, camera and file pickers land with the reader pipeline (R4).')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="m21.4 11.05-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.5a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button data-c="VoiceButton" className="iconbtn press-tap" aria-label="Dictate"
          onClick={() => toast('Dictation', 'Voice input arrives with R7. Hold to talk, three engines, your keys.')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" strokeLinecap="round" />
          </svg>
        </button>
        <span className="spacer" />
        <span className="muted caption">{providers.length} providers · demo engine</span>
        <PressButton variant="primary" hapticEvent="send"
          onClick={() => toast('Answers stream in R3', 'The shell is ready. The chat pipeline connects in the next round.')}>
          Ask
        </PressButton>
      </div>
    </div>
  )
}
