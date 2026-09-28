# v1.1 高度与排印全量还原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 `docs/ui-design-portrait.md` v1.1 为唯一依据，把竖版分析页全部高度、字号、字重、行高、触控区对齐到像素级，并新增元音分段 Tab；桌面/横屏零变动。

**Architecture:**延续 token 计划做法——只改竖版媒体查询与 mobile 组件；`useToolbar` 单实例、`ShellContext` 透传不变；有真实断言可写的先测后做（图表坐标色、空状态、元音 Tab、计时器已有），纯 CSS 度量任务以现有 suite 为门禁。

**Tech Stack:** React 19 + TS + CSS Modules + ECharts 5 + Vitest 3。

**权威数值速查（v1.1 §27 总表 + 各节）：** Header 64px / 标题 17px600 / Logo 28px / 触发器 44×44 r12；Target Row 固定40px（label宽40，14/600；范围14/500；单位12/400；行距4px；语义条3px+r3，F0 #13B98B / F1 #E84C68 / F2 #4387F5）；目标卡标题17/600/lh24；反馈卡 min-height 156px；F0 主数字28/700/lh34；F0 label 13/500；单位 13/500；F1/F2 值16/600/lh24，label/unit 12/400；徽标高28px（横padding 10px，字13/600，圆角999）；图表卡头40px；图表Tab高44px（字14/600，指示2px，active品牌色）；F0图300px；共振峰图300~320px；卡总min 340px；图例Chip高32px（padding 8px 10px，字12/500，圆点8px）；坐标轴11/400 `#8D9BAC`；网格 `#EDF1F5`；目标线1px dashed opacity 0.7；空状态容器120~160px（图标24px，标题15/600，描述13/400，gap 6px）；录音钮视觉60px/触控64px/图标24px/label 14/600；计时16/600 tabular-nums；Dock padding 12px 16px + min-height 76px + safe-area；Dock 左侧 Title 12/400 + Target 15/600；CTA 字14/600；Toast min-height 44px/横padding 16/圆角12/字14/500/图标18px/位于Dock上12px；通用按钮Primary/Secondary高44px（字14/600）/圆角12；Small高36px；元音Tab容器44px/项36px/最小宽44px/间距6px/圆角10px/字15/600（active粉底粉边粉字）；弹层头56px/标题17/600/关闭44px/内容padding 16/项52px/顶圆角20px/按钮44px；页面节奏卡间距12px、模块分界24px；≤359px 页边12px/图280~300px；431~767px 页边20px/卡padding 20px/图320~360px。

---

### Task 1：高度批量 CSS（无 DOM 变更，现有测试即门禁）

**Files:**
- Modify: `src/components/mobile/MobileMoreMenu.module.css`（`.trigger` radius 13→12px）
- Modify: `src/components/Toolbar.module.css`（compact `.title` 20px/800 → 17px/600；`.logo` 38px → 28px）
- Modify: `src/components/mobile/TrainingGoalCard.module.css`（`.bandRow` min-height 32px → 固定 `height: 40px`；`.title` 800→600 + `line-height: 24px`；语义条 `border-left-width` 4px→3px + `border-radius: 3px`——注意 `.bandRow` 自身圆角保持 8px，只是左侧色条变细；色条颜色本任务不动，Task 3 做）
- Modify: `src/components/mobile/FeedbackHero.module.css`（`.card` 加 `min-height: 156px`；`.readoutValue` line-height 1.2→34px；`.badge` padding 5px 12px → 7px 10px + `min-height: 28px; box-sizing: border-box; display: inline-flex; align-items: center`；列值区本任务不动）
- Modify: `src/routes/AnalysisPage.module.css`（768px 块内：`.chartPanelHeader` 加 `min-height: 40px`；`.portraitTab` font 15px/700 → 14px/600，指示条 `height: 3px` → 2px；`.portraitChartsCard .chartArea` height 320px → 300px（min-height 300 保持）；`.portraitChartsCard` 加 `min-height: 340px`；`.legendItem` padding 4px 10px → 8px 10px + `min-height: 32px; box-sizing: border-box`；`.portraitChartsCard` 加 `margin-top: 12px` 与现有 `gap: 12px` 合成 24px 模块分界；新增 `@media (max-width: 359px)` 图高覆盖 `.portraitChartsCard .chartArea { height: 280px; min-height: 280px; }`；新增 `@media (min-width: 431px) and (max-width: 767px)` 块：`.portraitMain { padding: 16px 20px 116px; }`、`.portraitChartsCard .chartArea { height: 340px; }`）
- Modify: `src/components/mobile/RecordDock.module.css`（`.mic` 加触控扩展：`position: relative` 保持，用 `.mic::after { content:""; position:absolute; inset:-2px; }` 使 60px 视觉获得 64px 触控区——验证无副作用；`.mic svg` 28px → 24px 显示尺寸；`.dock` padding 8px → 12px 上下 + `min-height: 76px; box-sizing: border-box`；CTA `.hint` 12px → 14px/600；左侧 `.goalHint` 13px → 12px/400）
- Modify: `src/components/Toast.module.css`（先读文件：toast 根加 `min-height: 44px`、横向 padding 16px、字 14px/500；定位到 Dock 上方 12px——读现有定位后定，不动桌面定位逻辑之外的行为）
- Modify: `src/components/Button.module.css`（仅 `@media (max-width: 768px)` 块：`.btn` height 38px → 44px，`border-radius` → 12px；桌面基线不动）

