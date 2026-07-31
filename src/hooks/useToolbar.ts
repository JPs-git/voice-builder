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

// Actions that need pre-stop; config/help/about don't
const AUDIO_ACTIONS = new Set(['record', 'import', 'playback', 'clear'])

export function useToolbar(
  onConfig: () => void,
  onHelp: () => void,
  onAbout: () => void,
) {
  const frameCount = useAppStore(s => s.frames.length)
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

  const hasData = isCapturing || frameCount > 0

  // ── Constrained callbacks (纯操作) ──

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

  // ── 统一约束入口（仅对音频操作生效） ──

  const handleClickTool = useCallback((toolId: string) => {
    if (!AUDIO_ACTIONS.has(toolId)) {
      // config / help / about — no pre-checks
      if (toolId === 'config') onConfig()
      else if (toolId === 'help') onHelp()
      else if (toolId === 'about') onAbout()
      return
    }

    // 音频操作：统一前置检查
    if (isPlaying) stop()
    if (toolId !== 'record' && isCapturing) analysisRecord()

    switch (toolId) {
      case 'record':   handleRecord(); break
      case 'import':   handleImport(); break
      case 'playback': handlePlayback(); break
      case 'clear':    handleClear(); break
    }
  }, [isPlaying, isCapturing, stop, analysisRecord,
      handleRecord, handleImport, handlePlayback, handleClear,
      onConfig, onHelp, onAbout])

  // ── Resolved tool items ──

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
      disabled: isRequesting || !(hasData || isCapturing),
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

  return { toolItems, handleClickTool, hasData, cursorTime, fileInputRef, handleFileChange }
}
