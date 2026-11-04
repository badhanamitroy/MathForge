# Existing Graph Scaling Audit

Audit performed before implementation of user-defined K/N scaling. This report records the current source behavior; graph tools are not interchangeable today.

## Current scaling architecture

| Graph type | Minor square | Major grid | Mathematical units to pixels | Inverse pixel conversion |
|---|---|---|---|---|
| Coordinates | `GraphDesignSettings.gridSpacing` in the workspace (10 px by default); the engine fallback is `tf.scale / 5`. | Shared `majorEvery` (5 by default). | `computeFittedBounds` and `makeTransform` fit all points into the canvas using a uniform pixel-per-unit transform. The graph-paper grid is a separate pixel grid. | `lastTf.pxToX/pxToY`, used by point dragging. |
| Equation | `minorPx=10` px and `majorEvery=5`; standalone control defaults are confirmed in `standalone-control-templates.js` and reset logic. | 5 minor squares. | `minorPx * zoom * xSmallPerUnit/ySmallPerUnit`; reset defaults X=5 and Y=1. | Local `canvasToWorld`, used for pan/point interactions. |
| Ogive | `o_minorPx=10` px; `o_majorEvery=5`. | 5 minor squares. | Shared `worldToCanvas` with `o_xSmallPerUnit=1`, `o_ySmallPerUnit=1`; `fitToData` computes zoom separately from those factors. | Shared `canvasToWorld`, including X-axis break handling, used while dragging points and zooming. |
| Histogram | `h_minorPx=10` px; `h_majorEvery=5`. | 5 minor squares. | Shared `worldToCanvas` with `h_xSmallPerUnit=1`, `h_ySmallPerUnit=1`; `fitToData` computes zoom separately from those factors. | Shared `canvasToWorld`, including X-axis break handling, used for pan/zoom. |

For Equation, Ogive, and Histogram, the existing X/Y factors mean **small squares per one data unit**. They are independent. The grid cell size is in CSS/canvas pixels, and zoom multiplies that size. Major spacing only changes visual grid emphasis and the break gap; it does not change the units-per-square factors.

## Existing formulas and rendering

The Equation Plotter uses `px = ox + x * minorPx * zoom * xSmallPerUnit` and `py = oy - y * minorPx * zoom * ySmallPerUnit`; its inverse divides the pixel displacement by the same axis factor. Function evaluation itself is unchanged and produces mathematical x/y values before plotting. Its numeric tick labels are currently integer data-unit ticks.

The shared `common.js` conversion uses the same per-axis factors. Ogive and Histogram add a horizontal discontinuity for their axis break: points after the break are shifted by `breakGapPx` and the inverse removes that gap. Their table boundaries, frequencies, and cumulative-frequency calculations remain data values; graph drawing converts them to pixels. Their fit functions change viewport zoom to fit the input data. Histogram bars and Ogive points use these same transformations.

Coordinates differs: it first computes a data bounding box, fits it uniformly into the canvas, then uses the resulting `makeTransform` for plotted points, axis positions, labels, and drag inverse mapping. Grid paper is drawn independently in pixel space around the transformed origin. Negative and decimal coordinates are represented as numeric values; the fit and inverse transforms do not quantize them. This engine does not currently have a mathematical small-squares-per-unit scale.

Canvas dimensions are controlled by each tool's canvas size/origin inputs (Equation 920x560, Ogive/Histogram 980x600 by the standalone templates) plus the workspace Graph Designs aspect-ratio sheet. Ratio changes resize the shared display sheet and cause canvas resize/redraw; the graph tool transforms themselves use the current backing canvas dimensions. Zoom changes pixel scale; pan changes origin/offset; neither intentionally edits table/function/point data. Label intervals are not unified: Equation ticks use integer units, Ogive/Histogram use tool-specific label steps and boundary labels, and Coordinates chooses a “nice” integer tick step from fitted pixels-per-unit.

## Shared vs duplicated calculations

- `assets/js/common.js`: shared graph-paper drawing, X break map/unmap, and Ogive/Histogram `worldToCanvas`/`canvasToWorld`.
- `assets/js/tools/equation-plotter-engine.js`: duplicates the non-break per-axis forward and inverse transforms and owns Equation ticks/function samples.
- `assets/js/tools/coordinates-tool.js`: owns fit-to-data transforms, grid/axis labels, dragging inverse, and view pan/zoom.
- `assets/js/tools/ogive-engine.js` and `histogram-engine.js`: use common forward/inverse transforms but duplicate fit/zoom calculations and read independent scale input fields.
- `assets/js/core/graph-design-settings.js`: shared persisted design settings (grid spacing, major interval, ratio, colors, typography). It currently does not store mathematical axis scale.

## Project persistence and exports

`assets/js/project-manager.js` serializes `graphDesignSettings` as an optional project property (project format version 1). Deserialization passes it through the shared settings sanitizer; older projects without it reset to defaults. Tool state is captured by the existing adapters. PNG export reads the active rendered canvas with `toDataURL`; current SVG export embeds that PNG, so both reflect the engine's current canvas rendering and dimensions. K/N should therefore be persisted alongside shared design preferences and consumed by each active renderer; a separate export transform would create divergence.

## Compatibility risks and integration plan

1. Existing Equation factor defaults are X=5/Y=1; Ogive and Histogram are X=1/Y=1. Replacing all factors with a single fixed default would change two tools' established geometry. Older projects also do not have K/N fields.
2. Coordinates currently uses auto-fit scale rather than K/N. It needs its transform changed to use the shared scale in grid-square units while retaining a viewport fit/zoom layer and using the same inverse for point drags. Its fitted tick labeling must become scale-aware.
3. Ogive/Histogram's break-gap transform must keep its discontinuity separate from K/N. Their fit zoom and cursor-anchored zoom must use the new per-axis pixel factors.
4. The Equation transform, axes/tick placement, and pan/drag conversion must use the same shared K/N functions. Function evaluation remains untouched.
5. Missing K/N project settings will be migrated to per-tool legacy equivalents on first selection (Equation 5/1 on X and 1/1 on Y; Ogive/Histogram 1/1 on both; Coordinates uses 1/1 as its explicit mathematical scale). This preserves Equation/Ogive/Histogram initial appearance and scale while making the new values explicit. New workspace settings can then be edited and persist normally. Coordinates cannot preserve its old auto-fit scale as an absolute mathematical scale because its old model had none.
6. K/N conversions should live in one shared utility: `value = (gridSquares / K) * N`; inverse `gridSquares = (value / N) * K`. Pixel conversion remains `gridSquares * minorPx * zoom`; pan/origin and break offsets remain viewport terms. Grid major interval stays visual only.

### Phase 0 gate conclusion

The lowest-risk integration keeps all four existing renderers and adds one shared scale utility/state. Equation and the Ogive/Histogram wrappers will replace their legacy factors with equivalent `K/N` effective square rates; the common break mapper will use those same effective rates in both directions. Coordinates will use the shared axis rates for point/axis mapping and retain a separate fit/view transform and drag inverse. Shared settings persistence is already optional and backward-compatible, so K/N can be added without changing the `.mathforge` version. This is the implementation path used in the follow-up changes.
