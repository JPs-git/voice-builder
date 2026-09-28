# 在线声音训练 · 移动端 UI 规范

> 版本：v1.0  
> 设计基准：390 × 844 px  
> 适用端：移动端 Web / H5 / App WebView  
> 设计依据：本次提供的 390×844 UI 设计稿

---

## 1. 页面设计原则

### 1.1 核心目标

本页面的核心任务是**实时观察两个语音分析图表**：

1. **基频 F0**
2. **共振峰 F1 / F2**

因此布局必须满足：

- 390 × 844 px 视口内，两个图表**同时完整可见**
- 页面默认状态**不需要纵向滚动**
- 图表区域占据页面主要视觉空间
- 「训练目标」和「实时反馈」仅作为辅助信息，降低高度和视觉权重
- **取消基频 / 共振峰切换 Tab**
- 底部录音操作栏固定在视口底部
- 保持现有轻量、柔和、医疗/工具型视觉风格

---

# 2. 页面整体尺寸

## 2.1 Viewport

| 属性 | 数值 |
|---|---:|
| 设计宽度 | 390 px |
| 设计高度 | 844 px |
| 页面背景 | `#F7FAFD` |
| 左右页面内边距 | 16 px |
| 内容最大宽度 | 358 px |
| 页面滚动 | 默认不滚动 |
| 底部操作栏 | Fixed |

### 内容宽度计算

```text
390 - 16 × 2 = 358 px
```

所有主要卡片统一使用：

```css
width: calc(100% - 32px);
margin-inline: 16px;
```

---

# 3. Safe Area

针对带 Home Indicator 的 iPhone：

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

底部录音栏必须覆盖：

```css
bottom: 0;
padding-bottom: max(12px, env(safe-area-inset-bottom));
```

设计稿中的底部 Home Indicator 不属于业务组件。

---

# 4. 页面纵向结构

推荐采用以下固定结构：

```text
┌─────────────────────────────┐
│ Status Bar / Safe Area      │  ~44
├─────────────────────────────┤
│ Header                      │  ~72
├─────────────────────────────┤
│ Training Target             │  ~70
├─────────────────────────────┤
│ Realtime Feedback            │  ~58
├─────────────────────────────┤
│                             │
│ F0 Chart                    │  ~278
│                             │
├─────────────────────────────┤
│                             │
│ Formant Chart               │  ~278
│                             │
├─────────────────────────────┤
│ Fixed Record Bar            │  ~76
└─────────────────────────────┘
```

> 实际实现时应以 `100dvh` 计算可用高度，图表区域使用 `flex: 1` 平分剩余空间，避免在不同 iPhone 高度上出现溢出。

---

# 5. Header

## 5.1 尺寸

| 属性 | 数值 |
|---|---:|
| 高度 | 72 px |
| 左右 padding | 16 px |
| Logo 区域 | 48 × 48 px |
| 标题字号 | 24 px |
| 标题字重 | 700 |
| 更多按钮 | 48 × 48 px |
| 更多按钮圆角 | 16 px |

### 布局

```text
16px
 ↓
[ 声波 Logo 48 ]  在线声音训练             [•••]
                                              ↑
                                         48 × 48
```

使用：

```css
display: flex;
align-items: center;
justify-content: space-between;
```

### 标题

```css
font-size: 24px;
font-weight: 700;
line-height: 32px;
color: #142B45;
```

---

# 6. 训练目标 Card

## 6.1 定位

训练目标属于辅助信息，因此相比旧版明显压缩。

### 尺寸

```text
Width: 358px
Height: 70px
Radius: 16px
```

### 位置

```text
margin: 0 16px;
```

与 Header：

```text
~8px
```

### 卡片结构

```text
┌──────────────────────────────────────────┐
│ 🎯 训练目标                               │
│    a      F0 200—280Hz   F1 800—1000Hz  │
│           F2 1100—1400Hz                 │
└──────────────────────────────────────────┘
```

建议前端使用横向布局：

```css
display: flex;
align-items: center;
gap: 12px;
```

### 左侧目标选择

尺寸：

```text
104 × 40 px
```

样式：

```css
background: #FFF1F5;
border-radius: 12px;
```

文字：

```css
font-size: 22px;
font-weight: 700;
color: #E94763;
```

### F0/F1/F2 参数

每个参数使用紧凑胶囊：

```text
约 100~118 × 40 px
```

