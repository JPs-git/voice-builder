import { useMemo, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { useAnalysis } from './useAnalysis'
import { usePlayback } from './usePlayback'

export interface ToolItem {
  id: string
  variant: 'primary' | 'ghost'
  icon: string
  label: string
  recording?: boolean
  disabled?: boolean
}

export function useToolbar(
  onConfig: () => void,
  onHelp: () => void,
  onAbout: () => void,
) {
  const frames = useAppStore(s => s.frames)
  const {
    onRecord: analysisRecord,
    onImport: analysisImport,
    onClear: analysisClear,
    isCapturing,
    isRequesting,
    dataSource,
    fileInputRef,
    handleFileChange,
  } = useAnalysis()
  const { play, stop, isPlaying, cursorTime } = usePlayback()

  const hasData = isCapturing || frames.length > 0

  // ── Constrained callbacks (纯操作，不含前置检查) ──

  const handleRecord = useCallback(() => {
    analysisRecord()
  }, [analysisRecord])

  const handleImport = useCallback(() => {
    analysisImport()
  }, [analysisImport])

  const handlePlayback = useCallback(() => {
    isPlaying ? stop() : play()
  }, [isPlaying, play, stop])

  const handleClear = useCallback(() => {
    analysisClear()
  }, [analysisClear])

  // ── 统一约束入口 ──

  const handleClickTool = useCallback((toolId: string) => {
    // 1. 回放中 → 任何操作前先停回放
    if (isPlaying) stop()

    // 2. 录音中 → 非录音操作前先停录音
    if (toolId !== 'record' && isCapturing) {
      analysisRecord()
    }

    switch (toolId) {
      case 'record':   handleRecord(); break
      case 'import':   handleImport(); break
      case 'playback': handlePlayback(); break
      case 'clear':    handleClear(); break
      case 'config':   onConfig(); break
      case 'help':     onHelp(); break
      case 'about':    onAbout(); break
    }
  }, [isPlaying, isCapturing, stop, analysisRecord,
      handleRecord, handleImport, handlePlayback, handleClear,
      onConfig, onHelp, onAbout])

  // ── Resolved tool items with dynamic props ──

  const recorderLabel = isRequesting
    ? '麦克风授权中…'
    : isCapturing
      ? '停止录音'
      : hasData && dataSource === 'mic'
        ? '继续录音'
        : '开始录音'

  const toolItems: ToolItem[] = useMemo(() => [
    {
      id: 'record',
      variant: 'primary',
      icon: isCapturing ? '■' : '●',
      label: recorderLabel,
      recording: isCapturing,
      disabled: isRequesting,
    },
    {
      id: 'import',
      variant: 'ghost',
      icon: '📁',
      label: '导入 WAV',
    },
    {
      id: 'playback',
      variant: 'ghost',
      icon: isPlaying ? '■' : '♫',
      label: isPlaying ? '停止' : '回放',
      disabled: !(hasData || isCapturing),
    },
    {
      id: 'clear',
      variant: 'ghost',
      icon: '↺',
      label: '清空',
      disabled: !(hasData || isCapturing),
    },
    {
      id: 'config',
      variant: 'ghost',
      icon: '⚙',
      label: '配置',
    },
    {
      id: 'help',
      variant: 'ghost',
      icon: '?',
      label: '帮助',
    },
    {
      id: 'about',
      variant: 'ghost',
      icon: 'ⓘ',
      label: '关于',
    },
  ], [isCapturing, isRequesting, isPlaying, hasData, dataSource, recorderLabel])

  return { toolItems, handleClickTool, isCapturing, hasData, cursorTime, fileInputRef, handleFileChange }
}
