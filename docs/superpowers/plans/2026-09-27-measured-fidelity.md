# 实测文档像素级还原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 `docs/ui-design-portrait-measured.md`（实测，v1.1 不一致处以实测为准）为唯一依据，把竖版分析页按 390×844 实测几何重做到像素级；桌面/横屏零变动。

**Architecture:**延续既有做法——新 token 追加到 `css/style.css`（不动旧变量）；只改竖版媒体查询、mobile 组件与图表 `isPortrait` 分支；有真实断言可写的先测后做；`useToolbar` 单实例、`ShellContext` 透传不变。

**Tech Stack:** React 19 + TS + CSS Modules + ECharts 5 + Vitest 3。

**已裁定的冲突（用户确认）：** D1 作废（F0 曲线改回蓝色 `#2D7DFC`）；元音分段 Tab 回退为下拉式粉块（功能不变）；共振峰曲线保持实线（稀疏数据自然成点）；实测文档 §2.1 `brand/blue` 用途栏"F1、"两字视为笔误（F1 全红系，蓝色只属 F0 主曲线 + F2 图例点）；F1 目标虚线 hex 按 `#2D7DFC` 补齐。

**实测核心数值速查：** 页底 `#F4F9FC` / 边距 16 / 卡间距 12 / 卡圆角 6 无阴影；Header 内容区 ~28px（总高按 40px 做，标题 20 Bold `#0A2344`，Logo 高 24 宽自适应，⋯ 无边框 32px 视觉 / 44 触控，深藏青 ⌀4 圆点）；目标卡 125（标题 17 Bold，左粉块 62×27 + `a` 15pt `#EF627D` + ▾ 6pt，右行高 24、label 13–14 Bold、值 12–13、Hz 11pt `#909DB3`、语义条宽 2.3 高 16、F0 `#07C188` / F1 `#2D7DFC` / F2 `#FEB941`）；反馈卡 143.5（徽标 79×28 `#EFFCF8` + ⌀5 点 `#07C188` + 13pt `#00AE7B`；面板 336×65 `#F3FBFA`，F0 标签 11–12 绿、数值 28 Bold `#0A2344`、Hz 14pt `#909DB3`；三列标签 10pt、值 12–13 Bold + Hz 12pt、对勾圆 ⌀14 `#E9FBF7` + `#00AE7B`、分隔线 `#EAEAEB`）；图表卡 380（页签 16px / 未激活 `#A7B4C5` / 下划线 2px `#60A3FE` 宽约 62；基频容器 172：标题 14 Bold、图例 11pt `#67778D`、Y 0–500 六刻度 11pt `#7D8DA8`、X 七刻度 0–30s、女声带 `#FCEFF2` + `#FDCFD9` + 11pt 粉字、男声带 `#E4F3FE` + `#BEDAFD` + 11pt `#4691F5` 蓝字、曲线 `#2D7DFC` 2px + 末端 ⌀7 白环 + ⌀15 光晕；共振峰容器 151：标题 13–14 Bold、胶囊 29×15（1px `#EAF0F8`、⌀5 点、12pt `#0A2344`，F0 `#07C188` / F1 `#EF5064` / F2 `#2D7DFC`，间距 ~2.3）、Y 刻度 0/1000/2000/3000/3500、F2 带 `#FDF5EB` + `#FEB232`、F1 带 `#E9F2FE` + 蓝虚线、F0 只有绿虚线无色带、F1 红散点 `#EF5064` ⌀4–6、F2 蓝点）；Dock 总高 80 含系统区（环 ⌀58 `#F7E0E7` + 内圆 ⌀46 `#EE4264` + 白话筒 ~15×20；左 22×21 粉块 + 12pt 粉 `a` + 13pt 灰蓝字；右 13pt 灰蓝；顶圆角 8–10）；空状态 🎙 + 标题 + `点击下方开始录音`（已对，维持）。

---

### Task 1：实测 token + 页面基座（CSS only，无 DOM）

