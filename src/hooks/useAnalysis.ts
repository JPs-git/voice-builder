import { useEffect, useRef, useCallback } from 'react'
import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'
import { getAudioEngine } from '../ts'
import { RingBuffer } from '../dsp/RingBuffer'
import { AnalysisPipeline } from '../../js/analysis-pipeline.js'
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'
import type { AnalysisFrame, AppPhase } from '../types'

type Phase = AppPhase

export function useAnalysis() {
  const phase = useAnalysisStore(s => s.phase)
  const rawBufferRef = useRef(new RingBuffer(16000 * 10))
  const pipelineRef = useRef<InstanceType<typeof AnalysisPipeline> | null>(null)
  const frameOffsetRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevPhaseRef = useRef<Phase>(phase)

  // ── Audio chunk handler ──

  const onAudioChunk = useCallback((chunk: Float32Array, rate: number) => {
    rawBufferRef.current.write(chunk)
    pipelineRef.current?.pushChunk(chunk, rate)
  }, [])

  // ── Capture control ──

  const startCapture = useCallback(async () => {
    const state = useAnalysisStore.getState()

    // Keep frameOffset for appending; reset for fresh or file-based
    if (state.dataSource === 'mic' && state.phase === 'requesting') {
      // Appending — frameOffset preserved from previous stopCapture
    } else {
      frameOffsetRef.current = 0
      rawBufferRef.current.clear()
      useFrameStore.getState().clear()
    }

    const config = state.config

    pipelineRef.current = new AnalysisPipeline({
      onFrame: (frame: AnalysisFrame) => {
        useFrameStore.getState().appendFrame(frame)
      },
      formantMethod: config.formantMethod,
      formantSmoothing: config.formantSmoothing,
      frameOffset: frameOffsetRef.current,
    } as any)

    try {
      await getAudioEngine().startCapture(onAudioChunk)
      useAnalysisStore.setState({
        phase: 'recording',
        dataSource: 'mic',
      })
    } catch (err) {
      console.error('Failed to start recording:', err)
      useAnalysisStore.setState({ phase: 'idle', dataSource: null })
    }
  }, [onAudioChunk])

  const stopCapture = useCallback(() => {
    const pipeline = pipelineRef.current
    if (pipeline) {
      pipeline.flush()
      frameOffsetRef.current += pipeline.frameCount
      pipeline.reset()
      pipelineRef.current = null
    }
    getAudioEngine().stopCapture()

    if (useFrameStore.getState().frames.length > 0) {
      useAnalysisStore.setState({
        phase: 'ready',
        dataSource: 'mic',
      })
    }
  }, [])

  const clearAll = useCallback(() => {
    rawBufferRef.current.clear()
    useFrameStore.getState().clear()
    useAnalysisStore.getState().reset()
  }, [])

  // ── Phase change watcher ──

  useEffect(() => {
    const prev = prevPhaseRef.current
    const next = phase
    prevPhaseRef.current = next
    if (prev === next) return

    const handle = async () => {
      // Stop capture when leaving recording
      if (prev === 'recording' && next !== 'recording') {
        stopCapture()
      }

      // Start capture when entering requesting
      if (next === 'requesting') {
        await startCapture()
      }

      // Clear all when entering idle
      if (next === 'idle') {
        clearAll()
      }
    }
    handle()
  }, [phase, startCapture, stopCapture, clearAll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current?.reset()
      pipelineRef.current = null
      getAudioEngine().stopCapture()
    }
  }, [])

  // ── Playback ──

  const getPlaybackSamples = useCallback((): Float32Array => {
    return rawBufferRef.current.read()
  }, [])

  // ── WAV import ──

  const importWav = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const importWavFromBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    const state = useAnalysisStore.getState()

    if (state.phase === 'recording') {
      stopCapture()
    }

    const parsed: any = parseWav(arrayBuffer)
    let samples = parsed.samples as Float32Array
    let rate = parsed.sampleRate as number

    if (rate !== 16000) {
      const r = new Resampler(rate, 16000)
      samples = r.process(samples)
    }

    const maxSamples = 16000 * 10
    if (samples.length > maxSamples) {
      throw new Error('音频不能超过 10 秒')
    }

    rawBufferRef.current.clear()
    rawBufferRef.current.write(samples)

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
  }, [stopCapture])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      await importWavFromBuffer(buf)
    } catch (err) {
      console.error('WAV import failed:', err)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [importWavFromBuffer])

  return {
    importWav,
    getPlaybackSamples,
    fileInputRef,
    handleFileChange,
  }
}
