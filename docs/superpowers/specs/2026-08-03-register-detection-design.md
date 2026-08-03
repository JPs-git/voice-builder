# 声区检测设计 — 真声/混声/假声 三分类

日期: 2026-08-03

## 目标

在每帧分析中判断当前发声声区：真声（胸声/modal）、混声（mixed）、假声（falsetto），并在 UI 实时展示。

## 判别依据

基于 FFT 幅度谱的**谐波结构**（特征提取见下）：

- 真声：声带厚实、闭合相长 → 谐波丰富，harmonicCount 高（~7）
- 假声：声带薄、闭合相短 → 谐波稀疏，仅基频 + 二次谐波占主导，harmonicCount 低（~1.8）
- 混声：介于两者之间（~3）

> 本项目测量的是麦克风**辐射谱**（含共振峰与麦克风频率响应），**harmonicCount（谐波丰富度）为主判据**，对录音电平不敏感。

文献支撑：Lee et al. 2023《Differences Among Mixed, Chest, and Falsetto Registers》与 Keating 2014《Acoustic measures of falsetto voice》— 谐波结构的丰富度差异是区分声区的基础。

## 特征集

全部从每帧已有 FFT 幅度谱（1025 bins，dB，`analysis-pipeline.ts` 已计算）提取，**零额外 FFT**：

| 特征 | 定义 | 作用 |
|---|---|---|
| harmonicCount | Hn > H1−20dB 的谐波数（n≥2） | **主判据** |
| SHR | mag(F0/2) / mag(F0) | 保留提取，分类器不使用 |

阈值由 3 个标注真实录音校准（均 /a/）：真声 harmonicCount≈7、混声≈3、假声≈1.8。

## 实现

### 1. `src/dsp/harmonic-amplitudes.ts`（纯函数）

```ts
export interface HarmonicAmplitudes {
  valid: boolean          // 检测到有效基频峰（H1）
  harmonicCount: number   // Hn > H1 - 20dB 的谐波数（n≥2），计数到 Nyquist 上限
  shr: number | null      // mag(F0/2) / mag(F0)，仅当 F0/2 ≥ 50Hz
}

export function extractHarmonics(
  magnitudes: Float32Array,  // 1025 bins
  f0: number | null,
  sampleRate: number,        // 16000
): HarmonicAmplitudes
```

- `f0 === null` → `valid=false` / harmonicCount=0 / shr=null
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
  confidence: number  // 0..1
}

export class RegisterDetector {
  constructor(opts?: { chestCount?: number; falsettoCount?: number; window?: number })
  push(input: RegisterFrameInput): RegisterResult
  reset(): void
}
```

**分类逻辑**：
1. `voiced=false`、`f0===null` 或 `valid=false` → `unvoiced`
2. `extractHarmonics` → `harmonicCount`，记入 **5 帧中值平滑**
3. 主判据（harmonicCount 阈值）：
   - `smoothedCount ≥ chestCount(5)` → `chest`
   - `smoothedCount ≤ falsettoCount(2)` → `falsetto`
   - 其余 → `mixed`
4. `confidence` = 到最近阈值的归一化距离（清晰极端→高）

## 管线集成

`src/dsp/analysis-pipeline.ts`：
- 声区检测**始终开启**（不设配置开关）
- 构造器持有 `_registerDetector: RegisterDetector`
- 在 `formantSmoother.push()` **之后**、`onFrame` 回调之前计算：
  ```ts
  const r = this._registerDetector.push({
    f0: output.f0, voiced, magnitudes, sampleRate: TARGET_RATE,
  })
  output.register = r.register
  output.registerConfidence = r.confidence
  ```
- 用**平滑后** f0 保证稳定；`magnitudes` 随 `{...frame}` 传播
- `static analyze()` 参数不含声区开关

`src/dsp/formant-smoother.ts`：`SmootherFrame` 含 `register?: VoiceRegister | null`、`registerConfidence?: number | null`

`src/dsp/index.ts`：导出 `extractHarmonics`、`RegisterDetector`、类型

## 类型

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
```

`VoiceRegister` 定义在 types（共享契约层），dsp 单向 import，无循环依赖。

`src/hooks/useAnalysis.ts`：构造 pipeline 与 `analyze()` 时透传 `formantMethod`、`formantSmoothing`（声区检测始终开启，无需透传）。

## UI

- **ConfigDrawer**：不设"声区检测"开关，始终开启
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
| `src/__tests__/dsp/harmonic-amplitudes.test.js` | 纯正弦→valid、harmonicCount 低、shr 低；锯齿波→harmonicCount 高；f0 null/空谱→valid=false；SHR 计算条件；低 F0 次谐波窄窗回归 |
| `src/__tests__/dsp/register-detector.test.js` | 正弦→falsetto；锯齿波→chest；中间态→mixed；无声→unvoiced；中值平滑稳定性；重置；3 个真实签名（富谐波→chest / 3 谐波→mixed / 稀疏→falsetto）；confidence |
| `src/__tests__/dsp/register-assets.test.js` | 标注真实录音回归：真声→chest、混声→mixed、假声→falsetto（≥85% voiced 帧，容混声演唱中段瞬时变薄抖动） |
| `src/__tests__/dsp/analysis-pipeline.test.js` | register 字段与 registerConfidence 存在；纯正弦→falsetto |
| `src/__tests__/appStore.test.ts` | config 默认值（声区检测无配置项） |

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

**集成**：`src/dsp/analysis-pipeline.ts`、`src/dsp/formant-smoother.ts`、`src/dsp/index.ts`、`src/types/index.ts`、`src/hooks/useAnalysis.ts`、`src/components/FeedbackCard.tsx`(+css)

**测试**：`src/__tests__/dsp/harmonic-amplitudes.test.js`、`src/__tests__/dsp/register-detector.test.js`、`src/__tests__/dsp/register-assets.test.js`、`src/__tests__/dsp/analysis-pipeline.test.js`、`src/__tests__/appStore.test.ts`

**标注样本**：`assets/a_true_vocal.wav`、`assets/a_mix_vocal.wav`、`assets/a_false_vocal.wav`

## 调优 TODO

- [ ] 跨元音验证 / LPC 反滤波还原声源谱，消除共振峰污染
- [ ] 采集其他元音 × 声区标注样本，校准并验证
- [ ] 评估更大平滑窗或双判据，抑制混声瞬时变薄抖动
- [ ] 可选：增加 HNR 特征（需额外自相关/倒谱计算）
