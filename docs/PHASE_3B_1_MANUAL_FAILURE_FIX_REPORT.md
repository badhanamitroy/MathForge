# MathForge — Phase 3B.1: Coordinates Graph Manual Failure Fix Report

**Date:** 2026-11-02  
**Project:** MathForge (formerly Textbook Graph Suite)  
**Document Version:** 1.0.0  
**Status:** 🔬 Automated Verification Complete (44/44 PASS) — Ready for User Manual Testing  
**Scope:** Investigation and remediation of manual testing defects in Coordinates Graph workspace integration  

---

## 1. Executive Summary

During manual testing of the integrated Coordinates Graph in `index.html`, three critical behavioral defects were observed:
1. **Point label dragging failed**: Attempting to drag point labels either missed the target or caused the entire canvas to pan instead.
2. **Dragging on point markers panned canvas**: Clicking and dragging directly on a point marker initiated canvas panning instead of being isolated.
3. **Graph canvas utilization failure**: The canvas buffer remained at the default 300×150 px size, stretched via CSS into a larger box, resulting in a tiny, blurry graph surrounded by empty sheet space.

A deep forensic investigation was performed comparing `assets/js/tools/coordinates-tool.js` and `assets/js/workspace-core.js` with the original standalone baseline in `backups/phase3_pre_integration/Coordinates_graph.html`. 

All root causes were identified, addressed at the architectural level, and verified with a comprehensive 14-scenario automated test suite (`docs/scratch/test_phase3_coordinates_manual_failures.js`).

---

## 2. Root Cause Analysis

### 2.1 Graph Canvas Utilization & The 300×150 Default Buffer
* **Root Cause:** In `assets/js/workspace-core.js`, `selectTool()` previously invoked `targetTool.mount(dom.toolMountContainer)` *before* `dom.toolMountContainer` was set to active or made visible. Because `#mfToolMountContainer` had CSS `display: none` during `mount()`, `container.getBoundingClientRect()` returned `0 × 0`.
* **Consequence:** `fitCanvasToContainer()` returned early due to zero dimensions, leaving the newly created `<canvas>` at the HTML5 default of `width = 300, height = 150`. When the container became visible, CSS `.mf-tool-mount-container.active canvas.mf-coord-canvas { width: 100%; height: 100%; }` stretched the tiny 300×150 bitmap over an 850×594 display box, producing severe pixelation, blurring, and shrinking the usable coordinate graph area to a tiny fraction of the canvas.
* **Secondary Constraint:** In `assets/css/workspace.css`, `.mf-canvas-sheet` had legacy constraints of `max-width: 960px; max-height: 640px;` which limited canvas expansion on large displays.

### 2.2 Coordinate Space Disconnect in Label Hit Testing
* **Root Cause:** In `createCoordinatesEngine`, `draw(canvas)` computed transform coordinates using `canvas.width` and `canvas.height` (the physical backing buffer). When `fitCanvasToContainer` configured High-DPI DPR scaling (`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`), 2D context drawing occurred in CSS logical pixels, while `makeTransform` and `labelBoxes` were calculated in physical pixel space (e.g., 300×150 or physical buffer width).
* **Consequence:** `canvasPointFromEvent(e)` computed `(e.clientX - rect.left) * (canvas.width / rect.width)`. Because the bounding box coordinates in `labelBoxes` were mismatched with event logical coordinates, `hitTestLabel()` consistently failed (returned `null`).

### 2.3 Fall-Through to Canvas Panning on Label and Marker Clicks
* **Root Cause:** In the event handler of `assets/js/tools/coordinates-tool.js`, when `hitTestLabel()` returned `null`, `mousedown` fell through unconditionally to `drag.mode = "pan"`.
* **Consequence:** 
  - Clicking on a point's text label (which missed hit-testing due to the coordinate mismatch) initiated canvas panning rather than label dragging.
  - Clicking directly on a point marker had no hit-testing at all, also falling through directly to canvas panning.

### 2.4 Missing Dynamic UI Controls in Left Panel
* **Root Cause:** In `createWorkspaceAdapter()`, `#mfCoordToolInputs` injected `#mfCoordSetList` and `#mfCoordPointControls` into the left panel as empty placeholder containers, but never populated them with set items, rename/select/remove buttons, or per-point offset sliders (`dx`/`dy`), color inputs, and shape selectors.
* **Consequence:** Point offset sliders and set management controls were completely missing in the workspace left panel, preventing visual feedback during label dragging and manual offset adjustment.

