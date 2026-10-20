# 统计分析功能埋点规格

日期：2026-10-20  
状态：待评审；仅规格，尚未实现。  
范围：统计录音页、独立报告详情及其统一帮助入口。  
依据：[功能规格](2026-10-18-recording-statistics-design.md)、[现有匿名统计约定](../../analytics.md)。

## 1. 目标与范围

回答三个问题：用户是否使用统计分析、能否顺利生成报告、生成后是否查看和回放。录音与导入分别观察，保留横竖屏相同的业务口径。

沿用现有 Umami 封装及可选 Vercel 页面统计，不新增统计平台、后端、持久标识或界面。现有实时分析与音高参考事件保持兼容。以下是目标行为，不代表当前代码已支持。

当前缺口：`AnalyticsPage` 和 URL 白名单仅接受 `/`、`/practice`；统计录音、报告浏览与这些页面的帮助打开被过滤。录音会话与报告回放控制器目前没有接入业务事件。

本期不统计字号调整、短文切换、文章滚动、图表悬停、进度条拖动、单独的返回按钮点击。不增加历史列表或持久化；未来列表入口按新增功能扩展枚举。

## 2. 页面和 URL 规则

| 实际路由 | page | 上报路径 |
|---|---|---|
| `/` | `analysis` | `/` |
| `/practice` | `practice` | `/practice` |
| `/recording` | `recording` | `/recording` |
| `/reports/:reportId` | `report` | `/reports/detail` |

- 页面浏览仍由现有路由统计机制产生，不额外发送同义 pageview。保留现有前进、后退补偿，不能新增历史条目。
- 报告实际 ID、任意额外路径、查询参数、hash、动态标题不进入 payload；沿用现有允许的 UTM 参数和值过滤。`/reports/detail` 只是统计归一化路径，不新增产品路由。
- 有效和失效报告均归入报告页面浏览，是否可用由 `report_open` 区分。
- Umami 的 URL、站内 referrer，以及启用时的 Vercel 页面 URL 均须采用同一清理规则；保留现有原始 referrer 安全门禁和固定站点标题。
- 未知路由继续跳过；不能以添加报告路由为由放宽任意路径、属性或外部 URL 的白名单。

## 3. 属性字典

所有业务事件包含 `page`，只接受事件表声明的属性。

| 属性 | 允许值及定义 |
|---|---|
| `action` | `new / resume`；新录音、继续同一草稿 |
| `source` | `mic / import`；在边界层把内部 `file` 映射为 `import` |
| `duration_bucket` | `under_10s / 10_to_29s / 30_to_59s / at_limit` |
| `at_limit` | 字符串 `yes / no`；是否实际达到采样上限 |
| `attempt` | `initial / retry`；首次分析或失败后重新分析同一音频 |
| `stage` | `start / success / failure / cancel`；分析尝试阶段 |
| `entry` | `auto / latest / other`；本次自动跳转、查看上次结果、其他入口 |
| `availability` | `available / unavailable`；该报告能否从记录仓库读取 |

录制时长按已接收采样数除以采样率计算，包含静音，不包含暂停；导入时长按解码后的音频计算。分档边界为 `<10`、`10≤t<30`、`30≤t<60`；仅实际达到 60 秒采样上限记 `at_limit`，不能将界面四舍五入显示的 60 秒算到该档。不发送精确时长。

## 4. 事件字典和触发规则

### 4.1 录制

| 事件 | 属性（除 page 外） | 触发时机 |
|---|---|---|
| `record_start`（复用） | `action` | 新录音或继续录音启动成功，一次采集启动记一次 |
| `record_error`（复用） | `reason=permission/device/unsupported/unknown`、`action` | 启动或继续采集失败，一次尝试一次 |
| `recording_pause` | `reason=user/limit/navigation/interruption` | 有音频的草稿实际从采集进入暂停 |
| `recording_complete` | `duration_bucket`、`at_limit` | 暂停且存在有效音频时接受“完成录制”，开始生成分析任务之前 |
| `recording_cancel` | `target=capture/import/analysis`、`phase=requesting/recording/paused/importing/analyzing/error` | 用户主动执行丢弃当前任务或失败草稿的操作 |

以上录制事件的 `page=recording`。`record_start`、`record_error` 新属性只用于此页；原页面的事件结构和启动计数不变。

