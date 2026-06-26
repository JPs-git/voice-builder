import { AudioEngine } from './audio-engine.js'
import { AnalysisPipeline } from './analysis-pipeline.js'
import { PowerSpectrumRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { parseWav } from './wav-parser.js'
import { PlaybackManager } from './playback.js'
import { Resampler } from './resampler.js'

/**
 * 伪声训练器 · UI 主入口
 *
 * 负责:
 *  - 顶栏按钮(开始录音 / 导入 WAV / 清空 / 帮助) 的点击逻辑
 *  - 录音状态机 (idle → requesting → recording → stopped)
 *  - 常驻引导条的显示/关闭 (localStorage 记忆)
 *  - 帮助抽屉的显示/隐藏
 *  - 共振峰图例切换显示/隐藏
 *  - 状态栏数值 & 录音时长 & 统计卡片的实时更新
 */

// ---- DOM 引用 ----
const $ = (sel) => document.querySelector(sel)
const spectrumContainer = $('#powerSpectrum')
const formantContainer = $('#formantChart')
const btnRecord = $('#btnRecord')
const btnImport = $('#btnImport')
const btnClear = $('#btnClear')
const btnConfig = $('#btnConfig')
const btnHelp = $('#btnHelp')
const wavInput = $('#wavInput')
const spectrumEmpty = $('#spectrumEmpty')
const formantEmpty = $('#formantEmpty')
const configDrawer = $('#configDrawer')
const helpDrawer = $('#helpDrawer')
let formantMethod = 'hybrid'
let formantSmoothing = true
const btnPlayback = $('#btnPlayback')

// ---- 业务对象 ----
const audioEngine = new AudioEngine()
const spectrum = new PowerSpectrumRenderer(spectrumContainer)
const formantChart = new FormantChartRenderer(formantContainer)

// ---- 目标带预设 ----
// 各目标值参考:女性普通话元音 / 语音学教材常用区间的折中值
const PRESETS = {
  balanced: { label: '综合训练', f0: [180, 250], f1: [400, 700], f2: [1500, 2300] },
  'vowel-a': { label: '元音 a', f0: [200, 260], f1: [800, 1100], f2: [1200, 1500] },
  'vowel-o': { label: '元音 o', f0: [190, 250], f1: [500, 750], f2: [900, 1100] },
  'vowel-e': { label: '元音 e', f0: [190, 250], f1: [500, 800], f2: [1700, 2200] },
  'vowel-i': { label: '元音 i', f0: [200, 260], f1: [250, 450], f2: [2100, 2800] },
  'vowel-u': { label: '元音 u', f0: [190, 250], f1: [280, 500], f2: [700, 900] },
  'vowel-yu': { label: '元音 ü', f0: [190, 260], f1: [300, 500], f2: [1200, 1800] },
}

// 配置栏 DOM 引用
const presetSelect = $('#presetSelect')
const vowelButtons = document.querySelectorAll('.vowel-btn')
const bandInputs = document.querySelectorAll('.band-input')

// 应用某个预设
function applyPreset(name) {
  const preset = PRESETS[name]
  if (!preset) return
  formantChart.setTargetBands({
    f0: preset.f0,
    f1: preset.f1,
    f2: preset.f2,
  })
  // 同步输入框
  for (const wrap of bandInputs) {
    const key = wrap.dataset.band
    const rng = preset[key]
    if (!rng) continue
    wrap.querySelector('.band-lo').value = Math.round(rng[0])
    wrap.querySelector('.band-hi').value = Math.round(rng[1])
  }
  // 高亮:下拉框 + 元音卡片
  if (presetSelect) {
    const opt = [...presetSelect.options].find(o => o.value === name)
    if (opt) presetSelect.value = name
  }
  for (const btn of vowelButtons) {
    btn.classList.toggle('is-active', btn.dataset.preset === name)
  }
}

// 应用输入框中的当前值（三对一起提交）
function applyCustomFromInputs() {
  const bands = {}
  let anyValid = false
  for (const wrap of bandInputs) {
    const key = wrap.dataset.band
    const lo = parseFloat(wrap.querySelector('.band-lo').value)
    const hi = parseFloat(wrap.querySelector('.band-hi').value)
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) continue
    bands[key] = [lo, hi]
    anyValid = true
  }
  if (!anyValid) { console.warn('所有目标区间输入无效（下限 ≥ 上限或无法解析）'); return }
  formantChart.setTargetBands(bands)
  // 下拉框切到"自定义"
  if (presetSelect) presetSelect.value = 'custom'
  for (const btn of vowelButtons) btn.classList.remove('is-active')
}

