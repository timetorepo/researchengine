import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Swords, Send, Crown, Merge, Loader2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { PROVIDERS } from '@/lib/providers/registry'
import { streamToCallback } from '@/lib/providers/stream'
import { streamDemo } from '@/lib/providers/demo'
import { resolveKey } from '@/lib/crypto/vault'
import { getVaultPassphrase } from '@/lib/crypto/session'
import { shapeSystemPrompt, classifyQuery } from '@/lib/flow/classifier'
import { Markdown } from '@/components/chat/Markdown'

export function CompareView() {
  const settings = useStore((s) => s.settings)
  const ui = useUI()
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<string[]>([settings.defaultModel, 'groq:llama-3.3-70b-versatile'])
  const [outputs, setOutputs] = useState<Record<string, { text: string; busy: boolean; ms?: number }>>({})
  const [winner, setWinner] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const syncRef = React.useRef<HTMLDivElement[]>([])

  const options = PROVIDERS.filter((p) => p.defaultModels.length > 0).flatMap((p) => p.defaultModels.slice(0, 3).map((m) => `${p.id}:${m}`))

  const run = async () => {
    if (!prompt.trim() || running) return
    setRunning(true)
    setWinner(null)
    const init: typeof outputs = {}
    for (const m of models) init[m] = { text: '', busy: true }
    setOutputs(init)

    const t0 = performance.now()
    await Promise.all(models.map(async (ref) => {
      const [providerId, model] = ref.split(':')
      const meta = PROVIDERS.find((p) => p.id === providerId)
      const pconf = settings.providers[providerId]
      const apiKey = pconf?.apiKey ? await resolveKey(pconf.apiKey, getVaultPassphrase()) : ''
      const system = shapeSystemPrompt(classifyQuery(prompt))
      const startedAt = performance.now()
      try {
        if (meta && (!meta.needsKey || apiKey)) {
          useStore.getState().logConnection(meta.baseUrl, `compare · ${model}`, prompt.length)
          await streamToCallback({
            providerId, model, apiKey, baseUrl: pconf?.baseUrl || undefined,
            system, messages: [{ role: 'user', content: prompt }], maxTokens: 700,
          }, (chunk) => setOutputs((o) => ({ ...o, [ref]: { ...o[ref], text: o[ref].text + chunk } })))
        } else {
          useStore.getState().logConnection('local://demo', `compare demo · ${model}`, prompt.length, 'local')
          await streamDemo(prompt, {}, (chunk) => setOutputs((o) => ({ ...o, [ref]: { ...o[ref], text: o[ref].text + chunk } })))
        }
        setOutputs((o) => ({ ...o, [ref]: { text: o[ref].text, busy: false, ms: Math.round(performance.now() - startedAt) } }))
      } catch (e: any) {
        setOutputs((o) => ({ ...o, [ref]: { text: `**Error:** ${e?.message ?? e}`, busy: false } }))
      }
    }))
    setRunning(false)
    ui.toast('Compare complete', `${models.length} responses ready. Pick a winner or merge.`, 'success')
  }

  const merge = () => {
    const chatId = useStore.getState().newChat()
    const store = useStore.getState()
    store.addMessage(chatId, { id: nanoid(8), role: 'user', content: `[Compare] ${prompt}`, createdAt: Date.now() })
    store.addMessage(chatId, {
      id: nanoid(8), role: 'assistant',
      content: `## Merged from ${models.length} models\n\n` + models.map((m, i) => `### Model ${i + 1} — ${m}\n\n${outputs[m]?.text ?? ''}`).join('\n\n---\n\n'),
      createdAt: Date.now(), model: 'merge', provider: 'Compare',
    })
    window.location.hash = `#/chat/${chatId}`
  }

  // synchronized scrolling
  const onScroll = (idx: number) => (e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget.scrollTop
    syncRef.current.forEach((el, i) => { if (i !== idx && el) el.scrollTop = t })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-[880px] w-full mx-auto px-5 pt-6 pb-3 shrink-0">
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}>
          <Swords size={18} style={{ color: 'var(--primary)' }} /> Compare Mode
        </h1>
        <p className="text-[12.5px] mt-0.5 mb-4" style={{ color: 'var(--text-2)' }}>One prompt, up to three models, side by side with synchronized scrolling.</p>

        <div className="flex gap-2 mb-3 flex-wrap">
          {models.map((m, i) => (
            <select key={i} value={m}
              onChange={(e) => setModels((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
              className="px-3 py-1.5 rounded-[10px] text-[12px] font-mono outline-none max-w-[240px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
              {[m, ...options.filter((o) => o !== m)].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {models.length < 3 && (
            <button onClick={() => setModels((prev) => [...prev, options.find((o) => !prev.includes(o)) ?? options[0]])}
              className="px-3 py-1.5 rounded-[10px] text-[12px]" style={{ border: '1px dashed var(--surface-border)', color: 'var(--text-3)' }}>
              + Add model
            </button>
          )}
          {models.length > 2 && (
            <button onClick={() => setModels((prev) => prev.slice(0, -1))}
              className="px-3 py-1.5 rounded-[10px] text-[12px]" style={{ color: 'var(--text-3)' }}>
              Remove last
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Send one prompt to all models…"
            className="flex-1 px-4 py-2.5 rounded-[14px] outline-none text-[13.5px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }} />
          <button onClick={run} disabled={running || !prompt.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-[14px] text-[13px] font-medium disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />} Run
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-5 pb-5 max-w-[880px] w-full mx-auto">
        <div className={`h-full grid gap-3 ${models.length === 3 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {models.map((m, i) => (
            <motion.div key={m} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="surface flex flex-col min-h-0 overflow-hidden"
              style={winner === m ? { borderColor: 'var(--success)' } : undefined}>
              <div className="flex items-center gap-2 px-3.5 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <span className="text-[11.5px] font-mono truncate flex-1">{m}</span>
                {outputs[m]?.ms != null && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{outputs[m].ms}ms</span>}
                {outputs[m]?.busy && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--primary)' }} />}
                {Object.values(outputs).some((o) => !o.busy) && outputs[m] && !outputs[m].busy && (
                  <button onClick={() => setWinner(m)} aria-label={`Pick ${m} as winner`}
                    className="p-1 rounded" style={{ color: winner === m ? 'var(--warning)' : 'var(--text-3)' }}>
                    <Crown size={13} fill={winner === m ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
              <div ref={(el) => { if (el) syncRef.current[i] = el }} onScroll={onScroll(i)}
                className="flex-1 overflow-y-auto p-3.5 text-[13px]">
                {outputs[m] ? <Markdown content={outputs[m].text} streaming={outputs[m].busy} /> : (
                  <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Waiting…</div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {winner && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          <button onClick={merge} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] glass"
            style={{ border: '1px solid var(--surface-border)', color: 'var(--text)' }}>
            <Merge size={13} /> Merge into chat
          </button>
        </div>
      )}
    </div>
  )
}
