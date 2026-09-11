import React, { useState } from 'react'
import { ProviderLogo } from './ProviderLogo'

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

export function ModelLogo({ providerId, size = 40, rounded = 12 }: { providerId: string; size?: number; rounded?: number }) {
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
