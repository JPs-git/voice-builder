# 录音统计页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现独立的 60 秒自然说话录音统计页，采集时专注朗读，录后查看 F0 分位概览与直方图并完整回放。

**Architecture:** 保持 AppShell 与旧实时会话常驻，新增常驻 RecordingSessionController，按路由切换工具栏与音频所有权。新会话保存完整 PCM，录后由 Worker 执行仅 F0 分析与统计；页面和回放只消费同一份报告。复用现有门控、频谱检查、重采样、音高估计和基础组件，不改变旧页面的 10 秒窗口。

**Tech Stack:** React 19、TypeScript、Zustand（旧会话）、Web Audio API、Web Worker、ECharts、Vitest / Testing Library；不新增运行依赖。

**Spec:** [已批准规格](../specs/2026-10-18-recording-statistics-design.md)

## Global Constraints

- 分支 `feat/recording-statistics`；目录 `.worktrees/feat/recording-statistics`；以含已批准规格和本计划的文档提交为起点，主 checkout 常驻干净的 master。
- 新路由 `/recording`；导航「实时分析」「录音统计」「音高参考」。
- 新页录音/导入最多 60 秒；旧页面保留 10 秒限制。
- 录音中不显示音高、波形、电平、声区、目标、转写、评分或之前报告，也不运行 F0 分析。
- 横屏采用已选第 2 版：顶栏操作、横向设置条、居中阅读；无额外侧栏或重复录音按钮。
- 16000Hz 分析、800 样本窗、160 样本步长；共享门控开启 0.008、关闭 0.005、保持 100ms 和现有频谱结构判断。
- 典型值为中位数，极值取有效帧实际 min/max，全距为 max-min，半音为 12*log2(max/min)，P10/P90 使用 (n-1)*p 线性插值。
- 孤立跳点严格按规格 8.2：1–2 帧，双侧各 3 帧，双侧中位数相差不超过 2 半音，候选同方向偏离双侧至少 8 半音；非迭代处理。
- 有效 F0 少于 3 秒隐藏摘要值，3–10 秒显示样本较少说明；不足 30 秒不禁止分析。
- 所有音频与特征仅在本地处理；刷新后不保留音频；不加入历史库、共振峰统计、评分或导出。
- 每项任务先运行目标测试确认失败，再实现并确认通过；提交前检查实际差异，合并前必须全量测试、构建、类型检查。

## Review Focus

- 授权晚返回、路由切换后旧授权覆盖新录音：Task 3/7 验证旧流被关闭且旧回调不改写新状态。
- 低音量真人说话、噪声与补零尾部：Task 2/8 验证共享门控、真实样本计数和真实材料效果。
- 60 秒在单个输入块中越界、元数据与解码时长不一致：Task 2/4 验证按样本裁定边界，导入不静默截取。
- 任务取消/重录/失败时上一份报告及回放资源：Task 4/5 验证事务式提交、旧消息屏蔽、播放事件隔离。
- 窄屏大字号、极值超过 500Hz、静音或极少有效 F0：Task 6/8 验证可读可操作及摘要与图表的一致边界。

---

## 文件与接口地图

所有新增业务文件位于 `src/recording/`，按职责拆分：

| 文件 | 职责 |
|---|---|
| types.ts / constants.ts | 片段、帧、报告、任务状态契约及独立 60 秒常量 |
| statistics.ts | 孤立跳点、分位数、分布、极值及有效时长 |
| analyzeClip.ts / analysis.worker.ts / workerClient.ts | 仅 F0 分析、Worker 协议、取消与进度 |
| importClip.ts | 60 秒文件探针/解码和元数据 |
| sessionController.ts / RecordingSessionProvider.tsx | 完整 PCM、采集、任务竞争、结果提交与常驻订阅 |
| playbackController.ts / useRecordingPlayback.ts | 独立采样率的播放、暂停、seek 与局部回听 |
| materials.ts | 三篇规格正文与自由说话话题 |
| RecordingPage.tsx / RecordingReader.tsx | 设置、文章、自由说话、采集状态 |
| RecordingReport.tsx / RecordingCharts.tsx | 摘要、统计说明、回放、曲线和分布 |
| RecordingPage.module.css | 本页布局、选定视觉与窄屏重排 |

