# Phase 2.1 — Multiple Point Sets

## 1. Objective

Add support for multiple independently managed point sets in the existing Coordinates Graph tool without rewriting the graph engine, changing the coordinate conventions, or breaking the single-set workflow.

## 2. Architecture audit

### Existing model before change

The Coordinates Graph page was built around a single data flow:

- A single textarea held all point input text.
- A single `points` array was parsed and rendered.
- Point labels were stored as objects with a label and numeric x/y values.
- A single global label-offset map controlled all label positions.
- Axis generation, point drawing, and export all worked from that single set of data.

This meant the tool was structurally sound for one dataset but had no concept of independent groups or namespaced label offsets.

### Architectural risk areas

The main regression risks were:

1. Label collisions when the same point label appeared in multiple groups.
2. Combined bounds calculations that would ignore additional sets.
3. Regression of the legacy single-set flow if the existing parser and drawing logic were replaced.
4. Drag interactions that might accidentally mutate the wrong set's offsets.
5. Export behavior and direct offline usage being affected by UI changes.

### Safe integration approach

The adopted approach was to preserve the original graph engine and add a lightweight set layer around it:

- Each point set stores its own `id`, human-readable `name`, `inputText`, `points`, and `pointOffsets`.
- The active set remains editable through the existing textarea flow.
- The render pipeline iterates through all sets and draws each one using the same coordinate transform.
- Bounds calculation aggregates all relevant point sets before axis generation.
- Label offsets are namespaced by set id and point label to ensure same labels across sets do not collide.

## 3. Implementation details

### Data structure

The new structure follows the approved set-based model:

```js
pointSets = [
  {
    id: uniqueId,
    name: "Set 1",
    inputText: "A(1,2)\nB(3,4)",
    points: [],
    pointOffsets: {}
  }
];
```

### UI approach

The implementation keeps the original page and graph engine intact while adding:

- an Add set button,
- per-set rename inputs,
- a select button to activate a set,
- a remove button that preserves the minimum single-set workflow,
- a set-aware control panel for label offsets.

### Rendering behavior

The graph draw path was kept in the same coordinate transformation system used by the original tool:

- all sets are transformed through the same `xToPx` / `yToPx` mapping,
- each set is drawn independently,
- the chart bounds are calculated from all point sets,
- the math conventions remain unchanged.

### Label management

To avoid collisions when different sets share the same label names, the implementation tracks offsets by set and label:

- `set.pointOffsets[label].dx`
- `set.pointOffsets[label].dy`

This preserves the original labeling behavior while allowing independent drag placement per set.

## 4. Files changed and audited

### Modified file

- [../Coordinates_graph.html](../Coordinates_graph.html)

### Audited but intentionally preserved

- [../assets/js/common.js](../assets/js/common.js)
- [../assets/css/common.css](../assets/css/common.css)

### Documentation updated

- [PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md)
- [PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md](./PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md)

## 5. Features added

- Add Point Set
- Rename Point Set
- Remove Point Set
- Switch between sets without losing their content
- Independent point editing per set through the existing textarea workflow
- Independent label offset controls per point and per set
- Combined rendering of multiple sets on one graph plane
- Shared axis and coordinate scale using all relevant point sets
- Legacy single-set compatibility preserved

## 6. Existing functionality preserved

The implementation kept the following behaviors intact:

- original coordinate input syntax,
- sample reset behavior,
- fraction parsing,
- point label rendering,
- show/hide label controls,
- graph drawing logic,
- PNG export,
- direct browser opening via `file://`,
- offline compatibility without frameworks or external services.

## 7. Test environment

- OS: Windows 11
- Browser: Playwright Chromium
- Page: `file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/Coordinates_graph.html`
- JavaScript validation method: Node `new Function` parse check against extracted inline script blocks

## 8. Actual test results

### JavaScript parse validation

Executed with Node against the page’s inline scripts.

Result:

```text
Parsed inline scripts OK
Scripts: 2
```

### Browser smoke validation

Executed in a live Chromium browser session against the direct-file page URL.

Observed results:

