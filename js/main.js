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
let formantMethod = 'cepstral'
const btnPlayback = $('#btnPlayback')

// ---- 业务对象 ----
const audioEngine = new AudioEngine()
const spectrum = new PowerSpectrumRenderer(spectrumContainer)
const formantChart = new FormantChartRenderer(formantContainer)

// 状态
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
    const frames = AnalysisPipeline.analyze(samples, rate, formantMethod)
    sessionFrames = frames
    totalFrames = frames.length
    spectrum.displayAll(frames)
    formantChart.displayAll(frames)
    if (frames.length > 0) setEmptyVisible(false)
    setState(STATE.PAUSED)
  } catch (err) {
    console.error('WAV analysis failed:', err)
    setState(STATE.IDLE)
  }
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

initLegendToggle()
initConfigDrawer()
initHelpDrawer()
setEmptyVisible(true)
