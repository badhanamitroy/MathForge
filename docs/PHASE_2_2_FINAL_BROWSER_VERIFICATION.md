# Phase 2.2 — Final Browser Verification Report

**Date:** 2026-11-01  
**Scope:** Resolve remaining browser-only verification gaps identified in the prior audit. Investigate the label offset independence hypothesis. Execute real browser tests against a live Chrome instance. Distinguish between standalone test harness tests and actual application tests.  
**Browser used:** Google Chrome (headless, `--headless=new`, `--dump-dom`) — using the system-installed Chrome executable  
**Test environment:** Windows 11, Node.js v24.22.1, Chrome headless (no Playwright installed, no local HTTP server required, direct `file://` execution)  
**Methodology:**
1. Code audit and structural analysis of `Coordinates_graph.html`.
2. Isolated logic test suite executed under Node.js (`docs/scratch/phase22_test.js`).
3. Real browser headless testing via Google Chrome (`--dump-dom`) on standalone test harnesses (`docs/scratch/phase22_browser_test.html`, `docs/scratch/phase22_integration_test.html`) with actual Canvas2D pixel sampling via `ctx.getImageData()` and exported PNG decoding.
4. Direct DOM inspection of `Coordinates_graph.html` loaded in headless Chrome via `file://`.

---

## 1. Test Harness vs. Actual Application Functions

To maintain strict verification integrity, the test suite is partitioned into two distinct categories:

### A. Standalone Test Harnesses
The files `docs/scratch/phase22_test.js`, `docs/scratch/phase22_browser_test.html`, and `docs/scratch/phase22_integration_test.html` test the core mathematical, rendering, and state-preservation logic in isolation:
- They replicate/extract the pure functions and Canvas2D rendering paths (`drawPointMarker`, `normalizePointStyle`, `preservePointStyles`, `getPointStyleKey`, `computeBounds`, `makeTransform`).
- In `phase22_browser_test.html` and `phase22_integration_test.html`, real Canvas2D elements are rendered inside Google Chrome, and `ctx.getImageData()` confirms actual pixel colors and geometries for Circle, Square, Triangle, and Diamond markers.
- They test PNG generation and decode the resulting PNG back into a canvas to verify pixel integrity after image encoding.
- **Scope limitation:** These harnesses prove that the underlying graphics and algorithmic logic work correctly in a real browser rendering engine, but they do not exercise the DOM event listeners or user controls of the live `Coordinates_graph.html` page.

### B. Actual Application Functions (`Coordinates_graph.html`)
The live application page was loaded directly via `file://` in Google Chrome headless (`--dump-dom`):
- Verified that `Coordinates_graph.html` parses and executes its initialization script without runtime syntax errors or uncaught exceptions.
- Verified that the set manager renders `<div class="setItem active">` for Set 1.
- Verified that per-point style controls (`pointCard`) are dynamically generated with color pickers and shape selects (`<select data-style-key="shape">`) containing all four options (Circle, Square, Triangle, Diamond).
- Verified that dataset attributes (`data-set-id`, `data-label`, `data-style-key`) are properly bound to the DOM elements.

### C. Unexecuted Live-Page Interactions
The following interactions on the live `Coordinates_graph.html` page were **not** executed by automated browser testing:
- **Actual application `#downloadBtn` click:** The automated tests verified PNG generation and pixel decode via the canvas API in the test harness, but the full DOM button click event flow (generating the download link and triggering browser file download) was **NOT TESTED** via browser automation.
- **Real pointer drag interactions:** Headless Chrome in `--dump-dom` mode does not dispatch synthetic mouse drag events (`mousedown`, `mousemove`, `mouseup` on canvas coordinates). Synthetic drag arithmetic was verified in Node.js, and manual dragging was historically reported in earlier passes, but automated browser pointer dragging on the live canvas remains **NOT TESTED**.

---

## 2. Pre-Modification Inspection: Label Offset Independence

### 2.1 Investigation of the Shared Offset Hypothesis
The hypothesis was raised that label offsets might be globally keyed only by `pointOffsets[p.label]`, causing same-label points across different sets to share offset positions.

A detailed inspection of `Coordinates_graph.html` revealed:

1. **Set Allocation (`buildSet`, line 522):**
   ```js
   const set = {
     id: makeSetId(),
     name: name || `Set ${pointSets.length + 1}`,
     inputText: String(inputText || ""),
     points: [],
     pointOffsets: Object.create(null), // Distinct dictionary per set instance
     renderOptions: defaultRenderOptions()
   };
   ```
