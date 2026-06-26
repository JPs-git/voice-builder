# F1/F2 专注型共振峰分析 — 设计文档

**日期**: 2026-06-26
**状态**: 已批准待实现

## 目标

改造 VoiceBuilder 的共振峰分析流程，将分析焦点从 F0–F4 缩窄到 F0–F2（侧重 F1/F2 准确度），通过降低最大共振峰频率、减少 LPC 阶数、缩减显示范围来实现。

## 改动清单

### 1. 分析算法参数

#### cepstral.js

| 字段 | 当前值 | 改为 |
|---|---|---|
| `MAX_FORMANT_FREQ` | 6500 | **3500** |
| `LIFTER_CUTOFF` | 25 | **不变** |
| `FFT_SIZE` | 1024 | **不变** |

`pickPeaks()` 中的 `freq > MAX_FORMANT_FREQ` 过滤自然排除 3500 Hz 以上的峰。

`extractFormantsCepstral()` 的 `maxFormants` 默认参数由调用方传入 2。

#### lpc.js

| 字段 | 当前值 | 改为 |
|---|---|---|
| `rootsToFormants()` 频率过滤 | `freq > 50 && freq < 6500` | `freq > 50 && freq < 3500` |
| `extractFormants()` 阶数公式 | `Math.min(Math.max(2 * maxFormants + 4, 18), Math.floor(signal.length / 3), 20)` | `Math.min(10, Math.floor(signal.length / 3))` |

阶数从动态公式改为固定最小值 10：2 个共振峰需要 ~4-6 阶，加 2 阶抵消谱倾斜，2-4 阶余量，10 阶是成熟经验值。`Math.floor(signal.length / 3)` 保留防短帧问题。

### 2. Pipeline 集成

#### analysis-pipeline.js

- 两处 `extractFormantsCepstral(frame.samples, frame.sampleRate)` → `extractFormantsCepstral(frame.samples, frame.sampleRate, 2)`
- 两处 `extractFormants(frame.samples, frame.sampleRate)` → `extractFormants(frame.samples, frame.sampleRate, 2)`
- `output` 对象保留 `f3: null` 和 `f4: null`（测试断言 `'f3' in f` / `'f4' in f` 仍通过）

### 3. FormantSmoother

#### formant-smoother.js

- `this._buffers` 初始化从 `{ f0, f1, f2, f3, f4 }` 改为 `{ f0, f1, f2 }`
- `push()` 中的 keys 遍历从 `['f0', 'f1', 'f2', 'f3', 'f4']` 改为 `['f0', 'f1', 'f2']`
- 第 77 行的 `lastFrame` 保存条件简化为检查 `f0, f1, f2` 均非 null

### 4. 共振峰图显示

#### formant-chart.js

| 字段 | 当前值 | 改为 |
|---|---|---|
| `FREQ_MAX` | 6500 | **3500** |
| `keys` (series 序列) | `['f0','f1','f2','f3','f4']` | **`['f0','f1','f2']`** |
| `COLORS` | 含 f3/f4 | **删除 f3/f4 条目** |
| `tooltipKeys` | `['f4','f3','f2','f1','f0']` | **`['f2','f1','f0']`** |
| `_seriesVisible` 初始化 | 含 f3/f4 | **删除 f3/f4** |
| `setTargetBands` | 已只处理 f0/f1/f2 | **不变** |

`setTargetBands()` 和 `setSeriesVisible()` 逻辑通用，按 key 匹配，无需改动。

#### spectrogram.js

完全不动（维持 6500 Hz 纵轴）。

### 5. HTML 图例

#### index.html

删除第 124-125 行：
```html
<button class="legend-item" data-key="f3" ...>F3</button>
<button class="legend-item" data-key="f4" ...>F4</button>
```

`main.js` 的 `initLegendToggle()` 通用处理，无需改动。

### 6. 配置抽屉

完全不动。算法切换（cepstral / LPC）和平滑开关的逻辑不变。

### 7. 测试影响

#### analysis-pipeline.test.js

- 第 26-27 行断言 `'f3' in f` 和 `'f4' in f`：output 对象仍保留这两个 key（值为 null），断言通过。
- 第 8 行关于 f1-f4 存在的注释可更新（非必需）。

其他 test 文件（fft, vad, resampler, frame-processor, wav-parser, pitch）不受影响。

## 实现顺序

按依赖关系：

1. `cepstral.js` — 修改常数
2. `lpc.js` — 修改常数和阶数公式
3. `formant-smoother.js` — 缩减 buffer keys
4. `analysis-pipeline.js` — 传 maxFormants=2
5. `formant-chart.js` — 缩减显示参数
6. `index.html` — 删除图例项
7. `npm test` 验证全部通过
