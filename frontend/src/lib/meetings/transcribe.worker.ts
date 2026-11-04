/// <reference lib="webworker" />
/**
 * Speech to text, on the device. Whisper (base, multilingual) runs in
 * onnxruntime-web through @huggingface/transformers. The first run downloads
 * the model from the Hugging Face hub into the browser's cache; after that it
 * works offline. Audio never leaves the machine.
 */
import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false

const MODEL = 'onnx-community/whisper-base'
let asr: any = null
let loading: Promise<any> | null = null

self.onmessage = async (e: MessageEvent<{ id: number; audio: Float32Array }>) => {
  const { id, audio } = e.data
  try {
    if (!asr) {
      loading ??= pipeline('automatic-speech-recognition', MODEL, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (p: unknown) => self.postMessage({ id, type: 'progress', p }),
      })
      asr = await loading
    }
    const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false })
    const text = Array.isArray(out) ? out.map((o: any) => o.text).join(' ') : out.text
    self.postMessage({ id, type: 'done', text: String(text ?? '').trim() })
  } catch (err: any) {
    self.postMessage({ id, type: 'error', message: String(err?.message ?? err) })
  }
}