既有修改限于 `AudioEngine` 的取消/采样率能力、共享门控帧工具、实时会话 suspend、AppShell/路由/导航/帮助与必要回归测试。不得以复制现有完整 AnalysisPipeline 作为新分析器。

公共类型在 Task 1 定义，后续名称一致：

- `AudioClip = { samples: Float32Array; sampleRate: number; duration: number; source: 'mic'|'file'; name: string; mode: 'reading'|'free'|null; material: MaterialSnapshot|null; prompt: string|null }`。
- `PitchFrame = { start: number; duration: number; time: number; rawF0: number|null; f0: number|null; voiced: boolean; exclusion: 'invalid'|'isolated-jump'|null }`；时间单位秒。
- `PitchSummary` 含 median/minimum/maximum/minTime/maxTime/range/semitoneRange/p10/p90（空集为 null）、validDuration、coverage、excludedCount 和 histogram。
- `ClipAnalysis = { frames: PitchFrame[]; summary: PitchSummary; version: string; settings: AnalysisSettings }`；`RecordingReport = { id: number; clip: AudioClip; analysis: ClipAnalysis }`。
- `RecordingSnapshot = { phase: 'prepared'|'requesting'|'recording'|'importing'|'analyzing'|'ready'|'error'; elapsed: number; progress: number; report: RecordingReport|null; error: string|null }`。
- `MaterialSnapshot` 固定保存 id/version/title/source；`AnalysisSettings` 固定保存检测范围、采样/成帧与门控参数、跳点规则版本。

## Task 1：统计纯函数与共享类型

**Files:** 创建 types.ts、constants.ts、statistics.ts、`src/__tests__/dsp/recording-statistics.test.ts`。

**Interfaces:** 产出 `summarizePitch(frames: readonly PitchFrame[], duration: number): { frames: PitchFrame[]; summary: PitchSummary }`；输入不变，先一次性标记跳点，再从报告有效帧计算全部摘要。

- [x] 写失败测试：奇偶中位数、P10/P90、极值最早时间、空集、常量、无声、非有限值、10ms 覆盖时长、10Hz 分箱和边界 1000Hz。
  ```ts
  expect(summary.median).toBe(200)
  expect(summary.p10).toBe(120)
  expect(summary.p90).toBe(280)
  expect(summary.range).toBe(200)
  expect(summary.semitoneRange).toBeCloseTo(19.01955)
  ```
  上述使用 [100,200,300] 的有效帧；报告展示门槛另测。跳点测试覆盖稳定 200Hz 中的 1/2 帧 400Hz、3 帧持续变化、缺失锚点、停顿、非迭代判定。
- [x] 运行 `npm test -- --project dsp src/__tests__/dsp/recording-statistics.test.ts`，确认缺失模块/断言失败。
- [x] 定义类型与常量，按规格实现统计和跳点规则；duration 必须限制覆盖累计，不累加 50ms 重叠窗。
- [x] 同一命令通过；确认输入数组及 rawF0 未改写，计算未依赖目标区间。
- [x] 提交：`feat(recording): add pitch summary and conservative outlier rules`。

## Task 2：仅 F0 分析、Worker 与 60 秒导入

**Files:** 创建 analyzeClip.ts、analysis.worker.ts、workerClient.ts、importClip.ts；按需要抽取 `src/dsp/voicedFrame.ts` 并在现有 analysis-pipeline.ts 复用；测试 recording-analysis.test.ts、recording-worker.test.ts、recording-import.test.ts。

**Interfaces:** `analyzeClip(samples: Float32Array, sampleRate: number, onProgress?: (progress: number)=>void): ClipAnalysis`；`runClipAnalysis(clip: AudioClip, options: {signal: AbortSignal; onProgress: (progress:number)=>void}): Promise<ClipAnalysis>`；`importRecordingFile(file: File, signal: AbortSignal): Promise<AudioClip>`。