**Files:**
- Modify: `css/style.css`（`:root` 末尾追加实测 token 块，旧变量一行不动；`--font-sans` 不动）:
```css
  /* ---- measured-2026-09-27（仅竖版消费） ---- */
  --m-page: #F4F9FC;
  --m-text: #0A2344;
  --m-secondary: #909DB3;
  --m-axis: #7D8DA8;
  --m-legend: #67778D;
  --m-inactive: #A7B4C5;
  --m-green: #07C188;
  --m-check: #00AE7B;
  --m-green-soft: #EFFCF8;
  --m-circle: #E9FBF7;
  --m-mint: #F3FBFA;
  --m-blue: #2D7DFC;
  --m-underline: #60A3FE;
  --m-band-male: #E4F3FE;
  --m-dash-male: #BEDAFD;
  --m-label-male: #4691F5;
  --m-orange: #FEB941;
  --m-band-orange: #FDF5EB;
  --m-dash-orange: #FEB232;
  --m-pink: #EF627D;
  --m-pink-soft: #FCEFF2;
  --m-dash-pink: #FDCFD9;
  --m-chev: #7687A0;
  --m-record: #EE4264;
  --m-record-ring: #F7E0E7;
  --m-red: #EF5064;
  --m-divider: #EAEAEB;
  --m-card-border: #EBEFF8;
  --m-grid: #F0F4F9;
  --m-pill-border: #EAF0F8;
```
- Modify: `src/routes/AnalysisPage.module.css`（768px 块内 ONLY）：`.portraitMain` 背景 `var(--m-page)` + padding 上 16px→12px（左右 16、底部 116 保持）；`.portraitChartsCard` 圆角 16px→6px + 删 `margin-top: 12px`（与 gap 12 合成均匀 12 间距）+ 背景纯白 + 去阴影（`box-shadow: none`，覆盖 `.card` 的阴影）；`.chartPanel` 圆角→6px + 边框 `1px solid var(--m-card-border)`（无边框则加）；`.portraitTab` 指示条 2px 保持，颜色改 `var(--m-underline)`，宽改 62px（`left:0; right:auto; width:62px`——当前是全宽 `left:0;right:0`，只改这三处）；`.portraitTab` 字 14px/600 → **16px**（激活加粗 Bold 用 `font-weight: 700` 保持 data-active 结构），未激活色改 `var(--m-inactive)`；`.cardTitle`（图表内标题共用类——注意它也被桌面用！只在 `.portraitChartsCard` 后代作用域下覆盖：`.portraitChartsCard .cardTitle { font-size: 14px; font-weight: 700; color: var(--m-text); }`，基线不动）。

- [ ] **Step 1: 追加 token + 改基座值**
- [ ] **Step 2: 跑门禁**

Run: `grep -c "m-record-ring" css/style.css && npm run test:unit 2>&1 | tail -3 && npx tsc --noEmit`
Expected: `1` + 全过 + 干净（无 DOM 变动）

- [ ] **Step 3: Commit**

```bash
git add css/style.css src/routes/AnalysisPage.module.css
git commit -m "style(portrait): 实测基座（token/底色/6px圆角/12间距/页签16px）"
```

---

### Task 2：顶栏按实测重建（40px / 20 Bold / 无边框⋯）

**Files:**
- Modify: `src/components/Toolbar.module.css`（compact ONLY）：规则改为 `height: 40px; box-sizing: border-box; padding: 4px 16px;`（32px 内容 + 8 = 40）；`.logo` → `height: 24px; width: auto;`（宽波形素材等比）；`.title` → `font-size: 20px; font-weight: 700; color: var(--m-text);`
- Modify: `src/components/mobile/MobileMoreMenu.module.css`：`.trigger` → 视觉 32×32（`width:32px; height:32px`）+ 44 触控（`.trigger::after { content:""; position:absolute; inset:-6px; }` + `.trigger { position: relative; }`）+ 去边框去阴影（`border: none; box-shadow: none; background: transparent;`）+ 圆点深色（`color: var(--m-text); font-size: 20px; letter-spacing: 1px;` 保持 ⋯ 字符）；`.menu` 保持。
- Test: `src/__tests__/AppShellPortrait.test.tsx`（不动，即门禁——data-compact/菜单行为不变）。

