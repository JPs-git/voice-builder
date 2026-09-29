# 中低端手机录音图表稳定性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本轮仅制定计划，未开始实现。

**Goal:** 在中低端手机上降低录音期间随机长停顿，优先稳定的刷新间隔和有界延迟，允许低于 60fps。

**Architecture:** 先消除实时存储写入、逐帧状态发布及不必要绘图，再以单一调度器发布最新显示快照。若真机证据表明 DSP 阻塞主线程，增加独立 Worker；音频分析保持连续，显示可跳过过期快照。

**Tech Stack:** React 19、Zustand 5、ECharts 5、TypeScript、Vite、Vitest、Web Audio；默认不新增运行时依赖。

**Spec:** 本文“设计约束与验收目标”是本次用户要求的计划草案的内嵌设计依据；尚未通过真机验证，不代表性能保证。用户要求：优先保持帧率稳定，接受不足 60fps，考虑中低端手机性能瓶颈。

## Global Constraints

- 保留 16kHz 分析采样率、800 点窗口、160 点步长和现有算法结果语义；第一阶段不通过降低分析精度换帧率。
- 保留最近 1000 个分析帧与 10 秒原始音频；绘图抽稀不能影响分析、回放、导入及点击选帧。
- 只保存预设变更；录音更新不能引发 localStorage 写入。
- 不以设备型号、UA 或 CPU 核数直接决定性能档位；依据实际耗时，真机验证。
- 不把降低渲染次数宣称为已经解决 DSP 瓶颈；不把 Worker 宣称为增加设备算力。
- 所有数值预算是初始目标，实施前记录基线，同一设备前后对比。
- 代码开发在 `.worktrees/fix/mobile-frame-rate` 和对应分支中进行；若该分支已在其他 checkout 使用，先核对并协调，禁止强制移动或删除。当前主 checkout 已在该分支，本计划不擅自切换它。
- PR base 为 master、Squash 合并；合并前 `npm test`、`npm run build`、`npx tsc --noEmit` 全通过。

## Review Focus

- 停止后仍有待发布帧：提交最后有效帧一次，避免 flush 空尾覆盖反馈（任务 2、5）。
- 清空或重启后旧异步结果到达：使用会话标识丢弃旧结果，不能污染新录音（任务 3、5）。
- 后台挂起、切页、屏幕旋转：无补画风暴、重复订阅或隐藏图表重绘（任务 3、6）。
- 长录音和热降频：队列、帧数、监听器和内存均有界，不能越录越延迟（任务 5、6）。
- 无声与不连续发声：保留 null 断点，抽稀不能把无声区连起来或移除短音高峰（任务 4）。

## 已有证据及未决问题

- `AudioEngine.ts` 使用 ScriptProcessor(1024)，按请求的 16kHz 计算为每 64ms 一批。真机需记录实际 AudioContext.sampleRate，不能只假设请求值。
- `useAnalysis.ts` 在采集回调里同步运行 AnalysisPipeline；每个分析帧调用 appendFrame。
- Zustand persist 对每次 set 都执行存储；前次计数实验中 591 帧对应 591 次 setItem。实验替换了存储，只证明调用次数，未测真实存储成本。
- FormantChart 竖屏每序列开启 symbol，窗口上限三条共 3000 个数据点；每次重建数据和配置。
- DSP 包含重复 detectPitch、Complex 对象 FFT 和始终执行的频谱计算；GC/绘图/DSP 各自的真机占比仍未知。
- 桌面 Node 预热后每批分析平均约 3.2–4.1ms，不包括 UI 和真实存储，不能外推手机。

## 设计约束与验收目标

### 显示节奏和资源预算

