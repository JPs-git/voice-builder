# 问卷入口下线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除首页的用户访谈问卷招募横幅，使所有用户不再从网站看到本期问卷入口。
**Architecture:** 从 AppShell 移除横幅挂载和仅为横幅使用的首页匹配变量，删除无其他用途的组件、样式及组件测试，保留首页不展示问卷的回归断言。不新增开关或替代横幅。
**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest、Testing Library。
**Spec:** 本文“范围与决策”；用户要求准备下线本次问卷。
**Baseline:** master `59a6964`（1.22.0）。分支 `fix/retire-survey-banner`；worktree `.worktrees/fix/retire-survey-banner`。
**Status:** 仅制定计划，产品代码尚未修改。

## 范围与决策

- 本次下线网站入口，不操作问卷星后台、不删除问卷或已收集的回答，也不关闭外部问卷链接。
- 清理生产代码中的问卷链接 `https://v.wjx.cn/vm/PLHDDnU.aspx#` 和招募文案；保留历史设计与实施记录。
- 直接移除组件，避免留下永久关闭的死代码；日后若再次开展活动，以独立变更新增入口。
- 不读取、不清除用户既有 sessionStorage 标记。组件删除后该标记不影响页面，无需迁移。
- 保持首次使用帮助、导航、分析、录音和音高参考功能。
- 不通过 git revert 撤回整个历史 PR，使用定向删除，避免引入撤回版本判断歧义。

## Global Constraints

- 主 checkout 保持在 master 且干净，全部实现位于指定 worktree。
- PR base 为 master，标题建议 `fix(survey): retire homepage interview recruitment banner`；使用 Squash 合并。
- 不手工修改 package.json/package-lock.json 版本或已发布标签；版本交由现有发布流程判断。
- 合并前 `npm test`、`npm run build`、`npx tsc --noEmit` 全部通过。
- 不新增依赖，不调整发布流程或其他未合并 PR。

## Review Focus

1. 首次访问与刷新：首页都不出现问卷，不依赖存储中是否存在关闭标记。
2. 路由切换：音高参考、统计分析、报告页不出现问卷，导航正常。
3. 手机与桌面布局：导航和内容间无空白占位，图表与底部录音按钮无新增遮挡。
4. 首次使用提示：原帮助横幅、菜单及焦点逻辑不受影响。
5. 残留引用：生产代码不再引用 SurveyBanner、活动 ID 或招募文案。

## Task 1：移除问卷入口与专用代码

**Files:**
- Modify: `src/routes/AppShell.tsx`
- Modify: `src/__tests__/AppShell.test.tsx`
- Delete: `src/components/SurveyBanner.tsx`
- Delete: `src/components/SurveyBanner.module.css`
- Delete: `src/__tests__/SurveyBanner.test.tsx`

**Interfaces:** AppShell 对外接口与 ShellContext 不变；SurveyBanner 不再导出或挂载。

- [ ] 执行 `npm ci` 安装锁文件依赖。
- [ ] 将 `homepage survey visibility` 测试组改为下线回归：首次 renderApp('/') 后 `queryByRole('region', { name: '用户问卷调查' })` 为 null，页面不存在匹配 `/v\.wjx\.cn\/vm\/PLHDDnU/` 的链接；卸载重挂载后仍满足相同断言。保留路由切换与其他路由不出现问卷的断言，移除该组不再需要的 sessionStorage.clear()。
- [ ] 运行 `npx vitest run src/__tests__/AppShell.test.tsx`，确认新首页断言在旧实现上失败。
- [ ] 从 AppShell 删除 SurveyBanner import、仅被其使用的 isHome 变量、横幅 JSX；保留 useMatch 及其他使用者，保留 getHelpFallbackFocus 及帮助相关使用者。
- [ ] 删除上述三个专用文件，不删除历史计划文档。
- [ ] 再次运行 `npx vitest run src/__tests__/AppShell.test.tsx src/__tests__/FirstUseHelpExperience.test.tsx`，应全部通过。
- [ ] 搜索 src 内 SurveyBanner、PLHDDnU 和招募文案的引用；生产代码应为零，活动 ID 可仅出现在用于防止残留链接的回归测试中。

## Task 2：视觉验收与交付

- [ ] 实际浏览器检查桌面 1440×900、手机 390×844 与窄屏 320×740：首页导航直接连接原有页面内容，无横幅、无遗留占位；图表和录音栏显示正常。
- [ ] 刷新首页、切换音高参考和统计分析再返回：首页不再出现问卷，首次使用帮助仍可使用。不为验收请求麦克风权限。
- [ ] 执行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`，确认均通过。构建中既有体积提示单独记录，不与失败混淆。
- [ ] 复核 diff 只涉及入口下线、专用代码清理、回归测试和计划记录。
- [ ] 获得提交/PR 指令后提交并创建以 master 为 base 的 PR；记录检查结果和截图。未获得合并指令前不合并。
- [ ] 获得合并指令后使用 Squash，观察 Auto Release 与 Vercel 生产部署结果；确认线上域名首页已无问卷，记录生产部署对应提交。不能仅依据本地或预览页判断已上线。
- [ ] 合并完成且改动已保存后，按规范移除该 worktree 并删除本地分支。

## 风险与回退

改动只移除活动入口，不改变分析和录音状态。若出现布局回归，修复本次布局删除即可；确需恢复入口时，从历史版本恢复专用组件并通过独立 PR 审核。历史 sessionStorage 数据无需处理。

## 实施结果（2026-11-28）

- 已移除 AppShell 中横幅挂载、import 与专用 isHome 判断，删除组件、样式及其专用测试。
- 已添加首次访问、重挂载与切换返回均不展示入口的回归断言；先确认旧实现上失败，再完成删除。
- npm test、npm run build、npx tsc --noEmit 全部通过；构建保留既有大文件提示。
- 实际浏览器验收 1440×900、390×844、320×740：首页无问卷且无占位，图表和手机录音栏正常；切换音高参考、统计分析再返回刷新，问卷数为 0。
- src 中活动 ID 仅保留于防止入口恢复的测试断言；无组件或生产代码残留。未修改历史设计记录或问卷星后台。
- 尚未提交、推送、创建 PR 或发布；线上下线需合并部署后另行确认。