- Page loaded without runtime errors.
- Initial set list rendered as expected.
- Add set action increased the set count from 1 to 2.
- Renaming set labels succeeded.
- Drawing after editing points completed without page errors.
- Export to PNG succeeded and generated a non-empty image data URL.
- Removing a second set kept the remaining set intact.

Actual browser result summary:

```json
{
  "initial": ["Set 1"],
  "afterAdd": ["Set 1", "Set 2"],
  "activeSetCount": 2,
  "remaining": ["Legacy Set"],
  "pngLength": 44366,
  "dxSliderValue": "42"
}
```

The page error list was empty during the executed checks.

## 9. Known limitations and remaining work

- This scope intentionally does not add custom point styling, polygon controls, or other Phase 2.2 features.
- The implementation was kept lightweight and offline-compatible; no framework or backend was introduced.
- Advanced visual regression coverage for all browser edge cases still benefits from manual review in a real desktop environment.
- Further phase work should continue only after reviewing this report and confirming the targeted scope remains appropriate.

## 10. Manual verification instructions

1. Open the Coordinates Graph page directly from the project folder using a browser.
2. Confirm the default sample set loads.
3. Use Add set and rename multiple sets.
4. Enter distinct coordinates in each set and click Draw.
5. Confirm both sets appear on the same graph plane.
6. Repeat point labels across sets and confirm the sets remain independent.
7. Drag a label in one set and verify the other set does not move its label offset.
8. Remove a set and verify the minimum single-set workflow still behaves normally.
9. Export the graph to PNG and confirm the image is generated successfully.
10. Keep the browser offline and verify the page still loads directly from the file system.

## 11. Focused functional verification

The following verification was executed in Playwright Chromium against the direct-file Coordinates Graph page.

### Test 1 — Same labels across sets

- Steps executed: create two sets; add A(1,2), B(3,4) to Set 1; add A(-2,3), B(-4,5) to Set 2; draw the graph.
- Expected result: all four points render and labels remain independently placed.
- Actual result: pointCards = 2, setNames = ["Set 1", "Set 2"], labels = ["A", "B"], PNG generated successfully.
- Result: PASS

### Test 2 — Independent editing

- Steps executed: edit Set 1, switch to Set 2 and edit it, then switch back to Set 1.
- Expected result: each set keeps its own coordinates.
- Actual result: Set 1 remained A(10,10) / B(12,12), Set 2 remained C(-10,-10) / D(-12,-12), and Set 1 was restored correctly after switching back.
- Result: PASS

### Test 3 — Independent label offsets

- Steps executed: set Set 1 label A dx to 44, switch to Set 2 and set label A dx to -36, then switch back.
- Expected result: offsets are stored and rendered independently per set.
- Actual result: set1Offset = "44", set2Offset = "-36", set1Back = "44".
- Result: PASS

### Test 4 — Set removal

- Steps executed: create three named sets (Alpha, Beta, Gamma); remove the middle set.
- Expected result: the remaining sets retain names and coordinates.
- Actual result: remainingNames = ["Alpha", "Gamma"].
- Result: PASS

### Test 5 — Combined graph bounds

- Steps executed: place one set in positive coordinates and another in negative coordinates, then draw.
- Expected result: all points are represented in one graph with proper bounds.
- Actual result: PNG length = 42038, confirming a valid graph render.
- Result: PASS

### Test 6 — Legacy compatibility

- Steps executed: enter the original coordinate syntax with fractions, click Draw, then click Reset Sample.
- Expected result: legacy single-set workflow remains functional.
- Actual result: afterDraw = "P(1,-1)\nQ(3,1)\nR(4,10/9)" and afterReset restored the sample text.
- Result: PASS

### Test 7 — Export and offline

- Steps executed: click Download PNG while the file is opened directly through file://.
- Expected result: PNG export succeeds and no runtime/browser errors occur.
- Actual result: directFile = true, PNG length = 44366, pageErrors = [].
- Result: PASS

## 12. Conclusion

The multiple point set feature was implemented in a minimal, offline-compatible way by layering a set-aware data model over the existing graphing logic. The legacy single-set behavior was preserved, the direct-file workflow remained intact, and the executed validation checks showed no runtime page errors in the browser. No reproducible application bug was found during this focused verification pass.
