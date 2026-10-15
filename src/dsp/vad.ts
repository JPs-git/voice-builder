export const DEFAULT_VAD_THRESHOLD = 0.05

export interface VadOptions {
  threshold?: number
  releaseThreshold?: number
  holdMs?: number
}

// Live capture needs to accept quiet, unprocessed microphone input.
// File analysis keeps the original fixed threshold unless explicitly configured.
export const MIC_VAD_OPTIONS: Readonly<VadOptions> = {
  threshold: 0.008,
  releaseThreshold: 0.005,
  holdMs: 100,
}

export class VoiceActivityDetector {
  private _threshold: number
  private _releaseThreshold: number
  private _holdMs: number
  private _voiced = false
  private _belowThresholdMs = 0

  constructor({ threshold = DEFAULT_VAD_THRESHOLD, releaseThreshold = threshold, holdMs = 0 }: VadOptions = {}) {
    this._threshold = threshold
    this._releaseThreshold = releaseThreshold
    this._holdMs = holdMs
  }

  // elapsedMs is the hop duration, not the duration of the overlapping window.
  compute(samples: Float32Array, elapsedMs = 10): { voiced: boolean; rms: number } {
    let sumSq = 0
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i] * samples[i]
    }
    const rms = samples.length ? Math.sqrt(sumSq / samples.length) : 0
    if (!this._voiced) {
      this._voiced = rms >= this._threshold
      this._belowThresholdMs = 0
    } else if (rms >= this._releaseThreshold) {
      this._belowThresholdMs = 0
    } else {
      this._belowThresholdMs += elapsedMs
      if (this._belowThresholdMs >= this._holdMs) this._voiced = false
    }
    return { voiced: this._voiced, rms }
  }

  reset(): void {
    this._voiced = false
    this._belowThresholdMs = 0
  }
}
