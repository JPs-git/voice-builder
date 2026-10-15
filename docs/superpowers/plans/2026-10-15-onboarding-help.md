# 首次上手与主动帮助优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除随机自动小提示，用空白页上手入口、图表说明入口和统一帮助面板，让用户主动获得当前需要的解释。

**Architecture:** 帮助内容和主题标识集中维护；AppShell 统一管理帮助面板的打开状态和主题，页面通过 ShellContext 请求打开对应主题。复用现有 Modal 的键盘、焦点和视口处理，保留 HelpDrawer 的导出名称以减少调用改动。所有新帮助入口均由用户点击触发，不创建新的自动弹窗或提示定时器。

**Tech Stack:** React、TypeScript、React Router outlet context、现有 CSS Modules、Vitest、Testing Library；不增加依赖。

**Spec:** 本文「设计约定」为本计划的设计依据。用户于 2026-10-15 通过「开始实施」批准执行；下方保留原任务清单，完成记录见文末。

## 基线与工作环境

- 日期：2026-10-15（Asia/Shanghai）。
- 基线：最新 master，`9375b22`，v1.16.0。
- 分支：`feat/onboarding-help`。
- Worktree：`C:/Users/Administrator/Projects/voice-builder/.worktrees/feat/onboarding-help`。
- 主 checkout 保持 master、干净；后续所有实现均在上述 worktree。

## 已确认需求与现状

用户确认：随机小提示影响体验，应移除并改用其他帮助方式；要求先制定优化计划。

代码现状：

1. `AnalysisLandscape.tsx` 挂载 `TipWidget`，每 5 秒交替显示/隐藏随机内容；竖屏没有对应入口，体验不一致。
2. `HelpDrawer.tsx` 包含旧的「顶部开始录音」「导入 WAV」「绿色目标区间」说明，元音参数重复写死，并展示界面没有直接对应展示的 F3/F4。
3. 横屏帮助位于工具栏，竖屏位于更多菜单；图表空状态没有可点击的帮助行动。
4. `EmptyState` 默认 `pointer-events: none`，增加帮助入口必须只让按钮接收事件，避免挡住图表交互。
5. AppShell 的 ShellContext 已提供录音等操作；帮助操作目前只有开/关，没有按主题打开能力。
6. `useToolbar` 已将帮助与录音/导入等音频操作分开，打开帮助不会主动停止录音，应保留。
7. 图谱范围、固定基频参考区间、元音目标默认值已有配置来源，帮助应读取这些配置。

## 设计约定（拟议方案）

### 1. 移除随机小提示

- 删除 TipWidget 挂载、组件、样式和只测试该组件的旧用例。
- 保留现有按用户操作出现的校验气泡、必要错误反馈和其他业务提示。
- 不用自动首次弹窗、轮播卡片、悬浮广告式帮助入口替代它。
- 历史设计/实施文档保留原记录；只更新当前有效的使用/UI 文档。

### 2. 一个帮助面板，多种主动入口

帮助主题固定为：

```ts
export type HelpTopic =
  | 'quick-start'
  | 'charts'
  | 'targets'
  | 'audio'
  | 'troubleshooting'
  | 'pitch-reference'
```

- 顶栏「帮助」和竖屏「更多 → 帮助」打开 `quick-start`。
- 声音分析空白页提供「查看上手步骤」，打开 `quick-start`。
- 基频、共振峰标题旁的说明按钮打开 `charts`；音高参考图表说明打开 `pitch-reference`。
- 帮助面板内提供主题目录，用户可随时切换；关闭后返回原入口焦点。
- 首次访问和回访均不自动打开帮助。空白页入口持续可用，不引入首次访问标记或新的本地存储。
- 帮助使用现有 Modal；长内容在正文滚动，关闭按钮固定，支持 Esc、焦点约束和移动端软键盘。
- 同时只打开一个应用帮助/设置弹层，避免帮助与目标设置、配置或关于互相遮挡。
- 不向训练目标卡片重新加入此前已明确移除的「ⓘ 规则」入口。

### 3. 上手内容与文案

快速上手使用三段短步骤，不做跨页面的强制聚焦导览：

1. **开始录音**：横屏说明顶栏入口；竖屏说明底部麦克风入口。用户点击录音后才申请权限。
2. **观察反馈**：说明当前曲线、箭头、对勾和目标区间；区分固定基频参考区间与可编辑训练目标。
3. **调整与回放**：说明元音切换、数字输入失焦提交、滑杆实时生效、回放和全部预设恢复。

其他主题：

