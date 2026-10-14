# Portrait Feedback Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 本任务建议在当前会话内顺序实施。

**Goal:** 竖屏反馈栏用声区徽标展示真声/混声/假声，各频率指标通过独立箭头和数值颜色表达与目标区间的关系。

**Architecture:** 继续读取同一 Zustand store 的 latestFrame、bands、formantVisible。声区直接使用已有 register 结果；频率方向复用 getFormantStatus，展示前统一排除无效值。共享声区名称映射，竖屏组件负责展示规则和样式。

**Tech Stack:** React 19、TypeScript、Zustand、CSS Modules、Vitest、Testing Library；无需新运行时依赖。

**Spec:** 本文“确认范围与交互规则”章节，依据本对话用户提供的反馈栏图片及已确认的交互说明。

## Baseline 与工作区

- 已执行 `git fetch origin master`。
- 基线：`ad87c29b6f505968a68464bd9fee7c2d1b8722e0`，版本 1.14.2，包含 PR #47 的 F0 参考区间修复。
- 分支：`feat/portrait-feedback-indicators`。
- Worktree：`C:/Users/Administrator/Projects/voice-builder/.worktrees/feat/portrait-feedback-indicators`。
- 基线验证：52 个测试文件、387 项测试通过；已有异常路径日志和 Toast act 警告。
- 计划已获用户审核，以下三项任务已完成。

## 确认范围与交互规则

### 声区徽标

原状态徽标位置改为声区；保持单行结构“图标 → 实时反馈 → 声区 → F0 → F1 → F2”。

| latestFrame.register | 竖屏徽标 |
|---|---|
| chest | 真声 |
| mixed | 混声 |
| falsetto | 假声 |
| unvoiced、null、undefined，或没有 frame | 等待声音 |

读取算法已有结果，不新增置信度阈值或 F0 推断规则。声区不依赖指标是否显示，也不依赖目标命中：全部指标隐藏后，仍显示当前声区。有效声区统一使用信息色背景 `var(--info-soft)` 与文字 `#175CD3`；等待状态使用中性灰，不用颜色评价某种声区好坏。

### 各指标状态

保留 F0/F1/F2 标签现有绿/红/蓝身份颜色。改变数字与箭头颜色，Hz 单位保持现有中性色；箭头放在对应数值后、单位前。

| 条件 | 数字 | 箭头 | 数字及箭头颜色 |
|---|---|---|---|
| 有限正数，低于本指标下限 | 取整 | ↓ | 蓝 `#175CD3` |
| 有限正数，高于本指标上限 | 取整 | ↑ | 红 `#B42318` |
| 有限正数，在闭区间内 | 取整 | 无 | 绿 `#067647` |
| null、undefined、NaN、Infinity、零或负数 | -- | 无 | 灰 `#667085` |

先以原始精度比较目标，再取整显示。上下限均包含在范围内。箭头描述当前值的位置，不代表要求用户往箭头方向调整。高、低状态同时出现时逐项显示，不再生成偏高优先的整体徽标。

给每列添加可读名称，例如 `F0 300 Hz，高于目标范围`、`F1 暂无有效数据`；箭头本身 aria-hidden，避免重复朗读。不要对每一分析帧设置 aria-live。

### 布局与连续性

声区和每个指标从同一最新帧读取。切换预设或编辑目标后立即重新比较；隐藏的指标不占列；停止录音保留最后结果，清空恢复等待和占位符。

保留现有单行尺寸；给箭头预留固定宽度，避免状态变化引发数字跳动。以 320、360、390、768 CSS px 验证，最大四位数、三个箭头和“等待声音”状态均不截断关键内容。

## Global Constraints

