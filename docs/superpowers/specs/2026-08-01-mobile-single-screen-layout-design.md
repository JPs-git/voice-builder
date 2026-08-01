# 移动端一屏适配设计

## 目标

移动端（`max-width: 768px`）下，所有 UI 限制在同一屏高度内，无需向下滚动。当前移动端垂直堆叠 5 块内容（工具栏、目标区间、实时反馈、基频图、共振峰图），超出视口高度导致必须滚动才能看到共振峰谱。

## 布局目标（≤768px）

```
┌──────────────────────────────┐
│  Toolbar（固定高度）          │
├──────────────────────────────┤
│ 目标区间  │   实时反馈        │  ← 左右各半，同一行
├──────────────────────────────┤
│ 基频图（弹性高度）            │
├──────────────────────────────┤
│ 共振峰图（弹性高度）          │
└──────────────────────────────┘
```

整页 `overflow: hidden`，两张图表 flex 弹性填满剩余空间，各占剩余高度约一半，宽度最大化。桌面端（>768px）布局完全不变。

## 根因

`#app` 是 flex column（`min-height: 100vh`），但 AnalysisPage 根 `<div>` 是无样式的 block 元素，`.content` 上的 `flex: 1` 实际不生效——页面高度完全由内容决定，必然溢出。图表卡 `height: 280px`（移动端固定值）进一步加剧溢出。

## 改动清单

### JSX（1 处）

`src/routes/AnalysisPage.tsx`：根 `<div>` 添加 `className={styles.page}`。

### CSS（均在 `@media (max-width: 768px)` 内）

| 文件 | 选择器 | 改动 |
|---|---|---|
| `src/routes/AnalysisPage.module.css` | `.page`（新增） | `display:flex; flex-direction:column; height:100dvh; overflow:hidden` |
| 同上 | `.content` | `flex:1; min-height:0; display:flex; flex-direction:column; gap:12px` |
| 同上 | `.sidePanel` | 改 `flex-direction:row`（左右各半），保留 gap，`flex-shrink:0`，移除 `margin-bottom:14px` |
| 同上 | `.chartsColumn` | `flex:1; min-height:0` |
| 同上 | `.chartWrapper` | `flex:1; height:auto; min-height:0; margin:8px`（替换 `height:280px`） |
| `src/components/TargetPresetBar.module.css` | `.bar` | `flex:1; min-width:0`；压紧：`padding:10px`、`gap:10px`、输入框 `height:20px` |
| `src/components/FeedbackCard.module.css` | `.card` | `flex:1; min-width:0`；压紧：`padding:10px` |
| `src/components/Toolbar.module.css` | `.toolbar` | `flex-shrink:0` |

图表内部 `.card` 已有 `flex:1; min-height:0`，`.chartArea` 保持 `flex:1 1 auto; min-height:120px`（保证极矮屏下图表仍可用）。

## 取舍与边界

- 极矮屏（如横屏手机）下图表相应变矮，最低 120px。
- 目标区间面板在移动端做轻微压紧（padding/字号/输入框高度微调），不改变任何业务逻辑。
- 实时反馈面板不承载交互，仅压紧内边距。
- ECharts 容器尺寸变化依赖 `window resize` 事件（现有 `useECharts` 已监听），无需新增逻辑。

## 验证

- jsdom 无法覆盖 CSS media query 布局，验证方式：
  - 现有测试全绿（`npm test`）
  - `npx tsc --noEmit`
  - `npm run build`
  - 浏览器 DevTools 移动端模拟（375×667 等）确认一屏无滚动、布局符合上图
