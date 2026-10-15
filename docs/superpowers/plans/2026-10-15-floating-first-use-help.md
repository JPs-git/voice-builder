# 竖屏首次使用悬浮帮助实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 C 版底部悬浮提示条和 A 版文案替换竖屏反复出现的空状态帮助按钮，让首次使用者找到说明，让日常练习保持简洁。

**Architecture:** AppShell 统一挂载悬浮提示，使用独立的本地持久化状态记录已关闭或已完成首次分析。提示定位在实际底部操作栏上方，完全脱离文档流；继续使用已有主题帮助模态框，不新增分步引导。

**Tech Stack:** React、TypeScript、Zustand、CSS Modules、ResizeObserver、现有 Modal、Vitest / Testing Library；不增加依赖。

**Spec:** 本文「设计约定」承接用户已选择的 C 布局 + A 文案。用户随后通过「开始执行」批准按此计划实施；下方保留任务清单，验收记录见文末。

## 工作环境

- 延续当前分支 `feat/onboarding-help` 与现有 worktree，不重新从 master 建分支。
- Worktree：`C:/Users/Administrator/Projects/voice-builder/.worktrees/feat/onboarding-help`。
- 当前 HEAD：`4a226e2`，基于 master `9375b22`，已有主题帮助与情境入口实现。
- 主 checkout 保持 master、干净；不创建 PR、不合并，待单独指令。

## 设计约定

### 1. 样式与文案

- 使用 C 的底部悬浮提示条：白色或极淡蓝底、细蓝边、柔和阴影、16px 圆角、左侧书本线性图标。
- 标题：**第一次使用？**
- 副文案：**了解录音、读图与目标设置**
- 行动按钮：**查看说明**，打开已有 `quick-start` 帮助主题。
- 关闭按钮无障碍名称：**关闭首次使用提示**。
- 不使用「开始引导」「下一步」或步骤进度；产品目前仅提供帮助文档。
- 屏幕左右留白 12px、最大宽度 400px、居中；内部约 12px 留白、文字与按钮间隔 8px。标题 14px、副文案 12px；允许副文案换行，按钮与关闭触摸区域至少 44px。
- 固定定位在 Dock 实际顶部上方 10px，层级 35（Dock 30，帮助/设置模态框 50）。允许覆盖少量共振峰图底部，不遮挡录音、清除、回放或目标入口。
- 不给页面增加 padding、占位元素或调整图表高度；关闭提示前后，图表边界位置完全相同。
- 外层定位区域 `pointer-events: none`，仅提示卡自身 `pointer-events: auto`，不创建透明全屏拦截层。

### 2. 适用页面

- 新提示仅在宽度 ≤768px 的竖屏显示；声音分析与音高参考页共用一个实例与状态。
- 移除两个竖屏页空状态中的「查看上手步骤」「了解音高参考」行动按钮，保留原有空状态说明。
- 图表标题问号、更多菜单帮助和六主题说明继续保留。
- 横屏本轮不调整，横屏原有空状态入口保持当前行为；横屏成功分析也会标记首次使用完成。

### 3. 展示与隐藏规则

| 状态 / 操作 | 提示行为 | 是否记为以后不再展示 |
|---|---|---|
| 当前浏览器无记录，空闲且无声音数据 | 显示 | 否 |
| 点击关闭 | 隐藏 | 是 |
| 点击查看说明 | 打开快速上手；提示在模态框后暂时不可见 | 否 |
| 关闭帮助，仍无有效分析 | 恢复提示 | 否 |
| 正在授权、录音或回放 | 暂时隐藏 | 否 |
| 产生首次有效分析值 | 隐藏 | 是 |
| 授权失败或停止录音，仍没有有效分析 | 空闲后恢复 | 否 |
| 已有声音数据，但全是无效值 | 暂时隐藏；清除后可恢复 | 否 |
| 打开目标设置、配置、关于 | 暂时隐藏 | 否 |
| 已完成 / 已关闭后清空、刷新、切换页面 | 保持隐藏 | 已持久化 |

- 有效分析定义：`frames` 中至少一帧的 F0/F1/F2 任一值为有限数且 >0；录音与导入同样适用。
- 不直接用 `hasData` 判定完成：现有 `hasData` 在录音刚开始时已经为 true，尚不代表成功分析。
- `hasData` 用来控制当下是否展示；有效帧单独用于完成判定。不修改现有录音状态和 `hasData` 语义。
- 本地保存一个布尔标志，键名 `voicebuilder-intro-hint-v1`；不保存声音数据、行为轨迹或个人信息，不增加埋点。
- localStorage 读写失败时页面继续可用，当前页面会话仍记住关闭/完成，刷新后可能再次出现。
- 无已有历史标志的老用户无法准确识别，首次上线可能看到一次；不通过目标设置或访问次数猜测用户资历。
- 不加延时出现、轮播、自动消失、冷却重试或自动帮助弹窗。

### 4. 焦点和弹层

