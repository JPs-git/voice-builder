# Umami Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 建议在当前会话内顺序实施；本计划本身不启动实施、开通账户或发布。

**Goal:** 保持 Voice Builder 的纯前端架构，以 Umami Cloud 统计来源、功能使用和录音参与度，让维护者能够定位首次使用过程中的流失。

**Architecture:** 在 React 挂载前初始化一个幂等、非阻塞的统计模块，由 Umami 自动记录页面访问，业务成功或失败边界发送六类事件。统计模块统一负责环境和域名限制、用户关闭偏好、URL 清理和失败降级；录音参与度只累计采样数量，不接触或传送音频内容。过渡期保留现有 Vercel Analytics，两者共用关闭偏好。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、现有 @vercel/analytics；使用 Umami 官方浏览器脚本，不增加运行时 npm 依赖。

**Spec:** 本文“接入范围与统计口径”章节，依据本对话中的可行性分析及用户“制定接入计划”的要求；用户已授权按此计划开始实施。

## 基线与工作区

- 日期：2026-10-18，Asia/Shanghai。
- 本地已知 `origin/master`：`610a2f9`，版本 1.17.0，包含 PR #50 的横竖屏帮助与首次使用体验。未在本轮重新获取远端状态；实施前重新同步 master。
- 文档分支：`docs/umami-integration-plan`。
- 文档 worktree：`C:/Users/Administrator/Projects/voice-builder/.worktrees/docs/umami-integration-plan`。
- 实施时从最新 master 创建 `feat/umami-analytics`，worktree 使用 `.worktrees/feat/umami-analytics`；将本计划复制到该 worktree 的相同仓库相对路径，随功能 PR 保存。一个功能分支对应一个 PR，base 为 master，建议标题 `feat(analytics): add lightweight Umami tracking`。
- 实施基线：2c84ad6，版本 1.17.1；2026-10-18 已获取最新 origin/master 并创建 feat/umami-analytics worktree。Tasks 1–4 的代码与自动验证已完成；578 项测试、生产构建和类型检查通过，账户配置与生产验收尚未执行。

## Global Constraints

- 保持纯前端 + Vercel 部署；不增加业务后端、数据库、登录系统或统计代理。
- 首版使用 Umami Cloud，默认匿名识别；不调用 `identify()`，不创建持久访客 ID，不开启回放、热图或自动性能采集。
- 不发送录音、音频片段、文件名、原始错误消息、堆栈、F0/F1/F2、命中率、声区、训练目标或用户身份信息。
- 浏览器、设备、语言、屏幕和粗略地区等 Umami 默认技术维度需在统计说明中披露；不宣称“完全没有向第三方发送数据”。
- 只有生产构建、显式开关开启、精确域名匹配且用户未关闭统计时才允许采集；Preview 不配置开启开关。
- 同一个“匿名使用统计”开关同时控制 Umami 和现有 Vercel Analytics；关闭后不再发送新的统计请求，已经发出的请求无法撤回。
- 统计脚本、存储或网络失败不得改变录音、分析、导入、播放的结果，不 await 上报，不显示统计错误 Toast。
- 页面浏览由 Umami 自动记录；不在 React effect 中重复调用无参 `track()`；初始化在 StrictMode 树外且幂等。
- 主 checkout 常驻干净 master；分支、worktree、PR 和 Squash 合并遵守 AGENTS.md。合并前必须 `npm test`、`npm run build`、`npx tsc --noEmit` 全过。

## Review Focus

1. Vite preview 同样是生产构建、fork 可能复制环境变量：必须同时检查显式开关和精确 hostname；测试见 Task 1。
2. 脚本慢加载、失败、Promise 拒绝、StrictMode 重复执行：有界缓冲、无未处理异常、不重复加载；测试见 Task 1。
3. 隐私模式存储报错、用户在录音中关闭统计、URL 带私密参数：安全停止采集、不中断音频、过滤两个统计渠道；测试见 Task 1/4。
4. 录音窗口仅保留 10 秒、暂停再继续、不同采样率：参与度独立累计，准确跨过 30 秒且只报一次；测试见 Task 2/3。
5. WAV 快速分支和压缩音频分支、取消文件选择、多个帮助入口：结果事件各报一次、取消不报、所有入口口径一致；测试见 Task 3。

