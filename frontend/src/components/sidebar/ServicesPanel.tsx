/**
 * Built-in services for the chat and the bots, shown in Marketplace → Built in:
 *
 *   OpenSEO      SEO overviews and keyword ideas (MIT)
 *   VoiceStudio  speech in a voice, and voice cloning with the speaker's permission (AGPL-3.0)
 *   Twenty CRM   people, companies and notes (AGPL-3.0)
 *   Postiz       social drafts; nothing is published from here (AGPL-3.0)
 *   Dictation    the microphone in the composer: OpenWhispr's self-hosted or BYOK model (MIT)
 *
 * Each card keeps its key on this device, encrypted with the vault when one is set.
 */
import { useState, type ReactNode } from 'react'
import { Check, Loader2, Mic, Trash2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { describeStt, type SttSettings } from '@/lib/voice/stt'
import {
  SERVICE_DEFAULTS, forgetConsent, saveService, serviceEntry, serviceReady, type ServiceName,
} from '@/lib/services/config'
import { voiceClone } from '@/lib/services/client'

const muted = { color: 'var(--text-3)' } as const
const field = { background: 'var(--elevated)', border: '1px solid var(--surface-border)' } as const
const primary = { background: 'var(--primary)', color: '#fff' } as const

export function ServicesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Tools the chat and the bots can use. Each one is off until you add its key, and the key stays on this device.
      </p>
      <ServiceCard
        name="openseo"
        title="SEO data (OpenSEO)"
        blurb="The agent can look up a site’s search performance and keyword ideas. OpenSEO bills its data provider per lookup, so set a limit there."
        keyLabel="OpenSEO key (oseo_…)"
        keyHelp="Settings → API keys in OpenSEO, or your self-hosted instance."
        projectField
      />
      <VoiceCard />
      <ServiceCard
        name="twenty"
        title="CRM (Twenty)"
        blurb="The agent can find people and companies, and add one when you ask. Writes go through your Twenty key, so use a key with the roles you want it to have."
        keyLabel="Twenty API key"
        keyHelp="Settings → Developers → API → Create key in Twenty."
      />
      <ServiceCard
        name="postiz"
        title="Social drafts (Postiz)"
        blurb="The agent can save drafts on your connected channels. It never publishes or schedules; you do that in Postiz."
        keyLabel="Postiz API key"
        keyHelp="Settings → Public API in Postiz. Use the API root of your instance, e.g. https://your-domain/api/public/v1."
      />
      <DictationCard />
    </div>
  )
}

function Status({ ready }: { ready: boolean }) {
  return (
    <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--elevated)', color: ready ? 'var(--success)' : 'var(--text-3)' }}>
      {ready ? 'Ready' : 'Not set up'}
    </span>
  )
}

function Shell({ title, ready, children, credit }: { title: string; ready: boolean; children: ReactNode; credit: string }) {
  return (
    <section className="p-3 rounded-[14px] space-y-2.5" style={field}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>{title}</span>
        <Status ready={ready} />
      </div>
      {children}
      <p className="text-[10.5px] leading-snug" style={muted}>{credit}</p>
    </section>
  )
}

function ServiceCard({ name, title, blurb, keyLabel, keyHelp, projectField }: {
  name: ServiceName; title: string; blurb: string; keyLabel: string; keyHelp: string; projectField?: boolean
}) {
  const saved = serviceEntry(name)
  const has = !!saved.token
  const [url, setUrl] = useState(saved.url ?? '')
  const [key, setKey] = useState('')
  const [project, setProject] = useState(saved.projectId ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const ready = serviceReady(name)

  const save = async () => {
    setBusy(true)
    try {
      await saveService(name, { url, key: key.trim() ? key : undefined, projectId: project })
      setKey('')
      setNote('Saved on this device.')
    } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await saveService(name, { url: '', key: '', projectId: '' })
      setKey(''); setUrl(''); setProject('')
      setNote('Key removed. The tool is off until you add one.')
    } finally { setBusy(false) }
  }

  return (
    <Shell title={title} ready={ready} credit={credits(name)}>
      <p className="text-[11.5px] leading-snug" style={muted}>{blurb}</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label={`${title} address`}
        placeholder={SERVICE_DEFAULTS[name]} autoComplete="off" spellCheck={false}
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off"
        aria-label={keyLabel} placeholder={has ? 'Saved — type to replace' : keyLabel}
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
      {projectField && (
        <input value={project} onChange={(e) => setProject(e.target.value)} autoComplete="off"
          aria-label="OpenSEO project id (optional)" placeholder="Project id (optional: the first project is used)"
          className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
      )}
      <p className="text-[10.5px]" style={muted}>{keyHelp}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50" style={primary}>
          {busy && <Loader2 size={11} className="animate-spin" />} Save
        </button>
        {(has || url) && (
          <button type="button" onClick={remove} disabled={busy} className="text-[11px] underline underline-offset-2 disabled:opacity-50" style={muted}>Remove</button>
        )}
      </div>
      {note && <InlineAlert status="success" title={note} onClose={() => setNote(null)} />}
    </Shell>
  )
}

