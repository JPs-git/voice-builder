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

  it('maps Y axis to C2-C6 midi range', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    expect(lastOption().yAxis.min).toBe(36)
    expect(lastOption().yAxis.max).toBe(84)
  })

  it('labels Y axis with scientific pitch names', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    expect(lastOption().yAxis.axisLabel.formatter(60)).toBe('C4')
    expect(lastOption().yAxis.axisLabel.formatter(61)).toBe('')
    expect(lastOption().yAxis.axisLabel.formatter(48)).toBe('C3')
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

  it('shades the C3-C5 piano zone and marks C4', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const markArea = pitchSeries().markArea.data[0]
    expect(markArea[0].yAxis).toBe(48)
    expect(markArea[1].yAxis).toBe(72)
    const markLine = pitchSeries().markLine.data[0]
    expect(markLine.yAxis).toBe(60)
  })

  it('formats tooltip with note name and cents', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: 220, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    const html = formatter([{ value: [0.1, freqToMidi(261.63)] }])
    expect(html).toContain('C4')
    expect(html).toContain('+0')
    expect(html).toContain('音分')
  })

  it('formats tooltip as placeholder when pitch is null', () => {
    useAppStore.getState().setFrames([{ time: 0.1, f0: null, f1: 0, f2: 0 }])
    render(<PitchChart />)
    const formatter = lastOption().tooltip.formatter
    expect(formatter([{ value: [0.1, null] }])).toContain('--')
  })
})