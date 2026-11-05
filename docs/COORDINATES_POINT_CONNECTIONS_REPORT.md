# Coordinates Point Connections and Polygon Fill Report

## Summary

The Coordinates renderer previously built a closed path from every point set containing at least three points. `defaultRenderOptions()` also enabled the polygon and fill by default. As a result, adding a third point made a boundary appear and its interior could be filled, even though the user had not requested a connection or a closed shape. The project state did not contain a separate connection model.

The workspace now stores points, connection segments, and closed shapes separately. The project remains `.mathforge` version 1.

## Data and compatibility

- Parsed points have stable IDs. Edits through the structured point rows carry IDs forward, including coordinate and label edits.
- `connections` stores `{ id, startSetId, startPointId, endSetId, endPointId }`. Segment endpoints resolve by ID, not array index. Reversed duplicates are rejected.
- `closedShapes` stores `{ id, setId, pointIds }`. One explicitly closable shape is supported per point set; multiple sets can each contain their own independently closable shape.
- Line visibility, color, width, and style, plus fill enabled state, color, and opacity, are top-level Coordinates state and persist through the adapter's existing state serialization.
- Older states that saved a visible polygon are migrated into a closed shape once. The legacy auto-polygon option is then disabled, so later point edits do not silently enlarge that old shape. Old version-1 projects without any polygon/connection settings still open with no lines or fill.
- No `.mathforge` schema or format version change was made.

## Interaction and drawing

- Normal point input remains Add Point, edit rows, then Plot Points. These actions do not create lines.
- Connect Points mode accepts clicks only on existing canvas markers. Empty canvas clicks do not pan or create points while this mode is active. The selected first endpoint is circled; after a successful segment the mode stays on for more pairs. Cancel Connection clears the partial selection and exits the mode.
- Connections can span point sets. Each can be removed from the list without deleting either endpoint. Show/Hide All Lines hides segments, shape outlines, and the existing optional diagonals, while point markers remain visible. Clear All Connections removes segment data only.
- Close Shape explicitly closes the active set in its displayed point order and requires at least three distinct point IDs. Reopen Shape removes only that set's closure. Fill is disabled by default, uses its own color/opacity, and is painted before outlines and points. Hiding lines does not hide fill.
- PNG uses the shared rendered canvas. The existing SVG path embeds a PNG snapshot of that same canvas, so connection and fill output stays aligned with the on-screen result.

## Files changed

- `assets/js/tools/coordinates-tool.js` — point IDs, separate segment/shape model, migration, drawing, inputs, and canvas connection interaction.
- `assets/css/tools/coordinates-tool.css` — connection and fill controls styling.
- `tests/coordinates-connections.test.js` — regression tests for independent points, segment IDs, duplicate prevention, explicit closure, deletion cleanup, render visibility, persistence, and legacy migration.
- `docs/PROJECT_STATUS.md`
- `docs/PROJECT_CHANGELOG.md`
- `docs/COORDINATES_POINT_CONNECTIONS_REPORT.md`
- Generated mirrors: `dist/assets/js/tools/coordinates-tool.js` and `dist/assets/css/tools/coordinates-tool.css`.

## Verification results

- Focused Coordinates tests: **8/8 passed** after implementing the renderer, state migration, and testable connection-mode selection/cancellation.
- `node --test tests/*.test.js`: final run **78/78 passed**, including IndexedDB and Vercel local-preview tests. One earlier run intermittently failed the existing IndexedDB recovery-copy mock; it passed on the final rerun.
- JavaScript syntax checks for all `assets/js/**/*.js`, `service-worker.js`, and the new Coordinates test: **passed**.
- `node scripts/prepare-vercel.mjs`: **passed**.
- SHA-256 source/dist comparisons for `coordinates-tool.js`, `coordinates-tool.css`, `index.html`, and `service-worker.js`: **4/4 matched**.
- Real browser interaction, viewport visuals, and hands-on project/export workflows were **not performed**. The available browser control rejected the local `file:` URL by policy. Node rendering tests verify path creation and visibility state, but do not replace visual confirmation in the browser.

## Remaining limitations and manual checks

- A point set supports one closed shape at a time. Use separate point sets for independently managed shapes.
- Closing a set uses its current point order. Arbitrary connections remain independent and are not inferred as a polygon boundary.
- SVG export for Coordinates remains the existing raster-backed SVG snapshot; it is not newly converted to native vector paths.
- The unrelated IndexedDB test failure needs investigation separately if it continues in the user's environment.

Manual verification: add three points and confirm no edges/fill appear; connect nonconsecutive pairs and confirm reverse duplicates are rejected; cancel after selecting the first point and click empty canvas in connection mode; hide lines and confirm points/fill remain; close/reopen a set and test fill color/opacity; delete an endpoint and confirm dependent connections are removed; save/reopen a project containing points, connections, and a shape; export PNG and SVG and compare the output with the canvas. Also open `Coordinates_graph.html` directly to confirm its legacy polygon toggle remains available.
