# 声区检测设计 — 真声/混声/假声 三分类

日期: 2026-08-03

## 目标

在每帧分析中判断当前发声声区：真声（胸声/modal）、混声（mixed）、假声（falsetto），并在 UI 实时展示。

**分类依据（生理声学）**：

- 真声：声带厚实、闭合相长 → 高次谐波能量强 → H2 接近 H1（H1-H2 小），谐波丰富
- 假声：声带薄、闭合相短 → 基频能量占主导 → H1 远强于 H2（H1-H2 大），谐波稀疏
- 混声：介于两者之间（H1-H2 居中）

**文献支撑**：
- Lee et al. 2023《Differences Among Mixed, Chest, and Falsetto Registers》— H1-H2 三类单调递增：假声 > 混声 > 真声
- ICICSP 2025《A Falsetto Detection Algorithm》— SHR（次谐波比）为最显著区分特征之一，假声时低
- Keating 2014《Acoustic measures of falsetto voice》— 谐波结构差异

## 特征集

全部从已有 FFT 幅度谱（1025 bins，dB，`analysis-pipeline.ts:115` 每帧已计算）提取，**零额外 FFT**：

| 特征 | 定义 | 真声 | 假声 |
|---|---|---|---|
| H1-H2 | 基频幅值 - 二次谐波幅值（dB） | 小（<3dB） | 大（>10dB） |
| harmonicCount | Hn > H1-20dB 的谐波数（n≥2） | 高（≥6） | 低（≤2） |
| SHR | mag(F0/2) / mag(F0) | 可有次谐波 | 低（<0.2） |

## 新模块

### 1. `src/dsp/harmonic-amplitudes.ts`（纯函数）

```ts
export interface HarmonicAmplitudes {
  h1: number | null   // dB
  h2: number | null
  h3: number | null
  h4: number | null
  harmonicCount: number      // Hn > H1 - 20dB 的谐波数（n≥2），计数到 Nyquist 上限
  shr: number | null         // mag(F0/2) / mag(F0)，仅当 F0/2 ≥ 50Hz
}

export function extractHarmonics(
  magnitudes: Float32Array,  // 1025 bins
  f0: number | null,
  sampleRate: number,        // 16000
): HarmonicAmplitudes
```

- `f0 === null` → 全部 null / harmonicCount=0
- 谐波峰搜索：中心 = n×F0，±60Hz 窗口取局部最大，抛物线插值提幅值
- 频点 → bin：`bin = freq * N / sampleRate`，N=2048

### 2. `src/dsp/register-detector.ts`（有状态 class）

```ts
export type VoiceRegister = 'chest' | 'mixed' | 'falsetto' | 'unvoiced'

export interface RegisterFrameInput {
  f0: number | null
  voiced: boolean
  magnitudes?: Float32Array
  sampleRate: number
}

export interface RegisterResult {
  register: VoiceRegister
  h1h2: number | null
  confidence: number  // 0..1
}

export class RegisterDetector {
  constructor(opts?: { mixedLow?: number; mixedHigh?: number; window?: number })
  push(input: RegisterFrameInput): RegisterResult
  reset(): void
}
```

**分类逻辑**：
1. `voiced=false` 或 `f0===null` → `unvoiced`
2. `extractHarmonics` → `h1h2 = h1 - h2`
3. h1h2 **5 帧中值平滑**（同 FormantSmoother 模式，抑制波动）
4. 主评分：`score = clamp((h1h2 - mixedLow) / (mixedHigh - mixedLow))`（3→0, 10→1）
5. 辅助修正：
   - `harmonicCount ≥ 6` → score −0.15（偏向真声）
   - `harmonicCount ≤ 2` → score +0.1（偏向假声）
   - `shr 存在且 < 0.2` → score +0.1（偏向假声）
6. 分类：`score < 0.35 → chest`，`0.35~0.65 → mixed`，`> 0.65 → falsetto`
7. `confidence` = 距最近分类边界的距离（clamp 0..1）

**初始阈值**：`mixedLow=3dB`、`mixedHigh=10dB`（Lee et al. 2023 / Keating 2014）。标注为初始值，后续用真实录音调优。

## 管线集成

`src/dsp/analysis-pipeline.ts`：
- `PipelineOptions` 加 `registerDetection?: boolean`（默认 true）
- 构造器持有 `_registerDetector: RegisterDetector | null`
- 在 `formantSmoother.push()` **之后**、`onFrame` 回调之前计算（约 127-130 行）：
  ```ts
  if (this._registerDetector) {
    const r = this._registerDetector.push({
      f0: output.f0, voiced, magnitudes, sampleRate: TARGET_RATE,
    })
    output.register = r.register
    output.registerConfidence = r.confidence
  }
  ```