- 当前范围为竖屏实时反馈栏及必要的共享声区名称映射；桌面反馈行为保持原有规则。
- 声区算法、分析管线、参考区间、元音目标默认值及持久化格式不变。
- 不加入音域统一、孤立数据点修复、完整上手引导等其他工作。
- 按 AGENTS.md 使用当前 worktree；主 checkout 保持干净的 master。
- 后续 PR base 为 master，标题以 `feat` 开头，合并方式 Squash。
- 完成实施后运行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`。

## Review Focus

1. 同一帧既有偏高又有偏低：各列独立保留方向，声区不被覆盖（Task 2）。
2. 无效数值及边界：占位符不得显示方向，边界值不显示箭头（Task 2）。
3. 声区与指标可见性：隐藏全部频率仍能显示声区；缺失声区不伪造为真声（Task 1、2）。
4. 状态更新：切目标、更新帧及清空后不残留上次箭头或声区（Task 2、3）。
5. 窄屏排版与桌面回归：箭头不被 overflow:hidden 裁掉，桌面声区标签保持原样（Task 1、3）。

## 文件职责

| 文件 | 变更 |
|---|---|
| `src/feedback/register.ts`（新建） | 导出共享 VOICE_REGISTER_LABELS，避免两端维护两份声区名称 |
| `src/components/FeedbackCard.tsx` | 只将私有 REGISTER_LABEL 替换为共享名称映射 |
| `src/components/mobile/FeedbackHero.tsx` | 声区徽标、逐指标有效性与方向、可访问名称 |
| `src/components/mobile/FeedbackHero.module.css` | 声区信息色、指标状态色、箭头占位和窄屏布局 |
| `src/__tests__/FeedbackHero.test.tsx` | 替换旧整体偏高/偏低断言，覆盖新状态交互 |
| `src/__tests__/FeedbackCard.test.tsx` | 复用现有桌面声区回归测试 |
| `src/__tests__/layoutShells.test.tsx` | 更新受影响的结构断言，覆盖录音/清空及布局切换 |
| `docs/ui-design-portrait.md` | 实施完成后更新当前有效的反馈栏规范 |

### Task 1: 用现有声区结果替换整体徽标

**Interfaces:** 新增 `VOICE_REGISTER_LABELS: Readonly<Record<VoiceRegister, string>>`，值为 chest→真声、mixed→混声、falsetto→假声、unvoiced→—。桌面消费原样名称；移动端对 unvoiced 及缺失值显示等待声音。保留 `hero-badge` 定位，使用 `data-register` 区分四态，移除旧 resolveBadge、Badge 类型及对应汇总逻辑。

- [x] 先改 FeedbackHero 测试：用 `it.each` 输入 chest/mixed/falsetto/unvoiced/undefined，断言徽标分别显示真声/混声/假声/等待声音/等待声音；包含无 frame 用例。
- [x] 增加两条可见行为断言：`register='chest'` 且 F0 偏高时仍显示真声；隐藏 F0/F1/F2 后仍显示真声。
- [x] 运行 `npm test -- --project unit src/__tests__/FeedbackHero.test.tsx`，确认新徽标测试因旧行为失败。
- [x] 新建名称映射、更新两端引用和移动端徽标；CSS 将 `data-tone` 的目标命中样式改为 `data-register` 的声区样式。未知/缺失结果按 unvoiced 处理，不改变桌面缺失值显示。
- [x] 运行 `npm test -- --project unit src/__tests__/FeedbackHero.test.tsx src/__tests__/FeedbackCard.test.tsx`，确认通过。删除仅服务于旧汇总行为的测试。
- [x] 提交：`feat(feedback): display register in portrait badge`。

### Task 2: 增加独立方向箭头与数字状态色

**Interfaces:** `statusGlyph(status: FormantStatus): '↑' | '↓' | ''`。每列设置 `data-status='high'|'low'|'hit'|'none'`；继续保留 `hero-col-f0/f1/f2` 和 `hero-f0` 的数字定位。有效值调用现有 getFormantStatus，无效值直接归为 none，不改共享比较函数。

- [x] 先添加混合状态测试：默认目标、帧 `{f0:300,f1:700,f2:1200,register:'mixed'}`，F0 为 high/↑，F1 为 low/↓，F2 为 hit/无方向；徽标仍为混声。
- [x] 添加参数化测试：F0 为 200、280 时 hit；199.9 为 low，280.1 为 high；null/NaN/Infinity/0/-1 时 --/none/无方向。缺失值对 F1/F2 同样覆盖。
- [x] 添加更新测试：帧 F0=300 时为 high，将目标改成 [290,310] 后为 hit，恢复预设后为 high；更新帧至 190 后为 low；隐藏 F1 后不再显示该列。
- [x] 为 low/high/hit/none 断言可访问名称，确保方向信息可通过文字理解。
- [x] 运行 FeedbackHero 测试，确认箭头、data-status 及可访问名称的新断言先失败。
- [x] 在现有组件的逐指标渲染中加入有效性判断、statusGlyph 和 aria-label；CSS 在数字/箭头层按 data-status 上色，保留标签身份色及单位中性色，预留箭头槽位。不要把所有文字继承为指标颜色。
- [x] 运行 `npm test -- --project unit src/__tests__/FeedbackHero.test.tsx src/__tests__/FeedbackCard.test.tsx src/__tests__/status.test.ts`，确认通过。
- [x] 提交：`feat(feedback): show per-metric direction and status colors`。

### Task 3: 验证集成、窄屏及文档同步

**Interfaces:** 复用 Task 1、2 的 DOM 状态及现有 store/shell，无新增产品接口。

- [x] 在 layoutShells 的既有真实组件测试中加入竖屏有结果→清空→等待声音/-- 的行为断言；横竖切换后同一帧的频率及声区保持对应。若现有测试 mock 了组件，使用实际 FeedbackHero，不对 mock 本身做断言。
- [x] 先运行该测试并检查覆盖是否有效，再按实际行为完善 Task 1、2；无需专门测试文案源码或常量定义。
- [x] 更新 docs/ui-design-portrait.md 的实时反馈栏规范：声区独立展示、箭头含义、四种数字颜色、缺失值及可访问性。
- [x] 执行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`；要求退出码均为 0，记录既有警告。
- [x] 浏览器检查 320/360/390/768px 与桌面宽度：使用本地合成音频或开发测试夹具覆盖混合方向、四位数和无结果，避免调用用户真实麦克风。检查实际 CSS 颜色、固定箭头槽位、单行无截断、隐藏列、清空和切目标。DOM 测试不能替代真实布局检查。
- [x] 对照需求与 diff 自审：确认声区未从频率推断、旧整体徽标逻辑已删除、桌面只复用名称、PR #47 的共享参考数值保持正确。
- [x] 提交：`test(feedback): cover portrait feedback integration`（包含相应规范文档更新）。

## 交付与执行边界

本计划经用户审核后已在当前会话顺序执行。全量 399 项测试、构建、类型检查和差异检查通过；独立代码审查未发现阻塞问题。已用本地合成夹具验证 320/360/390/768px 的四位数、方向箭头、实际颜色、目标编辑、隐藏列和清空，并验证桌面反馈。集成清空测试位于 AppShellPortrait.test.tsx（该文件使用真实 useToolbar），布局切换测试位于 layoutShells.test.tsx。创建 PR、合并及清理 worktree 按后续用户指令进行。