- 启动成功沿用音频引擎的成功契约；点击按钮、授权等待和失败均不算成功。若采样回调先于启动 Promise 返回，或此时已自动暂停，也只能记一次；已取消或过期的请求不得补发启动。
- 首次启动和继续共用 `record_start`，漏斗的开始节点只选 `action=new`。继续失败保留原草稿，不新增“完成录制”。
- `recording_pause` 仅在有已接收音频时记录；空请求取消、重复暂停、已暂停后离页不记录。
- 暂停原因在触发处明确传递：按钮=user；采样上限=limit；离开录音页=navigation；设备中断、采样率变化或采样超时=interruption。达到上限只记一次 limit，不再追加 user。
- 一段草稿可有多个暂停和继续事件；完成只能记一次。双击、禁用按钮、无音频完成和重试分析不再记完成。
- `recording_cancel` 名称覆盖录制、导入和分析的主动取消。prepared 状态重置、控制器销毁、路由卸载及旧任务被失效处理不记取消。失败后“重新准备”确实丢弃保留音频时记录 `phase=error`，target 按原音频来源为 capture 或 import。
- 导入或分析中离开页面，若业务任务仍继续，不记取消；录制中离页有音频时记录 navigation 暂停，无音频请求按现有业务规则取消，但不记用户主动取消事件。浏览器关闭不发送推测性取消。

### 4.2 导入和分析

| 事件 | 属性（除 page 外） | 触发时机 |
|---|---|---|
| `audio_import`（复用） | `result=success/failure`；failure 时 `reason=too_long/unsupported_or_corrupt/unknown` | 文件读取、解码和时长校验完成，或该流程失败 |
| `recording_analysis` | `stage`、`source`、`attempt`；start 时 `duration_bucket`；failure 时 `reason=unsupported/processing/unknown` | 每次分析尝试进入开始及终态 |

两类事件固定 `page=recording`。

- 取消文件选择、被 busy 守卫拒绝、主动取消导入不发送 `audio_import` 结果；用户已触发有效导入后取消，由 `recording_cancel` 表达。
- 导入 success 在解码与校验后、分析开始前发送。分析失败不能追加 `audio_import failure`；超长文件只报 import failure，不产生分析 start。
- 一次有效分析尝试恰好一个 start，最多一个终态 success/failure/cancel。失败后重试是独立尝试，`attempt=retry`，不再重复导入成功或完成录制。
- 只有报告成功发布到记录仓库才算分析 success。没有有效 F0 或样本不足但成功生成报告，仍算 success，不上传样本质量或声学结果。
- 主动取消正在进行的分析：`recording_cancel(target=analysis)` 与该尝试 `stage=cancel` 各一条，分别回答操作使用和尝试终态；看板不能相加当作两次取消。
- 已取消、销毁或被新任务替代的异步回调不可再报 success/failure。销毁可不发送终态，不能为了凑齐漏斗伪造用户取消。
- 暂停、录制中断和录音启动失败不是分析 failure；未启动分析不产生分析事件。
- 错误原因按可识别的错误类型或内部错误码映射到固定枚举，未知错误归 unknown，不依赖展示文案匹配，也不上传原始错误、堆栈或文件内容。

### 4.3 报告、回放和帮助

| 事件 | 属性（除 page 外） | 触发时机 |
|---|---|---|
| `report_open` | `entry`、`availability` | 一次路由进入报告详情并确定可用性后 |
| `playback_start`（复用） | 无 | 用户发起报告回放且音源实际启动成功 |
| `help_open`（复用） | `topic` | 统一帮助从关闭变为打开 |

- `report_open` 与回放 `page=report`；帮助 page 为入口所在页面。统计页默认主题 `recording-statistics` 沿用统一帮助主题白名单。
- 当前分析成功并导航到报告为 auto；“查看上次结果”导航为 latest；直接访问、前进/后退等无法证明是本次主动跳转的入口为 other。不从 referrer 猜测入口，不增加来源 URL 属性。
- entry 是本次导航动作的信息，不把历史条目中残留的 auto/latest 标记当作新的主动入口。内部可使用一次性内存导航上下文；历史恢复和独立详情不得依赖录制控制器。
- 每次实际路由进入记一条 report_open；切换到另一报告也是新进入。同次进入的 StrictMode effect 重放、重新渲染、横竖屏切换、帮助开关不重复记。
- 报告失效记 unavailable，不伪造 available 或回放事件；不发送实际报告 ID。
- 播放、暂停后继续、结束后重播成功都可记 playback_start；拖动进度条导致音源重建不记，暂停、自动停止与播放失败不记。统计为回放启动次数，不命名为完整听完次数。
- 帮助内部换主题不重复记；顶部菜单、标题旁图标和首次提示统一复用现有 help_open，本期不增加入口属性。

## 5. 文档级录音参与度

继续沿用现有 `practice_engaged`：同一文档的麦克风实际采样累计首次达到 30 秒时发一次。统计录音页的采样纳入同一累计器，不新建第二个计时器；导入、回放和暂停不累计。

阈值跨页面达到时，page 为收到跨阈值采样的当前有效页面；此前采样可能来自其他训练页。该事件只能解释为文档级录音参与度，不能用于声称“本次统计录音满 30 秒”。分析漏斗使用 recording_complete 的时长分档。

保持现有关闭统计期间不累计、不补发，以及刷新/新标签页重新计数的规则。

## 6. 异步归属、去重与隐私