| 主题 | 必须覆盖的内容 |
|---|---|
| 读图与反馈 | F0/F1/F2 对应界面；曲线/参考线/目标区间；图例显隐；没有有效数据时显示 --；参考命中与声音评价的区别 |
| 训练目标 | 默认预设与自定义；F0 0–500、F1/F2 0–3500；50 Hz 间隔和 F1/F2 顺序；失焦提交；全部恢复并切回 a |
| 录音与导入 | 开始/停止/继续、回放、清除；「导入音频」入口；当前导入时长限制；浏览器解码结果存在差异，不承诺所有同扩展名文件均可解码 |
| 遇到问题 | 权限未允许、找不到或无法连接设备、已录音无有效曲线、共振峰数据不稳定、音频过长或解码失败；给出针对操作而非统一要求刷新 |
| 音高参考 | 切换页面、点击琴键听参考音、观察音高图；不将音高参考页误写成训练目标编辑入口 |

- 元音表只展示当前界面直接使用的 F0/F1/F2，读取 `VOWEL_PRESETS`。
- 范围和固定参考区间读取 `analysisRanges.ts`；需要共同引用的限制先核对已有常量，不能在帮助文件再复制一份数值。
- 不在帮助中作没有依据的训练效果承诺；音频处理/存储说明必须先检查实际数据流后再写。

### 4. 空状态与情境说明

- 分析页只在第一张图的空状态提供主上手入口，避免两张图重复堆按钮。
- 音高参考页空状态提供「了解音高参考」。
- 录音期间不自动弹出帮助、不重置步骤、不影响音频流；不为了本次改动重新定义 `hasData`。
- 图表说明入口横竖屏均可发现，点击才打开；不靠 hover 才能阅读，不设置自动消失时间。
- 提示按钮有明确无障碍名称，例如「基频图说明」，不把颜色或图标作为唯一解释。
- 本轮排错内容先由帮助主题承接；新增麦克风检测仪表、错误状态系统、错误 toast 动作入口等列为后续迭代。

## Global Constraints

- 无随机自动提示，无新帮助定时器，无自动首次弹层。
- 保持录音、回放、导入、目标保存及算法行为；不改音频初始化、权限请求调用链。
- 只在用户直接点击现有录音操作时申请麦克风权限，阅读帮助不触发权限请求。
- 横竖屏共享帮助内容、主题和数据来源；仅入口位置、操作位置说明随布局变化。
- 不引入新依赖、埋点、账号、示例音频或新训练系统导流功能。
- 不修改历史设计文档来抹除过往记录；不改此前暂缓处理的其他横竖屏反馈差异。
- PR base 为 master，feat 类型标题，最终使用 Squash；合并前测试、构建、类型检查全部通过。

## Review Focus

1. 录音或回放中打开/关闭帮助：不得停止、重启或重置音频流程（Task 3）。
2. 空状态按钮触摸命中：按钮可点，空白遮罩不截获图表拖动和点击（Task 4）。
3. 帮助关闭后的焦点、Tab/Esc 和窄屏溢出：沿用现有弹层能力并验证长内容（Task 3）。
4. 调整浏览器宽度/横竖屏切换后：帮助主题保持有效，操作说明与当前入口一致（Tasks 2/3）。
5. 修改预设或配置范围后：帮助表格显示配置默认值，不能把用户自定义值误称为默认值（Task 2）。

## 文件职责

| 文件 | 责任 |
|---|---|
| 新增 `src/content/helpContent.ts` | HelpTopic、章节标题和共享说明/数据构建 |
| 修改 `src/components/HelpDrawer.tsx` / `.module.css` | 复用 Modal，主题目录及正文渲染 |
| 新增 `src/components/ContextHelpButton.tsx` / `.module.css` | 用户点击才触发的图表说明入口 |
| 修改 `src/routes/AppShell.tsx` | 帮助主题及单一弹层控制，扩展 ShellContext |
| 修改 `src/components/EmptyState.tsx` / `.module.css` | 可选帮助行动，保留既有无行动使用方式 |
| 修改四个 Analysis/Practice 布局组件 | 移除随机提示，接入空状态和图表说明入口 |
| 删除 `src/components/TipWidget.tsx` / `.module.css` | 清除随机帮助实现 |
| 修改/新增相关测试与当前 UI 文档 | 覆盖入口、主题、配置来源和无打扰行为 |

## Task 1：移除随机小提示

**Files:**
- Modify: `src/routes/AnalysisLandscape.tsx`
- Delete: `src/components/TipWidget.tsx`, `src/components/TipWidget.module.css`, `src/__tests__/TipWidget.test.tsx`
- Test: `src/__tests__/AnalysisPage.test.tsx`, `src/__tests__/layoutShells.test.tsx`

**Interfaces:** 不引入接口；后续帮助入口由 Task 3/4 提供。

