import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { getAudioEngine } from '../ts'
import { recordingBuffer } from '../audio/recordingBuffer'
import { AnalysisPipeline, parseWav, isWavFile, Resampler } from '../dsp'
import type { AnalysisFrame } from '../types'

function importErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (/Not a RIFF file|Not a WAV file/.test(message)) {
    return '不支持的文件格式，请选择 .wav 文件。'
  }
  if (/chunk not found/.test(message)) {
    return '文件已损坏或不是有效的 WAV 文件。'
  }
  if (/Unsupported bitsPerSample/.test(message)) {
    return '不支持的编码，仅支持 8/16/24/32 位 PCM。'
  }
  return '导入失败，请检查文件后重试。'
}

export function useAnalysis() {
  const pipelineRef = useRef<InstanceType<typeof AnalysisPipeline> | null>(null)
  const frameOffsetRef = useRef(0)
  const dataSourceRef = useRef<'mic' | 'file'>('mic')
  const [dataSource, setDataSource] = useState<'mic' | 'file'>('mic')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  // ── Shared stop-recording helper ──

  const stopRecording = useCallback((flush: boolean) => {
    const pipeline = pipelineRef.current
    if (pipeline) {
      if (flush) {
        pipeline.flush()
        frameOffsetRef.current += pipeline.frameCount
      }
      pipeline.reset()
      pipelineRef.current = null
    }
    getAudioEngine().stopCapture()
    setIsCapturing(false)
    setIsRequesting(false)
  }, [])

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
      stopRecording(true)
      return
    }

    // Guard: already requesting permission
    if (isRequesting) return

    setIsRequesting(true)

    const config = useAppStore.getState().config  // 快照

    // dataSource='file' → clear frames and start fresh
    if (dataSourceRef.current === 'file') {
      frameOffsetRef.current = 0
      recordingBuffer.clear()
      useAppStore.getState().clearFrames()
    }

    try {
      await getAudioEngine().startCapture(onAudioChunk)

      // Only create pipeline AFTER capture succeeds
      pipelineRef.current = new AnalysisPipeline({
        onFrame: (frame: AnalysisFrame) => {
          useAppStore.getState().appendFrame(frame)
        },
        formantMethod: config.formantMethod,
        formantSmoothing: config.formantSmoothing,
        frameOffset: frameOffsetRef.current,
      })

      dataSourceRef.current = 'mic'
      setDataSource('mic')
      setIsCapturing(true)
      setIsRequesting(false)
    } catch (err) {
      console.error('Failed to start recording:', err)
      useToastStore.getState().showToast('error', '无法启动录音,请检查麦克风权限。')
      setIsRequesting(false)
    }
  }, [isCapturing, isRequesting, stopRecording, onAudioChunk])

  // ── Clear ──

  const onClear = useCallback(() => {
    stopRecording(false)
    recordingBuffer.clear()
    useAppStore.getState().clearFrames()
    frameOffsetRef.current = 0
    dataSourceRef.current = 'mic'
    setDataSource('mic')
  }, [stopRecording])

  // ── WAV import ──

  const onImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const buf = await file.arrayBuffer()

      if (!isWavFile(buf)) {
        useToastStore.getState().showToast('error', '不支持的文件格式，请选择 .wav 文件。')
        return
      }

      stopRecording(false)

      const parsed = parseWav(buf)
      let samples = parsed.samples
      let rate = parsed.sampleRate

      if (rate !== 16000) {
        const r = new Resampler(rate, 16000)
        samples = r.process(samples)
      }

      const maxSamples = 16000 * 10
      if (samples.length > maxSamples) {
        useToastStore.getState().showToast('error', '导入的音频不能超过 10 秒，请裁剪后重试。')
        return
      }

      // Snapshot config BEFORE touching state
      const config = useAppStore.getState().config

      // Analyze first, then commit data
      const frames = AnalysisPipeline.analyze(
        samples, 16000, config.formantMethod, config.formantSmoothing,
      )

      // Commit: only after analysis succeeds
      recordingBuffer.clear()
      recordingBuffer.write(samples)
      useAppStore.getState().clearFrames()
      useAppStore.getState().setFrames(frames)
      dataSourceRef.current = 'file'
      setDataSource('file')
      frameOffsetRef.current = 0
    } catch (err) {
      console.error('WAV import failed:', err)
      useToastStore.getState().showToast('error', importErrorMessage(err))
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [stopRecording])

  return {
    onRecord,
    onImport,
    onClear,
    isCapturing,
    isRequesting,
    dataSource,
    fileInputRef,
    handleFileChange,
  }
}
