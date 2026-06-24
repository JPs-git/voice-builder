import * as echarts from 'echarts'

/**
 * FormantChartRenderer
 * 渲染共振峰曲线 (F0/F1/F2/F3/F4), 浅色主题, 目标区间用 markArea 高亮,
 * 支持图例切换显隐, 点击任一帧将数值同步到状态栏。
 */

const WINDOW = 10
const FREQ_MAX = 6500

// 目标区间 (伪女声参考, 与 index.html / spectrogram.js 目标带说明保持一致).
// 颜色: 绿(F0)/蓝(F1)/橙(F2), 与上方功率谱的三色目标带对齐.
const TARGET_BANDS = {
  f0: { range: [180, 250], color: '#10B981' },
  f1: { range: [400, 700], color: '#3B82F6' },
  f2: { range: [1500, 2300], color: '#F59E0B' },
}

// 简易 #RRGGBB → rgba(r,g,b,a)
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 颜色定义 (与 style.css --c-fX 及图例小圆点保持一致)
const COLORS = {
  f0: '#1F2937',
  f1: '#E23E57',
  f2: '#3B82F6',
  f3: '#10B981',
  f4: '#F59E0B',
}

function buildMarkArea(band) {
  if (!band) return null
  // [[{yAxis: lo}, {yAxis: hi}]] 用于填充一个水平带
  return [[{
    yAxis: band.range[0],
    itemStyle: { color: hexToRgba(band.color, 0.10) },
  }, { yAxis: band.range[1] }]]
}

function buildMarkLine(band, name) {
  if (!band) return null
  const mid = Math.round((band.range[0] + band.range[1]) / 2)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: hexToRgba(band.color, 0.55), type: 'dashed', width: 1 },
    label: {
      formatter: name,
      color: band.color,
      fontSize: 11,
      position: 'insideEndTop',
    },
    data: [{ yAxis: mid }],
  }
}

export class FormantChartRenderer {
  constructor(container) {
    this._chart = echarts.init(container, null, { renderer: 'canvas' })
    this._data = []
    this._batchMode = false
    this._cursorTime = -1
    this._seriesVisible = { f0: true, f1: true, f2: true, f3: true, f4: true }
    this._onFrameClick = null
    this._latestTime = 0
    this._throttled = false

    this._initChart()
    this._bindEvents()

    this._boundResize = () => this._chart.resize()
    window.addEventListener('resize', this._boundResize)
  }

  get batchMode() { return this._batchMode }
  get data() { return this._data.slice() }

  setSeriesVisible(key, visible) {
    if (!(key in this._seriesVisible)) return
    this._seriesVisible[key] = !!visible
    this._render(true)
  }

  setFrameClickCallback(cb) { this._onFrameClick = cb }

  _initChart() {
    this._render(false)
  }

