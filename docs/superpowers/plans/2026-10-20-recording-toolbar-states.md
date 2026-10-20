# Desktop recording Toolbar state plan

Approved reference: `exec-819ade6e-3379-40d0-ae77-30861e0a08b6.png`. Existing state machine and completion behavior stay unchanged.

- [x] Add failing desktop tests for SVG record/pause/continue/loading, disabled visible completion and import, enabled completion only paused, 60s cap and report-only return.
- [x] Extract reusable recording SVG icons from Dock; extend existing Button/ToolItem icon input to ReactNode while retaining string compatibility. Use shared SVGs for recording toolbar actions, keep true-centered nav grid and existing More behavior.
- [x] Stabilize desktop recording action slots across recording/paused/cap/analyzing; verify wide and narrow layouts without overlap. Retain existing responsive wrapping instead of changing page structure.
- [x] Run full tests, build, tsc and browser state/centering checks with synthetic input. Update current UI spec and verification, independent review and commit.

No DSP, material metadata, recording workflow, persistence or report route changes.


Execution ledger: desktop SVG/state regression RED→GREEN. Existing state machine unchanged. Shared icon renderer extracted; strings remain supported in Button/ToolItem. Browser 1440px nav center720 and fixed 120/104/104/104px slots through pause/cap/analysis; 1024px nav center512 and right-side wrapping has no overlap/overflow. Temporary simulated-capture entry removed.
Final review: one P2 permission-caption overflow in the 120px primary slot. New pending-caption test RED→GREEN; visible text shortened to 授权中… while full aria-label/title remain 麦克风授权中…. Browser caption right1014.74 < button right1036. No other findings or deferred minors.

Final gate: 89 files/661 tests passed, build/tsc/diff check passed. No remaining substantive findings or deferred minors.
