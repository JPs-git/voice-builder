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
  mixedLow?: number
  mixedHigh?: number
  window?: number
}

export interface RegisterResult {
  register: VoiceRegister
  h1h2: number | null
  confidence: number
}

const DEFAULT_MIXED_LOW = 3
const DEFAULT_MIXED_HIGH = 10
const DEFAULT_WINDOW = 5

const MIXED_BOUNDARY = 0.35
const FALSETTO_BOUNDARY = 0.65

const CHEST_HARMONIC_COUNT = 6
const FALSETTO_HARMONIC_COUNT = 2
const CHEST_HARMONIC_BIAS = 0.15
const FALSETTO_HARMONIC_BIAS = 0.1
const CHEST_SHR_BIAS = 0.1
const SHR_CHEST_THRESHOLD = 0.5

export class RegisterDetector {
  private _mixedLow: number
  private _mixedHigh: number
  private _window: number
  private _h1h2Buffer: number[]
  private _countBuffer: number[]

  constructor(opts: RegisterOptions = {}) {
    this._mixedLow = opts.mixedLow ?? DEFAULT_MIXED_LOW
    this._mixedHigh = opts.mixedHigh ?? DEFAULT_MIXED_HIGH
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
    const smoothed = median(this._h1h2Buffer)

    this._countBuffer.push(amps.harmonicCount)
    if (this._countBuffer.length > this._window) this._countBuffer.shift()
    const smoothedCount = median(this._countBuffer)

    let score = (smoothed - this._mixedLow) / (this._mixedHigh - this._mixedLow)
    score = clamp01(score)

    if (smoothedCount >= CHEST_HARMONIC_COUNT) score -= CHEST_HARMONIC_BIAS
    if (smoothedCount <= FALSETTO_HARMONIC_COUNT) score += FALSETTO_HARMONIC_BIAS
    if (amps.shr != null && amps.shr > SHR_CHEST_THRESHOLD) score -= CHEST_SHR_BIAS
    score = clamp01(score)

    let register: VoiceRegister
    if (score < MIXED_BOUNDARY) register = 'chest'
    else if (score <= FALSETTO_BOUNDARY) register = 'mixed'
    else register = 'falsetto'

    const confidence = registerConfidence(score)
    return { register, h1h2: smoothed, confidence }
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

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function registerConfidence(score: number): number {
  let dist: number
  if (score < MIXED_BOUNDARY) dist = MIXED_BOUNDARY - score
  else if (score <= FALSETTO_BOUNDARY) dist = Math.min(score - MIXED_BOUNDARY, FALSETTO_BOUNDARY - score)
  else dist = score - FALSETTO_BOUNDARY
  return Math.min(1, dist / (FALSETTO_BOUNDARY - MIXED_BOUNDARY))
}
