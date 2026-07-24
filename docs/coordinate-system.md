# 时间坐标系说明

## 两个时间范围

### 1. 数据时间范围 (Data Time Range)
- 变量: `dataTStart` / `dataTEnd`
- 含义: `_data` / `_frames` 中实际帧的 `time` 最小值和最大值
- 即录音或导入的音频实际覆盖的时间段
- 例如: 录制 5s → `[0, 5]`

### 2. 图谱 x 轴范围 (Axis Time Range)
- 变量: `axisMin` / `axisMax`
- 含义: 图表 x 轴显示的时间区间
- 目前所有场景均使用 **Live 模式**: `[currentTime - WINDOW, currentTime]` — 10s 滑动窗口

> 注意: 图表始终以 Live 模式工作。WAV 导入后不会切换为 Batch 模式，
> 因此轴范围总是以最后一帧的时间为基准往前推 10s。

### 二者关系

| 场景 | 时长 | 数据范围 | 轴范围 | 备注 |
|------|------|----------|--------|------|
| 录制中 (≥10s) | 30s | [20, 30] | [20, 30] | 窗口与数据重合 |
| 录制中 (<10s) | 5s | [0, 5] | [-5, 5] | 轴比数据宽，数据靠右 |
| WAV 导入 (≤10s) | 5s | [0, 5] | [-5, 5] | 与录制 <10s 一致 |
| WAV 导入 | ≥10s | — | — | 提示用户不超过 10s，不执行导入 |

## 游标定位

**规则**: 游标位置按 **轴范围** 计算，确保与曲线/热图对齐。

```
ratio = (cursorTime - axisMin) / (axisMax - axisMin)
cx    = plotRect.x + ratio * plotRect.width
```

不要用 `dataTStart`/`dataTEnd`：当录音时长 < WINDOW 时，数据范围 < 轴范围，
若按数据范围定位，游标会偏左（5s 录音 + [-5, 5] 轴 → 游标起点在 0% 而非 50%）。

## 相关代码

- `js/formant-chart.js` — `_renderCursor()` 第 258~304 行
- `js/spectrogram.js` — `_renderCursor()` 第 331~365 行
- `js/formant-chart.js` — `_render()` 第 97~192 行 (轴范围定义)
- `js/spectrogram.js` — `_renderWindow()` 第 217~263 行 (轴范围定义)
