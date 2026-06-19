# 伪声训练软件 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Web 端实时声谱图 + 共振峰分析工具 MVP

**Architecture:** Vanilla JS 单页应用，Canvas 2D 渲染。AudioEngine 管理麦克风输入和 FFT 数据，LPC 模块手动提取 F0–F4 共振峰，两个独立的 Canvas Renderer 分别在上下面板绘制声谱图和共振峰折线图。暂停模式支持图谱冻结和点击查询。

**Tech Stack:** Vanilla JS, Web Audio API, SoundTouchJS (autocorrelate/levinsonDurbin 基元), Canvas 2D

---

### Task 1: 项目脚手架

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>伪声训练器</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <div class="panel panel-spectrogram">
      <canvas id="spectrogram"></canvas>
    </div>
    <div class="panel panel-formants">
      <canvas id="formantChart"></canvas>
      <div id="formantValues">
        <span class="f0">F0: -- Hz</span>
        <span class="f1">F1: -- Hz</span>
        <span class="f2">F2: -- Hz</span>
        <span class="f3">F3: -- Hz</span>
        <span class="f4">F4: -- Hz</span>
      </div>
    </div>
    <div id="controls">
      <button id="btnPause">暂停</button>
    </div>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 css/style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #111; color: #ccc; font-family: 'Courier New', monospace; overflow: hidden; height: 100vh; }

#app { display: flex; flex-direction: column; height: 100vh; }

.panel { position: relative; flex: 1; min-height: 0; border-bottom: 1px solid #333; }
.panel canvas { display: block; width: 100%; height: 100%; }

#formantValues {
  position: absolute; left: 8px; top: 8px;
  display: flex; flex-direction: column; gap: 2px;
  font-size: 12px; pointer-events: none; z-index: 10;
}
#formantValues .f0 { color: rgba(255,255,255,0.6); }
#formantValues .f1 { color: #ff4444; }
#formantValues .f2 { color: #4488ff; }
#formantValues .f3 { color: #44cc44; }
#formantValues .f4 { color: #ff8844; }

#controls { position: fixed; bottom: 12px; right: 12px; z-index: 20; }
#controls button {
  background: #333; color: #ccc; border: 1px solid #555;
  padding: 6px 16px; font-family: inherit; font-size: 13px; cursor: pointer;
}
#controls button:hover { background: #444; }
```

- [ ] **Step 3: 创建目录结构**

```bash
mkdir -p js css
```

---

### Task 2: AudioEngine 模块

**Files:**
- Create: `js/audio-engine.js`
- Test: `js/__tests__/audio-engine.test.js` (可选，未配置测试框架时可跳过)

- [ ] **Step 1: 实现 AudioEngine 类**

```javascript
// js/audio-engine.js

export class AudioEngine {
  constructor() {
    this.audioContext = null
    this.stream = null
    this.source = null
    this.analyser = null
    this.running = false
    this.ringBuffer = []       // Float32Array 块，每块 ~1024 采样
    this.maxDuration = 60      // 1 分钟
    this.sampleRate = 44100
    this.fftSize = 1024
    this.onSpectrumFrame = null // callback(magnitudes: Float32Array, time: number)
    this.onFormantFrame = null  // callback(formants: object, time: number)
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.analyser.smoothingTimeConstant = 0.8
    this.source.connect(this.analyser)
    this.running = true
    this._startPolling()
  }

  stop() {
    this.running = false
    this.stream?.getTracks().forEach(t => t.stop())
    this.audioContext?.close()
  }

  _startPolling() {
    const buffer = new Float32Array(this.analyser.frequencyBinCount)
    const read = () => {
      if (!this.running) return
      this.analyser.getFloatFrequencyData(buffer)
      const time = this.audioContext.currentTime
      this.ringBuffer.push({ data: new Float32Array(buffer), time })
      // 裁剪超过 1 分钟的旧数据
      const cutoff = time - this.maxDuration
      while (this.ringBuffer.length > 0 && this.ringBuffer[0].time < cutoff) {
        this.ringBuffer.shift()
      }
      this.onSpectrumFrame?.(new Float32Array(buffer), time)
      requestAnimationFrame(read)
    }
    read()
  }

