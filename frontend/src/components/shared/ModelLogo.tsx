import React, { useState } from 'react'
import { ProviderLogo } from './ProviderLogo'
import { modelFamily, type Family } from '@/lib/providers/families'

/**
 * The mark beside a model's name. Two shapes, one component.
 *
 * **By provider** — `<ModelLogo providerId="openai" size={26} />` — the original
 * behaviour used by the Dynamic Island: the provider's real favicon inside a
 * tile, falling back to the bundled inline SVG when the request fails or the
 * provider is not mapped. Fully offline-safe.
 *
 * **By model** — `<ModelLogo model="llama-3.3-70b" provider="groq" />` — what the
 * model picker uses: a *family* mark when the model id names a family we can
 * draw, otherwise **the provider's** mark. No network at all on this path, so
 * the picker renders identically offline.
 */

// Provider → official domain, used to fetch the real logo from a logo/favicon
// service. Fully offline-safe: on any failure we fall back to the bundled SVG.
const PROVIDER_DOMAINS: Record<string, string> = {
  openai: 'openai.com',
  anthropic: 'anthropic.com',
  groq: 'groq.com',
  ollama: 'ollama.com',
  nim: 'nvidia.com',
  together: 'together.ai',
  mistral: 'mistral.ai',
  lmstudio: 'lmstudio.com',
}

/** Provider tile: a real favicon when it can be had, the bundled mark otherwise. */
function ProviderTile({ providerId, size = 40, rounded = 12 }: { providerId: string; size?: number; rounded?: number }) {
  const domain = PROVIDER_DOMAINS[providerId]
  const [failed, setFailed] = useState(false)

  if (!domain || failed) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size, borderRadius: rounded, background: 'var(--elevated)', color: 'var(--primary)', border: '1px solid var(--surface-border)' }}
      >
        <ProviderLogo id={providerId} size={Math.round(size * 0.55)} />
      </span>
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      width={size}
      height={size}
      alt={`${providerId} logo`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-cover"
      style={{ borderRadius: rounded, background: '#fff', border: '1px solid var(--surface-border)' }}
    />
  )
}

/* --------------------------------------------------------- family marks ---- */

const S = (size: number) => ({ width: size, height: size })

/**
 * Marks drawn as paths. Kept simple and geometric on purpose: at 15px a wrong
 * logo is worse than a clean monogram, so anything we cannot draw faithfully
 * falls through to the provider's mark.
 */