// ---- 状态 ----
const STATE = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  RECORDING: 'recording',
  PAUSED: 'paused',
  ANALYZING: 'analyzing',
}
let state = STATE.IDLE
let livePipeline = null
let sessionFrames = []
let playbackManager = null
let totalFrames = 0

// ---- 工具 ----
function fmtHz(v) { return v == null ? '-- Hz' : `${Math.round(v)} Hz` }

function setEmptyVisible(visible) {
  if (spectrumEmpty) spectrumEmpty.classList.toggle('hidden', !visible)
  if (formantEmpty) formantEmpty.classList.toggle('hidden', !visible)
}

// ---- 状态切换 ----
function setState(next) {
  state = next
  if (btnRecord) {
    btnRecord.classList.toggle('is-recording', next === STATE.RECORDING)
    const label = btnRecord.querySelector('.btn-label')
    if (label) {
      if (next === STATE.REQUESTING) label.textContent = '麦克风授权中…'
      else if (next === STATE.RECORDING) label.textContent = '停止录音'
      else if (next === STATE.PAUSED) label.textContent = '继续录音'
      else label.textContent = '开始录音'
    }
    btnRecord.disabled = next === STATE.REQUESTING
  }
  if (btnPlayback) {
    if (next === STATE.PAUSED) {
      btnPlayback.disabled = false
      const label = btnPlayback.querySelector('.btn-label')
      if (label) label.textContent = '回放'
    } else {
      btnPlayback.disabled = true
    }
  }
}

function startNewRecording() {
  if (livePipeline) { livePipeline.reset(); livePipeline = null }
  spectrum.setLiveMode()
  formantChart.setLiveMode()
  livePipeline = new AnalysisPipeline({
    onFrame: (frame) => {
      sessionFrames.push(frame)
      spectrum.pushFrame(frame.magnitudes, frame.time)
      formantChart.pushFrame(frame, frame.time)
    },
    formantMethod,
    formantSmoothing,
    frameOffset: totalFrames,
  })
  audioEngine.startStream((chunk, rate) => livePipeline.pushChunk(chunk, rate))
  setState(STATE.RECORDING)
}

// ---- 录音 ----
async function onRecordToggle() {
  if (state === STATE.RECORDING) {
    audioEngine.stopStream()
    if (livePipeline) {
      livePipeline.flush()
      totalFrames += livePipeline.frameCount
      livePipeline.reset()
      livePipeline = null
    }
    // 裁剪到最近 10s，使回放时长与录音时的可视化窗口一致
    const WINDOW_FRAMES = 1000
    if (sessionFrames.length > WINDOW_FRAMES) {
      const trimCount = sessionFrames.length - WINDOW_FRAMES
      sessionFrames.splice(0, trimCount)
      totalFrames = Math.round(sessionFrames[sessionFrames.length - 1].time / 0.01)
      audioEngine.trimBufferToDuration(10)
    }
    // 保持 live 模式，与 formantChart 行为一致，使游标在不足 10s 时对齐图谱 x 轴
    setState(STATE.PAUSED)
    return
  }

  if (state === STATE.PAUSED) {
    if (livePipeline) { livePipeline.reset(); livePipeline = null }
    startNewRecording()
    return
  }

  try {
    setState(STATE.REQUESTING)
    startNewRecording()
    setEmptyVisible(false)
  } catch (err) {
    console.error('Stream start failed:', err)
    setState(STATE.IDLE)
    if (btnRecord) {
      const label = btnRecord.querySelector('.btn-label')
      if (label) {
        const old = label.textContent
        label.textContent = '⚠ 麦克风不可用，点击重试'
        setTimeout(() => { if (state === STATE.IDLE) label.textContent = old }, 3000)
      }
    }
  }
}