- [ ] **Step 1: 改值（先读文件保结构）**
- [ ] **Step 2: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/AppShellPortrait.test.tsx src/__tests__/MobileMoreMenu.test.tsx && npx tsc --noEmit`
Expected: 全过 + 干净

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.module.css src/components/mobile/MobileMoreMenu.module.css
git commit -m "style(portrait): 顶栏按实测（40px/20Bold/无边框32点）"
```

---

### Task 3：目标卡按实测重建（125px / 左右结构 / 下拉粉块 / 行24）

**Files:**
- Modify: `src/components/mobile/TrainingGoalCard.tsx`（`.body` 改回左右结构：左 `.vowelBox`（粉块下拉，见下）+ 右 `.bands`；删 `<VowelTabs>` 引用；下拉用原生 `<select aria-label="选择元音预设">`，`value={activePreset}` + `onChange={e => switchPreset(e.target.value)}`，选项同前；`BAND_BAR_COLORS` 改实测值 `{ f0: '#07C188', f1: '#2D7DFC', f2: '#FEB941' }`）
- Modify: `src/components/mobile/TrainingGoalCard.module.css`：`.card` padding 16px → `12px 14px`（实测左 13.7/顶 12.6）、圆角 16px → 6px、去阴影（`box-shadow: none`）、边框保持 hairline（`1px solid var(--color-border-default)` 沿用）；`.title` 17px/600 → **700** + 色 `var(--m-text)`（lh 24 保持）；`.body` 改回 `flex-direction: row` + `gap: 12px` + `align-items: stretch`；`.vowelBox` 重写为左列容器（`flex: 0 0 76px; border: 1px solid var(--m-card-border); border-radius: 6px; display: flex; align-items: center; justify-content: center;`）；`.select` 重写为粉块（`appearance: none; border: none; background: var(--m-pink-soft); border-radius: 6px; color: var(--m-pink); font-size: 15px; font-weight: 700; padding: 6px 20px 6px 10px; min-height: 27px; min-width: 62px; text-align: center;` + 深灰下拉三角 background-image `#7687A0` 右侧）；`.bands` gap 8px → **4px**（实测行距 4–5）；`.bandRow` 改为行容器 `height: 24px; min-height: 24px; flex: 0 0 auto; border: 1px solid var(--m-card-border); border-left: 2px solid var(--border-strong); border-radius: 6px; padding: 2px 8px;`（inputs 字 12–13px：`.bandKey` 13px/700 色 `var(--m-text)` + `min-width` 保持；`.bandInput` 13px/500 色 `var(--m-text)`；`.dash` 浅灰（`var(--m-secondary)`）；`.unit` 11px 色 `var(--m-secondary)`）；删 `VowelTabs` 相关残留（本文件无引用则跳过）。
- Delete: `src/components/mobile/VowelTabs.tsx`、`src/components/mobile/VowelTabs.module.css`、`src/__tests__/VowelTabs.test.tsx`（`git rm`，并 grep 确认无其他引用）。
- Test: `src/__tests__/TrainingGoalCard.test.tsx`（改回下拉断言：`getByLabelText('选择元音预设')` 为 select；`queryByRole('combobox')` 存在；切换预设走 change 事件；行编辑/回车用例保留只改字号无关断言——字号无断言则不动）。

- [ ] **Step 1: 先改测试并看红**

Run: `npx vitest run --project unit src/__tests__/TrainingGoalCard.test.tsx`
Expected: FAIL（无 select / 有 tabs）

