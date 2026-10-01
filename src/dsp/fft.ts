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

// Reusable in-place complex transform; convention matches complexFft above.
export class NumericFft {
  readonly real: Float64Array
  readonly imag: Float64Array
  private readonly _reversed: Uint32Array
  private readonly _cos: Float64Array
  private readonly _sin: Float64Array

  constructor(readonly size: number) {
    if (!Number.isInteger(size) || size < 2 || size > 0x40000000 || (size & (size - 1)) !== 0) {
      throw new RangeError('FFT size must be a power of two greater than one')
    }
    this.real = new Float64Array(size)
    this.imag = new Float64Array(size)
    this._reversed = new Uint32Array(size)
    const log2N = Math.log2(size)
    for (let i = 0; i < size; i++) this._reversed[i] = bitReverse(i, log2N)
    this._cos = new Float64Array(size / 2)
    this._sin = new Float64Array(size / 2)
    for (let i = 0; i < size / 2; i++) {
      const angle = 2 * Math.PI * i / size
      this._cos[i] = Math.cos(angle)
      this._sin[i] = Math.sin(angle)
    }
  }

  transform(inverse = false): void {
    const { real, imag, size: N } = this
    if (inverse) {
      for (let i = 0; i < N; i++) imag[i] = -imag[i]
    }
    for (let i = 0; i < N; i++) {
      const j = this._reversed[i]
      if (i < j) {
        const r = real[i]
        const im = imag[i]
        real[i] = real[j]
        imag[i] = imag[j]
        real[j] = r
        imag[j] = im
      }
    }
    for (let size = 2; size <= N; size *= 2) {
      const half = size / 2
      const stride = N / size
      for (let i = 0; i < N; i += size) {
        for (let j = 0; j < half; j++) {
          const a = i + j
          const b = a + half
          const t = j * stride
          const oddReal = real[b] * this._cos[t] - imag[b] * this._sin[t]
          const oddImag = real[b] * this._sin[t] + imag[b] * this._cos[t]
          const evenReal = real[a]
          const evenImag = imag[a]
          real[a] = evenReal + oddReal
          imag[a] = evenImag + oddImag
          real[b] = evenReal - oddReal
          imag[b] = evenImag - oddImag
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < N; i++) {
        real[i] /= N
        imag[i] = -imag[i] / N
      }
    }
  }
}