## 接入范围与统计口径

### 事件契约

所有事件都有一个 `page: 'analysis' | 'practice'` 属性，分别对应 `/` 和 `/practice`，触发时读取当前路由。其他路径不发送业务事件。下面列出的属性之外不透传上下文对象。

| 事件 | 唯一触发位置 | 额外属性 |
|---|---|---|
| `record_start` | `useAnalysis.onRecord` 中 startCapture 成功且初始化采集状态后；每次成功开始/继续各一次 | 无 |
| `record_error` | startCapture 失败处理分支 | `reason: 'permission' | 'device' | 'unsupported' | 'unknown'` |
| `practice_engaged` | 当前文档生命周期内，允许统计期间收到的麦克风采样累计首次达到 30 秒 | 无 |
| `playback_start` | `usePlayback.play` 中 source.start() 成功后 | 无 |
| `audio_import` | WAV 或压缩音频导入完成，或进入导入失败处理分支 | 成功：`result: 'success'`；失败：`result: 'failure', reason: 'too_long' | 'unsupported_or_corrupt' | 'unknown'` |
| `help_open` | `AppShell.openHelp` 让帮助从关闭变为打开时 | `topic: HelpTopic`，复用现有六个主题枚举 |

- 录音错误分类：NotAllowedError/SecurityError → permission；NotFoundError/NotReadableError/AbortError → device；NotSupportedError → unsupported；其余 → unknown。不上报 DOMException.message。
- 导入错误分类：AudioTooLongError → too_long；DOMException 及现有 importErrorMessage 识别的格式/损坏错误 → unsupported_or_corrupt；其余 → unknown。只提取分类，不发送提示文本或文件扩展名。
- 用户停止录音、授权仍在等待、空数据回放、取消选文件、帮助内部换主题都不产生对应的成功/打开事件。
- `practice_engaged` 是“累计录音参与度”，包含静音，不等于有效发声、练习完成或训练改善。以 chunk.length / rate 累计，不能用页面计时器、分析帧数量或 10 秒循环缓冲长度。
- 去重单位明确为当前页面文档：停止/清空/换路由后继续累计且不重复触发；刷新、新标签页或重新打开网站重新开始。不是跨页面刷新维持的 Umami visit。
- 关闭统计期间的采样不计入参与度；重新开启只继续之前允许统计期间的累计量，不补发关闭期间的事件。

### 配置、偏好与发送策略

