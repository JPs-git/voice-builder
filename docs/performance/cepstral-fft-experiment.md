# 倒谱数值 FFT 单变量实验（2026-10-01）

## 当前状态

倒谱 FFT 候选已实现并完成Redmi K70E固定PCM对比、本机正确性、测试、构建及独立审查。手机三段音频的倒谱模式平均计算总耗时降低94.0%–94.7%，1024点输入chunk计算时间P95从106.2–109.1ms降至5.5–5.6ms。九个音频/模式组合共2580帧（含flush）标量与完整频谱完全一致；另有845个独立倒谱窗口完全一致。

本轮验证的是DSP计算收益，尚不能确认实际录音图表的卡顿已解决。桌面结果单独列出：三段音频倒谱模式整段计算时间中位数降低91.7%–93.1%。本机十段音频、三种模式共8238帧及2696个独立倒谱窗口的输出也完全一致。

## 实验范围与版本

基线为3a93f1fc7d855941e43189a1b9fec0ae809448e1，已包含频谱 FFT 数值化和同帧基频去重。本候选仅改动 src/dsp/fft.ts 与 src/dsp/cepstral.ts：

- 新增 NumericFft，复用 Float64 实部、虚部，预计算位反转与三角因子，执行原地正/逆变换。
- 倒谱的正变换、逆变换、lifter后正变换使用同一数值工作区；仍保存 Float32 logMag 中间舍入。
- 每次清空输入及虚部，lifter清空对应区间的实部和虚部；返回包络拥有独立存储。

保留原 FFT 正角约定、逆变换归一化、预加重、Hamming、自然对数及1e-30下限、lifter区间、峰值插值、带宽及基频语义。分析窗800点、hop160点、16kHz采样率、pipeline调用流程保持原样。未修改LPC、频谱 FFT、图表调度或线程。

单一2048点工作区的数组总计约72KiB，缓存数量有界。这里没有测量浏览器实际峰值内存或GC改善。

冻结源码和测量 bundle 均保存SHA256；候选测量时尚未提交，不能仅凭HEAD识别候选。bundle目标为browser es2020，没有诊断计数插桩。

| 测量版本 | bundle SHA256 |
|---|---|
| 基线 | a77a1962dc2f38e55265ababf7cfee6dd69c9f21e815e69c67bce0cbe62fcee9 |
| 候选 | 0b0ab757bf1a312f2148cbdc5b63cae2f4b3dd3b39773bbd2f1c52de695b12b9 |

## 正确性与检查

固定PCM沿用前轮冻结文件与转换结果，包括aoe、a、o、e、i、u、yu及三段声区样本。解析、重采样不进入本轮测量。

- 十音频×hybrid/lpc/cepstral，共30场景、8238帧：F0、共振峰、voiced、register、confidence、时间及全部频谱Float32位模式完全相同，差异为0。
- 800点窗、160点hop的2696个独立倒谱调用，包括静音及省略knownF0参数的默认行为：F0、频率和带宽完全相同。
- NumericFft新增正角约定、正/逆参考对照、往返和尺寸检查；倒谱新增预热后不重复计算三角因子及工作区复用测试。先确认原实现失败，再验证候选通过。
- npm test：52文件、384测试通过；npm run build与npx tsc --noEmit通过。构建保留既有大bundle提示。
- 独立审查未发现重要问题；另对240个确定性输入（静音、脉冲、DC、交替值、正弦、随机及接近对数下限的幅度）逐点核对，包络和公开结果一致。

审查留下一个次要覆盖项：接近对数下限的旧版对照目前在独立实验中验证，尚未固化为仓库内的倒谱单测。现有单测覆盖FFT旧版参考，完整pipeline及独立倒谱对照保存在本机测量目录。

## 桌面计算测量

平台为Windows x64、Node v24.21.0。相同browser es2020 bundles在独立VM上下文运行；正确性验证结束后再串行计时，避免两项计算相互争用CPU。

每段音频、每种模式各测三批，顺序A/B、B/A、A/B；两版每批都新建pipeline，整段预热一遍，平滑开启，1024点chunk同步馈入，最后flush。计时仅含同步DSP计算与轻量计数，不包含采集、解码、状态发布、图表或实时音频等待。完整输出比较另跑，不计入性能采样。

下表为整段处理时间三批中位数（含flush），以及合并三批chunk用时的P95（不含flush），单位ms。分位数使用线性插值。

| 音频/模式 | 基线整段P50 | 候选整段P50 | 降低 | 基线chunk P95 | 候选chunk P95 |
|---|---:|---:|---:|---:|---:|
| aoe/cepstral | 5118.8 | 424.0 | 91.7% | 116.2 | 8.1 |
| a/cepstral | 2321.2 | 166.4 | 92.8% | 119.3 | 8.2 |
| yu/cepstral | 1488.2 | 102.2 | 93.1% | 118.0 | 8.0 |

