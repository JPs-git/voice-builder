import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'
import { fftMagnitudes } from './fft.js'
import { detectPitch, extractFormants, isHarmonicLocked } from './lpc.js'
import { extractFormantsCepstral } from './cepstral.js'
import { VoiceActivityDetector } from './vad.js'

const TARGET_RATE = 16000
const FRAME_SIZE = 640
const HOP_SIZE = 160

export class AnalysisPipeline {
  constructor({ onFrame, vadThreshold, formantMethod = 'cepstral', frameOffset = 0 } = {}) {
    this._resampler = null
    this._frameProcessor = null
    this.onFrame = onFrame
    this._frameCount = 0
    this._frameOffset = frameOffset
    this._vad = new VoiceActivityDetector({ threshold: vadThreshold ?? 0.008 })
    this._formantMethod = formantMethod
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
            const result = extractFormantsCepstral(frame.samples, frame.sampleRate)
            formants = result.formants
          } else {
            const result = extractFormants(frame.samples, frame.sampleRate)
            formants = result.formants
            if (formants[0] && isHarmonicLocked(result.f0, formants[0].freq, formants[0].bw)) {
              formants[0] = null
            }
          }
        }
        const magnitudes = fftMagnitudes(frame.samples, 1024)
        this._frameCount++
        const output = {
          f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: (this._frameCount + this._frameOffset) * 0.01,
          magnitudes,
          voiced,
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
    this._frameCount = 0
  }

  static analyze(samples, sampleRate, formantMethod) {
    if (samples.length === 0) return []
    const frames = []
    const pipeline = new AnalysisPipeline({
      onFrame: (frame) => frames.push(frame),
      formantMethod,
    })
    pipeline.pushChunk(samples, sampleRate)
    pipeline.flush()
    return frames
  }
}
