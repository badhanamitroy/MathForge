# Infinite Standard Coordinate Axes — Architecture and Plan

**Phase 0 inspection:** 2026-11-04. This report was created before implementation changes.

## Existing architecture

The shared K/N model is documented in [EXISTING_GRAPH_SCALING_AUDIT.md](./EXISTING_GRAPH_SCALING_AUDIT.md) and [USER_DEFINED_GRAPH_SCALE_REPORT.md](./USER_DEFINED_GRAPH_SCALE_REPORT.md). `assets/js/core/graph-scale.js` owns K/N validation, conversions, and effective rates; `assets/js/core/graph-design-settings.js` owns the optional shared X/Y K/N values and grid spacing/major interval. No second transform or settings state is planned.

| Engine | Origin and plotted coordinate path | Current axis/grid behavior |
|---|---|---|
| Coordinates | `makeTransform` produces `xToPx/yToPx` and inverse `pxToX/pxToY`; the origin is obtained by applying those same forward functions to (0,0). Dragging uses the inverse transform. | `drawGraphPaper` is pixel-grid based and anchored at transformed (0,0). Axis segments currently use data-bound endpoints, axes are rendered only on the origin row/column, arrowheads are absent, and endpoint labels are not consistent with the visible canvas boundaries. |
| Equation | Local `worldToCanvas` and `canvasToWorld` use the existing K/N effective rates, `minorPx`, zoom, and pixel origin from the existing `origin` control. | `drawGraphPaper` is anchored at that pixel origin. `drawAxes` draws from canvas edges through the origin but only places positive X and positive Y arrows; axis labels use fixed endpoint offsets. |
| Ogive | Shared `common.js` `worldToCanvas/canvasToWorld` use K/N rates and preserve the statistical X-axis break; pan/zoom update the existing pixel origin. | `common.js` graph paper and axes are both anchored at the existing origin. `drawAxes` already spans canvas edges but only has positive direction arrowheads. Axis break is a separate statistical visualization and must stay separate from axis geometry. |
| Histogram | Same shared break-aware transformations as Ogive; bars, polygon, and labels map data through `worldToCanvas`. | Uses the same shared graph paper and axes implementation as Ogive, so arrowhead and endpoint-label corrections can be shared without changing histogram calculations. |

The common graph-paper renderer draws minor and major grid lines at integer pixel-square offsets from (ox,oy). Its major lines occur at multiples of `majorEvery`; therefore the mathematical origin is a major-grid intersection. K/N determines data-unit displacement in small squares; `majorEvery` remains a visual interval and does not redefine one unit. The workspace adapter preserves canvas dimensions/aspect ratio and asks the active engine to resize/render. Project serialization already persists `graphDesignSettings`; legacy files with no K/N state continue through the existing fallback. PNG export reads the active canvas. SVG export embeds that same canvas PNG, so there is no independent export axis path.

## Phase 0 conclusion and implementation plan

Keep the existing forward/inverse transforms, origin controls, K/N settings, graph engines, project envelope, and export path. Add one shared canvas-axis drawing primitive in `common.js` that:

1. Receives the current pixel origin from each engine's existing coordinate transform and draws clipped horizontal/vertical segments to the canvas edges only when the corresponding zero-coordinate line intersects the visible canvas.
2. Draws both endpoint arrowheads inside the canvas, aligned to the conventional positive/negative directions, and places `X′`, `X`, `Y`, `Y′`, and `O` against those same segments. The origin label is emitted only when (0,0) itself is in the visible canvas.
3. Leaves the origin at the actual transformed location. If a zero-coordinate line lies outside the current viewport, it remains outside rather than being moved to a border; the perpendicular zero line can still remain visible when it intersects the viewport.
4. Reuses existing origin positions after zoom, pan, canvas resize, and ratio changes. Since exports capture the rendered canvas, the same renderer is used for PNG and SVG.

Coordinates and Equation will call the shared primitive while retaining their engine-specific tick/label loops. Ogive and Histogram already call `common.js` `drawAxes`, which will delegate to that primitive. Major grid alignment is maintained because all these origins are the (0,0) location used to anchor the existing grid renderer; minor grid generation remains untouched. Automated tests will cover the shared axis geometry, edge/visibility cases, origin alignment, both arrow directions, and existing K/N inverse mappings.

## Implementation and verification results

### Files changed

- Updated `assets/js/common.js` with `drawInfiniteAxes` and delegated shared Ogive/Histogram axes to it. Corrected major grid iteration so the first visible line is selected by the origin-anchored major lattice rather than offsetting from the viewport edge.
- Updated `assets/js/tools/coordinates-tool.js` and `assets/js/tools/equation-plotter-engine.js` to use the shared axis renderer with their existing transformed origin.
- Added tests in `tests/graph-scale.test.js` for axis segments, endpoints/arrows/labels, offscreen origin handling, origin-aligned major grids, K/N math, Coordinates inverse transforms after zoom/pan, and engine wiring.
- Updated `docs/PROJECT_STATUS.md` and `docs/PROJECT_CHANGELOG.md`.
- Regenerated `dist/` with the existing Vercel preparation command.

### Rendering behavior

The renderer receives the active engine's pixel position for (0,0). It draws the X-axis across the canvas at the transformed y-coordinate of zero when that coordinate intersects the canvas; it draws the Y-axis at the transformed x-coordinate of zero when that coordinate intersects. Lines reach inset canvas endpoints occupied by their arrowheads. Both negative and positive direction arrowheads point outward and remain inside the canvas. `X′`, `X`, `Y`, and `Y′` follow the visible endpoint positions. `O` is drawn only when both zero coordinates are within the viewport. If neither zero-axis line intersects the view, no false border axis is drawn.

The graph-paper lattice remains anchored at the same transformed origin. Major lines now iterate from `ceil(firstVisibleIndex / majorEvery) * majorEvery`, keeping the lattice aligned to index zero after pan. This is purely visual indexing: the K/N values still determine mathematical coordinate displacement and `majorEvery` does not become a unit interval. Existing transforms recalculate the origin after zoom, pan, and canvas changes. Exports use the rendered shared canvas and therefore use the same renderer.

### Tests executed

- `node --check` over every JavaScript file under `assets/js`, `service-worker.js`, and the changed graph-scale test — passed.
- `node scripts/prepare-vercel.mjs` — prepared `D:\MathForge\dist` successfully.
- Source/dist hashes for the entry HTML, service worker, K/N settings/helper, four engines, common transforms, and adapters — **10/10 matched**.
- `node --test tests/*.test.js` — **30 passed, 0 failed**. This includes new tests for all four boundary arrowheads and labels, origin visibility, pan-shifted major-grid alignment, non-identical K/N Coordinates transforms and inverse mapping, and Ogive/Histogram break-aware inverse mapping.
- Browser/manual viewport, pointer interaction, save/reopen, and export validation — not performed in this run.

### Remaining verification

Live graph interaction and PNG/SVG inspection still need manual browser verification. For mathematical correctness, a zero-axis line whose constant coordinate lies outside the visible canvas has no visible segment; it is kept at its true transformed position rather than drawn falsely along a canvas border. When only one zero coordinate is outside, the other axis remains visible if it crosses the viewport.
