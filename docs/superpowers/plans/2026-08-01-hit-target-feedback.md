# 命中目标区间反馈系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time feedback card that shows green "完美" when F0/F1/F2 all hit their target ranges, or orange deviation hints (e.g. "F0偏低") otherwise, via an extensible evaluator registry.

**Architecture:** Each feedback type is a pure function `FeedbackEvaluator = (ctx) => FeedbackResult | null` registered in `src/feedback/index.ts`. A `useFeedback()` hook subscribes to `appStore` (latestFrame, bands) and runs all evaluators. `FeedbackCard` (in `src/components/`) is a pure renderer of `FeedbackResult[]`, placed in the right-side panel of `AnalysisPage` opposite `TargetPresetBar`.

**Tech Stack:** TypeScript, React 18, Zustand (via `useAppStore`), Vitest + @testing-library/react (jsdom project), CSS Modules.

---

## File Structure

- **Modify** `src/types/index.ts` — add `FeedbackStatus`, `FeedbackResult`, `FeedbackContext`, `FeedbackEvaluator`
- **Create** `src/feedback/hitRate.ts` — `evaluateHitRate` pure function
- **Create** `src/feedback/index.ts` — `FEEDBACK_EVALUATORS` registry + `useFeedback()` hook
- **Create** `src/__tests__/hitRate.test.ts` — unit tests for `evaluateHitRate`
- **Create** `src/__tests__/useFeedback.test.tsx` — hook tests against real store
- **Create** `src/components/FeedbackCard.tsx` + `src/components/FeedbackCard.module.css`
- **Create** `src/__tests__/FeedbackCard.test.tsx` — component render tests
- **Modify** `src/routes/AnalysisPage.tsx` — render `<FeedbackCard />`
- **Modify** `src/routes/AnalysisPage.module.css` — right-side panel layout + mobile stack

**Important:** `evaluateHitRate` includes a `hasData` guard (all values null → return null) because the naive loop would otherwise report "完美" when every formant is null.

---

### Task 1: Add feedback types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Append at the end of the file:

```ts
export type FeedbackStatus = 'hit' | 'miss' | 'idle'

export interface FeedbackResult {
  id: string
  label: string
  status: FeedbackStatus
  message: string
}

export interface FeedbackContext {
  latestFrame: AnalysisFrame | null
  bands: TargetBands
}

export type FeedbackEvaluator = (ctx: FeedbackContext) => FeedbackResult | null
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(feedback): add feedback types"
```

---

### Task 2: evaluateHitRate evaluator (TDD)

**Files:**
- Create: `src/feedback/hitRate.ts`
- Test: `src/__tests__/hitRate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/hitRate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateHitRate } from '../feedback/hitRate'
import { VOWEL_PRESETS } from '../types'
import type { FeedbackContext, AnalysisFrame } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function makeCtx(overrides: {
  f0?: number | null
  f1?: number | null
  f2?: number | null
}): FeedbackContext {
  const frame: AnalysisFrame = {
    time: 0.1,
    f0: overrides.f0 ?? null,
    f1: overrides.f1 ?? null,
    f2: overrides.f2 ?? null,
  }
  return {
    latestFrame: frame,
    bands: {
      f0: { range: vowelA.f0, color: '#10B981' },
      f1: { range: vowelA.f1, color: '#3B82F6' },
      f2: { range: vowelA.f2, color: '#F59E0B' },
    },
  }
}

describe('evaluateHitRate', () => {
  it('returns null when no latest frame', () => {
    const ctx = makeCtx({})
    ctx.latestFrame = null
    expect(evaluateHitRate(ctx)).toBeNull()
  })

  it('returns null when all formants are null', () => {
    expect(evaluateHitRate(makeCtx({}))).toBeNull()
  })

  it('returns hit with "完美" when all in range', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    const result = evaluateHitRate(makeCtx({
      f0: mid(vowelA.f0[0], vowelA.f0[1]),
      f1: mid(vowelA.f1[0], vowelA.f1[1]),
      f2: mid(vowelA.f2[0], vowelA.f2[1]),
    }))
    expect(result).toEqual({
      id: 'hit-rate',
      label: '目标区间',
      status: 'hit',
      message: '完美',
    })
  })

  it('reports F0偏低 when below lower bound', () => {
    const result = evaluateHitRate(makeCtx({
      f0: vowelA.f0[0] - 50,
      f1: (vowelA.f1[0] + vowelA.f1[1]) / 2,
      f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toContain('F0偏低')
  })

  it('reports F2偏高 when above upper bound', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      f1: (vowelA.f1[0] + vowelA.f1[1]) / 2,
      f2: vowelA.f2[1] + 100,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toContain('F2偏高')
  })

  it('merges multiple hints with space separator', () => {
    const result = evaluateHitRate(makeCtx({
      f0: vowelA.f0[0] - 50,
      f1: vowelA.f1[1] + 200,
      f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
    }))
    expect(result?.status).toBe('miss')
    expect(result?.message).toBe('F0偏低 F1偏高')
  })

  it('ignores null formants without false negatives', () => {
    const result = evaluateHitRate(makeCtx({
      f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
      f1: null,
      f2: null,
    }))
    expect(result).toEqual({
      id: 'hit-rate',
      label: '目标区间',
      status: 'hit',
      message: '完美',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/hitRate.test.ts`
