import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisPage } from '../routes/AnalysisPage'
import { useAppStore } from '../store/appStore'

const { setOptionMock, getInstanceMock } = vi.hoisted(() => ({
  setOptionMock: vi.fn(),
  getInstanceMock: vi.fn(() => null),
}))

vi.mock('../hooks/useECharts', () => ({
  useECharts: () => ({
    chartRef: { current: document.createElement('div') },
    setOption: setOptionMock,
    getInstance: getInstanceMock,
  }),
}))

vi.mock('../hooks/useToolbar', () => ({
  useToolbar: () => ({
    toolItems: [],
    handleClickTool: vi.fn(),
    hasData: true,
    cursorTime: -1,
    fileInputRef: { current: null },
    handleFileChange: vi.fn(),
  }),
}))

function lastFormantOption() {
  const calls = setOptionMock.mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    const option = calls[i][0]
    if (option.series?.some((s: { name: string }) => s.name === 'F1')) return option
  }
  return null
}

function f1Series() {
  return lastFormantOption().series.find((s: { name: string }) => s.name === 'F1')
}

const FRAMES = [
  { time: 0.1, f0: 220, f1: 900, f2: 1200 },
  { time: 0.2, f0: 225, f1: 920, f2: 1250 },
]

describe('AnalysisPage legend', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('toggles F1 series hidden on legend click', () => {
    useAppStore.getState().setFrames(FRAMES)
    render(<AnalysisPage />)

    const f1Btn = screen.getByRole('button', { name: 'F1' })
    expect(f1Btn.getAttribute('data-active')).toBe('true')
    expect(f1Series().data).toHaveLength(2)

    fireEvent.click(f1Btn)

    expect(f1Btn.getAttribute('data-active')).toBe('false')
    expect(f1Series().data).toEqual([])
  })
})
