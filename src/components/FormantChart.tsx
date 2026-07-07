import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useECharts } from '../hooks/useECharts'
import type { AnalysisFrame, ChartHandles, TargetBands } from '../types'

const WINDOW = 10
const FREQ_MAX = 3500

const COLORS = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

const DEFAULT_BANDS: TargetBands = {
  f0: { range: [200, 290], color: '#10B981' },
  f1: { range: [400, 750], color: '#3B82F6' },
  f2: { range: [1200, 2200], color: '#F59E0B' },
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkArea(band: { range: [number, number]; color: string }) {
  return [[{
    yAxis: band.range[0],
    itemStyle: { color: hexToRgba(band.color, 0.10) },
  }, { yAxis: band.range[1] }]]
}

function buildMarkLine(band: { range: [number, number]; color: string }, name: string) {
  const mid = Math.round((band.range[0] + band.range[1]) / 2)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: hexToRgba(band.color, 0.55), type: 'dashed' as const, width: 1 },
    label: { formatter: name, color: band.color, fontSize: 11 },
    data: [{ yAxis: mid }],
  }
}

export const FormantChart = forwardRef<ChartHandles, {
  batchMode?: boolean
  onFrameClick?: (frame: AnalysisFrame) => void
}>(({ batchMode = false, onFrameClick }, ref) => {
  const { chartRef, setOption, getInstance } = useECharts()
  const dataRef = useRef<AnalysisFrame[]>([])
  const isBatchRef = useRef(batchMode)
  const latestTimeRef = useRef(0)
  const throttledRef = useRef(false)
  const cursorTimeRef = useRef(-1)
  const seriesVisibleRef = useRef({ f0: true, f1: true, f2: true })
  const bandsRef = useRef(DEFAULT_BANDS)

  isBatchRef.current = batchMode

  const render = useCallback((useAnimation: boolean) => {
    const data = dataRef.current
    const visible = seriesVisibleRef.current
    const keys = ['f0', 'f1', 'f2'] as const
    const seriesData: Record<string, any[]> = {}
    for (const k of keys) {
      seriesData[k] = visible[k] ? data.map(f => [f.time, f[k] ?? null]) : []
    }

    const hasData = data.length > 0
    let minTime: number, maxTime: number
    if (isBatchRef.current) {
      minTime = hasData ? data[0].time : 0
      maxTime = hasData ? data[data.length - 1].time : WINDOW
    } else {
      if (hasData) {
        const currentTime = data[data.length - 1].time
        minTime = currentTime - WINDOW
        maxTime = currentTime
      } else {
        minTime = 0
        maxTime = WINDOW
      }
    }

    const bands = bandsRef.current
    const tooltipKeys = ['f2', 'f1', 'f0']

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const byName: Record<string, any> = {}
          for (const p of params) byName[p.seriesName] = p
          const time = params[0].value[0]
          let html = `<div style="font-size:11px;color:#667085;margin-bottom:4px;">\u65F6\u95F4 ${Number(time).toFixed(2)} s</div>`
          for (const k of tooltipKeys) {
            const name = k.toUpperCase()
            const p = byName[name]
            const color = COLORS[k as keyof typeof COLORS]
            const raw = p?.value?.[1]
            const v = (raw != null && raw > 0) ? Math.round(raw) : null
            const text = v == null ? '--' : `${v} Hz`
            html += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
              <span style="flex:0 0 auto;color:#475467;">${name}</span>
              <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">${text}</span>
            </div>`
          }
          return html
        },
      },
      xAxis: {
        type: 'value',
        min: minTime,
        max: maxTime,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: FREQ_MAX,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: keys.map(k => COLORS[k]),
      series: keys.map(k => ({
        name: k.toUpperCase(),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        color: COLORS[k],
        lineStyle: { color: COLORS[k], width: k === 'f0' ? 2 : 1.5 },
        itemStyle: { color: COLORS[k] },
        markArea: bands[k] ? { silent: true, data: buildMarkArea(bands[k]) } : undefined,
        markLine: (k === 'f0' || k === 'f1' || k === 'f2') ? buildMarkLine(bands[k], `${k.toUpperCase()} \u76EE\u6807`) : undefined,
        data: seriesData[k],
      })),
    } as any)
  }, [setOption])

  const handleChartClick = useCallback((params: any) => {
    if (!onFrameClick) return
    const t = params.value?.[0]
    if (t == null) return
    const data = dataRef.current
    let best: AnalysisFrame | null = null
    let bestDist = Infinity
    for (const f of data) {
      const d = Math.abs(f.time - t)
      if (d < bestDist) { bestDist = d; best = f }
    }
    if (best) onFrameClick(best)
  }, [onFrameClick])

  useImperativeHandle(ref, () => ({
    pushFrame(frame: AnalysisFrame) {
      if (isBatchRef.current) return
      const data = dataRef.current
      data.push({ ...frame })
      latestTimeRef.current = frame.time
      const cutoff = frame.time - WINDOW
      while (data.length > 0 && data[0].time < cutoff) data.shift()
      if (!throttledRef.current) {
        throttledRef.current = true
        requestAnimationFrame(() => {
          render(false)
          throttledRef.current = false
        })
      }
    },
    displayAll(frames: AnalysisFrame[]) {
      dataRef.current = frames
      if (frames.length > 0) latestTimeRef.current = frames[frames.length - 1].time
      render(true)
    },
    setLiveMode() {
      isBatchRef.current = false
      render(false)
    },
    setTargetBands(bands: Partial<Record<'f0' | 'f1' | 'f2', [number, number]>>) {
      for (const k of ['f0', 'f1', 'f2'] as const) {
        const r = bands[k]
        if (r && r.length === 2 && r[0] < r[1]) {
          bandsRef.current[k].range = r
        }
      }
      render(true)
    },
    setCursorTime(time: number) {
      cursorTimeRef.current = time
    },
    clear() {
      dataRef.current = []
      isBatchRef.current = false
      latestTimeRef.current = 0
      throttledRef.current = false
      render(false)
    },
  }), [render])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 280 }} ref={chartRef} />
  )
})

FormantChart.displayName = 'FormantChart'
