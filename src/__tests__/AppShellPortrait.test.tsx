import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '../routes/AppShell'
import { useAppStore } from '../store/appStore'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: () => null,
  }),
}))

function setMatchMedia(matches: boolean) {
  const mql = {
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div data-testid="page" />} />
          <Route path="practice" element={<div data-testid="practice-page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell toolbar density', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('collapses the toolbar into the overflow menu in portrait', () => {
    setMatchMedia(true)
    renderShell()
    expect(screen.getByLabelText('更多操作')).toBeTruthy()
    expect(screen.queryByText('导入音频')).toBeNull()
    expect(screen.queryByText('音高参考')).toBeNull()
    expect(document.querySelector('header')?.getAttribute('data-compact')).toBe('true')
  })

  it('keeps the full flat toolbar in landscape', () => {
    setMatchMedia(false)
    renderShell()
    expect(screen.queryByLabelText('更多操作')).toBeNull()
    expect(screen.getByText('导入音频')).toBeTruthy()
    expect(screen.getByText('音高参考')).toBeTruthy()
    expect(document.querySelector('header')?.getAttribute('data-compact')).toBe('false')
    expect(document.querySelectorAll('header button[id]').length).toBe(7)
  })

  it('navigates to the practice page from the portrait overflow menu', () => {
    setMatchMedia(true)
    renderShell()
    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '音高参考' }))
    expect(screen.getByTestId('practice-page')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