Expected: FAIL — `Cannot find module '../feedback/hitRate'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/feedback/hitRate.ts`:

```ts
import type { FeedbackContext, FeedbackResult } from '../types'

const KEYS = ['f0', 'f1', 'f2'] as const

export function evaluateHitRate(ctx: FeedbackContext): FeedbackResult | null {
  const { latestFrame, bands } = ctx
  if (!latestFrame) return null

  const hints: string[] = []
  let hasData = false
  let allHit = true

  for (const k of KEYS) {
    const v = latestFrame[k]
    const range = bands[k].range
    if (v == null || !Number.isFinite(v)) continue
    hasData = true
    if (v < range[0]) {
      allHit = false
      hints.push(`${k.toUpperCase()}偏低`)
    } else if (v > range[1]) {
      allHit = false
      hints.push(`${k.toUpperCase()}偏高`)
    }
  }

  if (!hasData) return null
  if (allHit) {
    return { id: 'hit-rate', label: '目标区间', status: 'hit', message: '完美' }
  }
  return { id: 'hit-rate', label: '目标区间', status: 'miss', message: hints.join(' ') }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/hitRate.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/feedback/hitRate.ts src/__tests__/hitRate.test.ts
git commit -m "feat(feedback): add evaluateHitRate evaluator"
```

---

### Task 3: useFeedback hook (TDD)

**Files:**
- Create: `src/feedback/index.ts`
- Test: `src/__tests__/useFeedback.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/useFeedback.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedback } from '../feedback'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1, f2 }])
}

describe('useFeedback', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('returns empty array with no data', () => {
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toEqual([])
  })

  it('returns hit result when all in range', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('hit-rate')
    expect(result.current[0].status).toBe('hit')
    expect(result.current[0].message).toBe('完美')
  })

  it('reacts to latestFrame updates', () => {
    const { result } = renderHook(() => useFeedback())
    expect(result.current).toEqual([])

    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    act(() => {
      setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
    })
    expect(result.current).toHaveLength(1)
    expect(result.current[0].status).toBe('miss')
    expect(result.current[0].message).toBe('F2偏高')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/useFeedback.test.tsx`
Expected: FAIL — `Cannot find module '../feedback'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/feedback/index.ts`:

```ts
import { useAppStore } from '../store/appStore'
import type { FeedbackEvaluator, FeedbackResult } from '../types'
import { evaluateHitRate } from './hitRate'

export const FEEDBACK_EVALUATORS: FeedbackEvaluator[] = [
  evaluateHitRate,
]

export function useFeedback(): FeedbackResult[] {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  return FEEDBACK_EVALUATORS
    .map(fn => fn({ latestFrame, bands }))
    .filter((r): r is FeedbackResult => r !== null)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/useFeedback.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/feedback/index.ts src/__tests__/useFeedback.test.tsx
git commit -m "feat(feedback): add useFeedback hook with evaluator registry"
```

---

### Task 4: FeedbackCard component (TDD)

**Files:**
- Create: `src/components/FeedbackCard.tsx`
- Create: `src/components/FeedbackCard.module.css`
- Test: `src/__tests__/FeedbackCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/FeedbackCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackCard } from '../components/FeedbackCard'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1, f2 }])
}

describe('FeedbackCard', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('renders nothing when no data', () => {
    const { container } = render(<FeedbackCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders hit result with 完美', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText('目标区间')).toBeTruthy()
    expect(screen.getByText('完美')).toBeTruthy()
  })

  it('renders miss result with deviation hints', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
    render(<FeedbackCard />)
    expect(screen.getByText('F2偏高')).toBeTruthy()
  })

  it('shows card header 实时反馈 when results exist', () => {
    const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText('实时反馈')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: FAIL — `Cannot find module '../components/FeedbackCard'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/FeedbackCard.tsx`:

```tsx
import { useFeedback } from '../feedback'
import styles from './FeedbackCard.module.css'

