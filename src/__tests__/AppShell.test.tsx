import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { AppShell, type ShellContext } from '../routes/AppShell'

const { setOptionMock, audioAction, audioState } = vi.hoisted(() => ({ setOptionMock: vi.fn(), audioAction: vi.fn(), audioState: { capturing: false, playing: false } }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

vi.mock('../hooks/useToolbar', () => ({
  useToolbar: (onConfig: () => void, onHelp: () => void, onAbout: () => void) => ({
    toolItems: [
      { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
      { id: 'help', variant: 'ghost', icon: '?', label: '帮助' },
      { id: 'config', variant: 'ghost', icon: '⚙', label: '设置' },
      { id: 'playback', variant: 'ghost', icon: '▶', label: audioState.playing ? '停止' : '回放' },
    ],
    handleClickTool: (id: string) => id === 'help' ? onHelp() : id === 'config' ? onConfig() : id === 'about' ? onAbout() : audioAction(id),
    hasData: true,
    cursorTime: 3,
    isCapturing: audioState.capturing,
    isRequesting: false,
    fileInputRef: { current: null },
    handleFileChange: vi.fn(),
  }),
}))

function ProbePage() {
  const ctx = useOutletContext<ShellContext>()
  return <div>practice-content {ctx.cursorTime}<button onClick={() => ctx.onOpenHelp?.('targets')}>目标说明</button></div>
}

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>analysis-content</div>} />
          <Route path="practice" element={<ProbePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    audioAction.mockClear()
    audioState.capturing = false
    audioState.playing = false
  })

  it('shows analysis page with "go to practice" nav by default', () => {
    renderApp('/')
    expect(screen.getByText('analysis-content')).toBeDefined()
    expect(screen.getByRole('link', { name: '音高参考' })).toBeDefined()
    expect(screen.getByRole('link', { name: '录音统计' })).toBeDefined()
  })

  it('navigates to practice and flips the nav label', () => {
    renderApp('/')
    fireEvent.click(screen.getByRole('link', { name: '音高参考' }))
    expect(screen.getByText(/practice-content/)).toBeDefined()
    expect(screen.getByRole('link', { name: '音高参考' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '实时分析' })).toBeDefined()
  })

  it('passes cursorTime through outlet context', () => {
    renderApp('/practice')
    expect(screen.getByText('practice-content 3')).toBeDefined()
  })

  it.each(['idle', 'recording', 'playing'])('opens quick-start without audio actions while %s', mode => {
    audioState.capturing = mode === 'recording'
    audioState.playing = mode === 'playing'
    renderApp('/')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /帮助/ }))
    expect(screen.getByRole('button', { name: '快速上手' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(audioAction).not.toHaveBeenCalled()
  })

  it('opens a requested topic through route context', () => {
    renderApp('/practice')
    fireEvent.click(screen.getByRole('button', { name: '目标说明' }))
    expect(screen.getByRole('button', { name: '训练目标' }).getAttribute('aria-pressed')).toBe('true')
    expect(audioAction).not.toHaveBeenCalled()
  })
})