- [ ] **Step 1: 逐文件改值（读一行改一行，不增删选择器）**
- [ ] **Step 2: 跑门禁**

Run: `npm run test:unit 2>&1 | tail -3 && npx tsc --noEmit`
Expected: 全过 + 干净（无 DOM 变动）

- [ ] **Step 3: Commit**

```bash
git add src/components/mobile/MobileMoreMenu.module.css src/components/Toolbar.module.css src/components/mobile/TrainingGoalCard.module.css src/components/mobile/FeedbackHero.module.css src/routes/AnalysisPage.module.css src/components/mobile/RecordDock.module.css src/components/Toast.module.css src/components/Button.module.css
git commit -m "style(portrait): v1.1高度批量对齐（行40/徽标28/卡头40/图300/钮44）"
```

---

### Task 2：空状态重做（DOM + CSS + 测试，TDD）

**Files:**
- Modify: `src/components/EmptyState.tsx`（新增可选 `icon?: ReactNode` prop，无 icon 时渲染与今天完全一致）
- Modify: `src/components/EmptyState.module.css`（`.empty` gap 4px → 6px；新增 `.icon { font-size: 24px; line-height: 1; }`；容器在图表内保持 absolute inset-0 覆盖，但内容块定高：给内部加 `min-height: 120px; max-height: 160px` 的约束方式由实现者定——建议 `.empty` 保持覆盖定位，文字区自然高度落在 120~160px 即合规，不写死）
- Modify: `src/routes/AnalysisPortrait.tsx`（两处 `<EmptyState>` 加 `icon="🎙"`；F0 描述文案改为 `点击下方开始录音`——去掉 🎤 emoji 与"红色按钮"字样，与 v1.1 §15 推荐文案一致；共振峰描述保持）
- Test: `src/__tests__/EmptyState.test.tsx`（若存在则扩展，不存在则新建）：有 icon 时渲染图标、无 icon 时不渲染；文案断言。若该文件不存在，先 `glob src/__tests__/` 确认。

- [ ] **Step 1: 先写/改测试并看红**

Run: `npx vitest run --project unit src/__tests__/EmptyState.test.tsx`
Expected: FAIL（无 icon prop）

- [ ] **Step 2: 最小实现（桌面调用方一律不传 icon，行为零变化）**
- [ ] **Step 3: 变绿 + 全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add src/components/EmptyState.tsx src/components/EmptyState.module.css src/routes/AnalysisPortrait.tsx src/__tests__/EmptyState.test.tsx
git commit -m "feat(portrait): 空状态v1.1（24px图标，120~160容器，6px间距）"
```

---

### Task 3：排印与颜色批量（含图表坐标色，TDD）

**Files:**
- Modify: `src/components/mobile/TrainingGoalCard.tsx`（色条色源改为 portrait token：`style={{ borderLeftColor: BAND_BAR_COLORS[key] }}`，其中 `const BAND_BAR_COLORS = { f0: '#13B98B', f1: '#E84C68', f2: '#4387F5' }` 本文件内定义——TrainingGoalCard 是竖版专用组件，不影响桌面；`bands[key].color` 不再用于色条）
- Modify: `src/components/mobile/TrainingGoalCard.module.css`（`.bandKey` 15px/700 → 14px/600；inputs 15px/500 → 14px/500）
- Modify: `src/components/mobile/FeedbackHero.module.css`（`.readoutLabel` 13px/700 → 13px/500；`.readoutUnit` 14px/600 → 13px/500；`.columnValue` 15px/500 → 16px/600 + `line-height: 24px`；`.columnKey/.columnUnit` → 12px/400；`.badge` 字 12px → 13px/600；`.timer` 计时在 Dock 文件里改，不在这里）
- Modify: `src/components/mobile/RecordDock.module.css`（`.timer` 12px → 16px/600；`.goalLabel` 字号保持 20px 视觉——v1.1 左侧 Target 15/600 指"a · F0 范围"组合行，Dock 当前是粉盒单字 + 当前目标，保持结构只调计时；`.goalHint` 已在 Task 1 改为 12px/400）
- Modify: `src/components/F0Chart.tsx` + `src/components/FormantChart.tsx`（竖版分支：axisLabel 颜色 `#6F8197` → `#8D9BAC`；其余不动）
- Test: `src/__tests__/PortraitChartOptions.test.tsx`（先改：所有 `#6F8197` 断言 → `#8D9BAC`，必红）

