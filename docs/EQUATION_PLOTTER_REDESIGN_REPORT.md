# Equation Plotter Redesign Report

**Date:** 2026-11-05

## Previous limitations and inspected architecture

The workspace Equation tool was backed by `assets/js/tools/equation-plotter-engine.js`, but its UI exposed one `fn` field for `y=f(x)` and a separate mode switch for a newline-delimited list of points. The old parser was embedded in that engine, accepted only `x`, and returned a one-variable function. It could not represent `y`, relation signs, conics, or inequalities. Equation-specific scale/zoom fields were lifted from the legacy template into the right panel, while the app already had a shared graph canvas, K/N state, grid and infinite-axis helpers, zoom toolbar, project tool-state serialization, and canvas-based export path.

The existing direct Equation standalone page also loads the same engine, which auto-mounts its legacy implementation outside `#mfWorkspace`. The redesign therefore adds a workspace-only mount path and leaves the standalone mount path available.

## New architecture and supported expressions

- `assets/js/core/equation-math.js` is a local safe tokenizer, parser, and evaluator. It creates expression trees and never uses `eval()`, `Function()`, or arbitrary JavaScript execution.
- The parser accepts numbers, decimals, scientific notation, parentheses, implicit multiplication such as `2x`, arithmetic `+ - * / % ^`, constants `pi`/`e`, and `abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `exp`, `floor`, `ln`, `log`, `log10`, `max`, `min`, `pow`, `round`, `sin`, `sqrt`, and `tan`.
- Input is classified as an explicit `y=f(x)` function, direct/reversed `x=f(y)` relation, implicit equality `F(x,y)=0`, or inequality. A plain one-variable expression means `y=f(x)`. Invalid or unsupported syntax produces a row-level validation message.
- Trigonometric arguments are radians; the equation input group says so.
- The left Inputs panel renders unlimited dynamic equation and point rows. Equations retain stable IDs, editable labels, expressions, per-row colors, visibility, and delete controls. A Plot / Update action validates and replots equations. Points retain their own labels, coordinates, visibility, and delete controls.

## Rendering algorithms and shared graph integration

The Equation workspace path renders into the adapter's existing `canvasView`; it creates no second display canvas. The transform uses the shared graph paper spacing and `MathForgeGraphScale.effectiveRate()` for independent X/Y K/N rates, with zoom and pan applied to the same origin for curves, contour boundaries, inequality regions, and points. It uses the active shared grid, axis visibility/colors, canvas aspect ratio, typography, and the existing infinite-axis drawing helper.

- Explicit functions are sampled across the visible input-axis range. Invalid samples and large screen-space jumps start a new path segment, which prevents tangent branches from being joined through asymptotes.
- Implicit equalities use a bounded marching-squares grid. Edge crossings are linearly interpolated; ambiguous four-crossing cells use the cell-center sign to choose a pairing.
- Inequalities sample the visible region and fill contiguous horizontal runs at the sampled cell resolution. Their boundary reuses the implicit contour. Strict `<`/`>` boundaries are dashed; inclusive `<=`/`>=` boundaries are solid.
- Coordinate points share the graph transform, render with adjacent coordinate labels, and can be dragged. A simple collision check tries alternate label offsets.
- Sampling budgets are bounded and reduced as more equations are visible so dense equation sets do not multiply the maximum renderer work without limit.

## Project state and exports

New state is returned through the existing Equation adapter and stored under `toolStates["equation-plotter"]`. It contains equations, points, visibility, stable IDs, colors, zoom, pan, and line width. No `.mathforge` version or Project Manager storage format changed. When restoring old Equation states containing `{ controls: [...] }`, the engine migrates the legacy function, point list, zoom, origin, and canvas size into the new state shape. Project tests verify version-1 save/reopen and existing legacy-state tests verify migration.

Equation export now delegates through the registered active-tool export method. PNG is drawn to an offscreen canvas with an explicit opaque `#FFFFFF` fill, then encoded at the shared canvas's logical dimensions. SVG contains an explicit white `<rect>` and embeds the PNG rendering, matching the existing MathForge embedded-image SVG export convention. Hidden equations and hidden points are skipped. Export is blocked for invalid or edited-but-not-yet-plotted visible equations.

## Files changed

**Application source**

