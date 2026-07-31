import { useState, useRef, useCallback, useEffect } from 'react'
import { getAudioEngine } from '../ts'
import { recordingBuffer } from '../audio/recordingBuffer'
import { useAppStore } from '../store/appStore'

export function usePlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [cursorTime, setCursorTime] = useState(-1)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const tickIdRef = useRef(0)

  const stop = useCallback(() => {
    const source = sourceRef.current
    if (source) {
      source.onended = null  // 防止旧 onended 覆盖新播放
      try { source.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsPlaying(false)
    setCursorTime(-1)
  }, [])

  const play = useCallback(() => {
    const samples = recordingBuffer.read()
    if (samples.length === 0) return

    // 先停旧的
    stop()

    const ae = getAudioEngine()
    const { source, totalDuration } = ae.createPlaybackSource(samples)

    const firstTime = useAppStore.getState().frames[0]?.time ?? 0
    startTimeRef.current = ae.audioContext.currentTime
    tickIdRef.current += 1
    const activeTickId = tickIdRef.current

    source.onended = () => {
      // 只有当前 source 的 ended 才生效
      if (sourceRef.current !== source) return
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      sourceRef.current = null
      setIsPlaying(false)
      setCursorTime(-1)
    }

    source.start()
    sourceRef.current = source
    setIsPlaying(true)

    const tick = () => {
      // 检查是否仍然是当前播放
      if (sourceRef.current !== source) return
      const elapsed = Math.min(
        ae.audioContext.currentTime - startTimeRef.current,
        totalDuration,
      )
      setCursorTime(elapsed + firstTime)
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // 自然结束时主动停止
        rafRef.current = null
        sourceRef.current = null
        setIsPlaying(false)
        setCursorTime(-1)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { play, stop, isPlaying, cursorTime }
}