共享门控工具固定为 `VoicedFrameAnalyzer`：构造参数 `vadOptions?: VadOptions`，方法 `analyze(frameSamples: Float32Array, realLength: number, sampleRate: number, elapsedMs: number): {samples: Float32Array; magnitudes: Float32Array; voiced: boolean; rms: number}` 与 `reset(): void`。samples 是真实样本视图；保留旧管线对不足半窗时频谱的行为，但该尾帧不发布为有声。

- [x] 写失败测试：60 秒上限的元数据及实际 PCM 兜底、选择取消/解码失败不产生片段、多声道第 0 声道、真实尾部中心时间、纯静音/噪声、轻声、原算法 60–1000Hz 范围。
- [x] 运行三组目标测试，确认失败。
- [x] 抽取“真实样本频谱+共享门控”的最小共用工具，避免改变旧 AnalysisPipeline 输出时间。新分析器独立计算窗中心，25ms 以下真实尾部不估计；不调用共振峰/声区/平滑器。
- [x] 实现 Worker 的 `{id,type:'analyze',samples,sampleRate}` 请求及同 ID 的 progress/result/error 消息；取消终止 Worker。保留会话 PCM，禁止传输导致回放缓冲被 detach。
- [x] 实现导入探针与解码，复用现有 decoder/parser/resampler，独立应用 60 秒限制；解码不可取消时检查 signal 并清理资源。
- [x] 运行目标测试与现有 gate/resampler/praat 回归。验证各采样率内部的整段/分块一致性，跨采样率仅要求统计精度与时间对齐。
- [x] 提交：`feat(recording): analyze complete clips in a cancellable worker`。

## Task 3：音频授权取消与旧会话暂停契约

**Files:** 修改 `src/ts/AudioEngine.ts`、`src/hooks/useAnalysis.ts`、`src/hooks/useToolbar.ts`；修改 AudioEngine.test.ts、useAnalysis.test.tsx，新增实时 suspend 回归。

**Interfaces:** `AudioEngine.startCapture(onChunk, signal?: AbortSignal): Promise<void>` 保持旧调用兼容；`createPlaybackSource(samples, sampleRate?: number)` 默认仍 16000Hz；useAnalysis/useToolbar 新增显式 `suspend(): void`，保留数据与 frameOffset。

- [x] 写失败测试：授权期间 stop/abort 后晚返回的流关闭；旧 start/resume 不能覆盖新采集；采集初始化失败释放流；48000Hz 片段按其采样率建立回放缓冲。
- [x] 写 suspend 测试：停止采集、取消等待中的授权、停止旧播放，但不清空 frames/buffer/目标；再次实时录音保留时间偏移。
- [x] 运行对应测试确认失败。
- [x] 在 AudioEngine 使用请求代次与 abort 检查；旧请求只清理其自己的流，不停止新流。useAnalysis 对迟到成功/失败做请求代次检查，避免被取消后创建 pipeline 或提示旧错误。
- [x] 让 useToolbar.suspend 调用显式停止契约，禁止用 toggle 或 clear 代替；保留原有两个实时页面切换的连续性。
- [x] 运行目标测试及既有 AudioEngine/useAnalysis/usePlayback 回归通过。
- [x] 提交：`fix(audio): isolate cancelled capture requests and preserve sessions`。

## Task 4：常驻录音会话控制器

**Files:** 创建 sessionController.ts、RecordingSessionProvider.tsx、recording-session.test.ts。

**Interfaces:** `RecordingSessionController(deps: RecordingSessionDependencies)` 暴露 getSnapshot/subscribe、`start(options: RecordingOptions): Promise<void>`、`finish(): void`、`cancel(): void`、`importFile(file: File): Promise<void>`、`retry(): void`、`clear(): void`、`leave(): void`、`destroy(): void`；`useRecordingSession()` 提供快照和同一控制器。依赖注入采集、导入与 Task 2 分析服务。

`RecordingOptions = {mode: 'reading'|'free'; material: MaterialSnapshot|null; prompt: string|null}`；`RecordingSessionDependencies = {engine: Pick<AudioEngine, 'startCapture'|'stopCapture'>; analyze: typeof runClipAnalysis; importClip: typeof importRecordingFile; now: ()=>Date}`。这些类型与控制器位于同一模块，Provider 负责组装真实依赖。

