import { Resampler } from './resampler'
import { FrameProcessor } from './frame-processor'
import type { FrameData } from './frame-processor'
import { fftMagnitudes } from './fft'
import { detectPitch, extractFormants, isHarmonicLocked } from './lpc'
import { extractFormantsCepstral } from './cepstral'
import { VoiceActivityDetector } from './vad'
import { FormantSmoother } from './formant-smoother'
import type { SmootherFrame } from './formant-smoother'

const TARGET_RATE = 16000
const FRAME_SIZE = 800
const HOP_SIZE = 160

export interface PipelineOptions {
  onFrame?: (frame: SmootherFrame) => void
  vadThreshold?: number
  formantMethod?: 'hybrid' | 'lpc' | 'cepstral'
  frameOffset?: number
  formantSmoothing?: boolean
}

export interface FormantResult {
  freq: number
  bw: number
}

export class AnalysisPipeline {
  private _resampler: Resampler | null = null
  private _frameProcessor: FrameProcessor | null = null
  onFrame: ((frame: SmootherFrame) => void) | null
  private _frameCount = 0
  private _frameOffset: number
  private _vad: VoiceActivityDetector
  private _formantMethod: string
  private _prevGoodF1: number | null = null
  private _smoother: FormantSmoother | null

  constructor({
    onFrame,
    vadThreshold,
    formantMethod = 'hybrid',
    frameOffset = 0,
    formantSmoothing = true,
  }: PipelineOptions = {}) {
    this._frameOffset = frameOffset
    this._vad = new VoiceActivityDetector({ threshold: vadThreshold })
    this._formantMethod = formantMethod
    this._smoother = formantSmoothing ? new FormantSmoother() : null
    this.onFrame = onFrame ?? null
  }

  get frameCount(): number { return this._frameCount }

  pushChunk(samples: Float32Array, inputSampleRate: number): void {
    if (!this._frameProcessor) {
      this._frameProcessor = new FrameProcessor({
        sampleRate: TARGET_RATE,
        frameSize: FRAME_SIZE,
        hopSize: HOP_SIZE,
      })
      this._frameProcessor.onFrame = (frame: FrameData) => {
        const { voiced } = this._vad.compute(frame.samples)
        let f0: number | null = null
        let formants: FormantResult[] = []
        if (voiced) {
          f0 = detectPitch(frame.samples, frame.sampleRate)
          if (this._formantMethod === 'cepstral') {
            const result = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
            formants = result.formants
          } else if (this._formantMethod === 'lpc') {
            const result = extractFormants(frame.samples, frame.sampleRate, 2)
            const fmts = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                fmts[0] = null as unknown as FormantResult
              }
            }
            formants = fmts
          } else {
            const result = extractFormants(frame.samples, frame.sampleRate, 2)
            const fmts = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              const f1Jump = this._prevGoodF1 != null ? Math.abs(fmts[0].freq - this._prevGoodF1) : 0
              if (f1Jump > 300 && fmts[0].freq > 600) {
                const cepResult = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
                if (cepResult.formants[1] && cepResult.formants[1].freq > 0) {
                  if (cepResult.formants[0] && isHarmonicLocked(cepResult.f0, cepResult.formants[0].freq, cepResult.formants[0].bw)) {
                    cepResult.formants[0] = null as unknown as FormantResult
                  }
                  formants = cepResult.formants
                } else {
                  if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                    fmts[0] = null as unknown as FormantResult
                  }
                }
              } else {
                if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                  fmts[0] = null as unknown as FormantResult
                }
              }
            } else {
              const cepResult = extractFormantsCepstral(frame.samples, frame.sampleRate, 2)
              if (cepResult.formants[1] && cepResult.formants[1].freq > 0) {
                if (cepResult.formants[0] && isHarmonicLocked(cepResult.f0, cepResult.formants[0].freq, cepResult.formants[0].bw)) {
                  cepResult.formants[0] = null as unknown as FormantResult
                }
                formants = cepResult.formants
              }
            }
            this._prevGoodF1 = formants[0]?.freq ?? null
          }
        }
        const magnitudes = fftMagnitudes(frame.samples, 2048)
        this._frameCount++
        let output: SmootherFrame = {
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

  flush(): void {
    if (this._frameProcessor) {
      this._frameProcessor.push(new Float32Array(FRAME_SIZE))
    }
  }

  reset(): void {
    if (this._resampler) this._resampler.reset()
    if (this._frameProcessor) this._frameProcessor.reset()
    if (this._smoother) this._smoother.reset()
    this._prevGoodF1 = null
    this._frameCount = 0
  }

  static analyze(
    samples: Float32Array,
    sampleRate: number,
    formantMethod: string,
    formantSmoothing: boolean = true,
  ): SmootherFrame[] {
    if (samples.length === 0) return []
    const frames: SmootherFrame[] = []
    const pipeline = new AnalysisPipeline({
      onFrame: (frame) => frames.push(frame),
      formantMethod: formantMethod as 'hybrid' | 'lpc' | 'cepstral',
      formantSmoothing,
    })
    pipeline.pushChunk(samples, sampleRate)
    pipeline.flush()
    return frames
  }
}
