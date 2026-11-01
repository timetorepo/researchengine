import React, { useMemo } from 'react'
import { Blobatar } from '@blobatar/react'
import { happy, idle, love, shy, sleepy, smug, surprised, thinking as thinkingPose, unsure, wink } from 'blobatar/expression'
import type { Expression } from 'blobatar/expression'
import { useStore } from '@/stores/useStore'
import { blobatarSeed, initialsOf, withProfileDefaults, type AvatarExpression } from '@/lib/profile'
// NOTE: 'blobatar/motion.css' is imported once from main.tsx — animated
// blobatars need it, and keeping it out of this module lets the pure-DOM test
// harness mount the avatar without a CSS loader.

const POSES: Record<AvatarExpression, Expression> = {
  idle, happy, thinking: thinkingPose, smug, surprised, wink, sleepy, unsure, shy, love,
}

/**
 * The profile's face.
 *
 * With `kind: 'blobatar'` the face is generated from the handle by blobatar
 * (https://blobatar.dev) — deterministic, so the same handle is always the same
 * creature, and animated on hover so it feels alive without being a distraction.
 * With `kind: 'initials'` it is the theme-coloured initials circle, and any
 * failure to draw falls back to that rather than an empty box.
 */
export function UserAvatar({
  size = 28, className = '', style, title,
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
  title?: string
}) {
  const profile = withProfileDefaults(useStore((s) => s.settings.profile))
  const initials = initialsOf(profile)
  const seed = useMemo(() => blobatarSeed(profile), [profile.handle, profile.avatar.salt, profile.name])
  const shape = profile.avatar.shape
  const radius = shape === 'circle' ? '50%' : shape === 'squircle' ? '28%' : '14%'
  const useBlobatar = profile.avatar.kind === 'blobatar' && size >= 20

  const initialsFace = (
    <span
      className="flex items-center justify-center font-semibold select-none"
      style={{
        width: size, height: size, borderRadius: radius,
        background: 'color-mix(in srgb, var(--primary) 22%, transparent)',
        color: 'var(--primary)',
        fontSize: Math.max(8, Math.round(size * 0.38)),
        ...style,
      }}
    >
      {initials}
    </span>
  )

  if (!useBlobatar) return <span className={className} title={title}>{initialsFace}</span>

  return (
    <span className={className} title={title ?? `@${profile.handle}`} style={{ display: 'inline-flex', position: 'relative' }}>
      {initialsFace}
      <span style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden' }}>
        <Blobatar
          name={seed}
          size={size}
          background={shape === 'circle' ? 'circle' : shape === 'squircle' ? 'squircle' : 'square'}
          // A locked hue lets the user keep a colour they like while the
          // handle keeps deciding the shape.
          {...(profile.avatar.hue == null ? {} : { hue: profile.avatar.hue })}
          expression={POSES[profile.avatar.expression] ?? idle}
          {...(profile.avatar.motion === 'off' ? {} : { animate: profile.avatar.motion })}
          style={{ display: 'block', width: size, height: size, borderRadius: radius }}
        />
      </span>
    </span>
  )
}

/** The same face at a size a profile header wants, plus the handle underneath. */
export function ProfileCardAvatar({ size = 96 }: { size?: number }) {
  const profile = withProfileDefaults(useStore((s) => s.settings.profile))
  return (
    <div className="flex flex-col items-center gap-2">
      <UserAvatar size={size} />
      <div className="text-center">
        <div className="text-[13.5px] font-medium">{profile.name || 'Researcher'}</div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>@{profile.handle || 'researcher'}</div>
      </div>
    </div>
  )
}