- 提示不抢焦点、不使用 `alert` 或 `aria-live` 自动播报；作为带名称的辅助区域，两个按钮可通过键盘访问。
- 点击关闭时，仅当焦点位于提示内部才把焦点交给录音按钮；只移动焦点，不触发录音或权限请求。
- 点击查看说明时保留提示组件挂载，用 CSS 暂时隐藏，不卸载原触发按钮，保证 Modal 关闭后可返回该按钮。
- 如果首次分析完成导致提示在帮助打开期间退出，关闭帮助后应退回持久存在的录音按钮。为这一情况提供显式回退；不改其他弹层的焦点行为。
- 阅读帮助保持录音、回放、目标和图表状态。表单软键盘期间若目标/配置已开，提示保持隐藏。

## Global Constraints

- 只改竖屏提示展示；横屏布局和空状态行为不变。
- C 的底部悬浮布局，A 的准确文案；只打开帮助文档，无实际指引流程。
- 提示完全脱离文档流，不压缩图表、不遮挡 Dock、不添加遮罩。
- 关闭或首次有效分析后跨刷新隐藏；清除图谱不清除此标记。
- 不增加音频初始化、权限请求、分析计算、埋点或依赖。
- 不重新引入随机小提示，不改目标校验气泡。

## Review Focus

1. 首次点击录音但没有有效数据：只暂时隐藏，不提前判定上手完成（Task 1/3）。
2. 存储禁用、损坏或配额不足：不影响打开页面和录音，当前会话仍能关闭（Task 1）。
3. 提示打开帮助后收到分析结果：关闭帮助返回有效焦点，而非已卸载按钮（Task 3）。
4. 360px、较矮视口、安全区和字体放大使 Dock 高度变化：提示随真实边界定位且不改变图表高度（Task 2/3）。
5. 横竖屏及路由切换、刷新和清空：共享标记持续有效，不重新出现多个提示（Task 3）。

## 文件职责与接口

| 文件 | 职责 |
|---|---|
| 新增 `src/store/introHintStore.ts` | 独立持久化标记、异常存储保护 |
| 新增 `src/hooks/useFirstUseHelp.ts` | 从声音数据判断首次分析完成；暴露资格与关闭操作 |
| 新增 `src/components/mobile/FirstUseHelpBanner.tsx` / `.module.css` | C 版悬浮条、固定文案和按钮，无音频逻辑 |
| 修改 `src/components/mobile/RecordDock.tsx` | 暴露录音按钮 ref 和实际栏高，不改变操作 |
| 修改 `src/routes/AppShell.tsx` | 单实例挂载、状态抑制、帮助入口和焦点回退 |
| 修改两个竖屏页面 | 移除空状态行动，保留说明和问号 |
| 修改/新增测试及当前文档 | 回归与验收记录 |

## Task 1：首次使用标记与完成判定

**Files:** Create `src/store/introHintStore.ts`, `src/hooks/useFirstUseHelp.ts`, `src/__tests__/useFirstUseHelp.test.tsx`。

**Interfaces:**
- Store：`useIntroHintStore`，状态 `handled: boolean`，动作 `markHandled: () => void`；只持久化 handled。
- Hook：`useFirstUseHelp(): { eligible: boolean; dismiss: () => void }`，eligible 表示未关闭且未完成。
- Hook 订阅 `useAppStore.frames`，有效数值用 `Number.isFinite(value) && value > 0`；数据完成检测独立于屏幕布局。

- [ ] 写失败测试：无记录 eligible=true；dismiss 后 false 且重建存储可恢复；零/null/负数/NaN 帧不完成；任一有效 F0/F1/F2 帧完成；清空图谱不恢复；异常/损坏存储不抛错，当前会话仍可 dismiss。
- [ ] 运行 `npm test -- src/__tests__/useFirstUseHelp.test.tsx`，预期因缺少实现失败。
- [ ] 实现独立 store 与 hook；存储适配器捕获读写异常，保留内存状态，不能对旧目标存储做迁移。
- [ ] 重跑同一测试，预期全部通过。
- [ ] 提交 `feat(help): remember completed first-use experience`。

## Task 2：悬浮组件与 Dock 定位

**Files:** Create `src/components/mobile/FirstUseHelpBanner.tsx`, `.module.css`, `src/__tests__/FirstUseHelpBanner.test.tsx`；Modify `src/components/mobile/RecordDock.tsx` 及现有 Dock 测试。

**Interfaces:**
- Banner props：`visible: boolean; suppressed: boolean; dockHeight: number; onOpen: () => void; onDismiss: () => void`。
- visible=false 可不渲染；suppressed=true 使用 visibility 隐藏并禁用点击，保留 DOM 以供焦点恢复。
- Dock 可选 props：`recordButtonRef?: Ref<HTMLButtonElement>; onHeightChange?: (height: number) => void`。
- Dock 挂载后测量外框高度，并以 ResizeObserver 监听变化；解除挂载断开监听，避免每次音频帧变化都重复订阅。
- Banner 定位 `bottom: dockHeight + 10`，Dock 初始高度未测量完成前不显示，防止闪现到错误位置。

