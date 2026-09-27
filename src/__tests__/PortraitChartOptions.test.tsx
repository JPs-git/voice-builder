import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { F0Chart } from '../components/F0Chart'
import { FormantChart } from '../components/FormantChart'
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

function installMatchMedia(initial: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = []
  const mql = {
    matches: initial,
    addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb)
    },
    removeEventListener: () => {},
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  })
  return (matches: boolean) => {
    mql.matches = matches
    act(() => {
      for (const cb of listeners) cb({ matches })
    })
  }
}

function normalize(value: unknown): unknown {
  if (typeof value === 'function') return '[function]'
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = normalize((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

function lastOption(): any {
  const calls = setOptionMock.mock.calls
  return calls[calls.length - 1][0]
}

function seriesByName(name: string) {
  return lastOption().series.find((s: { name: string }) => s.name === name)
}

const LANDSCAPE_F0_OPTION = {
  animation: false,
  backgroundColor: 'transparent',
  grid: { left: 72, right: 32, top: 20, bottom: 36 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
    formatter: '[function]',
  },
  xAxis: {
    type: 'value',
    min: 0,
    max: 10,
    axisLine: { lineStyle: { color: '#D0D5DD' } },
    axisLabel: { show: false },
    splitLine: { lineStyle: { color: '#F2F4F7' } },
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 500,
    axisLine: { lineStyle: { color: '#D0D5DD' } },
    axisLabel: { color: '#667085', fontSize: 11, formatter: '[function]' },
    splitLine: { lineStyle: { color: '#F2F4F7' } },
  },
  color: ['#1F2937'],
  series: [
    {
      name: 'F0',
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { color: '#1F2937', width: 2 },
      itemStyle: { color: '#1F2937' },
      markArea: {
        silent: true,
        data: [
          [
            { yAxis: 80, itemStyle: { color: 'rgba(91, 206, 250, 0.15)' } },
            { yAxis: 150 },
          ],
          [
            { yAxis: 180, itemStyle: { color: 'rgba(245, 169, 184, 0.15)' } },
            { yAxis: 300 },
          ],
        ],
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: 115,
            lineStyle: { color: 'rgba(91, 206, 250, 0.4)', type: 'dashed', width: 1 },
            label: { formatter: '男声', color: '#5BCEFA', fontSize: 11, position: 'insideEndTop' },
          },
          {
            yAxis: 240,
            lineStyle: { color: 'rgba(245, 169, 184, 0.4)', type: 'dashed', width: 1 },
            label: { formatter: '女声', color: '#F5A9B8', fontSize: 11, position: 'insideEndTop' },
          },
        ],
      },
      data: [],
    },
    { name: '__cursor', type: 'line', showSymbol: false, data: [], markLine: undefined },
  ],
}

const LANDSCAPE_FORMANT_MARK_F1 = {
  markArea: 'rgba(59, 130, 246, 0.1)',
  markLine: 'rgba(59, 130, 246, 0.55)',
  line: '#E23E57',
}

const LANDSCAPE_FORMANT_MARK_F0 = {
  markArea: 'rgba(16, 185, 129, 0.1)',
  markLine: 'rgba(16, 185, 129, 0.55)',
  line: '#1F2937',
}

const LANDSCAPE_FORMANT_MARK_F2 = {
  markArea: 'rgba(245, 158, 11, 0.1)',
  markLine: 'rgba(245, 158, 11, 0.55)',
  line: '#3B82F6',
}

function formantMarkSummary(key: string) {
  const series = seriesByName(key.toUpperCase())
  return {
    markArea: series.markArea.data[0][0].itemStyle.color,
    markLine: series.markLine.lineStyle.color,
    line: series.lineStyle.color,
  }
}

describe('portrait chart options', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
  })

  it('keeps the landscape F0 option byte-identical to the desktop baseline', () => {
    setMatchMedia(false)
    render(<F0Chart />)
    expect(normalize(lastOption())).toEqual(LANDSCAPE_F0_OPTION)
  })

  it('hides the F0 x axis labels and keeps the wide grid in landscape', () => {
    setMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)
    expect(lastOption().grid.left).toBe(72)
  })

  it('draws the F0 line in charcoal in landscape', () => {
    setMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().series[0].lineStyle.color).toBe('#1F2937')
    expect(lastOption().series[0].itemStyle.color).toBe('#1F2937')
  })

  it('keeps the per-register F0 target zone colors in landscape', () => {
    setMatchMedia(false)
    render(<F0Chart />)
    const areas = lastOption().series[0].markArea.data
    const lines = lastOption().series[0].markLine.data
    expect(areas[0][0].itemStyle.color).toBe('rgba(91, 206, 250, 0.15)')
    expect(areas[1][0].itemStyle.color).toBe('rgba(245, 169, 184, 0.15)')
    expect(lines[0].lineStyle.color).toBe('rgba(91, 206, 250, 0.4)')
    expect(lines[1].label.color).toBe('#F5A9B8')
  })

  it('shows the F0 x axis labels with token colors in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(true)
    expect(option.xAxis.axisLabel.formatter(5)).toBe('5s')
    expect(option.xAxis.axisLabel.hideOverlap).toBe(true)
    expect(option.xAxis.axisLabel.color).toBe('#6F8197')
    expect(option.xAxis.axisLabel.fontSize).toBe(11)
    expect(option.xAxis.splitLine.lineStyle.color).toBe('#EDF1F5')
    expect(option.xAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.yAxis.axisLabel.color).toBe('#6F8197')
    expect(option.yAxis.splitLine.lineStyle.color).toBe('#EDF1F5')
    expect(option.yAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
  })

  it('tightens the F0 grid in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    expect(lastOption().grid).toEqual({ left: 48, right: 12, top: 16, bottom: 28 })
  })

  it('draws the F0 line in token green but keeps the per-zone target colors in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const series = lastOption().series[0]
    expect(series.lineStyle.color).toBe('#13B98B')
    expect(series.itemStyle.color).toBe('#13B98B')
    expect(lastOption().color).toEqual(['#13B98B'])
    expect(series.markArea.data[0][0].itemStyle.color).toBe('rgba(91, 206, 250, 0.15)')
    expect(series.markArea.data[1][0].itemStyle.color).toBe('rgba(245, 169, 184, 0.15)')
    expect(series.markLine.data[0].lineStyle.color).toBe('rgba(91, 206, 250, 0.4)')
    expect(series.markLine.data[0].label.color).toBe('#5BCEFA')
    expect(series.markLine.data[1].label.color).toBe('#F5A9B8')
  })

  it('keeps the landscape formant grid and hidden x axis labels', () => {
    setMatchMedia(false)
    render(<FormantChart />)
    const option = lastOption()
    expect(option.grid).toEqual({ left: 72, right: 32, top: 20, bottom: 36 })
    expect(option.xAxis.axisLabel.show).toBe(false)
    expect(option.yAxis.max).toBe(3500)
  })

  it('keeps the landscape formant series colors unchanged', () => {
    setMatchMedia(false)
    render(<FormantChart />)
    expect(lastOption().color).toEqual(['#1F2937', '#E23E57', '#3B82F6'])
    expect(formantMarkSummary('f0')).toEqual(LANDSCAPE_FORMANT_MARK_F0)
    expect(formantMarkSummary('f1')).toEqual(LANDSCAPE_FORMANT_MARK_F1)
    expect(formantMarkSummary('f2')).toEqual(LANDSCAPE_FORMANT_MARK_F2)
  })

  it('shows the formant x axis labels and tightens the grid in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(true)
    expect(option.xAxis.axisLabel.formatter(5)).toBe('5s')
    expect(option.xAxis.axisLabel.hideOverlap).toBe(true)
    expect(option.xAxis.axisLabel.color).toBe('#6F8197')
    expect(option.xAxis.axisLabel.fontSize).toBe(11)
    expect(option.xAxis.splitLine.lineStyle.color).toBe('#EDF1F5')
    expect(option.xAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.yAxis.axisLabel.color).toBe('#6F8197')
    expect(option.yAxis.splitLine.lineStyle.color).toBe('#EDF1F5')
    expect(option.yAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.grid).toEqual({ left: 48, right: 12, top: 16, bottom: 28 })
  })

  it('paints the formant mark areas from the token colors in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const f1 = seriesByName('F1')
    expect(f1.markArea.data[0][0].itemStyle.color).toBe('rgba(232, 76, 104, 0.1)')
    expect(f1.markLine.lineStyle.color).toBe('rgba(232, 76, 104, 0.55)')
  })

  it('uses the token green/red/blue series colors with 2px widths in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    expect(lastOption().color).toEqual(['#13B98B', '#E84C68', '#4387F5'])
    expect(seriesByName('F0').lineStyle.color).toBe('#13B98B')
    expect(seriesByName('F0').lineStyle.width).toBe(2)
    expect(seriesByName('F1').lineStyle.color).toBe('#E84C68')
    expect(seriesByName('F1').lineStyle.width).toBe(2)
    expect(seriesByName('F2').lineStyle.color).toBe('#4387F5')
    expect(seriesByName('F2').lineStyle.width).toBe(2)
  })

  it('re-renders with portrait options when the viewport crosses the breakpoint', () => {
    const resize = installMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().grid.left).toBe(72)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)

    resize(true)
    expect(lastOption().grid.left).toBe(48)
    expect(lastOption().xAxis.axisLabel.show).toBe(true)
  })

  it('re-renders the formant chart when the viewport crosses the breakpoint', () => {
    const resize = installMatchMedia(false)
    render(<FormantChart />)
    expect(lastOption().grid.left).toBe(72)

    resize(true)
    expect(lastOption().grid.left).toBe(48)
    expect(lastOption().xAxis.axisLabel.show).toBe(true)
  })

  it('marks the latest F0 sample with a 6-8px dot', () => {
    setMatchMedia(true)
    const st = useAppStore.getState()
    st.clearFrames()
    st.appendFrame({ time: 1, f0: 240, f1: 900, f2: 1200 })
    st.appendFrame({ time: 2, f0: 245, f1: 920, f2: 1250 })
    render(<F0Chart />)
    const mp = lastOption().series[0].markPoint
    expect(mp.data[0].coord).toEqual([2, 245])
    expect(mp.data[0].symbolSize).toBeGreaterThanOrEqual(6)
    expect(mp.data[0].symbolSize).toBeLessThanOrEqual(8)
  })
})
