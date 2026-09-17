import { useRef, useEffect } from 'react'
import { useECharts } from '../hooks/useECharts'
import { useAppStore } from '../store/appStore'
import type { AnalysisFrame } from '../types'
import {
  freqToMidi,
  midiToName,
  isNaturalMidi,
  MIDI_C2,
  MIDI_C4,
  MIDI_B5,
  MIDI_G2,
  MIDI_E5,
} from '../utils/pitch'

const WINDOW = 10

const GRID_MIDI: number[] = (() => {
  const out: number[] = []
  for (let m = MIDI_G2; m <= MIDI_E5; m++) {
    if (m !== MIDI_C4 && isNaturalMidi(m)) out.push(m)
  }
  return out
})()

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

export function formatPitchTooltip(params: any, frames: AnalysisFrame[]): string {
  if (!params || params.length === 0) return ''
  const p = params[0]
  const time = p.value?.[0]
  const frame = typeof time === 'number' ? findFrameAtTime(frames, time) : null
  let pitchText = '--'
  if (frame && frame.f0 != null && frame.f0 > 0) {
    pitchText = midiToName(freqToMidi(frame.f0))
  } else if (!frame) {
    const midi = p.value?.[1]
    if (midi != null && Number.isFinite(midi)) {
      pitchText = midiToName(midi)
    }
  }
  return `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>
<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E23E57;"></span>
  <span style="flex:0 0 auto;color:#475467;">音高</span>
  <span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;">♬ ${pitchText}</span>
</div>`
}

interface PitchChartProps {
  cursorTime?: number
}

export function PitchChart({ cursorTime = -1 }: PitchChartProps) {
  const frames = useAppStore(s => s.frames)
  const { chartRef, setOption } = useECharts()
  const rafRef = useRef<number | null>(null)
  const isLiveRef = useRef(false)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      renderChart(frames, cursorTime, isLiveRef.current)
      rafRef.current = null
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [frames]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    renderChart(frames, cursorTime, isLiveRef.current)
  }, [cursorTime]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isLiveRef.current = frames.length > 1
  }, [frames.length])

  function renderChart(data: AnalysisFrame[], cursor: number, isLive: boolean) {
    const seriesData = data.map(f =>
      f.f0 && f.f0 > 0 ? [f.time, freqToMidi(f.f0)] : [f.time, null],
    )

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
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 60, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params: any) => formatPitchTooltip(params, data),
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
        min: MIDI_G2,
        max: MIDI_E5,
        minInterval: 1,
        maxInterval: 1,
        axisLine: { lineStyle: { color: '#D0D5DD' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#667085',
          fontSize: 11,
          formatter: (v: number) => (isNaturalMidi(v) ? midiToName(v) : ''),
        },
        splitLine: { show: false },
      },
      color: ['#E23E57'],
      series: [
        {
          name: 'PITCH',
          type: 'line' as const,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: '#E23E57', width: 2 },
          itemStyle: { color: '#E23E57' },
          markArea: {
            silent: true,
            data: [[{
              yAxis: MIDI_C2,
              itemStyle: { color: hexToRgba('#3B82F6', 0.05) },
            }, { yAxis: MIDI_B5 }]],
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              ...GRID_MIDI.map(m => ({
                yAxis: m,
                lineStyle: { color: '#E4E7EC', width: 1 },
                label: { show: false },
              })),
              {
                yAxis: MIDI_C4,
                lineStyle: { color: hexToRgba('#3B82F6', 0.45), type: 'dashed' as const, width: 1 },
                label: { formatter: 'C4', color: '#667085', fontSize: 11, position: 'insideEndTop' },
              },
            ],
          },
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
    renderChart(frames, cursorTime, isLiveRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="pitchChart" ref={chartRef} />
}