- `.env.example` 提供 `VITE_ANALYTICS_ENABLED=false`、`VITE_VERCEL_ANALYTICS_ENABLED=false`、`VITE_UMAMI_WEBSITE_ID=`、`VITE_UMAMI_DOMAINS=voice.starbow.top`。
- 正式部署显式将全局开关、过渡期 Vercel 开关设为 true；Umami ID 从账户获得，不在计划中编造。域名清单使用逗号分隔、去空格后精确比较，不允许通配符、后缀匹配、localhost、127.0.0.1。需要增加正式域名时显式配置。
- Umami 脚本地址固定为该 Cloud 网站官方 Tracking code 中的 HTTPS 地址，在实施时核对；不提供任意脚本地址输入框或通用插件系统。
- `VITE_*` 是公开构建配置，Website ID 不是管理凭证；前端绝不能包含 Cloud API key、账户密码或数据库凭证。本地 `.env.local`/`.env.*.local` 加入忽略规则，保留 `.env.example`。
- 用户偏好键 `voicebuilder-analytics-disabled`，值 `'true'` 表示关闭；默认开启但仍服从配置、环境和 DNT。初始化读取一次并保存内存状态；读取存储失败时关闭采集。后续切换先更新内存状态，写入失败时当前文档仍立即应用，并说明偏好可能无法跨刷新保存。监听 storage 事件同步同源标签页。重新开启时幂等调用 initAnalytics，无需刷新；本次文档已加载失败的脚本仍不自动重试。
- 尊重 navigator.doNotTrack === '1'；DNT 开启时不加载两个脚本，界面说明由浏览器设置关闭，不能用界面开关覆盖。
- 初始化前注册 `window.voiceBuilderAnalyticsBeforeSend`，用 Umami `data-before-send` 再检查当前偏好并清理 payload；设置 `data-domains`、`data-do-not-track="true"`、`data-exclude-hash="true"`。不开启 data-exclude-search，因为需要保留经过白名单清理的 UTM。
- URL 仅保留 `/`、`/practice` 与 `utm_source`、`utm_medium`、`utm_campaign`、`utm_content`。UTM 值只接受 `/^[a-z0-9_-]{1,64}$/i`；丢弃其他查询参数和 hash。站内 referrer 同样清理；站外 referrer 只保留 origin；title 固定为项目现有标题。未知页面不发送，不退化为原始 URL。
- 业务属性通过事件类型约束并在运行时按白名单重新构造；不得展开 error、File、store 或音频对象。Vercel 通过现有包的 beforeSend 同步检查偏好并清理 URL。
- Umami 加载期间业务事件最多内存缓冲 20 条，超过丢最旧；超过 30 秒的待发事件丢弃，成功 onload 后只清空发送一次。onerror/关闭统计时立即清空；失败后本次文档不自动重试、不持久化、不补发历史。
- 缓冲时保存触发时的安全 URL/路由和时间；发送时使用自定义 payload 的 name/data/url/timestamp，防止慢加载期间换路由导致事件归到错误页面或时间。timestamp 使用 Unix 秒。只有 SDK 存在且配置允许时发送。
- Umami track 同步抛错或异步拒绝都吞掉；不承诺广告拦截或断网下的事件必达，也不尝试绕过用户拦截。

### 展示与分析

- 关于弹窗加入“匿名使用统计”复选框和短说明：“用于了解页面访问和功能使用情况。录音和声音分析数据只在本机处理，不发送给统计服务。过渡期使用 Umami 和 Vercel Analytics。”
- 提示开关立即生效；DNT 或存储限制时给出简短状态说明。关闭统计不能清空录音、重新挂载 App 或刷新页面。
- 首期看“进入网站 → 成功录音 → 累计录音 30 秒”的漏斗、回放/导入的使用覆盖、录音错误原因，以及来源与设备差异。
- 转化率使用同一时间范围、同一匿名访客口径的漏斗人数，不能用事件次数相除。30 天访客数不直接命名为有效练习 MAU；默认匿名标识按月轮换，不承诺精确跨月留存或跨设备人数。
- 新的 B 站分发链接使用 `utm_source=bilibili&utm_medium=comment&utm_campaign=voice_training`；可加 `utm_content=bv14zgh6uedv` 区分投放位置。这里只约定格式，不代发评论。

## 独立审查后的兼容修正

- 当前 Vercel 脚本单独读取 document.referrer，其 beforeSend 不能修改该字段：仅在原始 referrer 已符合清理规则时启用 Vercel，否则该文档仅使用 Umami。代价是 Vercel 对这类来源的访问漏计；不以放宽隐私约束换取完整计数。
- index.html 提前设置 referrer=origin，防止同源请求的 HTTP Referer 头携带当前页路径和查询参数。已用真实浏览器的生产资源请求验证，不只检查 payload。
- 当前 Umami Cloud 脚本未监听 popstate：保留自动页面统计，增加同 URL、同 state 的 replaceState 补偿，同步 SDK 内部路由缓存且不新增历史条目。供应商脚本更新后需要复查此行为。
- 新增六项回归用例，观察失败后修复；最终 578 项测试、默认关闭/显式开启两种生产构建和类型检查通过。本地浏览器已验证偏好保留、键盘操作及来源头。
- 无延后的次要代码问题。Cloud 账户、生产部署、看板入库和大陆网络稳定性仍待正式配置与上线后验收；目前不提供生产效果保证。

## 文件职责

