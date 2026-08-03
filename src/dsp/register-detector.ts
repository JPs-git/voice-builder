import { extractHarmonics } from './harmonic-amplitudes'
import type { HarmonicAmplitudes } from './harmonic-amplitudes'
import type { VoiceRegister } from '../types'

export interface RegisterFrameInput {
  f0: number | null
  voiced: boolean
  magnitudes?: Float32Array
  sampleRate: number
}

export interface RegisterOptions {
  chestCount?: number
  falsettoCount?: number
  window?: number
}

export interface RegisterResult {
  register: VoiceRegister
  h1h2: number | null
  confidence: number
}

const DEFAULT_CHEST_COUNT = 5
const DEFAULT_FALSETTO_COUNT = 2
const DEFAULT_WINDOW = 5

// Calibrated on labeled /a/ recordings: 真声 ~7 harmonics, 混声 ~3, 假声 ~1.8.
export class RegisterDetector {
  private _chestCount: number
  private _falsettoCount: number
  private _window: number
  private _h1h2Buffer: number[]
  private _countBuffer: number[]

  constructor(opts: RegisterOptions = {}) {
    this._chestCount = opts.chestCount ?? DEFAULT_CHEST_COUNT
    this._falsettoCount = opts.falsettoCount ?? DEFAULT_FALSETTO_COUNT
    this._window = opts.window ?? DEFAULT_WINDOW
    this._h1h2Buffer = []
    this._countBuffer = []
  }

  push(input: RegisterFrameInput): RegisterResult {
    if (!input.voiced || input.f0 == null) {
      this._h1h2Buffer = []
      this._countBuffer = []
      return { register: 'unvoiced', h1h2: null, confidence: 0 }
    }

    const amps: HarmonicAmplitudes = extractHarmonics(
      input.magnitudes ?? new Float32Array(0),
      input.f0,
      input.sampleRate,
    )
    if (amps.h1 == null || amps.h2 == null) {
      this._h1h2Buffer = []
      this._countBuffer = []
      return { register: 'unvoiced', h1h2: null, confidence: 0 }
    }

    const h1h2 = amps.h1 - amps.h2
    this._h1h2Buffer.push(h1h2)
    if (this._h1h2Buffer.length > this._window) this._h1h2Buffer.shift()
    const smoothedH1h2 = median(this._h1h2Buffer)

    this._countBuffer.push(amps.harmonicCount)
    if (this._countBuffer.length > this._window) this._countBuffer.shift()
    const smoothedCount = median(this._countBuffer)

    let register: VoiceRegister
    if (smoothedCount >= this._chestCount) register = 'chest'
    else if (smoothedCount <= this._falsettoCount) register = 'falsetto'
    else register = 'mixed'

    const confidence = registerConfidence(smoothedCount, this._chestCount, this._falsettoCount)
    return { register, h1h2: smoothedH1h2, confidence }
  }

  reset(): void {
    this._h1h2Buffer = []
    this._countBuffer = []
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function registerConfidence(count: number, chestCount: number, falsettoCount: number): number {
  const span = chestCount - falsettoCount
  if (count >= chestCount) {
    return Math.min(1, 0.5 + (count - chestCount) / span)
  }
  if (count <= falsettoCount) {
    return Math.min(1, 0.5 + (falsettoCount - count) / span)
  }
  const mid = (chestCount + falsettoCount) / 2
  return Math.max(0, 0.5 - Math.abs(count - mid) / span)
}
