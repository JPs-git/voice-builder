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

纯渲染组件,零业务逻辑,只订阅 store 并渲染。挂载在 `AnalysisPage.tsx`(`<TipWidget />` 旁)。

**组件 API**

```tsx
export function Toast(): JSX.Element | null
```

无 props。内部通过 `useToastStore((s) => s.toasts)` 和 `useToastStore((s) => s.dismissToast)`
订阅,Zustand selector 保证只在 toasts 变化时重渲染。

**渲染行为**

- `toasts.length === 0` 时返回 `null`(不渲染 DOM)
- 否则渲染根容器 `<div className={styles.stack} aria-live="polite">`,内部每一条:
  ```tsx
  <div role="alert" className={`${styles.toast} ${toast.type === 'error' ? styles.error : ''}`}>
    <span className={styles.message}>{toast.message}</span>
    <button className={styles.close} onClick={() => dismissToast(toast.id)} aria-label="关闭提示">×</button>
  </div>
  ```
- `key={toast.id}` 复用现有 DOM;新 toast 通过 CSS 动画 `toast-in` 滑入

**视觉规范** — `Toast.module.css`

| 元素 | 规格 |
|---|---|
| 容器 `.stack` | `position: fixed; top: 24px; right: 24px; z-index: 50`,flex 纵向堆叠,`gap: 8px`,`max-width: 320px`,`pointer-events: none` |
| 单条 `.toast` | 白色面板(`--panel`),`--border` 边框,左边框 4px 主题色(`--info`),圆角 `--radius`,`--shadow-hover` 阴影,`pointer-events: auto` |
| error 变体 `.error` | 左边框改 `#E23E57`(与图表 F1 红色一致) |
| 消息 `.message` | `font-size: 13px`, `line-height: 1.5`, `color: var(--text)` |
| 关闭按钮 `.close` | 20×20 透明按钮,悬停 `#F3F4F6` 背景 + `--text` 前景 |
| 移动端 `@media (max-width: 768px)` | 容器 `top/right/left: 12px`,铺满宽度 |

全部 CSS 变量均取自 `css/style.css` 已有的 `--panel/--border/--info/--radius/--shadow-hover/--text` 等。

**无障碍**

- 容器 `aria-live="polite"`:新 toast 出现时屏幕阅读器播报,不打断用户
- 每条 `role="alert"`:语义化标识为提醒内容
- 关闭按钮带 `aria-label="关闭提示"`(无可见文字)

**交互**

- 自动消失:由 store 的 3s 定时器触发,组件本身不持有定时器
- 手动关闭:点击 `×` 调 `dismissToast(id)`

### WAV 魔数预校验 — `src/dsp/wav-parser.ts`

新增导出纯函数:

```ts
export function isWavFile(arrayBuffer: ArrayBuffer): boolean
```

校验 `RIFF`(0-3)+ `WAVE`(8-11)魔数,与 `parseWav` 的检查保持一致。

**原理**

魔数(magic number)是文件开头固定的标识字节序列,用作文件类型的"指纹"。WAV 属于 RIFF 容器格式,头部布局:

```
偏移 0-3:  "RIFF"   RIFF 容器标识
偏移 4-7:  文件大小 (小端 uint32,本函数不读取)
偏移 8-11: "WAVE"   具体容器格式
```

`isWavFile` 只在 `ArrayBuffer` 上创建 `Uint8Array` 视图(零拷贝),取字节 0-3 与 8-11 各转成 ASCII 字符串后逐一比较:

```ts
const uint8 = new Uint8Array(arrayBuffer, 0, 12)
const riff = String.fromCharCode(...uint8.subarray(0, 4))
const wave = String.fromCharCode(...uint8.subarray(8, 12))
return riff === 'RIFF' && wave === 'WAVE'
```

- **为什么双魔数?** `RIFF` 是通用容器(RIFF 家族还包括 `AVI `、`WEBP` 等),`WAVE` 才指明是音频;只查 `RIFF` 会把 AVI 视频误判为 WAV。
- **字节序无关:** 魔数字符串按字节顺序直接比较,不受小端/大端影响(字节序只影响偏移 4-7 的长度字段)。
- **与 `parseWav` 一致:** 使用与其开头两个断言 (`wav-parser.ts` 的 `Not a RIFF file` / `Not a WAV file`) 完全相同的检查,故校验通过后 `parseWav` 不会抛这两类错误。
- **边界:** `byteLength < 12` 直接返回 `false`,避免越界读取。

**为什么预校验而非仅靠 try/catch:** 提前拦截可给用户更具体的提示(「不支持的文件格式」),且避免对非 WAV 文件做无谓的完整解析。

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
