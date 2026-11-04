const fs = require('fs');
let status = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8');

const targetHeader = [
  '**Status as of this document:** Phase 2.3 APPROVED after Final Approval Audit; awaiting authorization before any Phase 2.4 planning.',
  '',
  '---',
  '',
  '## Phase Status Summary',
  '',
  '| Phase | Feature | Status | Report |',
  '|---|---|---|---|',
  '| Phase 1 | UI/UX Professionalization | ✅ Complete | [PHASE_1_UI_UX_IMPLEMENTATION_REPORT.md](./PHASE_1_UI_UX_IMPLEMENTATION_REPORT.md) |',
  '| Phase 1.1 | Regression verification | ✅ Complete | [PHASE_1_1_REGRESSION_TEST_REPORT.md](./PHASE_1_1_REGRESSION_TEST_REPORT.md) |',
  '| Phase 2.1 | Multiple Point Sets | ✅ Complete | [PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md](./PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md) |',
  '| Phase 2.2 | Point Styling (color + marker shape) | ✅ Complete | [PHASE_2_2_FINAL_BROWSER_VERIFICATION.md](./PHASE_2_2_FINAL_BROWSER_VERIFICATION.md) |',
  '| Phase 2.3 | Line & Polygon Controls | ✅ Approved | [PHASE_2_3_LINE_POLYGON_CONTROLS_REPORT.md](./PHASE_2_3_LINE_POLYGON_CONTROLS_REPORT.md) |',
  '',
  '---'
].join('\r\n');

const newHeader = [
  '**Status as of this document:** Phase 2.4 Complete and Verified; awaiting review and authorization before any Phase 2.5 planning.',
  '',
  '---',
  '',
  '## Phase Status Summary',
  '',
  '| Phase | Feature | Status | Report |',
  '|---|---|---|---|',
  '| Phase 1 | UI/UX Professionalization | ✅ Complete | [PHASE_1_UI_UX_IMPLEMENTATION_REPORT.md](./PHASE_1_UI_UX_IMPLEMENTATION_REPORT.md) |',
  '| Phase 1.1 | Regression verification | ✅ Complete | [PHASE_1_1_REGRESSION_TEST_REPORT.md](./PHASE_1_1_REGRESSION_TEST_REPORT.md) |',
  '| Phase 2.1 | Multiple Point Sets | ✅ Complete | [PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md](./PHASE_2_1_MULTIPLE_POINT_SETS_REPORT.md) |',
  '| Phase 2.2 | Point Styling (color + marker shape) | ✅ Complete | [PHASE_2_2_FINAL_BROWSER_VERIFICATION.md](./PHASE_2_2_FINAL_BROWSER_VERIFICATION.md) |',
  '| Phase 2.3 | Line & Polygon Controls | ✅ Approved | [PHASE_2_3_LINE_POLYGON_CONTROLS_REPORT.md](./PHASE_2_3_LINE_POLYGON_CONTROLS_REPORT.md) |',
  '| Phase 2.4 | Graph Customization & View Controls | ✅ Complete | [PHASE_2_4_GRAPH_CUSTOMIZATION_REPORT.md](./PHASE_2_4_GRAPH_CUSTOMIZATION_REPORT.md) |',
  '',
  '---',
  '',
  '## Phase 2.4 Verified Capabilities & Verification State',
  '',
  '### Grid Controls',
  '- **Visibility:** Toggle ON/OFF cleanly hides/shows grid lines without affecting axes or points.',
  '- **Color & Opacity:** Independent color picker and opacity slider (0–100%).',
  '- **Coordinate Spacing:** 1-unit minor grid and 5-unit major grid spacing preserved.',
  '',
  '### Axis Controls',
  '- **Independent Visibility:** Separate ON/OFF toggles for X-axis and Y-axis.',
  '- **Axis Color & Width:** Independent color picker and line width slider (1–8px).',
  '- **Axis & Tick Labels:** Toggle ON/OFF for tick numbers and "X", "Y", "O" labels.',
  '',
  '### Coordinate Label Controls',
  '- **Precision Options:** Select dropdown with Auto (preserves fractions/raw strings), 0 (integer), 1, 2, 3 decimals.',
  '- **Label Visibility:** Independent toggle ON/OFF.',
  '- **Collision Avoidance:** Staggering default label offsets to prevent overlaps.',
  '',
  '### Canvas Background Controls',
  '- **Custom Background:** Color picker sets graph background color.',
  '- **Reset Button:** Restores default pure white background (`#ffffff`).',
  '',
  '### View & Pan/Zoom Controls',
  '- **Canvas Panning:** Click and drag on empty canvas space smoothly pans graph view.',
  '- **Wheel Zoom:** Mouse wheel scrolling zooms in/out between 40% and 300%.',
  '- **Reset View Button:** Non-destructive view reset restores origin and 100% zoom without deleting points, modifying styles, or altering polygon/diagonal settings.',
  '',
  '### PNG Export Fidelity',
  '- Decoded exported PNG verifies customized background color, grid lines, axis styles, coordinate precisions, and pan/zoom positions.',
  '',
  '---'
].join('\r\n');

status = status.replace(targetHeader, newHeader);
fs.writeFileSync('docs/PROJECT_STATUS.md', status, 'utf8');
console.log('PROJECT_STATUS.md updated successfully.');