- [ ] **Step 1: 先改坐标色测试并看红**

Run: `npx vitest run --project unit src/__tests__/PortraitChartOptions.test.tsx`
Expected: FAIL（坐标色）

- [ ] **Step 2: 最小实现（含色条 token 化）**
- [ ] **Step 3: 变绿 + 全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add src/components/mobile/TrainingGoalCard.tsx src/components/mobile/TrainingGoalCard.module.css src/components/mobile/FeedbackHero.module.css src/components/mobile/RecordDock.module.css src/components/F0Chart.tsx src/components/FormantChart.tsx src/__tests__/PortraitChartOptions.test.tsx
git commit -m "style(portrait): v1.1排印与颜色（14行字/16列值/坐标#8D9BAC/语义条token色）"
```

---

### Task 4：元音分段 Tab 替代下拉框（新组件，TDD）

**Files:**
- Create: `src/components/mobile/VowelTabs.tsx` + `VowelTabs.module.css`（容器高 44px；项高 36px、最小宽 44px、间距 6px、圆角 10px、字 15px/600；active 粉底 `#FFF0F3` + 粉边 `#E94262` + 粉字；RovingTabindex 不做，保持原生 button + `aria-pressed`）
- Modify: `src/components/mobile/TrainingGoalCard.tsx`（左侧 `.vowelBox` 下拉改为 `<VowelTabs>`；删除 `select` 相关逻辑但保留 `switchPreset` 调用；`.vowelBox` 容器改为分段条底座样式）
- Test: `src/__tests__/VowelTabs.test.tsx`（新建：渲染 6 项 a/o/e/i/u/ü；active 项 `aria-pressed=true`；点击派发 onSelect；6 项总宽要求的结构不断言像素，只断言项数与顺序）；同步改 `src/__tests__/TrainingGoalCard.test.tsx`（下拉相关用例改为 Tab 点击切换预设；`选择元音预设` label 保留在 Tab 组上）

- [ ] **Step 1: 先写 VowelTabs 测试 + 改 TrainingGoalCard 测试，看红**
- [ ] **Step 2: 最小实现**
- [ ] **Step 3: 变绿 + 全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add src/components/mobile/VowelTabs.tsx src/components/mobile/VowelTabs.module.css src/components/mobile/TrainingGoalCard.tsx src/components/mobile/TrainingGoalCard.module.css src/__tests__/VowelTabs.test.tsx src/__tests__/TrainingGoalCard.test.tsx
git commit -m "feat(portrait): 元音分段Tab替代下拉（44容器/36项/active粉）"
```

---

### Task 5：弹层移动端规格（CSS only，现有测试门禁）

**Files（先读再改，只动竖版媒体查询内）：**
- `src/components/Drawer.module.css`（`.card` 或等价面板：顶圆角改 20px；头高 56px；标题 17px/600；关闭钮 44×44；内容 padding 16px；项高 52px——先读 ConfigDrawer/HelpDrawer 结构，把"项"落到实际类上；桌面基线不动）
- `src/components/Modal.module.css`（宽 `calc(100% - 32px)`/最大 358px 已有则不动；padding 20px；圆角 20px；按钮高 44px——只在竖版查询内覆盖；先读 AboutModal/Modal 现状）

- [ ] **Step 1: 读 Drawer/Modal/ConfigDrawer/HelpDrawer/AboutModal，定位实际类名**
- [ ] **Step 2: 竖版查询内覆盖（不动桌面基线与 DOM）**
- [ ] **Step 3: 跑全 unit + tsc**
- [ ] **Step 4: Commit**

```bash
git add src/components/Drawer.module.css src/components/Modal.module.css
git commit -m "style(portrait): 弹层移动端规格（头56/项52/顶圆角20/钮44）"
```

---

### Task 6：最终验证 + v1.1 目检清单

- [ ] **Step 1: 全量**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -2`
Expected: 干净；全过；`✓ built`

- [ ] **Step 2: v1.1 目检**（有浏览器处，390×844）：Header 64/标题17/600/Logo 28；行40；徽标28；卡头40；图300；Chip 32；空状态120~160+🎙；钮60视觉/64触控；Dock 76+计时16px；Toast 在Dock上12px；按钮44；元音Tab 44/36/active粉；弹层头56/项52/圆角20。
