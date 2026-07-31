import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'
import { getAudioEngine } from '../ts'
import { RingBuffer } from '../dsp/RingBuffer'
import { AnalysisPipeline } from '../../js/analysis-pipeline.js'
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'
import type { AnalysisFrame, AppPhase } from '../types'

type Phase = AppPhase

export class AnalysisService {
  private rawBuffer: RingBuffer
  private pipeline: InstanceType<typeof AnalysisPipeline> | null = null
  private frameOffset: number = 0
  private unsubPhase: (() => void) | null = null
  private maxDurationSec = 10

  constructor() {
    this.rawBuffer = new RingBuffer(16000 * this.maxDurationSec)
  }

  // ── Lifecycle ──

  start(): void {
    this.unsubPhase = useAnalysisStore.subscribe(
      (state, prev) => {
        if (state.phase === prev.phase) return
        this.handlePhaseChange(prev.phase, state.phase)
      },
    )
  }

  destroy(): void {
    this.unsubPhase?.()
    this.cleanupAll()
  }

  // ── Phase handling ──

  private async handlePhaseChange(from: Phase, to: Phase): Promise<void> {
    // Stop capture when leaving recording
    if (from === 'recording' && to !== 'recording') {
      this.stopCapture()
    }

    // Start capture when entering requesting
    if (to === 'requesting') {
      await this.startCapture()
    }

    // Clear all when entering idle
    if (to === 'idle') {
      this.rawBuffer.clear()
      useFrameStore.getState().clear()
      useAnalysisStore.getState().reset()
    }
  }

  // ── Audio chunk handler ──

  private onAudioChunk = (chunk: Float32Array, rate: number) => {
    this.rawBuffer.write(chunk)
    this.pipeline?.pushChunk(chunk, rate)
  }

  // ── Capture control ──

  private async startCapture(): Promise<void> {
    const state = useAnalysisStore.getState()

    // Keep frameOffset for appending; reset for fresh recording or from file
    if (state.dataSource === 'mic' && state.phase === 'requesting') {
      // Appending — frameOffset preserved from stopCapture
    } else {
      this.frameOffset = 0
      this.rawBuffer.clear()
      useFrameStore.getState().clear()
    }

    const config = state.config

    this.pipeline = new AnalysisPipeline({
      onFrame: (frame: AnalysisFrame) => {
        useFrameStore.getState().appendFrame(frame)
      },
      formantMethod: config.formantMethod,
      formantSmoothing: config.formantSmoothing,
      frameOffset: this.frameOffset,
    } as any)

    try {
      await getAudioEngine().startCapture(this.onAudioChunk)
      useAnalysisStore.setState({
        phase: 'recording',
        dataSource: 'mic',
      })
    } catch (err) {
      console.error('Failed to start recording:', err)
      useAnalysisStore.setState({ phase: 'idle', dataSource: null })
    }
  }

  private stopCapture(): void {
    if (this.pipeline) {
      this.pipeline.flush()
      this.frameOffset += this.pipeline.frameCount
      this.pipeline.reset()
      this.pipeline = null
    }
    getAudioEngine().stopCapture()

    if (useFrameStore.getState().frames.length > 0) {
      useAnalysisStore.setState({
        phase: 'ready',
        dataSource: 'mic',
      })
    }
  }

  // ── Playback ──

  getPlaybackSamples(): Float32Array {
    return this.rawBuffer.read()
  }

  // ── WAV import ──

  async importWav(arrayBuffer: ArrayBuffer): Promise<void> {
    const state = useAnalysisStore.getState()

    if (state.phase === 'recording') {
      this.stopCapture()
    }

    const parsed: any = parseWav(arrayBuffer)
    let samples = parsed.samples as Float32Array
    let rate = parsed.sampleRate as number

    if (rate !== 16000) {
      const r = new Resampler(rate, 16000)
      samples = r.process(samples)
    }

    const maxSamples = 16000 * this.maxDurationSec
    if (samples.length > maxSamples) {
      throw new Error('音频不能超过 10 秒')
    }

    this.rawBuffer.clear()
    this.rawBuffer.write(samples)

    useFrameStore.getState().clear()
    const config = state.config
    const frames: AnalysisFrame[] = AnalysisPipeline.analyze(
      samples as any,
      16000,
      config.formantMethod,
      config.formantSmoothing,
    )

    useFrameStore.getState().setFrames(frames)
    useAnalysisStore.setState({
      phase: 'ready',
      dataSource: 'file',
    })
  }

  // ── Cleanup ──

  private cleanupAll(): void {
    this.pipeline?.reset()
    this.pipeline = null
    getAudioEngine().stopCapture()
    this.rawBuffer.clear()
  }
}

// ── Singleton ──

let instance: AnalysisService | null = null

export function getAnalysisService(): AnalysisService {
  if (!instance) {
    instance = new AnalysisService()
  }
  return instance
}

export function resetAnalysisService(): void {
  instance?.destroy()
  instance = null
}
