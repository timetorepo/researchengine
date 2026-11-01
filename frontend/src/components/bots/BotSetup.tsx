/**
 * The set-up parts of a Bot: its face, its web access, and its role template.
 * Also the form that creates a Bot, which can take a plain role (Researcher, Workflow…).
 */
import { useState } from 'react'
import { useBots } from '@/lib/bots/store'
import { AVATAR_TYPES, avatarTypeFor, type AvatarType, type Bot, type BotRole } from '@/lib/bots/logic'
import { ECC_REF } from '@/content/ecc/meta'
import { ROLE_FAMILIES, familyById, familyForRole, type RoleFamily } from '@/lib/ecc/roles'
import { Switch } from '@/components/ui/heroui/Switch'
import { useUI } from '@/stores/useUI'
import { BotFace } from './BotFace'
import { ModernSelect } from '@/components/ui/kit/select/ModernSelect'

/** The role a family gives a bot. The ECC members are chosen per request, not stored here. */
export function roleFromFamily(familyId: string): BotRole | null {
  const f = familyById(familyId)
  if (!f) return null
  return { source: 'ecc', id: f.id, name: f.name }
}

/**
 * A role picker with plain names. The person picks Researcher or Workflow; the ECC
 * roles behind it are chosen for each request and the bot's job. Nothing picked
 * keeps a plain Bot.
 */
export function RolePicker({ value, onChange, id }: { value: string; onChange: (familyId: string) => void; id: string }) {
  const family: RoleFamily | undefined = familyById(value)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Role</label>
      <ModernSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
        <option value="">No role</option>
        {ROLE_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </ModernSelect>
      {family && <p className="text-[10.5px] leading-snug" style={{ color: 'var(--text-3)' }}>{family.blurb} It picks the methods that fit each request and this bot’s job.</p>}
      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>Methods from ECC, affaan-m/ecc (MIT), pinned at {ECC_REF.slice(0, 7)}.</p>
    </div>
  )
}

export function NewBotForm({ onDone }: { onDone: (id: string) => void }) {
  const ui = useUI()
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const [familyId, setFamilyId] = useState('')
  const create = () => {
    if (!name.trim()) { ui.toast('Name the bot', undefined, 'warning'); return }
    const role = roleFromFamily(familyId)
    const family = familyById(familyId)
    const id = useBots.getState().create({ name, job: job.trim() || family?.blurb || '' })
    if (role) useBots.getState().setRole(id, role)
    onDone(id)
  }
  return (
    <div className="pt-2 space-y-2 border-t" style={{ borderColor: 'var(--surface-border)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Ana's research bot" aria-label="Bot name"
        className="w-full px-2.5 py-1.5 rounded-[10px] text-[12.5px] outline-none" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }} />
      <RolePicker id="new-bot-role" value={familyId} onChange={setFamilyId} />
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
        <RolePicker id={`role-${bot.id}`} value={familyForRole(bot.role)?.id ?? ''}
          onChange={(familyId) => useBots.getState().setRole(bot.id, roleFromFamily(familyId))} />
      </section>
    </div>
  )
}
