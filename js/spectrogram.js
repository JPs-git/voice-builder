/**
 * PowerSpectrumRenderer
 * 语谱图 (Spectrogram): 横向时间, 纵向频率, 颜色代表能量。
 *
 * 特性:
 *  - Viridis 风格渐变色 (浅色友好、色盲友好)
 *  - 实时滚动窗口 (最近 10s)
 *  - 批量文件显示完整时长
 *  - 左侧频率刻度 (0 / 1k / 2k / 3k / 4k / 5k Hz)
 *  - 底部时间刻度
 *  - 可选绘制三条共振峰目标带 (F0/F1/F2)
 */

const FREQ_MAX = 6500
const DYNAMIC_RANGE_DB = 80
const WINDOW_SECONDS = 10
const FONT_FAMILY = getComputedStyle(document.body).fontFamily || 'sans-serif'

// ---- 浅色友好色带: 浅灰(低能量) → 淡蓝 → 淡青 → 淡绿 → 淡黄 → 浅橙(高能量) ----
// 共 22 个锚点 (超过 16 级), 在 CIELAB 空间内进行线性插值,
// 相比 RGB 直接插值更符合人眼的亮度/色彩感知, 可有效避免"淡蓝→淡绿"
// 这类跨色调的硬跳变, 保证整个动态范围内视觉连续平滑.
function buildViridisLUT() {
  // sRGB 锚点 (起点与卡片底色 #FAFBFC 一致, 终点为暖橙)
  const stops = [
    [250, 251, 252], // 0 浅灰白 (卡片背景)
    [244, 249, 254], // 1 极淡蓝
    [236, 246, 254], // 2 淡蓝灰
    [227, 242, 254], // 3 淡蓝
    [217, 238, 253], // 4 浅蓝
    [207, 234, 251], // 5 明亮蓝
    [196, 230, 248], // 6 青蓝
    [184, 228, 245], // 7 淡青蓝
    [172, 228, 237], // 8 淡青
    [160, 231, 224], // 9 青绿
    [153, 235, 208], // 10 淡青绿
    [150, 240, 189], // 11 淡绿
    [161, 245, 167], // 12 嫩绿
    [188, 248, 136], // 13 黄绿
    [220, 247, 105], // 14 浅黄
    [245, 237, 74], // 15 淡黄
    [252, 224, 56], // 16 暖黄
    [253, 208, 40], // 17 橙黄
    [253, 191, 36], // 18 浅橙
    [251, 171, 40], // 19 橙
    [249, 150, 48], // 20 橙红
    [245, 125, 60], // 21 深橙 (高能量)
  ]

  // ---- sRGB ↔ linear RGB ↔ XYZ ↔ Lab 互转 ----
  function srgbToLinear(c) {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  function linearToSrgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, Math.round(v * 255)))
  }
  function rgbToLab(rgb) {
    const r = srgbToLinear(rgb[0])
    const g = srgbToLinear(rgb[1])
    const b = srgbToLinear(rgb[2])
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
    let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750)
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883
    const eps = 216 / 24389
    const k = 24389 / 27
    const fx = x > eps ? Math.cbrt(x) : (k * x + 16) / 116
    const fy = y > eps ? Math.cbrt(y) : (k * y + 16) / 116
    const fz = z > eps ? Math.cbrt(z) : (k * z + 16) / 116
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
  }
  function labToRgb(lab) {
    const [L, a, b] = lab
    const fy = (L + 16) / 116
    const fx = a / 500 + fy
    const fz = fy - b / 200
    const xr = fx * fx * fx > 216 / 24389 ? fx * fx * fx : (116 * fx - 16) / (24389 / 27)
    const yr = L > 7.9996 ? fy * fy * fy : L / (24389 / 27)
    const zr = fz * fz * fz > 216 / 24389 ? fz * fz * fz : (116 * fz - 16) / (24389 / 27)
    const x = xr * 0.95047
    const y = yr * 1.0
    const z = zr * 1.08883
    const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
    const g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
    const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
    return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(bl)]
  }

  // 将所有锚点预转为 Lab, 便于在 Lab 空间插值
  const labStops = stops.map(rgbToLab)

  const lut = new Uint8ClampedArray(256 * 4)
  const maxIdx = stops.length - 1
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * maxIdx
    const lo = Math.floor(t)
    const frac = t - lo
    const a = labStops[lo]
    const b = labStops[Math.min(lo + 1, maxIdx)]
    // Lab 空间线性插值 -> 更符合人眼感知, 避免冷/暖色硬跳变
    const lab = [
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    ]
    const rgb = labToRgb(lab)
    lut[i * 4 + 0] = rgb[0]
    lut[i * 4 + 1] = rgb[1]
    lut[i * 4 + 2] = rgb[2]
    lut[i * 4 + 3] = 255
  }
  return lut
}

