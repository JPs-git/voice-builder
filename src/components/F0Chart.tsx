import { useRef, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame } from '../types'

const WINDOW = 10

const TARGET_ZONES = [
  { label: '男声', range: [80, 150], color: '#5BCEFA' },
  { label: '女声', range: [180, 300], color: '#F5A9B8' },
]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkAreas(zones: typeof TARGET_ZONES) {
  return zones.map(z => ([{
    yAxis: z.range[0],
    itemStyle: { color: hexToRgba(z.color, 0.15) },
  }, {
    yAxis: z.range[1],
  }]))
}

function buildMarkLineData(zones: typeof TARGET_ZONES) {
  return zones.map(z => {
    const mid = Math.round((z.range[0] + z.range[1]) / 2)
    return {
      yAxis: mid,
      lineStyle: { color: hexToRgba(z.color, 0.4), type: 'dashed' as const, width: 1 },
      label: {
        formatter: z.label,
        color: z.color,
        fontSize: 11,
        position: 'insideEndTop',
      },
    }
  })
}

interface F0ChartProps {
  cursorTime?: number
}

export function F0Chart({ cursorTime = -1 }: F0ChartProps) {
  const frames = useAppStore(s => s.frames)
  const { chartRef, setOption } = useECharts()
  const rafRef = useRef<number | null>(null)
  const isLiveRef = useRef(false)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, isLiveRef.current, false)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames])

  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current, false)
  }, [cursorTime])

  // Detect live vs batch mode
  useEffect(() => {
    isLiveRef.current = frames.length > 1
  }, [frames.length])

  function renderChart(
    data: AnalysisFrame[],
    cursor: number,
    isLive: boolean,
    useAnimation: boolean,
  ) {
    const seriesData = data.map(f => [f.time, f.f0 ?? null])

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

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const p = params[0]
          const time = p.value?.[0]
          const f0 = p.value?.[1]
          const f0Text = (f0 != null && f0 > 0) ? `${Math.round(f0)} Hz` : '--'
          return `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>
<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1F2937;"></span>
  <span style="flex:0 0 auto;color:#475467;">F0</span>
  <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">${f0Text}</span>
</div>`
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
        max: 500,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: ['#1F2937'],
      series: [
        {
          name: 'F0',
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: '#1F2937', width: 2 },
          itemStyle: { color: '#1F2937' },
          markArea: { silent: true, data: buildMarkAreas(TARGET_ZONES) },
          markLine: { silent: true, symbol: 'none', data: buildMarkLineData(TARGET_ZONES) },
          data: seriesData,
        },
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
    renderChart(frames, cursorTime, isLiveRef.current, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="f0Chart" ref={chartRef} />
}