- 业务事件在控制器实际状态转换或操作成功处触发，不由 Toolbar 和 RecordDock 分别上报；横竖屏只改变入口，不改变计数。
- 录音操作、分析尝试可使用当前任务的内部 generation/token 去重；只存内存，不发送 token、报告 ID、访客 ID，不新增持久 ID。
- 分析开始时固定一个经内部映射得到的安全上下文：page=recording、URL=/recording。用户切到实时分析或报告后，终态仍使用此上下文；不能读取当时 location 把事件归到其他页面，也不能因当前页不同而过滤掉。
- 只有声明支持的任务事件可使用该上下文，不能给任意调用者传任意 URL/page 的通道；其他交互使用发生时页面。业务终态事件不得额外制造录音页 pageview。
- 延续现有总开关、域名、生产环境、DNT、停用偏好、发送前过滤、失败隔离、最多 20 条/30 秒内存队列规则。不补发停用期间事件，不落盘，不绕过拦截。
- 保留原始事件发生时间和当时安全 URL；延迟队列在发送前仍检查统计是否启用。新封装不能改变实时分析与音高参考原有归属。
- 禁止发送：音频/片段/采样数组、文件名、短文正文/标题、自由说话内容、精确时长、F0/中位数/P10/P90/直方图、有效发声比例、原始错误/堆栈、动态路由 ID 和任意未声明属性。

## 7. 看板口径

1. 录音漏斗：录音页访客 → record_start(action=new) → recording_complete → recording_analysis(stage=success, source=mic) → report_open(availability=available)。
2. 导入漏斗：audio_import(result=success, page=recording) → recording_analysis(stage=success, source=import) → 可用报告访问。
3. 可靠性：麦克风失败分类、分析尝试终态次数、失败后 retry 使用、limit 暂停后完成情况。
4. 报告使用：可用报告访问人数、回放人数、latest 入口使用；report_open 不代表用户阅读完成。

漏斗使用同一时间范围和匿名访客/会话口径；重复事件次数不可直接相除当作访客转化率。pause/resume 与 retry 会重复发生，须按筛选条件解释。未完成且无取消事件不等于主动放弃。

首期不发送跨事件任务标识，因此上述是匿名访客/会话层面的趋势漏斗，不能精确关联同一段录音、同一报告或单次尝试的全链路；导入漏斗末端报告访问也无法证明对应某个导入任务。分析终态可按次数观察，但无终态可能来自关闭页面、网络或拦截，不能直接计算为失败。重试导致的最终成功与首次成功不得混称首次分析成功率。

## 8. 验收

### 自动验证

- 扩展事件类型、运行时属性白名单、路由/referrer 清理及未知输入测试；检查 Umami 与可选 Vercel 均不泄漏报告 ID。
- 新录音 → 暂停 → 继续 → 暂停 → 完成 → 成功：两个 record_start、两个 user pause、一次 complete、一对分析 start/success、一个可用 auto report_open。
- 达到 60 秒只暂停一次，完成后才分析；无音频完成和连续点击不产生重复事件。
- 授权拒绝/取消授权等待/过期回调/设备中断分别验证；不得把请求取消报失败或补发启动。
- 导入成功、超长、损坏、文件选择取消、读取中取消，以及分析失败重试分别验证事件顺序和数量。
- 分析中主动取消只产生规定的两个不同语义事件；旧回调、销毁、prepare 重置不伪造新终态或主动取消。
- 分析中切换页面后 success/failure 仍归属 recording，用户当前位置不被改变，也不新增 pageview。
- 页面前进/后退、报告更换、StrictMode 和横竖屏切换验证 report_open 去重；失效详情验证 unavailable。
- 回放成功/继续/重播上报；拖动进度、失败、停止不报；帮助开关和内部换主题沿用已有口径。
- 录音参与度与旧页面共用一次累计，统计页采样纳入；导入与回放不累计。
- 开关、DNT、队列过期、脚本失败、网络异常和发送抛错均不得影响录制、分析、报告与回放。
- 实现完成后执行 npm test、npm run build、npx tsc --noEmit、git diff --check。

### 正式环境验收

开发及 Preview 继续不上报；使用测试替身验证业务事件，不为本地验证放宽门禁。正式发布后在已配置的正式域名抽查页面浏览、事件及 payload：新旧页面无重复，报告 ID 和声学数据不出网，切页后的分析归属正确。正式平台验收需发布后另行执行，本规格不代表已完成线上验证。

## 9. 实施范围和文档维护

预计涉及 analytics 封装与文档、会话控制器、报告导航及进入逻辑、回放控制器、采样参与度入口和对应回归测试。DSP 算法、统计范围、报告内容、UI 和录制流程不因埋点改变。

实现时同步更新 `docs/analytics.md` 的页面、事件字典、属性和指标口径；本次不将目标行为写成该文档的已上线行为。无需新依赖；不用更新平台额度、价格或套餐说明。
