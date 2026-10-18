# 匿名使用统计

Voice Builder 使用 Umami Cloud 了解访问来源及功能使用情况。应用保持纯前端架构，录音、音频导入和声音分析在浏览器本地处理。统计故障不会阻止这些操作。

## 自行部署与正式配置

自行部署默认不启用统计。复制 `.env.example` 为 `.env.local` 可配置本地构建，但开发服务器、localhost、回环地址和未匹配的域名不会加载统计脚本。不要在开源仓库提交个人环境文件。

| 构建变量 | 默认值 | 作用 |
|---|---|---|
| `VITE_ANALYTICS_ENABLED` | `false` | 两个统计渠道的总开关，精确值 `true` 才启用 |
| `VITE_VERCEL_ANALYTICS_ENABLED` | `false` | 是否保留过渡期 Vercel 页面统计；仍受总开关控制 |
| `VITE_UMAMI_WEBSITE_ID` | 空 | Umami 网站 Tracking code 中的 Website ID；为空或格式无效时不加载 Umami |
| `VITE_UMAMI_DOMAINS` | `voice.starbow.top` | 允许的正式域名，逗号分隔；精确匹配 hostname，不支持通配符 |

正式接入步骤：

1. 在维护者的 Umami Cloud 账户添加网站，核对 Tracking code 使用官方 `https://cloud.umami.is/script.js`。选择符合维护者需要的数据区域，保留后台私有。
2. 在 Vercel **Production** 范围填写 Website ID 和正式域名，并将总开关设为 `true`。过渡期如需与原有 Vercel Analytics 对照，也将 Vercel 开关设为 `true`。
3. Preview、Development 范围保持关闭。Vite 的生产构建标志不能单独区分 Preview，因此另有开关和域名限制。
4. 重新构建、部署，才能应用环境变量的修改。Website ID 是公开的采集标识，不是管理密钥；任何 Cloud API key、账户密码或数据库凭证都不能进入 `VITE_*`。

不要求开通付费试用或新增后端、数据库、统计代理。部署此分支但不配置开关时，现有 Vercel Analytics 也会关闭。

## 用户控制与收集边界

用户可在“关于 → 匿名使用统计”立即关闭 Umami 与 Vercel 的后续上报，当前录音不会停止、清空或刷新。偏好保存在本机 `voicebuilder-analytics-disabled`，同源标签页会同步。已经发出的请求不能撤回。

尊重浏览器 `Do Not Track=1`，不会用界面开关覆盖。读取本机偏好失败时默认关闭；无法写入偏好时，本次文档仍应用用户选择，但刷新后可能需要重新设置。首次关闭时不加载统计脚本；加载后关闭时通过发送前检查停止新的事件。

不发送录音、音频片段、文件名、原始错误或堆栈、音高、共振峰、声区、命中率、训练目标和个人身份信息。不调用 `identify()`，不创建持久访客 ID，不启用回放、热图或自动性能采集。

Umami 默认采集的技术维度包含浏览器、系统、设备、语言、屏幕及粗略地区等。服务器仍需接收网络请求；“录音本地处理”不代表“网站没有向统计服务发送信息”。

URL 只允许 `/`、`/practice` 及 `utm_source`、`utm_medium`、`utm_campaign`、`utm_content`，UTM 值仅保留 1–64 个英文字母、数字、下划线、连字符。其他参数、hash、动态标题和未声明的事件属性不会发送。站外 referrer 只保留 origin，站内 referrer 也经过 URL 过滤。未知页面跳过统计。

## 事件字典

页面浏览由 Umami 自动记录首次加载与路由导航，不手工重复发送。下面六类业务事件均带 `page: analysis | practice`，只附带表内白名单属性。

| 事件 | 统计含义 | 额外属性 |
|---|---|---|
| `record_start` | 成功启动或继续录音一次 | 无 |
| `record_error` | 录音启动失败 | `reason: permission / device / unsupported / unknown` |
| `practice_engaged` | 本次文档累计录音首次达到 30 秒 | 无 |
| `playback_start` | 音频实际开始回放 | 无 |
| `audio_import` | 导入处理结果；取消选文件不记录 | `result: success / failure`；失败另附 `reason: too_long / unsupported_or_corrupt / unknown` |
| `help_open` | 从关闭状态打开帮助；内部换主题不重复记录 | `topic: quick-start / charts / targets / audio / troubleshooting / pitch-reference` |

