# 架构重构设计 — 全量分层

日期: 2026-07-30

## 目标

将 VoiceBuilder 从"单页面编排 + Context + imperative refs"架构重构为命令式控制 + 响应式数据的架构。
UI 组件通过回调直接操作引擎，分析结果通过 Zustand Store 响应式流向 Charts。

### 核心设计原则：命令式控制 + 响应式数据

**控制流（命令式）**：用户点击按钮 → 回调直接调用 AudioEngine/Pipeline 方法。不做 phase → useEffect 的间接中转。

**数据流（响应式）**：原始采样存入模块级共享 `recordingBuffer`，分析帧写入 frameStore，Charts 通过 Zustand selector 订阅。

```
用户点击录音
  → useAnalysis.onRecord()
    → pipeline = new AnalysisPipeline(config快照)
    → audioEngine.startCapture(chunk => {
        recordingBuffer.write(chunk)          // 共享原始数据
        pipeline.pushChunk(chunk, rate)       // DSP 分析
      })
      → onFrame → frameStore.appendFrame(frame)
                  → Charts 订阅 frames → 渲染

用户点击播放
  → usePlayback.play()
    → samples = recordingBuffer.read()       // 直接从共享模块拿
    → audioEngine.createPlaybackSource(samples)
```

- **控制走回调**：AudioEngine 和 Pipeline 的启停直接在事件处理函数中完成，不经过状态
- **数据走 Store**：分析结果（frames, stats）和配置（config, bands）存 Zustand，Charts 通过 selector 订阅
- **原始采样走共享模块**：`recordingBuffer` 是模块级变量，useAnalysis 写入，usePlayback 读取，两者平级无依赖
- **Config 在录音开始时快照**：录音中修改配置不传播到运行中的 pipeline

---

## 目录结构

```
src/
├── dsp/                       # Engine Layer: DSP (TS 迁移)
│   ├── RingBuffer.ts           # 通用循环缓冲（从 src/ts/ 迁入）
│   ├── analysis-pipeline.ts
│   ├── cepstral.ts
│   ├── lpc.ts
│   ├── fft.ts
│   ├── formant-smoother.ts
│   ├── frame-processor.ts
│   ├── resampler.ts
│   ├── vad.ts
│   ├── wav-parser.ts
│   └── index.ts

├── audio/                     # Engine Layer: 音频硬件
│   ├── AudioEngine.ts          # 纯硬件接口（无数据存储）
│   └── index.ts                # getAudioEngine, resetAudioEngine
│
├── services/                  # Service Layer: 业务编排
│   └── AnalysisService.ts      # 录音/导入生命周期
│
├── store/                     # State Layer: Zustand
│   ├── analysisStore.ts        # config, preset, bands, sampleCount
│   └── frameStore.ts           # frames[], latestFrame, stats
│
├── components/                # UI Layer
│   ├── AnalysisPage.tsx        # ~60 行, 仅组件组装
│   ├── F0Chart.tsx            # 响应式订阅 frameStore
│   ├── FormantChart.tsx       # 响应式订阅 frameStore
│   ├── Toolbar.tsx            # 使用 analysisStore
│   ├── TargetPresetBar.tsx    # 使用 analysisStore
│   ├── Drawer.tsx
│   ├── ConfigDrawer.tsx       # UI 状态局部 useState
│   ├── HelpDrawer.tsx         # UI 状态局部 useState
│   ├── AboutModal.tsx         # UI 状态局部 useState
│   └── ... (Button, Modal, TipWidget, EmptyState 不变)
│
├── hooks/
│   ├── useECharts.ts          # ECharts 实例生命周期 + cursor 管理
│   ├── usePlayback.ts         # 回放控制 (已有, 不变)
│   └── useAnalysisService.ts  # 桥接 AnalysisService + React 生命周期
│
├── types/
│   └── index.ts               # 共享类型定义
│
├── App.tsx                    # 移除 AnalysisProvider, 直接渲染 AnalysisPage
└── main.tsx
```

**移除：**
- `src/contexts/AnalysisContext.tsx` — 被 Zustand store 替代
- `src/ts/` → 改为 `src/audio/`
- `js/*.js` — DSP 文件迁移后删除

