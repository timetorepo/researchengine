import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Sound } from '@/components/ui/bencho/sound/Sound'
import '@/components/ui/bencho/sound/Sound.css'
import * as engine from '@/lib/music/engine'
import { useMusic, useMusicSync } from '@/stores/useMusic'
import { useStore } from '@/stores/useStore'

/** Bencho's morphing now-playing shell, driven only by the real local audio engine. */
export function MusicControl() {
  const [open, setOpen] = useState(false)
  useMusicSync()
  const now = useMusic((s) => s.now)
  const playing = useMusic((s) => s.playing)
  const volume = useMusic((s) => s.volume)
  const repeat = useMusic((s) => s.repeat)
  const reduced = useStore((s) => s.settings.reduceMotion)
  const osReduced = useReducedMotion()
  // Keep a paused track reachable. No engine call starts audio during render/mount.
  if (!now) return null
  return <div className="re-bencho re-now-playing" data-ui="music-control" role="region" aria-label="Music player">
    <Sound onOpenChange={setOpen} title={now.title} artist={now.artist} position={now.position} duration={now.duration} playing={playing}
      onToggle={() => void engine.toggle()} onPrevious={() => void engine.prev()} onNext={() => void engine.next()} reduced={reduced || !!osReduced} />
    {open && <details className="re-music-options"><summary>Playback options</summary><div className="p-3 space-y-3 rounded-xl bg-[var(--surface)] border border-[var(--surface-border)]">
      <label className="block text-xs">Seek<input aria-label="Music position" type="range" min={0} max={now.duration} step={1} value={now.position} onChange={(e) => engine.seek(Number(e.target.value))} className="block w-full" /></label>
      <label className="block text-xs">Volume<input aria-label="Music volume" type="range" min={0} max={1} step={.01} value={volume} onChange={(e) => engine.setVolume(Number(e.target.value))} className="block w-full" /></label>
      <button className="text-xs underline" onClick={() => engine.setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}>Repeat: {repeat}</button>
    </div></details>}
  </div>
}
