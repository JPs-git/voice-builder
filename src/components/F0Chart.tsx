import { useRef, useEffect } from 'react'
import { useDisplayAnalysis } from '../hooks/useDisplayAnalysis'
import { useECharts } from '../hooks/useECharts'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { AnalysisFrame } from '../types'

const WINDOW = 10

const TARGET_ZONES = [
  { label: '男声', range: [80, 150], color: '#5BCEFA' },
  { label: '女声', range: [180, 300], color: '#F5A9B8' },
]

const TARGET_ZONES_PORTRAIT = [
  { label: '男声', range: [160, 240], color: 'rgba(63, 131, 248, 0.08)', dash: '#8BB9FF', labelColor: '#3F83F8' },
  { label: '女声', range: [270, 350], color: 'rgba(233, 71, 99, 0.08)', dash: '#F4A0B1', labelColor: '#E94763' },
]

type TargetZone = { label: string; range: number[]; color: string; dash?: string; labelColor?: string }

const PORTRAIT_QUERY = '(max-width: 768px)'

const GRID_DESKTOP = { left: 72, right: 32, top: 20, bottom: 36 }
const GRID_PORTRAIT = { left: 42, right: 0, top: 10, bottom: 6 }

const F0_COLOR_DESKTOP = '#1F2937'
const F0_COLOR_PORTRAIT = '#3F83F8'

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function findFrameAtTime(frames: AnalysisFrame[], time: number): AnalysisFrame | null {
  let best: AnalysisFrame | null = null
  let bestDist = Infinity
  for (const f of frames) {
    const d = Math.abs(f.time - time)
    if (d < bestDist) {
      bestDist = d
      best = f
    }
  }
  return bestDist <= 0.005 ? best : null
}

export function formatF0Tooltip(params: any, frames: AnalysisFrame[]): string {
  if (!params || params.length === 0) return ''
  const p = params[0]
  const time = p.value?.[0]
  const frame = typeof time === 'number' ? findFrameAtTime(frames, time) : null
  const f0 = frame ? frame.f0 : p.value?.[1]
  const f0Text = (f0 != null && f0 > 0) ? `${Math.round(f0)} Hz` : '--'
  return `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>
<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1F2937;"></span>
  <span style="flex:0 0 auto;color:#475467;">F0</span>
  <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">${f0Text}</span>
</div>`
}

function buildMarkAreas(zones: TargetZone[], colorFor: (zone: TargetZone) => string, verbatim = false) {
  return zones.map(z => ([{
    yAxis: z.range[0],
    itemStyle: { color: verbatim ? colorFor(z) : hexToRgba(colorFor(z), 0.15) },
  }, {
    yAxis: z.range[1],
  }]))
}

function buildMarkLineData(zones: TargetZone[], colorFor: (zone: TargetZone) => string, verbatim = false) {
  return zones.map(z => {
    const mid = verbatim ? (z.label === '男声' ? 200 : 300) : Math.round((z.range[0] + z.range[1]) / 2)
    const color = colorFor(z)
    const lineColor = z.dash ?? color
    const labelColor = z.labelColor ?? color
    return {
      yAxis: mid,
      lineStyle: { color: verbatim ? lineColor : hexToRgba(lineColor, 0.4), type: 'dashed' as const, width: 1 },
      label: {
        formatter: z.label,
        color: labelColor,
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
  const { frames } = useDisplayAnalysis()
  const { chartRef, setOption } = useECharts()
  const isPortrait = useMediaQuery(PORTRAIT_QUERY)
  const isLive = frames.length > 1
  const previousFrames = useRef(frames)
  const tooltipFrames = useRef(frames)
  tooltipFrames.current = frames

  useEffect(() => {
    if (previousFrames.current === frames) return
    previousFrames.current = frames
    renderChart(frames, cursorTime, isLive, false, isPortrait, true)
  }, [frames]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    renderChart(frames, cursorTime, isLive, false, isPortrait)
  }, [cursorTime, isPortrait])

  function renderChart(
    data: AnalysisFrame[],
    cursor: number,
    isLive: boolean,
    useAnimation: boolean,
    isPortrait: boolean,
    dataOnly = false,
  ) {
    const seriesData = data.map(f => [f.time, f.f0 ?? null])
    const f0Color = isPortrait ? F0_COLOR_PORTRAIT : F0_COLOR_DESKTOP
    const zones = isPortrait ? TARGET_ZONES_PORTRAIT : TARGET_ZONES
    const zoneColor: (zone: TargetZone) => string = (zone: TargetZone) => zone.color
    let lastDot: AnalysisFrame | undefined
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].f0 != null && data[i].f0! > 0) { lastDot = data[i]; break }
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

    const markPoint = isPortrait && lastDot ? {
      silent: true,
      symbol: 'circle',
      symbolSize: 7,
      itemStyle: { color: f0Color, shadowBlur: 12, shadowColor: 'rgba(63, 131, 248, 0.35)' },
      data: [{ coord: [lastDot.time, lastDot.f0], symbolSize: 7 }],
    } : { data: [] }

    if (dataOnly) {
      setOption({ xAxis: { min: minTime, max: maxTime }, series: [{ name: 'F0', data: seriesData, markPoint }] } as any)
      return
    }

    setOption({
      animation: useAnimation,
      backgroundColor: 'transparent',
      grid: isPortrait ? GRID_PORTRAIT : GRID_DESKTOP,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => formatF0Tooltip(params, tooltipFrames.current),
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
      yAxis: {
        type: 'value',
        min: 0,
        max: 500,
        ...(isPortrait ? { interval: 100 } : {}),
        axisLine: { ...(isPortrait ? { show: true, onZero: false } : {}), lineStyle: { color: isPortrait ? '#B8C4D1' : '#D0D5DD' } },
        axisLabel: { color: isPortrait ? '#7D8DA8' : '#667085', fontSize: isPortrait ? 9 : 11, formatter: (v: number) => `${v} Hz` },
        splitLine: { lineStyle: { color: isPortrait ? '#EDF2F7' : '#F2F4F7' } },
      },
      color: [f0Color],
      series: [
        {
          name: 'F0',
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: f0Color, width: 2 },
          itemStyle: { color: f0Color },
          markArea: { silent: true, data: buildMarkAreas(zones, zoneColor, isPortrait) },
          markLine: { silent: true, symbol: 'none', data: buildMarkLineData(zones, zoneColor, isPortrait) },
          markPoint,
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


  return <div id="f0Chart" ref={chartRef} />
}
