# 架构重构设计 — 全量分层

日期: 2026-07-30

## 目标

将 VoiceBuilder 从"单页面编排 + Context + imperative refs"架构重构为四层清晰分层的架构：
UI Layer → State Layer → Service Layer → Engine Layer。每层独立可测，边界清晰。

### 核心设计原则：Phase 驱动

整个系统的唯一驱动源是 **Phase 状态**。用户操作不直接调用 Service 方法，而是 dispatch phase 变更；Service 层作为 phase 观察者，自动响应 phase 变迁执行对应副作用。数据流形成单向闭环：

```
用户操作 → dispatch(phase) → Service 监听 → Engine 启停 → Pipeline 处理
                                                           ↓
Charts 订阅 ← frameStore ← appendFrame ← onFrame ←── 音频数据流入
```

- **UI 层只知道"我想要什么状态"**，不知道"如何达到那个状态"
- **Service 层是 phase 观察者**，而非被调用的方法集合
- **Config 在 pipeline 创建时快照**，录音中修改不传播到运行中的 pipeline

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
│   ├── analysisStore.ts        # phase, config, preset, bands
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

### 数据归属：原始采样存放在 AnalysisService

录音时的数据流——两个平级消费者：

```
mic → AudioEngine.startCapture(onChunk)
        │
        ├── rawBuffer.write(chunk)    ← Service 存储原始采样
        │
        └── pipeline.pushChunk(chunk) ← Pipeline 做 DSP 分析
```

原始采样为什么不该放在 AudioEngine：
1. **缓冲生命周期 > 引擎生命周期** — 引擎 stop 后数据仍需保留（用于回放）
2. **容量上限是业务规则** — 10 秒限制是产品决定，不是硬件限制
3. **与 Pipeline 是平级消费者** — 没有理由让其中一个消费者拥有数据

```typescript
// AnalysisService — 数据的自然 owner
class AnalysisService {
  private rawBuffer: RingBuffer          // 原始采样
  private pipeline: AnalysisPipeline | null // DSP 处理
  private frameOffset: number = 0

  // 录音时的 chunk 处理：两个平级消费者
  private onAudioChunk = (chunk: Float32Array, rate: number) => {
    this.rawBuffer.write(chunk)              // 存原始数据（用于回放）
    this.pipeline?.pushChunk(chunk, rate)     // DSP 分析
  }

  // 回放时读原始采样
  getPlaybackSamples(): Float32Array {
    return this.rawBuffer.read()
  }
}
```

### RingBuffer 的位置

RingBuffer 是通用数据结构（不依赖任何音频概念），保持为独立文件。从 `src/audio/` 移到更中立的位置：

```
src/
├── audio/
│   └── AudioEngine.ts     # 纯硬件接口
├── dsp/
│   ├── RingBuffer.ts      # 通用循环缓冲（被 AnalysisService 持有）
│   └── ...
├── services/
│   └── AnalysisService.ts # 持有 rawBuffer: RingBuffer
```

---

## State Layer (Zustand)

### 设计原则

- 两个独立的 Zustand store，互不依赖
- Service 层可以直接 `store.getState()` 读写，无需 React 桥接
- 组件通过 selector 精准订阅，只重渲染变动的部分

### analysisStore

```typescript
import { create } from 'zustand'
import type { AppPhase, AppConfig, TargetBands } from '../types'
import { DEFAULT_CONFIG, VOWEL_PRESETS } from '../types'

interface AnalysisState {
  phase: AppPhase                     // 'idle' | 'requesting' | 'recording' | 'ready'
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
  dataSource: 'mic' | 'file' | null   // 数据来源（业务信息，不驱动引擎）
}

interface AnalysisActions {
  setPhase: (phase: AppPhase) => void
  setConfig: (config: Partial<AppConfig>) => void
  setActivePreset: (name: string | null) => void
  setBands: (bands: Partial<Record<'f0'|'f1'|'f2', [number, number]>>) => void
  reset: () => void
}

type AnalysisStore = AnalysisState & AnalysisActions
```

- `setBands`: 合并更新，只修改提供的 key
- `reset`: 恢复全部默认值
- 默认 bands 从 VOWEL_PRESETS['vowel-a'] 初始化

**Phase 写入权限分离：**

| Phase | 谁写入 | 含义 |
|-------|--------|------|
| `requesting` | UI (Toolbar) | 用户点击录音/追加 |
| `idle` | UI (Toolbar) | 用户点击清空 |
| `ready` | UI (停止录音) / Service (导入完成) | 两处都可以写入 |
| `recording` | **仅 Service** (startEngine 成功) | 引擎已启动，UI 永远不直接设置 |

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

