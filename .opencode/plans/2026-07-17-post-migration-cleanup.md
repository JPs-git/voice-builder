# React 迁移后清理与 Bug 修复计划

日期: 2026-07-17

## Bug 分析

### Bug 1: TargetPresetBar 输入框无法主动输入

**根因**: `TargetPresetBar.tsx:19-25` 的 `handleInputChange` 是受控组件，当用户清空输入框时 `parseFloat('')` 返回 `NaN`，`!Number.isFinite(NaN)` 触发 `return`，状态不更新，输入框弹回旧值。

**修复方案**: 在组件内用本地 `useState` 缓冲输入值，`onBlur` 时再解析并 dispatch。

### Bug 2: 初始值不匹配元音 a

**根因**: `AnalysisContext.tsx:29-33` 的 `DEFAULT_BANDS` 是 `f0=[200,290], f1=[400,750], f2=[1200,2200]`，而 `VOWEL_PRESETS['vowel-a']` 是 `f0=[200,280], f1=[800,1000], f2=[1100,1400]`，两者完全不一致。

**修复方案**: `DEFAULT_BANDS` 直接从 `VOWEL_PRESETS['vowel-a']` 派生。

## TODO 清单

| # | 类别 | 任务 | 文件 |
|---|------|------|------|
| 1 | **Bug** | 修复 TargetPresetBar 输入框：用本地 state 缓冲输入，onBlur 时 dispatch | `src/components/TargetPresetBar.tsx` |
| 2 | **Bug** | DEFAULT_BANDS 改为从 VOWEL_PRESETS['vowel-a'] 派生 | `src/contexts/AnalysisContext.tsx` |
| 3 | **清理** | 删除孤立文件 `js/f0-chart.js` | `js/f0-chart.js` |
| 4 | **清理** | 删除孤立文件 `js/formant-chart.js` | `js/formant-chart.js` |
| 5 | **清理** | 删除孤立文件 `js/tip-widget.js` | `js/tip-widget.js` |
| 6 | **清理** | 删除孤立文件 `js/playback.js` | `js/playback.js` |
| 7 | **清理** | 删除孤立文件 `js/spectrogram.js` | `js/spectrogram.js` |
| 8 | **功能** | 接入 PlaybackManager，完成回放按钮功能 | `src/routes/AnalysisPage.tsx`, `src/components/Toolbar.tsx` |
| 9 | **测试** | 添加 TargetPresetBar 组件测试（输入、预设切换） | `src/__tests__/TargetPresetBar.test.tsx` |
| 10 | **测试** | 添加 AnalysisContext reducer 测试 | `src/__tests__/AnalysisContext.test.tsx` |
| 11 | **文档** | 更新 AGENTS.md 反映 React 架构 | `AGENTS.md` |
