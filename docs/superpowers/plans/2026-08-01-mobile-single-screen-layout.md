# 移动端一屏适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On mobile (`max-width: 768px`) constrain all UI within one viewport height (no page scroll): Toolbar fixed, TargetPresetBar + FeedbackCard side-by-side in one row, two charts flex-fill remaining height.

**Architecture:** Fix the layout root cause — AnalysisPage root `<div>` becomes a flex column (`styles.page`) with `height: 100dvh; overflow: hidden` on mobile, so `.content`'s `flex: 1` finally works. The side panel becomes a horizontal flex row; charts lose their fixed 280px height and flex-fill. All changes are pure CSS except one JSX class addition. Desktop (>768px) layout is untouched.

**Tech Stack:** React 18, CSS Modules, Vite, Vitest (jsdom — cannot test media queries; verification is existing tests + tsc + build + manual DevTools check).

**Spec:** `docs/superpowers/specs/2026-08-01-mobile-single-screen-layout-design.md`

---

## File Structure

- **Modify** `src/routes/AnalysisPage.tsx` — add `className={styles.page}` to root `<div>`
- **Modify** `src/routes/AnalysisPage.module.css` — add `.page`; rework mobile media query (`.content`, `.sidePanel`, `.chartsColumn`, `.chartWrapper`)
- **Modify** `src/components/TargetPresetBar.module.css` — mobile `.bar` flex + compaction
- **Modify** `src/components/FeedbackCard.module.css` — mobile `.card` flex + compaction
- **Modify** `src/components/Toolbar.module.css` — `.toolbar` `flex-shrink: 0`

---

### Task 1: Layout root — `.page` flex column + AnalysisPage mobile rules

**Files:**
- Modify: `src/routes/AnalysisPage.tsx:47`
- Modify: `src/routes/AnalysisPage.module.css:108-118`

- [ ] **Step 1: Add `.page` class to AnalysisPage root**

In `src/routes/AnalysisPage.tsx`, change the root wrapper from a bare `<div>` to `<div className={styles.page}>`:

```tsx
  return (
    <div className={styles.page}>
      <Toolbar toolItems={toolItems} onToolClick={handleClickTool} />
```

`styles` is already imported (`import styles from './AnalysisPage.module.css'`).

- [ ] **Step 2: Add `.page` base rule and rework the mobile media query**

In `src/routes/AnalysisPage.module.css`, add a `.page` base rule right after `.content` (desktop: plain block, no effect). Current lines 1-6:

```css
.content {
  flex: 1;
  position: relative;
  padding: 16px 20px;
  width: 100%;
}
```

Add after it:

```css
.page {
  display: flex;
  flex-direction: column;
}
```

Then replace the entire existing mobile media query (currently lines 108-118):

```css
@media (max-width: 768px) {
  .content {
    padding: 14px;
  }
  .sidePanel {
    position: static;
    width: 100%;
    margin-bottom: 14px;
  }
  .chartWrapper { height: 280px; }
}
```

with:

```css
@media (max-width: 768px) {
  .page {
    height: 100dvh;
    overflow: hidden;
  }
  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
  }
  .sidePanel {
    position: static;
    width: 100%;
    display: flex;
    flex-direction: row;
    gap: 12px;
    flex-shrink: 0;
  }
  .chartsColumn {
    flex: 1;
    min-height: 0;
  }
  .chartWrapper {
    flex: 1;
    height: auto;
    min-height: 0;
    margin: 8px auto;
  }
}
```

Notes:
- `.sidePanel` keeps `gap: 12px` from its base rule; the `margin-bottom: 14px` is removed because `.content`'s `gap: 12px` now handles vertical spacing.
- `.chartWrapper` keeps its base `width: calc(100% - 20px)`; only height/flex change.
- `.card` and `.chartsColumnCard` base rules already provide `flex: 1; min-height: 0` for the chart cards; `.chartArea` already has `flex: 1 1 auto; min-height: 120px`.

- [ ] **Step 3: Run unit tests + typecheck**

