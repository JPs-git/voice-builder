# 架构重构设计 — 全量分层

日期: 2026-07-30

## 目标

将 VoiceBuilder 从"单页面编排 + Context + imperative refs"架构重构为四层清晰分层的架构：
UI Layer → State Layer → Service Layer → Engine Layer。每层独立可测，边界清晰。

---

## 目录结构

```
src/
├── dsp/                       # Engine Layer: DSP (TS 迁移)
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
│
├── audio/                     # Engine Layer: 音频引擎
│   ├── AudioEngine.ts          # 从 src/ts/ 迁入
│   ├── RingBuffer.ts           # 从 src/ts/ 迁入
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
│   ├── AnalysisPage.tsx        # ~80 行, 仅组件组装
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
  phase: AppPhase
  config: AppConfig
  activePreset: string | null
  bands: TargetBands
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

### AnalysisService

纯 TS 类，不依赖 React。负责编排 AudioEngine + AnalysisPipeline 的交互。

```typescript
class AnalysisService {
  private pipeline: AnalysisPipeline | null = null
  private _frameOffset: number = 0
  private _wavInput: HTMLInputElement | null = null

  // 从 store 读取 config
  async startRecording(
    onFrame: (frame: AnalysisFrame) => void
  ): Promise<void>
  // - 从 analysisStore 读取 config
  // - new AnalysisPipeline(config)
  // - getAudioEngine().startStream(onChunk)
  // - pipeline.pushChunk → onFrame → frameStore.appendFrame

  stopRecording(): void
  // - pipeline.flush()
  // - frameOffset += pipeline.frameCount
  // - pipeline.reset()
  // - pipeline = null
  // - getAudioEngine().stopStream()
  // - analysisStore.setPhase('paused')

  cancelRecording(): void
  // - 同上但 frameOffset 不累加 (丢弃当前段)
  // - frameStore.clear()

  async importWav(file: ArrayBuffer): Promise<void>
  // - parseWav → Resampler → 检查时长
  // - AnalysisPipeline.analyze() → frames
  // - frameStore.setFrames(frames)
  // - getAudioEngine().importBuffer(samples)
  // - analysisStore.setPhase('uploaded')

  clearAll(): void
  // - pipeline.reset/clear
  // - getAudioEngine().stopStream() + clear()
  // - frameStore.clear()
  // - analysisStore.reset()

  reset(): void
  // 重置内部分段偏移
}
```

### useAnalysisService

React hook，管理 AnalysisService 实例生命周期：

```typescript
function useAnalysisService(): {
  startRecording: () => Promise<void>
  stopRecording: () => void
  importWav: () => void          // 触发 hidden file input
  clearAll: () => void
}
```

- `useRef<AnalysisService>` 创建单例
- `useEffect` 清理: 卸载时 stopRecording + clearAll
- `importWav`: 内部触发 hidden `<input type="file">`，在 onChange 中调用 service 的 `importWav(file)`

---

## UI Layer

### AnalysisPage（薄层）

```tsx
export function AnalysisPage() {
  const { startRecording, stopRecording, importWav, clearAll } = useAnalysisService()
  const phase = useAnalysisStore(s => s.phase)
  const [configOpen, setConfigOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const onRecord = useCallback(() => {
    if (phase === 'recording') { stopRecording(); return }
    startRecording()
  }, [phase, startRecording, stopRecording])

  return (
    <div>
      <Toolbar phase={phase} onRecord={onRecord} onImport={importWav}
               onClear={clearAll}
               onConfig={() => setConfigOpen(true)}
               onHelp={() => setHelpOpen(true)}
               onAbout={() => setAboutOpen(true)} />
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

- 约 60-80 行
- 不直接引用 AudioEngine、AnalysisPipeline、ECharts
- 不管理任何 ref（除 usePlayback 内部）

### F0Chart / FormantChart

- **完全移除 ChartHandles 接口**
- 从 frameStore 通过 selector 订阅 frames/latestFrame/stats
- 目标区间从 analysisStore 响应式读取：`useAnalysisStore(s => s.bands)`
- 游标通过 useECharts hook 统一管理

```typescript
// F0Chart.tsx
function F0Chart() {
  const frames = useFrameStore(s => s.frames)
  const bands = useAnalysisStore(s => s.bands)
  const chartRef = useECharts({ bands })

  useEffect(() => {
    // 根据 frames 更新 ECharts option
    chartRef.current?.setOption(...)
  }, [frames])

  // ...
}
```

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

### 组件变更汇总

| 组件 | 变更 |
|---|---|
| AnalysisPage | ~325→~80 行，删除所有 ref/logic，只组装 |
| F0Chart | 改为响应式订阅，cursor 委托 useECharts |
| FormantChart | 同上 |
| Toolbar | 从 props 接收 phase，无变化 |
| TargetPresetBar | 使用 analysisStore，无变化 |
| ConfigDrawer | UI 状态局部化 (open/close) |
| HelpDrawer | UI 状态局部化 (open/close) |
| AboutModal | UI 状态局部化 (open/close) |
| Drawer | 不变 |
| Button | 不变 |
| Modal | 不变 |
| EmptyState | 不变 |
| TipWidget | 不变 |

---

## Data Flow（端到端）

### 录音

```
用户点击"开始录音"
→ Toolbar → AnalysisPage.onRecord
→ useAnalysisService.startRecording()
  → analysisStore.getState().phase → 'recording' (set by service)
  → config = analysisStore.getState().config
  → AnalysisPipeline = new AnalysisPipeline(config)
  → getAudioEngine().startStream(onChunk)
    → pipeline.pushChunk(samples, rate)
      → onFrame:
        1. frameStore.getState().appendFrame(frame)
        2. [可选] 增量更新 stats
```

### 导入 WAV

```
用户选择 .wav 文件
→ useAnalysisService.importWav handler
  → parseWav(arrayBuffer)
  → Resampler (if needed)
  → 检查时长 ≤ 10s
  → AnalysisPipeline.analyze(samples, rate, config) → frames
  → frameStore.getState().setFrames(frames)
  → getAudioEngine().importBuffer(samples)
  → analysisStore.getState().setPhase('uploaded')
```

### 回放

```
用户点击播放
→ Toolbar → AnalysisPage.onPlayback
→ usePlayback.play(onProgress, onEnd)
  → getAudioEngine().getBuffer() → AudioBufferSourceNode
  → onProgress: frameStore.getState().setCursorTime(elapsed)
  → F0Chart / FormantChart subscribe to cursorTime → 更新 markLine
```

### 清空

```
用户点击清空
→ useAnalysisService.clearAll()
  → pipeline cleanup
  → audioEngine.stopStream() + clear()
  → frameStore.getState().clear()
  → analysisStore.getState().reset()
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
| `src/ts/AudioEngine.ts` | → `src/audio/AudioEngine.ts` |
| `src/ts/RingBuffer.ts` | → `src/audio/RingBuffer.ts` |
| `src/ts/index.ts` | → `src/audio/index.ts` |
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

---

## 未变更的部分

- `src/hooks/usePlayback.ts` — API 不变
- `src/components/Drawer.tsx` + CSS module — 不变
- `src/components/Button.tsx` + CSS module — 不变
- `src/components/Modal.tsx` + CSS module — 不变
- `src/components/EmptyState.tsx` — 不变
- `src/components/TipWidget.tsx` + CSS module — 不变
- 所有 CSS module 文件 — 不涉及
- `vite.config.ts` — 不变
- `index.html` — 不变