- [ ] 新增布局回归：初始页面以及推进 fake timers 30 秒后均没有「小提示」「关闭小提示」入口或卡片；横竖屏各覆盖一次。不要断言整个应用没有任何定时器。
- [ ] 运行 `npm test -- src/__tests__/AnalysisPage.test.tsx src/__tests__/layoutShells.test.tsx`，确认新用例因 TipWidget 仍存在而失败。
- [ ] 删除挂载、组件和专属样式/测试，保留其他 Tip 和业务气泡。
- [ ] 重跑上述测试，预期全部通过；`rg -n 'TipWidget' src` 应无生产引用。
- [ ] 提交 `feat(help): remove automatic rotating tips`。

## Task 2：建立共享帮助主题与准确内容

**Files:**
- Create: `src/content/helpContent.ts`, `src/__tests__/helpContent.test.ts`
- Consumes: `src/types/index.ts` 的 VOWEL_PRESETS；`src/config/analysisRanges.ts` 的范围/参考区间。

**Interfaces:**
- Produces: 上文的 `HelpTopic` 类型。
- Produces: `HELP_TOPIC_ORDER: readonly HelpTopic[]`、`getHelpTopicTitle(topic: HelpTopic): string`。
- Produces: `getQuickStartSteps(layout: 'portrait' | 'landscape'): readonly { title: string; description: string }[]`。
- 元音表由 VOWEL_PRESETS 渲染，不维护平行的静态参数表。

- [ ] 先写测试：主题顺序和标题完整；横竖屏录音位置正确；预设表/范围与配置一致；不存在「导入 WAV」「绿色区间为目标」和 F3/F4 表头。
- [ ] 运行 `npm test -- src/__tests__/helpContent.test.ts`，确认功能缺失导致失败。
- [ ] 实现共享内容，明确默认预设与当前自定义值的区别；核对导入限制和录音窗口的真实行为后撰写，无法确认的隐私/兼容性承诺不加入。
- [ ] 重跑测试，预期通过。
- [ ] 提交 `feat(help): centralize getting-started and reference content`。

## Task 3：按主题打开统一帮助面板