2. **Offset Initialization (`ensurePointOffsets`, line 548):**
   ```js
   function ensurePointOffsets(set) {
     for (const p of set.points) {
       if (!set.pointOffsets[p.label]) set.pointOffsets[p.label] = { dx: 20, dy: -20 };
     }
   }
   ```
   Offsets are stored on the specific set object (`set.pointOffsets`), not in a global map.

3. **Hit-Testing and Drag Dispatch (lines 876, 1194–1224):**
   - When drawing labels, each bounding box records its owning set ID: `{ setId: set.id, label: p.label, ... }`.
   - On `mousedown`, `drag.setId = hit.setId; drag.label = hit.label;`.
   - On `mousemove`, `const targetSet = getSetById(drag.setId);` retrieves only the specific owning set and updates `targetSet.pointOffsets[drag.label]`.
   - Set A and Set B never share offset state.

### 2.2 Automated Proof of Label Offset Independence
The isolated test suite verified this behavior across 5 targeted scenarios:

| Test | Scenario | Result |
|---|---|---|
| T-OFFSET-1 | Set A and Set B `pointOffsets` are independent object instances | **PASS** |
| T-OFFSET-2 | Mutating Set A `[A]` offset (`dx=99`) leaves Set B `[A]` offset at default (`dx=20`) | **PASS** |
| T-OFFSET-3 | Simulated drag on Set A Point A updates only Set A; Set B Point A unchanged | **PASS** |
| T-OFFSET-4 | Removing Set A preserves Set B's custom offsets | **PASS** |
| T-OFFSET-5 | Slider input event with `data-set-id="set-b"` mutates only Set B | **PASS** |

**Conclusion:** Cross-set label offset isolation is structurally enforced. No defect exists in the application code.

---

## 3. Browser-Engine Verification Results

Real Google Chrome (`--headless=new`) was executed against the standalone test harnesses to verify actual canvas pixel output and PNG decoding.

### 3.1 Standalone Browser Tests (`phase22_browser_test.html`)

| ID | Test | Method | Result | Evidence |
|---|---|---|---|---|
| B1 | Page load & script execution | Real Chrome runtime | **PASS** | Executed without uncaught errors |
| B2 | Red circle marker | `ctx.getImageData` pixel scan | **PASS** | Center pixel confirmed: `rgb(255,0,0)` |
| B3 | Blue square marker | `ctx.getImageData` pixel scan | **PASS** | Center pixel confirmed: `rgb(0,0,255)` |
| B4 | Green triangle marker | `ctx.getImageData` pixel scan | **PASS** | Center pixel confirmed: `rgb(0,170,0)` |
| B5 | Purple diamond marker | `ctx.getImageData` pixel scan | **PASS** | Center pixel confirmed: `rgb(128,0,128)` |
| B6 | Single point color change isolation | Style object mutation | **PASS** | Mutating point A left B and C styles unaffected |
| B7 | Single point shape change isolation | Style object mutation | **PASS** | Changing B shape to diamond left A as circle |
| B8 | Multi-set label offset independence | Multi-set object verification | **PASS** | Set A and Set B offsets confirmed distinct |
| B9 | All four shapes simultaneously | Multi-marker canvas pixel scan | **PASS** | All four marker colors confirmed in canvas pixels |
| B10a| PNG export format & length | `toDataURL('image/png')` | **PASS** | Valid data URL generated (length > 20,000 chars) |
| B10b| PNG pixel decode & inspection | Image decode into new canvas | **PASS** | All 4 marker colors verified in decoded PNG pixels |
| B11 | Runtime error monitoring | `window.addEventListener('error')`| **PASS** | Zero uncaught errors during run |

### 3.2 End-to-End Rendering Pipeline Tests (`phase22_integration_test.html`)

| ID | Pipeline Stage | Result | Evidence |
|---|---|---|---|
| IT1 | Full parse → transform → draw → pixel verify (4 shapes) | **PASS** | Circle, square, triangle, and diamond pixel regions matched |
| IT2 | Multi-set repeated labels rendering (Set 1 A red, Set 2 A purple) | **PASS** | Set 1 A pixel: `{r:255,g:0,b:0,a:255}`; Set 2 A pixel: `{r:128,g:0,b:128,a:255}` |
| IT3a| PNG data URL generation from full scene | **PASS** | Data URL length: 21,214 characters |
| IT3b| Exported PNG image decode and pixel re-inspection | **PASS** | Decoded image contains all four styled marker colors |
| IT4 | Style preservation across 10 consecutive redraw cycles | **PASS** | All point styles intact after 10 re-parses |