参数颜色：

- F0：`#12B886`
- F1：`#F04B6A`
- F2：`#3F83F8`

数字字号：

```css
font-size: 14px;
font-weight: 500;
```

---

# 7. 实时反馈 Card

## 7.1 定位

实时反馈只承担「当前状态 + 当前值」展示，不应与图表争夺视觉焦点。

### 尺寸

```text
Width: 358px
Height: 58px
Radius: 16px
```

### 布局

```text
[实时反馈] [目标范围内] | F0 245Hz | F1 920Hz | F2 1250Hz
```

建议：

```css
display: flex;
align-items: center;
```

### 状态 Badge

高度：

```text
32px
```

背景：

```css
background: #E9FAF5;
```

文字：

```css
font-size: 13px;
font-weight: 600;
color: #0FA77D;
```

### 数值

| 参数 | 颜色 |
|---|---|
| F0 | `#12B886` |
| F1 | `#F04B6A` |
| F2 | `#3F83F8` |

数值字号：

```css
font-size: 15px;
font-weight: 600;
```

---

# 8. 图表区域总原则

这是整个页面的**核心区域**。

必须：

- 删除「基频 / 共振峰」切换 Tab
- 两个图表直接上下排列
- 两个图表同时展示
- 两个图表高度尽可能接近
- 图表内部 Plot Area 尽可能扩大
- 图表标题、Legend 保持紧凑
- 不要在图表之间增加过大的 section spacing

推荐：

```css
.chart-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
```

两个 Chart：

```css
.chart-card {
  flex: 1;
  min-height: 0;
}
```

---

# 9. F0 基频图表

## 9.1 Card

```text
Width: 358px
Height: ~278px
Radius: 16px
```

背景：

```css
background: #FFFFFF;
```

### Card Padding

```text
Top: 14px
Left: 16px
Right: 16px
Bottom: 12px
```

---

## 9.2 Header

高度约：

```text
32px
```

左侧：

```text
[波形 Icon]  基频  F0
```

标题：

```css
font-size: 17px;
font-weight: 700;
color: #142B45;
```

F0：

```css
font-size: 16px;
font-weight: 700;
color: #12B886;
```

---

## 9.3 Legend

右侧：

```text
━━ 当前值   ▰ 目标区间   - - 目标线
```

字号：

```css
font-size: 12px;
color: #8192A8;
```

Legend 与标题在同一行。

---

## 9.4 Plot Area

推荐：

```text
Left axis width: ~48px
Right padding: ~8px
Top: ~48px
Bottom: ~28px
```

在 390×844 设计稿中，Plot Area 应尽可能占满 Chart Card。

### Y Axis

范围：

```text
0 ~ 500 Hz
```

主要刻度：

```text
0
100
200
300
400
500
```

字号：

```css
font-size: 12px;
color: #7E91AA;
```

### X Axis

范围：

```text
0s ~ 30s
```

刻度：

```text
0s
5s
10s
15s
20s
25s
30s
```

---

# 10. F0 目标区域

### 男声目标区

示意范围：

```text
约 180 ~ 250 Hz
```

颜色：

```css
background: rgba(63, 131, 248, 0.08);
```

目标线：

```css
border-top: 1px dashed #8BB9FF;
```

### 女声参考区

示意范围：

```text
约 280 ~ 350 Hz
```

颜色：

```css
background: rgba(233, 71, 99, 0.08);
```

目标线：

```css
border-top: 1px dashed #F4A0B1;
```

> 以上区间用于复现当前设计稿视觉表现；实际业务目标范围应由前端从训练配置动态读取。

---

# 11. F0 实时曲线

当前值曲线：

```text
颜色：#3F83F8
线宽：2px
```

数据点：

- 默认隐藏普通数据点
- 当前最新点显示圆形高亮
- 高亮点外增加淡蓝色 Halo

当前值示例：

```text
245 Hz
```

---

# 12. 共振峰图表

## 12.1 Card

```text
Width: 358px
Height: ~278px
Radius: 16px
```

与 F0 Chart 保持一致。

---

## 12.2 Header

```text
[共振峰 Icon]  共振峰                  [F0] [F1] [F2]
```

标题：

```css
font-size: 17px;
font-weight: 700;
color: #142B45;
```

---

# 13. 共振峰 Legend

使用三个独立状态：

