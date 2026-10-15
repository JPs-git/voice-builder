# 横屏帮助与首次使用提示实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前竖屏的一次性悬浮帮助扩展到横屏，统一两端状态和入口策略，并修复布局切换后的帮助焦点回退。

**Architecture:** 首次提示改为共享组件，在 AppShell 仅挂载一个实例，按当前布局改变定位；继续复用现有资格 hook、持久化标记和六主题帮助。帮助关闭时动态寻找当前布局中仍可用的控件，不在打开时固定回退目标。

**Tech Stack:** React 19、TypeScript、Zustand、CSS Modules、现有 Modal 与 ResizeObserver、Vitest / Testing Library；不增加依赖。

**Spec:** 本文「设计约定」承接用户已确认的本期范围：横竖屏帮助与首次提示；图文指南及分步导览延期。用户随后以「开始实现」批准执行，以下保留任务清单，验收记录见文末。

## 工作环境

- 延续 `feat/onboarding-help`，worktree：`C:/Users/Administrator/Projects/voice-builder/.worktrees/feat/onboarding-help`。
- 当前 HEAD `2e28cf6`，竖屏悬浮帮助已经完成；主 checkout 保持 master、干净。
- 本次只制定计划，不改产品代码；实施后保留分支等待 review，不自动创建 PR 或合并。

## 设计约定

### 1. 横屏悬浮提示

- 在视口右下角悬浮，右侧与底部各 24px，宽度 400px；采用 `max-width: calc(100vw - 48px)` 防止越界。
- 延续竖屏白/极淡蓝底、细蓝边、柔和阴影、16px 圆角、书本图标；不扩大为大面积横幅。
- 文案统一：「第一次使用？」／「了解录音、读图与目标设置」；按钮「查看说明」，关闭名称「关闭首次使用提示」。
- 提示完全脱离文档流，层级仍为 35；不为它修改图表尺寸、页面间距或添加占位。允许覆盖图表底部少量区域，不覆盖顶部录音操作和左侧目标输入。
- 声音分析和音高参考页都可展示；只挂载一个提示实例，页面切换不重新计时或重置资格。
- 外层事件穿透，仅卡片接收点击；可关闭，不加延时、轮播、自动消失或遮罩。
- 竖屏保持当前 Dock 实测顶部上方 10px、左右 12px、最大宽度 400px 的样式。

### 2. 两端共享首次使用规则

沿用已有 `voicebuilder-intro-hint-v1`，不新增键、不迁移既有标记：

| 情况 | 行为 |
|---|---|
| 未关闭/未完成，空闲且无数据 | 显示当前布局的提示 |
| 点击关闭 | 两端持久隐藏 |
| 首次有效分析，来自录音或导入 | 两端持久隐藏 |
| 授权、录音、回放、已有数据 | 暂时隐藏，不据此标记完成 |
| 帮助、配置、关于、目标设置打开 | 暂时隐藏，保留提示 DOM 便于焦点返回 |
| 只打开并阅读帮助 | 不计为完成，关闭帮助后按当前状态恢复 |
| 清空、刷新、切换路由或布局 | 已关闭/完成不恢复；未完成按当前状态判断 |

- 有效分析继续定义为至少一帧 F0/F1/F2 中任一值有限且 >0，不使用 `hasData` 或点击录音判定完成。
- 存储受限时沿用会话内状态，刷新可能再次出现；老用户没有历史标志时可能看到一次。
- 若目标模态框在竖屏打开后切换横屏，它实际已卸载；需同时清除 goalOpen，避免隐藏状态一直阻止横屏提示。其他仍挂载的应用弹层保持打开。

### 3. 帮助入口与内容

