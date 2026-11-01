/**
 * Advanced settings. Kept out of the everyday tabs on purpose: each option here
 * changes where data goes or how the app reaches a service.
 *
 * The Composio endpoint is the only one for now. The hosted API is the default
 * and the recommendation. A self-hosted Composio gateway is for teams with data
 * residency or network-boundary rules; it needs Docker, a KMS and ingress in
 * your own infrastructure. The server checks the URL before it is used.
 */
import React, { useState } from 'react'
import { ExternalLink, Server, Cloud, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/stores/useStore'
import { Button } from '@/components/ui/heroui/Button'
import { Input } from '@/components/ui/heroui/Input'
import { InlineAlert } from '@/components/ui/heroui/InlineAlert'
import { checkComposio } from '@/lib/composio/client'
import { composioEndpointProblem } from '@/lib/composio/endpoint'

const HOSTED = 'https://backend.composio.dev'
export function AdvancedSection() {
  const endpoint = useStore((s) => s.settings.composio?.endpoint ?? '')
  const [choice, setChoice] = useState<'hosted' | 'self'>(endpoint.trim() ? 'self' : 'hosted')
  const selfHosted = choice === 'self'
  const [draft, setDraft] = useState(endpoint)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const problem = composioEndpointProblem(draft)
  const dirty = draft.trim() !== endpoint.trim()

  const save = (value: string) => {
    useStore.setState((s) => ({ settings: { ...s.settings, composio: { ...s.settings.composio, endpoint: value.trim() } } }))
    setDraft(value.trim())
    setTest(null)
    setSaved(true)
  }

  const runTest = async () => {
    setTesting(true)
    setTest(null)
    const res = await checkComposio()
    setTesting(false)
    if (res.ok) setTest({ ok: true, text: `Reached the Composio endpoint${typeof res.apps === 'number' ? `; it lists ${res.apps} apps` : ''}.` })
    else setTest({ ok: false, text: res.error ?? 'The endpoint did not answer the key check.' })
  }

  return (
    <section className="surface-elevated p-4 mt-6" style={{ borderRadius: 'var(--radius-card)' }} aria-labelledby="advanced-heading">
      <div className="flex items-center gap-2 mb-1">
        <Server size={16} strokeWidth={1.6} style={{ color: 'var(--primary)' }} aria-hidden />
        <h3 id="advanced-heading" className="text-[14px] font-semibold">Advanced</h3>
      </div>
      <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>
        Options that change where requests go. Most people should leave these alone.
      </p>

      <h4 className="text-[13px] font-semibold mb-1">Composio endpoint</h4>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--text-3)' }}>
        Connect and Marketplace talk to Composio through this address.
      </p>

      <div role="radiogroup" aria-label="Composio endpoint" className="grid gap-2 sm:grid-cols-2 mb-3">
        <button
          type="button"
          role="radio"
          aria-checked={!selfHosted}
          onClick={() => { setChoice('hosted'); save('') }}
          className="text-left rounded-[14px] p-3 transition-colors"
          style={{
            border: `1px solid ${!selfHosted ? 'var(--primary)' : 'var(--surface-border)'}`,
            background: !selfHosted ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)',
          }}
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <Cloud size={14} aria-hidden /> Hosted API
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)', color: 'var(--primary-foreground, #fff)' }}>Recommended</span>
          </span>
          <span className="block text-[11.5px] mt-1.5" style={{ color: 'var(--text-2)' }}>
            Works immediately with your Composio key. Nothing to run or maintain. Requests go to {HOSTED}.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selfHosted}
          onClick={() => { setChoice('self'); setDraft(endpoint || 'https://') }}
          className="text-left rounded-[14px] p-3 transition-colors"
          style={{
            border: `1px solid ${selfHosted ? 'var(--primary)' : 'var(--surface-border)'}`,
            background: selfHosted ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)',
          }}
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <Server size={14} aria-hidden /> Self-hosted gateway
          </span>
          <span className="block text-[11.5px] mt-1.5" style={{ color: 'var(--text-2)' }}>
            For data-residency or network-boundary rules. Composio's self-host is an enterprise deployment: Docker, a key store and ingress in your own infrastructure.
          </span>
        </button>
      </div>

      {!selfHosted && (
        <InlineAlert status="default" title="Hosted is the better choice for most people">
          Self-hosting is a substantial project. Unless your organisation requires that requests never leave its network, use the hosted API.
          {' '}
          <a className="underline inline-flex items-center gap-1" href="https://composio.dev/content/self-hosted-mcp-gateway" target="_blank" rel="noreferrer">
            Read about self-hosting <ExternalLink size={11} aria-hidden />
          </a>
        </InlineAlert>
      )}

      {selfHosted && (
        <div className="mt-3">
          <Input
            label="Gateway address"
            value={draft}
            onChange={setDraft}
            placeholder="https://composio.your-company.internal"
            description="https only. Plain http works only for localhost."
            isInvalid={!!problem}
            errorMessage={problem ?? undefined}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" disabled={!!problem || !dirty} onClick={() => save(draft)}>Save endpoint</Button>
            <Button size="sm" variant="bordered" color="default" disabled={!!problem || testing} isLoading={testing} onClick={() => { void runTest() }}>
              Test connection
            </Button>
            <Button size="sm" variant="ghost" color="default" onClick={() => { setChoice('hosted'); save('') }}>Use the hosted API</Button>
          </div>
        </div>
      )}

      {saved && !dirty && (
        <div className="mt-3">
          <InlineAlert status="success" title="Endpoint saved" onClose={() => setSaved(false)}>
            {endpoint.trim() ? 'Connect and Marketplace now use your gateway. Your Composio key is unchanged.' : 'Connect and Marketplace use the hosted API.'}
          </InlineAlert>
        </div>
      )}

      {test && (
        <div className="mt-3">
          <InlineAlert status={test.ok ? 'success' : 'danger'} title={test.ok ? 'Connection works' : 'Connection failed'}>
            {test.text}
          </InlineAlert>
        </div>
      )}

      {endpoint.trim() && !test && (
        <p className="mt-3 text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
          <CheckCircle2 size={12} aria-hidden /> Your key is sent to this gateway on each request. It is not stored on the server.
        </p>
      )}
    </section>
  )
}