  getRecordedBuffer() {
    // 返回完整的 1min 环形缓冲区用于回放
    const duration = Math.min(this.maxDuration, this.ringBuffer.length > 0
      ? this.ringBuffer[this.ringBuffer.length - 1].time - this.ringBuffer[0].time
      : 0)
    const length = Math.floor(duration * this.sampleRate)
    const pcm = new Float32Array(length)
    // 将 ringBuffer 中的块拼接为连续 PCM
    let offset = 0
    for (const chunk of this.ringBuffer) {
      // chunk.data 是频谱幅值，不是 PCM。用于回放需要单独保存 PCM 数据
    }
    return { pcm, sampleRate: this.sampleRate, chunks: this.ringBuffer }
  }
}
```

- [ ] **Step 2: 保存 PCM 数据用于回放**

修改 AudioEngine，在 `_startPolling` 中同时保存原始 PCM 数据。

```javascript
// 在 constructor 中增加
this.pcmRingBuffer = []  // { samples: Float32Array, time: number }
this.chunkSize = 1024

// 在 _startPolling 之前创建 ScriptProcessorNode 或 AudioWorklet 来获取 PCM
// 简单方案：使用 createScriptProcessor
```

由于 `ScriptProcessorNode` 已弃用但可用，或直接用 `AudioWorklet` 更复杂。MVP 阶段可以使用 `createScriptProcessor`：

```javascript
_startPCMCapture() {
  const processor = this.audioContext.createScriptProcessor(this.chunkSize, 1, 1)
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const time = this.audioContext.currentTime
    this.pcmRingBuffer.push({ samples: new Float32Array(input), time })
    const cutoff = time - this.maxDuration
    while (this.pcmRingBuffer.length > 0 && this.pcmRingBuffer[0].time < cutoff) {
      this.pcmRingBuffer.shift()
    }
  }
  this.source.connect(processor)
  processor.connect(this.audioContext.destination)
}
```

- [ ] **Step 3: 整合完整 AudioEngine**

最终 `js/audio-engine.js` 导出 `AudioEngine` 类，暴露：
- `start()` → Promise
- `stop()`
- `pause()` / `resume()` — 暂停/恢复麦克风输入
- `getPCMBuffer()` → Float32Array（完整的 1min PCM 数据）
- `currentTime` — 当前录音时间
- `onSpectrumFrame`, `onFormantFrame` 回调

---

### Task 3: SpectrogramRenderer 模块

**Files:**
- Create: `js/spectrogram.js`

- [ ] **Step 1: 实现 SpectrogramRenderer 类**

```javascript
// js/spectrogram.js

export class SpectrogramRenderer {
  constructor(canvas, sampleRate = 44100) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.sampleRate = sampleRate
    this.freqMax = 5000
    this.dynamicRange = 80  // dB
    this.pixelsPerColumn = 1
    this._initColorMap()
    this._resize()
    window.addEventListener('resize', () => this._resize())
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect()
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = this.width * devicePixelRatio
    this.canvas.height = this.height * devicePixelRatio
    this.ctx.scale(devicePixelRatio, devicePixelRatio)
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    // 清空为黑色
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, this.height)
    this.scrollX = this.width - 1
  }

  _initColorMap() {
    this.colorMap = new Uint8Array(256 * 4)
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      // 深蓝(0,0,30) → 蓝(0,0,200) → 青(0,200,200) → 黄(200,200,0) → 红(200,0,0)
      let r, g, b
      if (t < 0.25) { r = 0; g = 0; b = 30 + t * 680 }
      else if (t < 0.5) { r = 0; g = (t - 0.25) * 800; b = 200 }
      else if (t < 0.75) { r = (t - 0.5) * 800; g = 200; b = 200 - (t - 0.5) * 800 }
      else { r = 200; g = 200 - (t - 0.75) * 800; b = 0 }
      this.colorMap[i * 4] = Math.min(r, 255)
      this.colorMap[i * 4 + 1] = Math.min(g, 255)
      this.colorMap[i * 4 + 2] = Math.min(b, 255)
      this.colorMap[i * 4 + 3] = 255
    }
  }

  pushFrame(magnitudes, time) {
    // magnitudes: Float32Array (长度 = fftSize/2)
    // 映射到 Canvas 高度
    const binsPerPixel = (magnitudes.length / (this.freqMax / (this.sampleRate / 2)))
    const imageData = this.ctx.createImageData(1, this.height)
    for (let y = 0; y < this.height; y++) {
      const freq = (y / this.height) * this.freqMax
      const binIndex = Math.floor((freq / (this.sampleRate / 2)) * magnitudes.length)
      if (binIndex >= magnitudes.length) { continue }
      const dB = magnitudes[binIndex]
      const normalized = Math.max(0, Math.min(1, (dB + this.dynamicRange) / this.dynamicRange))
      const colorIdx = Math.floor(normalized * 255)
      const offset = y * 4
      imageData.data[offset] = this.colorMap[colorIdx * 4]
      imageData.data[offset + 1] = this.colorMap[colorIdx * 4 + 1]
      imageData.data[offset + 2] = this.colorMap[colorIdx * 4 + 2]
      imageData.data[offset + 3] = 255
    }
    // 将 Canvas 左移一列
    this.ctx.drawImage(this.canvas, 1, 0, this.width - 1, this.height, 0, 0, this.width - 1, this.height)
    // 在右侧绘制新列
    this.ctx.putImageData(imageData, this.width - 1, 0)
  }

  clear() {
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, this.height)
    this.scrollX = this.width - 1
  }
}
```

- [ ] **Step 2: 验证渲染逻辑**

确认：
- `pushFrame` 接受 `AnalyserNode.getFloatFrequencyData()` 的输出（单位 dB，范围通常 -100 到 0）
- 频率映射：假设 `sampleRate = 44100`，`fftSize = 1024`，`frequencyBinCount = 512`，`magnitudes[0]` 对应 0Hz，`magnitudes[511]` 对应 22050Hz。因此 `freqMax = 5000` 对应约第 116 个 bin。
- 颜色映射使用预计算的 LUT，避免每帧重复计算。

---

### Task 4: FormantChartRenderer 模块

**Files:**
- Create: `js/formant-chart.js`

- [ ] **Step 1: 实现 FormantChartRenderer 类**

```javascript
// js/formant-chart.js