- [ ] **Step 2: 最小实现 + `git rm` 三个 VowelTabs 文件**
- [ ] **Step 3: 变绿 + 全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add -A src/components/mobile/TrainingGoalCard.tsx src/components/mobile/TrainingGoalCard.module.css src/__tests__/TrainingGoalCard.test.tsx
git commit -m "feat(portrait): 目标卡按实测（125px/左右结构/粉块下拉/行24）"
```
（`git rm` 的删除包含在 `-A` 意图里——改用 `git add -A -- src/components/mobile/VowelTabs.* src/__tests__/VowelTabs.test.tsx` 显式收删除后再 commit，报告实际命令。）

---

### Task 4：反馈卡按实测（143.5px / 薄荷面板 / 三列小字 / ⌀14 对勾）

**Files:**
- Modify: `src/components/mobile/FeedbackHero.module.css`：`.card` padding 16px → `12px 14px` + 圆角 6px + 去阴影 + `min-height` 删 156（实测 143.5 自然高度，删下限避免撑高）；`.title` 700 保持 + 色 `var(--m-text)`；`.badge` padding 7px 10px → 高 28 定死（`height: 28px; padding: 0 10px;`）+ 底 `var(--m-green-soft)` 系（hit 沿用）+ 字 13px/600 色 hit `#00AE7B` 系（`.badge[data-tone=hit]` 色改 `var(--m-check)`；warn/error 沿用旧橙红逻辑不动——实测 warn `#F5A623` / error `#E65368` 与旧实现接近，保持）；`.badgeDot` 8px → 5px + hit 色 `var(--m-green)`；`.readout` 底改 `var(--m-mint)` + padding 改 `8px 12px 10px`；`.readoutLabel` 11–12px 绿（`font-size: 11px; color: var(--m-green)`）；`.readoutValue` 色改 `var(--m-text)`（28/700/34 保持）+ tabular 保持；`.readoutUnit` → 14px/400 色 `var(--m-secondary)`；列：`.columnKey` → 10px/400 色 `#5E8696`（实测列标签灰蓝，直接写 hex，加 dubbed 说明无 token——不新增变量）… wait，no-hardcode 约定要求 token。处理：`.columnKey { color: var(--m-secondary); }` 近似（#909DB3 vs #5E8696 有差）——决策：新增 `--m-col-label: #5E8696` 进 Task 1 的 token 块？Task 1 已派发。放到本任务：允许改 `css/style.css` 只追加这一行，并写进 commit。`.columnValue` → 12–13px Bold（`font-size: 13px; font-weight: 700; line-height: 1.2; color: var(--m-text)`）+ Hz 12px `var(--m-secondary)`（`.columnUnit` 12px/400）；`.columnStatus` → 14px 圆（`width: 14px; height: 14px; font-size: 10px;`）底 `var(--m-circle)` + hit 对勾 `var(--m-check)`（low/high/none 沿用旧逻辑色）；列分隔线色改 `var(--m-divider)`；删三列多余 padding（`.column` padding 4px → 2px）。
- Test: `src/__tests__/FeedbackHero.test.tsx`（不动，即门禁——断言文案/状态逻辑，无像素断言）。