- 移除 `AnalysisLandscape` 空状态「查看上手步骤」及 `PracticeLandscape` 空状态「了解音高参考」，两端都恢复为简短录音说明。
- 保留横屏顶栏帮助、竖屏更多菜单帮助、两端图表标题问号与六主题目录。
- 悬浮条打开 `quick-start`，图表问号仍打开 `charts` / `pitch-reference`；不自动打开帮助。
- 核对横屏说明使用真实位置：顶栏录音/导入/回放/清空，左侧目标区间；不能出现底部麦克风或滑杆操作指令。
- 快速上手补充现有轻微缺口：解释固定参考色带与训练目标不同；竖屏箭头/对勾、横屏颜色/文字对应关系；数字失焦提交、竖屏滑杆即时更新、恢复默认作用于全部元音。每步控制在两至三句，通过现有共享内容维护。
- 音高参考章节强调目标编辑在声音分析页，保持当前六主题组织，不在本期追加截图或外部文档链接。

### 4. 焦点与布局切换

- 同布局关闭帮助，优先恢复原触发控件。
- 原触发控件已卸载、禁用、`display:none` 或 `visibility:hidden` 时，回退到当前可用录音按钮。
- 录音按钮不可用（如授权中）时：横屏退到顶栏帮助；竖屏退到更多操作按钮。只移动焦点，不调用任何音频动作。
- 从悬浮条打开帮助后跨越 768px：保留当前帮助主题、更新位置文案，关闭时使用当前布局的回退控件。
- 查看帮助期间分析完成、提示永久退出，沿用同一回退规则。
- 主动关闭提示后也使用当前布局回退规则；首次提示不抢焦点。
- 布局变化和回退函数更新不得重跑 Modal 的打开 effect，避免抢走正在阅读的焦点或重置滚动锁。

## Global Constraints

- 本期无图文文档、文档站部署或交互式步骤导览。
- 不新增持久化键、埋点、依赖或首次提示定时器。
- 不修改音频、权限、分析、目标校验及保存行为。
- 两端只有一个提示实例；不以复制另一套资格状态的方式实现横屏。
- 保留 EmptyState.action 通用接口，不因为移除页面入口而破坏已有组件能力。

## Review Focus

1. 帮助打开期间跨越 768px，原触发控件卸载或因 CSS 隐藏：关闭后焦点必须落在当前布局可见控件（Task 2）。
2. 授权中录音按钮禁用，或分析完成移除提示：帮助关闭不能落在不可聚焦目标上（Task 2）。
3. 竖屏目标弹层打开后转横屏：不能留下不可见 goalOpen 阻止以后提示（Task 2）。
4. 769/1024px 和较矮视口、缩放后：提示不溢出、不改变图表边界，竖屏仍跟随 Dock 高度（Task 1/3）。
5. 关闭、成功分析、无效分析、刷新、清空与路由变化：两端使用同一资格，不重复弹出或过早完成（Task 3）。

## Task 1：共享提示组件与横屏定位

**Files:**
- Move `src/components/mobile/FirstUseHelpBanner.tsx` / `.module.css` → `src/components/FirstUseHelpBanner.tsx` / `.module.css`。
- Modify `src/routes/AppShell.tsx`, `src/__tests__/FirstUseHelpBanner.test.tsx`。

**Interfaces:**
- 共享组件保留 `visible`, `suppressed`, `onOpen`, `onDismiss`；新增必填 `layout: 'portrait' | 'landscape'`，`dockHeight?: number`。
- portrait 等到 dockHeight>0 才显示，bottom=dockHeight+10；landscape 不依赖 Dock 测量，right=24、bottom=24。
- AppShell 将实例移到 isPortrait 条件块之外，继续使用同一个 `useFirstUseHelp` 与抑制条件。

- [ ] 先写失败用例：landscape 在 dockHeight 缺省/0 时仍显示；portrait 未测量仍不显示；layout 变化保留同一个提示按钮节点；准确文案、查看与关闭动作不变。
- [ ] 运行 `npm test -- src/__tests__/FirstUseHelpBanner.test.tsx`，预期新增断言失败。
- [ ] 移动组件并实现按布局定位，更新引用，保持抑制时 DOM 不卸载及按钮不可操作。
- [ ] 重跑上述测试，预期通过；浏览器核对横屏卡片和竖屏旧样式。
- [ ] 提交 `feat(help): share first-use banner across layouts`。

