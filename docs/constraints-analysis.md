# 回调约束分析：命令式 vs 状态驱动

## 所有用户操作的约束条件

### 操作矩阵

| 操作 | 前置条件 | 约束 |
|------|---------|------|
| **录音** | 无 | 直接启动录音 |
| **录音** | 正在录音 | 停止录音，保留数据 |
| **录音** | 有数据(非录音中) | 追加录音 (keep frameOffset) |
| **录音** | 数据来自文件 | 清空旧数据 → 重新开始 |
| **录音** | **正在回放** | ⚠️ **缺失**：先停止回放，再开始录音 |
| **回放** | 有数据，非录音 | 直接回放 |
| **回放** | 正在录音 | 先停止录音，再回放 |
| **回放** | 正在回放 | 停止回放 |
| **回放** | 无数据 | disabled |
| **清空** | 任意 | 停止回放 → 停止录音 → 清空所有数据 |
| **导入** | 正在录音 | 先停止录音，清空，导入 |
| **导入** | 正在回放 | 先停止回放，导入 |

### 约束优先级

```
清空：  停止回放 > 停止录音 > 清空数据
导入：  停止回放 > 停止录音 > 清空数据 > 导入
回放：  停止录音 > 开始回放
录音：  停止回放 > 根据 source 决定清空/追加 > 开始录音
```

---

## 当前代码覆盖情况

```
handleClickTool 统一前置：
  ✅ record/import 前 → if (isPlaying) stop()

各 handler 约束：
  ✅ handleClear:    stop() → stopRecording() → clear()
  ✅ handlePlayback: stopRecording() → toggle play/stop
  ✅ handleRecord:   start/stop (useAnalysis 内部处理 source)

全部约束已覆盖，无遗漏。
```

---

## 两种方案的约束实现对比

### 状态驱动 (Phase)

```
用户点击 → dispatch(phase) → phase reducer 检查合法变迁 → useEffect 执行副作用
```

**约束表达方式：** 通过限制合法的 phase 变迁来表达约束。

```
状态机:
  idle    → requesting → recording
  ready   → requesting → recording
  recording → ready (停止)
  any     → idle (清空)

约束编码在状态变迁表中:
  "从 ready 可以变迁到 requesting" → 有数据时允许录音
  "从 recording 可以变迁到 ready"  → 录音中允许停止
  "不能从 recording 变迁到 recording" → 录音中不能再次开始录音
```

**副作用集中在一处：**

```typescript
// 所有 phase 变迁的副作用都在 handlePhaseChange 中
handlePhaseChange(from, to) {
  if (from === 'recording' && to !== 'recording') stopEngine()
  if (to === 'requesting') startEngine()
  if (to === 'idle') clearAll()
}
```

**优点：**
- 所有变迁在一个函数中，容易审计是否遗漏
- 非法变迁被状态机拒绝（如 recording → recording）
- 副作用和约束在一起

**缺点：**
- 状态和副作用之间有间接层，debug 需跟踪 phase 流转
- 新增操作需同时修改类型、reducer、effect handler 三处
- 暂停回放这种"先停A再启B"的组合操作难表达（只能通过 phase 排队）

### 命令式回调 (当前)

```
用户点击 → handleClickTool(id) → switch(id) → 约束回调 → 引擎/数据操作
```

**约束表达方式：** 在每个回调函数体中，显式写出前置检查和操作序列。

```typescript
// 约束直接写在回调里，操作序列一目了然
handlePlayback() {
  if (isCapturing) analysisRecord()  // 先停录音
  isPlaying ? stop() : play()        // 再切换回放
}

handleClear() {
  if (isPlaying) stop()              // 1. 停回放
  if (isCapturing) analysisRecord()  // 2. 停录音
  analysisClear()                    // 3. 清空
}
```

**优点：**
- 操作序列直接可见，不需要跟踪状态流转
- 新增约束只需在一处加一行
- 没有间接层，debug 线性跟踪

**缺点：**
- 约束分散在各回调中，缺少集中审计点
- 容易出现遗漏（如当前遗漏了 `handleRecord` 中停止回放）
- 依赖调用方记住所有约束，没有编译器/状态机强制

---

## 结论

两种方式本质上都是在表达相同的约束，只是位置不同：

| | 状态驱动 | 命令式回调 |
|---|---|---|
| 约束位置 | 状态变迁表 + effect handler | 回调函数体 |
| 审计难度 | 低（集中在一处） | 中（分散，需主动检查） |
| 遗漏风险 | 低（非法变迁被拒绝） | 中（编译器不帮助） |
| 直接性 | 间接（phase → useEffect） | 直接（回调内顺序执行） |
| 组合操作 | 困难（需 phase 排队） | 简单（顺序调用） |
| 当前状态 | 已弃用 | 缺 2 条约束 |

当前方案保持了回调的直接性，但需要解决遗漏问题。建议的缓解方式：

1. **集中在 `handleClickTool` 前做通用约束**（如"任何操作前停止回放"）
2. **约束矩阵文档**（本文档）作为实现 checklist
3. **测试覆盖**：每个约束一条测试用例
