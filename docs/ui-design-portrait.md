# 在线声音训练 · 移动端 Design Tokens

**版本：** v1.0  
**设计基准：** 390 × 844 px  
**平台：** Mobile Web / H5 / PWA  
**适用范围：** UI、UX、前端组件与图表系统

---

## 1. 设计原则

### 1.1 Mobile First

移动端不是 PC 的缩小版，而是围绕：

> **训练 → 反馈 → 调整 → 再训练**

重新组织信息。

### 1.2 数据优先

F0 / F1 / F2 使用固定语义色；状态变化不能只依赖颜色，还应配合文字、图标或位置变化。

### 1.3 触控优先

核心操作最小触控区域建议为 **44 × 44 px**，录音按钮建议达到 **56–64 px** 的视觉尺寸。

### 1.4 视觉克制

使用白色卡片、浅灰边框、轻阴影建立层级，避免复杂装饰。

### 1.5 图表可读性

移动端优先保证坐标、目标区间和当前曲线可读，不直接压缩 PC 图表。

---

# 2. Typography / 字体 Token

## 2.1 字体族

```css
--font-family-primary:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  sans-serif;
```

中文环境优先使用系统中文字体。

## 2.2 字号

| Token | Value | 用途 |
|---|---:|---|
| `font.size.display` | 28px | 实时 F0 主数值 |
| `font.size.h1` | 20px | 页面 / 模块主标题 |
| `font.size.h2` | 17px | 卡片标题 |
| `font.size.body` | 15px | 主要正文、关键数据 |
| `font.size.body-sm` | 14px | 辅助正文、按钮 |
| `font.size.caption` | 12px | 说明、单位、状态 |
| `font.size.chart` | 11px | 图表坐标轴、图例 |

## 2.3 字重

| Token | Value | 用途 |
|---|---:|---|
| `font.weight.regular` | 400 | 普通文本 |
| `font.weight.medium` | 500 | 标签、按钮 |
| `font.weight.semibold` | 600 | 模块标题、关键数字 |
| `font.weight.bold` | 700 | 重要状态 / 强调 |

## 2.4 行高

| Token | Value | 用途 |
|---|---:|---|
| `font.lineHeight.tight` | 1.2 | 大数字、标题 |
| `font.lineHeight.normal` | 1.5 | 正文 |
| `font.lineHeight.relaxed` | 1.6 | 说明文字 |

---

# 3. Color / 颜色 Token

## 3.1 品牌色

| Token | Hex | 用途 |
|---|---|---|
| `color.brand.primary` | `#E94262` | 开始录音、主按钮、当前元音 |
| `color.brand.primary-hover` | `#D93655` | Pressed / Hover |
| `color.brand.primary-soft` | `#FFF0F3` | 品牌浅色背景 |

## 3.2 文本

| Token | Hex | 用途 |
|---|---|---|
| `color.text.primary` | `#18304A` | 标题、主要文字 |
| `color.text.secondary` | `#6F8197` | 辅助文字 |
| `color.text.tertiary` | `#9AA9BA` | 次要 / 禁用文字 |
| `color.text.inverse` | `#FFFFFF` | 深色背景上的文字 |

## 3.3 Surface

| Token | Hex | 用途 |
|---|---|---|
| `color.surface.page` | `#F7F9FC` | 页面背景 |
| `color.surface.card` | `#FFFFFF` | 卡片背景 |
| `color.surface.elevated` | `#FFFFFF` | 弹层 / 浮动面板 |
| `color.surface.disabled` | `#F1F4F7` | 禁用控件 |

## 3.4 Border

| Token | Hex | 用途 |
|---|---|---|
| `color.border.default` | `#E4EAF0` | 默认边框 |
| `color.border.subtle` | `#EDF1F5` | 分割线、图表网格 |
| `color.border.strong` | `#D4DDE7` | 强调边框 |

## 3.5 Semantic

| Token | Hex | 用途 |
|---|---|---|
| `color.semantic.success` | `#12A981` | 达标 / 目标范围内 |
| `color.semantic.success-soft` | `#E8F8F3` | 成功背景 |
| `color.semantic.warning` | `#F5A623` | 提醒 / 偏差 |
| `color.semantic.warning-soft` | `#FFF6E5` | 提醒背景 |
| `color.semantic.error` | `#E65368` | 错误 / 超出范围 |
| `color.semantic.error-soft` | `#FFF0F3` | 错误背景 |
| `color.semantic.info` | `#4387F5` | 信息 / 辅助操作 |
| `color.semantic.info-soft` | `#EEF5FF` | 信息背景 |

---

# 4. Chart / 图表颜色 Token