- 初始显示档为 15fps（约 66.7ms）；过载退到 10fps（100ms）。暂不设置 30/60fps 目标。
- 一次 RAF 调度统一处理当前可见图表与反馈快照；无新数据不调用 setOption。不做每图独立 setInterval。
- 调度以绝对截止时间推进，错过多次截止只画最新快照，不补画；动画关闭。允许显示掉帧，不允许为了赶画面丢分析数据。
- 15fps 的初始验收目标：有持续新数据时，绘制间隔 P95 ≤100ms、P99 ≤150ms；排除权限弹窗、切页与后台，单次间隔 >200ms 视为需定位异常。
- 10fps 档初始目标：P95 ≤150ms、P99 ≤200ms；持续稳定后才尝试升级。不得靠降档掩盖增长的分析延迟。
- 降档策略：以 5 秒窗口观察，连续两个窗口绘制超期率 >10%，或主线程图表更新 P95 >20ms，则 15→10fps；稳定 30 秒且超期率 <2%、更新 P95 <10ms 才尝试恢复，恢复失败冷却 60 秒。窗口样本不足不升档。真机校准后再冻结阈值。
- 帧间隔、绘图 CPU 耗时、采集间隔、DSP 耗时和数据新鲜度分别统计；RAF/setOption 返回并不等于屏幕呈现，配合浏览器 Performance trace 和肉眼确认。
- 主线程单次可见图表更新合计 P95 目标 ≤20ms；归因于应用的 >50ms 长任务记录次数及来源，录音稳态目标为零。
- Canvas DPR 首选上限 2，10fps 低档可降至 1.5。不在每帧重建实例，仅在档位稳定切换时受控重建并恢复当前图表状态；若其成本收益不佳，整段录音固定 DPR。
- 不设未经测量的堆内存绝对 MB 门槛：比较同机稳态窗口，要求预热后无持续增长，停止/清空后无累积保留。监控 TypedArray、Canvas 和 Worker 缓冲，不能只看 JS heap。

### 分析和积压策略

- 默认保留当前分析结果；批量提交不是抽帧。UI 数据中不复制 FFT magnitudes；先核查消费者，DSP 声区检测仍保留必要频谱。
- Worker 为有条件阶段，不以移动代码代替总成本优化。DSP 的每秒处理耗时目标 P95 ≤500ms，给热降频留余量；若持续接近 1 秒/秒则无法可靠实时运行。
- 如采用 Worker，复制音频输入后转移其独立 ArrayBuffer，不能转移浏览器借用的输入缓冲或仍供录音回放使用的缓冲。
- 用已发送/已确认采样数计算积压；250ms 为诊断警戒，持续超 500ms 达 2 秒或积压达 1 秒时停止录音并提示设备处理不足，保留已完整处理的数据与原始录音。不无限排队、不静默丢块、不伪造连续时间轴。
- 分析过载时单纯 15→10fps 可能无效；先测绘图减负是否释放足够 CPU，否则使用明确停止策略。降低算法复杂度或分析频率属于另一次精度评估。

## 文件与职责

| 文件 | 计划职责 |
|---|---|
| `src/performance/recordingMetrics.ts`（新） | 有界内存采样、分位数摘要；默认关闭，不逐帧打印 |
| `src/store/appStore.ts` | 批量 appendFrames，预设变更才持久化 |
| `src/hooks/useAnalysis.ts` | 收集分析结果、批量交付、会话生命周期 |
| `src/hooks/useToolbar.ts` | 仅订阅 hasData 语义，避免帧数驱动页面壳刷新 |
| `src/charts/liveChartScheduler.ts`（新） | 一个 RAF、显示档位、最新快照合并 |
| `src/hooks/useECharts.ts` | 调度接入、DPR 和 resize 去重、销毁 |
| `src/components/F0Chart.tsx`、`FormantChart.tsx`、`PitchChart.tsx` | 静态/动态配置拆分、共享刷新节奏 |
| `src/charts/sampleDisplayFrames.ts`（按测量创建） | 按像素抽稀，仅影响显示 |
| `src/audio/analysisWorkerClient.ts`、`analysis.worker.ts`、`analysisProtocol.ts`（条件新增） | Worker 生命周期、消息协议与积压控制 |
| `src/dsp/lpc.ts`、`cepstral.ts`、`fft.ts`、`analysis-pipeline.ts`（条件修改） | 热点消除，数值回归 |
| `docs/performance/mobile-recording.md`（新） | 可复现步骤、设备表、分阶段对比与 traces 索引 |

## Task 1: 建立可归因的性能基线（必须）

**Interfaces:** `RecordingMetrics.record(kind: MetricKind, durationMs: number): void`；`snapshot(): MetricsSummary`；每类最多 2048 个样本的固定缓冲，提供 count/P50/P95/P99/max。通过显式诊断开关启用，默认无逐帧记录。

