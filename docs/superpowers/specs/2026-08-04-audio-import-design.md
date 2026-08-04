# 支持 MP3 / M4A 等压缩音频导入

## 问题

当前仅支持 WAV 导入:`AnalysisPage` 文件选择框 `accept=".wav"`,工具栏按钮文案「导入 WAV」,
`useAnalysis.handleFileChange` 对非 WAV 文件直接报「不支持的文件格式」。

MP3 / M4A 是压缩格式,需要先解码为原始 PCM float(与 `parseWav` 输出同构)才能进入现有 DSP 管线。

## 方案

不限制格式,由浏览器决定可解码格式。核心:WAV 保留现有快速解析路径,
非 WAV 用 Web Audio API `decodeAudioData` 解码。所有格式解码后统一为 `Float32Array + sampleRate`,
下游 DSP / 回放零改动。

### 新增 `src/audio/audioDecoder.ts`

```ts
export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
  numChannels: number
}

// 超长错误:导入前预检发现时长 > 10s 时抛出
export class AudioTooLongError extends Error {}

// 元数据预检:仅加载 container 头部,不完整解码,不占主线程
// file: 原始 File/Blob;el 可注入便于测试,默认 new Audio()
// timeoutMs: 超时兜底,防止元数据加载永不触发事件导致导入流程卡死
export function probeAudioDuration(
  file: Blob,
  el: HTMLAudioElement = new Audio(),
  timeoutMs = 15000,
): Promise<number>

// WAV 头探针:仅读前 maxBytes 字节计算时长,>10s 在全量读入前中断
// 头部不可解析时返回 null,调用方回退到全量解析(由 commitImport 兜底)
export async function probeWavDuration(
  file: Blob,
  maxBytes = 256,
): Promise<number | null>

// 纯函数:从 WAV 头 DataView 计算时长(data chunk size / byteRate),不可解析返回 null
export function wavDurationFromHeader(view: DataView): number | null

// 完整解码:decodeAudioData → getChannelData(0)
// context 可注入便于测试,默认 getAudioEngine().audioContext
export function decodeAudioFile(
  arrayBuffer: ArrayBuffer,
  context: AudioContext = getAudioEngine().audioContext,
): Promise<DecodedAudio>
```

**`probeAudioDuration` 实现**

```
url = URL.createObjectURL(file)
el.preload = 'metadata'
el.src = url
await loadedmetadata 或 onerror(拒绝)
duration = el.duration
URL.revokeObjectURL(url)
```

- 只触发浏览器解析容器元数据,不触发完整解码 → **大文件在此中断,不浪费内存、不占线程**
- 超时兜底:`timeoutMs` 内未触发 `loadedmetadata`/`onerror` 则 revoke URL、中止元素加载并 reject,保证 `finally` 必然执行、`isImporting` 不会卡死
- 依赖 `getAudioEngine()`(来自 `src/ts`)的 `audioContext` 做完整解码;该 context 已在 `AudioEngine` 中按 16000 惰性创建

**`decodeAudioFile` 实现**

```
buffer = await context.decodeAudioData(arrayBuffer)
return { samples: buffer.getChannelData(0), sampleRate: buffer.sampleRate, numChannels: buffer.numberOfChannels }
```

- 双声道只取第 0 声道,与现有 `parseWav`(只读第一个声道)行为一致
- 浏览器返回的原生采样率(如 44.1k)或已被重采样到 16k,均由现有 `Resampler` 统一处理

### `src/hooks/useAnalysis.ts` 改动

`handleFileChange` 重构,按顺序提前中断:

```
if (!file) return

// 只读前 12 字节判断魔数,不加载整个文件
head = await file.slice(0, 12).arrayBuffer()

if (isWavFile(head)):
    duration = await probeWavDuration(file)                 // 只读前 256B 头,提前查时长
    if (duration !== null && duration > 10) throw AudioTooLongError   // 大 WAV 在全量读入前中断
    buf = await file.arrayBuffer()
    stopRecording(false)
    parsed = parseWav(buf)                                  // WAV 快速路径
    if (parsed.numChannels > 1) toast(info, "双声道提示")
    samples = resample if rate !== 16000
else:
    stopRecording(false)
    duration = await probeAudioDuration(file)               // 先查时长
    if (duration > 10) throw AudioTooLongError              // 大文件在此中断,不解码
    buf = await file.arrayBuffer()
    decoded = await decodeAudioFile(buf)
    if (decoded.numChannels > 1) toast(info, "双声道提示")
    if (decoded.sampleRate !== 16000) resample

// 以下两路径共用:
maxSamples = 16000 * 10
if (samples.length > maxSamples) throw AudioTooLongError    // 兜底(与现逻辑一致)
config = useAppStore.getState().config                       // 快照
frames = AnalysisPipeline.analyze(samples, 16000, ...)
recordingBuffer.clear(); recordingBuffer.write(samples)
useAppStore.getState().clearFrames(); setFrames(frames)
dataSourceRef.current = 'file'; setDataSource('file')
frameOffsetRef.current = 0
```

**双声道提示文案**(`info` toast):「该音频为双声道,仅使用第 0 声道进行分析」

**重复导入保护**:新增本地 `isImporting` 状态,解码期间忽略再次 `onImport`,避免并发。

### UI 改动

- `src/routes/AnalysisPage.tsx:107` — `accept=".wav"` → `accept="audio/*"`
- `src/hooks/useToolbar.ts:104` — 按钮文案「导入 WAV」→「导入音频」

### 错误消息映射

`importErrorMessage` 新增分支(WAV 原有文案不变):

| 异常 | 用户提示 |
|---|---|
| `AudioTooLongError` | 音频不能超过 10 秒,请裁剪后重试 |
| 元数据 `onerror` / `duration` 读取失败 | 无法读取音频信息,请检查文件 |
| `decodeAudioData` 抛 DOMException | 浏览器不支持该音频格式或文件已损坏,请尝试 wav/mp3/m4a |
| 其他 | 导入失败,请检查文件后重试 |

### 测试

- `src/__tests__/audioDecoder.test.ts`(jsdom project)
  - `probeAudioDuration`:注入 fake `HTMLAudioElement`(手动触发 `loadedmetadata`),验证返回时长、`URL.revokeObjectURL` 调用、onerror 分支、超时兜底(超时 reject 并 revoke / 中止加载)
  - `wavDurationFromHeader` / `probeWavDuration`:合成 WAV 头,验证时长计算、空 data chunk、data 超出切片返回 null、非 RIFF / 零 byteRate 返回 null
  - `decodeAudioFile`:注入 fake `AudioContext`(`decodeAudioData: vi.fn()`),验证样本/采样率/声道数提取、解码失败分支
- `src/__tests__/useAnalysis.test.ts`(jsdom project)
  - mock `audioDecoder` 与 `parseWav`,验证:
    - WAV 走 `probeWavDuration` → `parseWav` 路径
    - WAV `probeWavDuration` 返回 > 10s → 提前抛 `AudioTooLongError`,不读全量、不 parse、不解码
    - WAV 头不可解析(`null`)→ 回退全量解析
    - 非 WAV 走 `probeAudioDuration` → `decodeAudioFile` 路径
    - `probeAudioDuration` 返回 > 10s → 抛 `AudioTooLongError` 且不调用 decode
    - `numChannels > 1` → toast store 出现双声道 info 条目
- 既有 wav-parser / praat 回归测试不受影响

### 范围

- 仅新增压缩音频导入 + 10s 提前中断 + 双声道提示
- 不引入第三方解码库,不新增依赖
- 不改动 `parseWav` / DSP 管线