export class FormantChartRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.freqMax = 5000
    this.pixelsPerColumn = 1
    this.data = []  // { time, f0, f1, f2, f3, f4 }
    this._resize()
    window.addEventListener('resize', () => this._resize())
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect()
    this.width = rect.width
    this.height = rect.height
    this.canvas.width = this.width * devicePixelRatio
    this.canvas.height = this.height * devicePixelRatio
    this.ctx.scale(devicePixelRatio, devicePixelRatio)
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  _freqToY(freq) {
    return this.height - (freq / this.freqMax) * this.height
  }

  pushFrame(formantFrame, time) {
    this.data.push({ ...formantFrame, time })
    // 保留 3 秒窗口
    const cutoff = time - 3
    while (this.data.length > 0 && this.data[0].time < cutoff) {
      this.data.shift()
    }
    this._draw()
  }

  _draw() {
    const { ctx, width, height } = this
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, width, height)

    // 画网格
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 0.5
    for (let hz = 0; hz <= this.freqMax; hz += 1000) {
      const y = this._freqToY(hz)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }

    const formants = [
      { key: 'f0', color: 'rgba(255,255,255,0.4)', style: [4, 3] },
      { key: 'f1', color: '#ff4444', style: [] },
      { key: 'f2', color: '#4488ff', style: [] },
      { key: 'f3', color: '#44cc44', style: [] },
      { key: 'f4', color: '#ff8844', style: [] },
    ]

    for (const fmt of formants) {
      ctx.strokeStyle = fmt.color
      ctx.lineWidth = 1.5
      if (fmt.style.length) ctx.setLineDash(fmt.style)
      else ctx.setLineDash([])

      ctx.beginPath()
      let started = false
      for (let i = 0; i < this.data.length; i++) {
        const val = this.data[i][fmt.key]
        if (val === null || val === undefined) { started = false; continue }
        const x = (i / this.data.length) * width
        const y = this._freqToY(val)
        if (!started) { ctx.moveTo(x, y); started = true }
        else { ctx.lineTo(x, y) }
      }
      ctx.stroke()
    }
  }

  clear() {
    this.data = []
    this.ctx.fillStyle = '#111'
    this.ctx.fillRect(0, 0, this.width, this.height)
  }
}
```

- [ ] **Step 2: 添加 Y 轴标签**

在 `_draw()` 末尾添加刻度文字：

```javascript
ctx.fillStyle = '#555'
ctx.font = '10px monospace'
for (let hz = 0; hz <= this.freqMax; hz += 1000) {
  const y = this._freqToY(hz)
  ctx.fillText(hz + 'Hz', 4, y - 2)
}
```

---

### Task 5: LPC 共振峰提取模块

**Files:**
- Create: `js/lpc.js`

手动实现 Burg LPC + 求根得到 F0–F4。使用 SoundTouchJS 的 `autocorrelate`/`levinsonDurbin` 基元减少工作量。

- [ ] **Step 1: 安装依赖**

```bash
npm init -y
npm install @soundtouchjs/worklet-base
```

- [ ] **Step 2: 实现 LPC 模块 — 自相关 + Levinson-Durbin + Laguerre 求根**

```javascript
// js/lpc.js

