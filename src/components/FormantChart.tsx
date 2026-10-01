import { useRef, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame, TargetBands } from '../types'

const WINDOW = 10
const FREQ_MAX = 3500

const PORTRAIT_QUERY = '(max-width: 768px)'

const GRID_DESKTOP = { left: 72, right: 32, top: 20, bottom: 36 }
const GRID_PORTRAIT = { left: 42, right: 0, top: 10, bottom: 6 }

const COLORS = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
}

const PORTRAIT_COLORS = {
  f0: '#12B886',
  f1: '#F04B6A',
  f2: '#3F83F8',
}

const SPARSE_TICKS = [0, 1000, 2000, 3000, 3500]

const PORTRAIT_MARK_AREA: Record<'f0' | 'f1' | 'f2', string> = {
  f0: 'rgba(18, 184, 134, 0.08)',
  f1: 'rgba(63, 131, 248, 0.08)',
  f2: 'rgba(245, 158, 11, 0.08)',
}

const PORTRAIT_MARK_LINE = {
  f0: '#12B886',
  f1: '#3F83F8',
  f2: '#F4B84A',
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkArea(range: [number, number], color: string, verbatim = false) {
  return [[{
    yAxis: range[0],
    itemStyle: { color: verbatim ? color : hexToRgba(color, 0.10) },
  }, { yAxis: range[1] }]]
}

function buildMarkLine(range: [number, number], name: string, color: string, verbatim = false, position: 'insideEndTop' | 'insideEndBottom' = 'insideEndTop') {
  const mid = Math.round((range[0] + range[1]) / 2)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: verbatim ? color : hexToRgba(color, 0.55), type: 'dashed' as const, width: 1 },
    label: { formatter: name, color, fontSize: 11, position },
    data: [{ yAxis: mid }],
  }
}

interface FormantChartProps {
  cursorTime?: number
  onFrameClick?: (frame: AnalysisFrame) => void
}