| 参数 | 颜色 |
|---|---|
| F0 | `#12B886` |
| F1 | `#F04B6A` |
| F2 | `#3F83F8` |

Legend 胶囊：

```text
约 48 × 30 px
border-radius: 15px
```

字号：

```css
font-size: 12px;
```

---

# 14. 共振峰 Plot

### Y Axis

范围：

```text
0 ~ 3500 Hz
```

主要刻度：

```text
0
1000
2000
3000
3500
```

### X Axis

与 F0 相同：

```text
0s ~ 30s
```

---

# 15. 共振峰目标线

### F0

颜色：

```css
#12B886
```

目标线：

```css
1px dashed
```

### F1

颜色：

```css
#F04B6A
```

目标线：

```css
1px dashed
```

### F2

颜色：

```css
#3F83F8
```

目标区域：

```css
background: rgba(245, 158, 11, 0.08);
```

目标线：

```css
1px dashed #F4B84A;
```

---

# 16. 图表 Grid

统一使用极淡网格：

```css
color: #EDF2F7;
```

线宽：

```text
1px
```

纵向 / 横向 Grid 都使用相同视觉重量。

不要使用深色坐标轴。

---

# 17. 底部固定录音栏

这是唯一需要保持高视觉权重的操作组件。

## 17.1 尺寸

```text
Width: 390px
Height: ~76px + Safe Area
Position: fixed
left: 0
right: 0
bottom: 0
```

背景：

```css
background: rgba(255,255,255,.96);
```

顶部圆角：

```css
border-radius: 38px 38px 0 0;
```

建议增加轻微阴影：

```css
box-shadow: 0 -4px 20px rgba(44, 75, 105, .06);
```

---

# 18. 录音按钮

中心按钮：

```text
64 × 64 px
```

外圈：

```text
76 × 76 px
```

圆形：

```css
border-radius: 50%;
```

主色：

```css
#E94763
```

外圈使用低透明度品牌色：

```css
background: #FFE4EA;
```

麦克风 Icon：

```text
约 28 × 28 px
```

颜色：

```text
#FFFFFF
```

---

# 19. 底部目标入口

左侧：

```text
约 112 × 44 px
```

内容：

```text
[a] 当前目标 >
```

背景：

```css
#F8FAFD
```

a 标签：

```css
background: #FFF0F4;
color: #E94763;
font-size: 20px;
font-weight: 700;
```

---

# 20. 开始录音文字

右侧：

```text
点击开始录音
```

字号：

```css
font-size: 15px;
font-weight: 500;
color: #8192A8;
```

录音按钮与文字保持水平居中。

---

# 21. 全局颜色 Tokens

```css
:root {
  --bg-page: #F7FAFD;
  --surface: #FFFFFF;

  --text-primary: #142B45;
  --text-secondary: #8192A8;
  --text-tertiary: #A5B2C2;

  --border: #E8EEF5;
  --grid: #EDF2F7;

  --brand: #E94763;
  --brand-soft: #FFF0F4;

  --f0: #12B886;
  --f0-soft: #E9FAF5;

  --f1: #F04B6A;
  --f1-soft: #FFF0F3;

  --f2: #3F83F8;
  --f2-soft: #EDF4FF;

  --warning: #F59E0B;
  --warning-soft: #FFF7E8;
}
```

---

# 22. Typography Tokens

推荐字体：

```css
font-family:
  "Noto Sans SC",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

| Token | 字号 | 字重 | 用途 |
|---|---:|---:|---|
| `display` | 24px | 700 | 页面标题 |
| `h2` | 17px | 700 | Card 标题 |
| `body` | 15px | 400/500 | 正文 |
| `body-sm` | 13px | 500 | 状态/辅助信息 |
| `caption` | 12px | 400 | 图例/坐标 |
| `metric` | 15px | 600 | F0/F1/F2 数值 |
| `target` | 22px | 700 | 元音目标 |

---

# 23. 圆角 Tokens

```css
--radius-card: 16px;
--radius-button: 12px;
--radius-pill: 999px;
--radius-record: 38px;
```

---

# 24. 间距 Tokens

```css
--space-4: 4px;
--space-8: 8px;
--space-12: 12px;
--space-16: 16px;
--space-20: 20px;
--space-24: 24px;
```

主要使用：

```text
页面左右：16px
Card 间距：8~10px
Card 内边距：16px
Header 与首 Card：8px
```

---

# 25. 响应式布局

虽然设计基准为 390×844，但不能写死所有高度。

推荐：

```css
.page {
  width: 100%;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}

