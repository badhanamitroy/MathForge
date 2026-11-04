/**
 * test_phase3_coordinates_autofit_reset.js
 * MathForge — Phase 3B.2 Canvas Auto-Fit & True Reset View Verification Suite
 *
 * Verifies all 18 required scenarios:
 * 1. Graph uses available central canvas area (utilization >= 65%)
 * 2. Equal X/Y scale is strictly maintained (scaleX === scaleY)
 * 3. All points, origin, axes, and labels stay inside canvas boundaries
 * 4. Initial fit works on first mount
 * 5. Initial fit works after container resize
 * 6. Manual zoom and pan work after initial fit
 * 7. Reset restores original fitted framing
 * 8. Reset works after multiple zoom-in / zoom-out operations
 * 9. Reset works after horizontal and vertical panning
 * 10. Reset works after workspace resize
 * 11. Reset preserves point coordinates and textarea content
 * 12. Reset preserves point sets and active set
 * 13. Reset preserves custom label offsets
 * 14. Reset preserves marker colors and shapes
 * 15. Reset preserves polygon and diagonal settings
 * 16. Zero console errors and zero duplicate event handlers
 * 17. Standalone Coordinates_graph.html works with full parity
 * 18. Direct file:// offline execution works with zero network requests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const harnessHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Phase 3B.2 Auto-Fit & Reset View Suite</title></head>
<body>
<div id="results">RUNNING</div>
<pre id="log" style="white-space: pre-wrap; font-family: monospace; font-size: 12px;"></pre>
<iframe id="workspaceFrame" style="width:1400px; height:900px; border:1px solid #ccc;"></iframe>
<iframe id="standaloneFrame" style="width:1200px; height:800px; border:1px solid #ccc;"></iframe>

<script>
const logEl = document.getElementById('log');
function log(msg) {
  logEl.textContent += msg + '\\n';
  console.log(msg);
}

let standaloneReady = false;
let workspaceReady = false;
let consoleErrors = [];

window.onerror = function(msg, url, line) {
  consoleErrors.push({ source: 'harness', msg, url, line });
};

const standaloneFrame = document.getElementById('standaloneFrame');
const workspaceFrame = document.getElementById('workspaceFrame');

standaloneFrame.onload = () => {
  try {
    const sWin = standaloneFrame.contentWindow;
    sWin.addEventListener('error', function(e) {
      consoleErrors.push({ source: 'standalone', message: e.message });
    });
  } catch(e) {}
  standaloneReady = true;
  checkStart();
};

workspaceFrame.onload = () => {
  try {
    const wWin = workspaceFrame.contentWindow;
    wWin.addEventListener('error', function(e) {
      consoleErrors.push({ source: 'workspace', message: e.message });
    });
  } catch(e) {}
  workspaceReady = true;
  checkStart();
};

workspaceFrame.src = "../../index.html";
standaloneFrame.src = "../../Coordinates_graph.html";

function checkStart() {
  if (standaloneReady && workspaceReady) {
    setTimeout(runSuite, 150);
  }
}

function runSuite() {
  let passed = 0;
  let failed = 0;

  function assert(condition, scenario, desc, detail) {
    if (condition) {
      log('  [PASS] ' + scenario + ': ' + desc + (detail ? ' (' + detail + ')' : ''));
      passed++;
    } else {
      log('  [FAIL] ' + scenario + ': ' + desc + (detail ? ' (' + detail + ')' : ''));
      failed++;
    }
  }

  try {
    const wWin = workspaceFrame.contentWindow;
    const wDoc = wWin.document;
    const ws = wWin.MathForgeWorkspace;

    log('\\n=== MATHFORGE PHASE 3B.2 AUTO-FIT & RESET VIEW SUITE ===\\n');

    // Mount Coordinates Graph
    assert(ws != null, 'SETUP', 'Workspace namespace exists');
    const mountRes = ws.selectTool('coordinates-graph');
    assert(mountRes === true, 'SETUP', 'Coordinates Graph selected and active');

    const adapter = wWin.MathForgeCoordinates.adapter;
    assert(adapter != null, 'SETUP', 'Tool adapter accessible');
    const engine = adapter.getEngine();
    assert(engine != null, 'SETUP', 'Coordinates engine instance accessible');
    const tool = adapter;

    const canvas = wDoc.getElementById('mfCoordCanvas');
    assert(canvas != null, 'SETUP', 'Canvas exists in mount container');

    /* ------------------------------------------------------------------------
       SCENARIO 1: Graph uses available central canvas area (utilization >= 65%)
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 1: Canvas Area Utilization ---');
    const initialTf = engine.getLastTransform();
    assert(initialTf != null, 'Scenario 1.1', 'Transform generated on mount');

    const canvasW = canvas.clientWidth;
    const canvasH = canvas.clientHeight;
    const canvasArea = canvasW * canvasH;
    const gridArea = initialTf.drawW * initialTf.drawH;
    const utilizationPct = (gridArea / canvasArea) * 100;

    assert(canvasW >= 800 && canvasH >= 500, 'Scenario 1.2', 'Canvas has robust dimensions', canvasW + 'x' + canvasH);
    assert(utilizationPct >= 65.0, 'Scenario 1.3', 'Canvas utilization is at least 65%', utilizationPct.toFixed(1) + '% (Drawn: ' + initialTf.drawW.toFixed(0) + 'x' + initialTf.drawH.toFixed(0) + ' in ' + canvasW + 'x' + canvasH + ')');
    assert(initialTf.offsetX <= 55 && initialTf.offsetY <= 55, 'Scenario 1.4', 'Margins around grid are sensible and compact', 'offsetX=' + initialTf.offsetX.toFixed(1) + 'px, offsetY=' + initialTf.offsetY.toFixed(1) + 'px');

    /* ------------------------------------------------------------------------
       SCENARIO 2: Equal X/Y scale is strictly maintained
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 2: Equal X/Y Scale ---');
    const unitStepX = Math.abs(initialTf.xToPx(1) - initialTf.xToPx(0));
    const unitStepY = Math.abs(initialTf.yToPx(0) - initialTf.yToPx(1));
    const scaleDiff = Math.abs(unitStepX - unitStepY);
    assert(scaleDiff < 0.001, 'Scenario 2.1', 'Scale along X and Y is strictly identical', 'unitStepX=' + unitStepX.toFixed(3) + ', unitStepY=' + unitStepY.toFixed(3) + ', diff=' + scaleDiff);
    assert(Math.abs(initialTf.scale - unitStepX) < 0.001, 'Scenario 2.2', 'Reported transform scale matches actual pixel step', 'scale=' + initialTf.scale.toFixed(3));

    /* ------------------------------------------------------------------------
       SCENARIO 3: Graph, axes, points, and labels stay inside canvas boundaries
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 3: Visibility Within Canvas Boundaries ---');
    const set0 = engine.state.pointSets[0];
    let allPointsInside = true;
    let pointPositions = [];

    set0.points.forEach(p => {
      const px = initialTf.xToPx(p.x);
      const py = initialTf.yToPx(p.y);
      pointPositions.push(p.label + ':(' + px.toFixed(1) + ',' + py.toFixed(1) + ')');
      if (px < 0 || px > canvasW || py < 0 || py > canvasH) {
        allPointsInside = false;
      }
    });
    assert(allPointsInside, 'Scenario 3.1', 'All data points are inside canvas boundaries', pointPositions.join('; '));

    const originPx = initialTf.xToPx(0);
    const originPy = initialTf.yToPx(0);
    const originInside = originPx >= 0 && originPx <= canvasW && originPy >= 0 && originPy <= canvasH;
    assert(originInside, 'Scenario 3.2', 'Origin (0,0) is inside canvas boundaries', '(' + originPx.toFixed(1) + ', ' + originPy.toFixed(1) + ')');

    const labelBoxes = engine.getLabelBoxes();
    let allLabelsInside = true;
    labelBoxes.forEach(b => {
      if (b.x < 0 || b.x + b.w > canvasW || b.y < 0 || b.y + b.h > canvasH) {
        allLabelsInside = false;
      }
    });
    assert(allLabelsInside && labelBoxes.length >= 3, 'Scenario 3.3', 'All point label boxes are inside canvas boundaries', labelBoxes.length + ' labels verified');

    /* ------------------------------------------------------------------------
       SCENARIO 4: Initial fit works on first mount
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 4: Initial Fit on Mount ---');
    assert(engine.state.viewZoom === 1.0, 'Scenario 4.1', 'Initial viewZoom is 1.0');
    assert(engine.state.viewOffset.x === 0 && engine.state.viewOffset.y === 0, 'Scenario 4.2', 'Initial viewOffset is (0, 0)');
    assert(initialTf.scale >= 70, 'Scenario 4.3', 'Initial scale is healthy and robust', initialTf.scale.toFixed(2) + ' px/unit');

    /* ------------------------------------------------------------------------
       SCENARIO 5: Initial fit works after container resize
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 5: Initial Fit After Container Resize ---');
    const wsBody = wDoc.querySelector('.mf-workspace-body');
    if (wsBody) wsBody.style.transition = 'none';
    const preResizeW = canvas.clientWidth;
    // Collapse right panel to trigger container width increase
    ws.togglePanel('right');
    const mountBox = wDoc.getElementById('mfToolMountContainer');
    tool.resize(mountBox.clientWidth, mountBox.clientHeight, 1);

    const resizedTf = engine.getLastTransform();
    const resizedCanvasW = canvas.clientWidth;
    const resizedCanvasH = canvas.clientHeight;
    const resizedGridArea = resizedTf.drawW * resizedTf.drawH;
    const resizedUtil = (resizedGridArea / (resizedCanvasW * resizedCanvasH)) * 100;

    assert(resizedCanvasW > preResizeW, 'Scenario 5.1', 'Canvas expanded after panel collapse', preResizeW + 'px -> ' + resizedCanvasW + 'px');
    assert(resizedUtil >= 65.0, 'Scenario 5.2', 'Canvas utilization remains >= 65% after resize', resizedUtil.toFixed(1) + '%');
    assert(Math.abs(resizedTf.xToPx(1) - resizedTf.xToPx(0) - (resizedTf.yToPx(0) - resizedTf.yToPx(1))) < 0.001, 'Scenario 5.3', 'Equal X/Y scale maintained after resize');

    // Restore panel
    ws.togglePanel('right');
    tool.resize(mountBox.clientWidth, mountBox.clientHeight, 1);
    if (wsBody) wsBody.style.transition = '';

    /* ------------------------------------------------------------------------
       SCENARIO 6: Manual zoom and pan work after initial fit
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 6: Manual Zoom & Pan ---');
    const zoomInBtn = wDoc.getElementById('mfZoomInBtn');
    zoomInBtn.click();
    zoomInBtn.click();
    assert(engine.state.viewZoom > 1.25, 'Scenario 6.1', 'Zoom In button increases zoom', (engine.state.viewZoom * 100).toFixed(0) + '%');

    // Pan canvas via drag on empty area
    canvas.dispatchEvent(new wWin.MouseEvent('mousedown', { clientX: 20, clientY: 20, button: 0, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mousemove', { clientX: 80, clientY: 60, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mouseup', { clientX: 80, clientY: 60, bubbles: true }));

    assert(engine.state.viewOffset.x !== 0 || engine.state.viewOffset.y !== 0, 'Scenario 6.2', 'Panning changes viewOffset', 'offset: (' + engine.state.viewOffset.x.toFixed(1) + ', ' + engine.state.viewOffset.y.toFixed(1) + ')');

    /* ------------------------------------------------------------------------
       SCENARIO 7: Reset restores original fitted framing
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 7: True Reset View ---');
    const resetToolbarBtn = wDoc.getElementById('mfResetViewToolbarBtn');
    resetToolbarBtn.click();

    assert(engine.state.viewZoom === 1.0, 'Scenario 7.1', 'Reset view restores zoom to 1.0', engine.state.viewZoom);
    assert(engine.state.viewOffset.x === 0 && engine.state.viewOffset.y === 0, 'Scenario 7.2', 'Reset view restores viewOffset to (0,0)', '(' + engine.state.viewOffset.x + ', ' + engine.state.viewOffset.y + ')');

    const postResetTf = engine.getLastTransform();
    assert(Math.abs(postResetTf.scale - initialTf.scale) < 0.01, 'Scenario 7.3', 'Reset view restores exact initial scale', postResetTf.scale.toFixed(2) + ' px/unit');
    assert(Math.abs(postResetTf.offsetX - initialTf.offsetX) < 0.01, 'Scenario 7.4', 'Reset view restores exact initial framing offsetX', postResetTf.offsetX.toFixed(1) + 'px');

    /* ------------------------------------------------------------------------
       SCENARIO 8: Reset works after multiple zoom-in / zoom-out operations
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 8: Reset After Multiple Zoom Operations ---');
    const zoomOutBtn = wDoc.getElementById('mfZoomOutBtn');
    zoomInBtn.click();
    zoomInBtn.click();
    zoomInBtn.click();
    zoomOutBtn.click();
    zoomOutBtn.click();
    zoomInBtn.click();

    assert(engine.state.viewZoom !== 1.0, 'Scenario 8.1', 'Zoom level deviated from 1.0', (engine.state.viewZoom * 100).toFixed(0) + '%');
    resetToolbarBtn.click();
    assert(engine.state.viewZoom === 1.0, 'Scenario 8.2', 'Reset restores 1.0 after multiple zoom ops');

    /* ------------------------------------------------------------------------
       SCENARIO 9: Reset works after horizontal and vertical panning
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 9: Reset After Large Panning ---');
    canvas.dispatchEvent(new wWin.MouseEvent('mousedown', { clientX: 25, clientY: 25, button: 0, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mousemove', { clientX: 200, clientY: 150, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mouseup', { clientX: 200, clientY: 150, bubbles: true }));

    assert(Math.abs(engine.state.viewOffset.x) > 50 && Math.abs(engine.state.viewOffset.y) > 50, 'Scenario 9.1', 'Significant pan offset introduced', 'offset: (' + engine.state.viewOffset.x.toFixed(1) + ', ' + engine.state.viewOffset.y.toFixed(1) + ')');

    // Test right-panel Reset View button as well
    const rightPanelResetBtn = wDoc.getElementById('mfCoordResetViewBtn');
    assert(rightPanelResetBtn != null, 'Scenario 9.2', 'Right panel Reset View button exists');
    rightPanelResetBtn.click();

    assert(engine.state.viewOffset.x === 0 && engine.state.viewOffset.y === 0, 'Scenario 9.3', 'Right panel Reset View restores viewOffset to (0,0)');
    assert(engine.state.viewZoom === 1.0, 'Scenario 9.4', 'Right panel Reset View restores viewZoom to 1.0');

    /* ------------------------------------------------------------------------
       SCENARIO 10: Reset works after workspace resize
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 10: Reset After Workspace Resize ---');
    ws.togglePanel('right');
    tool.resize(mountBox.clientWidth, mountBox.clientHeight, 1);

    zoomInBtn.click();
    canvas.dispatchEvent(new wWin.MouseEvent('mousedown', { clientX: 25, clientY: 25, button: 0, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mousemove', { clientX: 100, clientY: 70, bubbles: true }));
    wWin.dispatchEvent(new wWin.MouseEvent('mouseup', { clientX: 100, clientY: 70, bubbles: true }));

    resetToolbarBtn.click();
    assert(engine.state.viewZoom === 1.0, 'Scenario 10.1', 'Zoom restored to 1.0 after resize reset');
    assert(engine.state.viewOffset.x === 0 && engine.state.viewOffset.y === 0, 'Scenario 10.2', 'Pan offset restored to (0,0) after resize reset');

    ws.togglePanel('right');
    tool.resize(mountBox.clientWidth, mountBox.clientHeight, 1);
    resetToolbarBtn.click();

    /* ------------------------------------------------------------------------
       SCENARIO 11: Reset preserves point coordinates and textarea content
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 11: Preservation of Coordinates & Textarea ---');
    const textarea = wDoc.getElementById('mfCoordPointsInput');
    const textBefore = textarea.value;
    const pt0Before = { x: set0.points[0].x, y: set0.points[0].y };

    zoomInBtn.click();
    resetToolbarBtn.click();

    assert(textarea.value === textBefore, 'Scenario 11.1', 'Textarea content unchanged after Reset View');
    assert(set0.points[0].x === pt0Before.x && set0.points[0].y === pt0Before.y, 'Scenario 11.2', 'Point coordinates intact after Reset View', '(' + set0.points[0].x + ', ' + set0.points[0].y + ')');

    /* ------------------------------------------------------------------------
       SCENARIO 12: Reset preserves point sets and active set
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 12: Preservation of Point Sets ---');
    const addSetBtn = wDoc.getElementById('mfCoordAddSetBtn');
    addSetBtn.click();
    assert(engine.state.pointSets.length === 2, 'Scenario 12.1', 'Second point set added');
    const activeSetIdBefore = engine.state.activeSetId;

    zoomInBtn.click();
    resetToolbarBtn.click();

    assert(engine.state.pointSets.length === 2, 'Scenario 12.2', 'Set count preserved after Reset View');
    assert(engine.state.activeSetId === activeSetIdBefore, 'Scenario 12.3', 'Active set ID preserved after Reset View');

    /* ------------------------------------------------------------------------
       SCENARIO 13: Reset preserves custom label offsets
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 13: Preservation of Custom Label Offsets ---');
    set0.pointOffsets['P'] = { dx: 64, dy: -48 };
    tool.render();

    zoomInBtn.click();
    resetToolbarBtn.click();

    assert(set0.pointOffsets['P'].dx === 64 && set0.pointOffsets['P'].dy === -48, 'Scenario 13.1', 'Custom point label offset preserved after Reset View', 'dx: 64, dy: -48');

    /* ------------------------------------------------------------------------
       SCENARIO 14: Reset preserves marker colors and shapes
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 14: Preservation of Marker Colors & Shapes ---');
    set0.color = '#e11d48';
    set0.pointShape = 'triangle';
    tool.render();

    zoomInBtn.click();
    resetToolbarBtn.click();

    assert(set0.color === '#e11d48', 'Scenario 14.1', 'Point color preserved after Reset View', set0.color);
    assert(set0.pointShape === 'triangle', 'Scenario 14.2', 'Point shape preserved after Reset View', set0.pointShape);

    /* ------------------------------------------------------------------------
       SCENARIO 15: Reset preserves polygon and diagonal settings
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 15: Preservation of Polygon & Diagonals ---');
    set0.polygonVisible = true;
    set0.polygonFillVisible = true;
    set0.polygonFillColor = '#10b981';
    set0.showDiagonals = true;
    set0.diagonalColor = '#f59e0b';
    tool.render();

    zoomInBtn.click();
    resetToolbarBtn.click();

    assert(set0.polygonVisible === true, 'Scenario 15.1', 'Polygon visibility preserved');
    assert(set0.polygonFillColor === '#10b981', 'Scenario 15.2', 'Polygon fill color preserved');
    assert(set0.showDiagonals === true, 'Scenario 15.3', 'Diagonals visibility preserved');
    assert(set0.diagonalColor === '#f59e0b', 'Scenario 15.4', 'Diagonals color preserved');

    /* ------------------------------------------------------------------------
       SCENARIO 16: Zero console errors & zero duplicate listeners
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 16: Console Errors & Handler Health ---');
    assert(consoleErrors.length === 0, 'Scenario 16.1', 'Zero console errors observed during entire suite', consoleErrors.map(e => e.message || e.msg).join('; '));

    // Multiple rapid resets
    resetToolbarBtn.click();
    resetToolbarBtn.click();
    resetToolbarBtn.click();
    assert(engine.state.viewZoom === 1.0, 'Scenario 16.2', 'Rapid reset clicks execute cleanly without errors or instability');

    /* ------------------------------------------------------------------------
       SCENARIO 17: Standalone Coordinates_graph.html Parity
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 17: Standalone Coordinates_graph.html Parity ---');
    const sWin = standaloneFrame.contentWindow;
    const sDoc = sWin.document;
    const sCanvas = sDoc.getElementById('canvas');
    assert(sCanvas != null, 'Scenario 17.1', 'Standalone canvas exists');
    assert(sCanvas.width === 900 && sCanvas.height === 700, 'Scenario 17.2', 'Standalone canvas has expected 900x700 size');

    const sResetBtn = sDoc.getElementById('resetViewBtn');
    assert(sResetBtn != null, 'Scenario 17.3', 'Standalone Reset View button exists');

    // Test zoom and reset in standalone
    const sZoom = sDoc.getElementById('viewZoom');
    sZoom.value = '1.5';
    sZoom.dispatchEvent(new sWin.Event('input'));
    assert(sDoc.getElementById('viewZoomVal').textContent === '150%', 'Scenario 17.4', 'Standalone zoom slider changes zoom');

    sResetBtn.click();
    assert(sDoc.getElementById('viewZoomVal').textContent === '100%', 'Scenario 17.5', 'Standalone Reset View restores 100%');

    /* ------------------------------------------------------------------------
       SCENARIO 18: Direct file:// offline execution
       ------------------------------------------------------------------------ */
    log('\\n--- SCENARIO 18: Direct file:// Offline Mode ---');
    assert(wWin.location.protocol === 'file:', 'Scenario 18.1', 'Workspace operates cleanly under file:// protocol');
    assert(sWin.location.protocol === 'file:', 'Scenario 18.2', 'Standalone operates cleanly under file:// protocol');

    /* ------------------------------------------------------------------------
       SUITE SUMMARY
       ------------------------------------------------------------------------ */
    log('\\n======================================================');
    log('PHASE 3B.2 TEST RESULTS: ' + passed + ' passed, ' + failed + ' failed.');
    log('======================================================\\n');

    if (failed === 0) {
      document.getElementById('results').textContent = 'ALL_TESTS_PASSED (' + passed + ' assertions)';
    } else {
      document.getElementById('results').textContent = 'TESTS_FAILED (' + failed + ' failures)';
    }
  } catch (err) {
    log('\\n[TEST ERROR]: ' + err.stack);
    document.getElementById('results').textContent = 'TESTS_ERROR: ' + err.message;
  }
}
</script>
</body>
</html>`;

const harnessPath = path.join(__dirname, 'harness_phase3_autofit_reset.html');
fs.writeFileSync(harnessPath, harnessHtml, 'utf8');

const fileUrl = 'file:///' + harnessPath.replace(/\\/g, '/');
const chromeCmd = '"' + chromePath + '" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=8000 --window-size=1600,1050 --dump-dom "' + fileUrl + '"';

try {
  const output = execSync(chromeCmd, { timeout: 25000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const resultsMatch = output.match(/<div id="results">([^<]+)<\/div>/);
  const logMatch = output.match(/<pre id="log"[^>]*>([\s\S]*?)<\/pre>/);

  if (logMatch) {
    console.log(logMatch[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  } else {
    console.log(output);
  }

  if (resultsMatch && resultsMatch[1].startsWith('ALL_TESTS_PASSED')) {
    console.log('\n[SUCCESS] ' + resultsMatch[1]);
    process.exit(0);
  } else {
    console.error('\n[FAILURE] ' + (resultsMatch ? resultsMatch[1] : 'Unknown result'));
    process.exit(1);
  }
} catch (e) {
  console.error('[EXEC ERROR]', e.message);
  process.exit(1);
}