---

## Engine Layer 设计

### AudioEngine：纯硬件接口

AudioEngine 回归本质——**只负责与浏览器音频硬件交互**，不持有任何数据。

**职责：** AudioContext 管理、getUserMedia、音频采集、音频播放

**不负责：** 数据存储、DSP 处理

```typescript
// src/audio/AudioEngine.ts — 纯硬件，无状态存储
class AudioEngine {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private isCapturing: boolean = false

  get sampleRate(): number

  // ── 采集 ──
  async startCapture(
    onChunk: (samples: Float32Array, rate: number) => void
  ): Promise<void>

  stopCapture(): void

  // ── 播放 ──
  createPlaybackSource(samples: Float32Array): {
    source: AudioBufferSourceNode
    totalDuration: number
  }
}
```

**关键变化：**
- 删除 `RingBuffer` — 数据存储移到 AnalysisService
- 删除 `getBuffer()` — 原始采样由 Service 提供
- 删除 `importBuffer()` — 导入时由 Service 直接写 RingBuffer
- 删除 `clear()` — Service 掌管数据生命周期
- `startStream` → `startCapture` — 命名更准确，只表达"开始采集"
- `stopStream` → `stopCapture`
- 新增 `createPlaybackSource()` — 提供播放能力，但不持有数据

### AnalysisPipeline：独立 DSP 处理器

Pipeline 与 AudioEngine 完全解耦，保持独立。**唯一耦合是一个 callback：**

```typescript
// AudioEngine 不知道 Pipeline 的存在
audioEngine.startCapture((chunk, rate) => pipeline.pushChunk(chunk, rate))
```

**保持独立的原因：**
1. 生命周期不同 — AudioEngine 单例，Pipeline 每次录音新建/销毁
2. WAV 导入只用 Pipeline（`static analyze()`），不涉及 AudioEngine
3. 测试时各自独立 mock
4. 未来换 DSP 后端（Rust/WASM）不需要动 AudioEngine

### 数据归属：原始采样 vs 分析结果

两个消费者是平级关系，都在 `useAnalysis.onAudioChunk` 回调中：

```
mic → AudioEngine.startCapture(onChunk)
        │
        ├── recordingBuffer.write(chunk)   ← 模块级共享，回放用
        │
        └── pipeline.pushChunk(chunk)      ← DSP 分析
              ↓
            onFrame → frameStore.appendFrame(frame)
                        ↓
                      Charts 订阅 → 渲染
```

- **原始采样**：`recordingBuffer`（模块级 RingBuffer），谁需要谁直接 import
- **分析结果**：`frameStore`（Zustand），Charts 通过 selector 订阅

### RingBuffer 的位置

RingBuffer 是通用数据结构。录音缓冲实例是模块级共享变量，不归任何对象所有：

```
src/
├── audio/
│   ├── AudioEngine.ts       # 纯硬件接口
│   └── recordingBuffer.ts   # 模块级共享 RingBuffer 实例
├── dsp/
│   ├── RingBuffer.ts        # 通用循环缓冲 class
│   └── ...
├── hooks/
│   ├── useAnalysis.ts       # 写入 recordingBuffer
│   └── usePlayback.ts       # 读取 recordingBuffer
```

两个 hook 平级导入 `recordingBuffer`，无依赖关系。

---

## State Layer (Zustand)

### 设计原则

- 两个独立的 Zustand store，互不依赖
- Service 层可以直接 `store.getState()` 读写，无需 React 桥接
- 组件通过 selector 精准订阅，只重渲染变动的部分

### analysisStore

```typescript
import { create } from 'zustand'
import type { AppConfig, TargetBands } from '../types'
import { DEFAULT_CONFIG, VOWEL_PRESETS } from '../types'

interface AnalysisState {
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
  sampleCount: number                         // 原始采样数（用于判断是否有数据）
}

interface AnalysisActions {
  setConfig: (config: Partial<AppConfig>) => void
  setActivePreset: (name: string | null) => void
  setBands: (bands: Partial<Record<'f0'|'f1'|'f2', [number, number]>>) => void
  setSampleCount: (count: number) => void
  reset: () => void
}

type AnalysisStore = AnalysisState & AnalysisActions
```

