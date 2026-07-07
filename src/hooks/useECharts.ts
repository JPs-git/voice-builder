import { useRef, useEffect, useCallback } from 'react'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'

export function useECharts() {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' })
    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [])

  const getInstance = useCallback(() => instanceRef.current, [])

  const setOption = useCallback((option: echarts.EChartsOption, opts?: { notMerge?: boolean }) => {
    instanceRef.current?.setOption(option, opts)
  }, [])

  return { chartRef, getInstance, setOption }
}
