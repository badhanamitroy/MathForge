# User-Defined Graph Scale Implementation Report

**Date:** 2026-11-04  
**Scope:** Shared mathematical K/N scales for Coordinates, Equation, Ogive, and Histogram. No graph engine was replaced, and no unrelated generator or feature was added.

## Audit and integration decision

The pre-change scaling model and defaults are documented in [EXISTING_GRAPH_SCALING_AUDIT.md](./EXISTING_GRAPH_SCALING_AUDIT.md). In brief, Equation already used independent small-squares-per-unit factors (X 5/1, Y 1/1); Ogive and Histogram used 1/1 on both axes and shared a break-aware forward/inverse transform; Coordinates used an auto-fit uniform data transform while drawing graph paper independently in pixel space.

The implementation keeps those renderers. `assets/js/core/graph-scale.js` centralizes K/N validation and conversions. The settings state stores optional shared `axisScale` values. If that setting is absent, each graph keeps its established engine default; when the user enters K and N, that explicit scale becomes shared across graph selection. This avoids changing old `.mathforge` output merely because the file lacks the new property. Project version remains 1.

## Mathematical model and UI

For each axis independently:

- `value = (gridSquares / K) × N`
- `gridSquares = (value / N) × K`
- Pixel displacement is the grid-square displacement times the current minor-square pixel size and viewport zoom.

The Graph Designs → Graph Paper & Scale section now has X and Y controls for K (positive integer) and N (positive finite number). Decimal N is supported. Invalid or incomplete input displays an error and leaves the last valid setting active. Entering a valid scale updates shared state and redraws the active workspace graph through the existing adapter event path.

The shared scale rate is passed into each tool's existing point/curve/statistical calculations. Ogive/Histogram preserve their X-axis discontinuity and data calculations. Coordinates uses independent X/Y transforms and inverse point-drag transforms; major-axis labels are emitted at mathematical values corresponding to major-grid intervals. Zoom, pan, and canvas resize remain view operations.

## Files changed

- Added `assets/js/core/graph-scale.js` and loaded it from `index.html`.
- Updated `assets/js/core/graph-design-settings.js` with optional axis K/N state, validation, controls, and legacy fallback display.
- Updated `assets/js/tools/coordinates-tool.js`, `equation-plotter-engine.js`, `ogive-engine.js`, and `histogram-engine.js` to read the shared scale rate in forward/inverse transforms and fit/zoom paths.
- Updated `assets/js/tools/standalone-adapters.js` to hide legacy per-tool scale inputs in the workspace panel while retaining them for direct standalone pages.
- Updated `assets/css/workspace.css` for compact axis scale controls.
- Updated `service-worker.js` cache version and precache for the new offline asset.
- Added `tests/graph-scale.test.js`; extended `tests/workspace-graph-designs.test.js` and `tests/phase-5-0-vercel.test.js`.
- Updated this report, `docs/EXISTING_GRAPH_SCALING_AUDIT.md`, `docs/PROJECT_STATUS.md`, and `docs/PROJECT_CHANGELOG.md`.
- Regenerated `dist/` with the existing Vercel preparation command.

## Backward compatibility and known limits

- Older projects without `axisScale` remain valid and use the legacy per-engine defaults until the user sets K/N. The shared K/N choice is saved in the existing `graphDesignSettings` field.
- Coordinates had no fixed mathematical scale before this change; its no-K/N fallback remains 1/1 and the engine retains its data-fit/view behavior. Therefore an explicit K/N setting defines a new grid-aligned relationship between data units and graph squares, as intended.
- Automated checks verify conversion functions, break-aware shared Ogive/Histogram mapping, K/N wiring in all four engines, validation/state round-trip, project format compatibility, and deployable precache assets. They do not simulate interactive pointer dragging through a browser canvas.
- Browser smoke testing, live save/reopen, and live PNG/SVG export comparison remain unverified. Browser Use denied the local `file:///D:/MathForge/index.html` URL under its URL policy; no browser workaround was attempted.

## Tests executed and actual results

- `node --check` over all `assets/js/**/*.js` and `service-worker.js` — passed.
- `node scripts/prepare-vercel.mjs` — completed and prepared `D:\MathForge\dist`.
- Source/dist hash comparison for `index.html`, `service-worker.js`, the K/N utility/settings, all four engines, `common.js`, and `standalone-adapters.js` — all 10 matched.
- `node --test tests/*.test.js` — **27 passed, 0 failed**. The suite was run outside the sandbox because existing Vercel tests start a localhost preview server and sandboxed execution returned `EACCES`.
- Browser/manual graph rendering, point dragging, actual `.mathforge` save/reopen, and PNG/SVG export workflows — not run.

## Manual verification instructions

1. Open the workspace and select Coordinates. In Graph Designs → Graph Paper & Scale, enter X `K=5, N=1` and Y `K=2, N=5`; confirm the plotted points and major labels use the two independent scales.
2. Enter a decimal N such as `2.5`, then try K `0`, K `1.5`, and N `0`; confirm invalid values show the message and do not change the graph scale.
3. Switch among Equation, Ogive, and Histogram. Confirm the K/N values remain shared, each graph redraws, and each tool's mathematical data is unchanged.
4. In Coordinates, drag a point and confirm its displayed coordinate remains consistent with its position relative to the selected grid. In Ogive, drag a point and confirm only the cumulative-frequency value changes.
5. Zoom, pan, resize the canvas/aspect ratio, and use each available fit/reset action. Confirm K/N inputs do not change.
6. Save a `.mathforge` project with a non-default K/N scale, close/reopen it, and confirm all four values persist. Open an older project with no K/N setting and confirm it loads.
7. Export PNG and SVG from at least one graph and compare the exported graph sheet with the live canvas.
8. Open each standalone graph HTML page directly and confirm its original controls and rendering remain available.