- [ ] 写失败测试：准确标题/副文案/查看说明/关闭名称；按钮分别调用对应动作；抑制时保留节点但不能操作；Dock 上报初始和 resize 后栏高，卸载清理，ref 指向真实录音按钮。
- [ ] 运行 `npm test -- src/__tests__/FirstUseHelpBanner.test.tsx src/__tests__/RecordDock.test.tsx`，预期新断言失败。
- [ ] 实现组件、固定定位样式、Dock 测量/ref；图标使用现有 SVG 风格，不添加图片依赖。
- [ ] 重跑上述测试通过；浏览器比较提示显示/关闭前后的图表矩形，预期坐标和高度相同。
- [ ] 提交 `feat(help): add floating portrait first-use banner`。

## Task 3：页面集成、焦点与最终验收

**Files:** Modify `src/routes/AppShell.tsx`, `src/routes/AnalysisPortrait.tsx`, `src/routes/PracticePortrait.tsx`, `src/__tests__/AppShellPortrait.test.tsx`, `src/__tests__/layoutShells.test.tsx`, `docs/ui-design.md`, `docs/ui-design-portrait.md`；按实际文件补充帮助集成测试。

**Interfaces:** 消费 Task 1 hook、Task 2 Banner/Dock props，继续使用 `openHelp('quick-start')`，不新增 ShellContext 接口。

- [ ] 写失败测试：两个竖屏页均无旧空状态行动且只有一个新提示；横屏旧行动保持；未完成的空闲无数据状态显示；授权/录音/回放/已有数据暂时隐藏；没有有效帧时回到空闲可恢复。
- [ ] 写失败测试：关闭后清空/路由切换/布局切换不恢复；横屏有效分析后转竖屏不显示；点击查看说明只打开 quick-start，不调用音频操作。
- [ ] 写失败测试：帮助开关保留提示触发按钮焦点；帮助打开时出现有效帧，关闭后聚焦录音按钮；主动关闭提示也能落到录音按钮但不触发录音。
- [ ] 运行 `npm test -- src/__tests__/AppShellPortrait.test.tsx src/__tests__/layoutShells.test.tsx src/__tests__/HelpDrawer.test.tsx`，预期新断言失败。
- [ ] 在 AppShell 单实例接入资格和状态判断：宽度符合、eligible、无数据、非授权/录音/回放且已获得 Dock 高度时允许显示；弹层打开通过 suppressed 隐藏。完成后必要时记录本次帮助的焦点回退，帮助关闭之后执行，不在 Modal 焦点恢复之前执行。
- [ ] 移除两个竖屏 EmptyState 的 action，保留可复用 EmptyState.action 及横屏使用；更新旧布局测试断言。
- [ ] 重跑目标测试通过，更新当前文档为新文案、首次规则及浏览器本地识别限制。
- [ ] 执行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`，预期全部退出 0；Windows 依赖共用时类型检查可用 `../../../node_modules/.bin/tsc.cmd --noEmit`。
- [ ] 浏览器检查 360×640、390×844、768px 边界、横屏 1024px、较矮视口和字体放大：提示不挤压图表、关闭及查看说明可点、Dock 无遮挡、正文滚动不影响悬浮定位。真实设备未检查的项目如实记录。
- [ ] 完成一次独立审查，处理会影响使用的发现，记录剩余限制。
- [ ] 提交 `feat(help): show first-use help only when needed`，保留分支待用户 review。

## 本轮不包含

- 横屏帮助入口重新设计。
- 权限/设备/导入错误专属帮助提示。
- 交互式步骤引导、示例音频、访问频次推断、账号同步。
- 帮助文案全面重写、音频窗口重构及其他上一轮延期事项。

## 实施与验收记录

- Tasks 1–3 已实施：独立持久化状态、有效分析判定、C 样式/A 文案悬浮条、Dock 高度监听、竖屏旧行动移除和帮助焦点回退。
- 新用例先失败再实现通过；最终 62 个测试文件、472 项测试通过，生产构建、类型检查、差异检查通过。构建仍有应用大包体积提示。
- 浏览器检查 360×640、360×480、390×844、768px 和 1024px；确认竖屏提示在 Dock 上方 10px、横屏不显示、无横向溢出。
- 390×844 下实测关闭前后图表矩形完全相同；关闭帮助返回「查看说明」，主动关闭提示后刷新不会重新显示。
- 模态框新增可选 fallbackFocusRef，仅帮助提供录音按钮作为回退；触发按钮卸载、禁用或隐藏时使用回退。其他调用不需要传新参数。
- 补充边界回归：帮助期间有效数据使提示退出，以及无效导入数据使提示隐藏，两种情况关闭帮助均回到录音按钮；无效数据不标记完成。
- 独立源码审查无 Critical/Important；Minor 延期：帮助从竖屏打开后切至横屏再关闭，原提示和竖屏录音按钮均卸载，焦点可能回到 body，可后续补横屏回退。
- 未验证实体设备触摸、软键盘、安全区硬件或字体放大；Dock 高度变化由 ResizeObserver 回归覆盖。跨标签页即时同步不属于本轮范围。
- 保留现有 worktree 与功能分支，不创建 PR、不合并。
