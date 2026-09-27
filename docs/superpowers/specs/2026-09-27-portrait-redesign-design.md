# 竖版 UI 重设计 — 设计文档

日期：2026-09-27
状态：已批准
范围：仅手机竖屏（`<= 768px`）的 `/` 分析页。桌面与横屏、`/practice` 页、DSP 层全部不变。

## 1. 目标

依据竖版设计稿重做手机端分析页，核心变化三点：

1. 顶栏从「7 个按钮横向铺开」改为「logo + 标题 + `...` 溢出菜单」。
2. 实时反馈从「小字列表」改为「Hero 大数字 + 状态徽标 + 三列 F0/F1/F2」。
3. 新增底部录音 Dock（大红麦克风 + 当前目标），主录音操作从顶栏下移到底部。

## 2. 设计稿区域 → 现状差距

| 设计区 | 设计稿 | 现状 | 差距 |
|---|---|---|---|
| 顶栏 | logo + 在线声音训练 + 右侧 `...` | `Toolbar` 含 record/import/playback/clear/config/help/about 七个 `Button` 全铺开 | 竖版需收起为 `...` 菜单 |
| 训练目标卡 | `a` 下拉 + F0/F1/F2 三行范围 + `>` | `TargetPresetBar`：6 个元音按钮 + 三行数字输入 | 需 compact 变体：单一下拉 + 三行输入 |
| 实时反馈 Hero | F0 大数字（如 `245Hz`）+ 状态徽标 + 三列 F0/F1/F2 带 ✓ | `FeedbackCard`：标题 + 小字数值列表 + 声区行 | 需新 `FeedbackHero` |
| 图表 | 基频 / 共振峰上下堆叠；图例 `当前值 / 目标区间 / 目标线` 与 `F0/F1/F2` 两组 pills；X 轴显示 `0s 5s …` | `F0Chart`/`FormantChart`：`xAxis.axisLabel.show: false`；F0 线深灰 `#1F2937`；markArea/markLine 颜色硬编码 | 竖版需开 X 轴 label、收紧 grid、图例 pills、颜色对齐 |
| 底部 Dock | `a 当前目标 >` + 大红麦克风 + 提示文案；悬浮圆角白条 | 无 | 新建 `RecordDock` |

## 3. 已确认的交互决策

| 决策点 | 结论 |
|---|---|
| 改动范围 | 仅竖版 `AnalysisPortrait`；桌面/横屏零变动 |
| 录音主按钮 | 竖版移到底部 Dock；顶栏只留 `...` 菜单承载其余 6 个 action |
| 图表显示 | 两个图表**堆叠同时显示**，可滚动；顶部 `基频｜共振峰` 仅作锚点滚动（scroll-into-view），**不做显隐切换** |
| 训练目标卡 | 下拉切换元音预设 + 输入框可直接编辑，复用横版 `TargetPresetBar` 同一套逻辑 |

## 4. 架构

### 4.1 原则不变

沿用 `CLAUDE.md` 的 command-driven + reactive data 架构：**不改** `useToolbar.handleClickTool` 的前置检查约束（先停播放；非 record 操作先停录音；config/help/about 豁免）。新增的 mobile 组件只作为该入口的调用方，不复制状态机。

`appStore`、`useAnalysis`、`usePlayback`、`recordingBuffer` 全部不动。

### 4.2 新增文件

```
src/hooks/usePresetBands.ts               抽出预设区间编辑逻辑（TargetPresetBar 与 TrainingGoalCard 共用）
src/components/mobile/TrainingGoalCard.tsx  紧凑目标卡：下拉预设 + 三行区间输入
src/components/mobile/TrainingGoalCard.module.css
src/components/mobile/FeedbackHero.tsx      Hero 反馈：大数字 + 徽标 + 三列
src/components/mobile/FeedbackHero.module.css
src/components/mobile/RecordDock.tsx       底部录音 Dock（fixed）
src/components/mobile/RecordDock.module.css
src/components/mobile/MobileMoreMenu.tsx   顶栏 `...` 溢出菜单
src/components/mobile/MobileMoreMenu.module.css
```

### 4.3 修改文件

