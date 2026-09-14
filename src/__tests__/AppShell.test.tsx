import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { AppShell } from '../routes/AppShell'

const { setOptionMock } = vi.hoisted(() => ({ setOptionMock: vi.fn() }))

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
    ],
    handleClickTool: vi.fn(),
    hasData: true,
    cursorTime: 3,
    fileInputRef: { current: null },
    handleFileChange: vi.fn(),
  }),
}))

function ProbePage() {
  const ctx = useOutletContext<{ cursorTime: number; hasData: boolean }>()
  return <div>practice-content {ctx.cursorTime}</div>
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
  })

  it('shows analysis page with "go to practice" nav by default', () => {
    renderApp('/')
    expect(screen.getByText('analysis-content')).toBeDefined()
    expect(screen.getByRole('button', { name: /音高参考/ })).toBeDefined()
  })

  it('navigates to practice and flips the nav label', () => {
    renderApp('/')
    fireEvent.click(screen.getByRole('button', { name: /音高参考/ }))
    expect(screen.getByText(/practice-content/)).toBeDefined()
    expect(screen.getByRole('button', { name: /返回分析/ })).toBeDefined()
  })

  it('passes cursorTime through outlet context', () => {
    renderApp('/practice')
    expect(screen.getByText('practice-content 3')).toBeDefined()
  })
})