function FamilyMark({ family, size }: { family: Family; size: number }) {
  switch (family.mark) {
    case 'llama':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M3.5 17c2.2 0 3.4-1.2 4.2-3.2.9-2.2 1.7-4 3.6-4 1.6 0 2.4 1 3 2.4" />
          <path d="M7.6 8.6c.5-2 2-3.4 4.3-3.4 3.3 0 5.4 2.3 5.4 5.6 0 3.6-2.4 6.2-6 6.2" />
          <circle cx="16.6" cy="9.4" r=".9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'qwen':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 2.6l8.1 4.7v9.4L12 21.4 3.9 16.7V7.3z" />
          <path d="M12 7.4l3.9 2.3v4.6L12 16.6l-3.9-2.3V9.7z" fill="currentColor" stroke="none" opacity=".9" />
        </svg>
      )
    case 'deepseek':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.6 2.4c3.6 0 6.6 2.5 7.5 5.9.5 1.9 1.2 2.6 1.6 4.2.5 2-.4 4.4-1.8 5.3-.5.3-.9-.1-1.1-.7-.8-2.2-2.4-3.7-4.6-4.5-.4-.1-.5-.6-.2-.9.6-.6.8-1.5.5-2.3-.4-1.2-1.6-1.9-2.8-1.7-.5.1-.9-.4-.7-.9.4-1.1 1-2 1.6-4.4zM6.4 7.1c.4 0 .6.5.3.8-1.3 1.5-2 3.4-2 5.5 0 2 .7 3.9 2 5.4 1.2 1.5 3 2.4 5.1 2.6.3 0 .5.3.4.6-.1.4-.5.6-.9.5-2.6-.5-4.8-1.7-6.2-3.5-1.3-1.7-2-3.7-1.9-5.9 0-2.3.9-4.4 2.5-5.8.2-.1.4-.2.7-.2z" />
        </svg>
      )
    case 'gemma':
    case 'gemini':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2c.35 4.9 5.1 7.65 8.5 7.65.35 0 .7.35.7.7s-.35.7-.7.7c-3.4 0-8.15 2.75-8.5 7.65-.04.4-.35.7-.7.7s-.66-.3-.7-.7C10.25 13.75 5.5 11 2.1 11c-.35 0-.7-.35-.7-.7s.35-.7.7-.7c3.4 0 8.15-2.75 8.5-7.65.04-.4.35-.7.7-.7s.66.3.7.7z" />
        </svg>
      )
    case 'claude':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.6 3.5h2.2l6.7 17h-2.9l-1.5-3.9h-7.3l-1.6 3.9H4.9l6.7-17h1zm1.1 3.4-2.8 7.2h5.7l-2.9-7.2z" />
        </svg>
      )
    case 'gpt':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.5 4.5zM3.6 17.25a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 18.9a4.5 4.5 0 0 1-6.14-1.65zM2.34 6.82a4.49 4.49 0 0 1 2.37-1.97V10.5a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0L4 12.91a4.5 4.5 0 0 1-1.66-6.1zm16.6 3.86-5.83-3.39L15.12 6.1a.07.07 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.62a.79.79 0 0 0-.4-.68zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 8.17V5.83a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM7.08 12.68 5.06 11.5a.08.08 0 0 1-.04-.05V5.87a4.5 4.5 0 0 1 7.4-3.45l-.14.08L7.5 5.26a.79.79 0 0 0-.4.68zm1.09-2.36 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
        </svg>
      )
    case 'grok':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 3h4.1l5 6.9L17.4 3H21l-7 8.9L21.4 21h-4.1l-5.2-7.2L6.4 21H3l7.2-9.2z" />
        </svg>
      )
    case 'mistral':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 7h3v10H3zm4.5 0h3v4.6h-3zm0 5.4h3V17h-3zM12 7h3v10h-3zm4.5-4h3v4.6h-3zm0 5.4h3V17h-3z" />
        </svg>
      )
    case 'glm':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5 5h14l-9.5 14H19" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 5v6" strokeLinecap="round" />
        </svg>
      )
    case 'kimi':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.4 15.6A9 9 0 0 1 8.4 3.6a9 9 0 1 0 12 12z" />
        </svg>
      )
    case 'mercury':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <circle cx="12" cy="10" r="3.4" />
          <path d="M9.2 12.8L6.6 21M14.8 12.8l2.6 8.2M8 18.6h8" strokeLinecap="round" />
          <path d="M5.4 5.6C3.9 7 3 9 3 11.2c0 1.5.4 2.9 1.2 4.1M18.6 5.6C20.1 7 21 9 21 11.2c0 1.5-.4 2.9-1.2 4.1" strokeLinecap="round" opacity=".55" />
        </svg>
      )
    case 'nemotron':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 4.5C7 4.5 3.2 8 2 12c1.2 4 5 7.5 10 7.5S20.8 16 22 12c-1.2-4-5-7.5-10-7.5zm0 11.4a3.9 3.9 0 1 1 0-7.8 3.9 3.9 0 0 1 0 7.8z" />
        </svg>
      )
    case 'command':
      return (
        <svg {...S(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M8.5 4.5a4 4 0 1 0 0 8h7a4 4 0 1 0 0-8" strokeLinecap="round" />
          <path d="M8.5 19.5a4 4 0 1 1 0-8h7a4 4 0 1 1 0 8" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

/** A letter tile for families we do not draw — stable hue, no invented logo. */
function Monogram({ family, size }: { family: Family; size: number }) {
  const letters = family.mono ?? family.label.slice(0, 2)
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.max(4, size * 0.28),
        background: `hsl(${family.hue} 62% 46% / 0.18)`,
        color: `hsl(${family.hue} 68% 58%)`,
        fontSize: Math.max(7, size * (letters.length > 2 ? 0.36 : 0.46)),
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      {letters}
    </span>
  )
}

/** The family-aware mark. Provider is the fallback, as asked. */
function FamilyAwareModelLogo({ model, provider, size }: { model: string; provider: string; size: number }) {
  const family = modelFamily(model)
  if (!family) return <ProviderLogo id={provider} size={size} />
  const mark = family.mark === 'mono' ? null : <FamilyMark family={family} size={size} />
  return mark ?? <Monogram family={family} size={size} />
}

/**
 * One component, two call shapes:
 *   <ModelLogo model="qwen2.5-coder" provider="groq" size={15} />
 *   <ModelLogo providerId="openai" size={26} rounded={8} />
 */
export function ModelLogo(props: {
  model?: string
  provider?: string
  providerId?: string
  size?: number
  rounded?: number
}) {
  const { model, provider, providerId, size = 16, rounded = 12 } = props
  if (model && provider) return <FamilyAwareModelLogo model={model} provider={provider} size={size} />
  return <ProviderTile providerId={(providerId ?? provider ?? 'custom')} size={size} rounded={rounded} />
}

/** The tooltip label: which family the mark stands for, for the curious. */
export function modelLogoLabel(model: string, providerName: string): string {
  const family = modelFamily(model)
  return family ? `${family.label} model on ${providerName}` : `${providerName} model`
}
