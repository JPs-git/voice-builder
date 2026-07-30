# Audio Engine 架构重构设计

日期: 2026-07-30

## 目标

用 TypeScript 重构 `js/audio-engine.js`，分离职责，引入单例模式，定义清晰接口。

## 现有问题

1. **职责不单一** — AudioEngine 同时管理 mic 流、Buffer、Playback、导入数据合并
2. **无类型** — 无 TypeScript 类型/接口
3. **非单例** — 每页可创建独立实例，但全局只应有一个
4. **Buffer 管理混乱** — `_recordedChunks`（chunk 数组）和 `_importedData` 两个来源，`_mergeBuffers()` 临时合并

## 架构

### 环形缓冲区 (RingBuffer)

`src/ts/RingBuffer.ts`

固定容量 Float32Array，自动覆盖旧数据。

```
class RingBuffer {
  constructor(capacity: number)  // 最大 sample 数
  write(samples: Float32Array): void
  read(): Float32Array
  clear(): void
  get size(): number
}
```

- `writePos` 单调递增，超出 capacity 则循环覆盖
- `size` 不超过 capacity

### AudioEngine

`src/ts/AudioEngine.ts`

```
class AudioEngine {
  constructor(options?: { sampleRate?: number; maxDurationSec?: number })
  // sampleRate 默认 16000, maxDurationSec 默认 10

  startStream(onChunk: (chunk: Float32Array, rate: number) => void): Promise<void>
  stopStream(): void
  getBuffer(): Float32Array
  importBuffer(samples: Float32Array): void  // 截断超长数据
  clear(): void
  destroy(): void

  get audioContext(): AudioContext
  get isStreaming(): boolean
  get sampleRate(): number
}
```

- `startStream`: getUserMedia → ScriptProcessor → onaudioprocess 中 `ringBuffer.write(chunk)` + `onChunk(chunk, rate)`
- `importBuffer`: 超 10s 截断 → clear → write
- `destroy`: close AudioContext, stopStream, clear

### 单例

`src/ts/index.ts`

```
let instance: AudioEngine | null = null
export function getAudioEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}
export function resetAudioEngine(): void {
  instance?.destroy()
  instance = null
}
```

### Playback (React Hook)

`src/hooks/usePlayback.ts`

```
function usePlayback(): {
  play: () => void
  stop: () => void
  isPlaying: boolean
  progress: number
}
```

- 内部使用 Web Audio API (AudioBufferSourceNode)
- 从 `getAudioEngine().audioContext` 获取 AudioContext
- 调用 `getAudioEngine().getBuffer()` 获取数据
- requestAnimationFrame 驱动进度

## 文件变更

**新增:**
- `src/ts/AudioEngine.ts`
- `src/ts/RingBuffer.ts`
- `src/ts/index.ts`
- `src/hooks/usePlayback.ts`

**删除:**
- `js/audio-engine.js`

**修改:**
- `src/routes/AnalysisPage.tsx` — 使用新 API

## AnalysisPage.tsx 迁移映射

| 旧代码 | 新代码 |
|---|---|
| `new AudioEngine()` | `getAudioEngine()` |
| `ae.startPlayback()` / `ae.stopPlayback()` | `play()` / `stop()` from `usePlayback` |
| `ae.isPlaying` | `isPlaying` from `usePlayback` |
| `ae.clearRecordedBuffer()` | `ae.clear()` |
| `ae.setImportedBuffer(samples)` | `ae.importBuffer(samples)` |
| `ae.trimBufferToDuration()` | 移除 (RingBuffer 自动覆盖) |
| `ae._recordingSampleRate` | `ae.sampleRate` |
| `ae.getRecordedBuffer()` | `ae.getBuffer()` |

## 删除的旧文件

`js/audio-engine.js` 被完全替代。