- [x] 写失败测试：采集不调用分析；无首块前不累计时长；复制输入块；跨 60 秒块只保留剩余样本；finish 与自动上限同时触发只提交一次。
- [x] 写竞争测试：取消/失败恢复上一报告，新结果原子替换；旧 Worker/解码返回不能覆盖新任务；取消授权与 leave 释放设备；分析失败保留 PCM 支持 retry。
- [x] 运行 `npm test -- --project unit src/__tests__/recording-session.test.ts` 确认失败。
- [x] 实现独立 PCM 块集合、请求代次、AbortController、稳定快照订阅和事务式结果提交。React 状态只更新必要元数据，不能每次 tick 拼接全量 PCM。
- [x] leave 在录音时按 finish 收尾，分析中允许后台完成；destroy 释放全部资源。Provider 在 AppShell 生命周期内常驻，禁止页面卸载时销毁报告。
- [x] 运行控制器和跨阶段错误测试全部通过。
- [x] 提交：`feat(recording): manage complete recording sessions and task cancellation`。

## Task 5：独立片段回放与极值定位

**Files:** 创建 playbackController.ts、useRecordingPlayback.ts、recording-playback.test.ts。

**Interfaces:** `RecordingPlaybackController` 暴露 `setClip(clip: AudioClip|null)`、`play(): void`、`pause(): void`、`seek(seconds:number): void`、`playAround(seconds:number): void`、`stop(): void`、subscribe/getSnapshot/destroy；快照含 position/playing/duration。复用 Task 3 可指定采样率的播放能力。

- [x] 写失败测试：seek 不播放；pause 保留位置；播放从当前位置继续；极值前后各 2 秒边界裁切；原采样率播放时间正确。
- [x] 写竞争测试：旧 onended/RAF 不影响新源；换 clip/离页停止旧音源；反复播放不累积资源。
- [x] 运行目标测试确认失败。
- [x] 实现按 AudioContext 时间计算位置与任务代次保护；局部回听使用显式 offset/duration，不更改报告统计范围。
- [x] 运行目标测试通过，并确认旧 usePlayback 测试不受影响。
- [x] 提交：`feat(recording): add clip playback and localized review`。

## Task 6：朗读与结果页面

**Files:** 创建 materials.ts、RecordingPage.tsx、RecordingReader.tsx、RecordingReport.tsx、RecordingCharts.tsx、RecordingPage.module.css；新增 RecordingPage.test.tsx、RecordingReport.test.tsx、recording-chart-options.test.ts。

**Interfaces:** `RecordingPage(): React.JSX.Element` 消费常驻会话；`RecordingReport({report}: {report: RecordingReport})` 消费 Task 5 回放；`RecordingCharts({analysis,duration,position,onSeek})` 仅报告态挂载。正文与状态文案按规格，不再创造阅读材料。

图表 props 固定为 `{analysis: ClipAnalysis; duration: number; position: number; onSeek: (seconds:number)=>void}`。报告数据类型以别名导入，避免与同名组件混淆。

- [x] 写失败测试：准备/授权/录音中不存在声学图表、F0/Hz/波形/电平/评分与旧报告；模式/材料锁定，字号仍可调整，自由说话提示可收起。
- [x] 写结果测试：有效时长 2.99/3/9.99/10 秒展示边界、无数据、恒定值、极值卡只定位、显式回听播放、原始时间范围；分布在 1000Hz 和重复分位边界正确。
- [x] 运行目标测试确认失败。
- [x] 实现设置条和居中阅读卡，使用规格三篇文本；实现样本不足与失败重试。
- [x] 实现四卡片、2:1 曲线/分布、说明折叠与回放。ECharts 使用现有 useECharts；无声断线，动态 Y 轴包含 >500Hz 极值，图表可抽样但统计数据不抽样。
- [x] 结果出现时仅在页面可见且当前会话匹配时聚焦标题；采集计时不逐秒 live 播报。
- [x] 运行目标测试通过；样式实现横屏间距、22px 默认正文、18/20/22/24/26 字号和 360px 重排。
- [x] 提交：`feat(recording): build quiet reading and pitch report views`。