| 文件 | 改动 |
|---|---|
| `src/routes/AnalysisPortrait.tsx` | 重排为竖版设计稿结构，接入四个新组件 |
| `src/routes/AnalysisPage.module.css` | 竖版 media query 内改为竖版布局规则（含底部 padding） |
| `src/components/TargetPresetBar.tsx` | 改为消费 `usePresetBands`，行为不变（零 UI 变动） |
| `src/components/F0Chart.tsx` | 新增 `isPortrait` 分支：X 轴 label、grid、颜色 |
| `src/components/FormantChart.tsx` | 新增 `isPortrait` 分支：X 轴 label、grid、markArea/markLine 取 `bands[k].color` |
| `src/components/Toolbar.tsx` | 新增可选 `moreMenu` 插槽；竖版传 `MobileMoreMenu`，桌面不传（零变动） |

### 4.4 组件契约

**`usePresetBands()`** — 从 `TargetPresetBar.tsx:17-72` 原样抽出的 hook，返回：
```ts
{
  localValues: Record<string, string>,
  onInputChange: (key: 'f0'|'f1'|'f2', index: 0|1, value: string) => void,
  onCommit: (key: 'f0'|'f1'|'f2', index: 0|1) => void,
  onInputKeyDown: (key, index) => (e) => void,
  onReset: () => void,
}
```
`TargetPresetBar` 与 `TrainingGoalCard` 各自调用，互不干扰（hook 内部为 `useState`，每个消费者独立实例）。

**`TrainingGoalCard`** — 无 props。内部：`useAppStore` 读 `bands`/`activePreset`，`switchPreset`/`setBands`/`savePresetOverride`/`resetPresets` 写入，`usePresetBands()` 提供编辑态。左列为元音 `<select>`（选项取 `Object.keys(VOWEL_PRESETS)`，显示 `a/o/e/i/u/ü`），右侧三行 `F0/F1/F2` 数字输入，行首色条取 `bands[k].color`（F0 绿 / F1 蓝 / F2 橙）。整卡右侧 `>` 为纯装饰（图表已在同页下方，无需跳转）。

**`FeedbackHero`** — 无 props。数据源与 `FeedbackCard` 同源：`useAppStore(s => s.latestFrame)`、`bands`、`formantVisible`、`useFeedback()`、`getFormantStatus()`。
- 主数字：F0，无有效帧时 `--`。
- 徽标四态，按以下**固定优先级**判定（`hit` = `getFormantStatus` 返回 `'hit'`；`low`/`high` 分别为 `'low'`/`'high'`；三者皆非即视为 `none`）：
  1. `latestFrame` 为 `null` → `等待声音`（灰）
  2. 三项全 `hit` → `目标范围内`（绿）
  3. 至少一项 `high` → `偏高`（橙）
  4. 其余情况（至少一项 `low`，且无 `high`）→ `偏低`（橙）
- 参与判定的项 = `formantVisible` 为 `true` 的键；若三项全部隐藏，退化为状态 1（`等待声音`）。
- 三列：F0/F1/F2 数值 + `✓` / `!` / `—` 状态符，`font-variant-numeric: tabular-nums`。
- 声区行保留（设计稿有此信息位），复用 `VoiceRegister` 标签与配色。

**`RecordDock`** — props: `onRecord: () => void`, `isCapturing: boolean`, `isRequesting: boolean`, `goalLabel: string`, `onGoalClick: () => void`。
- `position: fixed; bottom: 0; left: 0; right: 0`，圆角顶边，`padding-bottom: env(safe-area-inset-bottom)`。
- 左：`goalLabel`（当前预设的 `a`）+ `>`，点击触发 `onGoalClick`（滚动到目标卡）。
- 中：64px 圆形红色麦克风（`var(--primary)`）。`isCapturing` → 变 `■` 并加脉冲动画；`isRequesting` → `disabled`。
- 右：提示文案 `长按说话`（`isCapturing` 时切为 `再次点击停止`）。

**`MobileMoreMenu`** — props: `items: ToolItem[]`（来自 `useToolbar`）、`onSelect: (id: string) => void`。
- 触发器：`...` 按钮。
- 展开：下拉面板，逐项渲染 `items` 中 id ≠ `record` 的条目（record 已下沉到 Dock），保留 `disabled`/`recording` 视觉状态。
- 每次 `onSelect` 后自动收起。

### 4.5 竖版图表配置

`F0Chart` / `FormantChart` 内用 `useMediaQuery('(max-width: 768px)')` 取 `isPortrait`，仅影响 ECharts option：

| 项 | 桌面（不变） | 竖版 |
|---|---|---|
| `grid` | `{ left: 72, right: 32, top: 20, bottom: 36 }` | `{ left: 48, right: 12, top: 16, bottom: 28 }` |
| `xAxis.axisLabel.show` | `false` | `true`，`formatter: (v) => \`${v}s\``，`hideOverlap: true` |
| F0 线色 | `#1F2937` | `#3B82F6`（对齐设计稿） |
| markArea/markLine 色 | 硬编码 | 取 `bands[k].color` |

