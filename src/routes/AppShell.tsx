import { useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useToolbar } from '../hooks/useToolbar'
import { Toolbar } from '../components/Toolbar'
import { ConfigDrawer } from '../components/ConfigDrawer'
import { HelpDrawer } from '../components/HelpDrawer'
import { AboutModal } from '../components/AboutModal'
import { Toast } from '../components/Toast'

export interface ShellContext {
  cursorTime: number
  hasData: boolean
}

export function AppShell() {
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const navigate = useNavigate()
  const isPractice = useMatch('/practice') != null

  const { toolItems, handleClickTool, cursorTime, hasData, fileInputRef, handleFileChange }
    = useToolbar(
      () => setConfigOpen(true),
      () => setHelpOpen(true),
      () => setAboutOpen(true),
    )

  const togglePage = () => navigate(isPractice ? '/' : '/practice')

  return (
    <>
      <Toolbar
        toolItems={toolItems}
        onToolClick={handleClickTool}
        nav={{ label: isPractice ? '⇄ 返回分析' : '⇄ 钢琴训练', onClick: togglePage }}
      />
      <Outlet context={{ cursorTime, hasData } satisfies ShellContext} />
      <Toast />
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
    </>
  )
}