  _render(useAnimation) {
    const seriesData = {}
    const keys = ['f0', 'f1', 'f2', 'f3', 'f4']
    for (const k of keys) {
      const visible = this._seriesVisible[k]
      seriesData[k] = visible ? this._data.map(f => [f.time, f[k] ?? null]) : []
    }

    // 实时模式: [latestTime - WINDOW, latestTime] —— 新帧始终在右边缘
    // 批量模式: [frames[0].time, frames[last].time]  —— 显示完整录音
    // 空状态 (没有任何数据): 固定为 [0, WINDOW] —— 与上方语谱图视觉一致
    const hasData = this._data.length > 0
    let minTime, maxTime
    if (this._batchMode && hasData) {
      minTime = this._data[0].time
      maxTime = this._data[this._data.length - 1].time
    } else if (this._latestTime > 0) {
      minTime = this._latestTime - WINDOW
      maxTime = this._latestTime
    } else {
      minTime = 0
      maxTime = WINDOW
    }

    // tooltip:按 F4 在顶部、F0 在底部的顺序渲染,颜色与曲线完全一致
    const tooltipKeys = ['f4', 'f3', 'f2', 'f1', 'f0']

    this._chart.setOption({
      animation: !!useAnimation,
      backgroundColor: 'transparent',
      grid: { left: 72, right: 32, top: 20, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
        formatter: (params) => {
          if (!params || params.length === 0) return ''
          // params 的顺序通常等于 series 顺序,这里按我们想要的反向展示
          const byName = {}
          for (const p of params) byName[p.seriesName] = p
          const time = params[0].value[0]
          let html = `<div style="font-size:11px;color:#667085;margin-bottom:4px;">时间 ${Number(time).toFixed(2)} s</div>`
          for (const k of tooltipKeys) {
            const name = k.toUpperCase()
            const p = byName[name]
            const color = COLORS[k]
            const raw = p && p.value && Array.isArray(p.value) ? p.value[1] : null
            const v = (raw != null && raw > 0) ? Math.round(raw) : null
            const text = v == null ? '--' : `${v} Hz`
            html += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1F2937;line-height:1.8;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
              <span style="flex:0 0 auto;color:#475467;">${name}</span>
              <span style="margin-left:auto;font-variant-numeric: tabular-nums; font-weight:600;">${text}</span>
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
        axisLabel: { color: '#667085', fontSize: 11, formatter: (v) => `${v} Hz` },
        splitLine: { lineStyle: { color: '#F2F4F7' } },
      },
      // 显式在 series 顶层设置 color,作为 tooltip/交互 marker 的颜色,与曲线颜色保持一致
      color: keys.map(k => COLORS[k]),
      series: keys.map(k => ({
        name: k.toUpperCase(),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        color: COLORS[k],
        lineStyle: { color: COLORS[k], width: k === 'f0' ? 2 : 1.5 },
        itemStyle: { color: COLORS[k] },
        markArea: TARGET_BANDS[k] ? { silent: true, data: buildMarkArea(TARGET_BANDS[k]) } : undefined,
        markLine: (k === 'f0' || k === 'f1' || k === 'f2') ? buildMarkLine(TARGET_BANDS[k], `${k.toUpperCase()} 目标`) : undefined,
        data: seriesData[k],
      })),
    })
  }

  _bindEvents() {
    this._chart.on('click', (params) => {
      // 找到最近的帧
      const t = params.value?.[0]
      if (t == null) return
      let best = null
      let bestDist = Infinity
      for (const f of this._data) {
        const d = Math.abs(f.time - t)
        if (d < bestDist) { bestDist = d; best = f }
      }
      if (best && this._onFrameClick) this._onFrameClick(best)
    })
  }

  pushFrame(frame, time) {
    if (this._batchMode) return
    this._data.push({ ...frame, time })
    this._latestTime = time

    const cutoff = time - WINDOW
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
    if (!this._batchMode) return
    const hasData = this._data.length > 1
    if (this._cursorTime < 0 || !hasData) {
      this._chart.setOption({ graphic: [] })
      return
    }

    const tStart = this._data[0].time
    const tEnd = this._data[this._data.length - 1].time
    const ratio = (this._cursorTime - tStart) / (tEnd - tStart)
    const grid = this._chart.getModel().getComponent('grid')
    if (!grid) return
    const rect = grid.coordinateSystem.getRect()
    const cx = rect.x + ratio * rect.width

    this._chart.setOption({
      graphic: [{
        type: 'line',
        shape: { x1: cx, y1: rect.y, x2: cx, y2: rect.y + rect.height },
        style: { stroke: '#E23E57', lineWidth: 2 },
        z: 100,
      }],
    })
  }

  setLiveMode() {
    this._batchMode = false
    this._data = []
    this._latestTime = 0
    this._cursorTime = -1
    this._throttled = false
    this._chart.setOption({ graphic: [] })
    this._render(false)
  }

  // 统计: 基于当前 this._data
  getStats() {
    const frames = this._data.filter(f => f.f0 != null)
    if (frames.length === 0) return { f0Mean: null, hitRate: null }
    const sum = frames.reduce((s, f) => s + f.f0, 0)
    const band = TARGET_BANDS.f0
    let hits = 0
    for (const f of frames) if (f.f0 >= band.range[0] && f.f0 <= band.range[1]) hits++
    return {
      f0Mean: sum / frames.length,
      hitRate: hits / frames.length,
      duration: frames.length > 0 ? frames[frames.length - 1].time - frames[0].time : 0,
    }
  }
}