export function FeedbackCard() {
  const results = useFeedback()
  if (results.length === 0) return null
  return (
    <aside className={styles.card} aria-label="实时反馈">
      <div className={styles.header}>实时反馈</div>
      <ul className={styles.list}>
        {results.map(result => (
          <li
            key={result.id}
            className={styles.row}
            data-status={result.status}
          >
            <span className={styles.label}>{result.label}</span>
            <span
              className={`${styles.value} ${result.status === 'hit' ? styles.valueHit : ''}`}
            >
              {result.message}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
```

Create `src/components/FeedbackCard.module.css`:

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
  position: absolute;
  top: 16px;
  left: calc(50% + 466px);
  width: 220px;
}
.header {
  font-size: 12px;
  color: var(--text-soft);
  font-weight: 600;
  letter-spacing: 0.3px;
}
.list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row[data-status="idle"] {
  opacity: 0.55;
}
.label {
  font-size: 11px;
  color: var(--text-soft);
}
.value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-mute);
}
.valueHit {
  color: var(--hit);
  border-radius: 4px;
  animation: pulseGlow 1.6s ease-out infinite;
}
.row[data-status="miss"] .value {
  color: var(--warn);
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

@media (max-width: 768px) {
  .card {
    position: static;
    width: 100%;
    margin-bottom: 14px;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedbackCard.tsx src/components/FeedbackCard.module.css src/__tests__/FeedbackCard.test.tsx
git commit -m "feat(feedback): add FeedbackCard component"
```

---

### Task 5: Wire into AnalysisPage

**Files:**
- Modify: `src/routes/AnalysisPage.tsx`
- Modify: `src/routes/AnalysisPage.module.css`

- [ ] **Step 1: Modify `AnalysisPage.tsx`**

Add import at top (after existing component imports):

```tsx
import { FeedbackCard } from '../components/FeedbackCard'
```

Inside `<main className={styles.content}>`, after `<TargetPresetBar />`, add:

```tsx
<FeedbackCard />
```

Note: `FeedbackCard` subscribes to the store internally via `useFeedback()` — AnalysisPage does NOT call `useFeedback()` itself, so the page doesn't re-render on every frame.

- [ ] **Step 2: Verify AnalysisPage layout**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run full unit test suite**

Run: `npx vitest run src/__tests__/`
Expected: all tests PASS (existing + new).

- [ ] **Step 4: Commit**

```bash
git add src/routes/AnalysisPage.tsx
git commit -m "feat(feedback): wire FeedbackCard into AnalysisPage"
```

---

### Task 6: Final verification

**Files:** none

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: 19 test files pass, 115 + 15 = 130 tests, 0 failures.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [ ] **Step 4: Final commit check**

Run: `git status --short` and `git log --oneline -8`
Expected: all work committed, clean status.

---

# 修订计划（2026-08-01）：常驻显示 + 同侧下方布局 + F0/F1/F2 实时数值

> 用户需求变更：1) 反馈卡片常驻显示（不再无数据时消失）；2) 位置移到 TargetPresetBar 同侧（左侧）正下方；3) 卡片显示 F0/F1/F2 实时具体数值。汇总行「完美/提示」保留。更新后的 spec：`docs/superpowers/specs/2026-08-01-hit-target-feedback-design.md`。

**修订目标：** FeedbackCard 常驻显示，含 F0/F1/F2 实时数值行（命中绿/偏低偏高橙/无数据 `--` 灰，不带文字），保留汇总行；布局改为左侧容器包裹 TargetPresetBar + FeedbackCard。

---

### Task 7: getFormantStatus 共享判定函数（TDD）

**Files:**
- Create: `src/feedback/status.ts`
- Test: `src/__tests__/status.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/__tests__/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getFormantStatus } from '../feedback/status'

describe('getFormantStatus', () => {
  it('returns hit when value is inside range', () => {
    expect(getFormantStatus(300, [200, 400])).toBe('hit')
  })

  it('returns hit when value equals lower bound', () => {
    expect(getFormantStatus(200, [200, 400])).toBe('hit')
  })

  it('returns hit when value equals upper bound', () => {
    expect(getFormantStatus(400, [200, 400])).toBe('hit')
  })

  it('returns low when value is below lower bound', () => {
    expect(getFormantStatus(100, [200, 400])).toBe('low')
  })

  it('returns high when value is above upper bound', () => {
    expect(getFormantStatus(500, [200, 400])).toBe('high')
  })

  it('returns none for null', () => {
    expect(getFormantStatus(null, [200, 400])).toBe('none')
  })

  it('returns none for undefined', () => {
    expect(getFormantStatus(undefined, [200, 400])).toBe('none')
  })

  it('returns none for non-finite value', () => {
    expect(getFormantStatus(NaN, [200, 400])).toBe('none')
    expect(getFormantStatus(Infinity, [200, 400])).toBe('none')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/status.test.ts`
Expected: FAIL — `Cannot find module '../feedback/status'`.

- [x] **Step 3: Write minimal implementation**

Create `src/feedback/status.ts`:

```ts
export type FormantStatus = 'hit' | 'low' | 'high' | 'none'

export function getFormantStatus(
  value: number | null | undefined,
  range: [number, number],
): FormantStatus {
  if (value == null || !Number.isFinite(value)) return 'none'
  if (value < range[0]) return 'low'
  if (value > range[1]) return 'high'
  return 'hit'
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/status.test.ts`
Expected: 8 tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/feedback/status.ts src/__tests__/status.test.ts
git commit -m "feat(feedback): add getFormantStatus shared evaluator"
```

---

### Task 8: 重构 evaluateHitRate 复用 getFormantStatus

**Files:**
- Modify: `src/feedback/hitRate.ts`
- Test: `src/__tests__/hitRate.test.ts`

- [x] **Step 1: Refactor implementation to use getFormantStatus**

Modify `src/feedback/hitRate.ts` — replace the inline boundary checks with the shared function:

```ts
import type { FeedbackContext, FeedbackResult } from '../types'
import { getFormantStatus } from './status'

const KEYS = ['f0', 'f1', 'f2'] as const

export function evaluateHitRate(ctx: FeedbackContext): FeedbackResult | null {
  const { latestFrame, bands } = ctx
  if (!latestFrame) return null

  const hints: string[] = []
  let hasData = false
  let allHit = true

  for (const k of KEYS) {
    const status = getFormantStatus(latestFrame[k], bands[k].range)
    if (status === 'none') continue
    hasData = true
    if (status === 'low') {
      allHit = false
      hints.push(`${k.toUpperCase()}偏低`)
    } else if (status === 'high') {
      allHit = false
      hints.push(`${k.toUpperCase()}偏高`)
    }
  }

  if (!hasData) return null
  if (allHit) {
    return { id: 'hit-rate', label: '目标区间', status: 'hit', message: '完美' }
  }
  return { id: 'hit-rate', label: '目标区间', status: 'miss', message: hints.join(' ') }
}
```

- [x] **Step 2: Run existing hitRate tests to verify behavior unchanged**

Run: `npx vitest run src/__tests__/hitRate.test.ts`
Expected: 7 tests PASS (no behavior change).

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
git add src/feedback/hitRate.ts
git commit -m "refactor(feedback): reuse getFormantStatus in evaluateHitRate"
```

---

### Task 9: FeedbackCard 常驻显示 + 实时数值行（TDD）

**Files:**
- Modify: `src/components/FeedbackCard.tsx`
- Modify: `src/components/FeedbackCard.module.css`
- Test: `src/__tests__/FeedbackCard.test.tsx`

- [x] **Step 1: Rewrite the failing test**

Modify `src/__tests__/FeedbackCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackCard } from '../components/FeedbackCard'
import { useAppStore } from '../store/appStore'
import { VOWEL_PRESETS } from '../types'

const vowelA = VOWEL_PRESETS['vowel-a']

function setFrame(f0: number | null, f1: number | null, f2: number | null) {
  useAppStore.getState().setFrames([{ time: 0.1, f0, f1, f2 }])
}

const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)

describe('FeedbackCard', () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it('renders header even with no data', () => {
    render(<FeedbackCard />)
    expect(screen.getByText('实时反馈')).toBeTruthy()
  })

  it('shows -- placeholders for values when no data', () => {
    render(<FeedbackCard />)
    expect(screen.getAllByText('--')).toHaveLength(3)
  })

  it('shows real-time F0/F1/F2 values in Hz', () => {
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText(`${mid(vowelA.f0[0], vowelA.f0[1])} Hz`)).toBeTruthy()
    expect(screen.getByText(`${mid(vowelA.f1[0], vowelA.f1[1])} Hz`)).toBeTruthy()
    expect(screen.getByText(`${mid(vowelA.f2[0], vowelA.f2[1])} Hz`)).toBeTruthy()
  })

  it('marks value rows with correct data-status', () => {
    const midF0 = mid(vowelA.f0[0], vowelA.f0[1])
    setFrame(midF0, vowelA.f1[0] - 50, vowelA.f2[1] + 100)
    render(<FeedbackCard />)
    const container = document.querySelector('aside')!
    const rows = Array.from(container.querySelectorAll('[data-status]'))
    const rowByLabel = (label: string) =>
      rows.find(r => r.firstChild?.textContent === label) as HTMLElement
    expect(rowByLabel('F0').dataset.status).toBe('hit')
    expect(rowByLabel('F1').dataset.status).toBe('low')
    expect(rowByLabel('F2').dataset.status).toBe('high')
  })

  it('renders summary row with 完美 when all hit', () => {
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
    render(<FeedbackCard />)
    expect(screen.getByText('目标区间')).toBeTruthy()
    expect(screen.getByText('完美')).toBeTruthy()
  })

  it('renders summary row with deviation hints when miss', () => {
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
    render(<FeedbackCard />)
    expect(screen.getByText('F2偏高')).toBeTruthy()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: FAIL — current component returns null on no data, no value rows.

- [x] **Step 3: Rewrite minimal implementation**

Modify `src/components/FeedbackCard.tsx`:

```tsx
import { useAppStore } from '../store/appStore'
import { useFeedback } from '../feedback'
import { getFormantStatus } from '../feedback/status'
import type { FormantStatus } from '../feedback/status'
import styles from './FeedbackCard.module.css'

const KEYS = ['f0', 'f1', 'f2'] as const
type FormantKey = typeof KEYS[number]

const STATUS_CLASS: Record<FormantStatus, string> = {
  hit: styles.valueHit,
  low: styles.valueWarn,
  high: styles.valueWarn,
  none: styles.valueMute,
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${Math.round(value)} Hz`
}

export function FeedbackCard() {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const results = useFeedback()

  return (
    <aside className={styles.card} aria-label="实时反馈">
      <div className={styles.header}>实时反馈</div>
      <div className={styles.values}>
        {KEYS.map(key => {
          const status = getFormantStatus(latestFrame?.[key], bands[key].range)
          return (
            <div key={key} className={styles.valueRow} data-status={status}>
              <span className={styles.valueLabel}>{key.toUpperCase()}</span>
              <span className={`${styles.valueNum} ${STATUS_CLASS[status]}`}>
                {formatValue(latestFrame?.[key])}
              </span>
            </div>
          )
        })}
      </div>
      <ul className={styles.list}>
        {results.map(result => (
          <li
            key={result.id}
            className={styles.row}
            data-status={result.status}
          >
            <span className={styles.label}>{result.label}</span>
            <span
              className={`${styles.value} ${result.status === 'hit' ? styles.valueHit : ''}`}
            >
              {result.message}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
```

- [x] **Step 4: Update CSS module**

Modify `src/components/FeedbackCard.module.css` — add value-row styles, keep existing summary styles. Note `.card` positioning will be changed in Task 10:

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.header {
  font-size: 12px;
  color: var(--text-soft);
  font-weight: 600;
  letter-spacing: 0.3px;
}
.values {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed var(--border);
  margin-top: 12px;
  padding-top: 12px;
}
.valueRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.valueLabel {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-soft);
  min-width: 20px;
}
.valueNum {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.valueHit {
  color: var(--hit);
}
.valueWarn {
  color: var(--warn);
}
.valueMute {
  color: var(--text-mute);
}
.list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.label {
  font-size: 11px;
  color: var(--text-soft);
}
.value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-mute);
}
.row[data-status="hit"] .value {
  color: var(--hit);
  animation: pulseGlow 1.6s ease-out infinite;
}
.row[data-status="miss"] .value {
  color: var(--warn);
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .row[data-status="hit"] .value {
    animation: none;
  }
}

@media (max-width: 768px) {
  .card {
    width: 100%;
    margin-bottom: 14px;
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: 6 tests PASS.

- [x] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 7: Commit**

```bash
git add src/components/FeedbackCard.tsx src/components/FeedbackCard.module.css src/__tests__/FeedbackCard.test.tsx
git commit -m "feat(feedback): always-on card with real-time F0/F1/F2 values"
```

---

### Task 10: 布局改为左侧容器包裹

**Files:**
- Modify: `src/routes/AnalysisPage.tsx`
- Modify: `src/routes/AnalysisPage.module.css`
- Modify: `src/components/TargetPresetBar.module.css`
- Modify: `src/components/FeedbackCard.module.css`

- [x] **Step 1: Modify `AnalysisPage.tsx`**

Wrap `TargetPresetBar` and `FeedbackCard` in a side panel container. Change the current `<main>` block:

```tsx
<main className={styles.content}>
  <div className={styles.sidePanel}>
    <TargetPresetBar />
    <FeedbackCard />
  </div>

  <div className={styles.chartsColumn}>
    ...
  </div>
</main>
```

- [x] **Step 2: Add `.sidePanel` to `AnalysisPage.module.css`**

Add:

```css
.sidePanel {
  position: absolute;
  top: 16px;
  right: calc(50% + 466px);
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 768px) {
  .sidePanel {
    position: static;
    width: 100%;
    margin-bottom: 14px;
  }
}
```

Merge the `.sidePanel` media query into the existing `@media (max-width: 768px)` block.

- [x] **Step 3: Modify `TargetPresetBar.module.css`**

Remove absolute positioning from `.bar` (the side panel now positions it). `.bar` becomes:

```css
.bar {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - 88px);
  overflow-y: auto;
}
```

Also update the mobile media query — remove `.bar` `position: static; width: 100%;` since the panel handles it:

```css
@media (max-width: 768px) {
  .vowels {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

- [x] **Step 4: Modify `FeedbackCard.module.css`**

Remove the `position: static` from the mobile media query (panel handles stacking):

```css
@media (max-width: 768px) {
  .card {
    width: 100%;
    margin-bottom: 14px;
  }
}
```

- [x] **Step 5: Verify layout**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/__tests__/`
Expected: all tests PASS.

- [x] **Step 6: Commit**

```bash
git add src/routes/AnalysisPage.tsx src/routes/AnalysisPage.module.css src/components/TargetPresetBar.module.css src/components/FeedbackCard.module.css
git commit -m "feat(feedback): stack FeedbackCard below TargetPresetBar in left panel"
```

---

### Task 11: 最终验证

**Files:** none

- [x] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 2: Full test suite**

Run: `npm test`
Expected: all test files pass, 0 failures.

- [x] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [x] **Step 4: Final commit check**

Run: `git status --short` and `git log --oneline -8`
Expected: all work committed, clean status.

---

# 修订计划（2026-08-01）：图例可见性 store 驱动，实时反馈联动

> 用户需求变更：在 FormantChart 图例隐藏某 series（f0/f1/f2）时，实时反馈卡片也不显示该项目——数值行整行不渲染，汇总判定忽略隐藏维度（如隐藏 f1/f2 后仅 f0 命中即显示"完美"）。图例可见性从 AnalysisPage 局部 `useState` 提升到 Zustand store（`formantVisible`），遵循"命令驱动控制、数据经 store 流向组件"原则。更新后的 spec：`docs/superpowers/specs/2026-08-01-hit-target-feedback-design.md`。

**修订目标：** 新增 `formantVisible` 至 appStore（与 bands 同级），图例按钮写 store，FormantChart / FeedbackCard / useFeedback 全部订阅 store；`FeedbackContext.visible` 必填；evaluateHitRate 跳过隐藏维度；FeedbackCard 数值行按可见性过滤。

---

### Task 12: 类型 + store 图例可见性（TDD）

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.ts`
- Test: `src/__tests__/appStore.test.ts`

- [x] **Step 1: 追加测试到 `appStore.test.ts`**

在 `describe('reset')` 后追加：

```ts
describe('formantVisible', () => {
  it('defaults to all visible', () => {
    const { formantVisible } = useAppStore.getState()
    expect(formantVisible).toEqual({ f0: true, f1: true, f2: true })
  })

  it('toggleFormantVisible flips a single key', () => {
    useAppStore.getState().toggleFormantVisible('f1')
    const { formantVisible } = useAppStore.getState()
    expect(formantVisible.f0).toBe(true)
    expect(formantVisible.f1).toBe(false)
    expect(formantVisible.f2).toBe(true)
  })

  it('toggleFormantVisible flips back', () => {
    useAppStore.getState().toggleFormantVisible('f0')
    useAppStore.getState().toggleFormantVisible('f0')
    expect(useAppStore.getState().formantVisible.f0).toBe(true)
  })
})

describe('clearFrames preserves formantVisible', () => {
  it('keeps hidden state across clear', () => {
    useAppStore.getState().toggleFormantVisible('f1')
    useAppStore.getState().appendFrame(makeFrame({ time: 0.01, f0: 220 }))
    useAppStore.getState().clearFrames()
    expect(useAppStore.getState().formantVisible.f1).toBe(false)
    expect(useAppStore.getState().frames).toEqual([])
  })
})

describe('reset restores formantVisible', () => {
  it('restores all visible', () => {
    useAppStore.getState().toggleFormantVisible('f2')
    useAppStore.getState().reset()
    expect(useAppStore.getState().formantVisible).toEqual({ f0: true, f1: true, f2: true })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/appStore.test.ts`
Expected: FAIL — `formantVisible` / `toggleFormantVisible` 不存在。

- [x] **Step 3: 更新 `src/types/index.ts`**

追加到文件末尾：

```ts
export type FormantSeries = 'f0' | 'f1' | 'f2'
export type FormantVisibility = Record<FormantSeries, boolean>

export interface FeedbackContext {
  latestFrame: AnalysisFrame | null
  bands: TargetBands
  visible: FormantVisibility
}
```

（替换现有 `FeedbackContext`，删除旧的 `latestFrame`/`bands` 定义，补 `visible`。）

- [x] **Step 4: 更新 `src/store/appStore.ts`**

- import 增加 `FormantSeries, FormantVisibility`
- `AppState` 增加 `formantVisible: FormantVisibility`
- `AppActions` 增加 `toggleFormantVisible: (key: FormantSeries) => void`
- `initialState` 增加 `formantVisible: { f0: true, f1: true, f2: true }`
- store 实现增加：

```ts
toggleFormantVisible: (key) => set((state) => ({
  formantVisible: { ...state.formantVisible, [key]: !state.formantVisible[key] },
})),
```

`clearFrames()` 不触碰 `formantVisible`（自然保留）；`reset()` 恢复 initialState（自然恢复）。

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/appStore.test.ts`
Expected: 新增 5 个测试 PASS。

- [x] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误。注意：`FeedbackContext` 增加必填 `visible` 后，`hitRate.ts` / `index.ts` 若未传会报错，此处在下一步一并修复。

- [x] **Step 7: Commit**

```bash
git add src/types/index.ts src/store/appStore.ts src/__tests__/appStore.test.ts
git commit -m "feat(feedback): add formantVisible to store with toggle action"
```

---

### Task 13: evaluateHitRate + useFeedback 接入 visible（TDD）

**Files:**
- Modify: `src/feedback/hitRate.ts`
- Modify: `src/feedback/index.ts`
- Test: `src/__tests__/hitRate.test.ts`
- Test: `src/__tests__/useFeedback.test.tsx`

- [x] **Step 1: 更新 `hitRate.test.ts`**

`makeCtx` 增加 `visible` 参数，并追加图例联动用例：

```ts
function makeCtx(overrides: {
  f0?: number | null
  f1?: number | null
  f2?: number | null
  visible?: Partial<Record<'f0' | 'f1' | 'f2', boolean>>
}): FeedbackContext {
  const frame: AnalysisFrame = {
    time: 0.1,
    f0: overrides.f0 ?? null,
    f1: overrides.f1 ?? null,
    f2: overrides.f2 ?? null,
  }
  return {
    latestFrame: frame,
    bands: {
      f0: { range: vowelA.f0, color: '#10B981' },
      f1: { range: vowelA.f1, color: '#3B82F6' },
      f2: { range: vowelA.f2, color: '#F59E0B' },
    },
    visible: { f0: true, f1: true, f2: true, ...overrides.visible },
  }
}
```

追加用例：

```ts
it('ignores hidden out-of-range dims (returns hit)', () => {
  const result = evaluateHitRate(makeCtx({
    f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
    f1: vowelA.f1[1] + 200,
    f2: vowelA.f2[1] + 200,
    visible: { f1: false, f2: false },
  }))
  expect(result).toEqual({
    id: 'hit-rate',
    label: '目标区间',
    status: 'hit',
    message: '完美',
  })
})

it('hides deviation hints for hidden dims', () => {
  const result = evaluateHitRate(makeCtx({
    f0: vowelA.f0[0] - 50,
    f1: vowelA.f1[1] + 200,
    f2: (vowelA.f2[0] + vowelA.f2[1]) / 2,
    visible: { f1: false },
  }))
  expect(result?.status).toBe('miss')
  expect(result?.message).toBe('F0偏低')
})

it('returns null when all dims hidden', () => {
  const result = evaluateHitRate(makeCtx({
    f0: (vowelA.f0[0] + vowelA.f0[1]) / 2,
    visible: { f0: false, f1: false, f2: false },
  }))
  expect(result).toBeNull()
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/hitRate.test.ts`
Expected: FAIL — 用例红（实现未跳过隐藏维度）。

- [x] **Step 3: 更新 `src/feedback/hitRate.ts`**

`evaluateHitRate` 循环开头增加可见性跳过：

```ts
for (const k of KEYS) {
  if (!visible[k]) continue
  const status = getFormantStatus(latestFrame[k], bands[k].range)
  ...
}
```

- [x] **Step 4: Run hitRate test to verify it passes**

Run: `npx vitest run src/__tests__/hitRate.test.ts`
Expected: 10 个测试 PASS（7 旧 + 3 新）。

- [x] **Step 5: 更新 `useFeedback.test.tsx` 追加用例**

```ts
it('respects store formantVisible (hidden out-of-range is ignored)', () => {
  useAppStore.getState().toggleFormantVisible('f2')
  const mid = (lo: number, hi: number) => Math.round((lo + hi) / 2)
  act(() => {
    setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), vowelA.f2[1] + 100)
  })
  const { result } = renderHook(() => useFeedback())
  expect(result.current).toHaveLength(1)
  expect(result.current[0].status).toBe('hit')
  expect(result.current[0].message).toBe('完美')
})
```

- [x] **Step 6: 更新 `src/feedback/index.ts`**

`useFeedback` 订阅 `formantVisible` 并传入 ctx：

```ts
export function useFeedback(): FeedbackResult[] {
  const latestFrame = useAppStore(s => s.latestFrame)
  const bands = useAppStore(s => s.bands)
  const visible = useAppStore(s => s.formantVisible)
  return FEEDBACK_EVALUATORS
    .map(fn => fn({ latestFrame, bands, visible }))
    .filter((r): r is FeedbackResult => r !== null)
}
```

- [x] **Step 7: Run useFeedback test to verify it passes**

Run: `npx vitest run src/__tests__/useFeedback.test.tsx`
Expected: 4 个测试 PASS。

- [x] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [x] **Step 9: Commit**

```bash
git add src/feedback/hitRate.ts src/feedback/index.ts src/__tests__/hitRate.test.ts src/__tests__/useFeedback.test.tsx
git commit -m "feat(feedback): respect formantVisible in evaluator and hook"
```

---

### Task 14: FeedbackCard 数值行按可见性过滤（TDD）

**Files:**
- Modify: `src/components/FeedbackCard.tsx`
- Test: `src/__tests__/FeedbackCard.test.tsx`

- [x] **Step 1: 追加测试到 `FeedbackCard.test.tsx`**

```ts
it('hides value row for hidden series', () => {
  useAppStore.getState().toggleFormantVisible('f1')
  setFrame(mid(vowelA.f0[0], vowelA.f0[1]), mid(vowelA.f1[0], vowelA.f1[1]), mid(vowelA.f2[0], vowelA.f2[1]))
  render(<FeedbackCard />)
  expect(screen.queryByText('F1')).toBeNull()
  expect(screen.queryByText(`${mid(vowelA.f1[0], vowelA.f1[1])} Hz`)).toBeNull()
  expect(screen.getByText('F0')).toBeTruthy()
  expect(screen.getByText('F2')).toBeTruthy()
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: FAIL — F1 行仍渲染。

- [x] **Step 3: 更新 `src/components/FeedbackCard.tsx`**

- 订阅 `formantVisible`：`const formantVisible = useAppStore(s => s.formantVisible)`
- 数值行遍历改为过滤：

```tsx
{KEYS.filter(key => formantVisible[key]).map(key => {
  ...
})}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/FeedbackCard.test.tsx`
Expected: 8 个测试 PASS（7 旧 + 1 新）。

- [x] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [x] **Step 6: Commit**

```bash
git add src/components/FeedbackCard.tsx src/__tests__/FeedbackCard.test.tsx
git commit -m "feat(feedback): filter FeedbackCard value rows by formantVisible"
```

---

### Task 15: FormantChart 读 store + AnalysisPage 图例写 store（TDD）

**Files:**
- Modify: `src/components/FormantChart.tsx`
- Modify: `src/routes/AnalysisPage.tsx`
- Test: `src/__tests__/FormantChart.test.tsx`
- Test: `src/__tests__/AnalysisPage.test.tsx`

- [x] **Step 1: 更新 `FormantChart.test.tsx`**

删除 `seriesVisible` prop 用法，改为 store 驱动。将两个用例改为：

```tsx
it('renders data for all series by default', () => {
  useAppStore.getState().setFrames(FRAMES)
  render(<FormantChart />)
  expect(seriesByName('F1').data).toHaveLength(2)
  expect(seriesByName('F1').markLine).toBeDefined()
})

it('empties data and removes markLine for hidden series', () => {
  useAppStore.getState().setFrames(FRAMES)
  useAppStore.getState().toggleFormantVisible('f1')
  render(<FormantChart />)
  expect(seriesByName('F1').data).toEqual([])
  expect(seriesByName('F1').markLine).toBeUndefined()
  expect(seriesByName('F0').data).toHaveLength(2)
  expect(seriesByName('F2').data).toHaveLength(2)
})

it('re-renders when store formantVisible changes', () => {
  useAppStore.getState().setFrames(FRAMES)
  render(<FormantChart />)
  expect(seriesByName('F0').data).toHaveLength(2)

  useAppStore.getState().toggleFormantVisible('f0')

  expect(seriesByName('F0').data).toEqual([])
  expect(seriesByName('F0').markLine).toBeUndefined()
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/FormantChart.test.tsx`
Expected: FAIL — 当前 `seriesVisible` prop 逻辑仍在；改 store 后不重渲染。

- [x] **Step 3: 更新 `src/components/FormantChart.tsx`**

- 移除 `seriesVisible` prop；`FormantChartProps` 仅保留 `cursorTime` / `onFrameClick`
- 组件内订阅：`const formantVisible = useAppStore(s => s.formantVisible)`
- `seriesVisibleRef` 初始化改为默认全 true（现已是），同步 effect 改为：

```tsx
useEffect(() => {
  seriesVisibleRef.current = formantVisible
  renderChart(frames, cursorTime, bands, isLiveRef.current, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [formantVisible])
```

（`renderChart` 内部继续用 `seriesVisibleRef.current`，无需改动。）

- [x] **Step 4: Run FormantChart test to verify it passes**

Run: `npx vitest run src/__tests__/FormantChart.test.tsx`
Expected: 3 个测试 PASS。

- [x] **Step 5: 更新 `AnalysisPage.test.tsx`**

用例保持（图例点击改走 store 后行为一致），确认 `data-active` 仍反映 store 状态。若无需改动则跳过；运行确认通过：

Run: `npx vitest run src/__tests__/AnalysisPage.test.tsx`
Expected: PASS。

- [x] **Step 6: 更新 `src/routes/AnalysisPage.tsx`**

- 移除 `seriesVisible` 局部 state 与 `handleToggleSeries`
- import `useAppStore`，订阅 `formantVisible` 与 `toggleFormantVisible`：

```tsx
const formantVisible = useAppStore(s => s.formantVisible)
const toggleFormantVisible = useAppStore(s => s.toggleFormantVisible)
```

- `LegendKey` 改用共享类型 `FormantSeries`（import 自 types），`LEGEND_KEYS` 保留
- 图例按钮改为：

```tsx
<button
  key={key}
  className={styles.legendItem}
  data-key={key}
  data-active={String(formantVisible[key])}
  onClick={() => toggleFormantVisible(key)}
>
  <i style={{ background: COLORS[key] }}></i>{key.toUpperCase()}
</button>
```

- `<FormantChart>` 调用去掉 `seriesVisible` prop：`<FormantChart cursorTime={cursorTime} />`

- [x] **Step 7: Run AnalysisPage test to verify it passes**

Run: `npx vitest run src/__tests__/AnalysisPage.test.tsx`
Expected: PASS（图例点击切换数据可见性）。

- [x] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [x] **Step 9: Commit**

```bash
git add src/components/FormantChart.tsx src/routes/AnalysisPage.tsx src/__tests__/FormantChart.test.tsx src/__tests__/AnalysisPage.test.tsx
git commit -m "feat(feedback): drive chart legend from store formantVisible"
```

---

### Task 16: 最终验证

**Files:** none

- [x] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 2: Full test suite**

Run: `npm test`
Expected: all test files pass, 0 failures.

- [x] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [x] **Step 4: Final commit check**

Run: `git status --short` and `git log --oneline -8`
Expected: all work committed, clean status.
