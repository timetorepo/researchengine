/**
 * Screenshot to code, in the coding workspace.
 *
 * Drop an image of a UI and the panel asks a vision model to write the code
 * for it — the same trick as github.com/abi/screenshot-to-code. Videos work
 * too: the panel samples frames across the clip and asks for the final state,
 * which covers screen recordings and click-throughs.
 *
 * Output is a single self-contained file (plain HTML with Tailwind via CDN,
 * or a React component), copied to the clipboard or saved into the project.
 */
import { useRef, useState } from 'react'
import { Camera, Loader2, Copy, FileDown, Film, ImageIcon, Sparkles } from 'lucide-react'
import { PROVIDERS } from '@/lib/providers/registry'
import { streamToCallback } from '@/lib/providers/stream'
import { usableKey } from '@/lib/providers/keys'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import { copyText } from '@/lib/utils'

const VISION_DEFAULT: Record<string, string> = {
  openai: 'gpt-4o', anthropic: 'claude-sonnet-4', gemini: 'gemini-2.0-flash',
  openrouter: 'openrouter/auto', mistral: 'pixtral-12b-2409',
  groq: 'llama-3.2-11b-vision-preview',
}

interface Shot { kind: 'image' | 'video'; frames: string[]; label: string }

async function framesFromImage(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Keep very large screenshots under the provider's limits.
      const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight, 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve([canvas.toDataURL('image/jpeg', 0.9)])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('that image could not be read')) }
    img.src = url
  })
}

