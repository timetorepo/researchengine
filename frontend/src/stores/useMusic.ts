import { create } from 'zustand'
import { useEffect } from 'react'
import * as engine from '@/lib/music/engine'

/**
 * UI mirror of the music engine: what is playing, where, and the controls.
 * The engine owns the audio; this store only lets React redraw when it changes.
 *
 * `now` is the track's details (name, artist, album, position) and is set only while
 * music is playing. When nothing plays it is null, and the top bar hides the control.
 */
interface MusicState {
  playing: boolean
  now: engine.NowPlaying | null
  repeat: engine.RepeatMode
  volume: number
  sync: () => void
}

export const useMusic = create<MusicState>((set, get) => ({
  playing: false,
  now: null,
  repeat: engine.getRepeat(),
  volume: engine.getVolume(),
  sync: () => {
    const s = get()
    const playing = engine.isPlaying()
    const now = engine.nowPlaying()
    const repeat = engine.getRepeat()
    const volume = engine.getVolume()
    const same = s.playing === playing && s.repeat === repeat && s.volume === volume &&
      (s.now === null ? now === null : now !== null && s.now.title === now.title && s.now.position === now.position &&
        s.now.repeat === now.repeat && s.now.number === now.number)
    if (!same) set({ playing, now, repeat, volume })
  },
}))

/**
 * Keeps the store in step with the engine. Mount once, where the control lives.
 * While music plays, the position is re-read four times a second, so the time and
 * seek bar stay accurate; when paused there is nothing to poll.
 */
export function useMusicSync() {
  useEffect(() => {
    const sync = () => useMusic.getState().sync()
    const off = engine.onEngineChange(sync)
    sync()
    const id = window.setInterval(() => { if (engine.isPlaying()) sync() }, 250)
    return () => { off(); window.clearInterval(id) }
  }, [])
}