| Token | Hex | 用途 |
|---|---|---|
| `color.chart.f0` | `#13B98B` | F0 数据 / 目标 |
| `color.chart.f1` | `#E84C68` | F1 数据 / 目标 |
| `color.chart.f2` | `#4387F5` | F2 数据 / 目标 |
| `color.chart.f0-soft` | `#E9F8F3` | F0 目标区间 |
| `color.chart.f1-soft` | `#FFF0F3` | F1 目标区间 |
| `color.chart.f2-soft` | `#EEF5FF` | F2 目标区间 |
| `color.chart.grid` | `#EDF1F5` | 网格 |
| `color.chart.axis` | `#B8C4D1` | 坐标轴 |
| `color.chart.target-line` | `#AAB7C5` | 目标虚线 |

### 图表规则

- 当前数据线：建议 `2–3px` 实线。
- 当前采样点：`6–8px` 圆点。
- 目标线：`1px dashed`。
- 网格线保持低对比度。
- 图例使用「颜色点 + 文本」。
- 不能仅依靠颜色表达「达标 / 不达标」。

---

# 5. Spacing / 间距 Token

采用 **4px 基础网格**。

| Token | Value | 用途 |
|---|---:|---|
| `space.0` | 0px | 无间距 |
| `space.1` | 4px | 图标与文字微间距 |
| `space.2` | 8px | 紧凑元素 |
| `space.3` | 12px | 卡片间距、控件间距 |
| `space.4` | 16px | 页面边距、卡片内边距 |
| `space.5` | 20px | 大组件内部 |
| `space.6` | 24px | 模块上下间距 |
| `space.7` | 28px | 标题与内容 |
| `space.8` | 32px | 大区块 |
| `space.9` | 36px | 大留白 |
| `space.10` | 40px | 页面级分隔 |
| `space.12` | 48px | 底部安全留白 |

### 核心布局

```text
页面左右 Padding：16px
卡片之间：12px
卡片内部：16px
主要模块之间：24px
```

---

# 6. Radius / 圆角 Token

| Token | Value | 用途 |
|---|---:|---|
| `radius.sm` | 8px | 小控件、输入框 |
| `radius.md` | 12px | 按钮、标签、图表容器 |
| `radius.lg` | 16px | 主要 Card |
| `radius.xl` | 20px | 大卡片、浮动面板 |
| `radius.pill` | 999px | Status、Tab、胶囊按钮 |

---

# 7. Shadow / 阴影 Token

| Token | Value | 用途 |
|---|---|---|
| `shadow.card` | `0 2px 10px rgba(24,48,74,.06)` | 普通卡片 |
| `shadow.elevated` | `0 8px 24px rgba(24,48,74,.10)` | 弹层 / 重点面板 |
| `shadow.floating` | `0 12px 32px rgba(24,48,74,.12)` | 底部录音栏 |

原则：

> **轻、软、低对比度。**

---

# 8. Layout / Mobile 布局 Token

| Token | Value | 说明 |
|---|---:|---|
| `layout.mobile.width` | 390px | 设计稿基准 |
| `layout.page.padding` | 16px | 页面左右边距 |
| `layout.card.gap` | 12px | Card 垂直间距 |
| `layout.card.padding` | 16px | Card 内部 |
| `layout.header.height` | 64px | 顶部导航 |
| `layout.bottom-bar.height` | 76px | 底部录音区 |
| `layout.chart.min-height` | 300px | 主图表最小高度 |
| `layout.touch-target` | 44px | 最小触控区域 |

---

# 9. Component / 组件 Token

## Header

```text
Height: 64px
Horizontal Padding: 16px
Touch Target: 44×44px
```

推荐：

```text
[Logo] 在线声音训练                         [...]
```

移动端只保留最高频操作，导入、回放、清空、配置、帮助等放入更多菜单。

---

## Training Target Card

```text
Padding: 16px
Radius: 16px
Gap: 12px
```

推荐结构：

```text
训练目标                         >

┌──────────┐
│    a     │
└──────────┘

F0   200 — 280 Hz
F1   800 — 1000 Hz
F2   1100 — 1400 Hz
```

F0 / F1 / F2 左侧使用对应语义色条。

---

## Realtime Feedback

主 F0：

```text
28px / 700
```

辅助 F1 / F2：

```text
15px / 500
```

达标状态：

```text
● 目标范围内
```

偏差状态：

```text
↑ 偏高
↓ 偏低
```

---

## Chart Tab

```text
Height: 44px
Active Indicator: 2–3px
```

结构：

```text
┌───────────────────────┐
│  基频       共振峰     │
│  ━━━                  │
└───────────────────────┘
```

移动端不建议把两个大型图表强行压缩在一起。

---

## Primary Record Button

```text
Visual Size: 56–64px
Touch Area: ≥64px
Radius: 999px
Color: #E94262
```

状态：

```text
Idle
● 开始录音

Recording
● 正在录音
00:04
```

---

## Bottom Record Bar

```text
Height: 76px + Safe Area
Shadow: shadow.floating
Background: #FFFFFF
```

推荐：

