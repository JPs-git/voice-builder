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

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
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
    // Stop recording if active — read isCapturing via a different mechanism
    // Actually, usePlayback doesn't need to know about recording state.
    // The caller (onPlayback in Toolbar) should handle that if needed.

    const samples = recordingBuffer.read()
    if (samples.length === 0) return

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    const ae = getAudioEngine()
    const { source, totalDuration } = ae.createPlaybackSource(samples)

    const firstTime = useAppStore.getState().frames[0]?.time ?? 0
    startTimeRef.current = ae.audioContext.currentTime

    source.onended = () => {
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
      if (!sourceRef.current) return
      const elapsed = Math.min(
        ae.audioContext.currentTime - startTimeRef.current,
        totalDuration,
      )
      setCursorTime(elapsed + firstTime)
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { play, stop, isPlaying, cursorTime }
}
