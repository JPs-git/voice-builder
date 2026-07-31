export function applyPreEmphasis(signal: Float32Array, coeff: number = 0.99): Float32Array {
  const n = signal.length
  const out = new Float32Array(n)
  out[0] = signal[0]
  for (let i = 1; i < n; i++) out[i] = signal[i] - coeff * signal[i - 1]
  return out
}

export function applyHamming(signal: Float32Array): Float32Array {
  const n = signal.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = signal[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)))
  }
  return out
}
