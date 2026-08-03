# 声区检测设计 — 真声/混声/假声 三分类

日期: 2026-08-03

## 目标

在每帧分析中判断当前发声声区：真声（胸声/modal）、混声（mixed）、假声（falsetto），并在 UI 实时展示。

## 判别依据

基于 FFT 幅度谱的**谐波结构**（特征提取见下）：

- 真声：声带厚实、闭合相长 → 谐波丰富，harmonicCount 高（~7）
- 假声：声带薄、闭合相短 → 谐波稀疏，仅基频 + 二次谐波占主导，harmonicCount 低（~1.8）
- 混声：介于两者之间（~3）

> 本项目测量的是麦克风**辐射谱**（含共振峰与麦克风频率响应），H1-H2 不采用文献（声源谱）的极性判断，**harmonicCount（谐波丰富度）为主判据**，对录音电平不敏感。

文献支撑：Lee et al. 2023《Differences Among Mixed, Chest, and Falsetto Registers》— H1-H2 与声区的理论关系（源谱层面）；Keating 2014《Acoustic measures of falsetto voice》— 谐波结构差异。

## 特征集

全部从每帧已有 FFT 幅度谱（1025 bins，dB，`analysis-pipeline.ts` 已计算）提取，**零额外 FFT**：

| 特征 | 定义 | 作用 |
|---|---|---|
| harmonicCount | Hn > H1−20dB 的谐波数（n≥2） | **主判据** |
| H1-H2 | 基频 − 二次谐波（dB，辐射谱） | 仅记录展示，不参与判别 |
| SHR | mag(F0/2) / mag(F0) | 保留提取，分类器不使用 |

阈值由 3 个标注真实录音校准（均 /a/）：真声 harmonicCount≈7、混声≈3、假声≈1.8。

## 实现

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
- SHR 次谐波：±15Hz 窄窗搜索（避免低 F0 时搜索窗框入基频主瓣）
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
  constructor(opts?: { chestCount?: number; falsettoCount?: number; window?: number })
  push(input: RegisterFrameInput): RegisterResult
  reset(): void
}
```

**分类逻辑**：
1. `voiced=false` 或 `f0===null` → `unvoiced`
2. `extractHarmonics` → `harmonicCount`，记入 **5 帧中值平滑**（`h1h2` 同步平滑，仅作展示）
3. 主判据（harmonicCount 阈值）：
   - `smoothedCount ≥ chestCount(5)` → `chest`
   - `smoothedCount ≤ falsettoCount(2)` → `falsetto`
   - 其余 → `mixed`
4. `confidence` = 到最近阈值的归一化距离（清晰极端→高）

## 管线集成

`src/dsp/analysis-pipeline.ts`：
- `PipelineOptions` 含 `registerDetection?: boolean`（默认 true）
- 构造器持有 `_registerDetector: RegisterDetector | null`
- 在 `formantSmoother.push()` **之后**、`onFrame` 回调之前计算：
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
- `static analyze()` 第 5 个参数 `registerDetection = true`

`src/dsp/formant-smoother.ts`：`SmootherFrame` 含 `register?: VoiceRegister | null`、`registerConfidence?: number | null`

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
  magnitudes?: Float32Array
  register?: VoiceRegister | null
  registerConfidence?: number | null
}

export interface AppConfig {
  formantMethod: FormantMethod['value']
  formantSmoothing: boolean
  registerDetection: boolean          // 默认 true
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
| `src/__tests__/dsp/harmonic-amplitudes.test.js` | 纯正弦→H1-H2 大、harmonicCount 低、shr 低；锯齿波→H1-H2 小、harmonicCount 高；f0 null→全空；SHR 计算条件；低 F0 次谐波窄窗回归 |
| `src/__tests__/dsp/register-detector.test.js` | 正弦→falsetto；锯齿波→chest；中间态→mixed；无声→unvoiced；中值平滑稳定性；重置；3 个真实签名（富谐波高 h1h2→chest / 3 谐波低 h1h2→mixed / 稀疏→falsetto） |
| `src/__tests__/dsp/register-assets.test.js` | 标注真实录音回归：真声→chest、混声→mixed、假声→falsetto（≥85% voiced 帧，容混声演唱中段瞬时变薄抖动） |
| `src/__tests__/dsp/analysis-pipeline.test.js` | register 字段存在；开关关闭时 register 为 null |
| `src/__tests__/appStore.test.ts` | config 默认含 registerDetection |

**合成测试信号**：锯齿波（谐波丰富=真声）vs 纯正弦（仅基频=假声），物理上成立。

## 已知局限

- 阈值仅在 /a/ 上校准；谐波特征受共振峰影响，跨元音可能失效（后续方向：LPC 反滤波还原声源谱）
- harmonicCount 含 F0 混叠（低音 modal 靠 F1 抬谐波数），modal 高音可能偏低
- 混声演唱中段瞬时变薄可能短暂判为假声（conf 卡在 0.5 边界）

## 验证

- `npm test`（Vitest 两项目：dsp node + unit jsdom）
- `npx tsc --noEmit`
- `npm run build`

## 涉及文件

**核心**：`src/dsp/harmonic-amplitudes.ts`、`src/dsp/register-detector.ts`

**集成**：`src/dsp/analysis-pipeline.ts`、`src/dsp/formant-smoother.ts`、`src/dsp/index.ts`、`src/types/index.ts`、`src/hooks/useAnalysis.ts`、`src/components/ConfigDrawer.tsx`、`src/components/FeedbackCard.tsx`(+css)

**测试**：`src/__tests__/dsp/harmonic-amplitudes.test.js`、`src/__tests__/dsp/register-detector.test.js`、`src/__tests__/dsp/register-assets.test.js`、`src/__tests__/dsp/analysis-pipeline.test.js`、`src/__tests__/appStore.test.ts`

**标注样本**：`assets/a_true_vocal.wav`、`assets/a_mix_vocal.wav`、`assets/a_false_vocal.wav`

## 调优 TODO

- [ ] 跨元音验证 / LPC 反滤波还原声源谱，消除共振峰污染
- [ ] 采集其他元音 × 声区标注样本，校准并验证
- [ ] 评估更大平滑窗或双判据，抑制混声瞬时变薄抖动
- [ ] 可选：增加 HNR 特征（需额外自相关/倒谱计算）
