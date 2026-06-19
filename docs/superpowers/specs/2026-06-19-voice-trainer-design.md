# 伪声训练软件 — 设计文档

## 概述

基于 Web 的实时伪声训练工具。用户对麦克风说话，页面实时显示声谱图和共振峰图谱。MVP 对标 Praat 的核心语音分析功能，定位为自学练习者的实时反馈工具。

## 目标用户

有一定基础的伪声练习者，需要实时查看自己的声音特征参数（F0–F4）来进行针对性调整。

## 界面布局

上下分离视图：

- **上方面板** — 声谱图（Spectrogram），横轴时间，纵轴频率 0–5000Hz，颜色深度表示能量
- **下方面板** — 共振峰图（Formant Chart），横轴时间（与上方同步），纵轴 0–5000Hz
- **左侧数值** — 实时显示当前帧的 F0–F4 数值（`F1: 850Hz` 格式）

共振峰配色：
- F0：白色虚线
- F1：红色实线
- F2：蓝色实线
- F3：绿色实线
- F4：橙色实线

## 核心交互

- 页面加载后自动开始录音，持续采集麦克风音频
- 图谱实时滚动更新
- 无录制状态指示（静默工作）
- 点击暂停 → 图谱冻结，可点击任意位置查看该时刻的 F0–F4 数值
- 最多回看 1 分钟窗口（环形缓冲区）

## 技术栈

| 层 | 选型 |
|---|------|
| 框架 | 无（Vanilla JS） |
| 音频采集 | Web Audio API (`getUserMedia` + `AudioContext`) |
| 共振峰提取 | `formantanalyzer.js` (npm) |
| FFT/声谱图 | `AnalyserNode` (浏览器原生) |
| 渲染 | Canvas 2D |
| 播放回看 | `AudioBufferSourceNode` 同步驱动图谱 |

## 架构

```
Microphone → getUserMedia → AudioContext
                │
     ┌──────────┴──────────┐
     ▼                      ▼
AnalyserNode       formantanalyzer.js
(FFT data)         (LPC formant extraction)
     │                      │
     ▼                      ▼
Spectrogram         FormantChart
Renderer            Renderer
(Canvas top)        (Canvas bottom)
     │                      │
     └──── sync scroll ─────┘
```

### 三个核心模块

**AudioEngine**
- 管理麦克风、AudioContext、环形缓冲区（1min）
- fftSize=1024 时帧间隔约 23ms（@44100Hz），通过 `requestAnimationFrame` 批量消费

**SpectrogramRenderer**
- Canvas 2D，固定宽度，高度对应 0–5000Hz
- 使用 `drawImage` 左移 + 右侧绘制新列
- 颜色映射：dB → 256 级 LUT（深蓝→青→黄→红）
- 配置：fftSize=1024，时间窗口 3 秒视窗，动态范围 80dB

**FormantChartRenderer**
- Canvas 2D，与声谱图时间轴同步
- F0–F4 用带颜色的折线图绘制
- 清音段值跳过（连线断裂）
- 暂停模式下支持点击查询任意时刻 F0–F4 数值

### 数据格式

```typescript
interface SpectrumFrame {
  time: number
  magnitudes: Float32Array  // fftSize/2
}

interface FormantFrame {
  time: number
  f0: number | null
  f1: number | null
  f2: number | null
  f3: number | null
  f4: number | null
}
```

## 非功能性需求

- 纯客户端运行，无服务端依赖
- 所有处理在浏览器内完成，隐私安全
- 零外部依赖，断网仍可工作（页面已加载后）

## 未来可扩展方向

- WASM 后端替换（如 praatfan）提升共振峰精度
- 录音导出 + 历史记录
- 目标共振峰覆盖参考线（目标 F2 应达到多少 Hz）
- 实时评分反馈
