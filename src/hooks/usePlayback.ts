import { useState, useRef, useCallback, useEffect } from 'react'
import { getAudioEngine } from '../ts'
import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'

export function usePlayback(getSamples?: () => Float32Array) {
  const [isPlaying, setIsPlaying] = useState(false)
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
    useFrameStore.getState().setCursorTime(-1)
  }, [])

  const play = useCallback(() => {
    const phase = useAnalysisStore.getState().phase

    // Stop recording if active
    if (phase === 'recording') {
      useAnalysisStore.getState().setPhase('ready')
    }

    // Get samples from provider
    const samples = getSamples?.()
    if (!samples || samples.length === 0) return

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    const ae = getAudioEngine()
    const { source, totalDuration } = ae.createPlaybackSource(samples)

    const firstTime = useFrameStore.getState().frames[0]?.time ?? 0
    startTimeRef.current = ae.audioContext.currentTime

    source.onended = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      sourceRef.current = null
      setIsPlaying(false)
      useFrameStore.getState().setCursorTime(-1)
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
      useFrameStore.getState().setCursorTime(elapsed + firstTime)
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [getSamples])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { play, stop, isPlaying }
}
