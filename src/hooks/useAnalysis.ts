import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { getAudioEngine } from '../ts'
import { recordingBuffer } from '../audio/recordingBuffer'
import { AnalysisPipeline } from '../../js/analysis-pipeline.js'
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'
import type { AnalysisFrame } from '../types'

export function useAnalysis() {
  const pipelineRef = useRef<InstanceType<typeof AnalysisPipeline> | null>(null)
  const frameOffsetRef = useRef(0)
  const dataSourceRef = useRef<'mic' | 'file'>('mic')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current?.reset()
      pipelineRef.current = null
      getAudioEngine().stopCapture()
    }
  }, [])

  // ── Audio chunk handler ──

  const onAudioChunk = useCallback((chunk: Float32Array, rate: number) => {
    recordingBuffer.write(chunk)
    pipelineRef.current?.pushChunk(chunk, rate)
  }, [])

  // ── Record ──

  const onRecord = useCallback(async () => {
    if (isCapturing) {
      // Stop
      const pipeline = pipelineRef.current
      if (pipeline) {
        pipeline.flush()
        frameOffsetRef.current += pipeline.frameCount
        pipeline.reset()
        pipelineRef.current = null
      }
      getAudioEngine().stopCapture()
      setIsCapturing(false)
      return
    }

    // Start / Append
    setIsRequesting(true)

    const config = useAppStore.getState().config

    // dataSource='file' → clear and start fresh; 'mic' with data → append
    if (dataSourceRef.current === 'file') {
      frameOffsetRef.current = 0
      recordingBuffer.clear()
      useAppStore.getState().reset()
    }

    pipelineRef.current = new AnalysisPipeline({
      onFrame: (frame: AnalysisFrame) => {
        useAppStore.getState().appendFrame(frame)
      },
      formantMethod: config.formantMethod,
      formantSmoothing: config.formantSmoothing,
      frameOffset: frameOffsetRef.current,
    } as any)

    try {
      await getAudioEngine().startCapture(onAudioChunk)
      dataSourceRef.current = 'mic'
      setIsCapturing(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
    } finally {
      setIsRequesting(false)
    }
  }, [isCapturing, onAudioChunk])

  // ── Clear ──

  const onClear = useCallback(() => {
    if (isCapturing) {
      pipelineRef.current?.reset()
      pipelineRef.current = null
      getAudioEngine().stopCapture()
      setIsCapturing(false)
    }
    recordingBuffer.clear()
    useAppStore.getState().reset()
    frameOffsetRef.current = 0
  }, [isCapturing])

  // ── WAV import ──

  const onImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buf = await file.arrayBuffer()

      // Stop recording if active
      if (isCapturing) {
        pipelineRef.current?.reset()
        pipelineRef.current = null
        getAudioEngine().stopCapture()
        setIsCapturing(false)
      }

      const parsed: any = parseWav(buf)
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

      recordingBuffer.clear()
      recordingBuffer.write(samples)
      dataSourceRef.current = 'file'
      frameOffsetRef.current = 0

      useAppStore.getState().reset()
      const config = useAppStore.getState().config
      const frames: AnalysisFrame[] = AnalysisPipeline.analyze(
        samples as any,
        16000,
        config.formantMethod,
        config.formantSmoothing,
      )

      useAppStore.getState().setFrames(frames)
    } catch (err) {
      console.error('WAV import failed:', err)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [isCapturing])

  return {
    onRecord,
    onImport,
    onClear,
    isCapturing,
    isRequesting,
    fileInputRef,
    handleFileChange,
  }
}