// 自相关 (SoundTouchJS 风格)
export function autocorrelate(signal, order) {
  const N = signal.length
  const r = new Float64Array(order + 1)
  for (let k = 0; k <= order; k++) {
    let sum = 0
    for (let i = 0; i < N - k; i++) {
      sum += signal[i] * signal[i + k]
    }
    r[k] = sum
  }
  return r
}

// Levinson-Durbin 递归 → LPC 系数
export function levinsonDurbin(r, order) {
  const a = new Float64Array(order + 1)
  const e = new Float64Array(order + 1)
  a[0] = 1
  e[0] = r[0]
  for (let i = 1; i <= order; i++) {
    let k = -r[i]
    for (let j = 1; j < i; j++) k -= a[j] * r[i - j]
    k /= e[i - 1]
    const aNext = new Float64Array(a)
    aNext[i] = k
    for (let j = 1; j < i; j++) aNext[j] = a[j] + k * a[i - j]
    for (let j = 0; j <= i; j++) a[j] = aNext[j]
    e[i] = e[i - 1] * (1 - k * k)
  }
  return a  // 长度 order+1, a[0]=1
}

// Laguerre 法求多项式根
function laguerre(coeffs, initialGuess, maxIter = 100, tol = 1e-10) {
  const n = coeffs.length - 1
  let x = initialGuess
  for (let iter = 0; iter < maxIter; iter++) {
    let p = coeffs[n]
    let pp = 0
    for (let i = n - 1; i >= 0; i--) { pp = pp * x + p; p = p * x + coeffs[i] }
    if (Math.abs(p) < tol) break
    const G = pp / p
    const H = G * G - (pp * pp / (p * p)) - (pp / p * pp / p) // 简化
    // 完整 Laguerre 公式
    const denom = n / (G + Math.sign(Math.abs(G) > 1e-10 ? G : 1) * Math.sqrt(Math.abs((n - 1) * (n * H - G * G))))
    x -= denom
  }
  return x
}

// 从 LPC 系数求所有根
function findRoots(lpcCoeffs) {
  const order = lpcCoeffs.length - 1
  const roots = []
  // Companion matrix QR 或直接 Laguerre 逐根提取
  // 简化：使用 Laguerre 配合 deflation
  let coeffs = [...lpcCoeffs]
  for (let i = 0; i < order; i++) {
    const guess = Math.exp(2 * Math.PI * i / order * 1j)  // 复数单位圆初始
    const root = laguerre(coeffs, guess)
    roots.push(root)
    // 多项式降阶 (deflation)
    const newCoeffs = new Array(coeffs.length - 1).fill(0)
    for (let j = coeffs.length - 1; j >= 1; j--) {
      newCoeffs[j - 1] = coeffs[j] + root * (newCoeffs[j] || 0)
    }
    coeffs = newCoeffs
  }
  return roots
}

// 从根提取共振峰
export function rootsToFormants(roots, sampleRate) {
  const formants = []
  for (const r of roots) {
    const real = r.real, imag = r.imag
    if (Math.abs(r) < 0.99 || imag < 0) continue  // 只取单位圆附近的上半平面根
    const freq = Math.abs(Math.atan2(imag, real)) * sampleRate / (2 * Math.PI)
    if (freq < 50 || freq > 5000) continue
    const bw = -Math.log(Math.abs(r)) * sampleRate / Math.PI
    formants.push({ freq, bw })
  }
  formants.sort((a, b) => a.freq - b.freq)
  return formants
}

