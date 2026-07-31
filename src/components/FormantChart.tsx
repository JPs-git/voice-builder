import { useRef, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame, TargetBands } from '../types'

const WINDOW = 10
const FREQ_MAX = 3500

const COLORS = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
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
    label: { formatter: name, color: band.color, fontSize: 11, position: 'insideEndTop' },
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
  const { chartRef, setOption, getInstance } = useECharts()
  const rafRef = useRef<number | null>(null)
  const isLiveRef = useRef(false)
  const seriesVisibleRef = useRef({ f0: true, f1: true, f2: true })

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, bands, isLiveRef.current, false)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames])

  useEffect(() => {
    renderChart(frames, cursorTime, bands, isLiveRef.current, false)
  }, [cursorTime, bands])

  useEffect(() => {
    isLiveRef.current = frames.length > 1
  }, [frames.length])

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
  ) {
    const visible = seriesVisibleRef.current
    const keys = ['f0', 'f1', 'f2'] as const
    const seriesData: Record<string, any[]> = {}
    for (const k of keys) {
      seriesData[k] = visible[k] ? data.map(f => [f.time, f[k] ?? null]) : []
    }

    const hasData = data.length > 0
    let minTime: number, maxTime: number
    if (isLive && hasData) {
      const currentTime = data[data.length - 1].time
      minTime = currentTime - WINDOW
      maxTime = currentTime
    } else if (hasData) {
      minTime = data[0].time
      maxTime = Math.max(data[data.length - 1].time, minTime + WINDOW)
    } else {
      minTime = 0
      maxTime = WINDOW
    }

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
          let html = `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>`
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
      series: [
        ...keys.map(k => ({
          name: k.toUpperCase(),
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          color: COLORS[k],
          lineStyle: { color: COLORS[k], width: k === 'f0' ? 2 : 1.5 },
          itemStyle: { color: COLORS[k] },
          markArea: currentBands[k] ? { silent: true, data: buildMarkArea(currentBands[k]) } : undefined,
          markLine: buildMarkLine(currentBands[k], `${k.toUpperCase()} 目标`),
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
    renderChart(frames, cursorTime, bands, isLiveRef.current, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="formantChart" ref={chartRef} />
}