| 文件 | 职责 |
|---|---|
| 新增 `src/analytics/analytics.ts` | 事件类型、初始化、配置门禁、偏好、过滤、有界发送；封装现有 Vercel inject |
| 新增 `src/analytics/practiceProgress.ts` | 纯采样时长累计器及文档生命周期实例 |
| 修改 `src/main.tsx`、`src/vite-env.d.ts`、`index.html` | 在挂载前接入初始化；补齐环境变量和 window 类型 |
| 修改 `src/hooks/useAnalysis.ts`、`src/hooks/usePlayback.ts` | 在既有业务边界调用事件与累计器 |
| 修改 `src/routes/AppShell.tsx` | 在统一 openHelp 入口记录帮助打开 |
| 修改 `src/components/AboutModal.tsx`、其 CSS Module | 说明和关闭统计入口 |
| 新增 `.env.example`、`docs/analytics.md`；修改 `.gitignore`、`README.md` | 配置、事件字典、指标口径、上线/关闭/回滚操作 |
| 新增/扩展下列任务中的测试 | 验证真实失败模式与业务结果，不做逐行镜像测试 |

## Task 1: 统计基础、隐私过滤与环境隔离

**Files:** Create `src/analytics/analytics.ts`, `src/__tests__/analytics.test.ts`, `.env.example`; modify `src/main.tsx`, `src/vite-env.d.ts`, `.gitignore`。

**Interfaces:**
- 产生 `AnalyticsPage = 'analysis' | 'practice'` 和 `AnalyticsEventMap`，精确对应事件契约。
- 导出 `initAnalytics(): void`、`track<K extends keyof AnalyticsEventMap>(name: K, data: AnalyticsEventMap[K]): void`、`getAnalyticsPage(): AnalyticsPage | null`。
- 导出 `isAnalyticsAllowed(): boolean`、`getAnalyticsDisabled(): boolean`、`setAnalyticsDisabled(disabled: boolean): void`、`subscribeAnalyticsPreference(listener: () => void): () => void`。allowed 包括全局环境/域名/偏好/DNT，不依赖 Umami ID；缺 ID 只关闭 Umami。
- 在 src/vite-env.d.ts 声明四个 VITE 配置、Umami tracker 和 before-send hook；tracker 支持事件自定义 payload，返回 `void | Promise<unknown>`。

- [x] 先写上述接口的失败测试，覆盖 Review Focus 1/2/3；使用 vi.stubEnv、受控 location/storage、模拟 script load/error 与 tracker，不连接真实服务。关键断言包括：

```ts
expect(document.querySelectorAll('script[data-website-id]')).toHaveLength(1) // 重复 init
expect(() => track('record_start', { page: 'analysis' })).not.toThrow()
expect(window.voiceBuilderAnalyticsBeforeSend('event', payload)).toBe(false) // 关闭后
expect(vercelBeforeSend({ type: 'pageview', url: location.href })).toBeNull() // 同步关闭
```

- [x] 运行 `npx vitest run --project unit src/__tests__/analytics.test.ts`，确认因功能缺失失败，再实现接口和配置。
- [x] 让 main.tsx 只调用 initAnalytics；移除原先直接的 inject()，由新模块在允许时调用 `inject({ beforeSend })`。注册隐私 hook 必须先于加载 Umami。
- [x] 补足并通过：开发/Preview/后缀伪装域名不加载、缺 ID 不影响 Vercel、SDK 慢加载期间换路由仍保留原 URL/时间、20 条上限/30 秒过期、load 不重复发送、error 清队列、Promise 拒绝无 unhandledrejection、DNT、storage 读写报错和跨标签关闭。
- [x] 用包含 `?token=secret&utm_source=bilibili#private` 的 payload 验证只保留允许的 UTM；原始错误/文件/store 额外字段不会透传，未知路由取消发送。两个渠道都检查。
- [x] 运行同一测试命令和 `npx tsc --noEmit`，通过后提交 `feat(analytics): add guarded analytics initialization`。

## Task 2: 定义可验证的累计录音参与度

**Files:** Create `src/analytics/practiceProgress.ts`, `src/__tests__/practiceProgress.test.ts`。

**Interfaces:**
- 消费 Task 1 的 isAnalyticsAllowed、track 和 getAnalyticsPage。
- 导出 `createPracticeProgress(onEngaged: () => void): (sampleCount: number, sampleRate: number) => void`，用于独立验证累计行为。
- 导出 `recordPracticeSamples(sampleCount: number, sampleRate: number): void`，持有当前文档的单个累计器；只在允许采集且页面已知时累计。阈值回调发 practice_engaged。