**Files:**
- Modify: `src/routes/AppShell.tsx`, `src/components/HelpDrawer.tsx`, `src/components/HelpDrawer.module.css`
- Test: `src/__tests__/HelpDrawer.test.tsx`（新增）, `src/__tests__/AppShell.test.tsx`, `src/__tests__/AppShellPortrait.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 HelpTopic、标题和共享内容。
- Produces: ShellContext 增加可选 `onOpenHelp?: (topic: HelpTopic) => void`，保持已有测试夹具兼容；真实 AppShell 始终提供。
- HelpDrawer props 保留 `open/onClose`，新增 `topic: HelpTopic`、`onTopicChange: (topic: HelpTopic) => void`。
- AppShell 的内部 `openHelp(topic: HelpTopic = 'quick-start')` 同时选择主题并打开，必要时先关闭其他设置弹层。

- [ ] 先写失败用例：顶栏/更多菜单帮助打开快速上手；指定主题直接显示该章；切换章节可用；打开帮助不调用录音/回放/清除；阅读帮助不请求麦克风；无自动打开。
- [ ] 覆盖 Esc、焦点返回、Tab 约束，录音/回放期间打开关闭，以及帮助已开时切换布局后文案更新。
- [ ] 运行 `npm test -- src/__tests__/HelpDrawer.test.tsx src/__tests__/AppShell.test.tsx src/__tests__/AppShellPortrait.test.tsx`，确认新增断言失败。
- [ ] 实现受控主题面板；复用 Modal；目录使用实际按钮和选中状态，正文保持可滚动；禁止嵌套应用弹层。
- [ ] 重跑测试通过，手动检查 360px 宽度及较矮视口下目录/表格/关闭按钮可用。
- [ ] 提交 `feat(help): add topic-based help navigation`。

## Task 4：接入空白页上手与图表说明入口

**Files:**
- Create: `src/components/ContextHelpButton.tsx`, `.module.css`, `src/__tests__/ContextHelpButton.test.tsx`
- Modify: `src/components/EmptyState.tsx`, `.module.css`
- Modify: `src/routes/AnalysisLandscape.tsx`, `AnalysisPortrait.tsx`, `PracticeLandscape.tsx`, `PracticePortrait.tsx`
- Test: `src/__tests__/EmptyState.test.tsx`, `src/__tests__/layoutShells.test.tsx`, `src/__tests__/AnalysisPage.test.tsx`

**Interfaces:**
- Consumes: Task 3 的 `ShellContext.onOpenHelp`。
- ContextHelpButton props：`label: string`、`onClick: () => void`；仅点击打开，无 hover 自动展开。
- EmptyState 增加 `action?: { label: string; onClick: () => void }`；不传时 DOM 及行为与旧版兼容。

- [ ] 先写失败用例：分析空白页的单个「查看上手步骤」打开 quick-start；基频/共振峰打开 charts；音高参考入口打开 pitch-reference；不会触发 onRecord。
- [ ] 覆盖已有数据、录音/授权中状态不自动插入引导；空状态消失后行动按钮也消失；键盘可操作帮助按钮。
- [ ] 运行 `npm test -- src/__tests__/EmptyState.test.tsx src/__tests__/ContextHelpButton.test.tsx src/__tests__/layoutShells.test.tsx src/__tests__/AnalysisPage.test.tsx`，确认新增断言失败。
- [ ] 接入入口，只有行动按钮使用 `pointer-events: auto`；保留空状态其他部分的事件穿透。不复制麦克风操作，也不改 hasData 或采样流程。
- [ ] 重跑测试通过；实机/浏览器核对竖屏图例、标题、说明按钮不重叠，录音中查看说明不影响曲线更新。
- [ ] 提交 `feat(help): add contextual getting-started entry points`。

## Task 5：当前文档与最终验收

**Files:**
- Modify: `docs/ui-design.md`, `docs/ui-design-portrait.md`；其他当前有效使用说明按搜索结果调整。
- 历史 `docs/superpowers/specs`、`plans` 仅作为历史保留，不批量替换过往文字。

- [ ] 更新实际入口、帮助主题、数据来源、无自动提示的交互约定。
- [ ] 检查没有遗漏生产 TipWidget 引用；帮助不出现旧按钮名或手写重复参数。
- [ ] 执行 `npm test`，预期全部通过；旧 TipWidget 专属用例删除后数量变化属于预期，不能依靠删掉其他失败用例通过。
- [ ] 执行 `npm run build`、`npx tsc --noEmit`、`git diff --check`，预期退出码均为 0。
- [ ] 浏览器检查 360/390/768/1024px，以及移动端较矮可视区域；新用户无数据、已有数据、授权中、录音中、回放中各验证一次。
- [ ] 独立审查重点：无意外音频副作用、无自动帮助、无布局遮挡、帮助值与配置一致、焦点恢复有效。
- [ ] 确认完成后再创建 master 为 base 的 PR，说明测试结果和剩余限制；不自动合并。

## 后续迭代（不混入首轮）

- 将录音权限/设备错误细分，并提供可主动打开的排错入口；需要单独审视错误状态和提示生命周期。
- 用户主动启动、可跳过和重播的分步界面导览。
- 无麦克风的示例音频体验；需要明确音频来源、授权和与用户数据的分离。
- 独立训练系统的进阶入口；待系统可用后再接入。

## 验收结论应回答的问题

1. 页面放置 30 秒后，是否没有任何自动小提示出现？
2. 横竖屏新用户能否主动找到三步上手说明，且入口说明与实际按钮一致？
3. 用户不阅读帮助时，是否可以完整使用原有分析/录音功能？
4. 不知道某张图怎么读时，能否一次点击进入相关说明？
5. 打开、切换和关闭帮助是否保持音频流程、目标设置与页面状态？
6. 修改范围/预设配置后，帮助是否仍能显示正确的默认信息？

## 实施记录（2026-10-15）

- Tasks 1–4 已实现：移除随机提示、集中帮助内容、主题模态框及横竖屏主动入口；每步先运行新增失败用例，再实现并验证通过。
- 文档更新为当前交互说明；旧桌面草图保留在 Git 历史中。
- 音频时长限制与缓冲窗口提取为共享常量，仍为 10 秒，不更改音频行为。
- 独立审查发现更多菜单卸载导致关闭帮助时焦点丢失，已补失败回归并修复，浏览器确认返回更多按钮。
- 全量回归 59 个文件、450 项测试通过；类型检查、生产构建、差异检查通过。构建保留大包体积提示。
- 浏览器检查 360/390/768/1024px 和 360×480 矮屏：帮助入口可用、正文滚动、无横向溢出，关闭按钮保持可用，Esc 返回入口焦点。
- 授权中、录音中、回放中行为由回归测试与源码审查覆盖；未实际采集麦克风音频，也未做实体设备触摸/软键盘验收。
- 审查轻微建议留待后续：快速上手可再精简补充图表符号和目标操作说明；图表自己的 10 秒显示窗口与音频窗口常量可进一步统一。目前详细主题已有说明，现行窗口数值一致。
- 本次完成实现并保留功能分支，尚未创建 PR 或合并。