// 自相关法音高检测
export function detectPitch(signal, sampleRate) {
  const minFreq = 60, maxFreq = 500
  const minPeriod = Math.floor(sampleRate / maxFreq)
  const maxPeriod = Math.floor(sampleRate / minFreq)
  const r = autocorrelate(signal, maxPeriod)
  let bestOffset = -1, bestCorr = 0
  for (let offset = minPeriod; offset <= maxPeriod; offset++) {
    if (r[offset] > bestCorr) { bestCorr = r[offset]; bestOffset = offset }
  }
  return bestOffset > 0 && bestCorr > r[0] * 0.3 ? sampleRate / bestOffset : null
}

// 主入口
export function extractFormants(signal, sampleRate, maxFormants = 5) {
  const order = maxFormants * 2  // 10 阶 LPC
  const r = autocorrelate(signal, order)
  const coeffs = levinsonDurbin(r, order)
  const roots = findRoots(coeffs)
  const formants = rootsToFormants(roots, sampleRate)
  const f0 = detectPitch(signal, sampleRate)
  return { f0, formants }
}
```

- [ ] **Step 3: 处理复数运算**

由于 JavaScript 没有内置复数类型，Laguerre 需要复数运算。两种选择：
- **方案 A**: 手动实现复数类（`{re, im}`）约 50 行
- **方案 B**: 使用 `mathjs` 库

推荐方案 A：`mathjs` 打包体积太大（~500KB），手动 50 行即可。

```javascript
// js/complex.js
export class Complex {
  constructor(re, im) { this.re = re; this.im = im }
  add(c) { return new Complex(this.re + c.re, this.im + c.im) }
  sub(c) { return new Complex(this.re - c.re, this.im - c.im) }
  mul(c) {
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re
    )
  }
  div(c) {
    const d = c.re * c.re + c.im * c.im
    return new Complex(
      (this.re * c.re + this.im * c.im) / d,
      (this.im * c.re - this.re * c.im) / d
    )
  }
  abs() { return Math.sqrt(this.re * this.re + this.im * this.im) }
  conj() { return new Complex(this.re, -this.im) }
  exp() { const e = Math.exp(this.re); return new Complex(e * Math.cos(this.im), e * Math.sin(this.im)) }
  static fromAngle(theta) { return new Complex(Math.cos(theta), Math.sin(theta)) }
}
```

将 `lpc.js` 中的 Laguerre 实现改为使用 `Complex` 类。

- [ ] **Step 4: 验证 LPC 精度**

使用已知共振峰的人工信号测试：

```javascript
// 测试：生成 500Hz + 1500Hz + 2500Hz 的合成信号
const sampleRate = 44100
const t = Array.from({length: 512}, (_, i) => i / sampleRate)
const signal = t.map(ti => 
  Math.sin(2 * Math.PI * 500 * ti) +
  Math.sin(2 * Math.PI * 1500 * ti) * 0.5 +
  Math.sin(2 * Math.PI * 2500 * ti) * 0.3
)
const result = extractFormants(new Float32Array(signal), sampleRate)
console.log('F0:', result.f0)  // 应为 null (无周期)
console.log('Formants:', result.formants.map(f => f.freq.toFixed(0)))
```

---

---

### Task 6: FormantProcessor — 桥接 LPC 到渲染管线

**Files:**
- Create: `js/formant-processor.js`

AudioEngine 通过 ScriptProcessorNode 捕获 PCM 块，送入 LPC 模块分析，输出 F0–F4 帧。

- [ ] **Step 1: 实现 FormantProcessor**

```javascript
// js/formant-processor.js
import { extractFormants } from './lpc.js'

export class FormantProcessor {
  constructor(audioContext) {
    this.audioContext = audioContext
    this.processor = null
    this.source = null
    this.onFrame = null  // callback({ f0, f1, f2, f3, f4 }, time)
    this.windowSize = 512
  }

  start(mediaStream) {
    this.source = this.audioContext.createMediaStreamSource(mediaStream)
    this.processor = this.audioContext.createScriptProcessor(this.windowSize, 1, 1)
    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const time = this.audioContext.currentTime
      const result = extractFormants(input, this.audioContext.sampleRate)
      if (!this.onFrame) return
      const f = result.formants
      this.onFrame({
        f0: result.f0,
        f1: f[0]?.freq ?? null,
        f2: f[1]?.freq ?? null,
        f3: f[2]?.freq ?? null,
        f4: f[3]?.freq ?? null,
      }, time)
    }
    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  stop() {
    this.processor?.disconnect()
    this.source?.disconnect()
  }
}
```

- [ ] **Step 2: 验证 ScriptProcessorNode 在 AudioContext 中的连接**

确保 `processor.connect(destination)` 不会产生声音输出（在暂停模式下应该断开）。

---

### Task 7: 暂停/回放 + 时间轴点击

**Files:**
- Create: `js/playback.js`

- [ ] **Step 1: 实现 PlaybackManager**

```javascript
// js/playback.js

