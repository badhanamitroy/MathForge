# Pie Chart Integration Architecture Audit

**Phase 0 inspection:** 2026-11-05. This audit and plan were completed before implementation changes.

## Existing architecture

MathForge is a dependency-free classic-script application. `index.html` contains the three-column workspace shell, one horizontal generator toolbar, the left input mount, a shared center stage/mount, shared Graph Designs controls, and the export footer. `assets/css/workspace.css` and `assets/css/tools/shared-graph-controls.css` define its shell, panel, toolbar, and control styles. Existing standalone HTML pages and the standalone engines/adapters remain their own entry points.

`assets/js/workspace-core.js` owns active-tool state, registry, button state, mount/unmount/resize/render lifecycle, and per-tool `getState`/`setState` calls. The toolbar is DOM-authored in `index.html`; delegated selection uses each button's `data-tool-id`. Coordinates registers from `coordinates-tool.js`; Equation, Ogive, and Histogram register adapters from `standalone-adapters.js`, which use their existing engines and shared canvas factory. Each adapter mounts its own controls into `#mfToolControlsContainer` and one canvas into `#mfToolMountContainer`; it retains engine state across unmount and tool changes.

`assets/js/core/graph-design-settings.js` owns the shared visual settings state and binds the fixed right-panel controls. `standalone-adapters.js` mirrors selected shared visual controls into legacy engine inputs. Cartesian K/N and axis behavior is provided by `graph-scale.js`, `common.js`, and the existing engines. Pie Chart is not Cartesian, so its renderer must not use these transforms or axis settings. Canvas resizing is coordinated by the workspace and the shared graph adapters; the Pie renderer should use an SVG viewBox and ResizeObserver/container geometry instead of creating another graph canvas.

## Persistence and export

`assets/js/project-manager.js` serializes `{format:"mathforge-project", version:1, activeTool, toolStates, graphDesignSettings, ...}`. The workspace supplies the `toolStates` map by asking each registered tool for state. Version-1 validation currently has an explicit tool-ID allowlist, which must admit the Pie ID while continuing to accept old files with no Pie state. Pie state can be stored under its own `toolStates` key; no schema version change or IndexedDB modification is needed. Save queue, recovery writes, Open, Save As, Recent Projects, and IndexedDB lifecycle behavior remain in the existing Project Manager/store.

PNG export currently reads the active workspace `<canvas>` and produces a PNG. Its SVG option wraps that raster PNG in SVG. Existing standalone table tools also have engine-local SVG exports. Pie should expose a first-class engine export method that serializes the same visible SVG for SVG output and rasterizes that SVG for PNG. The Project Manager export action must delegate to the active tool when it provides an export result, while preserving the existing canvas export fallback for the four current engines.

## Relevant files and responsibilities

| File | Responsibility | Integration work expected |
|---|---|---|
| `index.html` | Workspace shell, toolbar, shared settings, classic script order | Add the Pie button and local calculator/renderer scripts; retain existing IDs |
| `assets/js/workspace-core.js` | Registry, selection, lifecycle, toolbar state, tool states | No separate navigation system; existing registry is sufficient |
| `assets/js/tools/standalone-adapters.js` | Existing Equation/Ogive/Histogram workspace adapters | Keep these adapters and engines unchanged |
| `assets/js/core/pie-chart-calculations.js` (new) | Pure numeral parsing, validation, percentages, exact angles, largest remainder | Independent mathematical API; no DOM/rendering |
| `assets/js/tools/pie-chart-engine.js` (new) | Pie inputs, SVG rendering, accessibility/interactions, legend/table/steps, state and export | Register one native workspace tool with existing lifecycle and input mount |
| `assets/js/project-manager.js` | Project validation/serialization, local persistence, menu and graph export | Allow Pie ID; delegate export result with existing canvas fallback |
| `assets/js/core/graph-design-settings.js` / `index.html` | Shared visual preferences and right-side controls | Keep shared settings source; hide Cartesian-only graph-paper/K/N/axes controls for Pie; support Pie-friendly styling |
| `assets/css/workspace.css` and new Pie tool CSS | Workspace and tool styling | Style responsive Pie inputs and SVG presentation in the existing theme |
| `service-worker.js` | Offline application-shell asset list | Precache new local JS/CSS assets |
| `scripts/prepare-vercel.mjs` | Static source-to-`dist/` preparation | Existing recursive asset copy should include Pie assets |
| `tests/*.test.js` | Math, workspace, persistence, export and deployment regression checks | Add pure calculation and Pie integration/render serialization tests |

## Exact integration plan

1. Add a fifth button to `#mfToolList` with stable ID `pie-chart` and the existing button/card semantics and icon style.
2. Implement a pure calculation module for Unicode Bengali/English digit normalization, validation, percentage/exact angle calculations, and deterministic largest-remainder allocation.
3. Implement a Pie tool adapter/engine using the same `registerTool`, `mount`, `unmount`, `resize`, `render`, `getState`, `setState`, `reset`, and `export` contracts. It will put chart controls in the left input host and a single accessible SVG in the existing center mount. Category IDs/colors/order and chart options will be part of the tool's own state.
4. Preserve last valid chart calculations during partial/invalid input; reject negative values and require two positive categories to render. Use the initial eight-color palette plus deterministic extended colors.
5. Render pie/donut slices as SVG paths; expose keyboard-focusable slices, synchronized legend highlighting, tooltips, calculation table copy, and cumulative manual drawing steps. Keep exact angles distinct from whole-degree allocation.
6. Add a Pie-aware rule to shared design controls so Cartesian grid, axis, and K/N controls do not appear for Pie; keep the common background, typography, and color system available where useful. Avoid adding a duplicate common-settings store.
7. Extend Project Manager's existing allowed IDs and export delegation without changing the project envelope, save store, or `.mathforge` version. Update offline precache entries and tests.
8. Run syntax checks, all automated tests, Vercel preparation, and source/dist comparisons. Browser interaction will be reported only if actually run.

## Technical limits found

- Tool metadata has placeholder entries in `workspace-core.js`, while actual integrated tools register adapters after initialization; the new Pie adapter should follow that working sequence.
- The toolbar list is hand-authored in HTML, so adding a registration alone will not make Pie visible.
- The Project Manager explicitly rejects unknown tool IDs today, so adding the registry entry without the allowlist update would break reopening Pie projects.
- Existing workspace export is canvas-oriented. SVG-native Pie output requires an active-tool export path, with existing canvas export retained as fallback.
- The supplied visual reference was not present as a separate file under the project root during the audit. The implementation will follow the detailed behavior and examples in the request (Bengali title/unit, eight-color starting palette, pie/donut, calculations and steps) and the existing MathForge design system.

No architectural blocker was found; implementation can proceed using the existing registry, state, canvas mount, and project infrastructure.
