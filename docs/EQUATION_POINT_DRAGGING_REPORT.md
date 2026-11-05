# MathForge — Equation Plotter Point Dragging Report

**Phase:** 2B — Interaction reliability  
**Date:** 2026-11-05  
**Project:** `D:\MathForge` (the separate GitHub import directory was not used)

## Root cause

The integrated workspace mounts Equation Plotter through the shared standalone adapter. That adapter passes the renderer a logical `canvasView` wrapper, which previously forwarded canvas event listeners and geometry but did not forward Pointer Capture methods. The integrated Equation renderer listened only for `mousedown`/`mousemove` on the canvas and `mouseup` on `window`.

This left touch and pen without a drag path, and a mouse drag stopped receiving movement as soon as the pointer left the canvas. There was no cancellation, capture-loss, or window-blur cleanup path. Hit testing also used a fixed 100 backing-pixel distance, which changed its apparent size with canvas/DPR scaling and did not deliberately select by a user-facing CSS-pixel target.

The mathematical mapping itself was already using the renderer’s shared `screenToWorld()` transform, including effective K/N rates, zoom, pan, and logical canvas dimensions. Point coordinates were already stored in Equation Plotter state and returned by `getState()` for the existing version-1 project persistence path. The fix keeps those systems and the schema intact.

## Implementation

- The integrated Equation Plotter now uses Pointer Events for pointer down/move/up/cancel. It captures the pointer on the backing canvas through the logical canvas adapter, receives movement outside the canvas, and ends a drag on release, cancellation, lost capture, window blur, or unmount.
- `standalone-adapters.js` now forwards `setPointerCapture()`, `releasePointerCapture()`, and `hasPointerCapture()` from the logical canvas view to the actual canvas element.
- Hit testing uses a 14 CSS-pixel radius after converting the logical canvas coordinates through the displayed canvas rectangle. When multiple points are close, the nearest point is selected.
- Dragged points are converted back through the existing inverse graph transform, so independent K/N rates, zoom and pan remain authoritative. Point labels, canvas markers, and the x/y input values update during movement; the point controls are reconciled on release.
- Hover and active drag are visually indicated with a cursor change and a ring around the selected point. A scoped `touch-action: none` rule is applied only to the Equation Plotter canvas while mounted, so touch gestures can manipulate the graph without changing page behavior elsewhere.
- A mouse-event fallback remains for browsers without Pointer Events.
- Equation definitions are not changed by point dragging. No parser, other graph engine, standalone renderer, project schema, or project format version was changed.

## Files changed

- `assets/js/tools/equation-plotter-engine.js`
- `assets/js/tools/standalone-adapters.js`
- `assets/css/tools/equation-plotter-workspace.css`
- `tests/equation-plotter.test.js`
- `tests/project-manager-save.test.js`
- `dist/assets/js/tools/equation-plotter-engine.js`
- `dist/assets/js/tools/standalone-adapters.js`
- `dist/assets/css/tools/equation-plotter-workspace.css`
- `docs/PROJECT_STATUS.md`
- `docs/PROJECT_CHANGELOG.md`
- `docs/EQUATION_POINT_DRAGGING_REPORT.md`

The three affected generated `dist` files were clean in the initial working-tree check and were synchronized directly from source. No preparation/build script was run.

## Working-tree state before edits

The initial `git status --short --branch` was:

```text
## main...origin/main
 M assets/css/tools/coordinates-tool.css
 M assets/js/tools/coordinates-tool.js
 M dist/assets/css/tools/coordinates-tool.css
 M dist/assets/js/tools/coordinates-tool.js
 M dist/service-worker.js
 M docs/PROJECT_CHANGELOG.md
 M docs/PROJECT_STATUS.md
 M service-worker.js
 M tests/phase-4-8-pwa.test.js
?? docs/COORDINATES_POINT_CONNECTIONS_REPORT.md
?? docs/FINAL_PRE_RELEASE_DEEP_AUDIT.md
?? tests/coordinates-connections.test.js
```

All pre-existing changes above were preserved. The three Equation Plotter source/dist targets listed above were not modified before this task. No changes were made in `D:\MathForge-github-import-20261103`.

## Automated verification

- Focused command: `node --test tests/equation-plotter.test.js tests/project-manager-save.test.js` — **19 passed, 0 failed**.
- All non-destructive project tests — **80 passed, 0 failed** across 10 test files. `tests/phase-5-0-vercel.test.js` was excluded because it invokes `scripts/prepare-vercel.mjs`, which deletes and recreates `dist/`.
- Changed JavaScript syntax checks with `node --check` — **4 files passed**: Equation Plotter engine, standalone adapters, Equation Plotter tests, and project manager save tests.
- A read-only SHA-256 check found **37/37** runtime source files matched corresponding `dist/` copies.
- `git diff --check` passed for source, tests and tracked status/changelog edits. Including the synchronized generated JS copies reports their added CR characters as trailing whitespace because those tracked `dist` files use CRLF in the index while `core.autocrlf=true`; the source and dist byte hashes nevertheless match exactly. No source/dist content mismatch resulted.

New focused coverage checks:

1. Point hit testing and visually following the pointer.
2. Pointer-to-world conversion with backing/display size differences.
3. Different K/N rates combined with zoom and pan.
4. Nearest selection when points are close together.
5. Pointer cancellation, release, and continuing movement beyond the canvas edge.
6. Touch, pen, and mouse fallback paths.
7. Equation definitions unchanged during point dragging.
8. Dragged coordinates returned by tool state, restored through `setState()`, and retained by the existing version-1 project save/open path.

## Manual browser verification still required

Browser interaction was **not performed** in this phase. On the served or installed MathForge workspace:

1. Open Equation Plotter and add at least two points with distinct coordinates. Keep at least one equation visible.
2. Hover a point and confirm the cursor/marker indicate that it can move. Drag each point with a mouse, including one drag that moves beyond the graph sheet before release. Confirm it follows the pointer and its displayed x/y values update on release.
3. Drag points close together and confirm the nearest point moves. Check that no new points appear and equation expressions, labels, colors, and visibility are unchanged.
4. Repeat with touch and pen where available. Cancel a touch gesture or switch focus during a drag, then start another drag and confirm the canvas is not stuck in a dragging state.
5. Change K/N rates, zoom, and pan; drag a point and compare its displayed coordinates to the position on the grid. Resize the workspace and repeat.
6. Switch through Coordinates, Equation, Ogive, Histogram, and Pie Chart, then return to Equation Plotter. Save a version-1 `.mathforge` project, close/reopen or import it, and confirm the moved coordinates persist.
7. Open `Equation.html` directly and confirm its standalone controls/rendering still behave as before.

These steps are pending user/browser acceptance, not test results.

## Remaining limitations

- No real browser verification was run for pointer capture, touch-action behavior, visual hit radius, or point labels at different device-pixel ratios.
- Automated tests simulate pointer events in Node; they do not validate browser event dispatch, operating-system touch gestures, or hardware pen behavior.
- The Vercel preparation/build test was intentionally not run to protect generated output from deletion/recreation.
