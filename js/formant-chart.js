import * as echarts from 'echarts'

const WINDOW = 10

export class FormantChartRenderer {
  constructor(container) {
    this._chart = echarts.init(container, 'dark')
    this._data = []
    this._batchMode = false
    this._onClick = null
    this._latestTime = 0
    this._throttled = false

    this._initChart()
    this._bindEvents()

    this._boundResize = () => this._chart.resize()
    window.addEventListener('resize', this._boundResize)
  }

  get batchMode() { return this._batchMode }
  get data() { return this._data }

  _initChart() {
    this._chart.setOption({
      animation: false,
      grid: { left: 50, right: 16, top: 16, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) =>
          params.map(p =>
            `${p.marker} ${p.seriesName}: ${p.value[1] != null ? Math.round(p.value[1]) + ' Hz' : '-- Hz'}`
          ).join('<br/>'),
      },
      xAxis: {
        type: 'value',
        min: -WINDOW,
        max: 0,
        axisLabel: { show: false },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 5000,
        axisLine: { lineStyle: { color: '#555' } },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        { name: 'F0', type: 'line', data: [], connectNulls: false,
          symbol: 'none', lineStyle: { color: '#ffffff', width: 1.5 } },
        { name: 'F1', type: 'line', data: [], connectNulls: false,
          symbol: 'none', lineStyle: { color: '#ff4444', width: 1.5 } },
        { name: 'F2', type: 'line', data: [], connectNulls: false,
          symbol: 'none', lineStyle: { color: '#4488ff', width: 1.5 } },
        { name: 'F3', type: 'line', data: [], connectNulls: false,
          symbol: 'none', lineStyle: { color: '#44cc44', width: 1.5 } },
        { name: 'F4', type: 'line', data: [], connectNulls: false,
          symbol: 'none', lineStyle: { color: '#ff8844', width: 1.5 } },
      ],
    })
  }

  _bindEvents() {
    this._chart.on('click', (params) => {
      const clickTime = params.value[0]
      let best = null
      let bestDist = Infinity
      for (const f of this._data) {
        const dist = Math.abs(f.time - clickTime)
        if (dist < bestDist) { bestDist = dist; best = f }
      }
      if (best && this._onClick) {
        this._onClick(best)
      }
    })
  }

  pushFrame(formantFrame, time) {
    if (this._batchMode) return

    this._data.push({ ...formantFrame, time })
    this._latestTime = time

    const cutoff = time - WINDOW
    while (this._data.length > 0 && this._data[0].time < cutoff) {
      this._data.shift()
    }

    if (!this._throttled) {
      this._throttled = true
      requestAnimationFrame(() => {
        this._updateChart()
        this._throttled = false
      })
    }
  }

  _updateChart() {
    const currentTime = this._data.length > 0 ? this._data[this._data.length - 1].time : this._latestTime
    const keys = ['f0', 'f1', 'f2', 'f3', 'f4']
    const seriesData = {}
    for (const key of keys) {
      seriesData[key] = this._data.map(f => [f.time, f[key] ?? null])
    }

    this._chart.setOption({
      xAxis: { min: currentTime - WINDOW, max: currentTime },
      series: [
        { data: seriesData.f0 },
        { data: seriesData.f1 },
        { data: seriesData.f2 },
        { data: seriesData.f3 },
        { data: seriesData.f4 },
      ],
    })
  }

  displayAll(frames) {
    this._batchMode = true
    this._data = frames

    const keys = ['f0', 'f1', 'f2', 'f3', 'f4']
    const seriesData = {}
    for (const key of keys) {
      seriesData[key] = frames.map(f => [f.time, f[key] ?? null])
    }

    const maxTime = frames.length > 0 ? frames[frames.length - 1].time : WINDOW
    this._chart.setOption({
      xAxis: { min: 0, max: maxTime },
      series: [
        { data: seriesData.f0 },
        { data: seriesData.f1 },
        { data: seriesData.f2 },
        { data: seriesData.f3 },
        { data: seriesData.f4 },
      ],
    })
  }

  clear() {
    this._data = []
    this._batchMode = false
    this._latestTime = 0
    this._throttled = false
    this._chart.setOption({
      xAxis: { min: -WINDOW, max: 0 },
      series: [
        { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] },
      ],
    })
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize)
    this._chart.dispose()
  }
}
