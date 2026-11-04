# MathForge Phases 4–6: Shared Graph Canvas Integration Report

**Date:** 2026-11-03  
**Status:** Implemented and browser-checked; awaiting user manual acceptance. Not approved.

## Result

Equation Plotter, Ogive Curve, and Histogram/Polygon now render directly in the single workspace canvas used by Coordinates Graph. The workspace does not embed standalone pages or scale full-page screenshots. Original standalone controls remain in place and the standalone pages continue to run from local files.

Workspace controls use the existing standalone input structure and IDs. The input/button ID sequences were compared with the pre-change baseline: Equation (21), Ogive (30), Histogram/Polygon (31). The canvas backing store scales with DPR, resizes with the available plotting region, and maintains pointer-coordinate mapping when logical graph dimensions differ from display dimensions.

## Files changed

- `index.html`
- `Equation.html`, `Ogiveline.html`, `Polygonal.html`
- `assets/js/workspace-core.js`, `assets/js/common.js`
- `assets/js/tools/standalone-adapters.js`
- `assets/js/tools/standalone-control-templates.js`
- `assets/js/tools/equation-plotter-engine.js`
- `assets/js/tools/ogive-engine.js`
- `assets/js/tools/histogram-engine.js`
- `assets/css/workspace.css`
- `assets/css/tools/shared-graph-controls.css`
- Removed obsolete `assets/css/standalone-workspace.css`
- `docs/PROJECT_STATUS.md`, `docs/PROJECT_CHANGELOG.md`
- Added this report

## Verification performed

### Syntax

`node --check` passed for all eight active JavaScript files checked:

- `assets/js/workspace-core.js`
- `assets/js/common.js`
- `assets/js/tools/standalone-adapters.js`
- `assets/js/tools/standalone-control-templates.js`
- `assets/js/tools/equation-plotter-engine.js`
- `assets/js/tools/ogive-engine.js`
- `assets/js/tools/histogram-engine.js`
- `assets/js/tools/coordinates-tool.js`

No root `package.json` or Phase 4–6 automated test script is present; no `npm test` command was available.

### Workspace browser checks

The application was loaded from `file:///D:/MathForge/index.html` in the integrated browser. To represent the requested CSS viewports at the browser's DPR of 1.5, viewport settings were 2880×1620 and 2049×1152.

| CSS viewport | Shared canvas CSS size | Canvas backing store | Result |
|---|---:|---:|---|
| 1920×1080 | 1290×774 | 1935×1161 | Pass |
| 1366×768 | 736×462 | 1104×693 | Pass |

For both viewport sizes, all four tool selections mounted exactly one canvas sized to the workspace plotting host. Captured screenshots were visually inspected at both sizes.

- **Equation Plotter:** plotted `x^2`; invalid `x+` showed the expression error; Clear, Reset, toolbar zoom, and drag-pan were exercised. Zoom changed and pan updated the origin.
- **Ogive:** table row addition and drawing were exercised. In frequency mode, input frequencies `1, 3, 6` produced cumulative values `1, 4, 10` in the graph data. Fit and Reset were exercised.
- **Histogram/Polygon:** table row addition and drawing, Fit, and Reset were exercised. The rendered canvas contained graph pixels (288,407 non-white pixels at the tested viewport).
- **Lifecycle:** tools were switched repeatedly. Each tool's mounted listener count remained stable (Equation 30, Ogive 41, Histogram 42, Coordinates 42); detached tool elements had no active listeners. One canvas remained mounted.
- **Exports:** PNG exports generated nonempty `data:image/png` download URLs. Ogive and Histogram/Polygon SVG actions generated `blob:file:///...` download URLs.
- **Offline resources:** no external HTTP(S) resources were observed while loading the workspace.
- **Console:** no browser console errors or page errors were observed during these checks.

### Standalone browser checks

`Equation.html`, `Ogiveline.html`, and `Polygonal.html` were each opened directly with `file://`.

- Each page mounted its own graph canvas and exposed its original controls.
- Equation drawing and invalid-expression messaging were exercised.
- Ogive and Histogram/Polygon row addition and table-to-graph actions were exercised.
- PNG exports generated nonempty PNG data URLs; statistical SVG exports generated blob URLs.
- No console or page errors were observed.

## Limitations and acceptance

- Browser automation intercepted download-anchor activation to verify generated URLs and filenames; it did **not** confirm that the operating system saved a downloaded file.
- Long control groups remain vertically scrollable in the left input panel. The central graph uses the available workspace plotting region.
- Project storage, SQLite, packaging, and project-file persistence were not changed or tested in this phase.
- User manual verification is still required. Do not treat this phase as approved until the user accepts it.