export class PlaybackManager {
  constructor(audioEngine, spectrogramRenderer, formantChartRenderer) {
    this.audioEngine = audioEngine
    this.spectrogram = spectrogramRenderer
    this.formantChart = formantChartRenderer
    this.paused = false
    this.clickCallback = null  // (time) => F0-F4 values at that time
  }

  pause() {
    this.paused = true
    this.audioEngine.stop()
    // 图谱冻结（不再 push 新帧）
  }

  resume() {
    this.paused = false
    this.audioEngine.start()
  }

  enableClickInspect() {
    // 在暂停模式下，点击 formantChart Canvas 查询该时刻的 F0-F4
    this.formantChart.canvas.addEventListener('click', (e) => {
      if (!this.paused) return
      const rect = this.formantChart.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      const data = this.formantChart.data
      if (data.length === 0) return
      const idx = Math.floor(ratio * data.length)
      const frame = data[idx]
      if (frame && this.clickCallback) {
        this.clickCallback(frame, x)
      }
    })
  }
}
```

- [ ] **Step 2: 实现时间轴辅助线 + 数值标注**

在暂停模式下点击 Canvas 时，画一条竖直辅助线并显示数值弹窗：

```javascript
// 在 FormantChartRenderer 中添加方法
showVerticalLine(x, frame) {
  const ctx = this.ctx
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, this.height)
  ctx.stroke()
  ctx.setLineDash([])

  // 在辅助线顶部显示数值
  ctx.fillStyle = '#fff'
  ctx.font = '11px monospace'
  let y = 14
  for (const k of ['f0','f1','f2','f3','f4']) {
    const val = frame[k]
    if (val != null) {
      ctx.fillText(`${k.toUpperCase()}: ${val.toFixed(0)}Hz`, x + 6, y)
    }
    y += 14
  }
}
```

---

### Task 8: 集成测试 + 联调

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: 串联所有模块**

确保 `main.js` 正确初始化所有模块并建立数据流。

```javascript
// js/main.js (最终整合)
import { AudioEngine } from './audio-engine.js'
import { SpectrogramRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { FormantProcessor } from './formant-processor.js'
import { SpectrogramRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'

const audioEngine = new AudioEngine()
const spectrogram = new SpectrogramRenderer(document.getElementById('spectrogram'))
const formantChart = new FormantChartRenderer(document.getElementById('formantChart'))
const btnPause = document.getElementById('btnPause')

let formantProcessor
let paused = false

audioEngine.onSpectrumFrame = (mags, t) => { if (!paused) spectrogram.pushFrame(mags, t) }

async function init() {
  await audioEngine.start()
  formantProcessor = new FormantProcessor(audioEngine.audioContext)
  formantProcessor.onFrame = (f, t) => {
    if (!paused) {
      formantChart.pushFrame(f, t)
      updateLabels(f)
    }
  }
  formantProcessor.start(audioEngine.stream)
}

function updateLabels(f) {
  const set = (id, val) => {
    document.getElementById(id).textContent = val != null ? val.toFixed(0) + ' Hz' : '-- Hz'
  }
  set('f0Label', f.f0)
  set('f1Label', f.f1)
  set('f2Label', f.f2)
  set('f3Label', f.f3)
  set('f4Label', f.f4)
}

btnPause.addEventListener('click', () => {
  paused = !paused
  btnPause.textContent = paused ? '继续' : '暂停'
  if (paused) audioEngine.stop()
  else audioEngine.start()
})

init().catch(console.error)
```

- [ ] **Step 2: 浏览器测试**

```bash
# 使用任意静态服务器
npx serve .
```

打开 `http://localhost:3000`，允许麦克风权限，对着麦克风说话，观察图谱是否实时更新。点击暂停看图谱冻结。

实施细节（展开或引用已知的 LPC 实现，如 SoundTouchJS 的 `autocorrelate` 和 `levinsonDurbin`）。
