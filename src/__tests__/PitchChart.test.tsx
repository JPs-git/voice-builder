import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PitchChart } from '../components/PitchChart'
import { useAppStore } from '../store/appStore'
import { freqToMidi, midiToFreq } from '../utils/pitch'

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

function lastOption() {
  const calls = setOptionMock.mock.calls
  return calls[calls.length - 1][0]
}

function pitchSeries() {
  return lastOption().series.find((s: { name: string }) => s.name === 'PITCH')
}

describe('PitchChart', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('maps Y axis to G2-E5 midi range', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    expect(lastOption().yAxis.min).toBe(43)
    expect(lastOption().yAxis.max).toBe(76)
  })

  it('labels only natural notes (no sharps)', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const yAxis = lastOption().yAxis
    expect(yAxis.axisLabel.formatter(60)).toBe('C4')
    expect(yAxis.axisLabel.formatter(61)).toBe('')
    expect(yAxis.axisLabel.formatter(43)).toBe('G2')
    expect(yAxis.axisLabel.formatter(44)).toBe('')
    expect(yAxis.axisLabel.formatter(48)).toBe('C3')
    expect(yAxis.axisLabel.formatter(76)).toBe('E5')
    expect(yAxis.minInterval).toBe(1)
    expect(yAxis.maxInterval).toBe(1)
    expect(yAxis.splitLine.show).toBe(false)
  })

  it('draws a gridline at every natural note in G2-E5', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const lines = pitchSeries().markLine.data
    const naturals = [43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65,
      67, 69, 71, 72, 74, 76]
    expect(lines).toHaveLength(20)
    const refs = lines
      .filter((l: { yAxis: number }) => l.yAxis !== 60)
      .map((l: { yAxis: number }) => l.yAxis)
      .sort((a: number, b: number) => a - b)
    expect(refs).toEqual(naturals.filter(n => n !== 60))
  })

  it('renders f0 as continuous midi values', () => {
    useAppStore.getState().setFrames([
      { time: 0.1, f0: 220, f1: 0, f2: 0 },
      { time: 0.2, f0: 225, f1: 0, f2: 0 },
    ])
    render(<PitchChart />)
    const data = pitchSeries().data as [number, number | null][]
    expect(data).toHaveLength(2)
    expect(data[0][0]).toBe(0.1)
    expect(data[0][1]).toBeCloseTo(freqToMidi(220), 4)
    expect(data[1][1]).toBeCloseTo(freqToMidi(225), 4)
  })

  it('shades the C2-B5 piano zone and marks C4', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const markArea = pitchSeries().markArea.data[0]
    expect(markArea[0].yAxis).toBe(36)
    expect(markArea[1].yAxis).toBe(83)
    const markLine = pitchSeries().markLine.data.find((d: { yAxis: number }) => d.yAxis === 60)
    expect(markLine.yAxis).toBe(60)
  })

  it('formats tooltip with the note from the real frame (no cents)', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: midiToFreq(61.4), f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    const html = formatter([{ value: [0.1, 60] }])
    expect(html).toContain('C#4')
    expect(html).not.toContain('音分')
    expect(html).not.toContain('+0')
  })

  it('shows the true note above the E5 ceiling instead of the clamped axis value', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 700, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    const html = formatter([{ value: [0.1, 76] }])
    expect(html).toContain('♬ F5')
    expect(html).not.toMatch(/♬\s*E5/)
  })

  it('formats tooltip as placeholder when pitch is null', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: null, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    expect(formatter([{ value: [0.1, null] }])).toContain('--')
  })
})