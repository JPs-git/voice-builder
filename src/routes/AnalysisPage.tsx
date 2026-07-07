import { useRef, useCallback, useEffect, useState } from 'react'
import { useAnalysis } from '../contexts/AnalysisContext'
import { Toolbar } from '../components/Toolbar'
import { TargetPresetBar } from '../components/TargetPresetBar'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
import { StatusBar } from '../components/StatusBar'
import { EmptyState } from '../components/EmptyState'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { TipWidget } from '../components/TipWidget'
import { VOWEL_PRESETS } from '../types'
import type { AnalysisFrame, ChartHandles } from '../types'
import { AudioEngine } from '../../js/audio-engine.js'
import { AnalysisPipeline } from '../../js/analysis-pipeline.js'
import { parseWav } from '../../js/wav-parser.js'
import { Resampler } from '../../js/resampler.js'

export function AnalysisPage() {
  const { state, dispatch } = useAnalysis()
  const f0Ref = useRef<ChartHandles>(null)
  const formantRef = useRef<ChartHandles>(null)
  const audioRef = useRef<InstanceType<typeof AudioEngine> | null>(null)
  const pipelineRef = useRef<InstanceType<typeof AnalysisPipeline> | null>(null)
  const wavInputRef = useRef<HTMLInputElement>(null)
  const sessionFramesRef = useRef<AnalysisFrame[]>([])
  const WINDOW_FRAMES = 1000

  useEffect(() => {
    audioRef.current = new AudioEngine()
  }, [])

  const onFrame = useCallback((frame: AnalysisFrame) => {
    sessionFramesRef.current.push(frame)
    if (sessionFramesRef.current.length > WINDOW_FRAMES) {
      sessionFramesRef.current.shift()
    }
    dispatch({ type: 'SET_LATEST_FRAME', frame })
    f0Ref.current?.pushFrame(frame)
    formantRef.current?.pushFrame(frame)
  }, [dispatch])

  const startNewRecording = useCallback(async () => {
    if (!audioRef.current) return
    pipelineRef.current?.reset()
    audioRef.current.clearRecordedBuffer()
    f0Ref.current?.setLiveMode()
    formantRef.current?.setLiveMode()
    pipelineRef.current = new (AnalysisPipeline as any)({
      onFrame,
      formantMethod: state.config.formantMethod,
      formantSmoothing: state.config.formantSmoothing,
      frameOffset: state.frameCount,
    })
    audioRef.current.startStream(
      (chunk: Float32Array, rate: number) => pipelineRef.current?.pushChunk(chunk, rate),
      10
    )
    dispatch({ type: 'SET_PHASE', phase: 'recording' })
  }, [onFrame, state.config, state.frameCount, dispatch])

  const onRecord = useCallback(async () => {
    if (!audioRef.current) return

    if (state.phase === 'recording') {
      audioRef.current.stopStream()
      if (pipelineRef.current) {
        pipelineRef.current.flush()
        const totalFrames = state.frameCount + pipelineRef.current.frameCount
        dispatch({ type: 'SET_FRAME_COUNT', count: totalFrames })
        pipelineRef.current.reset()
        pipelineRef.current = null
      }
      if (sessionFramesRef.current.length > WINDOW_FRAMES) {
        sessionFramesRef.current.splice(0, sessionFramesRef.current.length - WINDOW_FRAMES)
        audioRef.current.trimBufferToDuration(10)
      }
      dispatch({ type: 'SET_PHASE', phase: 'paused' })
      return
    }

    if (state.phase === 'paused') {
      pipelineRef.current?.reset()
      pipelineRef.current = null
      await startNewRecording()
      return
    }

    try {
      dispatch({ type: 'SET_PHASE', phase: 'requesting' })
      await startNewRecording()
    } catch (err) {
      console.error('Stream start failed:', err)
      dispatch({ type: 'SET_PHASE', phase: 'idle' })
    }
  }, [state.phase, state.frameCount, startNewRecording, dispatch])

  const clearAll = useCallback(() => {
    const ae = audioRef.current
    if (!ae) return
    pipelineRef.current?.reset()
    pipelineRef.current = null
    ae.stopPlayback?.()
    ae.stopStream()
    ae.clearRecordedBuffer()
    f0Ref.current?.clear()
    formantRef.current?.clear()
    sessionFramesRef.current = []
    dispatch({ type: 'RESET' })
  }, [dispatch])

  const onImport = useCallback(() => {
    if (state.phase === 'recording' || state.phase === 'paused') clearAll()
    wavInputRef.current?.click()
  }, [state.phase, clearAll])

  const onWavSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ae = audioRef.current
    if (!ae) return
    clearAll()
    try {
      const buf = await file.arrayBuffer()
      const parsed: any = parseWav(buf)
      let samples = parsed.samples as Float32Array
      let rate = parsed.sampleRate as number
      if (rate !== 16000) {
        const r = new Resampler(rate, 16000)
        samples = r.process(samples)
        rate = 16000
      }
      ae.setImportedBuffer(samples)
      ;(ae as any)._recordingSampleRate = rate
      const frames: AnalysisFrame[] = AnalysisPipeline.analyze(
        samples as any, rate, state.config.formantMethod, state.config.formantSmoothing
      )
      sessionFramesRef.current = frames
      dispatch({ type: 'SET_FRAME_COUNT', count: frames.length })
      f0Ref.current?.displayAll(frames)
      formantRef.current?.displayAll(frames)
      if (frames.length > 0) dispatch({ type: 'SET_PHASE', phase: 'paused' })
    } catch (err) {
      console.error('WAV analysis failed:', err)
      dispatch({ type: 'SET_PHASE', phase: 'idle' })
    }
    e.target.value = ''
  }, [state.config, clearAll, dispatch])

  const onPresetSelect = useCallback((name: string) => {
    const preset = VOWEL_PRESETS[name]
    if (!preset) return
    dispatch({ type: 'SET_ACTIVE_PRESET', name })
    formantRef.current?.setTargetBands({ f0: preset.f0, f1: preset.f1, f2: preset.f2 })
  }, [dispatch])

  const onBandsChange = useCallback(
    (bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) => {
      dispatch({ type: 'SET_BANDS', bands })
      formantRef.current?.setTargetBands(bands)
    },
    [dispatch]
  )

  const [hasData, setHasData] = useState(false)
  useEffect(() => {
    if (sessionFramesRef.current.length > 0) setHasData(true)
    else setHasData(false)
  }, [state.phase])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar
        phase={state.phase}
        onRecord={onRecord}
        onImport={onImport}
        onClear={clearAll}
        onConfig={() => dispatch({ type: 'SET_CONFIG_DRAWER', open: true })}
        onHelp={() => dispatch({ type: 'SET_HELP_DRAWER', open: true })}
      />

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 16, gap: 24 }}>
        <TargetPresetBar
          activePreset={state.activePreset}
          bands={state.bands}
          onPresetSelect={onPresetSelect}
          onBandsChange={onBandsChange}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section style={{ background: '#FFF', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>基频</h2>
            </div>
            <div style={{ position: 'relative' }}>
              <F0Chart ref={f0Ref} batchMode={false} />
              <EmptyState
                title="还没有声音数据"
                description="录音或导入音频后显示 F0 曲线"
                visible={!hasData}
              />
            </div>
          </section>

          <section style={{
            flex: 1, background: '#FFF', borderRadius: 8, border: '1px solid #E5E7EB',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>共振峰</h2>
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
              <FormantChart ref={formantRef} batchMode={false} />
              <EmptyState
                title="曲线待生成"
                description="录音或导入音频后显示共振峰曲线"
                visible={!hasData}
              />
            </div>
          </section>
        </div>
      </main>

      <StatusBar latestFrame={state.latestFrame} frameCount={state.frameCount} />
      <TipWidget />

      <ConfigDrawer
        open={state.configDrawerOpen}
        config={state.config}
        onChange={cfg => dispatch({ type: 'SET_CONFIG', config: cfg })}
        onClose={() => dispatch({ type: 'SET_CONFIG_DRAWER', open: false })}
      />

      <HelpDrawer
        open={state.helpDrawerOpen}
        onClose={() => dispatch({ type: 'SET_HELP_DRAWER', open: false })}
      />

      <input ref={wavInputRef} type="file" accept=".wav" hidden onChange={onWavSelected} />
    </div>
  )
}
