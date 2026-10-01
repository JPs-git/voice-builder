# 基频去重固定音频实验（2026-10-01）

## 结论

以已优化频谱FFT版本作为对照，移除同一帧的重复基频估计后，Redmi K70E固定PCM测试中：
- hybrid三段音频的平均计算总耗时降低23.8%–28.1%；
- LPC降低26.3%–28.0%；
- 倒谱模式仅降低2.1%–2.5%，其单个1024点输入批次P95仍为104.7–107.8ms。
- 九个音频/算法组合逐帧F0、F1–F4、voiced、register、confidence、时间及全谱逐值比较均一致。测试实际覆盖了有声帧，并非静音复测。

这验证了DSP中的计算收益，不能等同于录音图表帧率改善。用户本轮选择先做手机端固定音频计算；真实麦克风、外放声学条件、十分钟录音热机及目标低端机验证尚未执行。

## 改动与对照身份

沿用 fix/fft-allocation worktree。基线冻结在当前基频改动之前，已包含上一轮频谱FFT优化；候选仅新增如下产品改动：
- extractFormants、extractFormantsCepstral新增第四个可选knownF0参数。
- undefined保持独立调用时自行检测的旧行为；number/null使用调用方已算出的结果。
- pipeline的LPC、倒谱及两个hybrid回退调用均传入同帧f0。

窗长、分析步长、算法、静音处理、图表逻辑和线程不变。FFT工作数组与返回频谱所有权保持上一轮设计。

