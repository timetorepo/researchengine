// Beui-style approval card: the AI pauses and asks before an action with side
// effects. Shows what it wants to do and the choice to allow or deny.
import { useState } from 'react'
import { ShieldAlert, Check, X } from 'lucide-react'

export type Decision = 'approve' | 'deny'

export function ApprovalCard({ title, description, command, onDecide }: {
  title: string; description: string; command?: string; onDecide: (d: Decision) => void
}) {
  const [decided, setDecided] = useState<Decision | null>(null)
  const decide = (d: Decision) => { setDecided(d); onDecide(d) }
  return (
    <section role="alertdialog" aria-labelledby="approval-title" aria-describedby="approval-desc"
      className="rounded-[14px] p-3.5 my-2 max-w-lg" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} aria-hidden style={{ color: 'var(--warning, #d97706)' }} />
        <h3 id="approval-title" className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      </div>
      <p id="approval-desc" className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-2)' }}>{description}</p>
      {command && <pre className="mt-2 text-[11.5px] rounded-[8px] p-2 overflow-x-auto" style={{ background: 'var(--elevated)', color: 'var(--text)' }}><code>{command}</code></pre>}
      <div className="mt-3 flex gap-2">
        {decided ? (
          <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>{decided === 'approve' ? 'Approved' : 'Denied'}</span>
        ) : (
          <>
            <button type="button" onClick={() => decide('approve')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px] font-medium"
              style={{ background: 'var(--primary)', color: '#fff' }}><Check size={12} aria-hidden /> Allow</button>
            <button type="button" onClick={() => decide('deny')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px]"
              style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}><X size={12} aria-hidden /> Deny</button>
          </>
        )}
      </div>
    </section>
  )
}