- `index.html` — loads the local expression parser and the new Equation workspace stylesheet.
- `service-worker.js` — precaches the parser and advances the local shell cache name.
- `assets/js/core/equation-math.js` — safe expression parser and relation classifier.
- `assets/js/tools/equation-plotter-engine.js` — workspace-only multi-equation renderer and state migration; the standalone mount remains in place.
- `assets/js/tools/standalone-adapters.js` — provides compact Equation workspace inputs, preserves the shared zoom/size hooks, and routes Fit/Reset through the new engine.
- `assets/js/workspace-core.js` — updates Equation generator metadata/capabilities.
- `assets/js/project-manager.js` — delegates Equation PNG/SVG export to the active engine.
- `assets/css/tools/equation-plotter-workspace.css` — scoped Equation-only input styling.

**Tests and generated output**

- `tests/equation-math.test.js` — parser and classification tests.
- `tests/equation-plotter.test.js` — workspace controls/rendering, state, points, transform, discontinuity, validation, and export tests.
- `tests/project-manager-save.test.js` — Equation version-1 save/reopen and export delegation tests.
- `tests/phase-5-0-vercel.test.js` — verifies the new local parser is in the precache manifest.
- The Vercel preparation process regenerated the corresponding changed `dist/` assets.

**Documentation**

- `docs/PROJECT_STATUS.md`
- `docs/PROJECT_CHANGELOG.md`
- `docs/EQUATION_PLOTTER_REDESIGN_REPORT.md`

No Pie Chart engine or stylesheet, Coordinates, Ogive, Histogram engine, standalone Equation HTML page, or project-format version was changed.

## Test and build results

- Focused command `node --test tests/equation-math.test.js tests/equation-plotter.test.js tests/project-manager-save.test.js`: **18 passed, 0 failed**.
- Full command `node --test tests/*.test.js`: **69 passed, 0 failed** in one run, including the Vercel preview tests.
- Two subsequent full reruns completed with **67 passed, 2 failed**. Both failures were intermittent in the pre-existing `tests/indexeddb-project-store.test.js` mock tests: one read an undefined stored value as JSON, and one read an undefined transaction result. The failures are outside the Equation changes; the focused Equation and Project Manager tests passed in those runs.
- `node --check` over all `assets/js/**/*.js`, all `tests/*.test.js`, and `service-worker.js`: **passed**.
- `node scripts/prepare-vercel.mjs`: **completed successfully**.
- SHA-256 comparisons for the eight changed runtime/build files (`equation-math.js`, Equation workspace CSS, Equation engine, standalone adapter, Project Manager, workspace core, `index.html`, and service worker): **8/8 source/dist matches**.

## Browser status and remaining limitations

No browser interaction test is claimed. The open browser showed an older in-memory workspace. A separate tab was opened for verification, but the Computer Use tool stopped before it could navigate because it could not determine the current browser URL with enough confidence. Automated tests exercise the renderer with a canvas harness; they do not replace visual review in Chrome/Edge.

Known technical limits:

- Implicit contour and inequality shading are numerical approximations at a bounded grid resolution. Very thin regions or features smaller than a cell can be missed; this is not a symbolic algebra system.
- SVG export follows the existing embedded-raster convention: it is an SVG container with an explicit white background and the rendered PNG embedded inside. PNG is the native pixel export.
- Point label placement tries a small set of alternate offsets; dense clusters may still overlap.
- Piecewise expressions, derivatives, parametric curves, complex values, and arbitrary function definitions are not implemented. Unsupported syntax is reported instead of treated as plotted.

## Manual browser verification

1. Open `D:\MathForge\index.html` in Chrome or Edge and select Equation.
2. Add three rows using `y = 2x + 3`, `x^2 + y^2 = 25`, and `y = x^2`. Click Plot / Update and confirm all three colored curves share the same plane.
3. Try `x^2/9 + y^2/4 = 1`, `y^2 = 4x`, and `x^2/9 - y^2/4 = 1` in separate rows; confirm ellipse, sideways parabola, and hyperbola boundaries.
4. Try `y > 2x + 1` and `x^2 + y^2 <= 16`; confirm shading and dashed-versus-solid boundaries. Try `y = tan(x)` and confirm branches stop near asymptotes.
5. Add points with positive, negative, and decimal coordinates. Drag a point; pan empty graph space; zoom with the wheel and shared toolbar. Change X/Y K/N values and confirm points and equations follow the same scale.
6. Hide and delete equations and points independently. Enter unsupported text, confirm a row error appears, then correct it and replot.
7. Save and reopen a new Equation project, then open an older version-1 project with Equation control state.
8. Export PNG and SVG. Confirm both have a solid white background and contain all visible equations and points; confirm hidden rows are omitted.
9. Open `D:\MathForge\Equation.html` directly and verify its existing standalone controls still mount.