## Service Layer

### 设计思路：Phase 观察者模式

`AnalysisService` 不是被组件调用的"方法集合"，而是**启动时注册的 phase 监听器**。组件只通过 `dispatch(setPhase('recording'))` 表达意图，Service 自动响应。组件完全不知道 Service 的存在。

### Phase 精简原则

Phase 的职责是**驱动音频引擎**。它只回答一个问题："引擎现在该做什么？"

当前 6 个 phase 混合了两个正交维度——引擎状态和数据存在状态：

```
                引擎停止          引擎运行
无数据            idle              -
有数据(录音)      paused            -
有数据(文件)      uploaded          -
```

实际上 `paused` 和 `uploaded` 从引擎视角完全等价——引擎停止、buffer 有数据。区别在于数据来源（录音 vs 导入），这是业务信息，不应编码在 phase 里。

**精简后 4 个 phase：**

```
idle ──→ requesting ──→ recording
  ↑                        │
  │                        ↓
  └────── ready ◄──────────┘
```

| Phase | 引擎状态 | Buffer | 含义 |
|-------|---------|--------|------|
| `idle` | 停止 | 空 | 初始状态，或清空后 |
| `requesting` | 启动中 | 空 | mic 权限请求中 |
| `recording` | 运行 | 有数据 | 引擎正在采集 |
| `ready` | 停止 | 有数据 | 可播放、可追加录音 |

**数据来源下沉到 analysisStore：**

```typescript
dataSource: 'mic' | 'file' | null
```

- `'mic'` — 数据来自录音
- `'file'` — 数据来自 WAV 导入
- `null` — 无数据

### Phase 状态机变迁

| 变迁 | 触发者 | 副作用 |
|------|--------|--------|
| `idle → requesting` | UI | 无（UI 显示加载） |
| `requesting → recording` | Service | 创建 Pipeline, 启动引擎 |
| `requesting → idle` | Service (失败) | 恢复空闲 |
| `recording → ready` | UI | flush pipeline, 停止引擎, dataSource='mic' |
| `ready → requesting` | UI | 同上 + 保留 frameOffset 追加 |
| `recording → idle` | UI (清空) | 停止引擎, 清空数据 |
| `ready → idle` | UI (清空) | 清空 buffer, 清空 frames, 重置 |
| `(any) → ready` | Service (导入) | 解析 WAV, 写入 buffer, dataSource='file' |

### AnalysisService

纯 TS 模块，不依赖 React。通过 Zustand `subscribe` 监听 phase 变迁，自动执行对应副作用。

