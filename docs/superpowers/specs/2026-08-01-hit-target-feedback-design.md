# 命中目标区间反馈系统设计

## 目标

为实时声音训练添加反馈效果：当用户发音（F0/F1/F2）命中目标区间时给出正向反馈；未命中时给出具体偏差提示（如"F0偏低""F2偏高"）。

架构上采用**可扩展反馈系统**：每个反馈类型是一个独立评估器（evaluator），未来可添加"真假声判断"等新反馈类型，只需新增 evaluator 并在注册表注册，组件零改动。

## 当前项目状态

- Zustand store（`src/store/appStore.ts`）持有 `frames`、`latestFrame`、`bands`、`stats`
- 实时录音时每秒约 20 帧，每帧调用 `appendFrame` 更新 `latestFrame`
- `TargetPresetBar` 显示目标区间预设并写入 `bands`
- 页面布局：左侧 `TargetPresetBar`（绝对定位），中间图表列（`max-width: 900px` 居中），右侧空白

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
  hitRate.ts    // evaluateHitRate：边界判定
  index.ts      // 注册表 FEEDBACK_EVALUATORS + useFeedback() hook
```

未来新增反馈类型（如真假声判断）：新建 `src/feedback/falsetto.ts`，导出 evaluator，在 `index.ts` 的 `FEEDBACK_EVALUATORS` 数组追加即可。

### evaluateHitRate 逻辑

按区间边界判定（低于下限=偏低，高于上限=偏高）：

```ts
const KEYS = ['f0', 'f1', 'f2'] as const

function evaluateHitRate({ latestFrame, bands }: FeedbackContext): FeedbackResult | null {
  if (!latestFrame) return null
  const hints: string[] = []
  let allHit = true
  for (const k of KEYS) {
    const v = latestFrame[k]
    const range = bands[k].range
    if (v == null || !Number.isFinite(v)) continue
    if (v < range[0]) { allHit = false; hints.push(`${k.toUpperCase()}偏低`) }
    else if (v > range[1]) { allHit = false; hints.push(`${k.toUpperCase()}偏高`) }
  }
  if (allHit) return { id: 'hit-rate', label: '目标区间', status: 'hit', message: '完美' }
  if (hints.length === 0) return null   // 无可比数据
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

- 订阅 `useFeedback()`，渲染结果列表为行
- 无任何结果时整个卡片不渲染

### 视觉（无图标，纯颜色/字体区分）

```
┌───────────────────────┐
│ 实时反馈               │  ← header（加粗小字）
├───────────────────────┤
│ 目标区间               │  ← 行标签（常规灰字 var(--text-soft)）
│ 完美                   │  ← hit: 绿色加粗 + 底部绿光晕脉冲
│ 目标区间               │
│ F0偏低  F2偏高         │  ← miss: 橙红色文字 + 加粗
│ 真假声判断             │  ← idle: 标签正常，值显示 '—' 灰色，行半透明
│ —                      │
└───────────────────────┘
```

状态区分：
- **hit**：值文字绿色（`var(--hit)`）+ `font-weight: 700` + `@keyframes` 脉冲光晕（`box-shadow` 呼吸动画）
- **miss**：值文字橙红色（`var(--warn)`）+ 加粗
- **idle**：值 `—` 灰色（`var(--text-mute)`）+ 行整体半透明
- 行标签统一灰色 `var(--text-soft)`

## 布局集成

- `AnalysisPage.module.css`：新增右侧面板样式，与 `TargetPresetBar` 对称（`left: calc(50% + 466px)`），`width: 220px`
- `AnalysisPage.tsx`：`<main>` 内加 `<FeedbackCard />`
- 移动端（`max-width: 768px`）：与 `TargetPresetBar` 一致，`position: static` 堆叠在图表下方

## 测试

- `src/__tests__/hitRate.test.ts`：evaluateHitRate 单元测试
  - 无 latestFrame → null
  - 全部命中 → `{ status: 'hit', message: '完美' }`
  - F0 低于下限 → miss + 'F0偏低'
  - F2 高于上限 → miss + 'F2偏高'
  - 多个偏离项合并
  - 某值 null 时忽略该维度（不误报）
  - 全部值 null → null（无可比数据）
- `src/__tests__/FeedbackCard.test.tsx`：组件渲染测试
  - 无结果 → 不渲染
  - hit 结果 → 显示"完美"绿色
  - miss 结果 → 显示提示文字
  - idle 结果 → 显示 '—'

## 不做的事（YAGNI）

- 不添加语音/音效反馈
- 不修改图表本身的命中高亮
- 不实现真假声判断（仅预留扩展机制）
