# Recording Dock state UI plan

**Spec:** approved Dock state board `exec-8ad4cdbe-7dbc-4aae-ac00-8ae6f4c89824.png` and current recording statistics spec.
**Goal:** Match the approved six Dock states using existing Button, RecordDock and reference menu components.

- [x] Add failing regressions for always-visible disabled completion during capture, SVG pause/play, article switching without capture/time reset, cancellation through More, multi-reference report metadata.
- [x] Keep reference control in the leading slot, put cancellation/preparation in More, reuse shared ghost buttons for both side controls. Use centered SVG mic/pause/play/spinner icons and unchanged three-track geometry.
- [x] Keep completion visible and disabled in capture/request/processing, enabled only in paused nonempty draft. Keep shared toolbar completion behavior consistent.
- [x] Allow reference switching in capture/paused/request and retain selected material snapshots separately from PCM; report lists all referenced articles without claiming verified reading content. Lock reference during import/analysis.
- [x] Update current specs/help/UI docs. Run full tests, build, tsc, diff check; browser-check 360px ready/selection/processing and normal report flow; recording states use automated capture mocks unless real device is available.
- [x] One independent final review, then commit.

Execution uses the existing isolated feature worktree. No DSP, recording duration, persistence or report navigation changes.


Execution ledger: Dock-state test RED→GREEN, old cancellation/reference-lock assumptions updated. Full suite 659 passed; build and tsc pass. Actual shared components browser-checked at 360px with synthetic PCM; capture/paused/processing screenshots saved. Temporary QA entry points removed.
Final review: no substantive findings. Final minor (deferred, existing): MobileMoreMenu lacks automatic item focus/arrow-key navigation; Tab still reaches cancellation. No menu-navigation expansion in this UI task.
Browser regression found existing disabled-style specificity kept the 60-second button pink; read-only computed-style assertion failed, then passed after a scoped paused-disabled rule. This does not affect loading or realtime colors.
