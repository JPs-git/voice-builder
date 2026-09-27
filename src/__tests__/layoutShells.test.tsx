import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AnalysisPage } from '../routes/AnalysisPage'
import { PracticePage } from '../routes/PracticePage'
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