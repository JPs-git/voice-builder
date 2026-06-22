const FREQ_MAX = 5000
const DYNAMIC_RANGE = 80
const WINDOW = 10

export class PowerSpectrumRenderer {
  constructor(container, sampleRate = 16000) {
    this._container = container
    this._sampleRate = sampleRate
    this._freqMax = FREQ_MAX
    this._dynamicRange = DYNAMIC_RANGE
    this._windowDuration = WINDOW

    this._canvas = document.createElement('canvas')
    this._canvas.style.display = 'block'
    this._canvas.style.width = '100%'
    this._canvas.style.height = '100%'
    container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')

    this._frames = []
    this._throttled = false

    this._precomputeColorMap()
    this._resize()

    this._boundResize = () => this._resize()
    window.addEventListener('resize', this._boundResize)
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize)
  }

  _precomputeColorMap() {
    this._colorMap = new Uint8Array(256 * 4)
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      let r, g, b
      if (t < 0.25) {
        const t2 = t / 0.25
        r = 0; g = 0; b = 30 + t2 * 170
      } else if (t < 0.50) {
        const t2 = (t - 0.25) / 0.25
        r = 0; g = t2 * 200; b = 200
      } else if (t < 0.75) {
        const t2 = (t - 0.50) / 0.25
        r = t2 * 200; g = 200; b = 200 - t2 * 200
      } else {
        const t2 = (t - 0.75) / 0.25
        r = 200; g = 200 - t2 * 200; b = 0
      }
      const off = i * 4
      this._colorMap[off] = r
      this._colorMap[off + 1] = g
      this._colorMap[off + 2] = b
      this._colorMap[off + 3] = 255
    }
  }

  _resize() {
    const rect = this._container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(rect.width * dpr)
    const h = Math.round(rect.height * dpr)
    this._canvas.width = w
    this._canvas.height = h
    this._canvas.style.width = rect.width + 'px'
    this._canvas.style.height = rect.height + 'px'
    this._ctx.fillStyle = '#000'
    this._ctx.fillRect(0, 0, w, h)
  }

  _renderWindow(frames, windowStart, windowDuration) {
    const w = this._canvas.width
    const h = this._canvas.height
    if (w === 0 || h === 0) return

    const binCount = frames[0].magnitudes.length
    const nyquist = this._sampleRate / 2

    const imageData = this._ctx.createImageData(w, h)
    const pixels = imageData.data

    let frameIdx = 0
    for (let x = 0; x < w; x++) {
      const colTime = windowStart + (x / w) * windowDuration

      while (frameIdx + 1 < frames.length && frames[frameIdx + 1].time <= colTime) {
        frameIdx++
      }

      const frameA = frames[frameIdx]
      const frameB = frameIdx + 1 < frames.length ? frames[frameIdx + 1] : frameA
      const dt = frameB.time - frameA.time
      const interpT = dt > 0 ? Math.max(0, Math.min(1, (colTime - frameA.time) / dt)) : 0

      for (let y = 0; y < h; y++) {
        const freq = this._freqMax - (y / h) * this._freqMax
        const bin = Math.round(Math.min((freq / nyquist) * binCount, binCount - 1))
        const db = frameA.magnitudes[bin] + interpT * (frameB.magnitudes[bin] - frameA.magnitudes[bin])
        const t = Math.max(0, Math.min(1, (db + this._dynamicRange) / this._dynamicRange))
        const ci = Math.round(t * 255)
        const off = (y * w + x) * 4
        pixels[off] = this._colorMap[ci * 4]
        pixels[off + 1] = this._colorMap[ci * 4 + 1]
        pixels[off + 2] = this._colorMap[ci * 4 + 2]
        pixels[off + 3] = 255
      }
    }

    this._ctx.putImageData(imageData, 0, 0)
  }

  _render() {
    const frames = this._frames
    if (frames.length === 0) return

    const currentTime = frames[frames.length - 1].time
    this._renderWindow(frames, currentTime - this._windowDuration, this._windowDuration)
  }

  pushFrame(magnitudes, time) {
    if (!magnitudes || magnitudes.length === 0) return

    this._frames.push({ magnitudes, time })
    const cutoff = time - this._windowDuration
    while (this._frames.length > 0 && this._frames[0].time < cutoff) {
      this._frames.shift()
    }

    if (!this._throttled) {
      this._throttled = true
      requestAnimationFrame(() => {
        this._render()
        this._throttled = false
      })
    }
  }

  displayAll(frames) {
    this._frames = frames
    if (frames.length === 0) return

    const minTime = frames[0].time
    const maxTime = frames[frames.length - 1].time
    const duration = Math.max(maxTime - minTime, 1)
    this._renderWindow(frames, minTime, duration)
  }

  clear() {
    this._frames = []
    this._ctx.fillStyle = '#000'
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height)
  }
}