function VoiceCard() {
  const saved = serviceEntry('voicestudio')
  const [url, setUrl] = useState(saved.url ?? '')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const consents = useStore((s) => s.settings.services?.voiceConsents ?? [])
  const ready = serviceReady('voicestudio')

  const [speaker, setSpeaker] = useState('')
  const [sample, setSample] = useState<File | null>(null)
  const [permission, setPermission] = useState(false)
  const [cloning, setCloning] = useState(false)
  const canClone = !!speaker.trim() && !!sample && permission && ready && !cloning

  const save = async () => {
    setBusy(true)
    try {
      await saveService('voicestudio', { url, key: key.trim() ? key : undefined })
      setKey('')
      setNote('Saved on this device.')
    } finally { setBusy(false) }
  }

  const clone = async () => {
    if (!sample) return
    setCloning(true)
    try {
      const res = await voiceClone({ speaker, sample, permission })
      if (res.ok) {
        setSpeaker(''); setSample(null); setPermission(false)
        setNote(`Cloned “${res.data.name}”. The agent can speak with this voice now.`)
        useUI.getState().toast('Voice cloned', `“${res.data.name}” is ready for the chat.`, 'success')
      } else {
        useUI.getState().toast('Cloning did not finish', res.error, 'danger')
      }
    } finally { setCloning(false) }
  }

  return (
    <Shell title="Voices (VoiceStudio)" ready={ready} credit={credits('voicestudio')}>
      <p className="text-[11.5px] leading-snug" style={muted}>
        Speech in a built-in voice, and cloned voices. The agent may speak with the voices you list below, and nothing else. Cloning starts here, with your sample and the speaker’s permission.
      </p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="VoiceStudio address"
        placeholder={SERVICE_DEFAULTS.voicestudio} autoComplete="off" spellCheck={false}
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off"
        aria-label="VoiceStudio key or PIN (optional)" placeholder={saved.token ? 'Saved — type to replace' : 'Key or PIN (only for a remote VoiceStudio)'}
        className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
      <p className="text-[10.5px]" style={muted}>A VoiceStudio on this machine needs no key. Start it first.</p>
      <button type="button" onClick={save} disabled={busy}
        className="px-3 py-1.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50" style={primary}>
        {busy && <Loader2 size={11} className="animate-spin" />} Save
      </button>
      {note && <InlineAlert status="success" title={note} onClose={() => setNote(null)} />}

      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--surface-border)' }}>
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>Clone a voice</span>
        <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} aria-label="Speaker’s name"
          placeholder="The speaker’s name" maxLength={80}
          className="w-full px-2.5 py-1.5 rounded-[9px] text-[11.5px] outline-none" style={field} />
        <input type="file" accept="audio/*" aria-label="Voice sample"
          onChange={(e) => setSample(e.target.files?.[0] ?? null)}
          className="block w-full text-[11px]" style={muted} />
        <label className="flex items-start gap-2 text-[11px] leading-snug cursor-pointer" style={{ color: 'var(--text-2)' }}>
          <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-0.5" />
          <span>The speaker has given me permission to clone their voice from this recording, and I will use it only as they agreed.</span>
        </label>
        <button type="button" onClick={clone} disabled={!canClone}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-50" style={primary}>
          {cloning && <Loader2 size={11} className="animate-spin" />} Clone voice
        </button>
        {!ready && <p className="text-[10.5px]" style={muted}>Start VoiceStudio or add its address before cloning.</p>}
      </div>

      {consents.length > 0 && (
        <ul className="space-y-1.5 pt-1" aria-label="Voices with permission on record">
          {consents.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
              <Check size={11} aria-hidden style={{ color: 'var(--success)' }} />
              <span className="flex-1 min-w-0 truncate">{c.speaker}</span>
              <span className="text-[10.5px]" style={muted}>{new Date(c.grantedAt).toLocaleDateString()}</span>
              <button type="button" onClick={() => { forgetConsent(c.id); useUI.getState().toast('Removed from the chat', `“${c.speaker}” can no longer be used. The voice stays in VoiceStudio until you delete it there.`, 'info') }}
                aria-label={`Remove ${c.speaker} from the chat`} className="p-1 rounded-md hover:bg-[var(--surface)]" style={muted}>
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {consents.length === 0 && (
        <p className="text-[10.5px]" style={muted}>No cloned voices yet. The built-in voices work as soon as VoiceStudio is running.</p>
      )}
    </Shell>
  )
}

function DictationCard() {
  const voice = useStore((s) => s.settings.voice)
  const settings: SttSettings = {
    mode: voice?.mode ?? 'browser',
    provider: voice?.provider,
    model: voice?.model ?? 'whisper-1',
    localUrl: voice?.localUrl,
    language: voice?.language,
  }
  return (
    <Shell title="Dictation (OpenWhispr’s model)" ready credit={credits('dictation')}>
      <p className="text-[11.5px] leading-snug" style={muted}>
        The microphone in the composer turns speech into text. It works the way OpenWhispr does: a model on your own machine, or your own provider key. Pick one in Settings → Voice.
      </p>
      <div className="flex items-start gap-2 text-[11.5px] leading-snug" style={{ color: 'var(--text-2)' }}>
        <Mic size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>Now: {describeStt(settings)}.</span>
      </div>
      <ul className="text-[10.5px] leading-snug space-y-0.5 list-disc pl-4" style={muted}>
        <li>Self-hosted: a whisper.cpp or faster-whisper server on this machine. Audio never leaves it.</li>
        <li>Bring your own key: an OpenAI-compatible transcription key you already saved. Audio goes to that provider.</li>
      </ul>
    </Shell>
  )
}

/** Credits and the licence of each project, shown on every card that uses it. */
function credits(name: ServiceName | 'dictation'): string {
  switch (name) {
    case 'openseo': return 'Built on OpenSEO by Every App (MIT). Data from DataForSEO, billed by usage.'
    case 'voicestudio': return 'Built on VoiceStudio by Palash Debnath (AGPL-3.0). Model weights carry their own licences; clone only with permission.'
    case 'twenty': return 'Built on Twenty (mostly AGPL-3.0; files marked Enterprise are commercially licensed).'
    case 'postiz': return 'Built on Postiz by Gitroom (AGPL-3.0).'
    case 'dictation': return 'Dictation follows the design of OpenWhispr (MIT, github.com/OpenWhispr/openwhispr).'
  }
}