30 秒以实际收到的麦克风采样数量除以采样率累计，包括静音；不是页面停留时间，也不是有效发声、练习完成或训练效果。暂停、继续、清空、换页面都不重置累计；刷新、新标签页或重新打开网站重新计数。关闭统计期间的采样不计入，不补发关闭期间的事件。它与 Umami visit 的划分不同。

录音缓冲只保留最近 10 秒，参与度累计独立于该缓冲；上报只包含达到阈值的事件，不包含声音内容或累计采样数组。

脚本慢加载时仅在内存缓冲最近 20 条业务事件，超过 30 秒的事件丢弃；保留触发时的安全路由与时间。脚本错误或关闭统计会清空队列，本次文档不自动重试、不落盘。网络错误和广告拦截可能造成漏报，不绕过用户拦截。

## 看板、来源与指标口径

首期建立“进入网站 → record_start → practice_engaged”的录音漏斗，再看回放/导入覆盖、录音错误分类和来源/设备差异。使用同一范围与匿名访客口径的漏斗人数，不能拿重复的事件次数直接相除。打开帮助不代表存在问题或看懂了说明，需要结合后续行为判断。

新的 B 站链接可使用：

```text
https://voice.starbow.top/?utm_source=bilibili&utm_medium=comment&utm_campaign=voice_training&utm_content=bv14zgh6uedv
```

链接参数标记渠道和投放位置，不填写用户名或个人资料。UTM 可能被外部应用去掉，因此不能只靠 referrer 或 UTM 解释所有来源。

默认匿名标识按月轮换，并受网络、浏览器变化影响。30 天访客数不能直接命名为有效练习 MAU，也不承诺精确的跨月留存或跨设备人数。需要时使用发生 practice_engaged 的匿名访客作为明确标注口径的参与人数。

截至 2026-10-18，Umami Cloud Hobby 为每月 100,000 个计量事件、1 个网站、6 个月数据保留；页面浏览、自定义事件及保存的每个自定义事件属性均计入额度。需要保留更久的历史时，在保留期内定期从后台导出；以账户当前用量页和官方定价为准。

## 验收与回滚

- 自动验证：`npm test`、`npm run build`、`npx tsc --noEmit`、`git diff --check`。
- Preview 验证两个脚本都未加载；录音、回放、导入及横竖屏帮助继续正常。
- 正式域名验证首次访问与路由切换每次仅一条 Umami pageview，业务事件对应实际结果；检查 payload 没有音频、文件名、声音分析数据、任意查询参数或 hash。
- 验证关闭统计后两个渠道均不再上报；刷新后仍关闭、DNT、脚本被拦截与断网均不影响音频功能。大陆移动网络及桌面浏览器的采集稳定性必须实际验证。
- 过渡期观察一至两周，比较趋势，不要求两个平台的绝对人数相同。之后可设 `VITE_VERCEL_ANALYTICS_ENABLED=false` 并重新部署，保留 Umami。
- 回滚统计：设 `VITE_ANALYTICS_ENABLED=false` 并重新部署。业务数据无需迁移。紧急回滚至接入前版本会恢复该版本原本的 Vercel inject，不受新开关控制，需要另外核对 Vercel Web Analytics 设置。

## 官方参考

- [SPA 与自动路由统计](https://docs.umami.is/docs/guides/track-single-page-apps)
- [Tracker 配置：域名、DNT、before-send](https://docs.umami.is/docs/tracker-configuration)
- [事件、自定义 payload 与时间戳](https://docs.umami.is/docs/tracker-functions)
- [访客指标定义](https://docs.umami.is/docs/metric-definitions)
- [定价与计量](https://umami.is/pricing)
- [Cloud 数据导出](https://docs.umami.is/docs/cloud/export-data)
