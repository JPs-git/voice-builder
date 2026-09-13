# 钢琴训练页（Practice Page）设计

*日期: 2026-09-13 | 分支: feat/practice-page*

## 目标

新增第二个页面「钢琴训练页」：顶部一个模拟钢琴（C2–B5，48 键）可听参考音，下方一个音高谱，用**科学音高记法**（C4、D4）显示音高。通过顶部工具栏**一个居中的按钮**切换页面。

## 核心原则

- **音频引擎流程完全不变**：麦克风 → pipeline → `appStore.frames`，新页面读取同一份数据，换的只是可视化方式。
- **切换页面不中断录音/回放**：工具栏及其 hook（`useToolbar` → `useAnalysis`/`usePlayback`）常驻共享壳层，不随页面卸载。
- 复用现有约定：`useECharts()` + store 订阅 + `cursorTime` prop、CSS Modules、ECharts `markArea/markLine` 区间标注、`EmptyState` 空态。

## 1. 架构与路由

### `src/App.tsx`（改造）

以布局路由承载共享壳层：

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<AppShell />}>
      <Route index element={<AnalysisPage />} />
      <Route path="practice" element={<PracticePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
</BrowserRouter>
```

### `src/routes/AppShell.tsx`（新增）

永久挂载的壳层，从不卸载：
- 调用 `useToolbar(onConfig, onHelp, onAbout)`，渲染 `<Toolbar />` + 页面内容 `<Outlet />`
- 持有 config/help/about 抽屉开关状态、`<Toast />`、隐藏的 file input
- 通过 `<Outlet context={{ cursorTime, hasData }} />` 向子页面下发路由上下文
- 用 `useLocation().pathname` + `useNavigate()` 实现页面切换按钮的 label 与跳转

### `src/routes/AnalysisPage.tsx`（瘦身）

删除 Toolbar、三个抽屉、`<Toast />`、隐藏 file input（全部上提至 AppShell）。保留 `TargetPresetBar / FeedbackCard / F0Chart / FormantChart / TipWidget`。通过 `useOutletContext` 接收 `cursorTime` / `hasData`；测试改为在 MemoryRouter + 布局 Route 中渲染。

## 2. 工具栏居中切换按钮

- `ToolbarProps` 增加可选 `nav?: { label: string; onClick: () => void }`
- `Toolbar.tsx` 在 brand 与 actions 之间新增居中区域 `.nav`（CSS：`flex:1; justify-content:center`），仅当传入 `nav` 时渲染
- AppShell 计算：分析页显示 `⇄ 钢琴训练`，钢琴页显示 `⇄ 返回分析`
- **不走 `handleClickTool`**：纯导航，天然绕过所有音频前置检查，符合"切页不中断"约束。`useToolbar.ts` 零改动。

## 3. 记谱法工具 `src/utils/pitch.ts`（新增，纯函数）

A4=440Hz、MIDI 69 标准：

- `freqToMidi(f): number` → `69 + 12·log2(f/440)`（连续值）
- `midiToFreq(m): number` → `440·2^((m-69)/12)`
- `midiToName(m): number → string` → 科学记谱法（`C4`, `C#4`, `C5`）：`SEMITONE_NAMES[m%12] + Math.floor(m/12)-1`
- `nearestMidi(f): number` → `Math.round(freqToMidi(f))`
- `centsOffset(f, refMidi): number` → `1200·log2(f/midiToFreq(refMidi))`
- 常量：`MIDI_C2=36, MIDI_C3=48, MIDI_C5=72, MIDI_C6=84`

## 4. 钢琴发声 `src/audio/PianoSynth.ts`（新增）

- 独立 `AudioContext`（默认设备采样率，避免复用 16k 分析引擎导致的谐波混叠）
- 首次播放时惰性创建 + `resume()`（配合点击手势，满足自动播放策略）
- `play(midi, duration=0.9)`：基波 + 2、3 次谐波（幅度 1 / 0.5 / 0.25）+ 指数衰减包络
- `stopAll()`：内部 `Map<midi, oscillator[]>`，将所有振荡器停止并清空
- 模块级单例 `getPianoSynth()`（与 `recordingBuffer` 同模式）

## 5. 钢琴组件 `src/components/Piano.tsx` + `Piano.module.css`

- 48 键 C2–B5（MIDI 36–83），白键 flex 行 + 黑键绝对定位嵌套在所属白键左缘
- Props：`{ currentMidi: number | null; onKeyPress: (midi: number) => void }`
- `currentMidi` 对应键用 `data-active` 高亮；每键 `role="button"` + `aria-label="C4"` / `aria-pressed`
- 点击 → `onKeyPress(midi)` → `getPianoSynth().play(midi)`

## 6. 音高谱 `src/components/PitchChart.tsx`（新增）

复用 `useECharts()`，风格对齐 F0Chart（rAF 节流、`isLive` 10s 滚动窗、`__cursor` 回放线、`connectNulls:false`）：

- **Y 轴**：`type:'value'`，`min:36 (C2)` / `max:84 (C6)`，数据点为连续 MIDI 值 `[time, freqToMidi(f0)]`（`f0==null → null`）
  - `axisLabel.formatter = v ⇒ midiToName(Math.round(v))`，`minInterval:1`：纵轴**每个整数半音**都有坐标参考线（splitLine）与标签（含黑键音如 `C#4`）
- **钢琴区**：`markArea` 覆盖 C2–B5（36–83）淡色底；`markLine` 虚线标 C4
- **tooltip**（用户选定"仅曲线+tooltip"形态）：显示 时间 / ♬ 记谱法整数音符，如 `♬ C4`（去掉音分）
- 超界：f0 低于 65.4Hz 或高于 1046Hz 时曲线在 36/84 处裁剪，tooltip 仍显示真实记谱法
- Props：`{ cursorTime?: number }`；空数据时配合 `<EmptyState>` 显示

## 7. 页面 `src/routes/PracticePage.tsx` + module.css

- `useOutletContext<{ cursorTime: number }>()` 取回放游标（AppShell 单实例下发）
- `latestFrame = useAppStore(s => s.latestFrame)`；`currentMidi = f0 ? nearestMidi(f0) : null`，仅当 36 ≤ midi ≤ 83（C2–B5）才高亮（超出钢琴范围不高亮）
- 布局：上部钢琴卡片（无标题，直接 `<Piano />`），下部音高谱卡片（标题「音高」+ `<PitchChart />`）；复用 AnalysisPage 的 card/chartWrapper 样式约定

## 8. 样式

- `css/style.css`：新增 `#pitchChart { width:100%; height:100%; display:block }`（沿用 `#f0Chart` 惯例）

## 9. 文件清单

| 文件 | 操作 |
|---|---|
| `src/App.tsx` | 改造（布局路由） |
| `src/routes/AppShell.tsx` | 新增 |
| `src/routes/AnalysisPage.tsx` | 瘦身（上提 Toolbar/抽屉/Toast/file input） |
| `src/routes/PracticePage.tsx` + `.module.css` | 新增 |
| `src/components/Toolbar.tsx` + `.module.css` | 改造（居中 nav slot） |
| `src/components/Piano.tsx` + `.module.css` | 新增 |
| `src/components/PitchChart.tsx` | 新增 |
| `src/audio/PianoSynth.ts` | 新增 |
| `src/utils/pitch.ts` | 新增 |
| `css/style.css` | 增加 `#pitchChart` 尺寸规则 |

## 10. 测试

- `src/__tests__/pitch.test.ts`：A4/C4/C#4/C5 换算、`nearestMidi`、`centsOffset` 符号与取整
- `src/__tests__/PianoSynth.test.ts`：mock 全局 `AudioContext`（沿用 AudioEngine.test 惯例），验证 `play` 创建 3 振荡器且频率正确、`stopAll` 清理
- `src/__tests__/Piano.test.tsx`：25 键渲染、点击回调、`currentMidi=C4` 时对应键 `data-active`
- `src/__tests__/PitchChart.test.tsx`：mock `useECharts`（照抄 F0Chart 测试），校验 yAxis 36/84、`axisLabel.formatter(60)='C4'`、markArea 48–72、tooltip formatter 返回记谱法字符串
- `src/__tests__/AppShell.test.tsx`（MemoryRouter）：居中按钮 label 随路由翻转、点击切换、`useOutletContext` 正确下发
- 现有 `AnalysisPage.test.tsx` 等回归保持绿

## 非目标（YAGNI）

- 频谱图/音高直方图/音分偏移独立指示条（本次只做音高谱）
- 钢琴键盘快捷键、滑奏、延音踏板
- 目标参考线（图上画目标音）、唱准度评分
- 切页停止录音的约束（明确保持不中断）