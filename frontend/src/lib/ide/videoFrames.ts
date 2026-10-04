import type { TrayAttachment } from './bridge'

export interface VideoFrameOptions {
  maxFrames?: number
  maxWidth?: number
  quality?: number
}

/** Evenly distributed local sample points; video bytes never leave the browser. */
export function videoFrameTimes(durationSeconds: number, maxFrames = 6): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || maxFrames <= 0) return []
  if (durationSeconds < 0.75) return [durationSeconds / 2]
  const cap = Math.max(1, Math.min(12, Math.floor(maxFrames)))
  const count = Math.min(cap, Math.max(2, Math.ceil(durationSeconds / 5) + 1))
  const inset = Math.min(0.12, durationSeconds * 0.03)
  const first = Math.min(inset, durationSeconds / 2)
  const last = Math.max(first, durationSeconds - inset)
  return Array.from({ length: count }, (_, i) => count === 1 ? durationSeconds / 2 : first + (last - first) * i / (count - 1))
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    const onSeeked = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error('The video could not be decoded in this browser.')) }
    timer = setTimeout(() => { cleanup(); reject(new Error('The video took too long to seek to a frame.')) }, 12_000)
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    try {
      video.currentTime = time
      if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.01) onSeeked()
    } catch (error) {
      cleanup()
      reject(error instanceof Error ? error : new Error('The video could not be read.'))
    }
  })
}

function timeLabel(seconds: number): string {
  const whole = Math.max(0, seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(1).padStart(4, '0')}`
}

/**
 * Sample a handful of keyframes from a local video into normal image
 * attachments. This keeps the existing image-vision pipeline intact and means
 * the original video is never uploaded to a server.
 */
export async function extractVideoFrames(file: File, options: VideoFrameOptions = {}): Promise<TrayAttachment[]> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Video frame sampling needs a browser with local video support.')
  }
  const looksLikeVideo = file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv)$/i.test(file.name)
  if (!looksLikeVideo) throw new Error('Choose an MP4, WebM, MOV, or other video file.')
  if (file.size > 500 * 1024 * 1024) throw new Error('This video is over 500 MB. Choose a smaller clip.')

  const maxFrames = Math.max(1, Math.min(8, Math.floor(options.maxFrames ?? 6)))
  const maxWidth = Math.max(320, Math.min(1600, Math.floor(options.maxWidth ?? 1120)))
  const quality = Math.max(0.45, Math.min(0.9, options.quality ?? 0.76))
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The video metadata did not load in time.')), 15_000)
      const done = () => { clearTimeout(timer); resolve() }
      const fail = () => { clearTimeout(timer); reject(new Error('This video format could not be opened in the browser.')) }
      video.addEventListener('loadedmetadata', done, { once: true })
      video.addEventListener('error', fail, { once: true })
      video.load()
    })

    const times = videoFrameTimes(video.duration, maxFrames)
    if (!times.length || !video.videoWidth || !video.videoHeight) {
      throw new Error('This video has no readable frames.')
    }

    const scale = Math.min(1, maxWidth / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The browser could not create a canvas for video frames.')

    const frames: TrayAttachment[] = []
    for (const time of times) {
      await seek(video, time)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length > 100) {
        frames.push({ type: 'image', name: `${file.name} · ${timeLabel(time)}`, dataUrl })
      }
    }
    if (!frames.length) throw new Error('No video frames could be captured.')
    return frames
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
