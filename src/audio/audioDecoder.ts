import { getAudioEngine } from '../ts'

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
  numChannels: number
}

export class AudioTooLongError extends Error {
  constructor() {
    super('AudioTooLongError')
    this.name = 'AudioTooLongError'
  }
}

// Reads container metadata only (via an <audio> element) — does NOT full-decode.
// Pass `el` (e.g. a fake) only in tests; default constructs a new Audio.
// `timeoutMs` guards against a metadata load that never settles, so a stalled
// probe can't leave the importer stuck in `isImporting`.
export function probeAudioDuration(
  file: Blob,
  el: HTMLAudioElement = new Audio(),
  timeoutMs = 15000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    let settled = false

    const cleanup = () => {
      URL.revokeObjectURL(url)
      el.onloadedmetadata = null
      el.onerror = null
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    const succeed = (duration: number) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(duration)
    }

    const timer = setTimeout(() => {
      el.removeAttribute('src')
      el.load()
      fail(new Error('Failed to load audio metadata'))
    }, timeoutMs)

    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      clearTimeout(timer)
      const duration = el.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        fail(new Error('Failed to read audio duration'))
      } else {
        succeed(duration)
      }
    }
    el.onerror = () => {
      clearTimeout(timer)
      fail(new Error('Failed to load audio metadata'))
    }
    el.src = url
  })
}

// Computes a WAV file's duration from its header alone — no full-file read.
// Returns null when the header can't be resolved from the given bytes (e.g. the
// 'data' chunk lies beyond the slice); callers should fall back to a full parse.
export function wavDurationFromHeader(view: DataView): number | null {
  if (view.byteLength < 12) return null
  const riff = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
  )
  if (riff !== 'RIFF') return null

  let byteRate = 0
  let dataSize: number | null = null
  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3),
    )
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      byteRate = view.getUint32(offset + 16, true)
    } else if (id === 'data') {
      dataSize = size
      break
    }
    let next = offset + 8 + size
    if (size % 2 !== 0) next++
    if (next + 8 > view.byteLength) break // next chunk header is beyond the slice
    offset = next
  }

  if (dataSize === null || byteRate <= 0) return null
  return dataSize / byteRate
}

// Reads only the first `maxBytes` of a WAV to compute duration, so >10s files
// are rejected before the full file is read into memory. Returns null when the
// duration can't be determined from the header slice (caller falls back).
export async function probeWavDuration(file: Blob, maxBytes = 256): Promise<number | null> {
  const head = await file.slice(0, maxBytes).arrayBuffer()
  return wavDurationFromHeader(new DataView(head))
}

// Full decode: AudioContext.decodeAudioData → Float32Array PCM (channel 0).
// Pass `context` only in tests; defaults to the AudioEngine singleton context.
export async function decodeAudioFile(
  arrayBuffer: ArrayBuffer,
  context: AudioContext = getAudioEngine().audioContext,
): Promise<DecodedAudio> {
  const buffer = await context.decodeAudioData(arrayBuffer)
  return {
    samples: buffer.getChannelData(0),
    sampleRate: buffer.sampleRate,
    numChannels: buffer.numberOfChannels,
  }
}
