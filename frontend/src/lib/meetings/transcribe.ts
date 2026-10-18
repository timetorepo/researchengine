/** The page side of transcription: decode the recording, resample to 16 kHz, hand it to the worker. */

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void; onProgress?: (p: any) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<any>) => {
    const job = pending.get(e.data.id)
    if (!job) return
    if (e.data.type === 'progress') job.onProgress?.(e.data.p)
    if (e.data.type === 'done') { pending.delete(e.data.id); job.resolve(e.data.text) }
    if (e.data.type === 'error') { pending.delete(e.data.id); job.reject(new Error(e.data.message)) }
  }
  return worker
}

/** Decode any browser-readable recording to mono 16 kHz samples. */
export async function toMono16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void ctx.close()
  }
  const target = 16000
  const frames = Math.max(1, Math.ceil(decoded.duration * target))
  const offline = new OfflineAudioContext(1, frames, target)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

export function transcribeAudio(samples: Float32Array, onProgress?: (p: any) => void): Promise<string> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    getWorker().postMessage({ id, audio: samples }, [samples.buffer])
  })
}

export async function transcribeBlob(blob: Blob, onProgress?: (p: any) => void): Promise<string> {
  return transcribeAudio(await toMono16k(blob), onProgress)
}