## Task 2：跨布局焦点与弹层状态

**Files:** Modify `src/components/Button.tsx`, `Toolbar.tsx`, `mobile/MobileMoreMenu.tsx`, `Modal.tsx`, `HelpDrawer.tsx`, `src/routes/AppShell.tsx`；Test `src/__tests__/Toolbar.test.tsx`, `MobileMoreMenu.test.tsx`, `FirstUseHelpExperience.test.tsx`, `HelpDrawer.test.tsx`。

**Interfaces:**
- Button 显式支持 `ref?: Ref<HTMLButtonElement>`，利用项目 React 19 将 ref 传到真实 button，不引入另一层包装 DOM。
- Toolbar 新增可选 `recordButtonRef`、`helpButtonRef`（HTMLButtonElement ref），只分别绑定 id=record/help 的按钮。
- MobileMoreMenu 新增可选 `triggerButtonRef: RefObject<HTMLButtonElement | null>`；未传仍使用内部 ref，保留已有菜单焦点逻辑。
- Modal/HelpDrawer 将现有可选 `fallbackFocusRef` 改为 `getFallbackFocus?: () => HTMLElement | null`；仓库仅 AppShell 使用旧接口，统一更新调用。
- Modal 用内部 ref 保持最新 resolver；打开 effect 只依赖 open。清理时检查原控件是否连接、可见且未禁用，再决定恢复或调用 resolver。
- AppShell resolver 读取当前按钮 refs，按录音→横屏帮助/竖屏更多顺序筛选可用目标；不闭包保存打开帮助时的布局。
- 保留当前 recordButtonRef，由横屏 Toolbar / 竖屏 Dock 分别绑定；提供 helpButtonRef 和 moreButtonRef 作为备选。

- [ ] 写失败用例：两种布局的 ref 指向真实控件；菜单未传 ref 的既有行为正常。
- [ ] 写失败用例：竖屏图表问号打开帮助→横屏关闭；横屏顶栏帮助打开→竖屏关闭；均返回当前录音按钮。共享悬浮条在两端切换后仍可见时优先返回该触发按钮。
- [ ] 写失败用例：帮助期间分析完成后切布局，原提示已移除；录音禁用时分别回退到帮助/更多。断言没有音频回调，且焦点在可见控件上。
- [ ] 写失败用例：帮助打开后切布局不会重新 focus dialog；主题保留、位置文案更新。覆盖 display:none 的已连接旧控件，不能只检查 isConnected。
- [ ] 写失败用例：竖屏目标设置打开→横屏实际卸载后，返回空闲无数据时首次提示恢复；不能让隐藏 goalOpen 卡住它。
- [ ] 运行 `npm test -- src/__tests__/Toolbar.test.tsx src/__tests__/MobileMoreMenu.test.tsx src/__tests__/FirstUseHelpExperience.test.tsx src/__tests__/HelpDrawer.test.tsx`，预期新增断言失败。
- [ ] 实现 ref、resolver、可见性检查与目标弹层清理，保留原 Modal Esc/Tab/视口与滚动锁逻辑。
- [ ] 重跑目标测试通过，并回归 `src/__tests__/TrainingGoalModal.test.tsx`。
- [ ] 提交 `feat(help): restore focus across layout changes`。

## Task 3：入口清理、文案和完整验收

**Files:** Modify `src/routes/AnalysisLandscape.tsx`, `PracticeLandscape.tsx`, `src/content/helpContent.ts`, `src/__tests__/layoutShells.test.tsx`, `FirstUseHelpExperience.test.tsx`, `helpContent.test.ts`, `docs/ui-design.md`, `docs/ui-design-portrait.md`。

