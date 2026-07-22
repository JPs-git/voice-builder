# About Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centered About modal with toolbar nav entry point.

**Architecture:** Grid-based toolbar with center nav region; reusable Modal component (centered, overlay-based) used by AboutModal; about modal open state managed via AnalysisContext.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest

---

### Task 1: Add aboutModalOpen state to AnalysisContext

**Files:**
- Modify: `src/contexts/AnalysisContext.tsx`
- Test: `src/__tests__/AnalysisContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Add after the last test in `src/__tests__/AnalysisContext.test.tsx`:

```tsx
it('SET_ABOUT_MODAL toggles modal state', () => {
  const { result } = renderHook(() => useAnalysis(), { wrapper })
  expect(result.current.state.aboutModalOpen).toBe(false)
  act(() => result.current.dispatch({ type: 'SET_ABOUT_MODAL', open: true }))
  expect(result.current.state.aboutModalOpen).toBe(true)
  act(() => result.current.dispatch({ type: 'SET_ABOUT_MODAL', open: false }))
  expect(result.current.state.aboutModalOpen).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AnalysisContext.test.tsx`
Expected: FAIL — `aboutModalOpen` not in state type

- [ ] **Step 3: Add aboutModalOpen to context**

In `src/contexts/AnalysisContext.tsx`:

```tsx
interface AnalysisState {
  // ...existing fields...
  configDrawerOpen: boolean
  helpDrawerOpen: boolean
  aboutModalOpen: boolean  // add
}
```

Add action:
```tsx
| { type: 'SET_ABOUT_MODAL'; open: boolean }
```

Add reducer case after `SET_HELP_DRAWER`:
```tsx
case 'SET_ABOUT_MODAL':
  return { ...state, aboutModalOpen: action.open }
```

Update `initialState`:
```tsx
configDrawerOpen: false,
helpDrawerOpen: false,
aboutModalOpen: false,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AnalysisContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AnalysisContext.tsx src/__tests__/AnalysisContext.test.tsx
git commit -m "feat: add aboutModalOpen state to AnalysisContext"
```

---

### Task 2: Create shared Modal component

**Files:**
- Create: `src/components/Modal.tsx`
- Create: `src/components/Modal.module.css`

- [ ] **Step 1: Create Modal.module.css**

Write `src/components/Modal.module.css`:

```css
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modalMask {
  position: absolute;
  inset: 0;
  background: rgba(16,24,40,0.35);
  animation: fade .2s ease;
}

.modalPanel {
  position: relative;
  width: min(520px, 90vw);
  max-height: 80vh;
  background: var(--panel);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(16,24,40,0.15);
  display: flex;
  flex-direction: column;
  animation: scaleIn .2s ease;
  overflow: hidden;
}

@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.modalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modalHeader h3 { margin: 0; font-size: 16px; font-weight: 700; }

.modalClose {
  background: transparent;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--text-mute);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.modalClose:hover { background: #F3F4F6; color: var(--text); }

.modalBody {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
```

- [ ] **Step 2: Create Modal.tsx**

Write `src/components/Modal.tsx`:

```tsx
import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null
  return (
    <div className={styles.modal}>
      <div className={styles.modalMask} onClick={onClose} />
      <div className={styles.modalPanel}>
        <header className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx src/components/Modal.module.css
git commit -m "feat: add reusable Modal component"
```

---

### Task 3: Create AboutModal component

**Files:**
- Create: `src/components/AboutModal.tsx`
- Create: `src/components/AboutModal.module.css`

- [ ] **Step 1: Create AboutModal.module.css**

Write `src/components/AboutModal.module.css`:

```css
.section + .section {
  margin-top: 16px;
}

.section h4 {
  margin: 0 0 4px 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.section p {
  font-size: 13px;
  color: var(--text-soft);
  margin: 0;
  line-height: 1.6;
}

.link {
  color: var(--accent, #3B82F6);
  text-decoration: none;
  word-break: break-all;
}

.link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: Create AboutModal.tsx**

Write `src/components/AboutModal.tsx`:

```tsx
import { Modal } from './Modal'
import styles from './AboutModal.module.css'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <Modal open={open} title="关于" onClose={onClose}>
      <section className={styles.section}>
        <h4>项目信息</h4>
        <p>名称：在线声音训练「看见自己的声音」</p>
        <p>版本：1.0.0</p>
      </section>

      <section className={styles.section}>
        <h4>仓库地址</h4>
        <p>
          <a className={styles.link} href="https://github.com/JPs-git/voice-builder" target="_blank" rel="noopener noreferrer">
            https://github.com/JPs-git/voice-builder
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h4>更新日志</h4>
        <p style={{ color: 'var(--text-mute)', fontStyle: 'italic' }}>待补充…</p>
      </section>

      <section className={styles.section}>
        <h4>作者 / 联系方式</h4>
        <p style={{ color: 'var(--text-mute)', fontStyle: 'italic' }}>待补充…</p>
      </section>
    </Modal>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AboutModal.tsx src/components/AboutModal.module.css
git commit -m "feat: add AboutModal component"
```

---

### Task 4: Update Toolbar with grid layout and nav region

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/Toolbar.module.css`

- [ ] **Step 1: Update Toolbar.module.css**

Replace the `.toolbar` rule and add nav styles in `src/components/Toolbar.module.css`:

Old `.toolbar`:
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
}
```

New `.toolbar`:
```css
.toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.nav {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.navItem {
  background: transparent;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: var(--text-mute);
  cursor: pointer;
  transition: background .15s;
}

.navItem:hover {
  background: #F3F4F6;
  color: var(--text);
}
```

Also update the mobile media query — replace the `.actions { width: 100% }` rule to ensure `.nav` stays visible:

In the `@media (max-width: 540px)` block, the old `.actions { width: 100%; }` rule was for flex wrapping — no longer needed with grid. Remove it:

```css
@media (max-width: 540px) {
  .actions { justify-content: flex-end; }
}
```

- [ ] **Step 2: Update Toolbar.tsx**

Add `onAbout` prop and nav region in `src/components/Toolbar.tsx`:

```tsx
interface ToolbarProps {
  phase: AppPhase
  isPlaying: boolean
  onRecord: () => void
  onImport: () => void
  onPlayback: () => void
  onClear: () => void
  onConfig: () => void
  onHelp: () => void
  onAbout: () => void
}
```

In the JSX, add the nav section between brand and actions:

```tsx
return (
  <header className={styles.toolbar}>
    <div className={styles.brand}>
      <img src={logo} className={styles.logo} alt="" aria-hidden="true" />
      <span className={styles.title}>在线声音训练</span>
      <span className={styles.subtitle}>「看见自己的声音」</span>
    </div>

    <nav className={styles.nav}>
      <button className={styles.navItem} onClick={onAbout}>关于</button>
    </nav>

    <div className={styles.actions}>
      {/* existing buttons */}
    </div>
  </header>
)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.module.css
git commit -m "feat: add grid layout and nav region to Toolbar"
```

---

### Task 5: Wire AboutModal into AnalysisPage

**Files:**
- Modify: `src/routes/AnalysisPage.tsx`

- [ ] **Step 1: Add AboutModal to AnalysisPage**

In `src/routes/AnalysisPage.tsx`:

Add import:
```tsx
import { AboutModal } from '../components/AboutModal'
```

In the Toolbar JSX, pass `onAbout`:
```tsx
<Toolbar
  phase={state.phase}
  isPlaying={isPlaying}
  onRecord={onRecord}
  onImport={onImport}
  onPlayback={onPlayback}
  onClear={clearAll}
  onConfig={() => dispatch({ type: 'SET_CONFIG_DRAWER', open: true })}
  onHelp={() => dispatch({ type: 'SET_HELP_DRAWER', open: true })}
  onAbout={() => dispatch({ type: 'SET_ABOUT_MODAL', open: true })}
/>
```

After `</TipWidget>` and before the hidden `<input>`, add:
```tsx
<AboutModal
  open={state.aboutModalOpen}
  onClose={() => dispatch({ type: 'SET_ABOUT_MODAL', open: false })}
/>
```

- [ ] **Step 2: Run full test suite to verify nothing broken**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/AnalysisPage.tsx
git commit -m "feat: wire AboutModal into AnalysisPage"
```

---

### Self-Review Checklist

- [ ] Spec coverage: Each spec section (Modal, AboutModal, Toolbar grid, context state, AnalysisPage wiring) has a corresponding task
- [ ] No placeholders: All code blocks contain complete, runnable code
- [ ] Type consistency: `SET_ABOUT_MODAL` action name matches across all files