```typescript
// src/services/AnalysisService.ts
import { useAnalysisStore } from '../store/analysisStore'
import { useFrameStore } from '../store/frameStore'
import { getAudioEngine } from '../audio'
import { AnalysisPipeline, parseWav, Resampler, RingBuffer } from '../dsp'

class AnalysisService {
  private rawBuffer: RingBuffer           // 原始采样存储
  private pipeline: AnalysisPipeline | null = null
  private frameOffset: number = 0
  private unsubPhase: (() => void) | null = null

  constructor() {
    // 10 秒容量 = 16000 * 10 采样点
    this.rawBuffer = new RingBuffer(16000 * 10)
  }

  // 启动 phase 监听 —— 在应用初始化时调用一次
  start(): void {
    this.unsubPhase = useAnalysisStore.subscribe(
      (state, prev) => {
        if (state.phase === prev.phase) return
        this.handlePhaseChange(prev.phase, state.phase)
      }
    )
  }

  // 停止监听，清理资源
  destroy(): void {
    this.unsubPhase?.()
    this.cleanupAll()
  }

  // ── Phase 变迁处理 ──

  private async handlePhaseChange(from: Phase, to: Phase): Promise<void> {
    // 停止引擎：recording → 任何非 recording
    if (from === 'recording' && to !== 'recording') {
      this.stopCapture()
    }

    // 启动引擎：任何 → requesting（成功后 phase 变为 recording）
    if (to === 'requesting') {
      await this.startCapture()
    }

    // 清空：任何 → idle
    if (to === 'idle') {
      this.rawBuffer.clear()
      useFrameStore.getState().clear()
      useAnalysisStore.getState().reset()
    }
  }

  // ── 录音引擎控制 ──

  // 录音时两个平级消费者
  private onAudioChunk = (chunk: Float32Array, rate: number) => {
    this.rawBuffer.write(chunk)              // 存储原始采样
    this.pipeline?.pushChunk(chunk, rate)     // DSP 分析
  }

  private async startCapture(): Promise<void> {
    const state = useAnalysisStore.getState()

    // 追加录音：保留 frameOffset；首次/从文件导入：重置
    if (state.dataSource === 'mic' && state.phase === 'requesting') {
      // 追加录音，frameOffset 保持（stopCapture 中已累加）
    } else {
      this.frameOffset = 0
      this.rawBuffer.clear()
      useFrameStore.getState().clear()
    }

    // 快照 config
    const config = state.config

    this.pipeline = new AnalysisPipeline({
      onFrame: (frame) => {
        useFrameStore.getState().appendFrame(frame)
      },
      formantMethod: config.formantMethod,
      formantSmoothing: config.formantSmoothing,
      frameOffset: this.frameOffset,
    })

    try {
      await getAudioEngine().startCapture(this.onAudioChunk)
      useAnalysisStore.setState({
        phase: 'recording',
        dataSource: 'mic',
      })
    } catch (err) {
      console.error('Failed to start recording:', err)
      useAnalysisStore.setState({ phase: 'idle', dataSource: null })
    }
  }

  private stopCapture(): void {
    if (this.pipeline) {
      this.pipeline.flush()
      this.frameOffset += this.pipeline.frameCount
      this.pipeline.reset()
      this.pipeline = null
    }
    getAudioEngine().stopCapture()

    // 引擎停止，有数据 → ready
    if (useFrameStore.getState().frames.length > 0) {
      useAnalysisStore.setState({
        phase: 'ready',
        dataSource: 'mic',
      })
    }
  }

  // ── 回放 ──

  getPlaybackSamples(): Float32Array {
    return this.rawBuffer.read()
  }

  // ── WAV 导入（外部触发） ──

  async uploadWav(arrayBuffer: ArrayBuffer): Promise<void> {
    const state = useAnalysisStore.getState()

    if (state.phase === 'recording') {
      this.stopCapture()
    }

    const parsed = parseWav(arrayBuffer)
    let samples = parsed.samples
    let rate = parsed.sampleRate

    if (rate !== 16000) {
      samples = new Resampler(rate, 16000).process(samples)
    }

    const maxSamples = 16000 * 10
    if (samples.length > maxSamples) {
      throw new Error('音频不能超过 10 秒')
    }

    // 写入原始采样
    this.rawBuffer.clear()
    this.rawBuffer.write(samples)

    // 批量分析
    useFrameStore.getState().clear()
    const config = state.config
    const frames = AnalysisPipeline.analyze(
      samples, 16000, config.formantMethod, config.formantSmoothing
    )

    useFrameStore.getState().setFrames(frames)
    useAnalysisStore.setState({
      phase: 'ready',
      dataSource: 'file',
    })
  }

  // ── 清理 ──

  private cleanupAll(): void {
    this.pipeline?.reset()
    this.pipeline = null
    getAudioEngine().stopCapture()
    this.rawBuffer.clear()
  }
}

// 单例
let instance: AnalysisService | null = null

export function getAnalysisService(): AnalysisService {
  if (!instance) {
    instance = new AnalysisService()
  }
  return instance
}

export function resetAnalysisService(): void {
  instance?.destroy()
  instance = null
}
```

### useAnalysisService

React hook，管理 AnalysisService 生命周期 + WAV 导入的 DOM 桥接。**不再暴露 startRecording/stopRecording/clearAll** ——这些操作通过 dispatch phase 触发。

```typescript
// src/hooks/useAnalysisService.ts
function useAnalysisService(): {
  uploadWav: () => void          // 触发 hidden file input
}
```

- `useEffect` 中调用 `getAnalysisService().start()`，cleanup 时 `destroy()`
- `uploadWav`: 管理 hidden `<input type="file">` ref，在 onChange 中调用 `service.onImport(arrayBuffer)`

### 关键设计决策

1. **Phase 只驱动引擎**：4 个 phase (`idle`/`requesting`/`recording`/`ready`) 只回答"引擎该做什么"，数据来源 (`mic`/`file`) 作为独立字段 `dataSource`
2. **`paused` 和 `uploaded` 合并为 `ready`**：从引擎视角，两者完全相同——引擎停止、buffer 有数据
3. **AudioEngine 不持有数据**：纯硬件接口，原始采样和 RingBuffer 归 AnalysisService 所有。缓冲生命周期 > 引擎生命周期（stop 后仍需保留用于回放）
4. **Pipeline 独立于 AudioEngine**：唯一耦合是 callback。两个模块生命周期不同、WAV 导入只用 Pipeline、未来可独立替换 DSP 后端
5. **Config 快照**：`startCapture()` 中读取 config，后续 config 变更不影响运行中的 pipeline
6. **竞态保护**：引擎启动完成后检查 phase 是否仍匹配
7. **错误恢复**：getUserMedia 失败时回退到 `idle`