---

## 3. Architecture & Implementation Corrections

### 3.1 Strict Pointer Interaction Hierarchy
The pointer resolution order in `mousedown` was formalized across both workspace and standalone modes:

```
[User clicks on Canvas]
         │
         ├───► 1. hitTestLabel(labelBoxes, mx, my)?
         │         YES: Activate drag.mode = "label"
         │              Update pointOffsets[label] in real time
         │              Sync left-panel dx/dy sliders
         │              Keep (x, y) coordinates & textarea 100% UNTOUCHED
         │
         ├───► 2. hitTestPointMarker(mx, my)? (threshold: 12px radius)
         │         YES: Activate drag.mode = "point-marker" (inert)
         │              Consume click / drag
         │              Do NOT pan canvas
         │              Do NOT alter coordinates (no coordinate dragging)
         │              Keep textarea 100% UNTOUCHED
         │
         └───► 3. Genuinely Empty Canvas Space?
                   YES: Activate drag.mode = "pan"
                        Translate viewOffset.x and viewOffset.y
                        Smooth panning at all zoom levels (100%, 200%, etc.)
```

### 3.2 High-DPI Logical vs Physical Coordinate Alignment
1. **Logical Dimensions in Transform:** `engine.draw(canvas)` now computes:
   ```javascript
   var logicalW = canvas.clientWidth || (canvas._mfAppliedDpr ? Math.round(canvas.width / canvas._mfAppliedDpr) : canvas.width);
   var logicalH = canvas.clientHeight || (canvas._mfAppliedDpr ? Math.round(canvas.height / canvas._mfAppliedDpr) : canvas.height);
   ```
   `makeTransform`, `drawGrid`, `drawSet`, and `labelBoxes` are all computed in CSS logical pixels $(0, 0) \to (\text{logicalW}, \text{logicalH})$.
2. **Event Coordinate Mapping:** `canvasPointFromEvent(e)` maps:
   ```javascript
   var rect = canvas.getBoundingClientRect();
   var scaleX = rect.width > 0 ? (logicalW / rect.width) : 1;
   var scaleY = rect.height > 0 ? (logicalH / rect.height) : 1;
   return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
   ```
   Ensuring 100% subpixel precision between mouse events and `labelBoxes`.

### 3.3 Container Visibility Timing & Layout Sizing
1. **Mount Order in `workspace-core.js`:** In `selectTool()`, `dom.welcomeContent.style.display = "none"`, `dom.activePlaceholder.style.display = "none"`, and `dom.toolMountContainer.classList.add("active")` are set **before** `targetTool.mount()`. `fitCanvasToContainer()` receives immediate computed dimensions (e.g., 850×594).
2. **Sheet Expansion in `workspace.css`:** `.mf-workspace .mf-canvas-sheet` was updated from fixed maximums to `max-width: 100%; max-height: 100%`, allowing the canvas to fully utilize the stage.

### 3.4 Bidirectional UI Synchronization
1. **Set Manager UI (`refreshSetManagerUI`):** Dynamically builds set cards in `#mfCoordSetList` with active state highlighting, name input, "Select" (or "Active") button, and "Remove" button (disabled when $\le 1$ set).
2. **Point Controls UI (`rebuildPointControlsUI`):** Dynamically populates `#mfCoordPointControls` with cards for each point in the active set:
   - Header showing `Set Name • Label offset` and `Label(xRaw, yRaw)`.
   - `dx` slider ($-220\text{px}$ to $+260\text{px}$) with live value readout.
   - `dy` slider ($-240\text{px}$ to $+220\text{px}$) with live value readout.
   - Point color picker (`input[type="color"]`).
   - Point shape selector (`Circle`, `Square`, `Triangle`, `Diamond`).
3. **Live Slider Synchronization (`updatePointSliderUI`):** When dragging a label on the canvas, the corresponding `dx` and `dy` sliders and numerical value badges update in real time.
4. **Style Synchronization (`syncUIFromActiveSet`):** Fully synchronizes polygon fill, opacity, border width/color, diagonals, grid, and axis controls when switching between point sets or restoring tool state.
5. **Memory-Safe Event Delegation:** All dynamic controls in `#mfCoordSetList` and `#mfCoordPointControls` use event delegation registered via `addListener()` and cleaned up 100% on `unmount()`.

