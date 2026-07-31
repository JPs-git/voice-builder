import { useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { useAnalysis } from './useAnalysis'
import { usePlayback } from './usePlayback'

export function useToolbar() {
  const frames = useAppStore(s => s.frames)
  const {
    onRecord: analysisRecord,
    onImport: analysisImport,
    onClear: analysisClear,
    isCapturing,
    isRequesting,
    fileInputRef,
    handleFileChange,
  } = useAnalysis()
  const { play, stop, isPlaying } = usePlayback()

  const hasData = isCapturing || frames.length > 0

  // ── Record ──
  const onRecord = useCallback(() => {
    analysisRecord()
  }, [analysisRecord])

  // ── Import ──
  const onImport = useCallback(() => {
    analysisImport()
  }, [analysisImport])

  // ── Playback (stop recording first) ──
  const onPlayback = useCallback(() => {
    if (isPlaying) {
      stop()
    } else {
      // Stop recording before playback
      if (isCapturing) analysisRecord()
      play()
    }
  }, [isPlaying, isCapturing, analysisRecord, play, stop])

  // ── Clear (stop playback and recording first) ──
  const onClear = useCallback(() => {
    if (isPlaying) stop()
    if (isCapturing) analysisRecord()
    analysisClear()
  }, [isPlaying, isCapturing, analysisRecord, analysisClear, stop])

  return {
    isCapturing,
    isRequesting,
    isPlaying,
    hasData,
    onRecord,
    onImport,
    onPlayback,
    onClear,
    fileInputRef,
    handleFileChange,
  }
}
