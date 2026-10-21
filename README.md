# Voice Builder

面向伪音练习的在线声音训练工具：实时观察音高与共振峰、听取参考音，并通过录音报告了解一段话的常用音高范围。

<img alt="Voice Builder 标志" src="assets/logo-with-text.png" width="60%">

## Features

- **实时分析**：直观展示音高与共振峰变化，提供实时声音反馈。
- **训练目标**：选择元音预设或自定义目标区间，辅助发声练习。
- **音高参考**：通过钢琴键盘听取参考音，对照音高曲线练习。
- **统计分析**：通过朗读或自由说话生成报告，了解常用音高范围与分布。
- **录音与回放**：支持麦克风录音、音频导入和回放，方便反复对照。

## Screenshots

### 实时分析

<img alt="实时分析：元音目标区间、基频与共振峰曲线" src="assets/screen_shot.png" width="100%">

### 音高参考

<img alt="音高参考：钢琴键盘与音高曲线" src="assets/screen_shot_2.png" width="100%">

### 录音与统计报告

<img alt="统计分析录音页：参考短文、录音操作与计时" src="assets/recording.png" width="100%">
<img alt="录音分析报告：典型 F0、P10/P90、完整回放与音高分布" src="assets/recording-report.png" width="100%">

### 手机布局

<img alt="手机竖屏实时分析：反馈、曲线与底部录音操作" src="assets/analysis-mobile.png" width="320">

## Quick Start

克隆仓库并安装依赖：

```bash
git clone https://github.com/JPs-git/voice-builder.git
cd voice-builder
npm install
```

启动开发服务器：

```bash
npm run dev
```

打开终端显示的本地地址，即可录音或导入音频体验。

构建并预览：

```bash
npm run build
npm run preview
```

## Tech Stack

React · TypeScript · Vite · Zustand · ECharts · Web Audio API

## License

[MIT](https://choosealicense.com/licenses/mit/)
