# Recording Statistics Analytics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. User authorized implementation on 2026-10-20.

**Goal:** Implement the approved anonymous statistics recording/report event specification without changing UI or DSP behavior.

**Architecture:** Extend the existing guarded analytics transport with fixed recording task context. Capture state transitions in the recording controller, report entry in routing, and playback success in its controller. Keep IDs in memory only.

**Tech Stack:** TypeScript, React, Vitest, existing Umami/Vercel wrapper; no new dependencies.

**Spec:** ../specs/2026-10-20-recording-statistics-analytics-design.md

## Global Constraints

- Existing feat/recording-statistics worktree only; master untouched.
- No audio, file/material names, exact durations, report IDs, acoustic results, raw errors or arbitrary properties in payloads.
- Preserve environment/DNT/preferences/queue guards; no local or Preview reporting.
- No UI, DSP, recording workflow changes. Explicit user cancels only; background analysis keeps recording attribution.

## Review Focus

- Pending microphone callbacks after cancellation and callbacks arriving before permission Promise resolves.
- Analysis completion/cancellation races and retries after moving to another route.
- Report entry duplication under StrictMode, POP navigation and responsive rerenders.
- Playback seek rebuilding audio sources must not count as user playback starts.
- Filtering must apply equally to delayed business events, SDK pageviews and referrers.

## Task 1: Transport and event contracts

- [x] Add failing tests in analytics.test.ts for recording/report routes, ID redaction, whitelist properties, fixed recording task URL across navigation and disabled queue behavior.
- [x] Extend src/analytics/analytics.ts with typed event unions, strict validation, canonical report URLs and constrained recording task tracking.
- [x] Verify targeted analytics tests (expected all pass).

## Task 2: Recording task events

- [x] Add controller analytics regression tests for recording/pause/resume/finish, import/error/retry/cancel, stale callbacks and engagement.
- [x] Add a small recording analytics helper for duration buckets and error enums; instrument sessionController.ts at guarded state transitions. Use typed internal import/worker errors where current errors lack classifications.
- [x] Verify session, pause and analytics tests (expected all pass).

## Task 3: Report entry and playback

- [x] Add failing route/playback tests for entry once, auto/latest/other, unavailable and seek suppression.
- [x] Add one-use in-memory report navigation metadata and report entry tracking; instrument successful user playback only.
- [x] Verify report, route, portrait and playback regressions (expected all pass).

## Task 4: Documentation and final verification

- [x] Update docs/analytics.md and spec implementation status, including limitations of anonymous funnels.
- [x] Run npm test, npm run build, npx tsc --noEmit and git diff --check; inspect results.
- [x] Obtain one final independent review as required by executing-plans; fix actionable issues and retest.
- [x] Commit verified changes and summarize limitations (production platform validation requires deployment).

## Execution ledger

- Baseline: 58190f3; existing isolated worktree verified clean.
- Pre-flight: task 1 event schema/fixed context feeds task 2 controller and task 3 routing/playback; all must preserve existing analytics mocks and old event properties. Tasks 2 and 3 share no business ownership; report tracking must stay independent of recorder.

- Task 1: RED 3 new tests failed; GREEN analytics tests 29/29. Contract definitions extracted into analytics/events.ts to keep transport focused; runtime filtering unchanged for legacy pages.
- Task 2: RED 6 controller tests failed, import classification and worker reason tests failed; GREEN targeted recording/session/pause and import/worker tests. Controller generations own dedup; typed errors preserve displayed messages without regex classification.
- Task 3: RED report entry and playback tests failed; GREEN 25 route/playback/detail tests. Ruling: one-use WeakMap keyed by record store holds navigation intent, never router history state, so POP cannot inherit auto/latest provenance.
- Integration: real guarded transport + session controller with local SDK stand-in proves recording attribution after route change and opt-out without interrupting capture. No telemetry requests sent.

- Final verification: 91 files / 692 tests passed; production build passed (existing chunk-size warning); TypeScript and diff checks passed. Corrected an integration test Array.at usage to respect the existing compiler library target, then reran types and that test successfully.
- Independent fresh review: no actionable findings across payload privacy, capture generations, background tasks, report entry and playback deduplication.
- Production telemetry acceptance remains deferred until deployment; SDK stand-in tests made no network requests. No UI or DSP changes.
