import { AudioEngine } from './audio-engine.js'
import { FormantChartRenderer } from './formant-chart.js'
import { analyzeWavF0 } from './wav-analyzer.js'

const formantCanvas = document.getElementById('formantChart')
const btnRecord = document.getElementById('btnRecord')

const audioEngine = new AudioEngine()
const formantChart = new FormantChartRenderer(formantCanvas)

const f0Label = document.getElementById('f0Label')

btnRecord.addEventListener('click', async () => {
  if (audioEngine.running) {
    btnRecord.textContent = '分析中...'
    btnRecord.disabled = true

    const { samples, sampleRate } = audioEngine.stopRecording()
    const result = audioEngine.analyzePcm(samples, sampleRate)

    formantChart.showWavF0Trace(result.f0Data, '录制', result.duration)
    f0Label.textContent = `F0: ${result.voicedFrames}/${result.totalFrames} framed`

    btnRecord.textContent = '录制'
    btnRecord.disabled = false
  } else {
    formantChart.clear()
    formantChart.clearWavTrace()
    f0Label.textContent = 'F0: -- Hz'

    try {
      await audioEngine.startRecording()
      btnRecord.textContent = '停止'
    } catch (err) {
      f0Label.textContent = '麦克风初始化失败'
      console.error('Recording start failed:', err)
    }
  }
})

const wavInfo = document.getElementById('wavInfo')

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
