import { useState, useRef, useCallback, useEffect } from 'react'
import { getAudioEngine } from '../ts'

export function usePlayback() {
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
  }, [])

  const play = useCallback((onProgress?: (elapsed: number) => void, onEnd?: () => void) => {
    const ae = getAudioEngine()
    const audioCtx = ae.audioContext
    const samples = ae.getBuffer()
    if (samples.length === 0) return

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    audioCtx.resume()
    const buffer = audioCtx.createBuffer(1, samples.length, ae.sampleRate)
    buffer.getChannelData(0).set(samples)

    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(audioCtx.destination)

    const totalDuration = samples.length / ae.sampleRate
    startTimeRef.current = audioCtx.currentTime

    source.onended = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      sourceRef.current = null
      setIsPlaying(false)
      if (onEnd) onEnd()
    }

    source.start()
    sourceRef.current = source
    setIsPlaying(true)

    const tick = () => {
      if (!sourceRef.current) return
      const elapsed = Math.min(audioCtx.currentTime - startTimeRef.current, totalDuration)
      if (onProgress) onProgress(elapsed)
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { play, stop, isPlaying }
}
