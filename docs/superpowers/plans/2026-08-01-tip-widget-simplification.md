# TipWidget Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TipWidget's alternating random rotation while replacing its five-state reducer with directly owned React state.

**Architecture:** `TipWidget` owns visibility, hover-paused, dismissed, and selected-tip state. One effect schedules the next visible/hidden transition only while the widget is active. CSS remains responsible for the visual transition and the delayed reappearance of the reopen trigger.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest 3, React Testing Library.

## Global Constraints

- Start hidden; do not persist dismissed state.
- Alternate hidden and visible every `interval`; pick a non-repeating random tip only when entering visible.
- Pause while hovered and restart a full interval on mouse leave.
- Preserve `tips?: string[]` and `interval?: number` props and the existing visual placement.

---

### Task 1: Add behavior-level TipWidget tests

**Files:**
- Create: `src/__tests__/TipWidget.test.tsx`

**Interfaces:**
- Consumes: `<TipWidget tips={string[]} interval={number} />`
- Produces: regression coverage for hidden/visible cadence, pause/resume, dismissal, reopen, and non-repeating selection.

- [x] **Step 1: Write failing tests with fake timers**

```tsx
it('starts hidden and shows a different random tip after the first interval', () => {
  render(<TipWidget tips={['one', 'two']} interval={1000} />)
  expect(card()).toHaveClass(styles.cardHidden)
  act(() => vi.advanceTimersByTime(1000))
  expect(card()).not.toHaveClass(styles.cardHidden)
  expect(screen.getByText('two')).toBeInTheDocument()
})
```

Add tests that verify the next interval hides without changing the displayed text, hover pauses until mouse leave plus a full interval, closing halts automatic changes, and reopening starts the visible cycle again.

- [x] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run --project unit src/__tests__/TipWidget.test.tsx`

Expected: FAIL because the current implementation never changes the tip when changing from hidden to visible.

### Task 2: Simplify TipWidget state and styles

**Files:**
- Modify: `src/components/TipWidget.tsx`
- Modify: `src/components/TipWidget.module.css`
- Delete: `src/components/useTipStateMachine.ts`

**Interfaces:**
- Consumes: the existing optional `tips` and `interval` props.
- Produces: the same rendered widget with CSS classes reflecting visibility and dismissal, without a reducer, ref, or transition event listener.

- [x] **Step 1: Replace the reducer hook with local state and one timer effect**

```tsx
const [isVisible, setIsVisible] = useState(false)
const [isPaused, setIsPaused] = useState(false)
const [isDismissed, setIsDismissed] = useState(false)
const [tipIndex, setTipIndex] = useState(() => randomIndex(tips.length))

useEffect(() => {
  if (isDismissed || isPaused) return
  const timer = window.setTimeout(() => {
    setIsVisible(visible => {
      if (!visible) setTipIndex(index => nextRandomIndex(tips.length, index))
      return !visible
    })
  }, interval)
  return () => clearTimeout(timer)
}, [interval, isDismissed, isPaused, isVisible, tips.length])
```

Handle empty `tips` defensively by falling back to the default tip list. On close, set `isDismissed` and hidden; on reopen, select a non-repeating tip, clear dismissal, and make the card visible.

- [x] **Step 2: Keep the transition in CSS**

Keep the card's transform/opacity transition. Render the trigger throughout, hide it by default with opacity/visibility/pointer-events, and reveal it only for the dismissed widget after the card's 0.35s exit transition.

- [x] **Step 3: Delete the obsolete state-machine hook**

Remove `useTipStateMachine.ts`; it has no remaining consumers.

- [x] **Step 4: Run the focused test file to verify it passes**

Run: `npx vitest run --project unit src/__tests__/TipWidget.test.tsx`

Expected: PASS.

### Task 3: Verify and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-01-tip-widget-simplification.md`

- [x] **Step 1: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`

Expected: all tests pass and TypeScript reports no errors.

- [x] **Step 2: Review the final diff**

Run: `git diff --check && git status --short`

Expected: only the component, its CSS, its test, deleted state-machine hook, and implementation plan are changed.

- [x] **Step 3: Commit the implementation**

```bash
git add src/components/TipWidget.tsx src/components/TipWidget.module.css src/components/useTipStateMachine.ts src/__tests__/TipWidget.test.tsx docs/superpowers/plans/2026-08-01-tip-widget-simplification.md
git commit -m "fix: simplify TipWidget rotation"
```
