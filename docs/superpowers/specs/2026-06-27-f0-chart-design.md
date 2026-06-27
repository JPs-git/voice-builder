# F0 基频图设计

## 1. 目标

将当前功率谱（语谱图，`PowerSpectrumRenderer`）替换为 F0 基频折线图，使用 ECharts 实现，Y 轴 0-500Hz，仅展示 F0 变化。

## 2. 视觉设计

### 2.1 折线

- F0 线: `#1F2937`，线宽 2（与共振峰谱中 F0 线一致）
- `connectNulls: false` — 静音/清音段断开
- `showSymbol: false` — 不显示数据点标记

### 2.2 目标带 (markArea)

两个固定目标区域，ECharts `markArea` 实现（半透明背景）：

| 区域 | 范围 | 颜色 | 说明 |
|------|------|------|------|
| 男声目标带 | 80–150 Hz | `#5BCEFA` (浅蓝, 不透明度 ~0.15) | 典型男性基频范围 |
| 女声目标带 | 180–300 Hz | `#F5A9B8` (浅粉, 不透明度 ~0.15) | 典型女性基频范围 |

间隙 150–180 Hz 保持无底色（中性区）。

### 2.3 Y 轴

- `min: 0, max: 500`
- `axisLabel`: `{v} Hz` 格式
- 样式同共振峰谱 (`color: '#667085'`, `fontSize: 11`)

### 2.4 X 轴

- 同共振峰谱：时间轴，`axisLabel: { show: false }`
- 实时模式：滚动 10s 窗口
- 批处理模式：全量数据

### 2.5 Cursor (播放光标)

同 `FormantChartRenderer`，使用 ECharts `graphic` 组件绘制垂直红线 (`#E23E57`)。

### 2.6 Tooltip

- `trigger: 'axis'`, `axisPointer: { type: 'cross' }`
- 显示时间和 F0 值

### 2.7 空状态

"开始录音或导入 WAV 文件"（同现有模式）

## 3. 布局与 HTML 改动

`index.html`: "声音频谱" 卡片改为 "基频" 卡片：

```html
<section class="card">
  <div class="chart-wrapper">
    <div class="chart-header">
      <span>基频</span>
    </div>
    <div class="chart-area">
      <div id="f0Chart"></div>
      <div class="empty-state" id="f0Empty">
        <p>开始录音或导入 WAV 文件</p>
      </div>
    </div>
  </div>
</section>
```

## 4. 新建文件: `js/f0-chart.js`

类 `F0ChartRenderer`，与 `FormantChartRenderer` 结构对齐。

### 4.1 构造函数

```javascript
constructor(container, targetRanges)
```

- `container`: DOM 元素 (`#f0Chart`)
- `targetRanges`: `[{ label: '男声', range: [80, 150], color: '#5BCEFA' }, { label: '女声', range: [180, 300], color: '#F5A9B8' }]`

### 4.2 ECharts Option 核心

```javascript
{
  animation: false,
  backgroundColor: 'transparent',
  grid: { left: 72, right: 32, top: 20, bottom: 36 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross', label: { backgroundColor: '#475467' } },
    formatter: (params) => { /* 显示时间 + F0 值 */ }
  },
  xAxis: {
    type: 'value',
    min: minTime, max: maxTime,
    axisLine: { lineStyle: { color: '#D0D5DD' } },
    axisLabel: { show: false },
    splitLine: { lineStyle: { color: '#F2F4F7' } },
  },
  yAxis: {
    type: 'value',
    min: 0, max: 500,
    axisLine: { lineStyle: { color: '#D0D5DD' } },
    axisLabel: { color: '#667085', fontSize: 11, formatter: (v) => `${v} Hz` },
    splitLine: { lineStyle: { color: '#F2F4F7' } },
  },
  color: ['#1F2937'],
  series: [{
    name: 'F0',
    type: 'line',
    showSymbol: false,
    connectNulls: false,
    lineStyle: { color: '#1F2937', width: 2 },
    itemStyle: { color: '#1F2937' },
    markArea: { silent: true, data: [ /* 2 个目标区域 */ ] },
    data: [],  // [[time, f0], ...]
  }]
}
```

### 4.3 公开方法

| 方法 | 参数 | 行为 |
|------|------|------|
| `pushFrame(frame)` | `{ f0, time, voiced }` | 追加到数据数组，触发渲染 |
| `displayAll(frames)` | `[{ f0, time }]` | 替换数据，全量渲染 |
| `setCursor(time)` | number (秒) | 更新播放光标位置 |
| `resize()` | — | 响应容器尺寸变化 |
| `reset()` | — | 清空数据和光标 |
| `destroy()` | — | 释放 ECharts 实例 |

### 4.4 数据流

```
frame-processor → analysis-pipeline → smoother → main.js
                                                    ↓
                                           f0-chart.js (F0 单线)
                                           formant-chart.js (F0+F1+F2)
```

两图接收相同 F0 数据，仅显示范围不同。

## 5. 修改文件: `js/main.js`

| 改动 | 说明 |
|------|------|
| Import `F0ChartRenderer` | 替代 `PowerSpectrumRenderer` |
| 实例化 `f0Chart` | `new F0ChartRenderer(document.getElementById('f0Chart'))` |
| 实时分支追加 `f0Chart.pushFrame(frame)` | 跟在 `formantChart.pushFrame` 旁 |
| 批处理分支追加 `f0Chart.displayAll(frames)` | 跟在 `formantChart.displayAll` 旁 |
| 播放光标追加 `f0Chart.setCursor(time)` | 跟在 `formantChart.setCursor` 旁 |
| resize 追加 `f0Chart.resize()` | 跟在 `formantChart.resize` 旁 |
| 移除 `PowerSpectrumRenderer` 导入和实例化 | — |

## 6. 保留文件

`js/spectrogram.js` 保留不动，仅 `main.js` 不再引用。

## 7. 不做的事

- 不改动共振峰谱 (`formant-chart.js`)
- 不改动数据管道 (`analysis-pipeline.js`, `lpc.js`, `formant-smoother.js`)
- 不改动样式 (复用现有 chart card 样式)
- 不添加图例 (只有单条线)
