# MathForge Workspace UI Recovery Report

**Date:** 2026-11-04  
**Status:** Layout corrections implemented; browser acceptance pending

## Root causes

Inspection of `index.html`, the workspace styles and layout logic, the previous UI reorganization report, and the local Phase 4.7/shared-canvas backups found these causes:

1. The opening `<aside class="mf-side-panel mf-right-panel" id="mfRightPanel">` was missing before the Graph Designs header. Its closing tag remained. The header and content therefore became separate grid items instead of a right sidebar. With only the left and center children explicitly assigned to columns, CSS auto-placement generated implicit rows; this displaced settings toward the left side and disrupted the center workspace's height allocation.
2. The shared `.mf-tool-list` rule sets `flex-direction: column`. The generator toolbar overrides had set `flex-wrap: nowrap` but did not set `flex-direction: row`, so the four buttons inherited vertical stacking. The toolbar's overflow clipping then hid buttons outside its bounds.
3. The center stage used `height: 100%` while it was also a flex child below fixed-height document, generator, and canvas bars. Combined with the unexpected implicit workspace rows and `overflow: hidden`, the stage did not reliably receive the remaining center height; its graph area could be clipped or undersized with unused workspace area left over.
4. At compact widths, the earlier responsive rules changed the panel content to `overflow: visible`, so long sidebars did not scroll independently.

The existing application frame already reserves rows for the header, workspace, export panel, and status bar. The recovery keeps that frame and fixes its child structure and sizing. The local backups and reports were used to confirm the intended three-panel structure; no files were copied from the separate GitHub clone.

## Files changed

- `index.html` — restored the right sidebar wrapper around the existing Graph Designs header and content.
- `assets/css/workspace.css` — constrained the desktop workspace to one flexible row, made the canvas stage fill the remaining center space, explicitly set the generator list to a horizontal non-wrapping flex row, and restored independently scrollable bounded panels on compact screens.
- `tests/workspace-layout-recovery.test.js` — added checks for the three direct panel wrappers and the layout rules.
- `docs/PROJECT_STATUS.md`
- `docs/PROJECT_CHANGELOG.md`
- `dist/` — regenerated static output.

The layout recovery itself did not change a graph engine, project manager, settings state, standalone page, or event handler.

## Exact layout corrections

- `#mfLeftPanel`, `#mfCanvasArea`, and `#mfRightPanel` are again the three direct children of `#mfWorkspaceBody` in left-to-right order.
- `#mfRightPanel` again owns the Graph Designs controls and graph-specific properties container, so the existing independent sidebar scroll styles apply.
- The desktop workspace body now has one `minmax(0, 1fr)` row, preventing accidental implicit rows from competing for the viewport height.
- The center canvas stage no longer claims 100% of its parent's height in addition to the fixed bars; it flexes into the space remaining inside the center column.
- The generator selector explicitly uses `flex-direction: row` and `flex-wrap: nowrap`; its nav scrolls horizontally when needed.
- Tablet/mobile panels retain the existing stacked layout and scroll their own contents within bounded heights.
- Existing canvas ratio controls, 4:3 default, graph sheet, project settings, graph engines, toolbar IDs, and event contracts are preserved.

## Verification results

- JavaScript syntax checks: **18 files passed**.
- Full automated suite, `node --test tests/*.test.js`: **19 passed, 0 failed**. This includes the added DOM/CSS layout regression tests and the existing project/PWA/static-preview tests.
- Vercel build command, `node scripts/prepare-vercel.mjs`: **completed successfully**.
- Generated output verification: **30 files matched source SHA-256 hashes**, with no unexpected files in `dist/`.
- The existing static-preview suite served the workspace routes and `Equation.html`, and verified the service-worker assets. This is not a browser interaction test.
- Direct local browser inspection at 1366×768, 1920×1080, 768×1024, and 390×844 was **not performed**. The browser security policy rejected access to the local `file:` URL; no alternate browser route was used.
- Graph switching/rendering, actual project save/open, PNG export, and standalone direct-file workflows were **not re-exercised in a browser** during this recovery. Existing engine and project code was left unchanged.

## Manual verification still required

Open `D:\MathForge\index.html` and check 1366×768, 1920×1080, 768×1024, and 390×844. Confirm the generator row stays horizontal, the white graph sheet uses the selected ratio and fills the center sensibly, and Graph Designs is on the right. Switch through Coordinates, Equation, Ogive, and Histogram to check each input panel and graph output. Then open/save a project and export a PNG. Finally open each standalone page directly. These browser checks remain the release acceptance gate for the visual layout and workflows.

## Font-size mismatch follow-up — 2026-11-04

### Root cause

The shared `#mfGraphFontSizePt` input was handled on every `input` event by the general settings handler. That handler immediately sanitized the value to the input's 6–36 range and rewrote the input from state. While replacing `11` with `12`, the browser can emit an intermediate `1`; it was clamped to `6` and written back before the next character. Typing the next `2` then yielded `62`, which was clamped to `36`. This was input-event feedback, not a factor-of-three conversion in the rendering code.

There was also a secondary source-of-truth conflict: Coordinates retained `fontSizePt` in its old per-tool state and wrote it back to the shared control during tool restoration. That could replace a newer shared preference when switching tools or reopening a project.

### Fix

- Font-size input now preserves partial text during typing. Only finite values within the supported 6–36 pt range update shared state on `input`; the field is not rewritten mid-entry. On `change`, valid values are committed and invalid/blank input is restored from state.
- Decimal values remain numeric decimals in shared state. Rendering reads the same shared settings state instead of an unfinished input value.
- Coordinates now reads typography from the shared typography helper, no longer has a second font-size/bold change handler, and treats shared typography as authoritative when restoring legacy per-tool state.
- The project format remains version 1. Captured projects include `graphDesignSettings`; project restore calls `setState()` with that optional field, and Coordinates no longer overwrites it during restoration.
- The existing renderer converts points to canvas CSS pixels using the standard `pt × 96 / 72` unit conversion. The stored/input value remains in points; exports serialize the already-rendered canvas and apply no additional font multiplier.

Files changed for this follow-up: `assets/js/core/graph-design-settings.js`, `assets/js/core/graph-typography.js`, `assets/js/tools/coordinates-tool.js`, and `tests/workspace-graph-designs.test.js`.

### Actual verification

- Regression tests entered **10, 11, 12, 14, 16, 18, 12.5, and 11.25** and confirmed the shared state and input value match. They also checked generated renderer font sizes use the expected point-to-pixel conversion.
- A typing regression test simulated the intermediate `1`, then `12.`, then `12.5`; it confirmed partial text is not rewritten, state remains canonical until a valid value is entered, and a version-1 project settings JSON round-trip restores 12.5.
- Static flow assertions confirmed Coordinates and all three other engines read the shared typography helper, and that project capture/restore uses the optional shared settings field.
- JavaScript syntax checks: **18 files passed**. Full automated suite: **21 passed, 0 failed**.
- Vercel preparation completed successfully; all **30** generated `dist/` files matched source SHA-256 hashes.
- A real browser-based project Save/Open and PNG export workflow was **not run** in this session. The test verifies the version-1 settings payload round-trip and manager source flow, not a desktop browser interaction. Direct local browser access remains blocked by the browser URL policy noted above.
