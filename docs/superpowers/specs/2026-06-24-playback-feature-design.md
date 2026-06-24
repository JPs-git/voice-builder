# Playback Feature Design

## 1. Problem

回放音频功能缺失。当前 VoiceBuilder 支持实时录音和 WAV 上传，但无法回放已经录制的或导入的音频。

## 2. State Machine

- `IDLE` — 无数据，清空状态
- `RECORDING` — 正在录音，图表显示 10s 滚动窗口
- `PAUSED` — 录音暂停或 WAV 上传完成，图表显示全量数据，可回放

**URL 状态转换：**

```
IDLE ──→ RECORDING (点击"开始录音")
            │
            ▼
         PAUSED (点击"停止录音")
            │
            ├──→ RECORDING (点击"继续录音"，追加)
            └──→ IDLE (点击"清空")

IDLE ──→ PAUSED (上传 WAV 文件)
```

## 3. UI 变化

工具栏新增 `btnPlayback` 按钮（在 btnImport 和 btnClear 之间）：

```html
<button id="btnPlayback" class="btn btn-ghost" disabled>
  <span class="btn-icon">♫</span>
  <span class="btn-label">回放</span>
</button>
```

**状态联动：**

| State | btnPlayback |
|-------|-------------|
| IDLE | disabled |
| RECORDING | disabled |
| PAUSED | enabled |
| 回放中 | disabled，文字="播放中…" |

## 4. AudioEngine 改造

### 录音路径 — 积累原始 PCM

新增 `_recordedChunks: Float32Array[]`，每次 `onaudioprocess` 时 `push` 一份拷贝。保留 `_audioContext` 不关闭（`stopStream` 只停止 tracks 和 processor）。

### 新增 API

```
getRecordedBuffer() → { samples: Float32Array, sampleRate: number }
  - 拼接所有 _recordedChunks → 合并的 Float32Array

setImportedBuffer(samples, rate)
  - WAV 上传时调用，将外部数据存入
  - _recordedChunks = [samples]; _recordingSampleRate = rate

clearRecordedBuffer()
  - 清空 _recordedChunks

startPlayback(onProgress: (time: number) => void)
  - 从 getRecordedBuffer() 创建 AudioBuffer
  - 创建 AudioBufferSourceNode → connect destination → start()
  - onended 时设置 _isPlaying = false
  - requestAnimationFrame 循环，计算已播放时间 → onProgress(time)

stopPlayback()
  - sourceNode.stop()，停止 RAF 循环

get isPlaying()
```

### AudioContext 生命周期变更

- `startStream()`: 创建 AudioContext（同现有）
- `stopStream()`: 断开 processor/source/stream tracks，但 **不 close AudioContext**
- `clearRecordedBuffer() + close AudioContext` → 由 `clearAll()` 触发

## 5. 数据流程图

### 录音

```
Microphone → AudioEngine.onaudioprocess
  ├── _recordedChunks.push(copy)
  └── onChunk(copy, rate) → AnalysisPipeline.pushChunk
        └── onFrame: sessionFrames.push(frame) + spectrum.pushFrame() + formantChart.pushFrame()
```

### PAUSED → 全量显示

```
stopStream → livePipeline.flush()
totalFrames += livePipeline.frameCount
spectrum.displayAll(sessionFrames)
formantChart.displayAll(sessionFrames)
setState(PAUSED)
```

### PAUSED → RECORDING (追加)

```
livePipeline = new AnalysisPipeline({ frameOffset: totalFrames, ... })
await audioEngine.startStream(onChunk)
spectrum.setLiveMode()
formantChart.setLiveMode()
setState(RECORDING)
```

### 回放 (PAUSED 状态下)

```
playbackManager.start(sessionFrames, sampleRate, onEnd)
  → audioEngine.startPlayback((time) => {
      spectrum.setCursorTime(time)
      formantChart.setCursorTime(time)
    }, () => {
      // onEnd: cursorTime(null), btnPlayback 恢复
    })
```

## 6. Cursor Sync

### Spectrogram

新增 `_cursorCanvas` 层（topmost, pointer-events: none）。

```
setCursorTime(time: number | null)
  - null: 清除 cursorCanvas
  - number: 计算时间在绘图区对应的 x 坐标
    - 静态模式: cursorX = padL + (time - tStart) / (tEnd - tStart) * plotWidth
    - 在 cursorCanvas 上画垂直红线（stroke: '#E23E57', width: 2）
```

### FormantChart

```
setCursorTime(time: number | null)
  - null: 移除 ECharts graphic 元素
  - number: 使用 echarts.convertToPixel({ xAxisIndex: 0 }, time) 获取像素 x
    - 通过 setOption({ graphic: [{ type: 'line', shape: { x1, y1, x2, y2 } }] }) 画竖线
```

## 7. PlaybackManager (重写)

```javascript
class PlaybackManager {
  constructor(audioEngine, spectrogram, formantChart) { ... }

  start(sessionFrames, sampleRate, onEnd) {
    this.sessionFrames = sessionFrames
    this._onEnd = onEnd
    const totalTime = sessionFrames.length > 0
      ? sessionFrames[sessionFrames.length - 1].time
      : 0

    this.audioEngine.startPlayback((elapsed) => {
      const t = Math.min(elapsed, totalTime)
      this.spectrogram.setCursorTime(t)
      this.formantChart.setCursorTime(t)
    })
  }

  stop() {
    this.audioEngine.stopPlayback()
    this.spectrogram.setCursorTime(null)
    this.formantChart.setCursorTime(null)
    if (this._onEnd) this._onEnd()
  }
}
```

## 8. 文件改动清单

| File | Change | Complexity |
|------|--------|------------|
| `audio-engine.js` | 积累 recordedChunks，新增 playback API，保留 AudioContext | Medium |
| `playback.js` | 重写 PlaybackManager | Small |
| `spectrogram.js` | 新增 setCursorTime(), setLiveMode() | Small |
| `formant-chart.js` | 新增 setCursorTime(), setLiveMode() | Small |
| `main.js` | 状态机扩展 PAUSED，sessionFrames 积累，按钮联动 | Medium |
| `index.html` | 新增回放按钮 | Small |
| `css/style.css` | 回放按钮样式 | Small |

## 9. Error Handling

- **音频数据为空**: 回放按钮 disabled，无数据不可播放
- **播放中 `clearAll`**: 调用 `stopPlayback()` → 清空所有数据
- **AudioContext 被浏览器 suspend**: `startPlayback` 中先 `audioContext.resume()`
- **回放结束**: `source.onended` 触发清理，光标归零，按钮恢复

## 10. Memory 考量

- `_recordedChunks` 存原始 Float32Array（约 16kHz × 16bit = 32KB/s，10 分钟 ~ 19MB）
- `sessionFrames` 存分析帧（约 100fps × ~2KB = 200KB/s，10 分钟 ~ 120MB）
- 实际使用场景（几分钟级）内存安全。`clearAll` 释放所有数据。
