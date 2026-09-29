import { useRef, useEffect, useCallback } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { recordingMetrics } from '../performance/recordingMetrics'
import { liveChartScheduler } from '../charts/liveChartScheduler'

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' })
    let width = chartRef.current.clientWidth
    let height = chartRef.current.clientHeight
    const onResize = () => {
      const el = chartRef.current
      if (!el || !instanceRef.current || el.clientWidth <= 0 || el.clientHeight <= 0) return
      if (el.clientWidth === width && el.clientHeight === height) return
      width = el.clientWidth
      height = el.clientHeight
      instanceRef.current.resize()
    }
    window.addEventListener('resize', onResize)
    // 容器初次挂载时可能还没有布局尺寸（0×0），监听容器尺寸变化后重绘
    const ro = new ResizeObserver(() => {
      const el = chartRef.current
      if (el && el.clientWidth > 0 && el.clientHeight > 0) onResize()
    })
    ro.observe(chartRef.current)
    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [])

  const getInstance = useCallback(() => instanceRef.current, [])

  const setOption = useCallback((option: echarts.EChartsOption, opts?: { notMerge?: boolean }) => {
    const start = performance.now()
    instanceRef.current?.setOption(option, opts)
    const duration = performance.now() - start
    liveChartScheduler.recordDrawCost(duration)
    recordingMetrics.record('chartUpdate', duration)
  }, [])

  return { chartRef, getInstance, setOption }
}
