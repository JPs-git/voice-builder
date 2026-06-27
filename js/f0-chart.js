import * as echarts from 'echarts'

const WINDOW = 10

const TARGET_ZONES = [
  { label: '男声', range: [80, 150], color: '#5BCEFA' },
  { label: '女声', range: [180, 300], color: '#F5A9B8' },
]

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildMarkAreas(zones) {
  return zones.map(z => ([{
    yAxis: z.range[0],
    itemStyle: { color: hexToRgba(z.color, 0.15) },
  }, {
    yAxis: z.range[1],
  }]))
}

function buildMarkLines(zones) {
  return zones.map(z => {
    const mid = Math.round((z.range[0] + z.range[1]) / 2)
    return {
      silent: true,
      symbol: 'none',
      lineStyle: { color: hexToRgba(z.color, 0.40), type: 'dashed', width: 1 },
      label: {
        formatter: z.label,
        color: z.color,
        fontSize: 11,
        position: 'insideEndTop',
      },
      data: [{ yAxis: mid }],
    }
  })
}

export class F0ChartRenderer {
  constructor(container) {
    this._chart = echarts.init(container, null, { renderer: 'canvas' })
    this._data = []
    this._batchMode = false
    this._cursorTime = -1
    this._latestTime = 0
    this._throttled = false

    this._render(false)
    this._bindEvents()

    this._boundResize = () => this._chart.resize()
    window.addEventListener('resize', this._boundResize)
  }

  get data() { return this._data.slice() }
  get batchMode() { return this._batchMode }

  _render(useAnimation) {
    const seriesData = this._data.map(f => [f.time, f.f0 ?? null])

    const hasData = this._data.length > 0
    let minTime, maxTime
    if (this._batchMode) {
      if (hasData) {
        minTime = this._data[0].time
        maxTime = this._data[this._data.length - 1].time
      } else {
        minTime = 0
        maxTime = WINDOW
      }
    } else {
      if (hasData) {
        const currentTime = this._data[this._data.length - 1].time
        minTime = currentTime - WINDOW
        maxTime = currentTime
      } else {
        minTime = 0
        maxTime = WINDOW
      }
    }

    this._chart.setOption({
      animation: !!useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params) => {
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
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      color: ['#1F2937'],
      series: [{
        name: 'F0',
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: '#1F2937', width: 2 },
        itemStyle: { color: '#1F2937' },
        markArea: { silent: true, data: buildMarkAreas(TARGET_ZONES) },
        markLine: { silent: true, data: buildMarkLines(TARGET_ZONES) },
        data: seriesData,
      }],
    })
  }

  _bindEvents() {
    // no chart click handling needed for single-series F0 chart
  }

  pushFrame(frame) {
    if (this._batchMode) return
    this._data.push({ ...frame })
    this._latestTime = frame.time

    const cutoff = frame.time - WINDOW
    while (this._data.length > 0 && this._data[0].time < cutoff) this._data.shift()

    if (!this._throttled) {
      this._throttled = true
      requestAnimationFrame(() => {
        this._render(false)
        this._throttled = false
      })
    }
  }

  displayAll(frames) {
    this._batchMode = true
    this._data = frames
    if (frames.length > 0) this._latestTime = frames[frames.length - 1].time
    this._render(true)
  }

  setLiveMode() {
    this._batchMode = false
    this._render(false)
  }

  clear() {
    this._data = []
    this._batchMode = false
    this._latestTime = 0
    this._throttled = false
    this._render(false)
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize)
    this._chart.dispose()
  }

  setCursorTime(time) {
    this._cursorTime = time
    this._renderCursor()
  }

  _renderCursor() {
    const hasData = this._data.length > 1
    if (this._cursorTime < 0 || !hasData) {
      this._chart.setOption({ graphic: [] }, { replaceMerge: ['graphic'] })
      return
    }

    const dataTStart = this._data[0].time
    const dataTEnd = this._data[this._data.length - 1].time
    const currentTime = this._latestTime
    let axisMin, axisMax
    if (this._batchMode) {
      axisMin = dataTStart
      axisMax = dataTEnd
    } else {
      axisMin = currentTime - WINDOW
      axisMax = currentTime
    }

    const ratio = (this._cursorTime - axisMin) / (axisMax - axisMin)
    if (ratio < 0 || ratio > 1) {
      this._chart.setOption({ graphic: [] }, { replaceMerge: ['graphic'] })
      return
    }
    const grid = this._chart.getModel().getComponent('grid')
    if (!grid) return
    const rect = grid.coordinateSystem.getRect()
    const cx = rect.x + ratio * rect.width

    this._chart.setOption(
      {
        graphic: [{
          type: 'line',
          shape: { x1: cx, y1: rect.y, x2: cx, y2: rect.y + rect.height },
          style: { stroke: '#E23E57', lineWidth: 2 },
          z: 100,
        }],
      },
      { replaceMerge: ['graphic'] }
    )
  }
}
