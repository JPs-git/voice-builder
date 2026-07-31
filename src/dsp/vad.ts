export const DEFAULT_VAD_THRESHOLD = 0.05

export class VoiceActivityDetector {
  private _threshold: number

  constructor({ threshold = DEFAULT_VAD_THRESHOLD }: { threshold?: number } = {}) {
    this._threshold = threshold
  }

  compute(samples: Float32Array): { voiced: boolean; rms: number } {
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sumSq / samples.length)
    return { voiced: rms >= this._threshold, rms }
  }
}
