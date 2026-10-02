/**
 * Feedback.
 *
 * The vanish input is the Aceternity component (vendored, see
 * ui/aceternity/PlaceholdersAndVanishInput): the placeholder rotates, and what
 * you typed scatters into pixels when you send it. What happens next is this
 * app's own: the note is written to the local database through
 * `POST /api/feedback`, mirrored into localStorage so it survives a backend
 * that is not running, and listed right here. Nothing is sent to a third party,
 * and the list can always be opened again from the sidebar or Settings → About.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Bug, Lightbulb, Palette, Gauge, MessageSquarePlus, Trash2, Copy, Check, ShieldCheck } from 'lucide-react'
import { PlaceholdersAndVanishInput } from '@/components/ui/aceternity/PlaceholdersAndVanishInput'
import { Button } from '@/components/ui/heroui/Button'
import { useUI } from '@/stores/useUI'
import { useStore } from '@/stores/useStore'

type Kind = 'bug' | 'idea' | 'ui' | 'performance' | 'other'

interface FeedbackEntry {
  id: string
  kind: Kind
  text: string
  contact?: string
  appVersion?: string
  createdAt: number
}

const KINDS: { id: Kind; label: string; Icon: React.ElementType; hint: string }[] = [
  { id: 'bug', label: 'Bug', Icon: Bug, hint: 'Something broke or behaved wrongly' },
  { id: 'ui', label: 'Interface', Icon: Palette, hint: 'Something looks wrong or feels off' },
  { id: 'idea', label: 'Idea', Icon: Lightbulb, hint: 'Something the app should do' },
  { id: 'performance', label: 'Performance', Icon: Gauge, hint: 'Slow, laggy, hot, or heavy' },
  { id: 'other', label: 'Other', Icon: MessageSquarePlus, hint: 'Anything else' },
]

const PLACEHOLDERS = [
  'What is on your mind about the app?',
  'Something that broke? Describe what you did and what happened.',
  'An idea for the next round? Write it down before it goes.',
  'Something that looks wrong? Say where and what you expected.',
  'Type it and press Enter. It is stored on this machine.',
]

const LOCAL_KEY = 're.feedback.local'

function readLocal(): FeedbackEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as FeedbackEntry[] } catch { return [] }
}
function writeLocal(list: FeedbackEntry[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 300))) } catch { /* private mode */ }
}

export function FeedbackView() {
  const ui = useUI()
  const version = useStore((s) => s.settings) as any
  const [kind, setKind] = useState<Kind>('bug')
  const [contact, setContact] = useState('')
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => readLocal())
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback')
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json() as { feedback: FeedbackEntry[] }
      // Merge: the server list is the record, the local list keeps anything
      // written while the backend was down.
      const merged = [...json.feedback, ...readLocal().filter((l) => !json.feedback.some((f) => f.id === l.id))]
        .sort((a, b) => b.createdAt - a.createdAt)
      setEntries(merged)
      writeLocal(merged)
    } catch {
      setEntries(readLocal())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const submit = async (text: string) => {
    const clean = text.trim()
    if (clean.length < 3) return
    const entry: FeedbackEntry = {
      id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind,
      text: clean,
      contact: contact.trim() || undefined,
      appVersion: String(version?.appVersion ?? '') || undefined,
      createdAt: Date.now(),
    }
    const next = [entry, ...entries]
    setEntries(next)
    writeLocal(next)
    ui.toast('Written down', 'Stored on this machine, in your own database.', 'success')
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
      })
      void refresh()
    } catch { /* kept locally; it will be there next time */ }
  }

  const remove = async (id: string) => {
    const next = entries.filter((e) => e.id !== id)
    setEntries(next)
    writeLocal(next)
    try { await fetch(`/api/feedback/${id}`, { method: 'DELETE' }) } catch { /* local is enough */ }
  }

  const asText = useMemo(() => entries.map((e) =>
    `[${new Date(e.createdAt).toISOString()}] ${e.kind.toUpperCase()}${e.appVersion ? ` (${e.appVersion})` : ''}\n${e.text}${e.contact ? `\ncontact: ${e.contact}` : ''}`
  ).join('\n\n'), [entries])

  return (
    <div className="h-full overflow-y-auto" data-ui="feedback">
      <div className="max-w-[760px] mx-auto px-5 py-8">
        <div className="flex items-start gap-3 mb-5">
          <MessageSquarePlus size={20} style={{ color: 'var(--primary)' }} className="mt-0.5" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Feedback</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-2)' }}>
              Bugs, ideas, anything that looks wrong. Every note is stored on this device and listed below, so you can read it back at any time.
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] shrink-0"
            style={{ background: 'color-mix(in srgb, var(--success) 12%, var(--surface))', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)' }}>
            <ShieldCheck size={12} /> stays local
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {KINDS.map(({ id, label, Icon, hint }) => (
            <button key={id} onClick={() => setKind(id)} title={hint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-colors"
              style={{
                background: kind === id ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))' : 'var(--surface)',
                border: `1px solid ${kind === id ? 'var(--primary)' : 'var(--surface-border)'}`,
                color: kind === id ? 'var(--text)' : 'var(--text-3)',
              }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <PlaceholdersAndVanishInput
          placeholders={PLACEHOLDERS}
          onSubmit={(v) => void submit(v)}
          submitLabel="Save feedback"
        />

        <div className="flex items-center gap-2 mt-3">
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="How to reach you (optional)"
            className="flex-1 rounded-[10px] px-3 py-2 text-[12.5px] outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', color: 'var(--text)' }}
          />
          <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{kind} · saved with the app version</span>
        </div>

        <div className="flex items-center gap-2 mt-6 mb-2">
          <h2 className="text-[13px] font-medium flex-1">Everything you have sent ({entries.length})</h2>
          {entries.length > 0 && (
            <button onClick={async () => {
              try { await navigator.clipboard.writeText(asText); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch { ui.toast('Clipboard blocked', 'Select the list and copy it by hand.', 'danger') }
            }} className="flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-2)' }}>
              {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy all'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="surface p-4 text-[12px]" style={{ color: 'var(--text-3)' }}>Reading your notes…</div>
        ) : entries.length === 0 ? (
          <div className="surface p-5 text-center">
            <p className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Nothing yet. The first note you write will appear here, and it will still be here after a restart.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((e) => {
              const meta = KINDS.find((k) => k.id === e.kind) ?? KINDS[KINDS.length - 1]
              return (
                <motion.div key={e.id} layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="surface p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <meta.Icon size={12} style={{ color: 'var(--primary)' }} />
                    <span className="text-[11.5px] font-medium">{meta.label}</span>
                    <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>
                      {new Date(e.createdAt).toLocaleString()}{e.appVersion ? ` · ${e.appVersion}` : ''}
                    </span>
                    <button onClick={() => void remove(e.id)} aria-label="Delete this note"
                      className="ml-auto p-1 rounded-full hover:bg-[var(--elevated)]" style={{ color: 'var(--text-3)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-[12.5px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text)' }}>{e.text}</p>
                  {e.contact && <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>reachable at {e.contact}</p>}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
