/**
 * Group chats. Bots in a group answer in turn: a bot called on with @Name answers
 * next, and a round ends at six bot turns, when nobody is called on, or when a
 * bot passes. A person's message starts each round.
 */
import { useState } from 'react'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { useBots } from '@/lib/bots/store'
import { runRoomTurn } from '@/lib/bots/runner'
import { MAX_ROOM_MEMBERS, roomMembers, type Room } from '@/lib/bots/logic'
import { useUI } from '@/stores/useUI'
import { BotFace } from './BotFace'

export function RoomsView() {
  const rooms = useBots((s) => s.rooms)
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const selected = rooms.find((r) => r.id === selectedId) ?? null
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="surface p-3 space-y-2 h-fit">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Group chats</div>
          <button type="button" onClick={() => setCreating((v) => !v)} className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)' }}>
            {creating ? 'Close' : 'New'}
          </button>
        </div>
        {rooms.length === 0 && !creating && <p className="text-[12px] px-1 py-2" style={{ color: 'var(--text-3)' }}>No group chats yet. Pick two or more bots to put them in one room.</p>}
        <ul className="space-y-1">
          {rooms.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => { setSelectedId(r.id); setCreating(false) }} className="w-full text-left px-2.5 py-2 rounded-[10px]"
                style={{ background: r.id === selectedId && !creating ? 'var(--elevated)' : 'transparent' }}>
                <span className="block text-[12.5px] font-medium truncate">{r.name}</span>
                <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-3)' }}>{r.memberIds.length} bots · {r.thread.length} messages</span>
              </button>
            </li>
          ))}
        </ul>
        {creating && <NewRoomForm onDone={(id) => { setCreating(false); setSelectedId(id) }} />}
      </aside>
      <section className="min-w-0">
        {selected ? <RoomThread room={selected} /> : <div className="surface p-8 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>Make a group chat to see bots talk to each other.</div>}
      </section>
    </div>
  )
}

function NewRoomForm({ onDone }: { onDone: (id: string) => void }) {
  const bots = useBots((s) => s.bots)
  const ui = useUI()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_ROOM_MEMBERS ? p : [...p, id]))
  const create = () => {
    const err = useBots.getState().createRoom({ name, memberIds: picked })
    if (err) { ui.toast('Group not created', err, 'warning'); return }
    const room = useBots.getState().rooms.slice(-1)[0]
    if (room) onDone(room.id)
  }
  return (
    <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Launch team" aria-label="Group name"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      {bots.length < 2 && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Create at least two bots first.</p>}
      <fieldset className="space-y-1">
        <legend className="text-[11px] mb-1" style={{ color: 'var(--text-3)' }}>Members (up to {MAX_ROOM_MEMBERS})</legend>
        {bots.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input type="checkbox" checked={picked.includes(b.id)} onChange={() => toggle(b.id)} />
            <BotFace bot={b} size={20} /> {b.name}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={create} className="w-full px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create group</button>
    </div>
  )
}

function RoomThread({ room }: { room: Room }) {
  const bots = useBots((s) => s.bots)
  const members = roomMembers(room, bots)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ui = useUI()
  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    setBusy(true)
    try { await runRoomTurn(room.id, t) } finally { setBusy(false) }
  }
  const remove = () => {
    if (!window.confirm(`Delete the group “${room.name}”? The bots and their own threads stay.`)) return
    useBots.getState().deleteRoom(room.id)
    ui.toast('Group deleted', room.name, 'success')
  }
  const nameOf = (botId?: string) => bots.find((b) => b.id === botId)?.name ?? 'Bot'
  return (
    <div className="surface flex flex-col min-h-[520px]">
      <header className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold truncate">{room.name}</div>
          <div className="flex items-center gap-1 pt-1 flex-wrap">
            {members.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--elevated)' }}>
                <BotFace bot={m} size={16} /> {m.name}
              </span>
            ))}
          </div>
        </div>
        <button type="button" onClick={remove} aria-label={`Delete ${room.name}`} className="p-1.5 rounded-full" style={{ color: 'var(--text-3)' }}><Trash2 size={13} /></button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {room.thread.length === 0 && <p className="text-[12.5px] text-center py-10" style={{ color: 'var(--text-3)' }}>Say something. The first member answers; to call on a teammate, a bot writes @Name.</p>}
        {room.thread.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%]">
              {m.role === 'bot' && <div className="text-[10.5px] mb-0.5" style={{ color: 'var(--text-3)' }}>{nameOf(m.botId)}</div>}
              <div className="px-3 py-2 rounded-[12px] text-[12.5px] leading-relaxed whitespace-pre-wrap"
                style={{
                  background: m.role === 'user' ? 'var(--primary)' : m.role === 'note' ? 'transparent' : 'var(--elevated)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  border: m.role === 'note' ? '1px dashed var(--surface-border)' : undefined,
                  fontStyle: m.role === 'note' ? 'italic' : undefined,
                }}>
                {m.text}
              </div>
              {m.role === 'bot' && m.trace && m.trace.length > 0 && (
                <details className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                  <summary className="cursor-pointer">How it answered ({m.trace.length} web step{m.trace.length === 1 ? '' : 's'})</summary>
                  <ol className="list-decimal pl-5 pt-1">{m.trace.map((t, i) => <li key={`${i}-${t}`}>{t}</li>)}</ol>
                </details>
              )}
              {m.role === 'bot' && m.sources && m.sources.length > 0 && (
                <ol className="mt-1 text-[11px] pl-4 list-decimal" aria-label="Sources">
                  {m.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="underline break-all">{s.title || s.url}</a></li>)}
                </ol>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11.5px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}><Loader2 size={12} className="animate-spin" /> The group is talking</div>}
      </div>
      <form className="p-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--surface-border)' }} onSubmit={(e) => { e.preventDefault(); void send() }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label={`Message ${room.name}`} placeholder={`Message ${room.name}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          className="flex-1 px-3 py-2 rounded-[12px] text-[12.5px] outline-none resize-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send to group" className="p-2.5 rounded-full disabled:opacity-40" style={{ background: 'var(--primary)', color: '#fff' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
