export class PlaybackManager {
  constructor(audioEngine, f0Chart, formantChart) {
    this.audioEngine = audioEngine
    this.f0Chart = f0Chart
    this.formantChart = formantChart
  }

  start(sessionFrames, onEnd) {
    if (sessionFrames.length < 2) return
    // 录音裁剪后 sessionFrames 可能不从 time=0 开始（如 15s→5~15），
    // 用首帧时间做偏移，使游标与图谱 x 轴范围对齐
    const timeOffset = sessionFrames[0].time
    this.f0Chart.setCursorTime(timeOffset)
    this.formantChart.setCursorTime(timeOffset)

    this.audioEngine.startPlayback((elapsed) => {
      const cursorTime = timeOffset + elapsed
      this.f0Chart.setCursorTime(cursorTime)
      this.formantChart.setCursorTime(cursorTime)
    }, () => {
      this.f0Chart.setCursorTime(-1)
      this.formantChart.setCursorTime(-1)
      if (onEnd) onEnd()
    })
  }

  stop() {
    this.audioEngine.stopPlayback()
    this.f0Chart.setCursorTime(-1)
    this.formantChart.setCursorTime(-1)
  }
}