- `setBands`: 合并更新，只修改提供的 key
- `reset`: 恢复全部默认值
- `setSampleCount`: 由 useAnalysis 在录音导入时更新
- 默认 bands 从 VOWEL_PRESETS['vowel-a'] 初始化

**不再包含 `phase` 和 `dataSource`** — 引擎控制走直接回调，不需要状态驱动。

### frameStore

```typescript
import { create } from 'zustand'
import type { AnalysisFrame, AnalysisStats } from '../types'

interface FrameState {
  frames: AnalysisFrame[]
  latestFrame: AnalysisFrame | null
  stats: AnalysisStats
  cursorTime: number
}

interface FrameActions {
  appendFrame: (frame: AnalysisFrame) => void
  setFrames: (frames: AnalysisFrame[]) => void
  setCursorTime: (time: number) => void
  clear: () => void
}

type FrameStore = FrameState & FrameActions
```

- `appendFrame`: 追加一帧，超过 `WINDOW_FRAMES (1000)` 自动 shift 最早帧；增量更新 `latestFrame` 和 `stats`
- `setFrames`: 批量设置（WAV 导入），重置整个数组并重算 stats
- `stats`: 增量计算 `f0Mean`（累计和/帧数），`hitRate`（命中目标区帧数/总帧数），`duration`（最后一帧 time）
- `cursorTime`: 回放进度游标，-1 表示隐藏

---

## Hooks Layer

### 设计原则：回调驱动 + 共享数据

- **控制走回调**：用户操作直接调用 `useAnalysis` 返回的回调函数，回调内直接操作 AudioEngine 和 Pipeline
- **数据走 Store**：分析结果存 frameStore，配置存 analysisStore
- **原始采样走共享模块**：`recordingBuffer` 是模块级 `RingBuffer`，useAnalysis 写入，usePlayback 读取，两者平级无依赖

### recordingBuffer：共享原始数据

```typescript
// src/audio/recordingBuffer.ts
import { RingBuffer } from '../dsp/RingBuffer'

// 模块级变量 — 不归任何 hook 或组件所有
export const recordingBuffer = new RingBuffer(16000 * 10)
```

### useAnalysis：控制中心

React hook，管理录制/Pipeline 生命周期。返回回调函数，不返回任何状态。

```typescript
// src/hooks/useAnalysis.ts
function useAnalysis(): {
  onRecord: () => Promise<void>
  onImport: () => void
  onClear: () => void
  isCapturing: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}
```

**内部状态（useRef/useState，不暴露）：**

```typescript
const pipelineRef = useRef<AnalysisPipeline | null>(null)
const frameOffsetRef = useRef(0)
const [isCapturing, setIsCapturing] = useState(false)
```

**录音回调：**

```typescript
const onRecord = useCallback(async () => {
  if (isCapturing) {
    // 停止
    pipelineRef.current?.flush()
    frameOffsetRef.current += pipelineRef.current?.frameCount ?? 0
    pipelineRef.current?.reset()
    pipelineRef.current = null
    getAudioEngine().stopCapture()
    setIsCapturing(false)
    return
  }

  // 开始 / 追加
  const config = useAnalysisStore.getState().config     // 快照
  if (frameOffsetRef.current === 0) {
    recordingBuffer.clear()
    useFrameStore.getState().clear()
  }

  pipelineRef.current = new AnalysisPipeline({
    onFrame: (f) => useFrameStore.getState().appendFrame(f),
    formantMethod: config.formantMethod,
    formantSmoothing: config.formantSmoothing,
    frameOffset: frameOffsetRef.current,
  })

  try {
    await getAudioEngine().startCapture((chunk, rate) => {
      recordingBuffer.write(chunk)                // 共享 buffer
      pipelineRef.current?.pushChunk(chunk, rate) // DSP 分析
    })
    setIsCapturing(true)
  } catch (err) {
    setIsCapturing(false)
  }
}, [isCapturing])
```