tooling/*manifest.json保存冻结源码与候选实际源码/bundle的SHA256，不能仅用尚未包含改动的原HEAD90ac031识别实验版本。正常bundle不包含诊断计数，计数另建副本并单独运行。

## 环境与测试方式

Redmi K70E，Android15，Chrome125；USB远程调试。手机前台测试页689，localhost:4173。页面只作为独立DSP运行容器，使用注入的独立bundle，不使用页面自身旧DSP。bundle目标es2020，关闭CPU profiler完成耗时比较。

固定读取仓库assets/aoe.wav、a.wav、yu.wav，经冻结baseline的WAV解析/重采样预转换为16kHz PCM。转换不计入测量；源WAV和PCM哈希、长度均保存到fixtures/manifest.json。

采用真实pipeline的800点窗、160点hop，按1024点chunk同步馈入。每次新建pipeline以隔离状态，开启平滑，末尾flush；每版预热一遍，三组交替A/B、B/A、A/B。录音回调之间的64ms等待没有模拟，这是不按实时速度馈入的DSP计算基准；没有执行麦克风、解码、状态存储、图表绘制及线程传输。

正常计时包含生产算法及轻量帧计数，每chunk测时；逐帧全量结果对照另跑，不混入主计时。保存平均整段处理时间和所有三组chunk用时分位数；总耗时包含尾部flush，chunk分位数不含flush。本工具使用线性插值分位数，与先前轻量RAF脚本的取序统计方法不同，不能混淆。

各场景开始/结束visible，visibilitychange事件为空，validity.valid=true。USB供电；测试前电池温度31.9℃，末尾32.6℃（不代表CPU温度），未进行长期温度跟踪。

## 三组汇总

B为FFT候选基线，C为FFT候选加基频去重。耗时单位ms。

| 固定音频 | 模式 | B平均总耗时 | C平均总耗时 | 降低 | B chunk P95 | C chunk P95 |
|---|---|---:|---:|---:|---:|---:|
| aoe | hybrid |426.3|324.8|23.8%|8.4|5.9|
| a | hybrid |155.8|112.1|28.1%|8.0|6.0|
| yu | hybrid |99.6|72.2|27.5%|8.2|6.2|
| aoe | lpc |376.0|277.2|26.3%|7.8|5.7|
| a | lpc |156.5|114.7|26.7%|9.1|6.7|
| yu | lpc |99.5|71.6|28.0%|8.1|5.9|
| aoe | cepstral |4668.4|4551.3|2.5%|107.6|104.7|
| a | cepstral |2117.6|2064.1|2.5%|111.9|105.6|
| yu | cepstral |1362.2|1333.3|2.1%|110.7|107.8|

排除flush后的输入帧：aoe 591帧中301帧有有效F0；a为160/136；yu为94/88。检测分布两版相同。hybrid多数走LPC，本测试不能覆盖所有实际人声触发回退的频率。

64ms是1024点/16kHz的名义输入批间隔，不是每台浏览器实际采集承诺。倒谱P95超过该预算提示有声批次可能造成积压，仍需实际录音验证。hybrid的较低计算耗时不包含UI负担，不能据此宣称稳定30或60fps。

## 单独计数诊断

插桩副本统计实际函数调用；这轮不产生可用于吞吐评价的时间数字。

| 音频/模式 | 有声帧（含flush） | B detectPitch | C detectPitch | 倒谱调用 |
|---|---:|---:|---:|---:|
| a/hybrid |137|274|137|0|
| aoe/hybrid |302|607|302|3|
| a/cepstral |137|274|137|137|
| aoe/cepstral |302|604|302|302|

候选每个有声帧一次基频检测；原版通常两次，hybrid回退额外一次。此证据也覆盖了真实fixture中的少量hybrid回退。

## 剩余热点的独立CPU采样

对正常candidate bundle单独采样，两次aoe/cepstral计算：1192帧，604有声帧；CPU profile约9.77秒。此轮不用于前后耗时对比。

主要self样本：cepstralEnvelope 2.17s；esbuild生成的字段初始化辅助函数__defNormalProp 2.01s；complexFft 1.17s；ifft 1.12s；Complex构造1.02s；GC0.70s；unityRoot0.50s。JIT内联会把子操作成本记在父函数，不能把这些数字当作精确的单项算法耗时，也不能由GC推断某类对象分配数量。

结合倒谱正/逆/正三次2048点旧Complex变换的源码，支持下一项独立实验优化倒谱FFT数值计算及工作数组；无需先假定Worker能解决总计算负担。此profile是纯倒谱模式，不代表默认hybrid的常见占比。

## 补齐800点FFT独立基准

停止麦克风状态下，原版FFT与优化FFT对固定800点双频信号做同手机A/B/B/A/A/B测试，各预热50次，每轮100次。原版三轮合计247.3ms，优化版33.8ms；固定输入所有Float32输出bin最大差0dB。

这是额外的独立FFT计算测量，包含其自身构建/JIT条件，不与昨天400点数字跨日期求提升率，也不能作为整条录音性能验收。

## 自动化检查与审查

- 新合同测试先在原代码失败：传入number/null未生效、pipeline未传已算结果；实现后全部通过。
- npm test：50文件、377测试通过。
- npm run build、npx tsc --noEmit通过；构建仍有既有大bundle提示，测试有既有错误分支/act警告。
- 独立代码审查无critical/important发现；minor：专门的单测尚未覆盖pipeline null传播和两个hybrid回退各自的入口，现有源码检查及固定fixture对照覆盖了部分回退。

## 本机复现

原始数据、冻结源码、工具及profile：
.superpowers/measurements/2026-10-01-pitch-experiment/

tooling/README.md包含构建、固定PCM采样、独立计数和自测命令。tooling/results/phone-suite/保存九场景结果、每批用时、逐帧数值与频谱指纹；全谱逐值比较在手机执行并保存比较结论。profile导入可使用candidate-cepstral.cpuprofile。这些大型原始数据位于Git忽略目录。

复用时重新核对当前手机、Chrome目标及前台状态；不要把本次689用于其他页面。该工具用于DSP实验，不能替代真实麦克风/图表端到端测试。

## 后续

本轮已完成基频去重及所选固定PCM验证范围。下一项计算实验建议数值化倒谱FFT，保留正负号、逆变换归一化、Hamming、自然对数、Float32中间舍入、lifter、峰值定位及带宽计算。继续以基频去重候选为基线，单变量对照。

随后结合实际录音数据决定显示调度及线程隔离优先级。真实mic、固定外放、十分钟热机、低端目标设备和交互场景仍待补齐。