## Task 7：路由、顶栏、帮助与资源互斥集成

**Files:** 修改 App.tsx、AppShell.tsx、Toolbar.tsx/Toolbar.module.css、MobilePageTabs.tsx/样式、helpContent.ts；新增 recording-toolbar.ts（本页工具栏适配）；更新 AppShell/导航/帮助测试，新增 recording-route.test.tsx。

**Interfaces:** AppShell 常驻 Provider；按当前路由绑定工具栏模型和文件输入，旧用例继续消费原有 ShellContext；`/recording` 渲染 RecordingPage。

- [x] 写失败测试：三导航路由；录音统计页顶栏的开始/结束/取消/导入按会话状态变化；只有一个主按钮；窄屏不出现旧目标 Dock。
- [x] 写跨页测试：进入本页先 suspend 旧实时录音/播放且保留数据；离开本页停止播放、录音按 finish 分析；旧授权晚返回不能抢占；原有两个实时页之间仍可连续录音。
- [x] 写帮助回归：本页说明与焦点返回正确，不显示无关配置、目标和旧首次帮助条；帮助/关于不停止录音。
- [x] 运行目标测试确认失败。
- [x] 替换二选一页面按钮为三导航；抽出本页工具栏状态映射，避免继续扩大 AppShell 中的业务条件分支；状态忙碌时禁用导入，录音操作始终直接可达。
- [x] 接入路由进入/离开契约与报告常驻；不重挂载旧 useAnalysis，不重置其 frameOffset。
- [x] 运行导航、帮助、布局、旧页面与会话回归通过。
- [x] 提交：`feat(recording): integrate navigation and isolated audio ownership`。

## Task 8：整体验证、视觉检查与文档

**Files:** 更新 docs/ui-design.md、README.md 中的页面与时长说明；必要时补全上述测试；不改版本号或 release.yml。

- [x] 运行 `npm test`、`npm run build`、`npx tsc --noEmit`；全部退出 0 才能报告通过。
- [x] 在浏览器检查 1440×900、1920×1080、360px；覆盖准备、录音、取消、导入、分析、结果、错误、字号放大和跨页，截图对照选定设计。
- [x] 用可重复 PCM 输入验证 60 秒截断、Worker 取消、极值定位与回放；同时完成真人朗读/即兴说话核验。若没有真实麦克风验证条件，明确标为尚未实测，不用合成输入代替这项结论。
- [x] 全分支审查：按 Review Focus 核对异步竞态、音轨释放、统计边界、旧页回归和视觉；修复后只重跑相关测试及最终三项集成检查。
- [x] 更新当前实现文档，说明新页 60 秒与旧页 10 秒；规格标记实现状态，不修改已批准的统计口径。
- [x] 提交文档与最终修复，向用户交付工作分支、测试证据、预览和仍需真人核验的边界。PR/合并遵守 AGENTS.md，未获得相应请求前不自动合并。

## 计划自审

- 规格第 1–6 节由 Tasks 2/4/6/7 覆盖；第 7–8 节由 Tasks 1/2/5/6 覆盖；第 9–11 节由 Tasks 2–7 覆盖；第 12 节由各任务测试和 Task 8 覆盖。
- 纯统计、采集和 UI 接口只在本计划定义一次；旧实时数据与新完整 PCM 的边界明确。
- 五项 Review Focus 均有归属测试；图像比对与真人说话属于 Task 8 实测，不伪装成单元测试已覆盖。
- 不添加第二套门控、第三方声学模型、历史库或图像辅助。

## 执行结果

已完成实现及独立审查修复，最终 80 个测试文件 / 568 项通过，构建和类型检查通过。浏览器已验证导入、分析、结果、错误、回听、切页和三种视口；真实麦克风录制与低音量自然说话未实测，采集/取消状态使用自动测试验证。详细证据与边界见 `../verification/2026-10-18-recording-statistics.md`。