async function framesFromVideo(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = url
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('that video could not be read'))
  })
  const duration = isFinite(video.duration) ? video.duration : 0
  if (duration <= 0) { URL.revokeObjectURL(url); throw new Error('the video has no readable length') }
  const count = Math.min(6, Math.max(1, Math.round(duration / 1.5)))
  const scale = Math.min(1, 900 / Math.max(video.videoWidth, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((video.videoWidth || 640) * scale)
  canvas.height = Math.round((video.videoHeight || 360) * scale)
  const ctx = canvas.getContext('2d')
  const frames: string[] = []
  for (let i = 0; i < count; i++) {
    const t = Math.min(duration * ((i + 0.5) / count), Math.max(0, duration - 0.05))
    await new Promise<void>((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
      video.addEventListener('seeked', onSeeked)
      video.currentTime = t
    })
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
    frames.push(canvas.toDataURL('image/jpeg', 0.82))
  }
  URL.revokeObjectURL(url)
  return frames
}

export function ScreenshotPanel({ project }: { project: string }) {
  const ui = useUI()
  const inputRef = useRef<HTMLInputElement>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  const [target, setTarget] = useState<'html' | 'react'>('html')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const accept = async (file: File | undefined | null) => {
    if (!file) return
    setErr(''); setCode('')
    try {
      if (file.type.startsWith('video/')) {
        const frames = await framesFromVideo(file)
        setShot({ kind: 'video', frames, label: `${file.name} — ${frames.length} frames sampled` })
      } else if (file.type.startsWith('image/')) {
        const frames = await framesFromImage(file)
        setShot({ kind: 'image', frames, label: file.name })
      } else {
        setErr('Drop an image or a video file.')
      }
    } catch (e: any) {
      setErr(e?.message ?? 'That file could not be read.')
    }
  }

  const generate = async () => {
    if (!shot || busy) return
    setBusy(true); setErr(''); setCode('')
    try {
      // The first configured provider wins — vision models are the norm now.
      const settings = useStore.getState().settings
      const providerModels = settings.providerModels ?? {}
      let picked: { providerId: string; model: string; apiKey: string; baseUrl?: string } | null = null
      for (const p of PROVIDERS) {
        const pconf = settings.providers[p.id]
        if (!pconf?.apiKey) continue
        const apiKey = await usableKey(pconf.apiKey)
        if (!apiKey) continue
        picked = {
          providerId: p.id,
          model: providerModels[p.id]?.[0] ?? VISION_DEFAULT[p.id] ?? 'gpt-4o',
          apiKey, baseUrl: pconf.baseUrl || undefined,
        }
        break
      }
      if (!picked) throw new Error('No provider key is configured. Add one under Settings → Providers first — a vision-capable model like gpt-4o or Claude works best.')

      const want = target === 'react'
        ? 'a single React function component (export default, Tailwind classes, no external imports beyond react)'
        : 'a single complete HTML file (Tailwind via CDN, all script inline)'
      const videoBit = shot.kind === 'video'
        ? `The ${shot.frames.length} images are frames sampled in order from a video recording of the interface. Reproduce the final state faithfully and, where the frames show movement, note the transition in a comment.`
        : ''
      const prompt = [
        'You are screenshot-to-code. Describe the interface in the attached image exactly, then write it as code.',
        videoBit,
        `Produce ${want}. Reproduce layout, spacing, colours, typography, icons and copy as closely as possible. Use realistic content, not lorem.`,
        notes.trim() ? `Extra instructions from the user: ${notes.trim()}` : '',
        'Answer with the code in one fenced block and nothing else.',
      ].filter(Boolean).join('\n\n')

      let out = ''
      await streamToCallback({
        providerId: picked.providerId, model: picked.model, apiKey: picked.apiKey, baseUrl: picked.baseUrl,
        system: 'You convert UI screenshots into faithful, self-contained code. Output code only.',
        messages: [{
          role: 'user',
          content: [
            ...shot.frames.map((dataUrl) => ({ type: 'image', dataUrl })),
            { type: 'text', text: prompt },
          ],
        }],
        maxTokens: 4000,
      }, (chunk) => { out += chunk; setCode(out) })

      const fenced = out.match(/```[a-z]*\n([\s\S]*?)```/i)?.[1]
      const clean = (fenced ?? out).trim()
      if (!clean) throw new Error('The model answered with no code at all.')
      setCode(clean)
      ui.toast('Code generated', `${target === 'react' ? 'React component' : 'HTML file'} ready — copy it or save it into the project.`, 'success')
    } catch (e: any) {
      setErr(e?.message ?? 'Generation failed.')
    }
    setBusy(false)
  }

  const save = async () => {
    if (!code) return
    const path = target === 'react' ? 'generated/screenshot.tsx' : 'generated/screenshot.html'
    try {
      const res = await fetch('/api/ide/file', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, path, content: code }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'The file could not be written.')
      ui.toast('Saved into the project', path, 'success')
    } catch (e: any) {
      ui.toast('Could not save', e?.message ?? 'Unknown error.', 'danger')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-3 text-[11px]">
      <div className="ide-section px-0.5 pt-2 pb-1.5">Screenshot to code</div>

      <div
        data-ui="shot2code-drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void accept(e.dataTransfer.files?.[0]) }}
        className="rounded-[9px] px-3 py-4 text-center cursor-pointer transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? 'var(--ide-accent)' : 'var(--ide-border)'}`, background: dragOver ? 'var(--ide-hover)' : 'transparent' }}>
        {shot ? (
          <>
            <div className="flex justify-center mb-1.5">
              {shot.frames[0] && <img src={shot.frames[0]} alt="source" className="max-h-24 rounded-[6px]" style={{ border: '1px solid var(--ide-border)' }} />}
            </div>
            <p className="text-[10px] truncate" style={{ color: 'var(--ide-text)' }}>{shot.label}</p>
            {shot.kind === 'video' && <p className="text-[9.5px] mt-0.5" style={{ color: 'var(--ide-faint)' }}><Film size={9} className="inline mr-0.5" />video — sampled across the clip</p>}
          </>
        ) : (
          <>
            <Camera size={16} className="mx-auto mb-1.5" style={{ color: 'var(--ide-faint)' }} />
            <p style={{ color: 'var(--ide-text)' }}>Drop an image or video here</p>
            <p className="text-[9.5px] mt-0.5" style={{ color: 'var(--ide-faint)' }}>a screenshot, or a screen recording</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={(e) => void accept(e.target.files?.[0])} />
      </div>

      <div className="flex gap-1 mt-2">
        {(['html', 'react'] as const).map((t) => (
          <button key={t} onClick={() => setTarget(t)}
            className="flex-1 px-2 py-1.5 rounded-[7px] text-[10.5px] font-medium transition-colors"
            style={target === t ? { background: 'var(--ide-accent)', color: '#fff' } : { color: 'var(--ide-dim)', border: '1px solid var(--ide-border)' }}>
            {t === 'html' ? 'HTML + Tailwind' : 'React component'}
          </button>
        ))}
      </div>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
        placeholder="Anything specific: colours, make it responsive, dark mode…"
        className="ide-input w-full mt-2 resize-none" style={{ fontSize: 10.5 }} />

      <button data-ui="shot2code-generate" onClick={() => void generate()} disabled={!shot || busy}
        className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-[11px] font-medium disabled:opacity-40"
        style={{ background: 'var(--ide-accent)', color: '#fff' }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {busy ? 'Generating…' : shot?.kind === 'video' ? 'Generate from video' : 'Generate code'}
      </button>

      {err && <p className="mt-2 leading-snug" style={{ color: 'var(--danger, #e5484d)' }}>{err}</p>}

      {code && (
        <div className="mt-2" data-ui="shot2code-result">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="ide-section flex-1 !py-0">{target === 'react' ? 'screenshot.tsx' : 'screenshot.html'}</span>
            <button onClick={() => void copyText(code).then((ok) => ui.toast(ok ? 'Copied' : 'Copy blocked', '', ok ? 'success' : 'warning'))}
              title="Copy the code" className="opacity-70 hover:opacity-100"><Copy size={11} /></button>
            <button onClick={() => void save()} title="Save into the project" className="opacity-70 hover:opacity-100"><FileDown size={11} /></button>
          </div>
          <pre className="text-[9.5px] leading-relaxed font-mono p-2 rounded-[8px] overflow-auto max-h-56 whitespace-pre-wrap"
            style={{ background: 'var(--ide-hover)', color: 'var(--ide-text)' }}>{code}</pre>
        </div>
      )}

      <p className="mt-2.5 leading-relaxed" style={{ color: 'var(--ide-faint)' }}>
        <ImageIcon size={9} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
        Needs a vision-capable model behind your configured provider key. Images are sent only to that provider, nowhere else.
      </p>
    </div>
  )
}