export function FormantChart({ cursorTime = -1, onFrameClick }: FormantChartProps) {
  const frames = useAppStore(s => s.frames)
  const bands = useAppStore(s => s.bands)
  const formantVisible = useAppStore(s => s.formantVisible)
  const { chartRef, setOption, getInstance } = useECharts()
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  // Large scatter avoids one graphic per point, but cannot reliably pick points with gaps.
  const useLargeSymbols = isPortrait && !onFrameClick
  const rafRef = useRef<number | null>(null)
  const isLiveRef = useRef(false)
  const seriesVisibleRef = useRef({ f0: true, f1: true, f2: true })

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, bands, isLiveRef.current, false, isPortrait)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames, isPortrait, useLargeSymbols])

  useEffect(() => {
    renderChart(frames, cursorTime, bands, isLiveRef.current, false, isPortrait)
  }, [cursorTime, bands, isPortrait])

  useEffect(() => {
    isLiveRef.current = frames.length > 1
  }, [frames.length])

  useEffect(() => {
    seriesVisibleRef.current = formantVisible
    renderChart(frames, cursorTime, bands, isLiveRef.current, false, isPortrait)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formantVisible, isPortrait])

  // Chart click → find nearest frame
  useEffect(() => {
    const instance = getInstance()
    if (!instance || !onFrameClick) return
    const handler = (params: any) => {
      const t = params.value?.[0]
      if (t == null) return
      const data = useAppStore.getState().frames
      let best: AnalysisFrame | null = null
      let bestDist = Infinity
      for (const f of data) {
        const d = Math.abs(f.time - t)
        if (d < bestDist) { bestDist = d; best = f }
      }
      if (best) onFrameClick(best)
    }
    instance.on('click', handler)
    return () => { instance.off('click', handler) }
  }, [getInstance, onFrameClick])

  function renderChart(
    data: AnalysisFrame[],
    cursor: number,
    currentBands: TargetBands,
    isLive: boolean,
    useAnimation: boolean,
    isPortrait: boolean,
  ) {
    const visible = seriesVisibleRef.current
    const keys = ['f0', 'f1', 'f2'] as const
    const palette = isPortrait ? PORTRAIT_COLORS : COLORS
    const areaColor = (k: keyof TargetBands) => isPortrait
      ? (PORTRAIT_MARK_AREA as Record<string, string>)[k]
      : currentBands[k].color
    const lineColor = (k: keyof TargetBands) => isPortrait
      ? PORTRAIT_MARK_LINE[k]
      : currentBands[k].color
    const seriesData: Record<string, any[]> = {}
    for (const k of keys) {
      seriesData[k] = visible[k] ? data.map(f => [f.time, f[k] ?? null]) : []
    }

    const hasData = data.length > 0
    const windowSize = WINDOW
    let minTime: number, maxTime: number
    if (isLive && hasData) {
      const currentTime = data[data.length - 1].time
      minTime = currentTime - windowSize
      maxTime = currentTime
    } else if (hasData) {
      minTime = data[0].time
      maxTime = Math.max(data[data.length - 1].time, minTime + windowSize)
    } else {
      minTime = 0
      maxTime = windowSize
    }

    const tooltipKeys = ['f2', 'f1', 'f0']

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: isPortrait ? GRID_PORTRAIT : GRID_DESKTOP,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const byName: Record<string, any> = {}
          for (const p of params) byName[p.seriesName] = p
          const time = params[0].value[0]
          let html = `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>`
          for (const k of tooltipKeys) {
            const name = k.toUpperCase()
            const p = byName[name]
            const color = palette[k as keyof typeof palette]
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
        axisLine: { ...(isPortrait ? { show: true, onZero: false } : {}), lineStyle: { color: isPortrait ? '#B8C4D1' : '#D0D5DD' } },
        axisLabel: isPortrait
          ? { show: false }
          : { show: false },
        splitLine: { lineStyle: { color: isPortrait ? '#EDF2F7' : '#F2F4F7' } },
      },
      yAxis: isPortrait ? {
        type: 'value',
        min: 0,
        max: FREQ_MAX,
        interval: 500,
        axisLine: { show: true, onZero: false, lineStyle: { color: '#B8C4D1' } },
        axisLabel: { color: '#7D8DA8', fontSize: isPortrait ? 9 : 11, formatter: (v: number) => SPARSE_TICKS.some(t => Math.abs(v - t) < 1) ? `${Math.round(v)} Hz` : '' },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#EDF2F7' } },
      } : {
        type: 'value',
        min: 0,
        max: FREQ_MAX,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: isPortrait ? 9 : 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: keys.map(k => palette[k]),
      series: [
        ...keys.map(k => ({
          name: k.toUpperCase(),
          type: isPortrait ? 'scatter' as const : 'line' as const,
          large: useLargeSymbols,
          largeThreshold: 100,
          showSymbol: isPortrait,
          symbol: 'circle',
          symbolSize: 2,
          connectNulls: false,
          color: palette[k],
          lineStyle: { color: palette[k], width: isPortrait ? 0 : (k === 'f0' ? 2 : 1.5) },
          itemStyle: { color: palette[k], opacity: 1 },
          markArea: visible[k] && currentBands[k] ? { silent: true, data: buildMarkArea(currentBands[k].range, areaColor(k), isPortrait) } : undefined,
          markLine: visible[k] ? buildMarkLine(currentBands[k].range, `${k.toUpperCase()} 目标`, lineColor(k), isPortrait, k === 'f1' ? 'insideEndBottom' : 'insideEndTop') : undefined,
          data: seriesData[k],
        })),
        {
          name: '__cursor',
          type: 'line' as const,
          showSymbol: false,
          data: [],
          markLine: cursor >= 0 ? {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#E23E57', width: 2, type: 'solid' as const },
            label: { show: false },
            data: [{ xAxis: cursor }],
          } : undefined,
        },
      ],
    } as any)
  }

  useEffect(() => {
    renderChart(frames, cursorTime, bands, isLiveRef.current, false, isPortrait)
  }, [isPortrait, useLargeSymbols]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="formantChart" ref={chartRef} />
}
