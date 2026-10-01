import { Complex } from './complex'

function bitReverse(x: number, log2N: number): number {
  let r = 0
  for (let i = 0; i < log2N; i++) {
    r = (r << 1) | (x & 1)
    x >>= 1
  }
  return r
}

export function complexFft(data: Complex[]): void {
  const N = data.length
  const log2N = Math.round(Math.log2(N))

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
}

export function ifft(data: Complex[]): void {
  const N = data.length
  for (let i = 0; i < N; i++) data[i] = data[i].conj()
  complexFft(data)
  for (let i = 0; i < N; i++) data[i] = new Complex(data[i].re / N, -data[i].im / N)
}

interface SpectrumWorkspace {
  size: number
  length: number
  real: Float64Array
  imag: Float64Array
  reversed: Uint32Array
  cos: Float64Array
  sin: Float64Array
  window: Float64Array
  windowSum: number
}

// One bounded workspace: calls are synchronous and returned spectra own their storage.
let spectrumWorkspace: SpectrumWorkspace | undefined

function getSpectrumWorkspace(size: number, length: number): SpectrumWorkspace {
  if (spectrumWorkspace?.size === size && spectrumWorkspace.length === length) {
    return spectrumWorkspace
  }
  const reversed = new Uint32Array(size)
  const log2N = Math.round(Math.log2(size))
  for (let i = 0; i < size; i++) reversed[i] = bitReverse(i, log2N)
  const cos = new Float64Array(size / 2)
  const sin = new Float64Array(size / 2)
  for (let i = 0; i < size / 2; i++) {
    const angle = 2 * Math.PI * i / size
    cos[i] = Math.cos(angle)
    sin[i] = Math.sin(angle)
  }
  const window = new Float64Array(length)
  let windowSum = 0
  for (let i = 0; i < length; i++) {
    window[i] = .5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)))
    windowSum += window[i]
  }
  spectrumWorkspace = {
    size, length, reversed, cos, sin, window, windowSum,
    real: new Float64Array(size), imag: new Float64Array(size),
  }
  return spectrumWorkspace
}

export function fftMagnitudes(signal: Float32Array, fftSize: number): Float32Array {
  const N = fftSize
  const { real, imag, reversed, cos, sin, window, windowSum } =
    getSpectrumWorkspace(N, signal.length)
  real.fill(0)
  imag.fill(0)
  for (let i = 0; i < signal.length; i++) real[reversed[i]] = signal[i] * window[i]

  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1
    const stride = N / size
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < half; j++) {
        const a = i + j
        const b = a + half
        const t = j * stride
        const oddReal = real[b] * cos[t] - imag[b] * sin[t]
        const oddImag = real[b] * sin[t] + imag[b] * cos[t]
        const evenReal = real[a]
        const evenImag = imag[a]
        real[a] = evenReal + oddReal
        imag[a] = evenImag + oddImag
        real[b] = evenReal - oddReal
        imag[b] = evenImag - oddImag
      }
    }
  }

  const magnitudes = new Float32Array(N / 2 + 1)
  for (let i = 0; i < magnitudes.length; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / windowSum
    magnitudes[i] = 20 * Math.log10(Math.max(mag, 1e-12))
  }
  return magnitudes
}
