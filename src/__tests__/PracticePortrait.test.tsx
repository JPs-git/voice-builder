import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { PracticePortrait } from '../routes/PracticePortrait'

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

function renderPracticePortrait() {
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <Routes>
        <Route element={<Outlet context={{ cursorTime: -1, hasData: true, pianoScrollProgress: 0 }} />}>
          <Route path="practice" element={<PracticePortrait />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PracticePortrait', () => {
  it('reserves vertical space for black-key labels inside the horizontal scroll viewport', () => {
    renderPracticePortrait()

    const viewport = screen.getByRole('region', { name: '左右滑动调整钢琴音域' })
    const pianoArea = viewport.firstElementChild as HTMLElement

    expect(pianoArea.style.paddingTop).toBe('20px')
  })
})
