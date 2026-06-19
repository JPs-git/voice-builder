import { Complex } from './complex.js'

function bitReverse(x, log2N) {
  let r = 0
  for (let i = 0; i < log2N; i++) {
    r = (r << 1) | (x & 1)
    x >>= 1
  }
  return r
}

export function fftMagnitudes(signal, fftSize) {
  const N = fftSize
  const log2N = Math.round(Math.log2(N))

  const data = new Array(N)
  const sigLen = signal.length
  let sumWindow = 0
  for (let i = 0; i < sigLen; i++) {
    // Hann window, store for energy normalization
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (sigLen - 1)))
    data[i] = new Complex(signal[i] * w, 0)
    sumWindow += w
  }
  for (let i = sigLen; i < N; i++) {
    data[i] = new Complex(0, 0)
  }

  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, log2N)
    if (i < j) {
      const tmp = data[i]; data[i] = data[j]; data[j] = tmp
    }
  }

  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < half; j++) {
        const k = i + j
        const twiddle = Complex.unityRoot(size, j)
        const even = data[k]
        const odd = data[k + half].mul(twiddle)
        data[k] = even.add(odd)
        data[k + half] = even.sub(odd)
      }
    }
  }

  const normFactor = sumWindow
  const bins = N / 2 + 1
  const magnitudes = new Float32Array(bins)
  for (let i = 0; i < bins; i++) {
    const mag = Math.sqrt(data[i].re * data[i].re + data[i].im * data[i].im) / normFactor
    magnitudes[i] = 20 * Math.log10(Math.max(mag, 1e-12))
  }

  return magnitudes
}
