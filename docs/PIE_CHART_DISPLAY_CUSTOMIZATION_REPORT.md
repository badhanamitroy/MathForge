# Pie Chart Display Customization Report

**Date:** 2026-11-05

## Inspection findings

The native Pie tool is the existing workspace adapter in `assets/js/tools/pie-chart-engine.js`. Its SVG renderer is also the source used by both SVG export and PNG rasterization. Pie state is returned by that adapter and is stored by the existing Project Manager under `toolStates["pie-chart"]` in `.mathforge` version 1.

Before this change, percentage labels used `max(11, shared fontSizePt × 1.1)` pixels; the Donut total used `max(18, shared fontSizePt × 1.8)` pixels; the Donut unit used `max(12, shared fontSizePt × 1.05)` pixels. There was no separate Donut center label. Export title and summary were fixed at 26px and 16px. Legend labels used `max(12, shared fontSizePt × 1.25)` pixels. The output renderer always emitted the chart, calculation table, and drawing steps together.

## Implementation

### Files changed

- `assets/js/tools/pie-chart-engine.js` — Pie-specific typography and visibility state, Graph Designs controls, conditional output rendering, center label, SVG fitting, legacy defaults, and chart-hidden export feedback.
- `assets/css/tools/pie-chart.css` — compact Pie Graph Designs grouping, controls/readouts, and empty state styling.
- `tests/pie-chart.test.js` — bounds/defaults, SVG typography, mode behavior, visibility combinations, hidden-state empty prompt, exports, and state restoration coverage.
- `tests/project-manager-save.test.js` — version-1 Pie save/reopen fixture includes the new preferences.
- `docs/PROJECT_STATUS.md`, `docs/PROJECT_CHANGELOG.md`, and `docs/PIE_CHART_DISPLAY_CUSTOMIZATION_REPORT.md` — current status, change record, and implementation report.
- `dist/assets/js/tools/pie-chart-engine.js` and `dist/assets/css/tools/pie-chart.css` — regenerated static build copies.

### Typography controls

The Pie Chart appearance section in the existing Graph Designs panel now has independent range controls and live px readouts:

| Setting | Default | Allowed range |
| --- | ---: | ---: |
| Slice percentage label | 12 px | 8–28 px |
| Donut center label (“মোট” / “Total”) | 12 px | 8–24 px |
| Donut center value | 20 px | 12–40 px |

Slice typography is available when the chart is visible. Donut center controls are shown only when the chart is visible and Donut mode is selected. The shared local font family, shared font color, and shared bold preference remain in effect. Percentage labels and center text fit to available SVG space to limit clipping; selected values remain persisted independently. Existing shared/global typography was not changed. The export title, summary, and legend sizing continue their prior behavior.

### Section visibility and persistence

“Choose What to Display” provides independent checkboxes for Pie / Donut Chart, Calculation Table, and Drawing Steps. Only selected sections are generated into the visible output, in chart/table/steps order. With all boxes clear, a small prompt is shown. Hiding output does not remove category data or stop calculation updates.

The six preferences are fields on the existing Pie adapter state. No project schema or version change was needed. Older Pie state missing these fields restores to the defaults above and all three sections visible. Preferences therefore follow existing Save, Save As, Open, Recent Projects, and generator-switch behavior.

### Export behavior

SVG and PNG continue to use the same Pie SVG builder. Exports remain chart-only compositions, as before; they do not include the calculation table or drawing instructions. They use the selected percentage and Donut center sizes. If the chart visibility checkbox is off, chart export returns a clear error asking to enable the chart instead of exporting content hidden in the workspace.

## Verification results

- Focused tests: `node --test tests/pie-chart.test.js tests/project-manager-save.test.js` — **17 passed, 0 failed**.
- Full test suite: `node --test tests/*.test.js` — **55 passed, 0 failed** on the final successful run. An initial sandboxed attempt could not connect to localhost preview tests; a later run showed transient IndexedDB mock timing failures. The successful full runs outside the sandbox completed with all tests passing.
- JavaScript syntax: `node --check` over all `assets/js/**/*.js` and `service-worker.js` — **passed**.
- Build preparation: `node scripts/prepare-vercel.mjs` — **completed successfully**.
- Source/dist verification: SHA-256 matches for the Pie engine and Pie stylesheet — **2/2 matched**.
- Browser/manual interaction: **not completed**. An already-open `file:///D:/MathForge/index.html` window showed a pre-change four-generator workspace. It was not reloaded or replaced during this check, to avoid disturbing the existing browser session. No visual acceptance result is claimed.

## Remaining manual checks

1. Open the updated `D:\MathForge\index.html`, select Pie Chart, and confirm the three font sliders/readouts appear in Graph Designs.
2. Switch between Pie and Donut; change each slider independently and confirm SVG labels update immediately without clipping.
3. Try chart only, table only, drawing steps only, each pair, all three, and all unchecked. Confirm the output reflows with no blank section gaps and the all-hidden prompt appears.
4. Save, close/reopen, and Save As a Pie project; confirm all six preferences and category data restore. Open a Pie project without these fields and confirm defaults.
5. Export PNG and SVG in Pie and Donut modes and confirm the chosen text sizes and chart-only export composition.

No known issue affects the other four graph generators; their shared typography and output behavior were left unchanged.
