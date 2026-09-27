# 横竖双壳框架设计（显示不变）

## 目标

只搭建「横屏 / 竖屏」双 UI 的**框架接缝**：每页用 `useMediaQuery` 选择横屏壳 / 竖屏壳组件；当前两个壳都渲染**原本的代码**（与基线显示完全一致），后续单独 UI 迭代只替换对应壳。目标是本次改动后所有布局显示效果不变。

本设计文档取代早前《横屏三区 0 滚动布局设计》（三区方案已实现后回退，见下）。

## 背景与回退原因

`17d42f2` 曾把横屏布局整体替换为「左|中|右」三区 grid + `100dvh`/`overflow:hidden` 全局锁 + 图表卡 `flex:1` 吃满中区。真机表现为布局混乱，根因：

- 左/右区固定 240/260px 过窄，TargetPresetBar（目标区间条）内容被 `overflow:hidden` 直接裁剪；
- `100dvh` + `body/#app overflow:hidden` 锁在部分视口下连带裁剪，丢失原本的自然滚动；
- 图表卡 `flex:1` 在内容驱动（非 flex-fill）容器中会解析为 0 高，需额外 `fixed` 变体兜底，复杂度失控。

结论：**横屏实际布局方案回退为原本代码**，只保留双壳框架。显示与基线 `ca2e20c` 全等（差异仅为根节点一个无视觉影响的 `data-layout` 属性）。

## 决策记录

| 项 | 结论 |
|---|---|
| 横屏布局 | 用原本的代码（原 AnalysisPage/PracticePage 布局），不做三区改造 |
| 竖屏布局 | 本迭代不动，同一套原始布局 |
| 断点 | `useMediaQuery('(max-width:768px)')` 沿用 768px |
| 框架形态 | 每页一个开关组件 + 横/竖两个壳组件；方向边界即组件边界 |
| 共享层 | 原始页面 CSS module（`AnalysisPage.module.css`/`PracticePage.module.css`）被两壳共用 |
| 音高→音符逻辑 | 抽成 `useCurrentMidi` hook（保留，行为零差异、带测试） |
| 图表修复 | 保留 `css/style.css` 的 `#f0Chart/#formantChart/#pitchChart { position:absolute; inset:0 }`（竖屏图表基类修复，显示等价） |

## 集成模型

```
AnalysisPage ─ useMediaQuery('(max-width:768px)')
  ├─ false → <AnalysisLandscape/>   原始布局 + data-layout="landscape"
  └─ true  → <AnalysisPortrait/>    原始布局 + data-layout="portrait"（未来竖屏单独 UI 的改写点）
PracticePage ─ 同构
  ├─ false → <PracticeLandscape/>
  └─ true  → <PracticePortrait/>
共享（不随方向重建）：F0Chart/FormantChart/PitchChart/TargetPresetBar/FeedbackCard/Piano/TipWidget/useCurrentMidi
```

「单独一套 UI」落地 = 竖屏迭代只改写 `AnalysisPortrait`/`PracticePortrait` 及其专属 module，不碰横屏壳与共享积木；届时竖屏壳再引入自己的 CSS 或内联样式。

## 文件结构（最终）

| 文件 | 状态 | 职责 |
|---|---|---|
| `src/hooks/useMediaQuery.ts` | 新增（保留） | `matchMedia` 封装 |
| `src/hooks/useCurrentMidi.ts` | 新增（保留） | 音高→音符 hook（原页内联逻辑的等价抽取） |
| `src/routes/AnalysisPage.tsx` | 改写 | `useMediaQuery` 开关 |
| `src/routes/PracticePage.tsx` | 改写 | `useMediaQuery` 开关 |
| `src/routes/AnalysisLandscape.tsx` | 改写 | 原始分析页标记 + `data-layout="landscape"` |
| `src/routes/AnalysisPortrait.tsx` | 改写 | 原始分析页标记 + `data-layout="portrait"` |
| `src/routes/PracticeLandscape.tsx` | 改写 | 原始练习页标记 + `data-layout="landscape"` |
| `src/routes/PracticePortrait.tsx` | 改写 | 原始练习页标记 + `data-layout="portrait"` |
| `src/routes/AnalysisPage.module.css` | 恢复（ca2e20c） | 两壳共用 |
| `src/routes/PracticePage.module.css` | 恢复（ca2e20c） | 两壳共用 |
| `css/style.css` | 回退（ca2e20c） | 仅保留图表 `absolute; inset:0` 基类修复 |
| `src/components/TargetPresetBar.module.css` | 回退（ca2e20c） | `.bar` 恢复 `max-height` + `overflow-y:auto` |
| `src/components/FeedbackCard.module.css` | 回退（ca2e20c） | `.card` 恢复原始盒模型 |
| 原重构产物 `ChartCard*` / `*Landscape/Portrait.module.css` 等 8 文件 | 删除 | — |

## 改动要点

### 1. 壳组件

新增的 ChartCard 积木与各壳自己的 module 全部移除；四个壳 = 原页面 JSX + 根节点 `data-layout`，import 恢复的页面 module。示例（AnalysisLandscape / AnalysisPortrait 同结构，仅 `data-layout` 不同）：

```tsx
export function AnalysisLandscape() {
  const { cursorTime, hasData } = useOutletContext<ShellContext>()
  // …原 AnalysisPage 的 formantVisible / legend 逻辑…
  return (
    <div className={styles.page} data-layout="landscape">
      {/* …原始标记：sidePanel(TargetPresetBar+FeedbackCard) + chartsColumn(F0/Formant)… */}
    </div>
  )
}
```

### 2. 开关

```tsx
const isPortrait = useMediaQuery('(max-width: 768px)')
return isPortrait ? <AnalysisPortrait /> : <AnalysisLandscape />
```

### 3. jsdom 说明

测试环境无 `window.matchMedia`，`useMediaQuery` 内层守卫返回 `false` → 测试默认走横屏壳；竖屏分支用 `matchMedia` mock（`layoutShells.test.tsx`）覆盖。

## 验证

- `npm test`（预期 277 全绿；`layoutShells` 断言 `data-layout`、`AnalysisPage`/`PracticePage` 原始行为测试不变）。
- `npx tsc --noEmit`、`npm run build`。
- 显示等价 = 与基线 `ca2e20c` 逐宽度对照：跨 1920×1080 / 1280×720 / 1024×768 / 812×375 / 800×600 / 769↔768 边界与旋转，除 `data-layout` 属性外渲染一致。

## 非目标

- 横屏三区 / 0 滚动布局（放弃）。
- 竖屏单独 UI 设计（后续单独一版 spec，直接在 `AnalysisPortrait`/`PracticePortrait` 上起步）。
- 引入 ResizeObserver 或任何新滚动容器。