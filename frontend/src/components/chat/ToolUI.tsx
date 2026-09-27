import React, { useState } from 'react'
import { motion } from 'motion/react'
import { Wrench, CheckCircle2, XCircle, ShieldAlert, TerminalSquare, ClipboardList, Send, Check, X, Code as CodeIcon } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { submitQuestionnaire, resolveExec } from '@/lib/chat/tools'

/* ---------- tool activity chips ---------- */
export function ToolTraceChips({ msg }: { msg: ChatMessage }) {
  if (!msg.toolTrace?.length) return null
  // Deduplicate consecutive identical labels.
  const chips: typeof msg.toolTrace = []
  for (const t of msg.toolTrace) {
    if (!chips.length || chips[chips.length - 1].label !== t.label || chips[chips.length - 1].status !== t.status) chips.push(t)
  }
  return (
    <div className="flex flex-wrap gap-1.5 mb-2.5">
      {chips.slice(-6).map((t, i) => (
        <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px]"
          style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
          <Wrench size={10} style={{ color: t.status === 'error' ? 'var(--danger)' : t.status === 'blocked' ? 'var(--warning)' : 'var(--primary)' }} />
          {t.label}
        </span>
      ))}
    </div>
  )
}

/* ---------- research chat → coding chat ---------- */

/**
 * The moment a research conversation becomes a coding one.
 *
 * The AI calls `start_coding_mode` (a client-side tool that only exists in this
 * app) and the transcript moves into a project with the IDE tools. This card is
 * the receipt: it says what happened and offers the workspace again, because
 * the automatic switch also happens by itself.
 */
export function CodingModeCard({ project, reason }: { project?: string; reason?: string }) {
  if (!project) return null
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-3.5 rounded-[14px] mb-3 flex items-start gap-3"
      style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 32%, transparent)' }}>
      <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
        <CodeIcon size={15} strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium mb-0.5">This chat is now a coding chat</div>
        <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>
          {reason || `It works inside the project “${project}” and can read files, edit them and run commands there.`}
        </p>
        <button
          onClick={() => { window.location.hash = `#/code?project=${encodeURIComponent(project)}` }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-medium"
          style={{ background: 'var(--primary)', color: '#fff' }}>
          <CodeIcon size={12} /> Open the coding workspace
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- command approval (Coding-mode safety) ---------- */
export function ExecApproval({ chatId, msg }: { chatId: string; msg: ChatMessage }) {
  const pe = msg.pendingExec
  if (!pe) return null
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-3.5 rounded-[14px] mb-3"
      style={{ background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)' }}>
      <div className="flex items-center gap-2 text-[12.5px] font-medium mb-1.5">
        <TerminalSquare size={14} style={{ color: 'var(--warning)' }} /> Command approval required
      </div>
      <p className="text-[11.5px] mb-2" style={{ color: 'var(--text-2)' }}>{pe.reason || 'The AI wants to run this command inside the project folder. It only runs if you approve.'}</p>
      <code className="block px-2.5 py-2 rounded-lg text-[11.5px] font-mono mb-3 break-all"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>$ {pe.command}</code>
      <div className="flex gap-2">
        <button onClick={() => resolveExec(chatId, msg.id, pe.toolCallId, true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
          style={{ background: 'var(--success)', color: '#fff' }}>
          <Check size={13} /> Approve &amp; run
        </button>
        <button onClick={() => resolveExec(chatId, msg.id, pe.toolCallId, false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium"
          style={{ background: 'var(--elevated)', color: 'var(--text-2)', border: '1px solid var(--surface-border)' }}>
          <X size={13} /> Decline
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- AI-generated questionnaire ---------- */
export function QuestionnaireCard({ chatId, msg }: { chatId: string; msg: ChatMessage }) {
  const q = msg.questionnaire
  const [answers, setAnswers] = useState<Record<string, string>>({})
  if (!q) return null
  const toolCallId = q.toolCallId

  if (q.submitted) {
    return (
      <div className="p-3.5 rounded-[14px] mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center gap-2 text-[12.5px] font-medium mb-2">
          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> {q.title ?? 'Your answers'}
        </div>
        <div className="space-y-1.5">
          {q.items.map((it) => (
            <div key={it.id} className="text-[11.5px]">
              <span style={{ color: 'var(--text-3)' }}>{it.question}</span>
              <div style={{ color: 'var(--text)' }}>{q.answers?.[it.id] || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const ready = q.items.every((it) => (answers[it.id] ?? '').trim().length > 0)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-[16px] mb-3"
      style={{ background: 'color-mix(in srgb, var(--primary) 6%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--surface-border))' }}>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList size={15} style={{ color: 'var(--primary)' }} />
        <span className="text-[13px] font-semibold">{q.title ?? 'A few quick questions'}</span>
      </div>
      {q.intro && <p className="text-[12px] mb-3" style={{ color: 'var(--text-2)' }}>{q.intro}</p>}
      <div className="space-y-3.5 mt-2">
        {q.items.map((it, idx) => (
          <div key={it.id}>
            <div className="text-[12.5px] font-medium mb-1.5">{idx + 1}. {it.question}</div>
            {it.options && it.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {it.options.map((op) => (
                  <button key={op} onClick={() => setAnswers((a) => ({ ...a, [it.id]: op }))}
                    className="px-2.5 py-1 rounded-full text-[11.5px] transition-colors"
                    style={{
                      background: answers[it.id] === op ? 'var(--primary)' : 'var(--elevated)',
                      color: answers[it.id] === op ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--surface-border)',
                    }}>
                    {op}
                  </button>
                ))}
              </div>
            )}
            {it.allowText && (
              <input value={answers[it.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [it.id]: e.target.value }))}
                placeholder={it.options?.length ? 'Or write your own answer…' : 'Your answer…'}
                className="w-full px-3 py-1.5 rounded-[10px] text-[12.5px] outline-none"
                style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text)' }} />
            )}
          </div>
        ))}
      </div>
      <button
        disabled={!ready || !toolCallId}
        onClick={() => toolCallId && submitQuestionnaire(chatId, msg.id, toolCallId, answers)}
        className="mt-3.5 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-medium disabled:opacity-40"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        <Send size={12} /> Send answers
      </button>
    </motion.div>
  )
}

/* ---------- attachment strip (vision) ---------- */
export function AttachmentStrip({ msg }: { msg: ChatMessage }) {
  if (!msg.attachments?.length) return null
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {msg.attachments.map((a, i) => (
        <img key={i} src={a.dataUrl} alt={a.name} title={a.name}
          className="max-h-40 max-w-[240px] object-contain rounded-[10px]"
          style={{ border: '1px solid var(--surface-border)' }} />
      ))}
    </div>
  )
}

export { Wrench, XCircle, ShieldAlert }
