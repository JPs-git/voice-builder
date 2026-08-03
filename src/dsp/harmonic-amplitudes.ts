const FFT_SIZE = 2048
const MAX_HARMONICS = 10
const WINDOW_HZ = 60
const HARMONIC_DB_FLOOR = 20
const SHR_FLOOR_HZ = 50
const SHR_WINDOW_HZ = 15

export interface HarmonicAmplitudes {
  h1: number | null
  h2: number | null
  h3: number | null
  h4: number | null
  harmonicCount: number
  shr: number | null
}

function findPeakAmplitude(
  magnitudes: Float32Array,
  freq: number,
  sampleRate: number,
  windowHz: number = WINDOW_HZ,
): number | null {
  const binWidth = sampleRate / FFT_SIZE
  if (freq <= 0 || freq >= sampleRate / 2) return null
  const center = freq / binWidth
  const half = Math.ceil(windowHz / binWidth)
  const i0 = Math.max(1, Math.floor(center) - half)
  const i1 = Math.min(magnitudes.length - 2, Math.ceil(center) + half)
  let best = i0
  for (let i = i0 + 1; i <= i1; i++) {
    if (magnitudes[i] > magnitudes[best]) best = i
  }
  const y0 = magnitudes[best - 1]
  const y1 = magnitudes[best]
  const y2 = magnitudes[best + 1]
  const denom = y0 - 2 * y1 + y2
  if (Math.abs(denom) < 1e-6) return y1
  const delta = 0.5 * (y0 - y2) / denom
  return y1 - 0.25 * (y0 - y2) * delta
}

export function extractHarmonics(
  magnitudes: Float32Array,
  f0: number | null,
  sampleRate: number,
): HarmonicAmplitudes {
  const empty: HarmonicAmplitudes = {
    h1: null,
    h2: null,
    h3: null,
    h4: null,
    harmonicCount: 0,
    shr: null,
  }
  if (f0 == null || f0 <= 0 || magnitudes.length === 0) return empty

  const nyquist = sampleRate / 2
  const h1 = findPeakAmplitude(magnitudes, f0, sampleRate)
  if (h1 == null) return empty

  const h2 = findPeakAmplitude(magnitudes, 2 * f0, sampleRate)
  const h3 = findPeakAmplitude(magnitudes, 3 * f0, sampleRate)
  const h4 = findPeakAmplitude(magnitudes, 4 * f0, sampleRate)

  const maxN = Math.floor(nyquist / f0)
  let harmonicCount = 0
  for (let n = 2; n <= Math.min(maxN, MAX_HARMONICS); n++) {
    const pk = findPeakAmplitude(magnitudes, n * f0, sampleRate)
    if (pk != null && h1 - pk < HARMONIC_DB_FLOOR) harmonicCount++
  }

  let shr: number | null = null
  if (f0 / 2 >= SHR_FLOOR_HZ) {
    const sub = findPeakAmplitude(magnitudes, f0 / 2, sampleRate, SHR_WINDOW_HZ)
    if (sub != null && sub > -80) {
      shr = Math.pow(10, (sub - h1) / 20)
    }
  }

  return { h1, h2, h3, h4, harmonicCount, shr }
}