---

## UI Layer

### AnalysisPage（薄层，只做组装）

```tsx
export function AnalysisPage() {
  const phase = useAnalysisStore(s => s.phase)
  const { uploadWav } = useAnalysisService()
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <div>
      <Toolbar
        phase={phase}
        onUpload={uploadWav}
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
    </div>
  )
}
```

- 约 50-60 行
- 组件只做两件事：**dispatch 状态** + **渲染组件**
- 不引用 AudioEngine、AnalysisPipeline、ECharts
- 不管理 ref（除 usePlayback 内部和 uploadWav 的 file input）
- `onRecord`/`onClear` 等回调下沉到 Toolbar 内部，Toolbar 直接 dispatch phase

### F0Chart / FormantChart

- **完全移除 ChartHandles 接口**（不再有 imperative ref API）
- 从 frameStore 通过 selector 精准订阅，只有订阅的字段变化时才重渲染
- 目标区间从 analysisStore 响应式读取：`useAnalysisStore(s => s.bands)`
- 游标通过 useECharts hook 统一管理

```typescript
// F0Chart.tsx
function F0Chart() {
  const frames = useFrameStore(s => s.frames)       // 只订阅 frames
  const cursorTime = useFrameStore(s => s.cursorTime) // 只订阅 cursorTime
  const bands = useAnalysisStore(s => s.bands)      // 只订阅 bands
  const chartRef = useECharts({ cursorTime, bands })

  useEffect(() => {
    if (frames.length === 0) return
    // rAF 节流更新 ECharts
    const option = buildF0Option(frames, bands)
    chartRef.current?.setOption(option, { notMerge: false })
  }, [frames, bands])

  return <div ref={chartRef} />
}
```

不再需要 `forwardRef` + `useImperativeHandle`，图表是纯展示组件。

### useECharts hook 扩展

在现有基础上增加 cursor 管理：

```typescript
function useECharts(options: {
  cursorTime?: number        // from frameStore
  bands?: TargetBands        // from analysisStore
  onInit?: (instance) => void
}): MutableRefObject<EChartsInstance | null>
```

内部监听 cursorTime 变化，更新 chart 的 markLine 位置。同时监听 bands 变化更新 markArea 背景。移除 chart 组件内各自维护的 cursor 和 bands 同步逻辑。

### Toolbar

从 props 接收 `phase` 和 `onUpload`，录音/清空逻辑内部化：

```tsx
function Toolbar({ phase, onUpload, onConfig, onHelp, onAbout }) {
  const setPhase = useAnalysisStore(s => s.setPhase)
  const hasData = useFrameStore(s => s.frames.length > 0)
  const isRecording = phase === 'recording' || phase === 'requesting'

  const onRecord = () => {
    if (isRecording) {
      setPhase('ready')     // 停止 → Service 停止引擎，数据保留
    } else {
      setPhase('requesting') // 开始/追加 → Service 启动引擎
    }
  }

  const onClear = () => {
    setPhase('idle')        // Service 自动清理
  }

  // 有数据或引擎运行中时启用播放/清空
  const canPlay = phase === 'ready'
  const canClear = phase === 'ready' || phase === 'recording'

  return (/* 现有 JSX 不变 */)
}
```

### 组件变更汇总

| 组件 | 变更 |
|---|---|
| AnalysisPage | ~325→~60 行，只组装 + local UI state，无业务逻辑 |
| Toolbar | 内部化 onRecord/onClear，直接 dispatch phase；onUpload 保持 props |
| F0Chart | 改为响应式订阅 frameStore，cursor 委托 useECharts |
| FormantChart | 同上 |
| TargetPresetBar | 使用 analysisStore，dispatch preset/bands |
| ConfigDrawer | UI 状态局部化 (open/close) |
| HelpDrawer | UI 状态局部化 (open/close) |
| AboutModal | UI 状态局部化 (open/close) |
| Drawer | 不变 |
| Button | 不变 |
| Modal | 不变 |
| EmptyState | 不变 |
| TipWidget | 不变 |

### usePlayback 适配

`usePlayback` 的核心逻辑不变，但增加 phase 感知：

```typescript
function usePlayback() {
  const phase = useAnalysisStore(s => s.phase)
  const setPhase = useAnalysisStore(s => s.setPhase)
  // ... (内部 ref 不变)

  const play = (onProgress, onEnd) => {
    if (phase === 'recording') {
      setPhase('ready')
    }

    const service = getAnalysisService()
    const samples = service.getPlaybackSamples()   // 数据从 Service 拿
    if (samples.length === 0) return

    const { source, totalDuration } = getAudioEngine().createPlaybackSource(samples)
    // ... start + rAF tick，逻辑不变
  }
}
```