```text
┌────────────────────────────┐
│  a 当前目标      [ 🎙 ]     │
│                    开始录音 │
└────────────────────────────┘
```

底部录音栏应固定，并考虑：

```css
padding-bottom: env(safe-area-inset-bottom);
```

---

# 10. Interaction / 交互状态

| 状态 | 规则 |
|---|---|
| Default | 白色背景 + 默认边框 |
| Pressed | 品牌色加深，阴影降低 |
| Focus | 使用明显 focus ring |
| Success | 绿色 + ✓ + 状态文字 |
| Warning | 橙色 + ↑/↓ + 状态文字 |
| Error | 红色 + 明确错误说明 |
| Disabled | `#9AA9BA` + `#F1F4F7` |

Pressed：

```css
transform: scale(.98);
```

---

# 11. Responsive / 响应式规则

## ≤ 359px

- 页面 Padding：12–16px
- 目标参数可以纵向堆叠
- 减少图表非关键刻度
- 保证主要数字和当前曲线可读

## 360–430px

以 390px 设计稿为主要基准：

```text
Page Padding: 16px
Card Gap: 12px
Card Padding: 16px
```

组件宽度使用 fluid layout。

## 431–767px

仍保持单列结构：

```text
Card Padding: 20px
Chart Height: 320–360px
```

## ≥ 768px

切换到独立的 Tablet / Desktop 信息架构。

> **不要简单拉伸 Mobile Layout。**

---

# 12. CSS Variables

```css
:root {
  /* Typography */
  --font-family-primary:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    sans-serif;

  /* Brand */
  --color-brand-primary: #E94262;
  --color-brand-primary-hover: #D93655;
  --color-brand-primary-soft: #FFF0F3;

  /* Text */
  --color-text-primary: #18304A;
  --color-text-secondary: #6F8197;
  --color-text-tertiary: #9AA9BA;

  /* Surface */
  --color-surface-page: #F7F9FC;
  --color-surface-card: #FFFFFF;

  /* Border */
  --color-border-default: #E4EAF0;
  --color-border-subtle: #EDF1F5;
  --color-border-strong: #D4DDE7;

  /* Semantic */
  --color-success: #12A981;
  --color-warning: #F5A623;
  --color-error: #E65368;
  --color-info: #4387F5;

  /* Chart */
  --color-f0: #13B98B;
  --color-f1: #E84C68;
  --color-f2: #4387F5;
  --color-chart-grid: #EDF1F5;
  --color-chart-axis: #B8C4D1;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  /* Shadow */
  --shadow-card:
    0 2px 10px rgba(24, 48, 74, .06);

  --shadow-floating:
    0 12px 32px rgba(24, 48, 74, .12);

  /* Layout */
  --mobile-page-padding: 16px;
  --touch-target: 44px;
  --header-height: 64px;
  --bottom-bar-height: 76px;
}
```

---

# 13. 推荐移动端页面结构

```text
┌──────────────────────────────┐
│ Header                       │
├──────────────────────────────┤
│                              │
│ 训练目标                     │
│ ┌──────────────────────────┐ │
│ │ a                        │ │
│ │ F0  200 — 280 Hz         │ │
│ │ F1  800 — 1000 Hz        │ │
│ │ F2  1100 — 1400 Hz       │ │
│ └──────────────────────────┘ │
│                              │
│ 实时反馈                     │
│ ┌──────────────────────────┐ │
│ │       F0 245 Hz          │ │
│ │   ✓ 目标范围内            │ │
│ │ F1 920      F2 1250      │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 基频       共振峰         │ │
│ ├──────────────────────────┤ │
│ │                          │ │
│ │          Chart           │ │
│ │                          │ │
│ └──────────────────────────┘ │
│                              │
├──────────────────────────────┤
│ a 当前目标      🎙 开始录音  │
└──────────────────────────────┘
```

---

# 14. 设计系统核心决策

| 项目 | 决策 |
|---|---|
| Mobile 基准 | 390 × 844 |
| 页面布局 | 单列 |
| 页面边距 | 16px |
| Card 间距 | 12px |
| Card 圆角 | 16px |
| 主品牌色 | `#E94262` |
| 主文字 | `#18304A` |
| F0 | `#13B98B` |
| F1 | `#E84C68` |
| F2 | `#4387F5` |
| 主 F0 数字 | 28px / 700 |
| 普通正文 | 15px |
| 辅助文字 | 12px |
| 最小触控区域 | 44px |
| 录音按钮 | 56–64px |
| 图表最小高度 | 300px |
| 底部录音栏 | 固定 + Safe Area |
| PC / Mobile | 共享视觉 Token，独立布局 |

---

## 15. 版本信息

**Design System:** Online Voice Training  
**Platform:** Mobile Web  
**Viewport:** 390 × 844  
**Version:** v1.0  
**Status:** UI Reference / Design Token Baseline