**导入回调：**

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  const buf = await file.arrayBuffer()

  // 停止录制
  if (isCapturing) {
    pipelineRef.current?.reset()
    pipelineRef.current = null
    getAudioEngine().stopCapture()
    setIsCapturing(false)
  }

  const parsed = parseWav(buf)
  let samples = resampleIfNeeded(parsed.samples, parsed.sampleRate)
  // 10s 检查...

  recordingBuffer.clear()
  recordingBuffer.write(samples)
  useFrameStore.getState().clear()

  const config = useAnalysisStore.getState().config
  const frames = AnalysisPipeline.analyze(samples, 16000,
    config.formantMethod, config.formantSmoothing)
  useFrameStore.getState().setFrames(frames)
  useAnalysisStore.getState().setSampleCount(samples.length)
}
```

**清空回调：**

```typescript
const onClear = useCallback(() => {
  if (isCapturing) {
    pipelineRef.current?.reset()
    pipelineRef.current = null
    getAudioEngine().stopCapture()
    setIsCapturing(false)
  }
  recordingBuffer.clear()
  useFrameStore.getState().clear()
  useAnalysisStore.getState().reset()
}, [isCapturing])
```

### usePlayback：回放

直接从 `recordingBuffer` 读取原始采样，不依赖 `useAnalysis`。

```typescript
// src/hooks/usePlayback.ts
function usePlayback(): {
  play: () => void
  stop: () => void
  isPlaying: boolean
}
```

**实现要点：**

```typescript
const play = useCallback(() => {
  // 如果正在录制，先停止
  // ... (通过 shared isCapturing 状态或直接调 stopCapture)

  const samples = recordingBuffer.read()    // 直接从共享模块读取
  if (samples.length === 0) return

  const { source, totalDuration } = getAudioEngine().createPlaybackSource(samples)
  // ... rAF tick + cursorTime
})
```

**useAnalysis 和 usePlayback 是平级关系，都 import `recordingBuffer`，互不依赖。**

### 关键设计决策

1. **消除 Phase**：引擎控制走直接回调，不需要 `idle → requesting → recording` 的间接层
2. **recordingBuffer 模块级共享**：useAnalysis 写入，usePlayback 读取。不经过 props、Store 或 Context 传递
3. **AudioEngine 不持有数据**：纯硬件接口
4. **Pipeline 独立于 AudioEngine**：唯一耦合是 callback
5. **Config 快照**：录音开始时读取，录音中修改不传播到 pipeline
6. **isCapturing 是本地 state**：不放入 Store，只有 useAnalysis 内部使用

---

## UI Layer

### AnalysisPage（薄层，组装 + 接线）

```tsx
export function AnalysisPage() {
  const { onRecord, onImport, onClear, isCapturing, fileInputRef, handleFileChange }
    = useAnalysis()
  const { play, stop, isPlaying } = usePlayback()
  const sampleCount = useAnalysisStore(s => s.sampleCount)

  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const hasData = isCapturing || sampleCount > 0

  return (
    <div>
      <Toolbar
        isCapturing={isCapturing}
        hasData={hasData}
        isPlaying={isPlaying}
        onRecord={onRecord}
        onImport={onImport}
        onPlayback={play}
        onStopPlayback={stop}
        onClear={onClear}
        onConfig={() => setConfigOpen(true)}
        onHelp={() => setHelpOpen(true)}
        onAbout={() => setAboutOpen(true)}
      />
      <TargetPresetBar />
      <main className={styles.content}>
        <F0Chart />
        <FormantChart />
      </main>
      <ConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <input ref={fileInputRef} type="file" accept=".wav" hidden onChange={handleFileChange} />
    </div>
  )
}
```

- ~60 行
- 组件只做接线：从 hooks 拿回调和状态，传给子组件
- 不引用 AudioEngine、AnalysisPipeline、ECharts
- **不再有 phase 概念** — Toolbar 从 `isCapturing` + `hasData` 推导按钮状态

### Toolbar

```tsx
function Toolbar({ isCapturing, hasData, isPlaying, onRecord, onImport,
                   onPlayback, onStopPlayback, onClear, onConfig, onHelp, onAbout }) {
  const label = isCapturing ? '停止录音' : hasData ? '继续录音' : '开始录音'

  return (
    <header>
      <Button label={label} icon={isCapturing ? '■' : '●'}
              recording={isCapturing} onClick={onRecord} />
      <Button label="导入 WAV" icon="📁" onClick={onImport} />
      <Button label={isPlaying ? '停止' : '回放'} icon={isPlaying ? '■' : '♫'}
              onClick={isPlaying ? onStopPlayback : onPlayback}
              disabled={!hasData && !isCapturing} />
      <Button label="清空" icon="↺" onClick={onClear}
              disabled={!hasData && !isCapturing} />
      <Button label="配置" icon="⚙" onClick={onConfig} />
      <Button label="帮助" icon="?" onClick={onHelp} />
      <Button label="关于" icon="ⓘ" onClick={onAbout} />
    </header>
  )
}
```

**按钮状态推导——不需要 phase：**

| 条件 | 录音按钮 |
|------|---------|
| `!isCapturing && !hasData` | "开始录音" |
| `!isCapturing && hasData` | "继续录音" |
| `isCapturing` | "停止录音" ⏹ |

### F0Chart / FormantChart

不变 — 同样通过 Zustand selector 订阅 frameStore 和 analysisStore。

### 组件变更汇总

| 组件 | 变更 |
|---|---|
| AnalysisPage | ~110→~60 行，从 hooks 获取回调 + 状态，传给子组件 |
| Toolbar | 接收 `isCapturing` + `hasData` + 回调 props，不再推导 phase |
| F0Chart / FormantChart | 不变（已响应式订阅） |
| TargetPresetBar | 不变（已读写 analysisStore） |
| ConfigDrawer | 不变（已读写 analysisStore） |
| Drawer/Button/Modal/EmptyState/TipWidget | 不变 |

### 未变更的部分

- `src/hooks/useECharts.ts` — 不变
- `src/hooks/usePlayback.ts` — 核心逻辑不变，去掉 phase 引用
- 所有 CSS module — 不变
- `vite.config.ts` — 不变

---

## Data Flow（端到端，回调驱动）

用户操作 → 回调直接调引擎/Pipeline。数据通过 Store 和 recordingBuffer 流动。

### 录音

```
用户点击"开始录音"
→ Toolbar.onRecord → useAnalysis.onRecord()
  → 如果 isCapturing: stopCapture() + setIsCapturing(false) + return
  → 快照 config = analysisStore.getState().config
  → 首次录制: recordingBuffer.clear() + frameStore.clear()
  → pipeline = new AnalysisPipeline({config, onFrame: frameStore.appendFrame})
  → audioEngine.startCapture(chunk => {
      recordingBuffer.write(chunk)              // 写入共享模块
      pipeline.pushChunk(chunk, rate)           // DSP 分析
    })
    → getUserMedia → ScriptProcessorNode (~15.6次/秒)
      → onFrame (100帧/秒): VAD → formants → FormantSmoother
        → frameStore.appendFrame(frame)
  → setIsCapturing(true)

