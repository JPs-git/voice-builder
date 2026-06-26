import { Complex } from './complex.js'
import { complexFft, ifft } from './fft.js'
import { detectPitch } from './lpc.js'

const PRE_EMPHASIS = 0.99
const FFT_SIZE = 2048
const LIFTER_CUTOFF = 35
const MIN_FORMANT_FREQ = 50
const MAX_FORMANT_FREQ = 3500
const BW_DROP = 0.5 * Math.log(2)

function applyPreEmphasis(signal, coeff) {
  const n = signal.length
  const out = new Float32Array(n)
  out[0] = signal[0]
  for (let i = 1; i < n; i++) out[i] = signal[i] - coeff * signal[i - 1]
  return out
}

function applyHamming(signal) {
  const n = signal.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = signal[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)))
  }
  return out
}

function cepstralEnvelope(signal, fftSize, lifterCutoff) {
  const n = signal.length
  const N = fftSize

  const data = new Array(N)
  for (let i = 0; i < n; i++) data[i] = new Complex(signal[i], 0)
  for (let i = n; i < N; i++) data[i] = new Complex(0, 0)
  complexFft(data)

  const logMag = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const mag = Math.sqrt(data[i].re * data[i].re + data[i].im * data[i].im)
    logMag[i] = Math.log(Math.max(mag, 1e-30))
  }

  const cepstrum = new Array(N)
  for (let i = 0; i < N; i++) cepstrum[i] = new Complex(logMag[i], 0)
  ifft(cepstrum)

  for (let i = lifterCutoff + 1; i < N - lifterCutoff; i++) {
    cepstrum[i] = new Complex(0, 0)
  }

  complexFft(cepstrum)

  const bins = N / 2 + 1
  const envelope = new Float32Array(bins)
  for (let i = 0; i < bins; i++) envelope[i] = cepstrum[i].re

  return envelope
}

function parabolicInterp(y0, y1, y2) {
  const a = (y0 + y2 - 2 * y1) / 2
  const b = (y2 - y0) / 2
  if (a === 0) return [0, y1]
  const delta = -b / (2 * a)
  const peak = y1 - b * b / (4 * a)
  return [delta, peak]
}

function pickPeaks(envelope, sampleRate, fftSize) {
  const N = fftSize
  const bins = envelope.length
  const raw = []

  for (let k = 1; k < bins - 1; k++) {
    if (!(envelope[k] > envelope[k - 1] && envelope[k] >= envelope[k + 1])) continue

    const freq = k * sampleRate / N
    if (freq < MIN_FORMANT_FREQ || freq > MAX_FORMANT_FREQ) continue

    const [delta, interpVal] = parabolicInterp(envelope[k - 1], envelope[k], envelope[k + 1])
    raw.push({ bin: k, delta, freq: (k + delta) * sampleRate / N, value: interpVal })
  }

  for (let i = 0; i < raw.length; i++) {
    const pk = raw[i]

    let leftMin = envelope[0]
    if (i > 0) {
      const prevBin = raw[i - 1].bin
      leftMin = envelope[prevBin]
      for (let j = prevBin + 1; j < pk.bin; j++) {
        if (envelope[j] < leftMin) leftMin = envelope[j]
      }
    } else {
      for (let j = 0; j < pk.bin; j++) {
        if (envelope[j] < leftMin) leftMin = envelope[j]
      }
    }

    let rightMin = envelope[bins - 1]
    if (i < raw.length - 1) {
      const nextBin = raw[i + 1].bin
      rightMin = envelope[nextBin]
      for (let j = pk.bin + 1; j < nextBin; j++) {
        if (envelope[j] < rightMin) rightMin = envelope[j]
      }
    } else {
      for (let j = pk.bin + 1; j < bins; j++) {
        if (envelope[j] < rightMin) rightMin = envelope[j]
      }
    }

    pk.prominence = pk.value - Math.max(leftMin, rightMin)
  }

  const sig = raw.filter(p => p.prominence > BW_DROP)
  sig.sort((a, b) => a.freq - b.freq)
  return sig
}

function estimateBandwidth(envelope, peakBin, sampleRate, fftSize) {
  const N = fftSize
  const peakVal = envelope[peakBin]
  const threshold = peakVal - BW_DROP

  let left = peakBin - 1
  while (left > 0 && envelope[left] > threshold) left--
  let right = peakBin + 1
  while (right < envelope.length - 1 && envelope[right] > threshold) right++

  const leftFreq = left * sampleRate / N
  const rightFreq = right * sampleRate / N
  const peakFreq = peakBin * sampleRate / N

  const bw = 2 * Math.min(peakFreq - leftFreq, rightFreq - peakFreq)
  return Math.max(bw, 0)
}

export function extractFormantsCepstral(signal, sampleRate, maxFormants = 5) {
  const emphasized = applyPreEmphasis(signal, PRE_EMPHASIS)
  const windowed = applyHamming(emphasized)
  const envelope = cepstralEnvelope(windowed, FFT_SIZE, LIFTER_CUTOFF)
  const peaks = pickPeaks(envelope, sampleRate, FFT_SIZE)

  const formants = peaks.slice(0, maxFormants).map(p => {
    const bw = estimateBandwidth(envelope, p.bin, sampleRate, FFT_SIZE)
    return { freq: p.freq, bw }
  })

  const f0 = detectPitch(signal, sampleRate)
  return { f0, formants }
}