.content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

图表区域：

```css
.chart-stack {
  flex: 1;
  min-height: 0;
}

.chart-card {
  flex: 1;
  min-height: 0;
}
```

### 目标

在常见移动设备上：

```text
训练目标 + 实时反馈 = 尽可能压缩
两个 Chart = 平分剩余空间
```

而不是：

```text
固定 Chart 高度 + 页面滚动
```

---

# 26. 小屏设备处理

当可用高度低于 800px：

优先压缩：

1. Header
2. Training Target
3. Realtime Feedback
4. Chart Card Header / Legend

不要优先压缩：

1. Plot Area
2. X/Y Axis
3. 录音按钮

建议：

```css
@media (max-height: 800px) {
  .header {
    height: 64px;
  }

  .training-target {
    height: 60px;
  }

  .realtime-feedback {
    height: 52px;
  }

  .chart-stack {
    gap: 8px;
  }
}
```

---

# 27. 禁止事项

### 不要恢复图表 Tab

禁止：

```text
[ 基频 ] [ 共振峰 ]
```

两个图表始终同时显示。

### 不要让训练目标占据大面积

不要恢复旧版：

```text
170px+ Training Target
```

### 不要让实时反馈成为大卡片

不要恢复：

```text
150px+ Realtime Feedback
```

### 不要出现默认页面滚动

首屏必须能够看到：

```text
Header
↓
Training Target
↓
Realtime Feedback
↓
F0 Chart
↓
Formant Chart
↓
Record Bar
```

---

# 28. 推荐 DOM / Component 结构

```text
VoiceTrainingPage
├── Header
│   ├── BrandLogo
│   ├── BrandTitle
│   └── MoreButton
│
├── CompactTrainingTarget
│   ├── TargetIcon
│   ├── VowelSelector
│   ├── F0Range
│   ├── F1Range
│   └── F2Range
│
├── CompactRealtimeFeedback
│   ├── Status
│   ├── F0Value
│   ├── F1Value
│   └── F2Value
│
├── ChartStack
│   ├── F0ChartCard
│   │   ├── ChartHeader
│   │   ├── ChartLegend
│   │   └── F0Plot
│   │
│   └── FormantChartCard
│       ├── ChartHeader
│       ├── FormantLegend
│       └── FormantPlot
│
└── FixedRecordBar
    ├── CurrentTarget
    ├── RecordButton
    └── RecordHint
```

---

# 29. 前端实现优先级

## P0 — 必须满足

- [ ] 390×844 下两个图表同时可见
- [ ] 页面默认无纵向滚动
- [ ] 删除图表切换 Tab
- [ ] F0 与共振峰高度尽可能大
- [ ] 底部录音按钮固定
- [ ] 保持现有颜色和卡片风格

## P1 — 视觉一致性

- [ ] 卡片统一 16px 圆角
- [ ] 页面左右 16px
- [ ] 图表网格使用极浅灰
- [ ] F0/F1/F2 使用统一颜色体系
- [ ] 训练目标 / 实时反馈使用紧凑布局

## P2 — 交互

- [ ] 元音目标可切换
- [ ] 开始录音按钮支持 Recording 状态
- [ ] 实时数据更新曲线
- [ ] 当前数据点高亮
- [ ] 目标范围动态更新

---

# 30. 最终布局示意

```text
390px
┌──────────────────────────────────┐
│             Safe Area            │
│                                  │
│  Logo  在线声音训练          ••• │
│                                  │
├──────────────────────────────────┤
│  🎯 训练目标                      │  ~70
│  a    F0 200—280  F1 800—1000   │
│       F2 1100—1400               │
├──────────────────────────────────┤
│  ▂▅ 实时反馈   ●目标范围内       │  ~58
│       F0 245   F1 920   F2 1250 │
├──────────────────────────────────┤
│                                  │
│  ▂▅ 基频 F0        图例          │
│                                  │
│       F0 Chart Plot              │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
│  ▂▅ 共振峰          F0 F1 F2     │
│                                  │
│       Formant Plot               │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
│       [ 🎙 ]  点击开始录音       │
│                                  │
└──────────────────────────────────┘
```

**核心原则：让图表成为页面主体，而不是让图表成为「训练目标 / 实时反馈」下面的附属内容。**
