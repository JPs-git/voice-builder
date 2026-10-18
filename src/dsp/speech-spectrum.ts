// A broadband noise veto, not a complete speech detector. Shaped aperiodic
// signals (e.g. breathy vowels) may pass without a detectable fundamental.
// Reuses the pipeline's Hann-windowed dB spectrum instead of a second FFT.
export function hasSpeechSpectrum(magnitudes: Float32Array, sampleRate: number): boolean {
  const fftSize = (magnitudes.length - 1) * 2
  if (fftSize <= 0) return false
  const first = Math.ceil(100 * fftSize / sampleRate)
  const last = Math.min(magnitudes.length - 1, Math.floor(4000 * fftSize / sampleRate))
  let dbSum = 0
  let powerSum = 0
  for (let i = first; i <= last; i++) {
    dbSum += magnitudes[i]
    powerSum += 10 ** (magnitudes[i] / 10)
  }
  const count = last - first + 1
  if (count <= 0 || powerSum <= 0) return false
  const flatness = 10 ** (dbSum / count / 10) / (powerSum / count)
  // White noise has power flatness around 0.56; keep a margin for finite windows.
  return flatness < 0.4
}
