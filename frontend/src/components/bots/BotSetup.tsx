/**
 * The set-up parts of a Bot: its face, its web access, and its role template.
 * Also the form that creates a Bot, which can start from an ECC role.
 */
import { useState } from 'react'
import { useBots } from '@/lib/bots/store'
import { AVATAR_TYPES, avatarTypeFor, type AvatarType, type Bot, type BotRole } from '@/lib/bots/logic'
import { ECC_AGENTS, ECC_REF } from '@/content/ecc/agents'
import { Switch } from '@/components/ui/heroui/Switch'
import { useUI } from '@/stores/useUI'
import { BotFace } from './BotFace'

const firstSentence = (s: string) => {
  const cut = s.split(/(?<=\.)\s/)[0] ?? s
  return cut.length > 140 ? `${cut.slice(0, 137)}…` : cut
}

export function roleFromAgent(agentId: string): BotRole | null {
  const a = ECC_AGENTS.find((x) => x.id === agentId)
  if (!a) return null
  return { source: 'ecc', id: a.id, name: a.name, prompt: a.prompt }
}

/** A role picker. Choosing nothing keeps a plain Bot. */
export function RolePicker({ value, onChange, id }: { value: string; onChange: (agentId: string) => void; id: string }) {
  const agent = ECC_AGENTS.find((a) => a.id === value)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Start from an ECC role</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
        <option value="">No role template</option>
        {ECC_AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {agent && <p className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>{firstSentence(agent.description)}</p>}
      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Roles from ECC, affaan-m/ecc (MIT), pinned at {ECC_REF.slice(0, 7)}.</p>
    </div>
  )
}

export function NewBotForm({ onDone }: { onDone: (id: string) => void }) {
  const ui = useUI()
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const [agentId, setAgentId] = useState('')
  const create = () => {
    if (!name.trim()) { ui.toast('Name the bot', undefined, 'warning'); return }
    const role = roleFromAgent(agentId)
    const agent = ECC_AGENTS.find((a) => a.id === agentId)
    const id = useBots.getState().create({ name, job: job.trim() || agent?.description || '' })
    if (role) useBots.getState().setRole(id, role)
    onDone(id)
  }
  return (
    <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Ana's research bot" aria-label="Bot name"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <RolePicker id="new-bot-role" value={agentId} onChange={setAgentId} />
      <textarea value={job} onChange={(e) => setJob(e.target.value)} rows={3} placeholder="Its job: what it looks after, and how it should help"
        aria-label="Bot job" className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none resize-y" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <button type="button" onClick={create} className="w-full px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Create bot</button>
    </div>
  )
}

export function BotSetupPanel({ bot }: { bot: Bot }) {
  const current: AvatarType = bot.avatar ?? avatarTypeFor(bot.id)
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Face</div>
        <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Avatar">
          {AVATAR_TYPES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={current === t} aria-label={t}
              onClick={() => useBots.getState().setAvatar(bot.id, t)}
              className="flex items-center justify-center rounded-[10px] p-1"
              style={{ background: current === t ? 'var(--elevated)' : 'transparent', outline: current === t ? '2px solid var(--primary)' : 'none' }}>
              <BotFace type={t} size={34} />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Web</div>
        <Switch checked={bot.webAccess === true} label={`Web access for ${bot.name}`} size="sm"
          onChange={(v) => useBots.getState().setWebAccess(bot.id, v)} />
        <p className="text-[11px] leading-snug" style={{ color: 'var(--text-3)' }}>
          {bot.webAccess
            ? 'Can search and open pages. Every step is shown under its reply. Set SearXNG and the browser in Bots → Settings.'
            : 'Off. The bot answers only from its memory and the conversation.'}
        </p>
      </section>

      <section className="space-y-2">
        <RolePicker id={`role-${bot.id}`} value={bot.role?.id ?? ''}
          onChange={(agentId) => useBots.getState().setRole(bot.id, roleFromAgent(agentId))} />
      </section>
    </div>
  )
}
