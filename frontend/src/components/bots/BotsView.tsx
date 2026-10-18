/**
 * Bots: named teammates that keep their own conversation, memory and routines.
 * You create a bot with a job, talk to it in its thread, save things to its
 * memory, and give it routines that run on a schedule. Its replies come from
 * the model you have configured.
 *
 * What a bot cannot do here: browse, send messages, or act in your other apps.
 * Routines run only while this app is open.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Send, Trash2, Play, Brain, Repeat, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useBots } from '@/lib/bots/store'
import { chatWithBot, runRoutine } from '@/lib/bots/runner'
import { botAvatar, MAX_ROUTINES, MIN_EVERY_MINUTES, MAX_RUNS_KEPT, type Bot, type Routine } from '@/lib/bots/logic'
import { useUI } from '@/stores/useUI'
import { Switch } from '@/components/ui/heroui/Switch'

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const { letter, hue } = botAvatar(name)
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 55% 28%)` }}>
      {letter}
    </span>
  )
}

export function BotsView() {
  const bots = useBots((s) => s.bots)
  const [selectedId, setSelectedId] = useState<string | null>(bots[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const selected = bots.find((b) => b.id === selectedId) ?? null

  useEffect(() => {
    if (!selected && bots.length) setSelectedId(bots[0].id)
  }, [bots, selected])

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]" data-ui="bots">
      <aside className="surface p-3 space-y-2 h-fit">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Your bots</div>
          <button type="button" onClick={() => setCreating((v) => !v)} aria-label="New bot" className="p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
            <Plus size={13} />
          </button>
        </div>
        {bots.length === 0 && !creating && (
          <p className="text-[12px] px-1 py-2" style={{ color: 'var(--text-3)' }}>No bots yet. A bot has a job, keeps its own memory, and can run routines.</p>
        )}
        <ul className="space-y-1">
          {bots.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => { setSelectedId(b.id); setCreating(false) }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-left"
                style={{ background: b.id === selectedId && !creating ? 'var(--elevated)' : 'transparent' }}>
                <Avatar name={b.name} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium truncate">{b.name}</span>
                  <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{b.routines.length} routine{b.routines.length === 1 ? '' : 's'} · {b.memory.length} memories</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {creating && <NewBotForm onDone={(id) => { setCreating(false); setSelectedId(id) }} />}
      </aside>

      <section className="min-w-0">
        {selected ? <BotThread bot={selected} /> : (
          <div className="surface p-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            Create a bot to start. Give it a name and the job you want done; you can talk to it here.
          </div>
        )}
      </section>

      <aside className="space-y-4">
        {selected && <BotSide bot={selected} />}
      </aside>
    </div>
  )
}

function NewBotForm({ onDone }: { onDone: (id: string) => void }) {
  const ui = useUI()
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const create = () => {
    if (!name.trim()) { ui.toast('Name the bot', undefined, 'warning'); return }
    const id = useBots.getState().create({ name, job })
    onDone(id)
  }
  return (
    <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Ana's research bot" aria-label="Bot name"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <textarea value={job} onChange={(e) => setJob(e.target.value)} rows={3} placeholder="Its job: what it looks after, and how it should help"
        aria-label="Bot job" className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none resize-y" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <button type="button" onClick={create} className="w-full px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create bot</button>
    </div>
  )
}

function BotThread({ bot }: { bot: Bot }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobDraft, setJobDraft] = useState(bot.job)
  const endRef = useRef<HTMLDivElement | null>(null)
  const ui = useUI()

  useEffect(() => { setJobDraft(bot.job); setText('') }, [bot.id])
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [bot.thread.length])

  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    setBusy(true)
    try { await chatWithBot(bot.id, t) } finally { setBusy(false) }
  }

  const removeBot = () => {
    if (!window.confirm(`Delete ${bot.name}? Its thread, memory and routines are removed from this device.`)) return
    useBots.getState().remove(bot.id)
    ui.toast('Bot deleted', bot.name, 'success')
  }

  return (
    <div className="surface flex flex-col min-h-[560px]">
      <header className="px-4 py-3 flex items-start gap-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <Avatar name={bot.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold truncate">{bot.name}</div>
          <textarea value={jobDraft} onChange={(e) => setJobDraft(e.target.value)} rows={1}
            onBlur={() => { if (jobDraft !== bot.job) useBots.getState().setJob(bot.id, jobDraft) }}
            aria-label="Bot job" placeholder="Describe its job"
            className="w-full bg-transparent outline-none text-[11.5px] resize-none" style={{ color: 'var(--text-3)' }} />
        </div>
        <button type="button" onClick={removeBot} aria-label={`Delete ${bot.name}`} className="p-1.5 rounded-full" style={{ color: 'var(--text-3)' }}>
          <Trash2 size={13} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {bot.thread.length === 0 && (
          <p className="text-[12.5px] text-center py-10" style={{ color: 'var(--text-3)' }}>
            Say what you need. To save something for later, start with “remember:”.
          </p>
        )}
        {bot.thread.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-[14px] text-[12.5px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: m.role === 'user' ? 'var(--primary)' : m.role === 'note' ? 'transparent' : 'var(--elevated)',
                color: m.role === 'user' ? '#fff' : m.role === 'note' ? 'var(--text-3)' : 'var(--text)',
                border: m.role === 'note' ? '1px dashed var(--surface-border)' : undefined,
                fontStyle: m.role === 'note' ? 'italic' : undefined,
              }}>
              {m.routineId && <span className="block text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Routine</span>}
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11.5px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> {bot.name} is thinking</div>}
        <div ref={endRef} />
      </div>

      <form className="p-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--surface-border)' }}
        onSubmit={(e) => { e.preventDefault(); void send() }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label={`Message ${bot.name}`}
          placeholder={`Message ${bot.name}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          className="flex-1 px-3 py-2 rounded-[12px] text-[12.5px] outline-none resize-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="p-2.5 rounded-full disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}

function BotSide({ bot }: { bot: Bot }) {
  const [tab, setTab] = useState<'memory' | 'routines'>('routines')
  return (
    <div className="surface p-3 space-y-3">
      <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--elevated)' }}>
        {(['routines', 'memory'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t}
            className="flex-1 px-3 py-1 rounded-full text-[12px] inline-flex items-center justify-center gap-1"
            style={{ background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-2)' }}>
            {t === 'routines' ? <Repeat size={12} /> : <Brain size={12} />} {t === 'routines' ? `Routines (${bot.routines.length})` : `Memory (${bot.memory.length})`}
          </button>
        ))}
      </div>
      {tab === 'memory' ? <MemoryPanel bot={bot} /> : <RoutinesPanel bot={bot} />}
    </div>
  )
}

function MemoryPanel({ bot }: { bot: Bot }) {
  const [text, setText] = useState('')
  const ui = useUI()
  const add = () => {
    const err = useBots.getState().remember(bot.id, text)
    if (err) ui.toast('Not saved', err, 'warning')
    else setText('')
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>What {bot.name} keeps between conversations. It reads these before every reply.</p>
      <div className="flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="Something to remember" aria-label="New memory"
          className="flex-1 px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="button" onClick={add} disabled={!text.trim()} className="px-2.5 rounded-[10px] text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>Save</button>
      </div>
      {bot.memory.length === 0 && <p className="text-[12px] py-2" style={{ color: 'var(--text-3)' }}>Nothing saved yet.</p>}
      <ul className="space-y-1">
        {bot.memory.map((m, i) => (
          <li key={`${i}-${m}`} className="group flex items-start gap-2 text-[12px] px-2 py-1.5 rounded-[8px]" style={{ background: 'var(--elevated)' }}>
            <span className="flex-1 leading-snug">{m}</span>
            <button type="button" onClick={() => useBots.getState().forget(bot.id, i)} aria-label={`Forget ${m}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ color: 'var(--text-3)' }}>
              <Trash2 size={11} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoutinesPanel({ bot }: { bot: Bot }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [every, setEvery] = useState(60)
  const ui = useUI()
  const atLimit = bot.routines.length >= MAX_ROUTINES

  const add = () => {
    const err = useBots.getState().addRoutine(bot.id, { title, instructions, everyMinutes: every })
    if (err) { ui.toast('Routine not added', err, 'warning'); return }
    setTitle(''); setInstructions('')
    ui.toast('Routine added', `${title.trim()} runs every ${every} minutes while the app is open.`, 'success')
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        A routine is a standing job on a schedule. It runs only while Research Engine is open; when the app opens after a missed time, it runs once.
      </p>
      <div className="space-y-1.5 p-2 rounded-[10px]" style={{ background: 'var(--elevated)' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Morning brief" aria-label="Routine title" disabled={atLimit}
          className="w-full px-2 py-1 rounded-[8px] text-[12px] outline-none bg-transparent" />
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="What to do each time" aria-label="Routine instructions" disabled={atLimit}
          className="w-full px-2 py-1 rounded-[8px] text-[12px] outline-none bg-transparent resize-none" />
        <div className="flex items-center gap-2 text-[11.5px]">
          <span style={{ color: 'var(--text-3)' }}>Every</span>
          <input type="number" min={MIN_EVERY_MINUTES} value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="Minutes between runs" disabled={atLimit}
            className="w-[70px] px-2 py-0.5 rounded-[8px] bg-transparent outline-none tabular-nums" style={{ border: '1px solid var(--surface-border)' }} />
          <span style={{ color: 'var(--text-3)' }}>minutes (at least {MIN_EVERY_MINUTES})</span>
        </div>
        <button type="button" onClick={add} disabled={atLimit} className="w-full px-3 py-1.5 rounded-full text-[12px] disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>
          {atLimit ? `Limit of ${MAX_ROUTINES} reached` : 'Add routine'}
        </button>
      </div>
      <ul className="space-y-2">
        {bot.routines.map((r) => <RoutineRow key={r.id} botId={bot.id} routine={r} />)}
      </ul>
    </div>
  )
}

function RoutineRow({ botId, routine }: { botId: string; routine: Routine }) {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const lastRun = routine.runs[0]
  const nextText = useMemo(() => (routine.enabled ? `next ${when(routine.nextRunAt)}` : 'paused'), [routine.enabled, routine.nextRunAt])

  const runNow = async () => {
    setRunning(true)
    try { await runRoutine(botId, routine.id) } finally { setRunning(false) }
  }

  return (
    <li className="p-2 rounded-[10px] space-y-1.5" style={{ background: 'var(--elevated)' }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1 min-w-0 flex-1 text-left">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-[12px] font-medium truncate">{routine.title}</span>
        </button>
        <Switch checked={routine.enabled} label={`Enable ${routine.title}`} size="sm"
          onChange={(v) => useBots.getState().patchRoutine(botId, routine.id, { enabled: v })} />
      </div>
      <div className="text-[10.5px] pl-4" style={{ color: 'var(--text-3)' }}>
        every {routine.everyMinutes} min · {nextText}{lastRun ? ` · last ${lastRun.ok ? 'ok' : 'failed'} ${when(lastRun.at)}` : ''}
      </div>
      {open && (
        <div className="pl-4 space-y-2">
          <p className="text-[11.5px] whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{routine.instructions}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void runNow()} disabled={running} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] disabled:opacity-50" style={{ background: 'var(--surface)' }}>
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run now
            </button>
            <button type="button" onClick={() => { if (window.confirm(`Delete “${routine.title}”? This cannot be undone.`)) useBots.getState().deleteRoutine(botId, routine.id) }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]" style={{ color: 'var(--danger)', background: 'var(--surface)' }}>
              <Trash2 size={11} /> Delete
            </button>
          </div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>Last {MAX_RUNS_KEPT} runs</div>
          <ul className="space-y-1">
            {routine.runs.length === 0 && <li className="text-[11px]" style={{ color: 'var(--text-3)' }}>No runs yet.</li>}
            {routine.runs.map((run) => (
              <li key={run.id} className="text-[11px] leading-snug">
                <span style={{ color: run.ok ? 'var(--success)' : 'var(--danger)' }}>{run.ok ? '●' : '○'}</span> <span style={{ color: 'var(--text-3)' }}>{when(run.at)}</span>
                <div className="pl-3 whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{run.text.slice(0, 400)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

