# MathForge Phase 4.7 Early Build Report

**Date:** 2026-11-03  
**Project:** MathForge  
**Result:** Implementation complete; release checks remain open

## Summary

Phase 4.7 redesigned the existing workspace and completed practical offline project-management workflows without replacing the graph engines or shared-canvas lifecycle. The workspace now has functional application menus, responsive panel controls, project persistence/import/export, actual project/tool undo and redo, dirty-state warnings, and graph export.

The app and standalone tools were exercised directly from `file://`. The available browser did not provide the requested 1920×1080 or 1366×768 viewport, so those desktop targets remain unverified. No distributable ZIP was created.

## Changed Files

- [`index.html`](../index.html) — Added File/Home/Edit/Help navigation, project/workspace surfaces, and the accessible in-app dialog.
- [`assets/css/workspace.css`](../assets/css/workspace.css) — Added menu/dialog styling and responsive workspace adjustments.
- [`assets/css/tools/shared-graph-controls.css`](../assets/css/tools/shared-graph-controls.css) — Adjusted shared control-panel sizing to preserve graph area.
- [`assets/js/project-manager.js`](../assets/js/project-manager.js) — Added project validation, IndexedDB persistence, `.mathforge` import/export, save/rename/dirty-state handling, undo/redo, folder selection fallback, keyboard shortcuts, and active-canvas PNG/SVG export.
- [`assets/js/workspace-core.js`](../assets/js/workspace-core.js) — Added compact-width panel defaults and aligned the Histogram / Polygon label.
- [`assets/js/tools/standalone-adapters.js`](../assets/js/tools/standalone-adapters.js) — Aligned the tool label and removed duplicate workspace PNG export handling.
- [`assets/js/tools/coordinates-tool.js`](../assets/js/tools/coordinates-tool.js) — Removed duplicate workspace export handling and re-rendered point rows when restoring tool state.
- [`docs/PROJECT_STATUS.md`](./PROJECT_STATUS.md) — Updated current status and phase summary.
- [`docs/PROJECT_CHANGELOG.md`](./PROJECT_CHANGELOG.md) — Added the Phase 4.7 delivery record.
- [`docs/PHASE_4_7_EARLY_BUILD_REPORT.md`](./PHASE_4_7_EARLY_BUILD_REPORT.md) — Added this evidence and limitations report.

A fresh pre-edit backup is available at `backups/phase_4_7_prechange_20261103-112859/`.

## Implemented

- Dark charcoal workspace, MathForge identity, File/Home/Edit/Help menus, offline status, project toolbar, central shared graph canvas, Design & Properties panel, Export Tools, platform information, and status bar.
- Four direct shared-canvas tools: Coordinates Graph, Equation Plotter, Ogive Line, and Histogram / Polygon. No iframe, scaled standalone page, or duplicate graph canvas was introduced.
- Responsive panel collapse/reopen controls. At compact widths, side panels start collapsed; reopening them keeps the controls readable rather than scaling the whole application down.
- Functional New/Open/Open Folder/Save/Save As/Export/Exit and Undo/Redo/Zoom/Rename actions. Keyboard shortcuts avoid hijacking normal typing in text fields.
- Offline IndexedDB saves where supported, portable validated JSON `.mathforge` import/export, project-name and active-tool restoration, tool-specific state, dirty tracking, and unsaved-change warnings.
- PNG and SVG graph export. The SVG export is an SVG wrapper containing the rendered PNG; it is not a vector redraw. PDF is not offered.

## Verification Evidence

| Area | Result | Evidence |
|---|---|---|
| JavaScript syntax | PASS | `node --check` passed for all 10 JavaScript files under `assets/js`. |
| Project test suite | NOT AVAILABLE | VS Code test discovery found zero test controllers, and no configured project test runner was available. No suite result is claimed. |
| Direct-file/offline launch | PASS | Workspace and all four standalone pages opened via `file://`. No page/console errors or external HTTP(S) resource requests were observed. |
| Standalone tools | PASS | Each standalone page rendered one canvas. Equation rendered `x^2`; Ogive converted class frequencies to cumulative values `5, 12, 20`; Histogram converted table rows to graph data `0,10,5`, `10,20,7`, `20,30,3`. |
| Coordinates Graph | PASS | Axes-only default, no plotted sample points, point-row editing, multiple sets, plot/reset, and state restoration were exercised. |
| Equation Plotter | PASS | Valid and invalid expressions, draw, clear, reset, zoom, and pan were exercised. A pan changed the saved canvas rendering and origin; toolbar zoom reported 115%. |
| Ogive Line | PASS | Frequency data for `0–10: 5`, `10–20: 7`, `20–30: 8` converted to cumulative data `5, 12, 20`. Table mode/data survived tool switching; row add/remove, Fit, and Reset were exercised. |
| Histogram / Polygon | PASS | Table conversion, add/remove rows, Fit, Reset, and state restoration across tool switching were exercised. |
| Lifecycle | PASS | Repeated switching between all four tools retained exactly one mounted canvas and a stable controls host; 16 switches were exercised. No page/console errors were observed. |
| Project management | PASS in tested Chromium context | Save/Open/Save As round-trip restored project name, active tool, and tool data. IndexedDB reload recovery, rename, save/clean tracking, unsaved-change cancel/confirm, and actual tool-state Undo/Redo were exercised. |
| PNG export | PASS | Captured non-empty PNG Blobs from each active graph; each had the PNG signature and rendered non-white pixels. Sizes: Coordinates 29,470 bytes; Equation 72,335 bytes; Ogive 36,231 bytes; Histogram 39,753 bytes. Download names used the project name (`Folder Imported.png`). |
| SVG export | PASS for generated output | A non-empty 103,191-byte Blob had an SVG root and embedded PNG image; the download name used the project name (`Folder Imported.svg`). The browser test harness did not confirm an operating-system download. |
| Compact layout | PARTIAL | At 320×533, side panels started collapsed, could be reopened, and did not cause horizontal overflow. At very small viewports, an opened long tool panel requires vertical scrolling. A 911×512 viewport request was capped by the available browser to 607×341; that actual viewport was also exercised. |
| Requested desktop viewports | NOT RUN | The available browser could not provide 1920×1080 or 1366×768 for Phase 4.7. Do not mark either target as passed. |
| Real folder picker and download handoff | NOT VERIFIED | The folder-picker control path was exercised with a stub; an actual OS directory selection and completed OS download were not captured. |
| Listener-leak instrumentation | NOT VERIFIED | Repeated switching showed stable mounted DOM counts, but detached listener counts were not instrumented directly. |
| Distributable ZIP | NOT CREATED | Packaging is deferred until the remaining release checks pass. |

## Known Limitations and Release Gates

1. Re-run browser verification at exactly 1920×1080 and 1366×768, checking canvas size, panel readability, and page overflow.
2. Verify Open Folder with a real supported directory picker and verify saved PNG/SVG/project files through the browser's actual download destination.
3. Instrument listener cleanup directly across repeated tool switches before claiming there are no detached-listener leaks.
4. Confirm project persistence behavior in each intended browser. IndexedDB succeeded under `file://` in the tested Chromium context only; support in other browsers or `file://` environments is not claimed.
5. Create and inspect a distributable ZIP only after the above checks pass. No ZIP is included in this delivery.

Cloud sync, SQLite, PDF export, advanced recovery, and framework migration remain out of scope.
