// RareUI · Voice note — an audio message with a play control, a waveform
// that fills as it plays, and a download button. Glow uses the theme's
// primary colour so it follows whichever theme is active.
import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download } from 'lucide-react'

const BARS = 36
function barHeights(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Array.from({ length: BARS }, (_, i) => {
    h = Math.imul(h ^ (i + 7), 16777619)
    return 30 + ((h >>> 0) % 70)
  })
}

/** The file's own extension, so a download keeps its format (mp3, m4a, ogg…). */
function extOf(src: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src)
  return m ? m[1].toLowerCase() : 'wav'
}

export function VoiceNote({ src, title = 'Voice note', seed }: { src: string; title?: string; seed?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const heights = barHeights(seed ?? src)

  useEffect(() => {
    const a = new Audio(src)
    audio.current = a
    const tick = () => setProgress(a.duration ? a.currentTime / a.duration : 0)
    a.addEventListener('timeupdate', tick)
    a.addEventListener('ended', () => { setPlaying(false); setProgress(0) })
    return () => { a.pause(); a.removeEventListener('timeupdate', tick); audio.current = null }
  }, [src])

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { void a.play(); setPlaying(true) }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-[16px] px-3 py-2.5 max-w-md"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        boxShadow: playing ? '0 0 0 1px color-mix(in srgb, var(--primary) 40%, transparent), 0 0 22px -6px color-mix(in srgb, var(--primary) 55%, transparent)' : 'none',
        transition: 'box-shadow 300ms ease',
      }}
    >
      <button type="button" onClick={toggle} aria-label={playing ? `Pause ${title}` : `Play ${title}`}
        className="grid place-items-center w-8 h-8 rounded-full shrink-0"
        style={{ background: 'var(--primary)', color: 'var(--on-primary, #fff)' }}>
        {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
      </button>
      <div className="flex items-center gap-[2px] h-8 flex-1 min-w-0" aria-hidden>
        {heights.map((h, i) => (
          <span key={i} className="flex-1 rounded-full"
            style={{ height: `${h}%`, background: i / BARS <= progress ? 'var(--primary)' : 'var(--text-3)', opacity: i / BARS <= progress ? 1 : 0.35 }} />
        ))}
      </div>
      <a href={src} download={`${title.replace(/\s+/g, '-').toLowerCase()}.${extOf(src)}`} aria-label={`Download ${title}`}
        className="grid place-items-center w-8 h-8 rounded-full shrink-0" style={{ color: 'var(--text-2)' }}>
        <Download size={14} aria-hidden />
      </a>
    </div>
  )
}
