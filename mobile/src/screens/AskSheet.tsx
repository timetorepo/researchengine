// Ask sheet (docs/mobile/screens/ask-sheet.md). R1 scope: the real composer
// (chips + honest button states), model row, and the skills note. The sheet
// body is the Composer component so the preview, the tests and the app render
// exactly one source of truth.
import React from 'react'
import { Sheet } from '../components/Sheet'
import { Composer } from '../components/Composer'
import { PressButton } from '../components/base'
import { useStore } from '../lib/store'
import providersJson from '../../../packages/types/types.json'

export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const providers = providersJson.providers as { id: string; name: string }[]
  return (
    <Sheet open={open} onClose={onClose} label="Ask Research Engine" initialDetent={90}>
      <Composer variant="sheet" />
      <h3 className="section-title">Model</h3>
      <PressButton variant="quiet" className="modelrow"
        onClick={() => toast('Model picker', 'Provider keys and the model picker arrive in R3. Right now the offline demo answers.')}>
        {providers.length} providers configured · demo engine active
      </PressButton>
      <h3 className="section-title">Skills</h3>
      <p className="callout">Skills run from here once prompts are shared (R3). The 7 built-ins ship verbatim from packages/prompts.</p>
    </Sheet>
  )
}
