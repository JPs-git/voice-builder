import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
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

  it('hides the F0 x axis labels with reference grid colors in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(false)
    expect(option.xAxis.splitLine.lineStyle.color).toBe('#EDF2F7')
    expect(option.xAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.yAxis.axisLabel.color).toBe('#7D8DA8')
    expect(option.yAxis.splitLine.lineStyle.color).toBe('#EDF2F7')
    expect(option.yAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
  })

  it('tightens the F0 grid in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    expect(lastOption().grid).toEqual({ left: 42, right: 0, top: 10, bottom: 6 })
  })

  it('draws the F0 line in new blue with flat zones in portrait', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const series = lastOption().series[0]
    expect(series.lineStyle.color).toBe('#3F83F8')
    expect(series.itemStyle.color).toBe('#3F83F8')
    expect(lastOption().color).toEqual(['#3F83F8'])
    expect(series.markArea.data[0][0].yAxis).toBe(160)
    expect(series.markArea.data[0][1].yAxis).toBe(240)
    expect(series.markArea.data[1][0].yAxis).toBe(270)
    expect(series.markArea.data[1][1].yAxis).toBe(350)
    expect(series.markArea.data[0][0].itemStyle.color).toBe('rgba(63, 131, 248, 0.08)')
    expect(series.markArea.data[1][0].itemStyle.color).toBe('rgba(233, 71, 99, 0.08)')
    expect(series.markLine.data[0].yAxis).toBe(200)
    expect(series.markLine.data[1].yAxis).toBe(300)
    expect(series.markLine.data[0].lineStyle.color).toBe('#8BB9FF')
    expect(series.markLine.data[0].lineStyle.type).toBe('dashed')
    expect(series.markLine.data[1].lineStyle.color).toBe('#F4A0B1')
    expect(series.markLine.data[1].lineStyle.type).toBe('dashed')
    expect(series.markLine.data[0].label.color).toBe('#3F83F8')
    expect(series.markLine.data[1].label.color).toBe('#E94763')
  })

  it('uses measured F0 portrait yAxis ticks', () => {
    setMatchMedia(true)
    render(<F0Chart />)
    const yAxis = lastOption().yAxis
    expect(yAxis.max).toBe(500)
    expect(yAxis.interval).toBe(100)
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

  it('hides the formant x axis labels and tightens the grid in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const option = lastOption()
    expect(option.xAxis.axisLabel.show).toBe(false)
    expect(option.xAxis.splitLine.lineStyle.color).toBe('#EDF2F7')
    expect(option.xAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.yAxis.axisLabel.color).toBe('#7D8DA8')
    expect(option.yAxis.splitLine.lineStyle.color).toBe('#EDF2F7')
    expect(option.yAxis.axisLine.lineStyle.color).toBe('#B8C4D1')
    expect(option.grid).toEqual({ left: 42, right: 0, top: 10, bottom: 6 })
  })

  it('uses measured formant portrait yAxis ticks with sparse labels', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const yAxis = lastOption().yAxis
    expect(yAxis.max).toBe(3500)
    expect(yAxis.interval).toBe(500)
    expect(yAxis.axisLabel.formatter(1000)).toBe('1000 Hz')
    expect(yAxis.axisLabel.formatter(500)).toBe('')
    expect(yAxis.axisLabel.formatter(0)).toBe('0 Hz')
    expect(yAxis.axisLabel.formatter(3500)).toBe('3500 Hz')
  })

  it('paints all three target areas in portrait with flat colors', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    const f0 = seriesByName('F0')
    expect(f0.markArea.data[0][0].itemStyle.color).toBe('rgba(18, 184, 134, 0.08)')
    expect(f0.markLine.lineStyle.color).toBe('#12B886')
    expect(f0.markLine.lineStyle.type).toBe('dashed')
    const f1 = seriesByName('F1')
    expect(f1.markArea.data[0][0].itemStyle.color).toBe('rgba(63, 131, 248, 0.08)')
    expect(f1.markLine.lineStyle.color).toBe('#3F83F8')
    expect(f1.markLine.lineStyle.type).toBe('dashed')
    const f2 = seriesByName('F2')
    expect(f2.markArea.data[0][0].itemStyle.color).toBe('rgba(245, 158, 11, 0.08)')
    expect(f2.markLine.lineStyle.color).toBe('#F4B84A')
    expect(f2.markLine.lineStyle.type).toBe('dashed')
  })

  it('draws visible green/red/blue continuous lines in portrait', () => {
    setMatchMedia(true)
    render(<FormantChart />)
    expect(lastOption().color).toEqual(['#12B886', '#F04B6A', '#3F83F8'])
    expect(seriesByName('F0').lineStyle.color).toBe('#12B886')
    expect(seriesByName('F0').type).toBe('line')
    expect(seriesByName('F0').lineStyle.width).toBeGreaterThan(0)
    expect(seriesByName('F1').lineStyle.color).toBe('#F04B6A')
    expect(seriesByName('F1').type).toBe('line')
    expect(seriesByName('F1').lineStyle.width).toBeGreaterThan(0)
    expect(seriesByName('F2').lineStyle.color).toBe('#3F83F8')
    expect(seriesByName('F2').type).toBe('line')
    expect(seriesByName('F2').lineStyle.width).toBeGreaterThan(0)
  })

  it('preserves timestamps, gaps and short peaks in a full portrait line window', () => {
    setMatchMedia(true)
    const frames = Array.from({ length: 1000 }, (_, index) => ({
      time: 20 + index / 100, f0: 220 as number | null,
      f1: 900 as number | null, f2: 1200 as number | null,
    }))
    frames[499] = { time: 24.99, f0: null, f1: 3450, f2: null }
    frames[999] = { time: 29.99, f0: 220, f1: 900, f2: 1200 }
    useAppStore.getState().setFrames(frames)
    render(<FormantChart />)

    for (const name of ['F0', 'F1', 'F2']) {
      const series = seriesByName(name)
      expect(series.type).toBe('line')
      expect(series.connectNulls).toBe(false)
      expect(series.lineStyle.width).toBeGreaterThan(0)
      expect(series.itemStyle.opacity).toBe(1)
      expect(series.data).toHaveLength(1000)
    }
    expect(seriesByName('F0').data[499]).toEqual([24.99, null])
    expect(seriesByName('F1').data[499]).toEqual([24.99, 3450])
    expect(seriesByName('F2').data[499]).toEqual([24.99, null])
    expect(seriesByName('F1').data[999]).toEqual([29.99, 900])
  })

  it('keeps isolated valid observations visible without markers on connected points', () => {
    setMatchMedia(true)
    useAppStore.getState().setFrames([
      { time: 0.1, f0: 220, f1: 900, f2: 1200 },
      { time: 0.2, f0: 225, f1: 920, f2: 1250 },
      { time: 0.3, f0: null, f1: null, f2: null },
      { time: 0.4, f0: 230, f1: 940, f2: 1300 },
      { time: 0.5, f0: null, f1: null, f2: null },
      { time: 0.6, f0: 240, f1: 960, f2: 1350 },
    ])
    render(<FormantChart />)
    const series = seriesByName('F1')
    expect(series.showSymbol).toBe(true)
    expect(typeof series.symbol).toBe('function')
    const symbols = series.data.map((value: unknown, dataIndex: number) => series.symbol(value, { dataIndex }))
    expect(symbols).toEqual(['none', 'none', 'none', 'circle', 'none', 'circle'])
  })

  it('keeps all point hit targets whenever a frame-selection callback is present', () => {
    setMatchMedia(true)
    useAppStore.getState().setFrames([
      { time: 0.1, f0: 220, f1: 900, f2: 1200 },
      { time: 0.2, f0: null, f1: null, f2: null },
    ])
    const { rerender } = render(<FormantChart />)
    expect(typeof seriesByName('F1').symbol).toBe('function')

    rerender(<FormantChart onFrameClick={() => {}} />)
    expect(seriesByName('F1').symbol).toBe('circle')
    expect(seriesByName('F1').data).toEqual([[0.1, 900], [0.2, null]])

    rerender(<FormantChart />)
    expect(typeof seriesByName('F1').symbol).toBe('function')
  })

  it('re-renders with portrait options when the viewport crosses the breakpoint', () => {
    const resize = installMatchMedia(false)
    render(<F0Chart />)
    expect(lastOption().grid.left).toBe(72)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)

    resize(true)
    expect(lastOption().grid.left).toBe(42)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)
  })

  it('re-renders the formant chart when the viewport crosses the breakpoint', () => {
    const resize = installMatchMedia(false)
    render(<FormantChart />)
    expect(lastOption().grid.left).toBe(72)

    resize(true)
    expect(lastOption().grid.left).toBe(42)
    expect(lastOption().xAxis.axisLabel.show).toBe(false)

    resize(false)
    expect(lastOption().grid.left).toBe(72)
    for (const name of ['F0', 'F1', 'F2']) {
      expect(seriesByName(name).type).toBe('line')
      expect(seriesByName(name).lineStyle.width).toBeGreaterThan(0)
    }
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
    expect(mp.itemStyle.shadowBlur).toBe(12)
    expect(mp.itemStyle.shadowColor).toBe('rgba(63, 131, 248, 0.35)')
  })
})


describe.each([['F0', F0Chart], ['formants', FormantChart]] as const)('%s recording window', (_name, Chart) => {
  it.each([true, false])('keeps only the latest 10 seconds (portrait=%s)', async (portrait) => {
    useAppStore.getState().reset()
    setOptionMock.mockClear()
    setMatchMedia(portrait)
    render(<Chart />)
    act(() => {
      for (let time = 0; time <= 35; time++) {
        useAppStore.getState().appendFrame({ time, f0: 220, f1: 850, f2: 1250 })
      }
    })
    await waitFor(() => {
      expect(lastOption().xAxis.max).toBe(35)
      expect(lastOption().xAxis.min).toBe(25)
    })
    act(() => {
      useAppStore.getState().appendFrame({ time: 36, f0: 225, f1: 860, f2: 1260 })
    })
    await waitFor(() => {
      expect(lastOption().xAxis.max).toBe(36)
      expect(lastOption().xAxis.min).toBe(26)
    })
  })
})