---

## 4. Before & After Comparison

| Feature / Behavior | Before Phase 3B.1 | After Phase 3B.1 | Status |
|---|---|---|---|
| **Canvas Buffer Dimensions** | Default 300×150 px buffer stretched via CSS | Full container dimensions (e.g., 850×594 logical, High-DPI buffer) | ✅ Fixed |
| **Canvas Utilization** | Tiny 10px graph squashed in center | Full, centered, sensible coordinate plane utilizing stage | ✅ Fixed |
| **Point Label Dragging** | Hit test missed; dragging label panned graph | Smooth label drag; updates `pointOffsets` only | ✅ Fixed |
| **Point Coordinates & Textarea** | N/A (failed to drag label) | 100% preserved; no alteration to $(x, y)$ or textarea | ✅ Verified |
| **Clicking Point Marker** | Panned canvas | Inert; click consumed, zero canvas panning, zero coordinate changes | ✅ Fixed |
| **Empty Canvas Panning** | Worked only on small 300×150 area | Smooth horizontal and vertical panning at all zoom levels | ✅ Fixed |
| **Offset Sliders in Left Panel** | Empty container; no sliders or controls | Fully populated cards; bidirectional sync with canvas drag | ✅ Fixed |
| **Set Manager in Left Panel** | Empty container | Complete multi-set list with Add, Select, Remove, Rename | ✅ Fixed |
| **State Persistence** | Point styles and offsets survived only in memory | Full UI and canvas state restored across tool switches | ✅ Fixed |

---

## 5. Automated Verification Results

### 5.1 Dedicated Phase 3B.1 Manual Failure Suite
**Test Script:** `docs/scratch/test_phase3_coordinates_manual_failures.js`  
**Execution Command:** `node docs/scratch/test_phase3_coordinates_manual_failures.js`  
**Result:** **44 / 44 Assertions Passed (100% SUCCESS, 0 Failures)**

| Scenario | Description | Automated Assertion Result |
|---|---|---|
| **Scenario 1** | Drag point label changes bounding box on screen | ✅ PASS (`x: 364.7 -> 419.7`) |
| **Scenario 2** | `pointOffsets` updates and left-panel `dx`/`dy` sliders sync | ✅ PASS (`dx: 75, dy: -55`, slider & readout = 75) |
| **Scenario 3** | Point coordinates $(x, y)$ remain completely unchanged | ✅ PASS (`(1, -1)` unchanged) |
| **Scenario 4** | Points textarea content is NOT modified by label drag | ✅ PASS (Textarea string identical) |
| **Scenario 5** | Dragging point marker does NOT pan canvas or alter coords | ✅ PASS (`viewOffset = (0, 0)`, coordinates unchanged) |
| **Scenario 6** | Dragging empty canvas visibly pans graph horizontally/vertically | ✅ PASS (`viewOffset = (69.8, 44.8)`) |
| **Scenario 7** | Panning works at different zoom levels; Reset View restores (0, 0) | ✅ PASS (`zoom = 115%`, Reset restores 100% and (0,0)) |
| **Scenario 8** | Canvas utilization: logical size $\ge 800\times 500\text{px}$, scale healthy | ✅ PASS (`848x592px`, buffer `850x594`, scale `73.3 px/unit`) |
| **Scenario 9** | Workspace resize expands canvas and maintains mathematical transform | ✅ PASS (`848px -> 1118px`, scale `73.3`) |
| **Scenario 10** | Zoom In/Out and Reset View work cleanly after workspace resize | ✅ PASS (Zoom in, zoom out, reset verified) |
| **Scenario 11** | State survives tool switching (offsets, zoom, slider reflection) | ✅ PASS (`offsets = {"dx":88,"dy":-99}`, slider = 88, zoom = 1.35) |
| **Scenario 12** | Export PNG produces valid image data URL with non-trivial bytes | ✅ PASS (Valid base64 image data URL, 43,722 bytes) |
| **Scenario 13** | Standalone `Coordinates_graph.html` functions identically | ✅ PASS (Canvas 900×700, zoom, reset, controls verified) |
| **Scenario 14** | Console error monitoring throughout entire execution | ✅ PASS (0 console errors, 0 uncaught exceptions) |