- [x] 先写边界与重复测试；关键断言使用独立新累计器：

```ts
const reached = vi.fn()
const add = createPracticeProgress(reached)
add(16000 * 10, 16000)
add(48000 * 19, 48000)
expect(reached).not.toHaveBeenCalled()
add(48000, 48000)
add(16000 * 60, 16000)
expect(reached).toHaveBeenCalledTimes(1)
```

- [x] 运行 `npx vitest run --project unit src/__tests__/practiceProgress.test.ts` 确认失败，再实现累计器。拒绝非有限数、非正采样率、非正或非整数 sampleCount；持续累加秒数，以累计秒数 + 1e-9 >= 30 判断阈值，避免浮点累计导致恰好 30 秒漏触发。
- [x] 覆盖 29.999 秒未触发、恰好/跨过 30 秒触发、无效参数不污染累计、不同采样率、关闭期间样本不计入，以及达到阈值后 no-op。实例不保存音频或分析帧。
- [x] 同一测试命令通过后提交 `feat(analytics): measure cumulative recording engagement`。

## Task 3: 将六类事件接入实际业务边界

**Files:** Modify `src/hooks/useAnalysis.ts`, `src/hooks/usePlayback.ts`, `src/routes/AppShell.tsx`, `src/__tests__/FirstUseHelpExperience.test.tsx`; create `src/__tests__/analyticsFlows.test.tsx`（集中业务埋点测试）；原有音频测试继续作为回归验证。

**Interfaces:** 消费 Task 1 的 track/getAnalyticsPage 与 Task 2 的 recordPracticeSamples；不改变现有 hook 的返回值、AudioEngine 接口或 ShellContext。

- [x] 先扩展现有业务测试并模拟 analytics 模块，断言事件顺序和业务状态：成功授权后 record_start 一次；拒绝时只有 record_error；停止/等待中再次点击不报 start；发送失败时原音频状态仍正确。
- [x] 运行 `npx vitest run --project unit src/__tests__/useAnalysis.test.ts src/__tests__/useAnalysis.test.tsx src/__tests__/usePlayback.test.ts src/__tests__/FirstUseHelpExperience.test.tsx`，确认新增断言因缺事件失败。
- [x] 在 startCapture 成功分支与错误处理分支发送分类事件；在 onAudioChunk 中仅向 recordPracticeSamples 传 chunk.length 和 rate，不传 chunk。停止、清空和换路由不重置文档累计器。
- [x] 在共用 commitImport 成功出口记录 audio_import success，在 handleFileChange catch 记录 failure；保证 WAV 的提前 return 不漏报也不重复。不得在打开文件选择器时记录 success。
- [x] 在 source.start() 成功后记录 playback_start；在统一 openHelp 中、仅 helpOpen 为 false 时记录 help_open。帮助中的 onTopicChange 不算重新打开；工具栏、更多菜单、上下文帮助和首次使用横幅均复用统一入口。
- [x] 补足 Review Focus 4/5 的集成断言：10 秒窗口反复覆盖仍能累计到 30 秒；暂停/清空继续、路由切换后不重复；WAV 和压缩音频各一条 success；too_long 分类；取消文件选择零事件；空回放零事件；横竖屏各帮助入口每次打开恰好一条且保留正确 topic。
- [x] 同一测试命令及 `npx tsc --noEmit` 通过后提交 `feat(analytics): instrument recording playback import and help`。

## Task 4: 用户控制、运营文档与发布验收

**Files:** Modify `src/components/AboutModal.tsx`, `src/components/AboutModal.module.css`, `README.md`; create `src/__tests__/AboutModal.test.tsx`, `docs/analytics.md`。

**Interfaces:** 关于弹窗通过 Task 1 的偏好接口订阅状态；不新增全局应用 store，不把偏好写入 voicebuilder-presets。