- [ ] 测试 `recordingMetrics.test.ts`：超 2048 次记录仍有界；摘要数值正确；关闭时不累计。
- [ ] 运行 `npx vitest run src/__tests__/recordingMetrics.test.ts`，确认未实现时失败。
- [ ] 在 AudioEngine、AnalysisPipeline 调用边界、状态发布及 setOption 周围增加诊断计时，记录序列号及实际采样率；不记录音频内容。
- [ ] 运行上述测试通过；使用 production build，在代表性手机采集 3 轮基线，每轮静音 30 秒、发声/静音交替 60 秒、持续发声 30 秒。
- [ ] 输出各阶段耗时、存储调用数、帧间隔分布、GC/长任务、实际数据延迟，分别测分析页和音高页。记录缺失真机项，不用 CPU 限速冒充真机结果。
- [ ] 提交 `fix(perf): add recording performance diagnostics`。

## Task 2: 消除实时存储和逐帧发布（必须）

**Interfaces:** `appendFrames(frames: AnalysisFrame[]): void` 一次更新最近 1000 帧及 latestFrame；空批次不通知。保留现有 appendFrame 调用兼容性，但实时路径改用批次。停止沿用“最后完整帧”语义。

- [ ] 在 appStore/useAnalysis 测试新增断言：100 个实时分析帧触发 0 次存储写入；修改预设可持久化并重载；7 帧批次只通知一次；超 1000 帧截断正确；停止不被 flush 空帧覆盖。
- [ ] 运行 `npx vitest run src/__tests__/appStore.test.ts src/__tests__/useAnalysis.test.ts src/__tests__/useAnalysis.test.tsx`，确认新增断言失败。
- [ ] 保持原 `voicebuilder-presets` key 和旧数据格式，给持久化增加实际 presetOverrides 变化判断；收集一次 pushChunk 的结果后一次 appendFrames。暂不改为在 UI tick 上分析，避免调度绑定。
- [ ] 将 useToolbar 的 frames.length 订阅改为 frames.length > 0，保留 isCapturing 对按钮行为的影响。
- [ ] 运行相关测试通过，并回放基线，证明存储调用消除及发布次数下降。
- [ ] 提交 `fix(perf): batch analysis updates and persist only preset changes`。

## Task 3: 单一显示调度和稳定降档（必须）

**Interfaces:** `LiveChartScheduler.subscribe(draw: () => void): () => void`、`invalidate(): void`、`setVisible(visible: boolean): void`、`dispose(): void`；一个页面会话共享实例。draw 从最新已发布数据读取；默认 15fps，按本文策略降档。不得让 React 每个分析帧重订阅调度器。

- [ ] 新增 `liveChartScheduler.test.ts`：大量 invalidation 合并；模拟 300ms 卡顿后只绘制一次最新状态；没有新数据不画；隐藏暂停、恢复不补画；注销后无回调；5 秒窗口、降档和冷却边界符合本文。
- [ ] 运行 `npx vitest run src/__tests__/liveChartScheduler.test.ts` 验证失败。
- [ ] 接入三张图与实时反馈的显示快照；完整分析存储继续接收批次，显示快照仅在调度点变更。手动切换目标/可见系列和停止、清空可立即刷新一次，避免低频刷新留下旧画面。
- [ ] 回放 cursorTime 更新继续准确；录音调度不能限制回放停止/定位。resize 仅尺寸变化时执行，隐藏与销毁后释放 RAF/Observer。
- [ ] 运行调度器、三张图、FeedbackHero 和 Toolbar 相关测试；比较 15fps 与 10fps 的真机帧间隔，而不是只检查调用次数。
- [ ] 提交 `fix(perf): coordinate chart refresh with bounded display cadence`。

## Task 4: 控制绘图与内存分配（必须测量，按收益实施）

**Interfaces:** 若需要抽稀，`sampleDisplayFrames(frames: readonly AnalysisFrame[], plotWidthPx: number, keys: readonly ('f0'|'f1'|'f2')[]): AnalysisFrame[]`；每像素桶保留首尾、各序列极值及 null/有效转换边界，结果按时间排序去重。保留转换边界可能超过像素预算，不强行删掉有效断点。

- [ ] 新增测试：抽稀保留首尾、短峰和 null 间隔、原数组不变；图表动态更新不重发静态样式；DPR 档位切换后当前数据与光标恢复。
- [ ] 运行新增测试确认失败。
- [ ] 先拆静态配置与 series/xAxis 动态更新，再分别 A/B 测试 DPR 上限、显示抽稀。不同时改变多项后猜测收益；默认维持竖屏散点视觉，不直接改成连线。
- [ ] 复用可安全复用的中间缓冲；不原地篡改已交给 React/ECharts 的数据。确认 magnitudes 无 UI 消费者后，不让它进入显示快照。
- [ ] 运行 `npx vitest run src/__tests__/F0Chart.test.tsx src/__tests__/FormantChart.test.tsx src/__tests__/PitchChart.test.tsx src/__tests__/PortraitChartOptions.test.tsx` 及新增抽稀测试。真机比较清晰度、点击选帧与绘图耗时。
- [ ] 提交 `fix(perf): reduce mobile chart rendering and allocation costs`。

