# 竖版 Token 像素级还原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 `docs/ui-design-portrait.md` v1.0 为唯一依据，用新增 CSS 变量 + 竖版分支把分析页还原到 390×844 像素级，桌面/横屏零变动。

**Architecture:** 只做加法：`css/style.css` 追加新 token 变量（不动旧变量）；所有竖版 CSS 改用新变量；图表只改 `isPortrait` 分支；新增行为（录音计时、F0 末端圆点）先写测试再实现。`useToolbar` 单实例、`ShellContext` 透传等既有架构约束不变。

**Tech Stack:** React 19 + TS + CSS Modules + ECharts 5 + Vitest 3（unit/jsdom），沿用 `var(--*)` 设计语言。

---

## 决策点（与截图/旧实现冲突处，计划已按 token 裁定）

| # | 冲突 | 裁定 |
|---|---|---|
| D1 | F0 竖版线色：截图蓝 `#3B82F6` vs token 绿 `#13B98B` | 跟 token，改绿 |
| D2 | 共振峰 mark 区色：`bands` 库色（绿/蓝/橙）vs token 图表色 | 竖版改 token 色，桌面不动 |
| D3 | Dock 录音态文案：`■` + `再次点击停止` vs token `● 正在录音` + `00:04` 计时 | 跟 token，加本地计时器 |
| D4 | token 建议双图表不同时挤压，但用户已定堆叠同显 | 保持堆叠，页签维持锚点滚动 |
| D5 | TipWidget 在竖版会压住 Dock，截图/token 均无它 | `≤768px` 下 `display:none`，桌面保留 |

## 文件地图

- 修改：`css/style.css`（追加 token）、`src/routes/AnalysisPage.module.css`、`src/components/Toolbar.module.css`、`src/components/mobile/MobileMoreMenu.module.css`、`src/components/mobile/TrainingGoalCard.module.css`、`src/components/mobile/FeedbackHero.module.css`、`src/components/mobile/RecordDock.module.css`、`src/components/mobile/RecordDock.tsx`、`src/components/F0Chart.tsx`、`src/components/FormantChart.tsx`、`src/routes/AnalysisPortrait.tsx`（仅改 `SERIES_COLORS` 三个 hex）、`src/components/EmptyState.module.css`
- 测试：`src/__tests__/PortraitChartOptions.test.tsx`（改色值断言、加线宽/坐标色断言）、`src/__tests__/RecordDock.test.tsx`（录音态文案+计时器）。其余现有测试即回归门禁。
- 不碰：`useToolbar`、`useAnalysis`、`usePlayback`、`appStore`、`AnalysisLandscape`、桌面 CSS 基准规则。

---

### Task 0：追加设计 Token（无 DOM 变动）

**Files:**
- Modify: `css/style.css:44`（`:root` 末尾追加）

- [ ] **Step 1: 追加 token 块**

```css
  /* ---- ui-design-portrait v1.0（仅竖版消费，桌面不动） ---- */
  --font-sans: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
  --color-brand-primary: #E94262;
  --color-brand-primary-hover: #D93655;
  --color-brand-primary-soft: #FFF0F3;
  --color-text-primary: #18304A;
  --color-text-secondary: #6F8197;
  --color-text-tertiary: #9AA9BA;
  --color-surface-page: #F7F9FC;
  --color-border-default: #E4EAF0;
  --color-border-subtle: #EDF1F5;
  --color-border-strong: #D4DDE7;
  --color-success: #12A981;
  --color-success-soft: #E8F8F3;
  --color-warning: #F5A623;
  --color-warning-soft: #FFF6E5;
  --color-error: #E65368;
  --color-info: #4387F5;
  --color-info-soft: #EEF5FF;
  --color-chart-f0: #13B98B;
  --color-chart-f1: #E84C68;
  --color-chart-f2: #4387F5;
  --color-chart-f0-soft: #E9F8F3;
  --color-chart-f1-soft: #FFF0F3;
  --color-chart-f2-soft: #EEF5FF;
  --color-chart-grid: #EDF1F5;
  --color-chart-axis: #B8C4D1;
  --color-chart-target-line: #AAB7C5;
  --shadow-portrait-card: 0 2px 10px rgba(24, 48, 74, .06);
  --shadow-floating: 0 12px 32px rgba(24, 48, 74, .12);
```

