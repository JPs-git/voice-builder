import { AudioEngine } from './audio-engine.js'
import { FormantChartRenderer } from './formant-chart.js'
import { analyzeWavF0 } from './wav-analyzer.js'

const formantCanvas = document.getElementById('formantChart')
const btnRecord = document.getElementById('btnRecord')

const audioEngine = new AudioEngine()
const formantChart = new FormantChartRenderer(formantCanvas)

const f0Label = document.getElementById('f0Label')
const wavInfo = document.getElementById('wavInfo')

let _f0Data = []
let _rafId = null

function redrawTrace() {
  if (_f0Data.length === 0) return
  const last = _f0Data[_f0Data.length - 1]
  const duration = last.time + 0.01
  formantChart.showWavF0Trace(_f0Data, '实时', duration)
}

btnRecord.addEventListener('click', async () => {
  if (audioEngine.running) {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null }
    audioEngine.stopStream()
    btnRecord.textContent = '录制'
    if (_f0Data.length > 0) {
      redrawTrace()
    }
  } else {
    formantChart.clearWavTrace()
    wavInfo.textContent = ''
    _f0Data = []
    f0Label.textContent = 'F0: -- Hz'

    try {
      await audioEngine.startStream((f0, time) => {
        _f0Data.push({ time, f0 })
        f0Label.textContent = f0 != null ? `F0: ${Math.round(f0)} Hz` : 'F0: -- Hz'
      })
      btnRecord.textContent = '停止'

            const loop = () => {
        if (!audioEngine.running) return
        redrawTrace()
        _rafId = requestAnimationFrame(loop)
      }
      _rafId = requestAnimationFrame(loop)
    } catch (err) {
      f0Label.textContent = '麦克风初始化失败'
      console.error('Stream start failed:', err)
    }
  }
})

document.getElementById('wavInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  wavInfo.textContent = '分析中...'
  try {
    const result = await analyzeWavF0(file)
    formantChart.showWavF0Trace(result.f0Data, result.fileName, result.duration)
    wavInfo.textContent = `${result.voicedFrames}/${result.totalFrames} voiced  [× 关闭]`
  } catch (err) {
    wavInfo.textContent = `错误: ${err.message}`
    console.error('WAV analysis failed:', err)
  }
})

wavInfo.addEventListener('click', () => {
  if (formantChart._wavMode) {
    formantChart.clearWavTrace()
    wavInfo.textContent = ''
  }
})
