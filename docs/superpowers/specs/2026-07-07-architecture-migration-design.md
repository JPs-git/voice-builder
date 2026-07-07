# VoiceBuilder 架构迁移方案

## 概述

将 VoiceBuilder 从 Vanilla JS + 全局状态模式迁移为 **TS + React** 现代前端架构，为多页面路由和更多可视化模式奠定基础，同时保持 DSP 算法层的独立性为后续 Rust+WASM 优化预留空间。

## 三阶段路线图

```
Phase 1 (0-2月)  TS + React 架构重构  ← 当前痛点：可维护性
     ↓
Phase 2 (2-3月)  多页面路由 + 新功能
     ↓
Phase 3 (3-5月)  Rust + WASM DSP 优化  ← 独立于 Phase 1/2
```

---

## Phase 1：TS + React 架构重构

### 核心策略：只重写 UI 层，不动算法层

| 模块 | 处理方式 |
|---|---|
| `main.js` (状态机 + DOM 操作) | 替换为 React 组件树 + React Router |
| `f0-chart.js` / `formant-chart.js` | 封装为 React 组件（内部 ECharts 逻辑不变） |
| `index.html` / `css/style.css` | 重写为 JSX + Tailwind/CSS Modules |
| `tip-widget.js` / `playback.js` | 改为 React 组件 |
| **所有 DSP 算法** (`lpc.js`, `cepstral.js`, `fft.js`, `complex.js`, `vad.js`, `resampler.js`, `frame-processor.js`, `analysis-pipeline.js`, `formant-smoother.js`, `wav-parser.js`) | **保持不变，只添加 TypeScript 类型声明** |
| `audio-engine.js` | 保持不动，或轻量封装为 hook |

### 组件树设计

```
<App>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AnalysisPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  </BrowserRouter>
</App>

<AnalysisPage>                     ← 现有主页面
  <Toolbar />                      ← 录音/导入/清空/配置按钮
  <TargetPresetBar />              ← 6 个元音预设 + F0/F1/F2 输入
  <F0Chart />                      ← ECharts 封装 (useRef + useEffect)
  <FormantChart />                 ← ECharts 封装 (useRef + useEffect)
  <StatusBar />                    ← 当前帧 F0-F4 数值
  <ConfigDrawer />                 ← 算法选择/平滑开关
  <HelpDrawer />
  <TipWidget />
</AnalysisPage>
```

### ECharts 集成模式（性能关键）

```tsx
function F0Chart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const dataRef = useRef<Frame[]>([]);  // React 不感知

  useEffect(() => {
    instanceRef.current = echarts.init(chartRef.current);
    const onResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      instanceRef.current?.dispose();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // 由父组件通过 ref 调用，不触发 React render
  const pushFrame = useCallback((frame: Frame) => {
    dataRef.current.push(frame);
    instanceRef.current!.setOption({ ... }, { notMerge: false });
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: '42vh' }} />;
}
```

**原则：** ECharts 实例在挂载时创建一次，永不销毁重建。帧数据直接通过 `setOption` 推入 ECharts 内部渲染循环，不经过 React reconciliation。这和当前 `f0-chart.js` 中 `chart.setOption()` 的调用方式完全一致，性能零损失。

### 状态管理

不用 Redux/Zustand，用 React Context + useReducer 分级：

```
<App>
  <AnalysisProvider>           ← 录音状态、帧数据、配置
    <PipelineProvider>         ← 分析管线实例、帧推送回调
      <Toolbar />
      <Charts />
    </PipelineProvider>
  </AnalysisProvider>
</App>
```

| Context | 内容 | 更新频率 |
|---|---|---|
| `AnalysisContext` | 录音状态、当前帧数值、配置选项 | 低（用户交互触发） |
| `PipelineContext` | 管线实例引用、`onFrame` 回调注册 | 一次（启动时） |

帧数据（`sessionFrames[]`）放在 `useRef` 中，不在 React 状态中。ECharts 组件通过 ref 直接读取。

### 文件结构（迁移后）

```
src/
├── main.tsx                       ← React 入口
├── App.tsx                        ← 路由 + 全局布局
├── routes/
│   └── AnalysisPage.tsx           ← 原 main.js 主逻辑
├── components/
│   ├── Toolbar.tsx
│   ├── F0Chart.tsx
│   ├── FormantChart.tsx
│   ├── StatusBar.tsx
│   ├── TargetPresetBar.tsx
│   ├── ConfigDrawer.tsx
│   ├── HelpDrawer.tsx
│   └── TipWidget.tsx
├── contexts/
│   ├── AnalysisContext.tsx
│   └── PipelineContext.tsx
├── hooks/
│   ├── useAudioEngine.ts
│   ├── useAnalysisPipeline.ts
│   ├── useECharts.ts             ← ECharts 实例管理
│   └── usePlayback.ts
├── types/
│   └── index.ts                  ← 共享类型定义
└── dsp/                          ← 原 js/ 目录，完全不动
    ├── analysis-pipeline.js
    ├── lpc.js
    ├── cepstral.js
    ├── fft.js
    ├── complex.js
    ├── formant-smoother.js
    ├── frame-processor.js
    ├── resampler.js
    ├── vad.js
    ├── wav-parser.js
    └── audio-engine.js
```

