import React, { useState } from 'react'
import { Check, Dices, RotateCcw, Sparkles } from 'lucide-react'
import { Blobatar } from '@blobatar/react'
import { happy, idle as idlePose, love, shy, sleepy, smug, surprised, thinking as thinkingPose, unsure, wink } from 'blobatar/expression'
import type { Expression } from 'blobatar/expression'
import { useStore } from '@/stores/useStore'
import { UserAvatar } from '@/components/shared/UserAvatar'
import {
  DEFAULT_PROFILE,
  EXPRESSIONS, blobatarSeed, initialsOf, normalizeHandle, withProfileDefaults,
  type AvatarExpression, type AvatarKind, type AvatarMotion, type AvatarShape,
} from '@/lib/profile'
import { ProfileCard } from '@/components/ui/watermelon/ProfileCard'
import { flattenTags } from '@/lib/ui/skins'
import { smoothCaretProps } from '@/components/input/SmoothText'

const SHAPES: { id: AvatarShape; label: string }[] = [
  { id: 'circle', label: 'Circle' },
  { id: 'squircle', label: 'Squircle' },
  { id: 'square', label: 'Square' },
]

const MOTIONS: { id: AvatarMotion; label: string; hint: string }[] = [
  { id: 'hover', label: 'On hover', hint: 'Breathes when you point at it.' },
  { id: 'always', label: 'Always', hint: 'Keeps moving while you use the app.' },
  { id: 'off', label: 'Still', hint: 'A fixed pose, nothing moves.' },
]

const HUES = [0, 25, 45, 90, 140, 190, 225, 265, 300, 330]

const POSES: Record<AvatarExpression, Expression> = {
  idle: idlePose, happy, thinking: thinkingPose, smug, surprised, wink, sleepy, unsure, shy, love,
}

