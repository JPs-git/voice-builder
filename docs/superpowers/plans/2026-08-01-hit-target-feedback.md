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
