import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AnalysisPage } from '../routes/AnalysisPage'
import { PracticePage } from '../routes/PracticePage'
import { AppShell } from '../routes/AppShell'
import type { ShellContext } from '../routes/AppShell'
import { useAppStore } from '../store/appStore'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
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
    expect(page?.querySelector('[data-testid="training-goal-card"]')).toBeTruthy()
    expect(page?.querySelector('[data-testid="feedback-hero"]')).toBeTruthy()
    expect(page?.querySelector('#f0Chart')).toBeTruthy()
    expect(page?.querySelector('#formantChart')).toBeTruthy()
  })

  it('mounts the record dock with the active preset label', () => {
    renderWithContext(<AnalysisPage />, SHELL_CONTEXT)
    expect(document.querySelector('[data-portrait-dock="true"]')).toBeTruthy()
    expect(screen.getByTestId('dock-goal-label').textContent).toBe('a')
  })

  it('exposes the idle record affordance on the dock mic', () => {
    renderWithContext(<AnalysisPage />, SHELL_CONTEXT)
    expect(screen.getByLabelText('开始录音')).toBeTruthy()
  })

  it('drives the dock mic from the shell context record action', () => {
    const onRecord = vi.fn()
    renderWithContext(<AnalysisPage />, { ...SHELL_CONTEXT, onRecord })
    fireEvent.click(screen.getByLabelText('开始录音'))
    expect(onRecord).toHaveBeenCalledTimes(1)
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