- [ ] **Step 1: 改值（含 style.css 追加 `--m-col-label: #5E8696;` 一行）**
- [ ] **Step 2: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/FeedbackHero.test.tsx && npx tsc --noEmit`
Expected: 全过 + 干净

- [ ] **Step 3: Commit**

```bash
git add css/style.css src/components/mobile/FeedbackHero.module.css
git commit -m "style(portrait): 反馈卡按实测（143px/薄荷面板/小字三列/14对勾）"
```

---

### Task 5：图表区按实测（容器172/151 / 蓝F0 / 色带色线 / 小胶囊 / 坐标色）

**Files:**
- Modify: `src/components/F0Chart.tsx`（竖版 ONLY）：`F0_COLOR_PORTRAIT` → `#2D7DFC`；分区色改实测（女 `#FCEFF2` 带 + `#FDCFD9` 虚线 + 标签 `#EF627D`；男 `#E4F3FE` 带 + `#BEDAFD` 虚线 + 标签 `#4691F5`）——`TARGET_ZONES` 加 `dash` 与 `labelColor` 字段（桌面值同步换吗？桌面当前是粉 `#F5A9B8`/蓝 `#5BCEFA` 区 + 同色虚线；实测即设计稿，桌面当前就是按设计稿色做的近似——把桌面也换成实测三色组，保持两端一致，属同一视觉语言；但"桌面零变动"约束优先：只换竖版？桌面与竖版同源 `TARGET_ZONES`，分开定义 `TARGET_ZONES_DESKTOP`（旧值不动）与竖版实测组）；Y 轴 `interval: 100, max: 500`（竖版桌面共用？interval 加在竖版分支——ECharts option 层分支，桌面不动）；X 轴 label 保持秒格式。
- Modify: `src/components/FormantChart.tsx`（竖版 ONLY）：`PORTRAIT_COLORS` → `{ f0: '#07C188', f1: '#EF5064', f2: '#2D7DFC' }`；竖版 `markColor`/area 改：F2 区 `#FDF5EB` + 线 `#FEB232`、F1 区 `#E9F2FE` + 线 `#2D7DFC`、**F0 去掉 markArea 只留 `#07C188` 虚线**（竖版分支条件化 markArea，桌面不动）；Y 轴竖版 `{ max: 3500, interval: 500, axisLabel: formatter 只显示 0/1000/2000/3000/3500 其余空串 }`（桌面不动）；线宽竖版保持 2。
- Modify: `src/routes/AnalysisPage.module.css`（768px ONLY）：`.portraitChartsCard .chartArea` 高度 → F0 与共振峰无法用同一选择器区分——现状两个 `.chartArea` 共用规则。改法：给 AnalysisPortrait 里 F0 的 chartArea 加第二类 `f0Area`、共振峰加 `formantArea`（TSX 加类名，属结构微调，允许），CSS：`.f0Area { height: 140px; min-height: 140px; }`、`.formantArea { height: 120px; min-height: 120px; }`（容器 172/151 减去头 ~30 与 padding 即得）；359 断点同步等比缩小（F0 120 / 共振峰 105）；431–767 块 chart 340 删掉（实测最大容器 172，340 已作废，改回与基准一致 140/120——即删 431 块的 chart 覆盖）；图例：`.f0LegendLine` 背景改 `#2D7DFC`（当前 var(--color-info) 即 #4387F5，不对）；`.f0LegendZone` 改 `#FCEFF2`；`.f0LegendTarget` 改 `#2D7DFC` 虚线；图例字改 11px 色 `var(--m-legend)`（`.f0LegendItem`）；共振峰 pills 改小（`.legendItem` padding → `2px 8px`，min-height 删 32 改 `auto`，字 12px/500 色 `var(--m-text)`，圆点改 ⌀5——圆点是 TSX 内联 `style` 8px？现状 `<i style={{ background }}>` 无尺寸，尺寸走 CSS `.legendItem i` 8px——改 5px；pills 边框色改 `var(--m-pill-border)`）；`.chartPanelHeader` min-height 40 保持（实测头 ~30–40，取 40 上限兼容标题+图例同行）。
- Modify: `src/routes/AnalysisPortrait.tsx`：`SERIES_COLORS` → `{ f0: '#07C188', f1: '#EF5064', f2: '#2D7DFC' }`；F0 chartArea 加 `f0Area`、共振峰加 `formantArea`（仅类名）；其余不动。
- Test: `src/__tests__/PortraitChartOptions.test.tsx`（先改必红）：F0 线 `#2D7DFC`；女/男区 `#FCEFF2`/`#E4F3FE` + 虚线 `#FDCFD9`/`#BEDAFD` + 标签 `#EF627D`/`#4691F5`；formant 色 `['#07C188','#EF5064','#2D7DFC']`；F0 无 markArea（竖版断言 `seriesByName('F0').markArea` 为 undefined）；F1 区 `#E9F2FE` + 线 `#2D7DFC`；F2 区 `#FDF5EB` + 线 `#FEB232`；坐标字色 `#7D8DA8`（替换 `#8D9BAC` 断言）；Y 轴 formant `max: 3500, interval: 500`。