Run: `npx vitest run src/__tests__/`
Expected: all existing tests pass (jsdom ignores CSS media queries; no test should change).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/AnalysisPage.tsx src/routes/AnalysisPage.module.css
git commit -m "feat(mobile): single-screen flex column layout for mobile"
```

---

### Task 2: TargetPresetBar mobile compaction

**Files:**
- Modify: `src/components/TargetPresetBar.module.css:114-118`

- [ ] **Step 1: Add mobile `.bar` flex + compaction rules**

The current mobile media query (lines 114-118):

```css
@media (max-width: 768px) {
  .vowels {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

Replace it with:

```css
@media (max-width: 768px) {
  .bar {
    flex: 1;
    min-width: 0;
    padding: 10px;
    gap: 10px;
    max-height: none;
  }
  .vowels {
    grid-template-columns: repeat(6, 1fr);
  }
  .bandLo,
  .bandHi {
    height: 20px;
  }
}
```

Notes:
- `flex: 1` makes the bar grow to fill its half of the `.sidePanel` row (sibling FeedbackCard also has `flex: 1` → 50/50 split).
- `max-height: none` overrides the base `max-height: calc(100vh - 88px)` (a desktop fixed-panel rule) so no internal scroll on mobile.
- `min-width: 0` allows the bar to shrink below its content width inside the flex row.
- Band input compaction reduces `.bandLo`/`.bandHi` height from 22px to 20px. Their base rule (lines 83-97) also contains `flex: 1; min-width: 0` which is preserved.

- [ ] **Step 2: Run TargetPresetBar tests + typecheck**

Run: `npx vitest run src/__tests__/TargetPresetBar.test.tsx src/__tests__/FeedbackCard.test.tsx`
Expected: all pass.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TargetPresetBar.module.css
git commit -m "feat(mobile): compact TargetPresetBar in side-panel row"
```

---

### Task 3: FeedbackCard mobile flex + compaction, Toolbar flex-shrink

**Files:**
- Modify: `src/components/FeedbackCard.module.css:98-102`
- Modify: `src/components/Toolbar.module.css:1-12`

- [ ] **Step 1: Add mobile `.card` flex + compaction rules**

The current FeedbackCard mobile media query (lines 98-102):

```css
@media (max-width: 768px) {
  .card {
    width: auto;
  }
}
```

Replace it with:

```css
@media (max-width: 768px) {
  .card {
    flex: 1;
    min-width: 0;
    padding: 10px;
  }
}
```

Notes: `flex: 1` grows the card to fill its half of the `.sidePanel` row (matching TargetPresetBar's `flex: 1`). `min-width: 0` allows shrinking inside the flex row. `width: auto` is removed — the flex item sizes itself.

- [ ] **Step 2: Add `flex-shrink: 0` to Toolbar**

In `src/components/Toolbar.module.css`, add `flex-shrink: 0;` to the `.toolbar` base rule (lines 1-12), e.g. after `z-index: 20;`:

```css
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
}
```

This prevents the sticky toolbar from shrinking when `.page` becomes a height-constrained flex column on mobile. It is harmless on desktop.

- [ ] **Step 3: Run tests + typecheck**

Run: `npx vitest run src/__tests__/`
Expected: all pass.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedbackCard.module.css src/components/Toolbar.module.css
git commit -m "feat(mobile): compact FeedbackCard in row, prevent toolbar shrink"
```

---

### Task 4: Final verification

**Files:** none

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all test files pass, 0 failures.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [ ] **Step 4: Manual mobile check (browser DevTools)**

Verify in the browser (Vite dev server or `dist/` build) with DevTools device emulation (e.g. iPhone SE 375×667):
1. Entire page fits in one viewport — no vertical page scrollbar.
2. TargetPresetBar (left) and FeedbackCard (right) share the same row, roughly 50/50 width.
3. F0 chart and Formant chart are stacked below, each flex-filling ~half the remaining height, both fully visible.
4. Desktop viewport (>768px, e.g. 1280×800) is unchanged: TargetPresetBar left, FeedbackCard right, charts centered.
5. Narrow screen (e.g. 320×568) still fits one screen; charts stay ≥120px (`.chartArea` min-height).

- [ ] **Step 5: Final commit check**

Run: `git status --short` and `git log --oneline -6`
Expected: all work committed, clean status.
