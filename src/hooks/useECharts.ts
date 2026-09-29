import { useRef, useEffect, useCallback } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { recordingMetrics } from '../performance/recordingMetrics'

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' })
    const onResize = () => instanceRef.current?.resize()
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
    const start = recordingMetrics.enabled ? performance.now() : 0
    instanceRef.current?.setOption(option, opts)
    if (recordingMetrics.enabled) recordingMetrics.record('chartUpdate', performance.now() - start)
  }, [])

  return { chartRef, getInstance, setOption }
}