export class PowerSpectrumRenderer {
  constructor(container, sampleRate = 16000) {
    this._container = container
    this._sampleRate = sampleRate
    this._freqMax = FREQ_MAX
    this._dynamicRange = DYNAMIC_RANGE_DB
    this._windowDuration = WINDOW_SECONDS

    // 主 canvas: 热图
    this._heatCanvas = document.createElement('canvas')
    this._heatCanvas.style.position = 'absolute'
    this._heatCanvas.style.inset = '0'
    this._heatCanvas.style.width = '100%'
    this._heatCanvas.style.height = '100%'
    container.appendChild(this._heatCanvas)
    this._heatCtx = this._heatCanvas.getContext('2d', { alpha: false })

    // 叠加层: 刻度 / 目标带
    this._overlayCanvas = document.createElement('canvas')
    this._overlayCanvas.style.position = 'absolute'
    this._overlayCanvas.style.inset = '0'
    this._overlayCanvas.style.width = '100%'
    this._overlayCanvas.style.height = '100%'
    this._overlayCanvas.style.pointerEvents = 'none'
    container.appendChild(this._overlayCanvas)
    this._overlayCtx = this._overlayCanvas.getContext('2d')

    this._cursorTime = -1
    this._cursorCanvas = document.createElement('canvas')
    this._cursorCanvas.style.position = 'absolute'
    this._cursorCanvas.style.inset = '0'
    this._cursorCanvas.style.width = '100%'
    this._cursorCanvas.style.height = '100%'
    this._cursorCanvas.style.pointerEvents = 'none'
    container.appendChild(this._cursorCanvas)
    this._cursorCtx = this._cursorCanvas.getContext('2d')

    this._colorMap = buildViridisLUT()
    this._frames = []
    this._throttled = false

    this._boundResize = () => this._resize()
    window.addEventListener('resize', this._boundResize)
    this._resize()
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize)
  }

  _resize() {
    const rect = this._container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))

    for (const c of [this._heatCanvas, this._overlayCanvas, this._cursorCanvas]) {
      c.width = w
      c.height = h
    }

    // padding 区 (画布像素, 已乘 dpr)
    this._padL = Math.max(Math.round(56 * dpr), Math.round(52 * dpr))
    this._padR = Math.round(8 * dpr)
    this._padT = Math.round(6 * dpr)
    this._padB = Math.round(22 * dpr)

    // 清空重绘底色
    this._heatCtx.fillStyle = '#FAFBFC'
    this._heatCtx.fillRect(0, 0, w, h)

    // 如果有数据立即重绘
    if (this._frames.length > 0) {
      this._renderAll()
    }
    this._renderOverlay()
    if (this._cursorTime >= 0) this._renderCursor()
  }

  // 绘图区几何 (内部用)
  _plotRect() {
    const w = this._heatCanvas.width
    const h = this._heatCanvas.height
    const x = this._padL
    const y = this._padT
    const pw = Math.max(1, w - this._padL - this._padR)
    const ph = Math.max(1, h - this._padT - this._padB)
    return { x, y, w: pw, h: ph, fullW: w, fullH: h }
  }

  // ---------- 颜色映射 ----------
  _dbToIndex(db) {
    // 将 [-dynamicRange, 0] 映射到 [0, 255]
    const clamped = Math.max(-this._dynamicRange, Math.min(0, db))
    return Math.round(((clamped + this._dynamicRange) / this._dynamicRange) * 255)
  }

  // ---------- 热图渲染 ----------
  // 始终从 0s 到最新帧显示全量数据
  _renderAll() {
    const canvas = this._heatCanvas
    const ctx = this._heatCtx
    const { x, y, w: pw, h: ph } = this._plotRect()
    if (pw === 0 || ph === 0) return

    const frames = this._frames
    if (frames.length < 2) return

    const nyquist = this._sampleRate / 2
    const imageData = ctx.createImageData(pw, ph)
    const pixels = imageData.data

    for (let px = 0; px < pw; px++) {
      const frameIdx = Math.min(Math.floor((px / pw) * frames.length), frames.length - 1)
      const frame = frames[frameIdx]
      const mags = frame.magnitudes
      for (let py = 0; py < ph; py++) {
        const freq = this._freqMax - (py / ph) * this._freqMax
        const bin = Math.round(Math.min((freq / nyquist) * mags.length, mags.length - 1))
        const ci = this._dbToIndex(mags[bin])
        const off = (py * pw + px) * 4
        pixels[off] = this._colorMap[ci * 4]
        pixels[off + 1] = this._colorMap[ci * 4 + 1]
        pixels[off + 2] = this._colorMap[ci * 4 + 2]
        pixels[off + 3] = 255
      }
    }
    ctx.putImageData(imageData, x, y)
  }

  _renderOverlay() {
    const ctx = this._overlayCtx
    const { x: px, y: py, w: pw, h: ph, fullW, fullH } = this._plotRect()
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, fullW, fullH)

    // 频率刻度 (左侧 padding 区)
    const freqTicks = [0, 1000, 2000, 3000, 4000, 5000, 6000]
    ctx.fillStyle = '#667085'
    ctx.font = `${Math.round(11 * dpr)}px ${FONT_FAMILY}`
    ctx.textAlign = 'left'

    ctx.strokeStyle = 'rgba(160,170,180,0.35)'
    ctx.lineWidth = Math.max(1, Math.round(dpr * 0.75))

    const tickEndX = px

    for (const f of freqTicks) {
      const y = py + Math.round((1 - f / this._freqMax) * ph)
      // 小刻度线: 从左 padding 区末端向左伸出 8px
      ctx.beginPath()
      ctx.moveTo(px - Math.round(8 * dpr), y)
      ctx.lineTo(tickEndX, y)
      ctx.stroke()
      // 文字: 在 padding 区内右对齐, 与刻度线右端留出 4px 间距, 纵向 middle
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'right'
      ctx.fillText(`${f} Hz`, px - Math.round(12 * dpr), y)
    }
  }

  setCursorTime(time) {
    this._cursorTime = time
    this._renderCursor()
  }

  _renderCursor() {
    const ctx = this._cursorCtx
    const { x, y, w: pw, h: ph, fullW, fullH } = this._plotRect()
    ctx.clearRect(0, 0, fullW, fullH)
    if (this._cursorTime < 0 || this._frames.length < 2) return

    const tStart = this._frames[0].time
    const tEnd = this._frames[this._frames.length - 1].time
    const ratio = (this._cursorTime - tStart) / (tEnd - tStart)
    const dpr = window.devicePixelRatio || 1
    const cx = Math.round(x + ratio * pw)

    ctx.strokeStyle = '#E23E57'
    ctx.lineWidth = Math.max(1, Math.round(dpr * 1.5))
    ctx.beginPath()
    ctx.moveTo(cx, y)
    ctx.lineTo(cx, y + ph)
    ctx.stroke()
  }

  // ---------- 公共 API ----------
  pushFrame(magnitudes, time) {
    if (!magnitudes || magnitudes.length === 0) return
    this._frames.push({ magnitudes, time })

    if (!this._throttled) {
      this._throttled = true
      requestAnimationFrame(() => {
        this._renderAll()
        this._renderOverlay()
        this._throttled = false
      })
    }
  }

  displayAll(frames) {
    this._frames = frames
    this._renderAll()
    this._renderOverlay()
  }

  clear() {
    this._frames = []
    const ctx = this._heatCtx
    ctx.fillStyle = '#FAFBFC'
    ctx.fillRect(0, 0, this._heatCanvas.width, this._heatCanvas.height)
    this._renderOverlay()
  }
}