用户点击"停止录音"
→ Toolbar.onRecord → useAnalysis.onRecord()
  → isCapturing=true → 走停止分支
    → pipeline.flush() → 最后一帧
    → frameOffset 累加 pipeline.frameCount
    → pipeline.reset() + pipeline = null
    → audioEngine.stopCapture()
    → setIsCapturing(false)
    // recordingBuffer 保留，供回放使用
```

### 导入 WAV

```
用户选择 .wav 文件
→ handleFileChange → useAnalysis
  → 如果 isCapturing: stopCapture()
  → parseWav → Resampler → 10s 检查
  → recordingBuffer.clear() + recordingBuffer.write(samples)
  → frameStore.clear()
  → AnalysisPipeline.analyze(samples) → frames[]
  → frameStore.setFrames(frames)
  → analysisStore.setSampleCount(samples.length)
```

### 回放

```
用户点击播放 (hasData=true)
→ Toolbar.onPlayback → usePlayback.play()
  → samples = recordingBuffer.read()           ← 直接读共享模块
  → audioEngine.createPlaybackSource(samples)
  → rAF tick → frameStore.setCursorTime(elapsed)
  → Charts 订阅 cursorTime → useECharts 更新 markLine
```

### 清空

```
用户点击清空
→ Toolbar.onClear → useAnalysis.onClear()
  → 如果 isCapturing: stopCapture()
  → recordingBuffer.clear()
  → frameStore.clear()
  → analysisStore.reset()
  → setIsCapturing(false)
