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
export function probeAudioDuration(
  file: Blob,
  el: HTMLAudioElement = new Audio(),
): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = el.duration
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Failed to read audio duration'))
      } else {
        resolve(duration)
      }
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load audio metadata'))
    }
    el.src = url
  })
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