hybrid与LPC的整段中位数变化约-5.2%至14.7%；短测存在噪声，且这些样本的hybrid多数走LPC，不能推广为普遍收益。LPC未被本候选改动。九个计时场景的逐帧输出都相同。

## 手机固定PCM测量

Redmi K70E（2311DRK48C）、Android15、Chrome125.0.6422.72，USB供电。系统在测试前后均确认Chrome在前台，九个场景的起止visibility都为visible且中途visibilitychange为0。测试前电池温度31.9℃，结束32.5℃；这是电池温度，不代表CPU温度或十分钟热机情况。

运行时检查测试页689位于 http://127.0.0.1:4173/，测试结束仍可见且未开启录音。CDP目标列表保留了该页先前的4174 URL，原始index因此记录旧URL；使用精确ID连接并核对运行时位置。页面仅作为计算容器，实际运行注入的两个已校验bundle，不使用页面自身DSP。

与桌面采用相同PCM、800点窗、160点hop、1024点chunk、每批新pipeline、整段预热及A/B、B/A、A/B顺序，关闭CPU profiler。逐帧对照与计时分开；下表整段耗时为三批平均值（含flush），chunk分位数合并三批、排除flush，单位ms。chunk数据混合有声和无声，另保存voicedChunkMs。

| 音频/模式 | 基线平均整段 | 候选平均整段 | 降低 | 基线chunk P95 | 候选chunk P95 |
|---|---:|---:|---:|---:|---:|
| aoe/hybrid | 331.9 | 289.1 | 12.9% | 6.7 | 6.0 |
| a/hybrid | 116.1 | 116.3 | -0.1% | 7.1 | 5.7 |
| yu/hybrid | 74.3 | 72.0 | 3.1% | 6.2 | 6.1 |
| aoe/lpc | 283.6 | 281.1 | 0.9% | 5.7 | 5.6 |
| a/lpc | 115.7 | 114.9 | 0.7% | 6.9 | 5.9 |
| yu/lpc | 72.8 | 74.1 | -1.8% | 6.1 | 6.6 |
| aoe/cepstral | 4628.3 | 275.4 | 94.0% | 107.6 | 5.5 |
| a/cepstral | 2102.1 | 112.8 | 94.6% | 109.1 | 5.6 |
| yu/cepstral | 1323.6 | 70.3 | 94.7% | 106.2 | 5.5 |

倒谱三场景的chunk P99从108.6–111.4ms降到5.6–6.9ms。本轮最大倒谱chunk分别为12.1、9.4、5.7ms。aoe/hybrid的P99从22.3ms降到7.2ms，与此前确认该样本包含少量倒谱回退的证据相符；a、yu的hybrid和未修改的LPC变化接近短测波动，不能把倒谱约94%的收益套用于默认hybrid整体。

每场景三批；批次P95/P99因样本很少不作为主要尾延迟证据，chunk合并样本数分别为aoe 282、a 78、yu 48。计时包含push/flush与轻量计数及采样开销；pipeline构造在计时外，首个push内的FrameProcessor初始化在计时内。没有模拟1024点输入之间的64ms实时等待。

验收另检查原始报告，而非仅看工具退出0：九场景全部valid、comparison.exactEqual和directCepstralProbeComparison.exactEqual为true；每版每批帧数、有声帧、有效F0/F1/F2计数均与独立正确性pass一致。排除flush后aoe为591帧/301有效有声F0帧，a为160/136，yu为94/88，均满足有声音频门槛。独立接口对三音频全部845个800点窗口逐一调用（省略knownF0），F0、峰数、频率和带宽差异都为0。

本轮选择的验收范围为手机固定PCM计算。真实麦克风、固定外放、图表刷新、十分钟热机、操作切换及目标低端手机仍未覆盖，不能据桌面或手机DSP数字宣称原始卡顿已解决。

## 复现与后续

本机原始数据及工具位于仓库根Git忽略目录：

`.superpowers/measurements/2026-10-01-cepstral-experiment/`

tooling/README.md记录构建、正确性和手机入口；correctness-summary.json、desktop-node-summary.json为汇总，self-test-report.json、direct-cepstral-report.json、desktop-node-nine-scenes.json保留详细数据，manifest保存源码与bundle身份。

手机数据保存在tooling/results/phone-nine-scenes和phone-direct-cepstral；audit-phone.mjs核对可见性、逐帧比较及timed counts，输出phone-summary.json。phone-environment.json保存独立设备状态，tests-final.log、build-final.log、types-final.log保存真机测试后的提交前检查。测量对象已清理，测试页保留。

本轮所选DSP实验验收已完成。下一步以最新DSP候选复测显示发布和主线程停顿；可先用手机固定PCM按实时节奏进入显示路径，延续用户暂缓外放/麦克风的选择，再补真实录音及热机。根据新证据决定显示调度或线程隔离，不把此前收益不明显的PR #45直接并入本实验。
