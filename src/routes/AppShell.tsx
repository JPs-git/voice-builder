import { useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Toolbar } from '../components/Toolbar'
import { MobileMoreMenu } from '../components/mobile/MobileMoreMenu'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'

const PORTRAIT_QUERY = '(max-width: 768px)'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
  isCapturing: boolean
  isRequesting: boolean
  onRecord: () => void
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const navigate = useNavigate()
  const isPractice = useMatch('/practice') != null
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)

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
  }

  return (
    <>
      <Toolbar
        toolItems={toolItems}
        onToolClick={handleClickTool}
        nav={isPortrait ? undefined : { label: isPractice ? '返回分析' : '音高参考', onClick: togglePage }}
        moreMenu={isPortrait
          ? <MobileMoreMenu
              items={toolItems}
              onSelect={handleClickTool}
              nav={{ label: isPractice ? '返回分析' : '音高参考', onClick: togglePage }}
            />
          : undefined}
      />
      <Outlet context={shellContext} />
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