注意：`--font-sans` 整行替换（仅首位加 `Inter`，其余不动）；其余旧变量一行不许改。

- [ ] **Step 2: 验证变量生效**

Run: `grep -c "color-chart-f0: #13B98B" css/style.css && npx tsc --noEmit`
Expected: `1` + tsc 无输出（CSS 不进 tsc，grep 即证据）

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "style(tokens): 追加竖版设计文档v1.0 token（桌面变量不动）"
```

---

### Task 1：页面布局度量（padding / 圆角 / 图表高 / 页签高）

**Files:**
- Modify: `src/routes/AnalysisPage.module.css`（仅 `@media (max-width: 768px)` 块内 + 新增 `≤359px` 块）
- Test: `src/__tests__/layoutShells.test.tsx`（不动，即门禁）

- [ ] **Step 1: 改竖版布局值**

```css
  .portraitMain {
    padding: 16px 16px 116px;   /* token: page padding 16 */
    gap: 12px;
  }
  .portraitChartsCard { border-radius: 16px; }
  .portraitTabs {
    min-height: 44px;            /* token: Chart Tab 44px */
  }
  .portraitTab[data-active="true"]::after {
    height: 3px;                 /* token: indicator 2–3px */
  }
  .portraitChartsCard .chartArea {
    min-height: 300px;           /* token: chart min-height 300 */
    height: 320px;
  }
  .chartPanel { border-radius: 12px; }  /* token radius-md */

@media (max-width: 359px) {
  .portraitMain { padding: 12px 12px 116px; }  /* token ≤359px: 12–16px */
}
```

目标卡/Hero 自身圆角 14→16 在 Task 3/4 做。这里只改本文件的类。

- [ ] **Step 2: 跑回归门禁**

Run: `npx vitest run --project unit src/__tests__/layoutShells.test.tsx`
Expected: PASS（DOM 未变）

- [ ] **Step 3: Commit**

```bash
git add src/routes/AnalysisPage.module.css
git commit -m "style(portrait): 对齐token布局度量（16/12间距，图表300px，页签44px）"
```

---

### Task 2：顶栏 64px + 溢出按钮 44×44

**Files:**
- Modify: `src/components/Toolbar.module.css`（仅 `[data-compact]` 规则）、`src/components/mobile/MobileMoreMenu.module.css`（仅 `.trigger`）
- Test: `src/__tests__/AppShellPortrait.test.tsx`（不动，即门禁）

- [ ] **Step 1: 改 compact 顶栏**

```css
.toolbar[data-compact="true"] {
  padding: 13px 16px;   /* 38px logo + 26 = 64px header */
  gap: 10px;
  border-bottom: none;
}
.toolbar[data-compact="true"] .title { font-size: 20px; font-weight: 800; }  /* token h1 */
```

- [ ] **Step 2: 改 trigger 为 44×44**

```css
.trigger {
  width: 44px;
  height: 44px;   /* token touch-target */
  border-radius: 13px;
}
```

其余 `.trigger` 声明不动。

- [ ] **Step 3: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/AppShellPortrait.test.tsx src/__tests__/MobileMoreMenu.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.module.css src/components/mobile/MobileMoreMenu.module.css
git commit -m "style(portrait): 顶栏64px与44触控目标"
```

---

### Task 3：目标卡 token 化（圆角/字号/文字色）

**Files:**
- Modify: `src/components/mobile/TrainingGoalCard.module.css`
- Test: `src/__tests__/TrainingGoalCard.test.tsx`（不动，即门禁）

- [ ] **Step 1: 替换色字与圆角**

```css
.card { border-radius: 16px; padding: 16px; border-color: var(--color-border-default); box-shadow: var(--shadow-portrait-card); }
.title { color: var(--color-text-primary); }
.targetIcon { color: var(--color-text-primary); }
.bandRow { border-radius: 8px; border-color: var(--color-border-default); }
.bandKey { font-size: 15px; font-weight: 700; color: var(--color-text-primary); font-family: inherit; }
.bandInput { font-size: 15px; font-weight: 500; color: var(--color-text-primary); }
.unit { font-size: 12px; color: var(--color-text-tertiary); }
.dash { color: var(--color-text-primary); }
.vowelBox { border-color: var(--color-border-default); border-radius: 8px; }
.select { color: var(--color-brand-primary); }
```

