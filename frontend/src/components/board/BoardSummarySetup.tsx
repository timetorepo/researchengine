import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/stores/useStore'
import { activeNamespace } from '@/lib/security/lock'
import { providerById } from '@/lib/providers/registry'
import { usableKey } from '@/lib/providers/keys'
import { streamToCallback, usageOfError, type TokenUsage } from '@/lib/providers/stream'
import { reviewedOutboundWouldChange } from '@/lib/privacy/shield'
import { assertBudget, recordTokens } from '@/lib/usage/guard'
import { checkedAgentUsage } from '@/lib/agents/multiAgent'
import { boardWritesFrozen } from '@/lib/board/storage'
import type { BoardSnapshot } from '@/lib/board/session'
import { applyReviewedSummary, parseSummaryResponse, prepareSummaryRequest, previewSummaryContext, summarySavings, type SummaryItem, type SummaryRequest } from '@/lib/board/summary'

type Draft = { request: SummaryRequest; rawResponse: string; usage: TokenUsage; generatedAt: string }
export default function BoardSummarySetup({ source, namespace, onAccept }: { source: BoardSnapshot; namespace: string; onAccept: (snapshot: BoardSnapshot) => void }) {
  const [input, setInput] = useState(source.inputBudget)
  const [output, setOutput] = useState(Math.min(1000, source.outputBudget))
  const [sendConsent, setSendConsent] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [partial, setPartial] = useState('')
  const [lastUsage, setLastUsage] = useState<TokenUsage>()
  const [draft, setDraft] = useState<Draft>()
  const [items, setItems] = useState<SummaryItem[]>([])
  const alive = useRef(true), controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
  useEffect(() => { controller.current?.abort(); setDraft(undefined); setItems([]); setPartial(''); setSendConsent(false); setReviewed(false); setError(''); setLastUsage(undefined) }, [source, input, output])
  const scoped = () => activeNamespace() === namespace && !boardWritesFrozen()
  let request: SummaryRequest | undefined, requestError = ''
  try { request = prepareSummaryRequest(source, input, output) } catch (e) { requestError = e instanceof Error ? e.message : 'Cannot prepare summary request.' }
  let preview: ReturnType<typeof previewSummaryContext> | undefined, reviewError = ''
  if (draft) {
    try { preview = previewSummaryContext(source, items) } catch (e) { reviewError = e instanceof Error ? e.message : 'Cannot use these briefs.' }
  }
  const savings = preview ? summarySavings(source, preview) : undefined
  function pinned() {
    if (!scoped()) throw new Error('Workspace changed or was wiped. Close this dialog and prepare the evidence again.')
    const settings = useStore.getState().settings, meta = providerById(source.providerId), config = settings.providers[source.providerId]
    if (!meta || meta.kind === 'decision' || !(settings.addedProviders ?? []).includes(source.providerId) || !settings.providerModels[source.providerId]?.includes(source.model) || settings.hiddenModels?.includes(`${source.providerId}:${source.model}`)) throw new Error('The reviewed summary model is no longer configured. No substitute was used.')
    if ((config?.baseUrl || meta.baseUrl).replace(/\/$/, '') !== source.endpoint) throw new Error('Summary endpoint changed after preparation. Prepare a new snapshot; no request was sent.')
    return { settings, meta, config }
  }
  async function generate() {
    if (!request || !sendConsent || controller.current) return
    const plan = request, abort = new AbortController()
    controller.current = abort; setBusy(true); setDraft(undefined); setItems([]); setPartial(''); setError(''); setReviewed(false); setSendConsent(false); setLastUsage(undefined)
    let raw = '', accounted = false
    try {
      const { settings, meta, config } = pinned()
      for (const text of [plan.system, plan.prompt]) if (reviewedOutboundWouldChange(text)) throw new Error('Privacy Shield would change the reviewed summary request. Blocked instead of silently redacting sources.')
      assertBudget()
      const apiKey = await usableKey(config?.apiKey)
      if (meta.needsKey && !apiKey) throw new Error('The selected provider key is unavailable. No fallback was used.')
      pinned(); assertBudget()
      for (const text of [plan.system, plan.prompt]) if (reviewedOutboundWouldChange(text)) throw new Error('Privacy Shield changed before sending. Prepare and review the context again.')
      if (abort.signal.aborted || !alive.current) throw new Error('Summary cancelled before sending.')
      const result = await streamToCallback({ providerId: source.providerId, model: source.model, apiKey, baseUrl: source.endpoint, system: plan.system, exactSystem: true, proxyOllama: true, messages: [{ role: 'user', content: plan.prompt }], maxTokens: plan.outputBudget, temperature: 0.2, timeoutMs: (settings.providerTimeouts?.[source.providerId] ?? 45) * 1000, signal: abort.signal }, chunk => {
        raw += chunk
        if (alive.current && scoped() && !abort.signal.aborted) setPartial(raw)
      })
      checkedAgentUsage(result.usage)
      if (alive.current && scoped()) setLastUsage(result.usage)
      if (scoped()) { recordTokens(result.usage.total); accounted = true }
      if (abort.signal.aborted || !alive.current || !scoped()) throw new Error('Summary stopped or workspace changed.')
      if (result.toolCalls.length) throw new Error('Summary model requested tools. None were executed; this output cannot be used.')
      const parsed = parseSummaryResponse(raw, source)
      setDraft({ request: plan, rawResponse: raw, usage: result.usage, generatedAt: new Date().toISOString() }); setItems(parsed)
    } catch (e) {
      const usage = usageOfError(e)
      if (scoped() && usage && !accounted) { try { checkedAgentUsage(usage); recordTokens(usage.total); if (alive.current) setLastUsage(usage) } catch { /* Invalid usage is not a trustworthy measurement. */ } }
      if (alive.current) setError(abort.signal.aborted ? 'Stopped. Partial output cannot be used. Provider charges may still apply.' : e instanceof Error ? e.message : 'Summary request failed. Original evidence is unchanged.')
    } finally {
      if (controller.current === abort) controller.current = undefined
      if (alive.current) setBusy(false)
    }
  }
  function accept() {
    if (!preview || !draft || !reviewed || busy) return
    if (!scoped()) { setError('Workspace changed or was wiped. Prepare and review the evidence again.'); return }
    try { onAccept(applyReviewedSummary(source, { ...draft, items })) } catch (e) { setError(e instanceof Error ? e.message : 'Cannot accept this summary.') }
  }
  return <section className="re-board-summary" aria-label="Board summary preparation">
    <h2>Make a shorter, reviewable context draft</h2>
    <p>This optional step sends all {source.includedIds.length} selected sources to <strong>{source.providerId} · {source.model}</strong> at {source.endpoint}. It makes one model request and can cost tokens before your analysis or agent run. It is off by default; no automatic retry, fallback or tools.</p>
    <p>A summary is lossy and can be wrong. Compare each brief with its original before use. Original evidence stays available locally; it is not silently replaced on your Board. This draft is lost when the dialog closes unless accepted into a session or agent setup.</p>
    <fieldset disabled={busy} className="re-board-summary-budgets">
      <label>Summary input budget (estimated tokens)<input className="bui-field" aria-label="Summary input budget" type="number" min={1} value={input} onChange={e => setInput(e.target.value === '' ? 0 : e.target.valueAsNumber)} /></label>
      <label>Summary maximum output tokens<input className="bui-field" aria-label="Summary maximum output tokens" type="number" min={1} value={output} onChange={e => setOutput(e.target.value === '' ? 0 : e.target.valueAsNumber)} /></label>
    </fieldset>
    <p>Generation input estimate: {request?.estimate.toLocaleString() ?? 'unavailable'} tokens. Maximum requested output: {output.toLocaleString()}. Characters ÷ 4 is a heuristic, not exact billing or a context-window guarantee. Too-large requests block; nothing is truncated. One summary call may cost more than it saves. Changing budgets discards this draft; previous generation usage remains counted.</p>
    <details><summary>Review exact summary-generation request</summary><pre>{request ? JSON.stringify({ providerId: source.providerId, endpoint: source.endpoint, model: source.model, system: request.system, messages: [{ role: 'user', content: request.prompt }], maxTokens: request.outputBudget, temperature: 0.2 }, null, 2) : requestError}</pre></details>
    <label><input type="checkbox" disabled={busy} checked={sendConsent} onChange={e => setSendConsent(e.target.checked)} /> I consent to send the selected original text to this pinned provider/model to generate summaries. Charges may apply.</label>
    {requestError && <p role="alert">{requestError}</p>}
    {busy ? <p role="status">Generating summary draft… <button className="bui-button" onClick={() => controller.current?.abort()}>Stop summary generation</button></p> : <button className="bui-button" disabled={!sendConsent || !request} onClick={() => void generate()}>Generate consented summary</button>}
    {partial && <details><summary>Raw provider output {draft ? '(complete)' : '(not accepted)'}</summary><pre>{partial}</pre></details>}
    {error && <p role="alert">{error}</p>}
    {!draft && lastUsage && <p>{lastUsage.reported ? 'Provider-reported' : 'Estimated'} generation usage: {lastUsage.total.toLocaleString()} tokens. A failed fidelity/format check does not undo provider charges.</p>}
    {draft && <div>
      <p role="status">Summary draft ready for fidelity review. Generating again replaces this draft and can incur another charge. {draft.usage.reported ? 'Provider-reported' : 'Estimated'} generation usage: {draft.usage.total.toLocaleString()} tokens.</p>
      {items.map((item, index) => <fieldset className="re-board-summary-source" key={item.id}><legend>{source.agentSources?.find(value => value.id === item.id)?.label}</legend>
        <details><summary>Compare original evidence [board:{item.id}]</summary><pre>{source.agentSources?.find(value => value.id === item.id)?.content}</pre></details>
        <label>Editable brief for [board:{item.id}]<textarea className="bui-field" aria-label={`Summary brief ${index + 1}`} rows={5} value={item.text} onChange={e => { setItems(values => values.map(value => value.id === item.id ? { ...value, text: e.target.value } : value)); setReviewed(false) }} /></label>
      </fieldset>)}
      {reviewError && <p role="alert">{reviewError}</p>}
      {savings && <p>Downstream snapshot estimate: {savings.brief.toLocaleString()} input tokens versus {savings.original.toLocaleString()} for the selected original context, before future replies. {savings.brief >= savings.original ? 'This brief does not reduce estimated input.' : 'This does not include the cost of generating this summary or guarantee lower total billing.'}</p>}
      <details><summary>Review exact derived context for downstream use</summary><pre>{preview ? preview.system + '\n\n' + preview.prompt : reviewError}</pre></details>
      <p>Accepted briefs retain the original request/evidence, generated output, your edits and generation usage locally with a snapshot session or agent run. Agents receive only assigned briefs/provenance, not that local original-evidence audit. Neither is encrypted by this feature; keep exports/browser storage private. No automatic fidelity certification.</p>
      <label><input type="checkbox" checked={reviewed} disabled={!preview} onChange={e => setReviewed(e.target.checked)} /> I compared each brief with the original and reviewed qualifications, citations and omissions. Use these lossy briefs instead of original text.</label>
      <button className="bui-button" disabled={!preview || !reviewed || busy} onClick={accept}>Use reviewed summary context</button>
    </div>}
  </section>
}