// ---- 清空 ----
function clearAll() {
  if (playbackManager) playbackManager.stop()
  if (livePipeline) { livePipeline.reset(); livePipeline = null }
  audioEngine.stopPlayback()
  audioEngine.stopStream()
  audioEngine.clearRecordedBuffer()
  spectrum.clear()
  formantChart.clear()
  sessionFrames = []
  totalFrames = 0
  setEmptyVisible(true)
  setState(STATE.IDLE)
}

// ---- 回放 ----
function onPlaybackToggle() {
  if (state !== STATE.PAUSED || sessionFrames.length < 2) return
  if (!playbackManager) {
    playbackManager = new PlaybackManager(audioEngine, spectrum, formantChart)
  }
  if (audioEngine.isPlaying) {
    playbackManager.stop()
    setState(STATE.PAUSED)
    return
  }
  const label = btnPlayback.querySelector('.btn-label')
  if (label) label.textContent = '播放中…'
  btnPlayback.disabled = true
  playbackManager.start(sessionFrames, () => {
    setState(STATE.PAUSED)
  })
}

// ---- 导入 WAV ----
function onImportClick() {
  if (state === STATE.RECORDING || state === STATE.PAUSED) {
    clearAll()
  }
  if (!wavInput) return
  wavInput.value = ''
  wavInput.click()
}
async function onWavSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  clearAll()
  try {
    const buf = await file.arrayBuffer()
    const parsed = parseWav(buf)
    let samples = parsed.samples
    let rate = parsed.sampleRate
    if (rate !== 16000) {
      const r = new Resampler(rate, 16000)
      samples = r.process(samples)
      rate = 16000
    }
    audioEngine.setImportedBuffer(samples)
    audioEngine._recordingSampleRate = rate
    const frames = AnalysisPipeline.analyze(samples, rate, formantMethod, formantSmoothing)
    sessionFrames = frames
    totalFrames = frames.length
    spectrum.displayAll(frames)
    formantChart.displayAll(frames)
    if (frames.length > 0) setEmptyVisible(false)
    setState(STATE.PAUSED)
    printFormantSummary(frames)
  } catch (err) {
    console.error('WAV analysis failed:', err)
    setState(STATE.IDLE)
  }
}

function printFormantSummary(frames) {
  const valid = frames.filter(f => f.f1 > 0 && f.f2 > 0)
  if (valid.length === 0) { console.log('无有效共振峰帧'); return }
  const mF1 = valid.reduce((s, f) => s + f.f1, 0) / valid.length
  const mF2 = valid.reduce((s, f) => s + f.f2, 0) / valid.length
  const sF1 = Math.sqrt(valid.reduce((s, f) => s + (f.f1 - mF1) ** 2, 0) / valid.length)
  const sF2 = Math.sqrt(valid.reduce((s, f) => s + (f.f2 - mF2) ** 2, 0) / valid.length)

  const sorted = [...valid].sort((a, b) => a.time - b.time)
  const n = sorted.length
  const stable = sorted.slice(Math.floor(n * 0.2), Math.floor(n * 0.9))
  const smF1 = stable.reduce((s, f) => s + f.f1, 0) / stable.length
  const smF2 = stable.reduce((s, f) => s + f.f2, 0) / stable.length

  console.log('')
  console.log('=== 共振峰分析结果 ===')
  console.log(`算法: ${formantMethod}  平滑: ${formantSmoothing}`)
  console.log(`总帧数: ${frames.length}  有效帧: ${valid.length}`)
  console.log(`全段均值: F1 = ${mF1.toFixed(1)} ± ${sF1.toFixed(1)} Hz  F2 = ${mF2.toFixed(1)} ± ${sF2.toFixed(1)} Hz`)
  console.log(`稳定段均值(去首尾过渡): F1 = ${smF1.toFixed(1)} Hz  F2 = ${smF2.toFixed(1)} Hz`)
  console.log(`稳定段范围: F1 [${stable[0].f1.toFixed(0)}-${stable[stable.length-1].f1.toFixed(0)}]  F2 [${stable[0].f2.toFixed(0)}-${stable[stable.length-1].f2.toFixed(0)}]`)
  console.log('')
  console.log('Time_s\tF1_Hz\tF2_Hz')
  for (const f of valid) {
    console.log(`${f.time.toFixed(6)}\t${f.f1.toFixed(1)}\t${f.f2.toFixed(1)}`)
  }
  console.log(`共 ${valid.length} 帧`)
}