`FormantChart` 的桌面默认色（`COLORS`）保持不变以免影响横屏视觉；仅竖版使用 `bands[k].color`。

### 4.6 AnalysisPortrait 布局顺序

```
[ TrainingGoalCard ]
[ FeedbackHero    ]
[ 基频   (锚点 #f0)   ]   ← 顶部 Tab 点击滚动至此
[ 共振峰 (锚点 #f1f2) ]   ← 顶部 Tab 点击滚动至此
```

`main` 底部留 `padding-bottom: 116px` 防止 `RecordDock`（含 safe-area）遮挡最后一个图表。

## 5. 数据流

零新增数据流。`RecordDock.onRecord` 与 `MobileMoreMenu.onSelect` 均回调到 `useToolbar.handleClickTool`，因此：

- 点 Dock 麦克风 → 完整走录音流程（含 `isRequesting` 授权态）。
- 点 `...` 里的「回放」→ 先 `stop()` 播放，再切播放态。
- 点 `...` 里的「清空」→ 先 `stop()` 播放，若正在录音则先 `analysisRecord()` 停止，再 `clearFrames()`。
- 点 `...` 里的「配置/帮助/关于」→ 不打断音频。

## 6. 测试策略

沿用 Vitest 3 两项目结构（`dsp` / `unit`）。新增/修改：

| 文件 | 覆盖 |
|---|---|
| `src/__tests__/usePresetBands.test.ts` | clamp F0 上限、min<max 校验、非法值回滚、override 写入 |
| `src/__tests__/TrainingGoalCard.test.tsx` | 下拉切换预设联动 bands、三行输入修改并持久化 override、重置 |
| `src/__tests__/FeedbackHero.test.tsx` | 全 hit → 绿色徽标、low/high → 橙色徽标、无帧 → `等待声音`、三列数值渲染 |
| `src/__tests__/RecordDock.test.tsx` | 点击麦克风触发 `onRecord`、`isCapturing` 切停止态、`isRequesting` 禁用 |
| `src/__tests__/MobileMoreMenu.test.tsx` | 展开后渲染 6 项、点击派发 `onSelect` 且收起、保留 disabled 态 |
| `src/__tests__/layoutShells.test.tsx`（扩展） | 竖版渲染出新结构标记（`data-portrait-dock` 等），横版仍为 `data-layout="landscape"` |
| `src/__tests__/F0Chart.test.tsx`（扩展） | 竖版下 `setOption` 收到 `xAxis.axisLabel.show === true` |

回归保证：`TargetPresetBar.test.tsx`、`Toolbar.test.tsx` 现有用例必须继续通过（证明共享 hook 抽取与 `moreMenu` 插槽均为零行为变动）。

## 7. 错误处理

- 麦克风授权失败：沿用 `useAnalysis` 现有 `toastStore` 上报，Dock 不额外处理。
- F0 输入超上限：沿用 `TargetPresetBar` 现有 `showToast('info', ...)` 提示，共享 hook 后行为一致。
- 非法数字输入：blur/Enter 时回滚为 store 中当前值。
- 底部 safe-area：`env(safe-area-inset-bottom)` 为 0 时不影响布局。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 390px 宽下 X 轴 label 拥挤 | `hideOverlap: true` + 时间刻度由 ECharts 自动抽稀 |
| `...` 菜单漏项导致功能丢失 | `MobileMoreMenu.test.tsx` 断言恰好 6 项且 id 集合完整 |
| 抽取 hook 影响横屏 `TargetPresetBar` | 现有 `TargetPresetBar.test.tsx` 作为回归门禁 |
| 底部 Dock 遮挡图表 | `main` 底部 `padding-bottom: 116px` |
| 脉冲动画引发不适 | 尊重 `prefers-reduced-motion`（沿用 `FeedbackCard.module.css:109` 已有写法） |

## 9. 非目标

- 不改横屏/桌面任何视觉。
- 不改 `/practice` 页竖版（本次仅 `/` 分析页）。
- 不引入新依赖（无 UI 库、无图标库；沿用现有 emoji/几何字符图标风格）。
- 不做真实用户手势（左滑返回、捏合缩放）。
- 不重构 `Toolbar` 桌面布局，`moreMenu` 为可选插槽。