色条（`borderLeftColor: bands[key].color`）与粉盒结构不动（截图即绿/蓝/橙条）。

- [ ] **Step 2: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/TrainingGoalCard.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/mobile/TrainingGoalCard.module.css
git commit -m "style(portrait): 目标卡对齐token（16圆角，15正文，三级文字色）"
```

---

### Task 4：Hero token 化（28px 主数字 / 15px 三列 / 成功色）

**Files:**
- Modify: `src/components/mobile/FeedbackHero.module.css`
- Test: `src/__tests__/FeedbackHero.test.tsx`（不动，即门禁）

- [ ] **Step 1: 替换字号与配色**

```css
.card { border-radius: 16px; padding: 16px; border-color: var(--color-border-default); box-shadow: var(--shadow-portrait-card); }
.title { font-size: 17px; font-weight: 800; color: var(--color-text-primary); }  /* token h2 */
.readout { background: var(--color-chart-f0-soft); border-radius: 12px; }
.readoutLabel { color: var(--color-success); }
.readoutValue { font-size: 28px; font-weight: 700; line-height: 1.2; color: var(--color-text-primary); }
.readoutUnit { color: var(--color-text-secondary); }
.badge[data-tone="hit"] { background: var(--color-success-soft); color: var(--color-success); border-color: #B9E9CC; }
.columnKey { color: var(--color-text-secondary); }
.columnValue { font-size: 15px; font-weight: 500; color: var(--color-text-primary); }
.columnUnit { font-size: 12px; color: var(--color-text-tertiary); }
.columnStatus[data-status="hit"] { background: var(--color-success-soft); color: var(--color-success); }
```

warn 状态沿用现有 `--warn-soft`/`#B45309`（token warning `#F5A623` 偏黄、对比度不足，文字坚持可读性；偏差图标 `↑↓` 已符合 token §9）。

- [ ] **Step 2: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/FeedbackHero.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/mobile/FeedbackHero.module.css
git commit -m "style(portrait): Hero对齐token（28主数字，15三列，成功色）"
```

---

### Task 5：图表竖版配色 + 线宽 + 坐标（有真实断言，先改测试）

**Files:**
- Modify: `src/components/F0Chart.tsx`（竖版分支）、`src/components/FormantChart.tsx`（`PORTRAIT_COLORS` + `markColor` + 线宽）
- Test: `src/__tests__/PortraitChartOptions.test.tsx`（先改，必红）

- [ ] **Step 1: 改测试期望为 token 色**

```ts
// F0：线变绿，分区保持男女声带本色
expect(series.lineStyle.color).toBe('#13B98B')
expect(series.itemStyle.color).toBe('#13B98B')
expect(lastOption().color).toEqual(['#13B98B'])

// formant：绿/红/蓝
expect(lastOption().color).toEqual(['#13B98B', '#E84C68', '#4387F5'])
expect(seriesByName('F0').lineStyle.color).toBe('#13B98B')
expect(seriesByName('F0').lineStyle.width).toBe(2)
expect(seriesByName('F1').lineStyle.width).toBe(2)
expect(seriesByName('F2').lineStyle.width).toBe(2)

// formant mark 改 token 色（f1 例）
expect(f1.markArea.data[0][0].itemStyle.color).toBe('rgba(232, 76, 104, 0.1)')
expect(f1.markLine.lineStyle.color).toBe('rgba(232, 76, 104, 0.55)')

// 坐标与网格 token 化
expect(option.xAxis.axisLabel.color).toBe('#6F8197')
expect(option.xAxis.axisLabel.fontSize).toBe(11)
```

- [ ] **Step 2: 运行确认变红**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx`
Expected: FAIL（色值不符）

- [ ] **Step 3: 最小实现**

`F0Chart.tsx`：`F0_COLOR_PORTRAIT = '#13B98B'`（D1）。分区 `zoneColor` 不动（截图男女声带优先，token 未覆盖）。

`FormantChart.tsx`：

```ts
const PORTRAIT_COLORS = { f0: '#13B98B', f1: '#E84C68', f2: '#4387F5' }
const markColor = (k: keyof TargetBands) =>
  isPortrait ? PORTRAIT_COLORS[k] : currentBands[k].color
```

`lineStyle.width` 改为恒 `2`（token 2–3px，竖版不再区分 f0/f1/f2）。

`xAxis.axisLabel` 竖版改为 `{ show: true, color: '#6F8197', fontSize: 11, hideOverlap: true, formatter }`；`yAxis.axisLabel` 颜色 `#6F8197`（竖版桌面共用此对象时需分支——当前 `yAxis.axisLabel` 不分竖版，改为竖版时取 token 色）；`splitLine` 竖版取 `#EDF1F5`；`axisLine` 竖版取 `#B8C4D1`。桌面分支一律不动。

- [ ] **Step 4: 运行确认变绿**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/F0Chart.tsx src/components/FormantChart.tsx src/__tests__/PortraitChartOptions.test.tsx
git commit -m "style(portrait): 图表竖版改token色（绿/红/蓝），线宽2px，坐标token化"
```

---

### Task 6：F0 末端采样圆点 6–8px（先测后做）

**Files:**
- Modify: `src/components/F0Chart.tsx`（`renderChart` 内追加 `markPoint`）
- Test: `src/__tests__/PortraitChartOptions.test.tsx`（追加用例）

- [ ] **Step 1: 写失败测试**

```ts
it('marks the latest F0 sample with a 6-8px dot', () => {
  setMatchMedia(true)
  const st = useAppStore.getState()
  st.clearFrames()
  st.appendFrame({ time: 1, f0: 240, f1: 900, f2: 1200 })
  st.appendFrame({ time: 2, f0: 245, f1: 920, f2: 1250 })
  render(<F0Chart />)
  const mp = lastOption().series[0].markPoint
  expect(mp.data[0].coord).toEqual([2, 245])
  expect(mp.data[0].symbolSize).toBeGreaterThanOrEqual(6)
  expect(mp.data[0].symbolSize).toBeLessThanOrEqual(8)
})
```

（执行前先 `grep` 确认 `appendFrame`/`clearFrames` 签名；`AnalysisFrame` 需 `register` 字段时补 `register: 'chest'`。）

- [ ] **Step 2: 运行确认变红**

Expected: FAIL（无 markPoint）

- [ ] **Step 3: 最小实现**（`renderChart` 内，`seriesData` 之后）

```ts
const dots = data.filter(f => f.f0 != null && f.f0 > 0)
const lastDot = dots[dots.length - 1]
// series[0] 追加：
markPoint: lastDot ? {
  silent: true,
  symbol: 'circle',
  symbolSize: 7,
  itemStyle: { color: f0Color },
  data: [{ coord: [lastDot.time, lastDot.f0] }],
} : undefined,
```

- [ ] **Step 4: 运行确认变绿**，**Step 5: Commit**

```bash
git add src/components/F0Chart.tsx src/__tests__/PortraitChartOptions.test.tsx
git commit -m "feat(portrait): F0末端采样圆点7px"
```

---

### Task 7：Dock 按 token 重建（76px / 品牌色 / 录音计时）

**Files:**
- Modify: `src/components/mobile/RecordDock.tsx`、`src/components/mobile/RecordDock.module.css`
- Test: `src/__tests__/RecordDock.test.tsx`（先改，必红）

- [ ] **Step 1: 改测试**

```tsx
// idle 文案不变（截图与 token 一致）：'点击开始录音'
// recording：
expect(screen.getByLabelText('停止录音')).toBeTruthy()
expect(screen.getByTestId('dock-hint').textContent).toBe('正在录音')
expect(screen.getByTestId('dock-timer').textContent).toMatch(/^\d{2}:\d{2}$/)
// glyph：capturing 时为 ●（token），不再是 ■
```

计时器用 `vi.useFakeTimers()`：渲染 `isCapturing` 后 `advanceTimersByTime(4000)`，断言 `00:04`。

- [ ] **Step 2: 运行确认变红**

- [ ] **Step 3: 最小实现**

```tsx
const [elapsed, setElapsed] = useState(0)
useEffect(() => {
  if (!isCapturing) { setElapsed(0); return }
  const id = window.setInterval(() => setElapsed(s => s + 1), 1000)
  return () => window.clearInterval(id)
}, [isCapturing])
const timer = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
```

渲染：idle 保持 SVG 话筒 + `点击开始录音`；`isCapturing` 时 glyph 改 `●`、hint 改 `正在录音`、右侧加 `data-testid="dock-timer"` 显示计时。

```css
.dock {
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));  /* 内容 60 + 16 = 76px */
  box-shadow: var(--shadow-floating);
  border-radius: 20px 20px 0 0;
}
.micHalo { width: 60px; height: 60px; background: transparent; }  /* 光环改 .mic 外发光 */
.mic {
  width: 60px; height: 60px;   /* token 56–64 */
  background: var(--color-brand-primary);
  box-shadow: 0 0 0 6px var(--color-brand-primary-soft), 0 4px 12px rgba(233, 66, 98, .35);
}
.mic:active { transform: scale(.98); }  /* token pressed */
.mic:disabled { background: var(--color-text-tertiary); }
.goalLabel { background: var(--color-brand-primary-soft); color: var(--color-brand-primary); }
.hint { font-size: 12px; color: var(--color-text-secondary); }
```

- [ ] **Step 4: 变绿**，**Step 5: Commit**

```bash
git add src/components/mobile/RecordDock.tsx src/components/mobile/RecordDock.module.css src/__tests__/RecordDock.test.tsx
git commit -m "feat(portrait): Dock按token重建（76px栏，品牌色，录音计时）"
```

---

### Task 8：共振峰图例点色 + EmptyState caption + TipWidget 竖版隐藏

**Files:**
- Modify: `src/routes/AnalysisPortrait.tsx`（`SERIES_COLORS` 三值）、`src/routes/AnalysisPage.module.css`（`.f0LegendLine` 背景改 `var(--color-info)`，`.f0LegendZone` 改 `var(--color-chart-f1-soft)`）、`src/components/EmptyState.module.css`（`.desc` 13→12px）、`src/components/TipWidget.module.css`（`@media ≤768px` 加 `.widget { display: none; }`，D5）
- Test: 现有 suite 即门禁（无 DOM 变动）

- [ ] **Step 1: 改三处色值与隐藏规则**
- [ ] **Step 2: 跑 `layoutShells` + 全 `unit`**

Run: `npm run test:unit 2>&1 | tail -3`
Expected: 全过

- [ ] **Step 3: Commit**

```bash
git add src/routes/AnalysisPortrait.tsx src/routes/AnalysisPage.module.css src/components/EmptyState.module.css src/components/TipWidget.module.css
git commit -m "style(portrait): 图例点token色，空态12px，竖版隐藏TipWidget"
```

---

### Task 9：最终验证 + 390×844 目检清单

- [ ] **Step 1: 跑全量**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: tsc 无输出；全测试通过；`✓ built`

- [ ] **Step 2: 390×844 目检**（本环境无可用浏览器，需在有浏览器处执行：`npm run dev`，视口 390×844 截图，逐项打勾）

| 区域 | 核对项 |
|---|---|
| 顶栏 | 高 64px，标题 20px `#18304A`，`...` 44×44 圆角 |
| 目标卡 | 圆角 16，内边距 16，标题 17px，F0 行 15px，色条绿/蓝/橙 |
| Hero | 主数字 28px/700，面板 `#E9F8F3`，徽标绿底+`目标范围内`，三列 15px/500 |
| 图表 | F0 绿线 2px + 末端圆点，F1 红 / F2 蓝，坐标 11px `#6F8197`，网格浅灰，图高 ≥300px |
| Dock | 栏高 76px+安全区，话筒 60px `#E94262`+浅环，录音态 `正在录音` + `00:04` |
| 全局 | 页边 16，卡间距 12，无 TipWidget 悬浮钮遮挡 |