- [ ] **Step 1: 先改测试并看红**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx`
Expected: FAIL（多处色值/结构）

- [ ] **Step 2: 最小实现**
- [ ] **Step 3: 变绿 + 全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add src/components/F0Chart.tsx src/components/FormantChart.tsx src/routes/AnalysisPage.module.css src/routes/AnalysisPortrait.tsx src/__tests__/PortraitChartOptions.test.tsx
git commit -m "style(portrait): 图表按实测（蓝F0/色带色线/小胶囊/172-151容器）"
```

---

### Task 6：Dock 按实测（环58/钮46/左粉块/13字/顶圆角10）+ 最终验证

**Files:**
- Modify: `src/components/mobile/RecordDock.tsx`（结构微调允许）：左 goal 改为粉小块 + 文字两段（`[a] 当前目标 ›`——块 22×21 + 12pt 粉字，右接 13pt 灰蓝 `当前目标` + `›`；`goalLabel` 仍用短标签；`aria-label` 保持）；hint 字 13px（TSX 不动，CSS 改）；timer 保持 16/600（实测未给字号，v1.1 值沿用）；录音态 glyph/文案/计时逻辑不动。
- Modify: `src/components/mobile/RecordDock.module.css`：`.micHalo` 60px → 58px + 底 `var(--m-record-ring)`（透明去掉）；`.mic` 60px → 46px + 底 `var(--m-record)`（光晕 `box-shadow` 按比例改 `0 0 0 5px var(--m-record-ring)` 系——当前是 6px 粉 + 红投影，底色换实测，5px 环适配 46 钮）；`.mic svg` 24px → 显示 ~15×20（`width: 15px; height: 20px;`）；`.goalLabel` 改小块（`min-width: 22px; height: 21px; font-size: 12px; border-radius: 5px; background: var(--m-pink-soft); color: var(--m-pink);`）；`.goalHint` → 13px 色 `var(--m-secondary)`；`.hint` → 13px/400 色 `var(--m-secondary)`；`.dock` 圆角 20px → 10px + padding 上下 12px → 6px + `min-height: 70px`（58 环 + 12 = 70；padding-bottom 保持 `calc(6px + env(safe-area-inset-bottom))`）；360px 断点同步改小（halo 58→52？实测无 360 档，删 360 特殊规则、统一 58/46——删整块 `@media (max-width: 360px)`，报告说明）。
- Test: `src/__tests__/RecordDock.test.tsx` + `src/__tests__/layoutShells.test.tsx`（不动，即门禁——文案/aria/testid 全保留）。

- [ ] **Step 1: 改实现（无文案/测试变更）**
- [ ] **Step 2: 跑门禁**

Run: `npx vitest run --project unit src/__tests__/RecordDock.test.tsx src/__tests__/layoutShells.test.tsx && npx tsc --noEmit`
Expected: 全过 + 干净

- [ ] **Step 3: Commit**

```bash
git add src/components/mobile/RecordDock.tsx src/components/mobile/RecordDock.module.css
git commit -m "style(portrait): Dock按实测（环58/钮46/粉小块/顶圆角10）"
```

---

### Task 7：最终验证 + 实测目检清单

- [ ] **Step 1: 全量**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: 干净；全过；`✓ built`

- [ ] **Step 2: 实测目检**（有浏览器处，390×844）：Header ~40/标题20 Bold #0A2344/⋯无边框；目标卡 125/粉块下拉/行24；反馈 143/薄荷面板/⌀14对勾；图表卡 380/页签16/蓝F0/色带色线/小胶囊；Dock 80/环58钮46；底色 #F4F9FC；卡圆角 6 无阴影。
