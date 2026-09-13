import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { PracticePage } from '../routes/PracticePage'
import { getPianoSynth } from '../audio/PianoSynth'

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

function framelessFrames(f0: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1: 0, f2: 0 }])
}

function renderPracticePage() {
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route element={<Outlet context={{ cursorTime: -1, hasData: true }} />}>
          <Route path="practice" element={<PracticePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PracticePage', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
    vi.mocked(getPianoSynth).mockImplementation(() => ({ play: vi.fn(), stopAll: vi.fn() } as any))
  })

  it('renders the piano and pitch chart cards', () => {
    renderPracticePage()
    expect(screen.getByRole('group', { name: /钢琴/ })).toBeDefined()
    expect(screen.getByText('音高谱（科学记谱法）')).toBeDefined()
  })

  it('highlights the detected note when within C2-B5', () => {
    framelessFrames(261.63) // C4
    renderPracticePage()
    const c4 = screen.getByRole('button', { name: 'C4' })
    expect(c4.getAttribute('data-active')).toBe('true')
  })

  it('does not highlight when pitch is outside C2-B5', () => {
    framelessFrames(1300) // E6 > B5
    renderPracticePage()
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('does not highlight when pitch is null', () => {
    framelessFrames(null)
    renderPracticePage()
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('data-active')).not.toBe('true')
    }
  })

  it('plays the reference tone on key press', () => {
    const play = vi.fn()
    vi.mocked(getPianoSynth).mockReturnValue({ play, stopAll: vi.fn() } as any)
    renderPracticePage()
    fireEvent.click(screen.getByRole('button', { name: 'C4' }))
    expect(play).toHaveBeenCalledWith(60)
  })

  it('calls PianoSynth stopAll on unmount', () => {
    const stopAll = vi.fn()
    vi.mocked(getPianoSynth).mockReturnValue({ play: vi.fn(), stopAll } as any)
    const { unmount } = renderPracticePage()
    unmount()
    expect(stopAll).toHaveBeenCalled()
  })
})