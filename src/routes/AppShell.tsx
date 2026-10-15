import { useRef, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Toolbar } from '../components/Toolbar'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import { MobilePageTabs } from '../components/mobile/MobilePageTabs'
import { RecordDock } from '../components/mobile/RecordDock'
import { TrainingGoalModal } from '../components/mobile/TrainingGoalModal'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'
import { useAppStore } from '../store/appStore'
import { presetShortLabel } from '../types'
import type { HelpTopic } from '../content/helpContent'

const PORTRAIT_QUERY = '(max-width: 768px)'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
  isCapturing: boolean
  isRequesting: boolean
  onClear?: () => void
  onPlayback?: () => void
  isPlaying?: boolean
  onRecord: () => void
  pianoScrollProgress?: number
  setPianoScrollProgress?: (progress: number) => void
  onOpenHelp?: (topic: HelpTopic) => void
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic>('quick-start')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const pianoScrollProgressRef = useRef(0)

  const navigate = useNavigate()
  const isPractice = useMatch('/practice') != null
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  const activePreset = useAppStore(s => s.activePreset)

  const openOverlay = (overlay: 'config' | 'help' | 'about' | 'goal') => {
    setConfigOpen(overlay === 'config')
    setHelpOpen(overlay === 'help')
    setAboutOpen(overlay === 'about')
    setGoalOpen(overlay === 'goal')
  }
  const openHelp = (topic: HelpTopic = 'quick-start') => {
    setHelpTopic(topic)
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
  } = useToolbar(
    () => openOverlay('config'),
    () => openHelp(),
    () => openOverlay('about'),
  )

  const togglePage = () => navigate(isPractice ? '/' : '/practice')

  const shellContext: ShellContext = {
    onOpenHelp: openHelp,
    cursorTime,
    hasData,
    isCapturing,
    isRequesting,
    onRecord: () => handleClickTool('record'),
    onClear: () => handleClickTool('clear'),
    onPlayback: () => handleClickTool('playback'),
    isPlaying: toolItems.find(item => item.id === 'playback')?.label === '停止',
    pianoScrollProgress: pianoScrollProgressRef.current,
    setPianoScrollProgress: (progress: number) => {
      pianoScrollProgressRef.current = progress
    },
  }

  return (
    <>
      <Toolbar
        toolItems={toolItems}
        onToolClick={handleClickTool}
        nav={isPortrait ? undefined : { label: isPractice ? '返回分析' : '音高参考', onClick: togglePage }}
        pageTabs={isPortrait ? <MobilePageTabs /> : undefined}
        moreMenu={isPortrait
          ? <MobileMoreMenu
              items={toolItems}
              onSelect={handleClickTool}
            />
          : undefined}
      />
      <Outlet context={shellContext} />
      {isPortrait && (
        <>
          <RecordDock
            onRecord={() => handleClickTool('record')}
            isCapturing={isCapturing}
            isRequesting={isRequesting}
            goalLabel={presetShortLabel(activePreset)}
            onGoalClick={() => openOverlay('goal')}
            showGoal={!isPractice}
            onClear={() => handleClickTool('clear')}
            onPlayback={() => handleClickTool('playback')}
            hasData={hasData}
            isPlaying={toolItems.find(item => item.id === 'playback')?.label === '停止'}
          />
          <TrainingGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
        </>
      )}
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} topic={helpTopic} onTopicChange={setHelpTopic} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
