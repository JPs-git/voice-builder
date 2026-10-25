# Portrait Statistics Banner Implementation Plan

**Goal:** Implement approved A design: a compact, permanent two-line expectation banner on the portrait recording page.

**Design:** After page tabs and before reading content, show “建议录制 30–60 秒，最长 60 秒” and “短文仅供参考，可自由选择说话内容”. The question icon opens existing recording-statistics help. Banner uses normal document flow, about 52px tall, no close control. Visible through all recording task phases regardless of intro flags. Replace portrait recording first-use overlay; leave desktop, other pages and report details unchanged. Reader fills remaining space and scrolls internally. Approved preview: statistics-banner-a-390x844.png.

**Architecture:** RecordingPage owns portrait-only banner; existing ContextHelpButton and ShellContext open shared help. AppShell excludes only portrait recorder from legacy first-use overlay. Scoped CSS preserves flex sizing and Dock clearance.

**Steps:**
- [x] Update portrait integration tests for permanent content, help/focus, task phases, report absence and legacy overlay suppression; verify RED.
- [x] Add inline banner and scoped styles; verify targeted tests GREEN.
- [x] Synchronize functional/UI specs; verify 390×844 and narrower portrait geometry and desktop preservation in browser.
- [x] Run full tests, build, TypeScript and diff checks; commit verified implementation.

**Baseline:** 9439f25 / v1.19.1, clean worktree; 693 tests passed. No recording, DSP, analytics schema or navigation changes required.

**Verification (2026-10-25):** RED: portrait guide test failed as expected before implementation. GREEN: 3 targeted files / 44 tests passed; full 91 files / 693 tests passed. Production build and `npx tsc --noEmit` passed. Corrected Testing Library exact-name query typing, then re-ran all 6 portrait tests successfully. Existing bundle-size warning remains. Browser: 390×844 banner 52px; 320×640 with enlarged text banner still 52px, document width 320px and main client/scroll heights both 550px; article scrolls internally. Shared help opens statistics topic and returns focus. Desktop 1440px retains legacy intro and no permanent banner. Screenshot: statistics-banner-a-implemented-390x844.png.

Independent review: no actionable defects or regressions found in portrait conditions, banner sizing, Dock clearance, shared help/focus, desktop or report behavior.

## Approved desktop A extension

User selected A and requested implementation. RecordingReader desktop header: after 阅读材料 and shared help icon, show both same sentences as portrait in small muted text, with 30–60 秒 emphasized and a subtle separator. Keep one line when possible, wrap sentences at narrower widths without overlapping fixed font controls. No new banner, no changes to report or portrait.

Steps: update RecordingReader and scoped header CSS; synchronize functional/UI specs; check wide/narrow desktop and portrait preservation in browser; run relevant integration tests, build and types. No new test needed for this reversible text/layout-only change; use existing flow tests plus real browser geometry.

Desktop extension verification: 22 existing portrait/route integration tests passed; production build and TypeScript checks passed (existing bundle-size warning only). Browser at 1440×900 and 800×600 displays both sentences in one line, no horizontal overflow or main scrolling; desktop boundary width also fits without overlapping font controls. At 390×844 only the original permanent banner is shown, with no duplicate header copy. Shared flex wrapping supports narrower available content width. Independent review found no actionable issue. Screenshot: statistics-guide-desktop-a-implemented.png.