**Interfaces:** 保持已有 HelpTopic、ShellContext.onOpenHelp、资格 hook、持久化 store 的接口与键不变。

- [ ] 更新回归：两端两个页面均无旧空状态帮助按钮；图表问号和菜单/顶栏帮助仍有效；未完成且空闲时唯一悬浮提示可用。
- [ ] 将既有“横屏保持旧按钮”测试替换为新契约。参数化覆盖横竖屏授权、录音、回放、数据、应用弹层暂时隐藏；未产生有效数据不持久完成。
- [ ] 覆盖两端任一处关闭或有效分析后，清空、路由及布局切换不恢复；存储重载仍隐藏；损坏/禁用存储沿用既有保护。
- [ ] 共享文案测试覆盖操作位置和快速上手补充内容：仅竖屏提滑杆，横屏提顶栏及左侧；两端区分固定参考与训练目标，均说明全部恢复默认。
- [ ] 运行 `npm test -- src/__tests__/layoutShells.test.tsx src/__tests__/FirstUseHelpExperience.test.tsx src/__tests__/helpContent.test.ts src/__tests__/useFirstUseHelp.test.tsx`，确认新增用例失败。
- [ ] 移除横屏 action，补充简短帮助说明并更新当前文档；不修改历史计划来抹除旧范围。
- [ ] 重跑目标测试，预期通过。
- [ ] 浏览器验收 360×640、390×844、768/769px 边界、1024×768、1440×900 和较矮横屏；核对关闭前后图表矩形相同、提示边界、正常页面滚动与焦点。
- [ ] 浏览器确认关闭后刷新不恢复；检查帮助开着时横竖切换。真实设备或缩放未能验证的项目如实记录，不将模拟状态当实录结果。
- [ ] 执行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`，预期均退出 0；共用 Windows 依赖时 tsc 可用 `../../../node_modules/.bin/tsc.cmd --noEmit`。
- [ ] 一次独立整分支审查，重点检查上述 Review Focus；处理影响使用的发现，记录轻微延期项。
- [ ] 提交 `feat(help): unify contextual help entry points`，保留分支等待用户 review。

## 验收结果应能确认

1. 初次打开横屏也能找到说明，熟悉工具后两端都不会反复显示提示。
2. 两端都没有反复出现的空状态帮助行动，主动问号与帮助按钮持续可用。
3. 提示不占布局空间，阅读帮助不改变音频状态。
4. 横竖切换不重置主题、完成标记或正在阅读的焦点；关闭能返回可见控件。
5. 本期交付仍为简明帮助与一次性提示，没有截图文档、部署或分步导览。

## 实施与验收记录

- Tasks 1–3 完成：共享提示、横屏右下角定位、两端旧空状态行动清理、跨布局焦点、目标弹层状态清理与快速上手文案补充。
- 新增行为先观察失败用例，再实现并通过；最终 62 个测试文件、488 项测试通过，类型检查、构建和差异检查通过。构建保留应用大包体积提示。
- 实测 1440×900 横屏提示宽 400px，右/底间距 24px；360/390/768 竖屏仍在 Dock 顶部上方 10px。断点上方与 1024×480 矮横屏提示在视口内。
- 横屏关闭提示前后图表矩形完全相同，刷新后持续隐藏。
- 实测横屏帮助打开→竖屏，章节及阅读焦点保留，关闭回到麦克风；竖屏帮助打开→横屏，关闭回到顶栏录音按钮。
- 独立整变更审查无 Critical、Important 或 Minor 发现。
- 实施细节：提取共享 focusTarget 检查，供 Modal 与 AppShell 使用相同的可见性规则；若遇新的浏览器可见性边界，只需集中完善此处。
- 真实麦克风权限、实体设备安全区与页面缩放未做硬件验收；音频状态及禁用按钮回退由回归测试覆盖，不将模拟测试表述为实录结果。
- 不涉及截图文档部署或分步导览；现有分支/worktree 保留，尚未创建 PR 或合并。