## 2026-10-19 统计范围收敛（已执行）

本节取代旧计划中极值、变化幅度、时间曲线及局部回听任务，以修订后的规格为准。

- [x] 新增本页 60–500Hz 统计范围，保留共享检测范围；原始 F0 保留，超上限独立排除并记录计数、时长与候选时长占比。
- [x] 仅返回中位数、P10/P90、有效时长及直方图，更新分析版本与配置快照。
- [x] 报告三项指标与单一直方图，保留有效样本不足策略，500Hz 归入最后一箱。
- [x] 移除时间曲线、极值定位及局部回听路径；保留整段原音频播放、暂停、seek、结束和重播。
- [x] 更新帮助、统计说明、纯函数/DSP/页面/真实 ECharts/回放测试及横竖屏流程检查。


## 2026-10-19 再录准备流程（已执行）

以规格 7.4 取代旧的结果页直接重新录音/清除流程。

- [x] 先写失败用例，验证再录只进入准备、旧报告保留、返回结果恢复播放位置。
- [x] 会话增加准备/结果视图；prepare 不创建任务，returnToReport 不分析或自动播放，取消按是否有旧结果恢复。
- [x] 横屏结果页仅保留再录一段，导入移入更多；准备页显示开始、返回结果和导入。
- [x] 竖屏复用 RecordDock 的文字主操作与前后插槽，结果状态无材料/清除，准备状态保留短文与返回。
- [x] 失败任务支持重试、返回结果或再录准备；真正离页与卸载暂停/释放资源。
- [x] 同步帮助和现行 UI 文档，完成全量测试、构建、类型检查、横竖屏浏览器检查与一次独立只读审查。

Ruling: 回放控制器由常驻录音会话持有，报告卸载只暂停，真正会话销毁才销毁播放资源 — 保证返回结果及路由切换可恢复原进度 — 代价是会话保留期间继续持有当前报告音频，符合原有数据保留范围。


## 2026-10-19 统一帮助（已执行）

- [x] 先写失败用例：七项主题、统计入口默认、其他页浏览统计、关闭重开恢复入口意图、任务完成不重置话题。
- [x] 将统计主题加入共享 HelpTopic、主题顺序和 getHelpSections，删除页面标志覆盖正文/隐藏导航的路径。
- [x] 统计帮助五章按横竖屏展示准确入口，桌面四列/竖屏三列主题排列，保留原有定向入口与报告统计说明。
- [x] 验证帮助不改变采集/播放；录音达上限后自然完成时保持主题。独立审查发现成功/失败自动聚焦穿透模态及旋转关闭 fallback 优先录音问题，补失败用例后修复并复核。
- [x] 全量测试、构建、类型检查、横竖屏浏览器验证和文档同步。

Ruling: 页面自动聚焦在任意模态打开时跳过，不扩大全局 Modal 的事件拦截 — 防止后台报告/错误抢走帮助焦点并保持现有模态交互 — 代价是帮助打开时不自动聚焦新报告，用户关闭后仍按原入口返回。


## 2026-10-19 竖屏结果页移除 Dock（已执行）

- [x] 先补失败断言，验证无有效 F0 的结果也卸载 Dock、标题按钮同容器、结果高度为 0、返回准备后恢复 Dock。
- [x] AppShell 按完整结果状态卸载 Dock，并立即通过布局上下文清零高度；准备/任务挂载后重新实测。
- [x] 报告仅在竖屏接收进入准备回调，在标题行显示至少 44px 的紧凑文字按钮；横屏继续只使用顶栏入口。
- [x] 结果页底部只留常规间距与安全区，标题随报告滚动；保留正常/短样本/无 F0、回放与返回逻辑。
- [x] 更新帮助位置文案，完成全量测试、构建、类型检查、360/390px 及横屏实测和独立只读审查。

Ruling: 本页按钮通过共享 Button 的 children 显示文本 — 通用 Button 的移动端 label 会被隐藏，不能让此文字操作变成空按钮 — 代价是此处不使用 label 简写，仍复用全部按钮样式与交互。
