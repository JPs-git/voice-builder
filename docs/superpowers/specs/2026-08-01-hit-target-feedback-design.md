# 命中目标区间反馈系统设计

## 目标

为实时声音训练添加反馈效果：当用户发音（F0/F1/F2）命中目标区间时给出正向反馈；未命中时给出具体偏差提示（如"F0偏低""F2偏高"）。

架构上采用**可扩展反馈系统**：每个反馈类型是一个独立评估器（evaluator），未来可添加"真假声判断"等新反馈类型，只需新增 evaluator 并在注册表注册，组件零改动。

## 当前项目状态

- Zustand store（`src/store/appStore.ts`）持有 `frames`、`latestFrame`、`bands`、`stats`
- 实时录音时每秒约 20 帧，每帧调用 `appendFrame` 更新 `latestFrame`
- `TargetPresetBar` 显示目标区间预设并写入 `bands`
- 页面布局：左侧 `TargetPresetBar`（绝对定位），中间图表列（`max-width: 900px` 居中）

## 数据模型（`src/types/index.ts` 新增）

```ts
export type FeedbackStatus = 'hit' | 'miss' | 'idle'

export interface FeedbackResult {
  id: string               // 如 'hit-rate'
  label: string            // 显示名，如 '目标区间'
  status: FeedbackStatus   // hit=绿, miss=橙红, idle=灰
  message: string          // '完美' 或 'F0偏低 F2偏高' 或 '—'
}

export interface FeedbackContext {
  latestFrame: AnalysisFrame | null
  bands: TargetBands
}

export type FeedbackEvaluator = (ctx: FeedbackContext) => FeedbackResult | null
// 返回 null = 该行不显示（如无数据）
```

## 评估器层（新目录 `src/feedback/`）

```
src/feedback/
  status.ts     // getFormantStatus：单值命中判定（数值行与汇总行共用）
  hitRate.ts    // evaluateHitRate：汇总边界判定
  index.ts      // 注册表 FEEDBACK_EVALUATORS + useFeedback() hook
```

未来新增反馈类型（如真假声判断）：新建 `src/feedback/falsetto.ts`，导出 evaluator，在 `index.ts` 的 `FEEDBACK_EVALUATORS` 数组追加即可。

### getFormantStatus 逻辑（共享判定）

单维度命中判定，数值行着色与汇总行提示共用同一规则（低于下限=low，高于上限=high，含边界=hit）：

```ts
export type FormantStatus = 'hit' | 'low' | 'high' | 'none'

function getFormantStatus(
  value: number | null | undefined,
  range: [number, number],
): FormantStatus {
  if (value == null || !Number.isFinite(value)) return 'none'
  if (value < range[0]) return 'low'
  if (value > range[1]) return 'high'
  return 'hit'
}
```

### evaluateHitRate 逻辑

按区间边界判定（复用 `getFormantStatus`）：

```ts
const KEYS = ['f0', 'f1', 'f2'] as const

function evaluateHitRate({ latestFrame, bands }: FeedbackContext): FeedbackResult | null {
  if (!latestFrame) return null
  const hints: string[] = []
  let hasData = false
  let allHit = true
  for (const k of KEYS) {
    const status = getFormantStatus(latestFrame[k], bands[k].range)
    if (status === 'none') continue
    hasData = true
    if (status === 'low') { allHit = false; hints.push(`${k.toUpperCase()}偏低`) }
    else if (status === 'high') { allHit = false; hints.push(`${k.toUpperCase()}偏高`) }
  }
  if (!hasData) return null
  if (allHit) return { id: 'hit-rate', label: '目标区间', status: 'hit', message: '完美' }
  return { id: 'hit-rate', label: '目标区间', status: 'miss', message: hints.join(' ') }
}
```

### useFeedback hook

```ts
export function useFeedback(): FeedbackResult[] {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  return FEEDBACK_EVALUATORS
    .map(fn => fn({ latestFrame, bands }))
    .filter((r): r is FeedbackResult => r !== null)
}
```

## FeedbackCard 组件

`src/components/FeedbackCard.tsx` + `FeedbackCard.module.css`

- **常驻显示**：始终渲染（无数据时数值显示 `--`，汇总行显示 `—`），不返回 null
- 订阅 `useAppStore` 的 `latestFrame` + `bands` 渲染 F0/F1/F2 实时数值行；订阅 `useFeedback()` 渲染汇总行

### 视觉（无图标，纯颜色/字体区分）

```
┌───────────────────────┐
│ 实时反馈               │  ← header（加粗小字）
├───────────────────────┤
│ F0    220 Hz          │  ← 数值行（命中=绿 / 偏低偏高=橙 / 无数据='--' 灰）
│ F1    900 Hz          │
│ F2   1200 Hz          │
├───────────────────────┤
│ 目标区间               │  ← 汇总行标签（常规灰字 var(--text-soft)）
│ 完美                   │  ← hit: 绿色加粗 + 底部绿光晕脉冲
│ 目标区间               │
│ F0偏低  F2偏高         │  ← miss: 橙红色文字 + 加粗
└───────────────────────┘
```

数值行（每行 `data-status` 驱动着色，不带文字提示）：
- **hit**：值绿色（`var(--hit)`）+ `font-weight: 700`
- **low / high**：值橙色（`var(--warn)`）+ `font-weight: 700`
- **none**：值 `--` 灰色（`var(--text-mute)`）

汇总行状态区分（原逻辑保留）：
- **hit**：值文字绿色（`var(--hit)`）+ `font-weight: 700` + `@keyframes` 脉冲光晕（`box-shadow` 呼吸动画）
- **miss**：值文字橙红色（`var(--warn)`）+ 加粗
- 行标签统一灰色 `var(--text-soft)`

## 布局集成

- `AnalysisPage.tsx`：`<main>` 内用 `<div className={styles.sidePanel}>` 包裹 `<TargetPresetBar />` + `<FeedbackCard />`（flex column）
- `AnalysisPage.module.css`：新增 `.sidePanel`（`position: absolute; top: 16px; right: calc(50% + 466px); width: 220px; flex column; gap: 12px`），与图表列左侧对齐
- `TargetPresetBar.module.css`：`.bar` 移除自身绝对定位（保留 `max-height` + `overflow-y: auto`），由 `.sidePanel` 定位
- `FeedbackCard.module.css`：`.card` 移除绝对定位，改为静态、宽 100%
- 移动端（`max-width: 768px`）：`.sidePanel` 变 `static`、宽 100%，两卡片堆叠在图表上方

## 测试

- `src/__tests__/hitRate.test.ts`：getFormantStatus + evaluateHitRate 单元测试
  - getFormantStatus：hit / low / high / none / 边界（等于下限或上限 → hit）
  - 无 latestFrame → null
  - 全部命中 → `{ status: 'hit', message: '完美' }`
  - F0 低于下限 → miss + 'F0偏低'
  - F2 高于上限 → miss + 'F2偏高'
  - 多个偏离项合并
  - 某值 null 时忽略该维度（不误报）
  - 全部值 null → null（无可比数据）
- `src/__tests__/FeedbackCard.test.tsx`：组件渲染测试
  - 无数据 → 常驻渲染，显示 header + 三个 `--` + 汇总行 `—`
  - 有数据 → 显示 F0/F1/F2 具体 Hz 数值
  - 数值行 `data-status` 正确（hit/low/high/none）
  - 汇总行显示"完美"绿色 / 提示文字

## 不做的事（YAGNI）

- 不添加语音/音效反馈
- 不修改图表本身的命中高亮
- 不实现真假声判断（仅预留扩展机制）
