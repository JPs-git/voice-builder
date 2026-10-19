import { useEffect, useRef, useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Toolbar } from '../components/Toolbar'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import { MobilePageTabs } from '../components/mobile/MobilePageTabs'
import { RecordDock } from '../components/mobile/RecordDock'
import { RecordingReferenceMenu } from '../recording/RecordingReferenceMenu'
import { TrainingGoalModal } from '../components/mobile/TrainingGoalModal'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'
import { useAppStore } from '../store/appStore'
import { presetShortLabel } from '../types'
import type { HelpTopic } from '../content/helpContent'
import { useFirstUseHelp } from '../hooks/useFirstUseHelp'
import { FirstUseHelpBanner } from '../components/FirstUseHelpBanner'
import { isAvailableFocusTarget } from '../components/focusTarget'
import { getAnalyticsPage, track } from '../analytics/analytics'
import { RecordingSessionProvider, useRecordingSession } from '../recording/RecordingSessionProvider'
import { useRecordingToolbar } from '../recording/useRecordingToolbar'

const PORTRAIT_QUERY = '(max-width: 768px)'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
  isCapturing: boolean
  isRequesting: boolean
  onClear?: () => void
  onPlayback?: () => void
  isPlaying?: boolean
  dockHeight?: number
  onRecord: () => void
  pianoScrollProgress?: number
  setPianoScrollProgress?: (progress: number) => void
  onOpenHelp?: (topic: HelpTopic) => void
}

export function AppShell() {
  return <RecordingSessionProvider><AppShellContent /></RecordingSessionProvider>
}