export function ProfileTab() {
  const settings = useStore((s) => s.settings)
  const set = (partial: { profile: typeof settings.profile; profileName?: string }) =>
    useStore.setState((s) => ({ settings: { ...s.settings, ...partial } }))
  const profile = withProfileDefaults(settings.profile)
  const [saved, setSaved] = useState(false)
  const [handleDraft, setHandleDraft] = useState(profile.handle)
  const [hobbyDraft, setHobbyDraft] = useState<string | null>(null)

  const handle = normalizeHandle(handleDraft) || 'researcher'
  const dirty = handle !== profile.handle

  // Four candidate faces for the re-roll row, so re-rolling is a choice
  // rather than a lottery ticket.
  const variants = ['v1', 'v2', 'v3', 'v4']

  const update = (patch: Partial<typeof profile>) => {
    const next = withProfileDefaults({ ...profile, ...patch })
    set({ profile: next, profileName: next.name })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1400)
  }

  const updateAvatar = (patch: Partial<typeof profile.avatar>) =>
    update({ avatar: { ...profile.avatar, ...patch } })

  const onName = (name: string) => {
    // A fresh profile takes its handle from the name, the way a username does.
    const first = name.trim().split(/\s+/)[0] ?? ''
    const nextHandle = profile.handle === normalizeHandle(handleDraft) && first ? normalizeHandle(first) : profile.handle
    const next = withProfileDefaults({ ...profile, name, handle: nextHandle })
    set({ profile: next, profileName: name })
    if (nextHandle !== profile.handle) setHandleDraft(nextHandle)
  }

  const commitHandle = (raw: string) => {
    const clean = normalizeHandle(raw)
    setHandleDraft(clean)
    if (!clean) return
    update({ handle: clean })
  }

  return (
    <div className="max-w-[620px] space-y-6">
      {/* The same facts the form below edits, as a card you can read at a
          glance — collapsed it answers "who is this?", expanded it shows the
          details and hobbies. */}
      <ProfileCard
        name={profile.name || 'Researcher'}
        handle={handle}
        bio={profile.bio || 'No bio yet — add one line below.'}
        longBio={`Everything here lives in your own data directory. The avatar is a blobatar derived from @${handle}, so the same handle always draws the same creature.`}
        avatar={<UserAvatar size={56} />}
        hobbies={profile.hobbies?.length ? profile.hobbies : DEFAULT_PROFILE.hobbies}
        facts={[
          { label: 'Handle', value: `@${handle}` },
          { label: 'Avatar', value: `${profile.avatar.kind} · ${profile.avatar.shape}` },
          { label: 'Expression', value: profile.avatar.expression },
          { label: 'Motion', value: profile.avatar.motion },
        ]}
      />

      <div>
        <h3 className="text-[15px] font-semibold mb-1">Profile</h3>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Stored on this machine, next to your documents — no account, no server, no telemetry.
          Your avatar is a <b>blobatar</b>: a small creature drawn from your handle, so the same
          handle always produces the same face.
        </p>
      </div>

      {/* Live preview */}
      <div className="rounded-[16px] p-5 flex items-center gap-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <UserAvatar size={92} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium truncate">{profile.name || 'Researcher'}</div>
          <div className="text-[12px] font-mono truncate" style={{ color: 'var(--text-3)' }}>
            @{profile.handle || 'researcher'}
          </div>
          <div className="text-[11.5px] mt-1 truncate" style={{ color: 'var(--text-3)' }}>
            seed <span className="font-mono">{blobatarSeed(profile)}</span>
          </div>
          {saved && (
            <div className="flex items-center gap-1 text-[11.5px] mt-1.5" style={{ color: 'var(--primary)' }}>
              <Check size={12} /> Saved
            </div>
          )}
        </div>
      </div>

      {/* Name + handle */}
      <div className="space-y-3">
        <Field label="Display name">
          <input
            value={profile.name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Researcher"
            maxLength={40}
            aria-label="Display name"
            className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
            style={inputStyle}
          />
        </Field>

        <Field label="Handle" hint="lowercase letters, numbers, dot, dash and underscore — 32 max">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center rounded-[10px] overflow-hidden" style={inputStyle}>
              <span className="pl-3 text-[13px] select-none" style={{ color: 'var(--text-3)' }}>@</span>
              <input
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                onBlur={(e) => commitHandle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitHandle((e.target as HTMLInputElement).value) }}
                placeholder="ada"
                aria-label="Handle"
                className="flex-1 px-2 py-2 bg-transparent text-[13px] font-mono outline-none"
                style={{ color: 'var(--text)' }}
              />
            </div>
            <button
              onClick={() => commitHandle(handleDraft)}
              disabled={!dirty}
              className="px-3 py-2 rounded-[10px] text-[12.5px] font-medium disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              Rebuild
            </button>
          </div>
        </Field>

        <Field label="Bio">
          <textarea
            value={profile.bio}
            onChange={(e) => update({ bio: e.target.value })}
            rows={2}
            maxLength={160}
            placeholder="What are you working on?"
            aria-label="Bio"
            className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none resize-none"
            style={inputStyle}
          />
        </Field>

        {/* Hobbies — chips on the profile card, and useful context for the AI. */}
        <Field label="Hobbies & interests">
          <input
            value={hobbyDraft ?? (profile.hobbies ?? []).join(', ')}
            onChange={(e) => {
              setHobbyDraft(e.target.value)
              update({ hobbies: flattenTags(e.target.value) })
            }}
            onBlur={() => setHobbyDraft(null)}
            placeholder="research, climbing, film photography"
            aria-label="Hobbies"
            className="w-full px-3 py-2 rounded-[10px] text-[13px] outline-none"
            style={inputStyle}
            {...smoothCaretProps()}
          />
          {(profile.hobbies ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(profile.hobbies ?? []).map((h) => (
                <span key={h} className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--text-2)' }}>{h}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-3)' }}>
            Comma-separated. Shown on your profile card and offered as context when you ask for something broad.
          </p>
        </Field>
      </div>

      {/* Avatar */}
      <div className="rounded-[16px] p-4 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Sparkles size={14} style={{ color: 'var(--primary)' }} /> Avatar
          </div>
          <div className="flex items-center rounded-full p-0.5" style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)' }}>
            {(['blobatar', 'initials'] as AvatarKind[]).map((k) => (
              <button key={k} onClick={() => updateAvatar({ kind: k })}
                className="px-2.5 py-1 rounded-full text-[11.5px] capitalize"
                style={{ background: profile.avatar.kind === k ? 'var(--surface)' : 'transparent', color: profile.avatar.kind === k ? 'var(--text)' : 'var(--text-3)' }}>
                {k === 'blobatar' ? 'Blobatar' : `Initials (${initialsOf(profile)})`}
              </button>
            ))}
          </div>
        </div>

        <Field label="Shape">
          <div className="flex gap-2">
            {SHAPES.map((s) => (
              <button key={s.id} onClick={() => updateAvatar({ shape: s.id })}
                className="flex-1 py-2 rounded-[10px] text-[12.5px]"
                style={{
                  background: profile.avatar.shape === s.id ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)',
                  border: `1px solid ${profile.avatar.shape === s.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                  color: profile.avatar.shape === s.id ? 'var(--primary)' : 'var(--text-2)',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Motion">
          <div className="flex gap-2">
            {MOTIONS.map((m) => (
              <button key={m.id} onClick={() => updateAvatar({ motion: m.id })} title={m.hint}
                className="flex-1 py-2 rounded-[10px] text-[12.5px]"
                style={{
                  background: profile.avatar.motion === m.id ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)',
                  border: `1px solid ${profile.avatar.motion === m.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                  color: profile.avatar.motion === m.id ? 'var(--primary)' : 'var(--text-2)',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Expression">
          <div className="flex flex-wrap gap-1.5">
            {EXPRESSIONS.map((e) => (
              <button key={e.id} onClick={() => updateAvatar({ expression: e.id as AvatarExpression })}
                className="px-2.5 py-1 rounded-full text-[11.5px]"
                style={{
                  background: profile.avatar.expression === e.id ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)',
                  border: `1px solid ${profile.avatar.expression === e.id ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                  color: profile.avatar.expression === e.id ? 'var(--primary)' : 'var(--text-2)',
                }}>
                {e.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Colour" hint="Auto lets the handle pick the colour">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => updateAvatar({ hue: null })}
              className="px-3 py-1.5 rounded-full text-[11.5px]"
              style={{
                background: profile.avatar.hue == null ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'var(--elevated)',
                border: `1px solid ${profile.avatar.hue == null ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--surface-border)'}`,
                color: profile.avatar.hue == null ? 'var(--primary)' : 'var(--text-2)',
              }}>
              Auto
            </button>
            {HUES.map((h) => (
              <button key={h} onClick={() => updateAvatar({ hue: h })}
                aria-label={`Hue ${h}`}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: `hsl(${h} 65% 55%)`,
                  border: profile.avatar.hue === h ? '2px solid var(--text)' : '2px solid transparent',
                }} />
            ))}
          </div>
        </Field>

        <Field label="Re-roll" hint="Keeps your handle, draws a different creature">
          <div className="flex items-center gap-2">
            {variants.map((v, i) => {
              const salt = i === 0 ? '' : v
              const chosen = (profile.avatar.salt || '') === salt
              return (
                <button key={v} onClick={() => updateAvatar({ salt })}
                  title={i === 0 ? 'Your handle on its own' : `Re-rolled look ${i}`}
                  aria-label={i === 0 ? 'Original avatar' : `Re-rolled avatar ${i}`}
                  className="rounded-[12px] p-1 transition-transform hover:scale-105"
                  style={{
                    background: 'var(--elevated)',
                    border: `1px solid ${chosen ? 'color-mix(in srgb, var(--primary) 60%, transparent)' : 'var(--surface-border)'}`,
                  }}>
                  <Blobatar name={`${profile.handle || 'researcher'}${salt ? `#${salt}` : ''}`} size={44}
                    background={profile.avatar.shape}
                    {...(profile.avatar.hue == null ? {} : { hue: profile.avatar.hue })}
                    expression={POSES[profile.avatar.expression] ?? idlePose}
                    style={{ display: 'block', borderRadius: 10 }} />
                </button>
              )
            })}
            <button onClick={() => updateAvatar({ salt: `r${Date.now().toString(36).slice(-4)}` })}
              aria-label="Surprise me — same handle, new look"
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px]"
              style={{ background: 'var(--elevated)', border: '1px solid var(--surface-border)', color: 'var(--text-2)' }}>
              <Dices size={13} /> Surprise me
            </button>
          </div>
        </Field>

        <button onClick={() => update({ avatar: { kind: 'blobatar', shape: 'circle', motion: 'hover', expression: 'idle', hue: null, salt: '' } })}
          className="flex items-center gap-1.5 text-[11.5px]"
          style={{ color: 'var(--text-3)' }}>
          <RotateCcw size={12} /> Reset the avatar
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--elevated)',
  border: '1px solid var(--surface-border)',
  color: 'var(--text)',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
        {hint && <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{hint}</span>}
      </div>
      {children}
    </label>
  )
}