```

---

## DSP 迁移计划 (Phase 4)

### 迁移策略

每个 DSP 模块单独迁移，顺序从无状态到有状态：

| 顺序 | 模块 | 状态 | 备注 |
|---|---|---|---|
| 1 | fft.ts | 无状态 | 纯函数，最简单 |
| 2 | resampler.ts | 有状态 (Resampler class) | 可直接移植 |
| 3 | wav-parser.ts | 无状态 | 纯函数 |
| 4 | vad.ts | 有状态 (VoiceActivityDetector) | 可直接移植 |
| 5 | lpc.ts | 无状态 | 导出函数 |
| 6 | cepstral.ts | 无状态 | 导出函数 |
| 7 | formant-smoother.ts | 有状态 | 修改 import 路径 |
| 8 | frame-processor.ts | 有状态 | 需配合 pipeline |
| 9 | analysis-pipeline.ts | 有状态 | 核心编排，最后移 |

迁移 == 重写为 .ts + 添加类型，逻辑不改。测试从 `node --test` 迁移到 Vitest。

### 接口约定

所有 DSP 模块通过 `src/dsp/index.ts` 统一导出：

```typescript
export { FFT, fftMagnitudes } from './fft'
export { Resampler } from './resampler'
export { parseWav } from './wav-parser'
export { VoiceActivityDetector } from './vad'
export { detectPitch, extractFormants, isHarmonicLocked } from './lpc'
export { extractFormantsCepstral } from './cepstral'
export { FormantSmoother } from './formant-smoother'
export { FrameProcessor } from './frame-processor'
export { AnalysisPipeline } from './analysis-pipeline'
```

---

## 移除的文件清单

| 文件 | 替代 |
|---|---|
| `src/contexts/AnalysisContext.tsx` | `src/store/analysisStore.ts` + `frameStore.ts` |
| `src/ts/AudioEngine.ts` | → `src/audio/AudioEngine.ts`（精简为纯硬件接口） |
| `src/ts/RingBuffer.ts` | → `src/dsp/RingBuffer.ts`（数据归属 Service） |
| `src/ts/index.ts` | → `src/audio/index.ts` |
| AudioEngine 的 `getBuffer()` / `importBuffer()` / `clear()` | 删除（数据存储移入 AnalysisService.rawBuffer） |
| AudioEngine 的 `startStream()` / `stopStream()` | 重命名为 `startCapture()` / `stopCapture()` |
| `js/analysis-pipeline.js` | `src/dsp/analysis-pipeline.ts` (迁移后) |
| `js/cepstral.js` | `src/dsp/cepstral.ts` (迁移后) |
| `js/lpc.js` | `src/dsp/lpc.ts` (迁移后) |
| `js/fft.js` | `src/dsp/fft.ts` (迁移后) |
| `js/formant-smoother.js` | `src/dsp/formant-smoother.ts` (迁移后) |
| `js/frame-processor.js` | `src/dsp/frame-processor.ts` (迁移后) |
| `js/resampler.js` | `src/dsp/resampler.ts` (迁移后) |
| `js/vad.js` | `src/dsp/vad.ts` (迁移后) |
| `js/wav-parser.js` | `src/dsp/wav-parser.ts` (迁移后) |
| `js/complex.js` | `src/dsp/complex.ts` (迁移后) |
| `js/__tests__/*.test.js` | 迁移到 `src/__tests__/` (Vitest) |
| `src/types/index.ts` 中的 ChartHandles | 完全移除（所有方法被 store 或 useECharts 替代） |
| `src/types/index.ts` 中的 AppPhase | 完全移除（引擎控制走直接回调，不需要 phase 状态） |
| `src/types/index.ts` 中的 `dataSource` | 移除（不需要区分 mic/file，数据都在 recordingBuffer 里） |
| `src/services/` | 删除整个目录（AnalysisService 被 useAnalysis hook 替代） |

---

