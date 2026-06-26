import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'
import { fftMagnitudes } from './fft.js'
import { detectPitch, extractFormants, isHarmonicLocked } from './lpc.js'
import { extractFormantsCepstral } from './cepstral.js'
import { VoiceActivityDetector } from './vad.js'
import { FormantSmoother } from './formant-smoother.js'

const TARGET_RATE = 16000
const FRAME_SIZE = 800
const HOP_SIZE = 160

export class AnalysisPipeline {
  constructor({ onFrame, vadThreshold, formantMethod = 'hybrid', frameOffset = 0, formantSmoothing = true } = {}) {
    this._resampler = null
    this._frameProcessor = null
    this.onFrame = onFrame
    this._frameCount = 0
    this._frameOffset = frameOffset
    this._vad = new VoiceActivityDetector({ threshold: vadThreshold ?? 0.008 })
    this._formantMethod = formantMethod
    this._prevGoodF1 = null
    this._smoother = formantSmoothing ? new FormantSmoother() : null
  }

  get frameCount() { return this._frameCount }

  pushChunk(samples, inputSampleRate) {
    if (!this._frameProcessor) {
      this._frameProcessor = new FrameProcessor({ sampleRate: TARGET_RATE, frameSize: FRAME_SIZE, hopSize: HOP_SIZE })
      this._frameProcessor.onFrame = (frame) => {
        const { voiced } = this._vad.compute(frame.samples)
        let f0 = null
        let formants = []
        if (voiced) {
          f0 = detectPitch(frame.samples, frame.sampleRate)
          if (this._formantMethod === 'cepstral') {
            const result = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
            formants = result.formants
          } else if (this._formantMethod === 'lpc') {
            const result = extractFormants(frame.samples, frame.sampleRate, 2)
            let fmts = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                fmts[0] = null
              }
            }
            formants = fmts
          } else {
            let result = extractFormants(frame.samples, frame.sampleRate, 2)
            let fmts = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              const f1Jump = this._prevGoodF1 != null ? Math.abs(fmts[0].freq - this._prevGoodF1) : 0
              if (f1Jump > 300 && fmts[0].freq > 600) {
                const cepResult = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
                if (cepResult.formants[1] && cepResult.formants[1].freq > 0) {
                  if (cepResult.formants[0] && isHarmonicLocked(cepResult.f0, cepResult.formants[0].freq, cepResult.formants[0].bw)) {
                    cepResult.formants[0] = null
                  }
                  fmts = cepResult.formants
                } else {
                  if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                    fmts[0] = null
                  }
                }
              } else {
                if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                  fmts[0] = null
                }
              }
            } else {
              const cepResult = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
              if (cepResult.formants[1] && cepResult.formants[1].freq > 0) {
                if (cepResult.formants[0] && isHarmonicLocked(cepResult.f0, cepResult.formants[0].freq, cepResult.formants[0].bw)) {
                  cepResult.formants[0] = null
                }
                fmts = cepResult.formants
              }
            }
            this._prevGoodF1 = fmts[0]?.freq ?? null
            formants = fmts
          }
        }
        const magnitudes = fftMagnitudes(frame.samples, 2048)
        this._frameCount++
        let output = {
          f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: (this._frameCount + this._frameOffset) * 0.01,
          magnitudes,
          voiced,
        }
        if (this._smoother) {
          output = this._smoother.push(output)
        }
        if (this.onFrame) this.onFrame(output)
      }
      if (inputSampleRate !== TARGET_RATE) {
        this._resampler = new Resampler(inputSampleRate, TARGET_RATE)
      }
    }
    const data = this._resampler ? this._resampler.process(samples) : samples
    if (data.length > 0) {
      this._frameProcessor.push(data)
    }
  }

  flush() {
    if (this._frameProcessor) {
      this._frameProcessor.push(new Float32Array(FRAME_SIZE))
    }
  }

  reset() {
    if (this._resampler) this._resampler.reset()
    if (this._frameProcessor) this._frameProcessor.reset()
    if (this._smoother) this._smoother.reset()
    this._prevGoodF1 = null
    this._frameCount = 0
  }

  static analyze(samples, sampleRate, formantMethod, formantSmoothing = true) {
    if (samples.length === 0) return []
    const frames = []
    const pipeline = new AnalysisPipeline({
      onFrame: (frame) => frames.push(frame),
      formantMethod,
      formantSmoothing,
    })
    pipeline.pushChunk(samples, sampleRate)
    pipeline.flush()
    return frames
  }
}