function AppShellContent() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic>('quick-start')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const pianoScrollProgressRef = useRef(0)
  const recordButtonRef = useRef<HTMLButtonElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const [dockHeight, setDockHeight] = useState(0)
  const { eligible, dismiss } = useFirstUseHelp()

  const isPractice = useMatch('/practice') != null
  const isRecording = useMatch('/recording') != null
  const { controller: recordingController, snapshot: recordingSnapshot } = useRecordingSession()
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  const activePreset = useAppStore(s => s.activePreset)
  useEffect(() => {
    if (!isPortrait) setGoalOpen(false)
  }, [isPortrait])
  const getHelpFallbackFocus = () =>
    [helpButtonRef.current, moreButtonRef.current, recordButtonRef.current].find(isAvailableFocusTarget) ?? null

  const openOverlay = (overlay: 'config' | 'help' | 'about' | 'goal') => {
    setConfigOpen(overlay === 'config')
    setHelpOpen(overlay === 'help')
    setAboutOpen(overlay === 'about')
    setGoalOpen(overlay === 'goal')
  }
  const openHelp = (topic?: HelpTopic) => {
    const page = getAnalyticsPage()
    if (!helpOpen && page) track('help_open', { page, topic: topic ?? (isRecording ? 'recording-statistics' : 'quick-start') })
    setHelpTopic(topic ?? (isRecording ? 'recording-statistics' : 'quick-start'))
    openOverlay('help')
  }

  const {
    toolItems,
    handleClickTool,
    cursorTime,
    hasData,
    isCapturing,
    isRequesting,
    fileInputRef,
    handleFileChange,
    suspend: suspendRealtime,
  } = useToolbar(
    () => openOverlay('config'),
    () => openHelp(),
    () => openOverlay('about'),
  )

  const recordingTools = useRecordingToolbar(() => openHelp(), () => openOverlay('about'))
  const previousRecording = useRef(isRecording)
  useEffect(() => {
    if (isRecording && !previousRecording.current) {
      suspendRealtime?.()
      setConfigOpen(false)
      setGoalOpen(false)
    } else if (!isRecording && previousRecording.current) {
      recordingController.leave()
    }
    previousRecording.current = isRecording
  }, [isRecording, suspendRealtime, recordingController])
  const isPlaying = toolItems.some(item => item.id === 'playback' && item.label === '停止')

  const shellContext: ShellContext = {
    onOpenHelp: openHelp,
    cursorTime,
    hasData,
    isCapturing,
    isRequesting,
    onRecord: () => handleClickTool('record'),
    onClear: () => handleClickTool('clear'),
    onPlayback: () => handleClickTool('playback'),
    isPlaying,
    dockHeight: isPortrait ? dockHeight : 0,
    pianoScrollProgress: pianoScrollProgressRef.current,
    setPianoScrollProgress: (progress: number) => {
      pianoScrollProgressRef.current = progress
    },
  }

  return (
    <>
      <Toolbar
        compactActions={!isPortrait}
        moreButtonRef={moreButtonRef}
        recordingPage={isRecording}
        recordButtonRef={recordButtonRef}
        helpButtonRef={helpButtonRef}
        toolItems={isRecording ? recordingTools.toolItems : toolItems}
        onToolClick={isRecording ? recordingTools.handleClickTool : handleClickTool}
        pageTabs={<MobilePageTabs variant={isPortrait ? 'mobile' : 'desktop'} />}
        moreMenu={isPortrait
          ? <MobileMoreMenu
              triggerButtonRef={moreButtonRef}
              items={isRecording ? recordingTools.toolItems.filter(item => !['cancel','return','prepare'].includes(item.id)) : toolItems}
              onSelect={isRecording ? recordingTools.handleClickTool : handleClickTool}
            />
          : undefined}
      />
      <Outlet context={shellContext} />
      {isPortrait && (
        <>
          {isRecording ? <RecordDock
            leadingControl={recordingSnapshot.phase==='prepared'?<RecordingReferenceMenu/>:
              recordingSnapshot.phase==='error'&&recordingController.canRetry()?<button type="button" onClick={()=>recordingController.prepare()}>再录一段</button>:undefined}
            trailingControl={recordingSnapshot.report&&['prepared','error'].includes(recordingSnapshot.phase)?
              <button type="button" onClick={()=>recordingController.returnToReport()}>返回结果</button>:undefined}
            recordAsText={recordingSnapshot.view==='report'||['error','importing','analyzing'].includes(recordingSnapshot.phase)}
            key="statistics"
            variant="statistics"
            recordButtonRef={recordButtonRef}
            onHeightChange={setDockHeight}
            onRecord={() => recordingTools.handleClickTool('record')}
            recordLabel={recordingTools.toolItems.find(item => item.id==='record')?.label}
            recordDisabled={recordingTools.toolItems.find(item => item.id==='record')?.disabled}
            isCapturing={recordingSnapshot.phase==='recording'}
            isRequesting={recordingSnapshot.phase==='requesting'}
            elapsedSeconds={recordingSnapshot.elapsed}
            showGoal={false}
            onCancel={recordingTools.toolItems.some(item => item.id==='cancel') ? () => recordingTools.handleClickTool('cancel') : undefined}
            cancelLabel={recordingTools.toolItems.find(item => item.id==='cancel')?.label}
          /> :
          <RecordDock
            key="realtime"
            recordButtonRef={recordButtonRef}
            onHeightChange={setDockHeight}
            onRecord={() => handleClickTool('record')}
            isCapturing={isCapturing}
            isRequesting={isRequesting}
            goalLabel={presetShortLabel(activePreset)}
            onGoalClick={() => openOverlay('goal')}
            showGoal={!isPractice}
            onClear={() => handleClickTool('clear')}
            onPlayback={() => handleClickTool('playback')}
            hasData={hasData}
            isPlaying={isPlaying}
          />}
          {!isRecording && <TrainingGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />}
        </>
      )}
      <FirstUseHelpBanner
        layout={isPortrait ? 'portrait' : 'landscape'}
        visible={eligible && !isRecording}
        suppressed={hasData || isCapturing || isRequesting || isPlaying || helpOpen || configOpen || aboutOpen || goalOpen}
        dockHeight={dockHeight}
        onOpen={() => openHelp('quick-start')}
        onDismiss={() => { [recordButtonRef.current, getHelpFallbackFocus()].find(isAvailableFocusTarget)?.focus({ preventScroll: true }); dismiss() }}
      />
      <Toast />
      <ConfigDrawer open={configOpen && !isRecording} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} topic={helpTopic} onTopicChange={setHelpTopic} getFallbackFocus={getHelpFallbackFocus} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={isRecording ? recordingTools.fileInputRef : fileInputRef} type="file" accept="audio/*" hidden onChange={isRecording ? recordingTools.handleFileChange : handleFileChange} />
    </>
  )
}
