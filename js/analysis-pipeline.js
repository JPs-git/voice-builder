import { Resampler } from './resampler.js'
import { FrameProcessor } from './frame-processor.js'
import { fftMagnitudes } from './fft.js'
import { detectPitch, extractFormants } from './lpc.js'

const TARGET_RATE = 16000
const FRAME_SIZE = 400
const HOP_SIZE = 160

export class AnalysisPipeline {
  constructor({ onFrame } = {}) {
    this._resampler = null
    this._frameProcessor = null
    this.onFrame = onFrame
    this._frameCount = 0
  }

  pushChunk(samples, inputSampleRate) {
    if (!this._frameProcessor) {
      this._frameProcessor = new FrameProcessor({ sampleRate: TARGET_RATE, frameSize: FRAME_SIZE, hopSize: HOP_SIZE })
      this._frameProcessor.onFrame = (frame) => {
        const f0 = detectPitch(frame.samples, frame.sampleRate)
        const result = extractFormants(frame.samples, frame.sampleRate)
        const formants = result.formants
        const magnitudes = fftMagnitudes(frame.samples, 512)
        this._frameCount++
        const output = {
          f0,
          f1: formants[0]?.freq ?? null,
          f2: formants[1]?.freq ?? null,
          f3: formants[2]?.freq ?? null,
          f4: formants[3]?.freq ?? null,
          time: this._frameCount * 0.01,
          magnitudes,
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

  static analyze(samples, sampleRate) {
    if (samples.length === 0) return []
    const frames = []
    const pipeline = new AnalysisPipeline({
      onFrame: (frame) => frames.push(frame),
    })
    pipeline.pushChunk(samples, sampleRate)
    pipeline.flush()
    return frames
  }
}
