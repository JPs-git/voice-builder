import { AudioEngine } from './audio-engine.js'
import { SpectrogramRenderer } from './spectrogram.js'
import { FormantChartRenderer } from './formant-chart.js'
import { PlaybackManager } from './playback.js'

const spectrogramCanvas = document.getElementById('spectrogram')
const formantCanvas = document.getElementById('formantChart')
const btnPause = document.getElementById('btnPause')

const audioEngine = new AudioEngine()
const spectrogram = new SpectrogramRenderer(spectrogramCanvas)
const formantChart = new FormantChartRenderer(formantCanvas)

audioEngine.onCombinedFrame = (frame) => {
  spectrogram.pushFrame(frame.magnitudes, frame.time)
  formantChart.pushFrame(frame, frame.time)
  updateFormantLabels(frame)
}

const playback = new PlaybackManager(audioEngine, spectrogram, formantChart)

btnPause.addEventListener('click', () => {
  playback.toggle()
  btnPause.textContent = playback.paused ? '继续' : '暂停'
})

function updateFormantLabels(f) {
  const set = (id, val) => {
    const el = document.getElementById(id)
    if (el) el.textContent = val != null ? val.toFixed(0) + ' Hz' : '-- Hz'
  }
  set('f0Label', f.f0)
  set('f1Label', f.f1)
  set('f2Label', f.f2)
  set('f3Label', f.f3)
  set('f4Label', f.f4)
}

async function init() {
  try {
    await audioEngine.start()
  } catch (err) {
    console.error('Failed to start:', err)
    document.body.innerHTML = `<div style="color:red;padding:20px">麦克风初始化失败: ${err.message}</div>`
  }
}

init()
