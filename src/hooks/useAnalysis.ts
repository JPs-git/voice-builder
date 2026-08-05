import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import { getAudioEngine } from '../ts'
import { recordingBuffer } from '../audio/recordingBuffer'
import { AnalysisPipeline, parseWav, isWavFile, Resampler } from '../dsp'
import { AudioTooLongError, decodeAudioFile, probeAudioDuration, probeWavDuration } from '../audio/audioDecoder'
import type { AnalysisFrame } from '../types'

const STEREO_NOTICE = '该音频为双声道，仅使用第 0 声道进行分析'

function importErrorMessage(err: unknown): string {
  if (err instanceof AudioTooLongError) {
    return '音频不能超过 10 秒，请裁剪后重试。'
  }
  if (err instanceof DOMException) {
    return '浏览器不支持该音频格式或文件已损坏，请尝试 wav/mp3/m4a。'
  }
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
  if (/Failed to load audio metadata|Failed to read audio duration/.test(message)) {
    return '无法读取音频信息，请检查文件。'
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
  const [isImporting, setIsImporting] = useState(false)

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

  // ── Import commit (shared by WAV & decoded paths) ──

  const commitImport = useCallback((samples: Float32Array) => {
    const maxSamples = 16000 * 10
    if (samples.length > maxSamples) {
      throw new AudioTooLongError()
    }
    const config = useAppStore.getState().config
    const frames = AnalysisPipeline.analyze(
      samples, 16000, config.formantMethod, config.formantSmoothing,
    )
    recordingBuffer.clear()
    recordingBuffer.write(samples)
    useAppStore.getState().clearFrames()
    useAppStore.getState().setFrames(frames)
    dataSourceRef.current = 'file'
    setDataSource('file')
    frameOffsetRef.current = 0
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
    if (isImporting) return

    setIsImporting(true)
    stopRecording(false)

    try {
      const head = await file.slice(0, 12).arrayBuffer()

      if (isWavFile(head)) {
        // WAV fast path: abort >10s early via a header-only probe, BEFORE the
        // full file is read into memory. `null` (header unresolvable) falls
        // through to the full parse, where commitImport backstops the limit.
        const duration = await probeWavDuration(file)
        if (duration !== null && duration > 10) {
          throw new AudioTooLongError()
        }
        const buf = await file.arrayBuffer()
        const parsed = parseWav(buf)
        if (parsed.numChannels > 1) {
          useToastStore.getState().showToast('info', STEREO_NOTICE)
        }
        let samples = parsed.samples
        if (parsed.sampleRate !== 16000) {
          samples = new Resampler(parsed.sampleRate, 16000).process(samples)
        }
        commitImport(samples)
        return
      }

      // Compressed audio: probe duration (metadata only) BEFORE decoding,
      // so >10s files are rejected without full decode or heap churn.
      const duration = await probeAudioDuration(file)
      if (duration > 10) {
        throw new AudioTooLongError()
      }

      const buf = await file.arrayBuffer()
      const decoded = await decodeAudioFile(buf)
      if (decoded.numChannels > 1) {
        useToastStore.getState().showToast('info', STEREO_NOTICE)
      }
      let samples = decoded.samples
      if (decoded.sampleRate !== 16000) {
        samples = new Resampler(decoded.sampleRate, 16000).process(samples)
      }
      commitImport(samples)
    } catch (err) {
      console.error('Audio import failed:', err)
      useToastStore.getState().showToast('error', importErrorMessage(err))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [stopRecording, commitImport, isImporting])

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
