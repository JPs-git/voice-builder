import { useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import type { AnalysisFrame, ChartHandles } from '../types'

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
      },
    }
  })
}

interface F0ChartProps {
  batchMode?: boolean
}

export const F0Chart = forwardRef<ChartHandles, F0ChartProps>((props, ref) => {
  const batchMode = props.batchMode ?? false
  const { chartRef, setOption } = useECharts()
  const dataRef = useRef<AnalysisFrame[]>([])
  const isBatchRef = useRef(batchMode)
  const latestTimeRef = useRef(0)
  const throttledRef = useRef(false)
  const cursorTimeRef = useRef(-1)

  isBatchRef.current = batchMode

  const render = useCallback((useAnimation: boolean) => {
    const data = dataRef.current
    const seriesData = data.map(f => [f.time, f.f0 ?? null])

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
          markLine: cursorTimeRef.current >= 0 ? {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#E23E57', width: 2, type: 'solid' as const },
            label: { show: false },
            data: [{ xAxis: cursorTimeRef.current }],
          } : undefined,
        },
      ],
    } as any)
  }, [setOption])

  useEffect(() => {
    render(false)
  }, [render])

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
    setTargetBands() {},
    setCursorTime(time: number) {
      cursorTimeRef.current = time
      render(false)
    },
    clear() {
      dataRef.current = []
      isBatchRef.current = false
      latestTimeRef.current = 0
      throttledRef.current = false
      cursorTimeRef.current = -1
      render(false)
    },
  }), [render])

  return (
    <div id="f0Chart" ref={chartRef} />
  )
})

F0Chart.displayName = 'F0Chart'