## Task 5: DSP 隔离与总计算成本（条件阶段）

**进入条件：** 任务 2–4 后真机仍不达稳定性目标，trace 显示 DSP 阻塞主线程；或 DSP 批次耗时 P95 超过 20ms。若 DSP 不是主要原因，不盲目增加 Worker。

**Interfaces:** `AnalysisWorkerClient.start(config): sessionId`、`pushChunk(sessionId, samples, sampleRate): void`、`stop(sessionId): Promise<AnalysisFrame | null>`、`reset(): void`、`dispose(): void`。协议在 analysisProtocol.ts 定义 discriminated unions：start/chunk/stop/reset 和 frames/stopped/error；每条消息带 sessionId，每 chunk 带连续 seq，响应带已处理采样总数。配置固定为开始时快照。

- [ ] 新增 Worker client/协议测试：原始录音缓冲不被 transfer detach；分块与现有同步管线结果相同；有序 stop 排空并返回最后完整帧；reset 丢弃旧 session；worker error 清理采集并提示；积压警戒和停止阈值可用虚拟时间验证。
- [ ] 运行 `npx vitest run src/__tests__/analysisWorkerClient.test.ts` 确认失败。
- [ ] 将整个有状态 AnalysisPipeline 放入一个 Worker，每音频块返回一个紧凑结果批次；保留平滑、VAD、声区检测和 frameOffset。音频导入路径先保持原有行为。
- [ ] 实施有界积压及停止策略；Worker 不可用时不可静默切回已知会持续阻塞的方案。仅在同步降级通过同设备验收时允许降级，否则明确停止和提示。
- [ ] 测总 DSP CPU 成本。若仍过高，先复用已算出的 f0，再评估 typed-array FFT/预计算旋转因子；每项独立提交并运行全部 DSP 和 Praat 回归，禁止无测试替换算法。
- [ ] 运行新增 Worker 测试、AudioEngine/useAnalysis 测试与 `npm run test:dsp`；使用生产构建验证 Worker 打包、移动浏览器启动和异常清理。
- [ ] 提交 `fix(perf): isolate live analysis with bounded worker backpressure`。

**后续独立评估：** 只有采集回调因主线程阻塞造成缺口时才规划 AudioWorklet。不能只缩小 ScriptProcessor buffer：它会增加回调开销，未必改善低端机。SharedArrayBuffer 不作为首轮依赖。

## Task 6: 真机、热降频和回归验收（必须）

- [ ] 至少覆盖一台低端 Android、一台中端 Android 和一台较旧 iPhone；记录具体型号、RAM、系统、浏览器、DPR、实际采样率。设备不可用的项标为未验证，不宣称覆盖。
- [ ] production build 同机优化前/后各 3 次运行；冷机短测与连续 10 分钟录音热机测试分开记录。测试分析页和音高页、静音、发声、目标切换、停止/继续、清空、旋转、切后台再返回。
- [ ] 确认后台行为与浏览器限制一致；恢复后不补画，不出现跨会话数据、队列无限增长或回放错位。
- [ ] 性能报告逐项对照本文预算；对超目标项列出 trace 归因，不以平均 FPS 达标替代 P99 和最大停顿。
- [ ] 运行 `npm test`、`npm run build`、`npx tsc --noEmit`，全部成功；记录版本和结果。
- [ ] 更新 `docs/performance/mobile-recording.md`，明确已执行项、条件跳过项、未验证机型及建议默认档位，提交 `docs(perf): record mobile recording validation`。

## 阶段决策与交付

1. 任务 1 提供基线；任务 2、3 消除确定的不必要工作并统一节奏。
2. 任务 4 的每项只在实际改善稳定性或内存且视觉可接受时保留。
3. 任务 5 根据归因决定是否进入；不能假定前几项一定足够，也不预先承诺 Worker 一定解决低端机问题。
4. 每阶段重复同一真机场景，保留可回退提交。最终默认档位由最弱目标设备结果决定。
5. 本轮产物只有计划文档，不包含产品修改、设备验收结果或性能改善声明。执行方式建议在当前任务逐项实施；没有必要预先并行修改共享的实时链路。
