import { BaseAnalysisPipeline, BASE_SAMPLE_RATE } from './base-analysis'
import { extractFormants, isHarmonicLocked } from './lpc'
import type { FormantPeak } from './lpc'
import { extractFormantsCepstral } from './cepstral'
import { DEFAULT_VAD_OPTIONS } from './vad'
import type { VadOptions } from './vad'
import { FormantSmoother } from './formant-smoother'
import type { SmootherFrame } from './formant-smoother'
import { RegisterDetector } from './register-detector'

const TARGET_RATE = BASE_SAMPLE_RATE

export type FormantMethodValue = 'hybrid' | 'lpc' | 'cepstral'

export interface PipelineOptions {
  onFrame?: (frame: SmootherFrame) => void
  vadThreshold?: number
  vadOptions?: VadOptions
  formantMethod?: FormantMethodValue
  frameOffset?: number
  formantSmoothing?: boolean
}

export class AnalysisPipeline {
  private _base: BaseAnalysisPipeline
  onFrame: ((frame: SmootherFrame) => void) | null
  private _frameCount = 0
  private _frameOffset: number
  private _formantMethod: FormantMethodValue
  private _prevGoodF1: number | null = null
  private _smoother: FormantSmoother | null
  private _registerDetector: RegisterDetector

  constructor({
    onFrame,
    vadThreshold,
    vadOptions,
    formantMethod = 'hybrid',
    frameOffset = 0,
    formantSmoothing = true,
  }: PipelineOptions = {}) {
    this._frameOffset = frameOffset
    const threshold = vadThreshold ?? vadOptions?.threshold ?? DEFAULT_VAD_OPTIONS.threshold
    this._formantMethod = formantMethod
    this._smoother = formantSmoothing ? new FormantSmoother() : null
    this._registerDetector = new RegisterDetector()
    this.onFrame = onFrame ?? null
    this._base = this.createBase({
      threshold,
      releaseThreshold: Math.min(threshold, vadOptions?.releaseThreshold ?? DEFAULT_VAD_OPTIONS.releaseThreshold),
      holdMs: vadOptions?.holdMs ?? DEFAULT_VAD_OPTIONS.holdMs,
    })
  }

  get frameCount(): number { return this._frameCount }

  private createBase(vadOptions: VadOptions): BaseAnalysisPipeline {
    return new BaseAnalysisPipeline({vadOptions,onFrame: frame => {
        const {samples: analysisSamples, magnitudes, voiced, rms, rawF0: f0} = frame
        let formants: (FormantPeak | null)[] = []
        if (voiced) {
          if (this._formantMethod === 'cepstral') {
            const result = extractFormantsCepstral(analysisSamples, frame.sampleRate, 2, f0)
            formants = result.formants
          } else if (this._formantMethod === 'lpc') {
            const result = extractFormants(analysisSamples, frame.sampleRate, 2, f0)
            const fmts: (FormantPeak | null)[] = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              if (fmts[0] && isHarmonicLocked(result.f0, fmts[0].freq, fmts[0].bw)) {
                fmts[0] = null
              }
            }
            formants = fmts
          } else {
            let result = extractFormants(analysisSamples, frame.sampleRate, 2, f0)
            let fmts: (FormantPeak | null)[] = result.formants
            if (fmts[1] && fmts[1].freq > 0) {
              const f1Jump = this._prevGoodF1 != null ? Math.abs(fmts[0]!.freq - this._prevGoodF1) : 0
              if (f1Jump > 300 && fmts[0]!.freq > 600) {
                const cepResult = extractFormantsCepstral(analysisSamples, frame.sampleRate, 2, f0)
                const cepFormants: (FormantPeak | null)[] = cepResult.formants
                if (cepFormants[1] && cepFormants[1].freq > 0) {
                  if (cepFormants[0] && isHarmonicLocked(cepResult.f0, cepFormants[0].freq, cepFormants[0].bw)) {
                    cepFormants[0] = null
                  }
                  fmts = cepFormants
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
              const cepResult = extractFormantsCepstral(analysisSamples, frame.sampleRate, 2, f0)
              const cepFormants: (FormantPeak | null)[] = cepResult.formants
              if (cepFormants[1] && cepFormants[1].freq > 0) {
                if (cepFormants[0] && isHarmonicLocked(cepResult.f0, cepFormants[0].freq, cepFormants[0].bw)) {
                  cepFormants[0] = null
                }
                fmts = cepFormants
              }
            }
            this._prevGoodF1 = fmts[0]?.freq ?? null
            formants = fmts
          }
        }
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
          rms,
        }
        if (this._smoother) {
          output = this._smoother.push(output)
        }
        const result = this._registerDetector.push({
          f0: output.f0,
          voiced: output.voiced ?? false,
          magnitudes,
          sampleRate: TARGET_RATE,
        })
        output.register = result.register
        output.registerConfidence = result.confidence
        if (this.onFrame) this.onFrame(output)
    }})
  }

  pushChunk(samples: Float32Array, inputSampleRate: number): void {
    this._base.pushChunk(samples,inputSampleRate)
  }

  flush(): void { this._base.flush() }

  reset(): void {
    this._base.reset()
    if (this._smoother) this._smoother.reset()
    this._registerDetector.reset()
    this._prevGoodF1 = null
    this._frameCount = 0
  }

  static analyze(
    samples: Float32Array,
    sampleRate: number,
    formantMethod: FormantMethodValue,
    formantSmoothing: boolean = true,
  ): SmootherFrame[] {
    if (samples.length === 0) return []
    const frames: SmootherFrame[] = []
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
