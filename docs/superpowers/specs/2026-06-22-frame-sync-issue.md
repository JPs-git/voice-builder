# 帧同步问题记录 (2026-06-22)

## 问题

频谱图和共振峰图滚动速度不同步。此问题在历次渲染实现变更中反复出现。

## 最终结论

**帧窗口必须基于时间而非像素。** 任何基于像素对齐的方案都无法在不同 DPR、不同 canvas 尺寸、不同图表库的绘图区宽度差异下保持同步。

## 错误尝试：像素对齐方案

### 思路

两个图表保留相同数量的帧，帧数 = `canvasWidth × DPR`，新帧到达时同时 push/shift。

### 失败原因

| 因素 | 频谱图 | 共振峰图 (ECharts) |
|------|--------|-------------------|
| 有效绘图宽度 | `canvasWidth` (满宽) | `chartWidth - gridLeft - gridRight` |
| DPR 处理 | 手动计算 `canvas.width = CSS × DPR` | ECharts 内部自动处理 DPR |
| 帧/像素比 | 1 帧 = 1 设备像素 | 因绘图区更窄 + ECharts 内部 DPR，无法精确对齐 |

即使帧数相同，每帧对应的像素位移也不同 → 视觉上永远无法对齐。

### 尝试记录

1. 首次修复：`_windowSeconds = 3` → 帧数差距大 → 失败
2. 第二次修复：`maxFrames = chartWidth × DPR` → 绘图区宽度忽略 grid margin → 失败
3. 第三次修复：`maxFrames = (chartWidth - margin) × DPR` → ECharts 内部 DPR 与 canvas DPR 不一致 → 仍偏差

**教训：只要两个图表使用不同的渲染引擎（Canvas 2D vs ECharts），像素级对齐就不可能精确。**

## 最终方案：时间窗口统一

### 架构

```
AnalysisPipeline (100fps, 10ms hop)
  └→ onFrame({ f0..f4, magnitudes, time: frameCount×0.01 })
       ├→ Spectrogram.pushFrame(magnitudes, time)
       │    缓存帧，移除 >10s 旧帧，RAF 限流全量重绘
       │    _renderWindow: 每列时间 = currentTime - 10 + (x/w) × 10
       │                    找最近帧 → 映射到该列
       │
       └→ FormantChart.pushFrame(frame, time)
            缓存帧，移除 >10s 旧帧，RAF 限流更新
            ECharts xAxis type: 'value'
            xAxis range: [time-10, time]
            数据格式: [time, value] 对
```

### 参数

| 参数 | 值 |
|------|-----|
| 帧大小 | 25ms (400 samples @16000Hz) |
| 帧移 | 10ms (160 samples @16000Hz) |
| 帧率 | 100fps |
| 时间窗口 | 固定 10 秒 |
| 窗口内帧数 | 1000 ±1 帧 |

### 帧定位公式

两个图表使用相同的时间→像素映射：

```
pixelX = canvasWidth × (frameTime - windowStart) / windowDuration
其中 windowStart = currentTime - 10, windowDuration = 10
```

### 为什么这回有效

1. **统一基准**：两个图表用同一个 `time` 值定位帧，与宽度/DPR/绘图区完全解耦
2. **自适应 canvas**：canvas 尺寸变化后重绘时，每个帧按新宽度重新计算位置
3. **精确同步**：100fps 帧率下，0.01s 时间步长映射到像素位置始终一致

### 实现要点

#### 频谱图 (`spectrogram.js`)

```js
pushFrame(magnitudes, time):
  this._frames.push({ magnitudes, time })
  // 移除 >10s 的旧帧
  while (this._frames[0].time < time - 10) this._frames.shift()
  // RAF 限流
  if (!this._throttled) requestAnimationFrame(() => this._renderWindow())

_renderWindow():
  // 全量重绘，类似 displayAll 但基于滑动窗口
  for (x = 0; x < canvasWidth; x++):
    colTime = currentTime - 10 + (x / canvasWidth) × 10
    找 colTime 最近帧 → 映射 magnitudes → 绘制该列
```

#### 共振峰图 (`formant-chart.js`)

```js
pushFrame(frame, time):
  this._data.push({ ...frame, time })
  // 移除 >10s 的旧帧
  while (this._data[0].time < time - 10) this._data.shift()
  // RAF 限流更新
  if (!this._throttled) requestAnimationFrame(() => this._updateChart())

_updateChart():
  series = this._data.map(f => [f.time, f.f0 ?? null])
  chart.setOption({
    xAxis: { min: time-10, max: time },
    series: [{ data: series }, ...]
  })
```

## 批处理模式 (WAV 上传)

```js
displayAll(frames):
  // 全量数据一次性渲染，无滚动
  series = frames.map(f => [f.time, f.f0])
  chart.setOption({
    xAxis: { min: 0, max: frames[last].time },
    series: [{ data: series }]
  })
```

批处理模式不存在帧同步问题。

## 后续设计约束

- 两个图表必须共享同一帧来源（`onFrame` 回调），不能独立接收数据
- 任何新增的实时图表必须使用相同的时间窗口和定位公式
- 不要尝试像素级对齐不同渲染引擎的图表
- RAF 限流频率应一致（目前两者都限制到 ~30fps）
- 帧的 `time` 字段由 `AnalysisPipeline` 统一生成，下游不修改

## 后续调整记录 (2026-06-24)

### Bug 1: 暂停时坐标归零

**问题：** RECORDING→PAUSED 时共振峰图 xAxis 被重置为 `[0, lastTime]`，0 点出现在最左端，视觉跳跃。

**原因：** 对两个图表都调用了 `displayAll(sessionFrames)`，共振峰图的 `_render()` 在 `_batchMode=true` 下使用全量数据范围 `[data[0].time, data[last].time]`，而非保留录音时的 10s 窗口 `[currentTime-10, currentTime]`。

**修复：** RECORDING→PAUSED 时仅让语谱图切到全量视图 (`spectrum.displayAll`)，共振峰图保留 10s 窗口（不调用 `formantChart.displayAll`）。

```js
// 正确做法
spectrum.displayAll(sessionFrames)   // 语谱图切到全量
// 共振峰图不调用 displayAll，保持 10s 窗口
```

**教训：** 暂停不等于归零。录音过程中建立的 10s 时间窗口对共振峰图用户而言是自然的观察范围，强行展开到全量反而让用户丢失观察上下文。语谱图和共振峰图在 PAUSED 状态下可以有不同的视图策略——语谱图需要全量静态图像以便观察完整频谱，共振峰图保留 10s 窗口更适合实时趋势观察。
