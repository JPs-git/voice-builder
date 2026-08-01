# WAV 导入错误反馈 + Toast 通知组件

## 问题

文件选择框 `accept=".wav"` 仅是文件选择器的筛选提示,用户仍可选择任意文件。
`useAnalysis.handleFileChange` 调用 `parseWav`,非 WAV 文件会抛出异常,
但 `catch` 块仅 `console.error`,用户无任何反馈(静默失败)。

## 方案

新增一个通用的 Toast 通知组件,并让 WAV 导入/录音错误通过它反馈给用户。

### Toast store — `src/store/toastStore.ts`

遵循现有 appStore 模式(Zustand,直接 `getState().action()` 可测)。

```ts
interface Toast {
  id: number
  type: 'error' | 'success' | 'info'
  message: string
}
```

- `showToast(type, message)` — 追加一条,setTimeout 3s 后自动 dismiss
- `dismissToast(id)` — 手动关闭
- 顶层固定栈,最多同时显示 4 条

### Toast 组件 — `src/components/Toast.tsx` + `Toast.module.css`

- 订阅 store,右上角 fixed 定位(视觉参考 TipWidget 的 fixed + CSS 变量)
- error 类型用红色系视觉区分,每条带关闭按钮
- 挂载在 `AnalysisPage.tsx`(`<TipWidget />` 旁)

### WAV 魔数预校验 — `src/dsp/wav-parser.ts`

新增导出纯函数:

```ts
export function isWavFile(arrayBuffer: ArrayBuffer): boolean
```

校验 `RIFF`(0-3)+ `WAVE`(8-11)魔数,与 `parseWav` 的检查保持一致。

### `src/hooks/useAnalysis.ts` 改动

`handleFileChange`:
1. `parseWav` 前魔数预校验失败 → `showToast('error', '不支持的文件格式,请选择 .wav 文件')` 并提前 return
2. `catch` 块按 `err.message` 映射为友好中文提示(见下)
3. 10s 超限的 `alert()` 改为 `showToast('error', ...)`

`onRecord` 的 catch 也改为 toast:「无法启动录音,请检查麦克风权限」。

### 错误消息映射

| parseWav 抛错 | 用户提示 |
|---|---|
| `Not a RIFF file` / `Not a WAV file` | 格式不支持 |
| `fmt chunk not found` / `data chunk not found` | 文件已损坏 |
| `Unsupported bitsPerSample` | 不支持的编码(仅支持 8/16/24/32 位 PCM) |
| 其他 | 导入失败 |

### 测试

- `src/__tests__/toastStore.test.ts` — 直接测 show/dismiss/自动超时(vi.useFakeTimers)
- `src/__tests__/dsp/wav-parser.test.js` — `isWavFile` 合法/非法/空 buffer
- `src/__tests__/AnalysisPage.test.tsx` 或 useAnalysis 测试 — 导入非法文件 → toast store 出现错误条目

### 范围

- 仅新增 toast 通知 + WAV 导入/录音错误反馈
- 不引入第三方 toast 库
- 不改动 parseWav 本身