- [x] 先写可访问性与状态测试：带“匿名使用统计”标签的复选框可用键盘切换；切换调用 setAnalyticsDisabled；重开弹窗保留状态；storage 事件更新界面；DNT 和存储失败显示对应说明。运行 `npx vitest run --project unit src/__tests__/AboutModal.test.tsx` 确认缺功能失败。
- [x] 实现本文确定的说明和复选框；关闭立即清待发队列并阻止后续 Umami 与 Vercel 请求，不关闭录音、不清空数据、不触发刷新。录音中关闭的行为加入业务集成测试，验证 startCapture/stopCapture 调用次数与原音频结果保持一致。
- [x] 同一测试命令通过；docs/analytics.md 记录事件字典、30 秒口径、匿名身份局限、来源链接约定、配置步骤、关闭偏好、失败降级、六个月保留与定期导出、回滚方案。README 链接该文档，说明自行部署默认不采集。
- [x] 实施者按顺序运行 `npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`，均通过后提交 `feat(analytics): add privacy controls and setup documentation`。
- [ ] 创建 PR 并附上测试与手工验收记录，base master，Squash 合并；生产开关仍保持关闭直到准备好 Cloud 配置和上线授权。

## 账户配置与生产验收清单

以下为执行阶段清单。本轮不创建账户、不更改 Vercel 配置、不发布。

- [ ] 使用维护者的 Umami Cloud 账户添加网站；记录 Website ID、官方脚本 HTTPS 地址、正式域名和所选数据区域。保持后台私有，不开启公开统计链接，不启用付费试用。
- [ ] 在 Vercel 的 Production 范围配置上述四个变量；Preview/Development 保持关闭。不在前端填写管理 API key。构建变量变更需要重新部署才生效。
- [ ] 预览部署检查两个统计脚本均未加载；录音、回放、导入、横竖屏帮助正常。自动化测试模拟 tracker，预览环境不发送生产事件。
- [ ] 经授权上线后，在正式域名验证首次加载和 `/` ↔ `/practice` 每次导航只有一条 Umami pageview；六类业务事件的数量、分类和属性符合本文契约。
- [ ] 检查真实 Network payload 没有音频、文件名、原始错误、训练数据、任意查询参数或 hash；UTM 来源仍能识别。
- [ ] 在统计开启、关闭、刷新后仍关闭、DNT、拦截脚本、断网等状态下检查功能；关闭后不再产生新的两个渠道的上报请求。
- [ ] 以大陆移动网络和桌面浏览器实测脚本/上报；记录漏报或延迟，不以开发机的成功替代覆盖验证。
- [ ] 在后台建立录音漏斗、错误分类和来源/设备对照视图。过渡观察一至两周，只对比趋势，不要求 Vercel 与 Umami 的绝对人数一致。
- [ ] 观察结束后按数据是否足够决定关闭 Vercel 过渡开关；这是后续运营决定，不在接入 PR 中提前移除依赖。需要保留超过六个月的历史时，保留期内定期导出。
- [ ] 回滚优先将 VITE_ANALYTICS_ENABLED=false 并重新部署；紧急时回滚到上一部署。功能不依赖统计服务，回滚无需迁移业务数据。若回退到接入前版本，其原有 Vercel inject 不受新开关控制，应明确验证并按需关闭 Vercel Web Analytics。
- [ ] 合并后先保留必要文档记录，按 AGENTS.md 删除已合并功能分支并移除对应 worktree；未合并的文档分支不能使用强制删除清理。

## 官方依据（2026-10-18 核实）

- [SPA 接入与避免重复 pageview](https://docs.umami.is/docs/guides/track-single-page-apps)
- [域名限制、DNT、发送前过滤](https://docs.umami.is/docs/tracker-configuration)
- [事件、自定义 payload 与 timestamp](https://docs.umami.is/docs/tracker-functions)
- [访客标识轮换与指标定义](https://docs.umami.is/docs/metric-definitions)
- [事件额度、属性计量与数据保留](https://umami.is/pricing)
- [Cloud 数据导出](https://docs.umami.is/docs/cloud/export-data)

Vercel beforeSend 接口已核对当前仓库安装的 @vercel/analytics 类型定义与实现；本计划不依赖新增的 SDK 能力。
