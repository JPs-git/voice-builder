import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '../routes/AppShell'
import { AnalysisPage } from '../routes/AnalysisPage'
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

function renderShell(page = <div data-testid="page" />) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={page} />
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
    expect(screen.getByRole('navigation', { name: '页面切换' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '音高参考' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '实时分析' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '录音统计' })).toBeTruthy()
    expect(document.querySelector('header')?.getAttribute('data-compact')).toBe('true')
  })

  it('keeps frequent toolbar actions and More in landscape', () => {
    setMatchMedia(false)
    renderShell()
    expect(screen.getByLabelText('更多操作')).toBeTruthy()
    expect(screen.getByText('导入音频')).toBeTruthy()
    expect(screen.getByText('音高参考')).toBeTruthy()
    expect(document.querySelector('header')?.getAttribute('data-compact')).toBe('false')
    expect(document.querySelectorAll('header button[id]').length).toBe(4)
  })

  it('navigates to the practice page from the portrait tabs', () => {
    setMatchMedia(true)
    renderShell()
    fireEvent.click(screen.getByRole('link', { name: '音高参考' }))
    expect(screen.getByTestId('practice-page')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens quick-start from More without requesting microphone permission', () => {
    setMatchMedia(true)
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    renderShell()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /帮助/ }))
    expect(screen.getByRole('button', { name: '快速上手' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/点击底部麦克风按钮/)).toBeTruthy()
    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '更多操作' }))
  })

  it('clears the real portrait feedback through the dock action', () => {
    setMatchMedia(true)
    useAppStore.getState().setFrames([
      { time: 1, f0: 300, f1: 700, f2: 1200, register: 'mixed' },
    ])
    renderShell(<AnalysisPage />)
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
    expect(screen.getByTestId('hero-col-f0').textContent).toContain('↑')
    fireEvent.click(screen.getByRole('button', { name: '清除图谱' }))
    expect(screen.queryByRole('group', { name: /^声区：/ })).toBeNull()
    expect(screen.getByTestId('hero-f0').textContent).toBe('--')
    expect(screen.getByTestId('hero-col-f0').textContent).not.toMatch(/[↑↓]/)
    expect(useAppStore.getState().frames).toEqual([])
  })
})