### 技术选型

| 项 | 选型 | 理由 |
|---|---|---|
| 构建工具 | Vite (已有) | 零迁移成本，现有配置不动 |
| UI 框架 | React 19 | 生态最成熟，路由/组件化/TS 支持完善 |
| 语言 | TypeScript | 渐进式引入，先为接口层加类型 |
| 路由 | React Router v7 | 多页面需求 |
| 图表 | ECharts (已有) | 复用现有图表逻辑 |
| 样式 | CSS Modules | 与现有 CSS 兼容，渐进迁移 |
| 状态 | React Context + useReducer | 项目规模不大，Redux 过度设计 |

不使用 Tailwind（需额外构建配置，且与现有 747 行 CSS 不兼容）。使用 CSS Modules 逐步替换现有样式。

### 迁移策略：渐进式，不阻塞

```
Step 1: 项目初始化
  - Vite 创建 React-TS 模板
  - 保留现有 index.html 作为 fallback
  - 新 React 应用挂载在独立入口

Step 2: 组件化拆分（并行可用）
  - 先迁移 Toolbar / StatusBar / TargetPresetBar 等无状态组件
  - 验证热更新正常

Step 3: ECharts 组件封装
  - F0Chart.tsx + FormantChart.tsx
  - 验证 pushFrame 性能与原来一致

Step 4: Context + 状态迁移
  - 将 main.js 的全局状态机迁入 AnalysisContext
  - 逐步废弃旧 main.js 的 DOM 操作

Step 5: 收尾
  - 删除旧 index.html（或改为纯 fallback）
  - 删除旧 css/style.css（已迁移的样式）
```

### 现有测试处理

| 测试类型 | 处理方式 |
|---|---|
| DSP 算法测试 (50 个) | **不动** — 仍在 `node --test` 下运行 |
| 新增组件测试 | 逐步添加（Vitest + React Testing Library） |

Vite 原生支持 TypeScript 和 `node --test`，所以测试基础设施不变。

### 不做的事

- 不重写分析管线（`analysis-pipeline.js`）
- 不替换 ECharts
- 不引入 CSS-in-JS
- 不重构 DSP 算法
- 不加 CI/CD
- 不改动现有测试

---

## Phase 2：新功能

在 Phase 1 的组件化架构上叠加：

- **多页面路由**：分析页 / 历史记录页 / 设置页
- **更多可视化模式**：语谱图（现有关联的 `spectrogram.js` 可激活）、3D 共振峰空间、实时评分视图
- **历史记录**：本地保存分析结果，支持对比
- **目标带预设编辑**：用户自定义 F0/F1/F2 目标区间

具体需求在 Phase 2 启动时另行讨论和设计。

---

## Phase 3：Rust + WASM

### 计划迁移的模块

```
js/lpc.js           → rust/crates/lpc         (LPC formant extraction)
js/cepstral.js      → rust/crates/cepstral    (cepstral formant extraction)
js/fft.js           → rust/crates/fft         (FFT / IFFT)
js/complex.js       → rust/crates/complex     (complex numbers)
js/formant-smoother.js → rust/crates/smoother (median filter / jump clamp)
js/vad.js           → rust/crates/vad         (voice activity detection)
js/resampler.js     → rust/crates/resampler   (sample rate conversion)
js/frame-processor.js → 不需要移，纯逻辑简单
```

### 接口设计

```typescript
// wasm-bindgen 导出，React 直接调用
// 与现有 analysis-pipeline.js 的调用方式一一对应
interface WasmPipeline {
  new(sampleRate: number, frameSize: number, hopSize: number): WasmPipeline
  pushChunk(samples: Float32Array): Array<Frame>
  reset(): void
}
```

### 性能预期

- LPC 求根（Laguerre 迭代）目前在 JS 中每帧约 0.5-2ms
- Rust 版本预计可降至 0.1-0.5ms（LLVM 优化 + SIMD）
- 全部管线单帧时间从 ~3ms 降至 ~1ms，释放主线程

### 时机

Phase 1 完成并稳定后启动。React 侧只需替换 import 路径即可切换 WASM 版本：

```typescript
// Phase 1: JS 版本
import { LPC } from '../dsp/lpc.js'

// Phase 3: WASM 版本（接口不变）
import { LPC } from '@voicebuilder/wasm'
```

---

## 不变的事项（贯穿全阶段）

- **现有 50 个测试持续通过**
- **算法精度**：回归测试继续与 Praat 参考数据对比
- **音频引擎**：`AudioContext` + `ScriptProcessorNode`（或将来迁移到 `AudioWorklet`）
- **单页无服务端**：所有处理在浏览器内完成

## 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| Phase 1 迁移期间功能停摆 | 中 | 渐进式迁移，旧代码与新 React 共存 |
| ECharts + React 重渲染导致卡顿 | 低 | useRef + 直接 setOption，不走 React render |
| TypeScript 引入学习成本 | 低 | 渐进式加类型，先加 `any` 后改进 |
| Phase 3 时间预估不准 | 中 | Phase 3 独立无依赖，不影响前面成果 |
| 单人精力分散 | 高 | 每阶段严格聚焦一个方向，不做多线操作 |
