import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AnalysisPage } from '../routes/AnalysisPage'
import { PracticePage } from '../routes/PracticePage'
import { AppShell } from '../routes/AppShell'
import type { ShellContext } from '../routes/AppShell'
import { useAppStore } from '../store/appStore'

const { setOptionMock, handleClickToolMock, handleFileChangeMock } = vi.hoisted(() => ({
  setOptionMock: vi.fn(),
  handleClickToolMock: vi.fn(),
  handleFileChangeMock: vi.fn(),
}))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

vi.mock('../hooks/useToolbar', () => ({
  useToolbar: () => ({
    toolItems: [
      { id: 'record', variant: 'primary', icon: '●', label: '开始录音' },
      { id: 'import', variant: 'ghost', icon: '📁', label: '导入音频' },
      { id: 'playback', variant: 'ghost', icon: '♫', label: '回放' },
      { id: 'clear', variant: 'ghost', icon: '↺', label: '清空' },
      { id: 'config', variant: 'ghost', icon: '⚙', label: '配置' },
      { id: 'help', variant: 'ghost', icon: '?', label: '帮助' },
      { id: 'about', variant: 'ghost', icon: 'ⓘ', label: '关于' },
    ],
    handleClickTool: handleClickToolMock,
    hasData: true,
    cursorTime: -1,
    fileInputRef: { current: null },
    handleFileChange: handleFileChangeMock,
    isCapturing: false,
    isRequesting: false,
  }),
}))

vi.mock('../audio/PianoSynth', () => ({
  getPianoSynth: vi.fn(() => ({ play: vi.fn(), stopAll: vi.fn() })),
}))

function setMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: (_type: string, _cb: (e: { matches: boolean }) => void) => {},
    removeEventListener: (_type: string, _cb: (e: { matches: boolean }) => void) => {},
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
}

function renderRoute(element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Outlet context={{ cursorTime: -1, hasData: true }} />}>
          <Route index element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function pageLayout(): string | null {
  return document.querySelector('[data-layout]')?.getAttribute('data-layout') ?? null
}

const SHELL_CONTEXT: ShellContext = {
  cursorTime: -1,
  hasData: true,
  isCapturing: false,
  isRequesting: false,
  onRecord: () => {},
}

function renderWithContext(element: ReactElement, context: ShellContext) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route index element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function renderInsideShell(element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('layout shell selection', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('AnalysisPage renders the landscape shell above 768px', () => {
    setMatchMedia(false)
    renderRoute(<AnalysisPage />)
    expect(pageLayout()).toBe('landscape')
  })

  it('AnalysisPage renders the portrait shell at or below 768px', () => {
    setMatchMedia(true)
    renderRoute(<AnalysisPage />)
    expect(pageLayout()).toBe('portrait')
  })

  it('PracticePage renders the landscape shell above 768px', () => {
    setMatchMedia(false)
    renderRoute(<PracticePage />)
    expect(pageLayout()).toBe('landscape')
  })

  it('PracticePage renders the portrait shell at or below 768px', () => {
    setMatchMedia(true)
    renderRoute(<PracticePage />)
    expect(pageLayout()).toBe('portrait')
  })
})

describe('shared portrait dock', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
    handleClickToolMock.mockClear()
    setMatchMedia(true)
  })

  it('mounts the record dock with the active preset label', () => {
    renderInsideShell(<PracticePage />)
    expect(pageLayout()).toBe('portrait')
    expect(document.querySelector('[data-portrait-dock="true"]')).toBeTruthy()
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('a')
  })

  it('drives the dock mic from the shell context record action', () => {
    renderInsideShell(<PracticePage />)
    fireEvent.click(screen.getByLabelText('开始录音'))
    expect(handleClickToolMock).toHaveBeenCalledWith('record')
  })

  it('routes clear and playback through shell callbacks', () => {
    renderInsideShell(<PracticePage />)
    fireEvent.click(screen.getByRole('button', { name: '清除图谱' }))
    fireEvent.click(screen.getByRole('button', { name: '回放' }))
    expect(handleClickToolMock).toHaveBeenNthCalledWith(1, 'clear')
    expect(handleClickToolMock).toHaveBeenNthCalledWith(2, 'playback')
  })
})

describe('portrait analysis structure', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
    setMatchMedia(true)
  })

  it('renders the redesigned portrait sections', () => {
    renderWithContext(<AnalysisPage />, SHELL_CONTEXT)
    const page = document.querySelector('[data-layout="portrait"]')
    expect(page).toBeTruthy()
    expect(page?.querySelector('[data-testid="training-goal-card"]')).toBeNull()
    expect(page?.querySelector('[data-testid="feedback-hero"]')).toBeTruthy()
    expect(page?.querySelector('#f0Chart')).toBeTruthy()
    expect(page?.querySelector('#formantChart')).toBeTruthy()
  })

  it('opens target settings from the dock and closes them', () => {
    renderInsideShell(<AnalysisPage />)
    fireEvent.click(screen.getByTestId('dock-goal'))
    expect(screen.getByLabelText('选择元音预设')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('关闭'))
    expect(screen.queryByLabelText('选择元音预设')).toBeNull()
  })

  it('routes clear and playback through shell callbacks', () => {
    renderInsideShell(<AnalysisPage />)
    fireEvent.click(screen.getByRole('button', { name: '清除图谱' }))
    fireEvent.click(screen.getByRole('button', { name: '回放' }))
    expect(handleClickToolMock).toHaveBeenNthCalledWith(1, 'clear')
    expect(handleClickToolMock).toHaveBeenNthCalledWith(2, 'playback')
  })

  it('mounts the record dock with the active preset label', () => {
    renderInsideShell(<AnalysisPage />)
    expect(document.querySelector('[data-portrait-dock="true"]')).toBeTruthy()
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('a')
  })

  it('exposes the idle record affordance on the dock mic', () => {
    renderInsideShell(<AnalysisPage />)
    expect(screen.getByLabelText('开始录音')).toBeTruthy()
  })

  it('drives the dock mic from the shell context record action', () => {
    renderInsideShell(<AnalysisPage />)
    fireEvent.click(screen.getByLabelText('开始录音'))
    expect(handleClickToolMock).toHaveBeenCalledWith('record')
  })

  it('encloses both charts in one card with tab anchors and design legends', () => {
    renderWithContext(<AnalysisPage />, SHELL_CONTEXT)
    const page = document.querySelector('[data-layout="portrait"]')
    expect(page?.querySelector('[data-testid="f0-legend"]')?.textContent).toContain('当前值')
    expect(page?.querySelector('[data-testid="f0-legend"]')?.textContent).toContain('目标区间')
    expect(page?.querySelector('[data-testid="f0-legend"]')?.textContent).toContain('目标线')
    expect(page?.querySelector('[data-testid="formant-legend"]')?.textContent).toContain('F0')
    expect(page?.querySelector('[data-testid="formant-legend"]')?.textContent).toContain('F1')
    expect(page?.querySelector('[data-testid="formant-legend"]')?.textContent).toContain('F2')
  })

  it('reserves dock space on the portrait main', () => {
    renderWithContext(<AnalysisPage />, SHELL_CONTEXT)
    const main = document.querySelector('[data-layout="portrait"] main')
    expect(main?.className).toContain('portraitMain')
  })

  it('omits the dock in landscape while keeping the flat toolbar', () => {
    setMatchMedia(false)
    renderInsideShell(<AnalysisPage />)
    expect(pageLayout()).toBe('landscape')
    expect(document.querySelector('[data-portrait-dock="true"]')).toBeNull()
    expect(document.querySelectorAll('header button[id]').length).toBe(7)
  })
})
