# Recording pause and shared DSP implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task in the existing feature worktree.

**Goal:** Implement the approved pause/confirm workflow and shared DSP boundary, together with the pending reader and mobile refinements.

**Architecture:** Extract the common streaming base analysis into `src/dsp/base-analysis.ts`. Both the existing full-feature pipeline and recording Worker consume the same raw frames. Recording draft state remains separate from report records and only explicit completion launches analysis.

**Tech Stack:** React, TypeScript, Vitest, Web Audio, existing DSP and CSS modules.

**Spec:** `docs/superpowers/specs/2026-10-18-recording-statistics-design.md` (2026-10-20 revision).

## Global constraints

- Shared 16000Hz, 800-sample window, 160-sample hop, existing gate and 60–1000Hz detector; statistics filter 60–500Hz only after detection.
- No new dependencies; realtime formants/register behavior and ten-second buffer remain.
- Recording max 60s actual PCM, pause has no silence/time, completion only when paused; imports still analyze immediately.
- Portrait default 20px, desktop 22px; manual font survives rotation. Equal Dock tracks, no report Dock.
- Existing global intro memory and shared help only; no persistence or record list.

## Review focus

- Late samples from a paused capture must not append to resumed drafts.
- Resume permission/rate failure must retain previous PCM and remain completable.
- Chunk boundaries and repeated flush must not change raw frames or synthesize tail evidence.
- Long Dock actions and visible intro must leave article internally scrollable at 360px.
- Background route changes must pause drafts, never implicitly analyze or navigate.

## Task 1: Shared base DSP

Files: create `src/dsp/base-analysis.ts`; modify `analysis-pipeline.ts`, recording `analyzeClip.ts`; tests `src/__tests__/dsp/shared-base-analysis.test.ts`.

Interface: `BaseAnalysisPipeline({onFrame,vadOptions})`, `pushChunk(samples,rate)`, `flush()`, `reset()`. Base frame includes real samples, magnitude, voiced/rms/rawF0, start/duration/window center.

- [x] Add and run failing parity/idempotent-tail tests across 16/44.1/48kHz and varied chunks.
- [x] Move base framing/gate/detection into shared module; retain full pipeline optional stages and UI time projection.
- [x] Route recording analysis through base pipeline, run shared DSP regressions.

## Task 2: Paused recording draft

Files: recording `sessionController.ts`, `types.ts`; tests `recording-session.test.ts`.

Interface: `pause()`, `resume():Promise<void>`, `finish()` (paused only), phase `paused`, snapshot `atLimit:boolean`. Keep complete PCM across resumes with capture generation separate from task ID.

- [x] Add failing tests for pause/no analysis, repeated resume/late callbacks, cap/no analysis, resume errors/rate changes, leave/preserved draft.
- [x] Implement capture guards, paused draft, explicit completion, cancellation and interruption behavior.
- [x] Run session/worker regressions; replace superseded automatic-finish assumptions.

## Task 3: Controls and help

Files: recording toolbar/page/reader/preferences/reference controls, AppShell, RecordDock, FirstUseHelpBanner and relevant CSS/help content; tests recording portrait/route/page and help experience.

- [x] Add failing UI cases for pause/continue/finish, per-layout default/manual font, global intro navigation and contextual help.
- [x] Wire toolbar and Dock actions, three equal tracks, timers/limit notice; hide old-results/import/material during draft.
- [x] Replace desktop redundant text with help button styled as link, shared theme/focus return; portrait stays compact.
- [x] Measure intro height for portrait article space, reuse global eligibility/dismissal and contextual copy.
- [x] Update superseded route/help tests and run relevant suite.

## Task 4: Verify and review

- [x] Run `npm test`, `npm run build`, `npx tsc --noEmit`, `git diff --check`.
- [x] Browser-check desktop/360px controls, article scroll and visible intro; use synthetic input for report checks.
- [x] One independent final review; fix substantive findings with regression tests.
- [x] Update spec implementation status, UI documentation and verification record; commit scoped changes.

## Execution ledger

User explicitly requested implementation after spec revisions; continue inline without another approval handoff. Existing isolated worktree `feat/recording-statistics` reused.


Task 1 complete: shared base RED→GREEN; 151 DSP tests at first gate, additional full-pipeline parity regression included in final suite. Base settings now share constants; recording analysis version advanced to v3.
Task 2 complete: three dedicated pause regressions RED→GREEN; old implicit-finish tests superseded. Rate mismatch uses the approved rejection path, preserving the original draft for completion.
Task 3 complete: reader-help/default-font tests RED→GREEN; route, portrait and global first-use regressions pass. Browser 360px measures equal tracks and centered mic; article ends above intro.
Task 4 complete: 89 files/657 tests, build, tsc passed. Fresh independent review: no substantive or minor findings. Reviewer left real viewport and physical microphone verification to execution; viewport checks completed, physical microphone remains untested.
