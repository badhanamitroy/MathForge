const fs = require('fs');
let changelog = fs.readFileSync('docs/PROJECT_CHANGELOG.md', 'utf8');

const p24Entry = [
  '# Project Changelog',
  '',
  '## [Phase 2.4] Graph Customization & View Controls',
  '',
  '### Date',
  '2026-11-01',
  '',
  '### Overview',
  'Implemented comprehensive graph canvas visual customization and interactive view controls in `Coordinates_graph.html`. Added grid line visibility, color picker, and opacity slider; independent X-axis and Y-axis visibility toggles, axis color picker, axis width slider, and axis/tick labels toggle; coordinate label precision options (auto [retains fractions/raw], 0 [integer], 1, 2, 3 decimals) with collision avoidance; canvas background color picker and reset button; smooth mouse wheel zoom, empty canvas panning, zoom slider, and non-destructive "Reset View" button. Updated PNG export to faithfully capture all customized settings and transforms. Verified with 39 automated tests across isolated unit tests, live application browser tests, and regression suites.',
  '',
  '### Updated files',
  '- [Coordinates_graph.html](../Coordinates_graph.html) (updated)',
  '- [PHASE_2_4_GRAPH_CUSTOMIZATION_REPORT.md](./PHASE_2_4_GRAPH_CUSTOMIZATION_REPORT.md) (created)',
  '- [PROJECT_STATUS.md](./PROJECT_STATUS.md) (updated)',
  '- [PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md) (updated)',
  '- [scratch/phase24_isolated_test.js](./scratch/phase24_isolated_test.js) (created)',
  '- [scratch/phase24_browser_test.html](./scratch/phase24_browser_test.html) (created)',
  '- [scratch/run_phase24_test.js](./scratch/run_phase24_test.js) (created)',
  '',
  '### Key additions & fixes',
  '- Added Grid Controls section: `#gridVisible` toggle, `#gridColor` color picker, `#gridOpacity` slider.',
  '- Added Axis Controls section: independent `#xAxisVisible` and `#yAxisVisible` toggles, `#axisColor` color picker, `#axisWidth` slider, and `#axisLabelsVisible` toggle.',
  '- Added Coordinate Label Precision: `#coordPrecision` select (Auto, 0, 1, 2, 3 decimals) and overlap collision avoidance for default offsets.',
  '- Added Background Controls: `#canvasBgColor` color picker and `#resetBgBtn` default background restorer.',
  '- Added View Controls: interactive empty-space canvas panning, mouse wheel zoom, `#viewZoom` slider, and non-destructive `#resetViewBtn` which resets zoom/pan without altering points or visual styling.',
  '- Preserved 100% backward compatibility for multi-set point storage, Phase 2.2 per-point styling, Phase 2.3 polygon/diagonal options, and direct `file://` offline operation.',
  '',
  '### Verification highlights',
  '- 4 isolated Node.js unit tests PASS.',
  '- 7 live application browser tests in Google Chrome headless PASS (including canvas pixel sampling via `ctx.getImageData()` and decoded exported PNG pixel inspection).',
  '- 28 regression and approval tests across Phase 2.1, 2.2, and 2.3 continue to PASS.',
  '- Total automated tests across all test suites: 39 PASS, 0 FAIL.',
  ''
].join('\r\n');

changelog = changelog.replace('# Project Changelog\r\n', p24Entry);
fs.writeFileSync('docs/PROJECT_CHANGELOG.md', changelog, 'utf8');
console.log('PROJECT_CHANGELOG.md updated successfully.');