### 3.3 Live Application DOM Smoke Test (`Coordinates_graph.html`)

Headless Chrome inspection of `Coordinates_graph.html`:
- Page loaded successfully via direct `file://` protocol.
- Active point set container (`setItem active`) populated.
- Dynamic point cards (`pointCard`) populated for points P, Q, R with:
  - Coordinate headers
  - Label offset sliders (`dx`, `dy`)
  - Color input (`type="color"`)
  - Shape dropdown (`select` with options: Circle, Square, Triangle, Diamond)
- No application JavaScript errors reported.

---

## 4. Evaluation of Live Application Interactivity

| Test Area | Status | Notes |
|---|---|---|
| Four marker shapes rendering | **PASS** | Verified via Chrome headless Canvas2D pixel inspection |
| Independent point color & shape | **PASS** | Verified via Node.js suite and Chrome standalone harness |
| Independent styles across sets | **PASS** | Verified via Node.js suite and Chrome standalone harness |
| Set removal preserves styles | **PASS** | Verified via Node.js structural test |
| Label offset independence | **PASS** | Verified via code audit and Node.js proof |
| Legacy coordinate parsing & fractions | **PASS** | Verified via Node.js tests T13–T15 |
| PNG generation & pixel fidelity | **PASS** (Harness) | Verified via Chrome headless canvas export and image decode |
| Live application `#downloadBtn` click | **NOT TESTED** (Automation) | Automated trigger of `#downloadBtn` click & file download not run |
| Live pointer dragging on canvas | **NOT TESTED** (Automation) | Automated pointer drag events on canvas not run (Playwright unavailable) |
| Direct `file://` offline access | **PASS** | Verified via Chrome headless direct-file execution |

---

## 5. Manual Testing Instructions

To manually verify the two items that could not be automated without Playwright:

### A. Live Canvas Pointer Dragging
1. Double-click `Coordinates_graph.html` to open it in Google Chrome or Microsoft Edge directly via `file://`.
2. Notice the initial sample points P(1,-1), Q(3,1), R(4,10/9).
3. Move the mouse cursor over the label "P(1,-1)" on the canvas.
4. Verify the cursor changes to `grab` / `can-drag`.
5. Click and drag the label to a new position. Verify:
   - The label follows the pointer smoothly.
   - The cursor changes to `grabbing`.
   - Releasing the mouse updates the `dx (px)` and `dy (px)` sliders in the "Set 1 • P label offset" card.
   - Labels for Q and R do not move.
   - The marker shape and color for P do not change.

### B. Live Application PNG Export
1. In the point controls, change point P to a Red Square, point Q to a Green Triangle, and point R to a Purple Diamond.
2. Click the **Draw** button to ensure canvas updates.
3. Click the **Download PNG** button.
4. Open the downloaded `graph-<timestamp>.png` image in an image viewer.
5. Visually confirm:
   - The canvas background, axes, and grid are present.
   - Point P is rendered as a Red Square.
   - Point Q is rendered as a Green Triangle.
   - Point R is rendered as a Purple Diamond.
   - Labels match the positions displayed on the web page.

### C. Console Error Check
1. Press `F12` to open Browser Developer Tools and select the **Console** tab.
2. Perform set switching, styling changes, and drawing.
3. Confirm that zero errors or warnings are emitted by `Coordinates_graph.html`.

---

## 6. Final Decision

**CONDITIONALLY COMPLETE** ⚠️

**Rationale:**
1. **Implementation Correctness:** All Phase 2.2 requirements are implemented correctly in `Coordinates_graph.html`. The underlying Canvas2D rendering functions, shape math, style preservation, and label offset isolation were verified through exhaustive Node.js tests and real Chrome headless canvas pixel sampling.
2. **Defect Status:** The suspected label offset collision hypothesis was thoroughly analyzed and disproven; no code defects exist.
3. **Condition for Final Sign-off:** Automated pointer drag events and live `#downloadBtn` file download could not be automated in this headless environment due to the absence of Playwright. Because unexecuted browser interactions must not be claimed as automated PASS, Phase 2.2 is marked **CONDITIONALLY COMPLETE** pending final manual user confirmation of pointer dragging and PNG file export.

Phase 2.3 has **NOT** been started. Awaiting user authorization.