Toolbar 的播放按钮直接调用 `play()`，不再需要通过 AnalysisPage 中转。

### 未变更的部分

- `src/hooks/usePlayback.ts` — 核心逻辑不变，增加 phase 感知
- `src/components/Drawer.tsx` + CSS module — 不变
- `src/components/Button.tsx` + CSS module — 不变
- `src/components/Modal.tsx` + CSS module — 不变
- `src/components/EmptyState.tsx` — 不变
- `src/components/TipWidget.tsx` + CSS module — 不变
- `src/components/TargetPresetBar.tsx` — 逻辑不变，改用 analysisStore
- 所有 CSS module 文件 — 不涉及
- `vite.config.ts` — 不变
- `index.html` — 不变

---

## Data Flow（端到端，Phase 驱动）

所有用户操作通过 dispatch phase 完成。Service 层监听 phase 变化，自动执行引擎/Pipeline 的启停。

### 录音

```
用户点击"开始录音"
→ Toolbar.onRecord
  → analysisStore.setPhase('requesting')
    → Service 监听到 * → requesting:
      → 调用 startCapture()
        → 快照 config
        → 追加录音? 保留 frameOffset : 清空 rawBuffer + frames
        → new AnalysisPipeline({config, onFrame})
        → audioEngine.startCapture(onChunk)
          → getUserMedia → ScriptProcessorNode
            → onaudioprocess (1024 samples, ~15.6次/秒)
              → Service.onAudioChunk:
                  ├── rawBuffer.write(chunk)          ← 存原始采样
                  └── pipeline.pushChunk(chunk, rate)  ← DSP 分析
                    → Resampler → FrameProcessor
                      → per frame (100帧/秒):
                        VAD → pitch → formants → FormantSmoother
                        → onFrame(frame)
                          → frameStore.appendFrame(frame)
        → setPhase('recording') + dataSource='mic'

    [getUserMedia 失败]
      → setPhase('idle') + dataSource=null

用户点击"停止录音"
→ Toolbar.onRecord (当前 phase='recording')
  → analysisStore.setPhase('ready')
    → Service 监听到 recording → ready:
      → pipeline.flush() → 最后一帧
      → frameOffset += pipeline.frameCount
      → pipeline.reset() + pipeline = null
      → audioEngine.stopCapture()
      → dataSource = 'mic'
      // rawBuffer 保留，用于后续回放
```

### 导入 WAV

```
用户选择 .wav 文件
→ useAnalysisService.uploadWav handler
  → service.uploadWav(arrayBuffer)
    → 如果 phase='recording': 先 stopCapture()
    → parseWav → Resampler → 10s 检查
    → rawBuffer.clear() + rawBuffer.write(samples)   ← Service 直接写
    → frameStore.clear()
    → config = analysisStore.getState().config (快照)
    → AnalysisPipeline.analyze(samples, rate, config) → frames[]
    → frameStore.setFrames(frames)
    → analysisStore.setState({ phase: 'ready', dataSource: 'file' })
```

### 回放

```
用户点击播放 (仅在 phase='ready' 时可用)
→ Toolbar.onPlayback (通过 usePlayback hook)
  → 如果正在录音: analysisStore.setPhase('ready')  // 先停止
  → usePlayback.play(onProgress, onEnd)
    → service.getPlaybackSamples() → Float32Array        ← 数据来自 Service
    → audioEngine.createPlaybackSource(samples)           ← 播放能力来自 AudioEngine
    → rAF tick → onProgress(elapsed):
      frameStore.setCursorTime(elapsed + firstTime)
    → Charts 订阅 cursorTime → useECharts 更新 markLine
    → onEnd: frameStore.setCursorTime(-1)
```

### 清空

```
用户点击清空
→ Toolbar.onClear
  → analysisStore.setPhase('idle')
    → Service 监听到 * → idle:
      → stopEngine() (如果正在录音)
      → audioEngine.clear()
      → frameStore.clear()
      → analysisStore.reset()
```

### 配置变更

```
用户修改 formantMethod / smoothing
→ ConfigDrawer
  → analysisStore.setConfig({formantMethod: 'lpc'})
    → 仅更新 store，不影响运行中的 pipeline
    → 下次 startEngine() 快照时生效
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
| `src/types/index.ts` 中的 AppPhase | 从 6 状态精简为 4：`'idle' \| 'requesting' \| 'recording' \| 'ready'` |

---

