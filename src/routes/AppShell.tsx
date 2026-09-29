import { useRef, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Toolbar } from '../components/Toolbar'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import { MobilePageTabs } from '../components/mobile/MobilePageTabs'
import { RecordDock } from '../components/mobile/RecordDock'
import { TrainingGoalCard } from '../components/mobile/TrainingGoalCard'
import { Drawer } from '../components/Drawer'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'
import { useAppStore } from '../store/appStore'
import { presetShortLabel } from '../types'

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
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const pianoScrollProgressRef = useRef(0)

  const navigate = useNavigate()
  const isPractice = useMatch('/practice') != null
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  const activePreset = useAppStore(s => s.activePreset)

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
    () => setConfigOpen(true),
    () => setHelpOpen(true),
    () => setAboutOpen(true),
  )

  const togglePage = () => navigate(isPractice ? '/' : '/practice')

  const shellContext: ShellContext = {
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
            onGoalClick={() => setGoalOpen(true)}
            showGoal={!isPractice}
            onClear={() => handleClickTool('clear')}
            onPlayback={() => handleClickTool('playback')}
            hasData={hasData}
            isPlaying={toolItems.find(item => item.id === 'playback')?.label === '停止'}
          />
          <Drawer open={goalOpen} title="训练目标" onClose={() => setGoalOpen(false)}>
            <div data-testid="training-goal-card"><TrainingGoalCard /></div>
          </Drawer>
        </>
      )}
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
