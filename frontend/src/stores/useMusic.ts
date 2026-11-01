import { create } from 'zustand'
import { useEffect } from 'react'
import * as engine from '@/lib/music/engine'

/**
 * UI mirror of the music engine: what is playing, where, and the controls.
 * The engine owns the audio; this store only lets React redraw when it changes.
 */
interface MusicState {
  playing: boolean
  index: number
  repeat: engine.RepeatMode
  volume: number
  position: number
  duration: number
  expanded: boolean
  sync: () => void
  setExpanded: (v: boolean) => void
}

export const useMusic = create<MusicState>((set, get) => ({
  playing: false,
  index: engine.currentIndex(),
  repeat: engine.getRepeat(),
  volume: engine.getVolume(),
  position: 0,
  duration: engine.trackDuration(engine.TRACKS[engine.currentIndex()]),
  expanded: false,
  sync: () => {
    const index = engine.currentIndex()
    const s = get()
    const dur = engine.trackDuration(engine.TRACKS[index])
    const playing = engine.isPlaying()
    const repeat = engine.getRepeat()
    const volume = engine.getVolume()
    if (s.playing !== playing || s.index !== index || s.repeat !== repeat || s.volume !== volume || s.duration !== dur) {
      set({ playing, index, repeat, volume, duration: dur })
    }
  },
  setExpanded: (v) => set({ expanded: v }),
}))

/** Keeps the store in step with the engine. Mount once, where the control lives. */
export function useMusicSync() {
  useEffect(() => {
    const sync = () => useMusic.getState().sync()
    const off = engine.onEngineChange(sync)
    sync()
    return off
  }, [])
}