### 5.2 Full Regression Suite Status

| Test Suite | File | Assertions / Tests | Status |
|---|---|---|---|
| **Phase 3B.1 Manual Failure Suite** | `docs/scratch/test_phase3_coordinates_manual_failures.js` | 44 / 44 | ✅ 100% PASS |
| **Phase 3 Integration Suite** | `docs/scratch/test_phase3_coordinates_integration.js` | 51 / 51 | ✅ 100% PASS |
| **Phase 2 Lifecycle Reliability Suite** | `docs/scratch/test_phase2_lifecycle_reliability.js` | 41 / 41 | ✅ 100% PASS |
| **Phase 2 Accessibility & Structure Suite** | `docs/scratch/test_phase2_workspace.js` | 77 / 77 | ✅ 100% PASS |
| **Phase 2 Edge Cases & DPR Suite** | `docs/scratch/test_phase2_edge_cases.js` | 67 / 67 | ✅ 100% PASS |
| **Phase 2 Viewports & Responsive Suite** | `docs/scratch/test_phase2_viewports.js` | 7 / 7 Viewports | ✅ 100% PASS |
| **Protected Files Baseline Check** | All suites (SHA-256 validation) | 6 Protected Files | ✅ 100% UNTOUCHED |

---

## 6. Instructions for User Manual Re-Testing

Please perform manual verification in your browser using direct `file://` execution:

1. **Open Workspace:** Open `index.html` in your browser.
2. **Select Tool:** In the left panel, click on **Coordinates Graph**.
   - *Verification:* The canvas should immediately occupy the full central stage with a large, crisp, sharp coordinate plane (no blurriness). Axes, origin, grid, ticks, and point markers (P, Q, R) should be clearly visible and legible.
3. **Verify Left Panel Controls:**
   - Look below the "Coordinates Data" textarea: you should see the **Point Sets** manager (with Set 1) and **Per-Point Offsets & Styling** cards for P, Q, and R.
4. **Test Point Label Dragging:**
   - Hover your mouse over the text label `P(1, -1)` on the canvas. The cursor changes to grab (`can-drag`).
   - Click and drag the label around.
   - *Verification:* Only the label moves. The point marker itself and graph grid do NOT move. Point coordinates in the textarea do NOT change. The `dx` and `dy` sliders for P in the left panel move in real time with your mouse!
5. **Test Point Marker Click & Drag:**
   - Hover your mouse directly over a point marker glyph (e.g., the circle marker for point P). The cursor changes to `pointer`.
   - Click and drag directly on the marker.
   - *Verification:* The graph does NOT pan! The marker does not move. Point coordinates do NOT change.
6. **Test Empty Canvas Panning:**
   - Click on genuinely empty canvas space (e.g., near the corner or between grid lines away from points and labels) and drag.
   - *Verification:* The entire coordinate plane pans smoothly horizontally and vertically.
7. **Test Zoom & Toolbar:**
   - Use the toolbar **Zoom In** and **Zoom Out** buttons (or mouse wheel). Panning works at all zoom levels.
   - Click **Reset View**: the view smoothly returns to default position and 100% zoom.
8. **Test Left Panel Sliders:**
   - Drag the `dx` or `dy` slider for point Q in the left panel.
   - *Verification:* The label for Q on the canvas moves in real time.
9. **Test State Persistence:**
   - Modify a point's label offset and zoom level.
   - Click **Home** (or the overview button) to return to Overview.
   - Click **Coordinates Graph** again.
   - *Verification:* Your modified label positions, zoom level, and sliders are completely preserved.
10. **Test Standalone Fidelity:**
    - Open `Coordinates_graph.html` directly in the browser and verify identical functionality.

---

## 7. Current Project Status

- **Phase 3B.1 Implementation:** COMPLETED.
- **Automated Verification:** 100% PASS across 280+ total test assertions.
- **Manual Verification Status:** Awaiting user manual testing.
- **Phase 4 (Equation Plotter):** BLOCKED until user manual testing is confirmed and Phase 3 is approved.