// ---- 图例点击切换 ----
function initLegendToggle() {
  const items = document.querySelectorAll('.legend-item')
  items.forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key
      const next = !(el.dataset.active !== 'false')
      el.dataset.active = next ? 'true' : 'false'
      el.style.opacity = next ? '1' : '0.35'
      formantChart.setSeriesVisible(key, next)
    })
  })
}

// ---- 配置抽屉 ----
function initConfigDrawer() {
  if (btnConfig) {
    btnConfig.addEventListener('click', () => {
      if (configDrawer) configDrawer.hidden = false
    })
  }
  if (configDrawer) {
    configDrawer.addEventListener('click', (e) => {
      const t = e.target
      if (t === configDrawer || t.classList.contains('drawer-mask') || t.classList.contains('drawer-close')) {
        configDrawer.hidden = true
      }
    })
    const radios = configDrawer.querySelectorAll('input[name="formantMethod"]')
    for (const r of radios) {
      r.addEventListener('change', () => {
        if (r.checked) formantMethod = r.value
      })
    }
    const smoothCb = configDrawer.querySelector('#formantSmoothing')
    if (smoothCb) {
      smoothCb.checked = formantSmoothing
      smoothCb.addEventListener('change', () => {
        formantSmoothing = smoothCb.checked
      })
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && configDrawer && !configDrawer.hidden) configDrawer.hidden = true
  })
}

// ---- 帮助抽屉 ----
function initHelpDrawer() {
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      if (helpDrawer) helpDrawer.hidden = false
    })
  }
  if (helpDrawer) {
    helpDrawer.addEventListener('click', (e) => {
      const target = e.target
      if (target === helpDrawer || target.classList.contains('drawer-mask') || target.classList.contains('drawer-close')) {
        helpDrawer.hidden = true
      }
    })
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpDrawer && !helpDrawer.hidden) helpDrawer.hidden = true
  })
}

// ---- 事件绑定 ----
btnRecord.addEventListener('click', onRecordToggle)
btnImport.addEventListener('click', onImportClick)
btnClear.addEventListener('click', clearAll)
btnPlayback.addEventListener('click', onPlaybackToggle)
wavInput.addEventListener('change', onWavSelected)

// ---- 目标带配置栏: 预设切换、元音卡片点击、输入框提交 ----
if (presetSelect) {
  presetSelect.addEventListener('change', () => {
    const name = presetSelect.value
    if (name && name !== 'custom') applyPreset(name)
  })
}
for (const btn of vowelButtons) {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset))
}
for (const wrap of bandInputs) {
  const lo = wrap.querySelector('.band-lo')
  const hi = wrap.querySelector('.band-hi')
  if (!lo || !hi) continue
  // 在输入框 blur / Enter 时提交 (三对一起刷新一次)
  lo.addEventListener('blur', applyCustomFromInputs)
  hi.addEventListener('blur', applyCustomFromInputs)
  lo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustomFromInputs() } })
  hi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustomFromInputs() } })
}

// ---- 初始化: 默认应用综合训练预设 (与初始 DOM value 一致) ----
applyPreset('balanced')

initLegendToggle()
initConfigDrawer()
initHelpDrawer()
setEmptyVisible(true)