- 用**平滑后** f0 保证稳定；`magnitudes` 随 `{...frame}` 传播
- `static analyze()` 加第 5 个参数 `registerDetection = true`

`src/dsp/formant-smoother.ts`：`SmootherFrame` 加 `register?: VoiceRegister | null`、`registerConfidence?: number | null`

`src/dsp/index.ts`：导出 `extractHarmonics`、`RegisterDetector`、类型

## 类型 & 配置

`src/types/index.ts`：
```ts
export type VoiceRegister = 'chest' | 'mixed' | 'falsetto' | 'unvoiced'

export interface AnalysisFrame {
  time: number
  f0: number | null
  f1: number | null
  f2: number | null
  f3?: number | null
  f4?: number | null
  voiced?: boolean
  magnitudes?: Float32Array          // 补齐缺失类型
  register?: VoiceRegister | null
  registerConfidence?: number | null
}

export interface AppConfig {
  formantMethod: FormantMethod['value']
  formantSmoothing: boolean
  registerDetection: boolean          // 新增，默认 true
}
// DEFAULT_CONFIG.registerDetection = true
```

`VoiceRegister` 定义在 types（共享契约层），dsp 单向 import，无循环依赖。

`src/hooks/useAnalysis.ts`：构造 pipeline 与 `analyze()` 时透传 `config.registerDetection`。

## UI

- **ConfigDrawer**：照抄 `formantSmoothing` checkbox 模式，加"声区检测"开关（默认开启），提示"生效于下次录音或导入"
- **FeedbackCard**：加一行声区状态：
  | register | 显示 | 颜色 |
  |---|---|---|
  | chest | 真声 | 绿 `var(--hit)` |
  | mixed | 混声 | 琥珀 `var(--warn)` |
  | falsetto | 假声 | 红 |
  | unvoiced/null | — | 置灰 `var(--text-mute)` |

  新增 CSS 类（沿用 valueRow/value 模式）

## 数据流

```
mic/WAV → AnalysisPipeline.pushChunk
           → 每帧: VAD → F0 → formants → magnitudes
           → FormantSmoother.push(output)          // 平滑 f0/f1/f2
           → RegisterDetector.push({f0, voiced, magnitudes})
             → output.register / registerConfidence
           → onFrame → appStore.appendFrame(frame)
                       → FeedbackCard 订阅 latestFrame.register → 显示声区
```

## 测试

| 文件 | 覆盖 |
|---|---|
| `src/__tests__/dsp/harmonic-amplitudes.test.js` | 纯正弦→H1-H2 大、harmonicCount 低、shr 低；锯齿波→H1-H2 小、harmonicCount 高；f0 null→全空；SHR 计算条件 |
| `src/__tests__/dsp/register-detector.test.js` | 正弦→falsetto；锯齿波→chest；中间态→mixed；无声→unvoiced；中值平滑稳定性；重置 |
| 更新 `analysis-pipeline.test.js` | register 字段存在；开关关闭时 register 为 null |
| 更新 `appStore.test.ts` | config 默认含 registerDetection |

**合成测试信号**：锯齿波（谐波丰富=真声）vs 纯正弦（仅基频=假声），物理上成立。

## 验证

- `npm test`（Vitest 两项目：dsp node + unit jsdom）
- `npx tsc --noEmit`
- `npm run build`

## 涉及文件

**新增**：`src/dsp/harmonic-amplitudes.ts`、`src/dsp/register-detector.ts`、`src/__tests__/dsp/harmonic-amplitudes.test.js`、`src/__tests__/dsp/register-detector.test.js`

**修改**：`src/dsp/analysis-pipeline.ts`、`src/dsp/formant-smoother.ts`、`src/dsp/index.ts`、`src/types/index.ts`、`src/hooks/useAnalysis.ts`、`src/components/ConfigDrawer.tsx`、`src/components/FeedbackCard.tsx`(+css)、`src/__tests__/dsp/analysis-pipeline.test.js`、`src/__tests__/appStore.test.ts`

## 调优 TODO

- [ ] 用真实录音采集真声/混声/假声样本，校准 `mixedLow`/`mixedHigh` 阈值
- [ ] 评估 SHR 检测下限（F0/2 ≥ 50Hz 限制对低音影响）
- [ ] 可选：增加 HNR 特征（需额外自相关/倒谱计算）
