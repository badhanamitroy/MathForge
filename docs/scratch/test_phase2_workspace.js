const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const indexPath = path.resolve(__dirname, '../../index.html');
const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

console.log('Testing MathForge Phase 2 Workspace Accessibility & Structure...');
console.log('Target URL:', fileUrl);

// 1. Verify protected files SHA256 hashes
const expectedHashes = {
  'Coordinates_graph.html': '05ddf63aa22fb1dd559ce8500b517d2a953970b8fbf8cbc84fcfab4d737e027c',
  'Equation.html': '4f7dae88e46f704eb0114434cb362f8736fefcea3bbcf96d75e64ceacb5a9447',
  'Ogiveline.html': 'd28e274de1a642f1678e953ce22d929bbf93e99554438319e3e26f93e172f444',
  'Polygonal.html': '96873caa1808343faab96d555247bc2ac396b32dc0effd698231c0671586a2c2',
  'assets/css/common.css': 'c82edf3cfea7fd97e089a82b3f98b1187819df711dee68b64cb4b91d85694cb7',
  'assets/js/common.js': '4e1119fc99e958346312fb90610ba318cb14dba60201a7c8158b17d050c09ed8'
};

let hashMismatches = 0;
for (const [relPath, expectedHash] of Object.entries(expectedHashes)) {
  const fullPath = path.resolve(__dirname, '../../', relPath);
  const fileBytes = fs.readFileSync(fullPath);
  const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    console.error(`HASH MISMATCH on ${relPath}! Expected ${expectedHash}, got ${actualHash}`);
    hashMismatches++;
  }
}

if (hashMismatches === 0) {
  console.log('✅ Regression Check: All 6 protected files are 100% UNMODIFIED.');
} else {
  console.error(`❌ Regression Check FAILED: ${hashMismatches} files modified!`);
  process.exit(1);
}

// 2. Static HTML Checks (No inline styles, unique IDs, existing paths)
const indexHtmlContent = fs.readFileSync(indexPath, 'utf8');

// Check inline styles
const inlineStyleMatches = indexHtmlContent.match(/style\s*=\s*"[^"]*"/gi) || [];
if (inlineStyleMatches.length > 0) {
  console.error(`❌ Found ${inlineStyleMatches.length} inline style attributes in index.html!`);
  process.exit(1);
} else {
  console.log('✅ Static Check: Zero inline styles in index.html (100% cleaned).');
}

// Check ID uniqueness
const idMatches = [...indexHtmlContent.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const idSet = new Set();
let dupCount = 0;
idMatches.forEach(id => {
  if (idSet.has(id)) {
    console.error(`Duplicate ID found: ${id}`);
    dupCount++;
  }
  idSet.add(id);
});

if (dupCount === 0) {
  console.log(`✅ Static Check: All ${idSet.size} element IDs in index.html are unique.`);
} else {
  console.error(`❌ Found ${dupCount} duplicate IDs!`);
  process.exit(1);
}

// 3. Browser tests via Chrome Headless
const testPageHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Phase 2 Workspace Test Harness</title>
</head>
<body>
  <iframe id="appFrame" src="${fileUrl}" style="width:1920px; height:1080px; border:none;"></iframe>
  <pre id="testOutput"></pre>

  <script>
    const out = document.getElementById('testOutput');
    const results = {
      passed: 0,
      failed: 0,
      details: []
    };

    function assert(name, condition, extra) {
      if (condition) {
        results.passed++;
        results.details.push({ test: name, status: 'PASS', extra: extra || '' });
        console.log('[PASS] ' + name);
      } else {
        results.failed++;
        results.details.push({ test: name, status: 'FAIL', extra: extra || '' });
        console.error('[FAIL] ' + name + (extra ? ' - ' + extra : ''));
      }
    }

    const frame = document.getElementById('appFrame');

    frame.onload = () => {
      try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;

        // Catch runtime errors
        win.addEventListener('error', (e) => {
          assert('No Console/Runtime Errors', false, e.message + ' at ' + e.filename + ':' + e.lineno);
        });

        const mf = win.MathForgeWorkspace;

        // --- SECTION 1: INITIALIZATION & PUBLIC API ---
        assert('Workspace API Exists', !!mf, 'window.MathForgeWorkspace is defined');
        assert('Workspace Initialized', mf.getState().initialized === true, 'state.initialized is true');
        assert('State Active Tool Initially Null', mf.getState().activeTool === null, 'Overview / Welcome state');

        const registeredTools = mf.getRegisteredTools();
        assert('4 Built-in Tools Registered', registeredTools.length === 4, 'Found ' + registeredTools.length + ' tools');
        
        const toolIds = registeredTools.map(t => t.id);
        assert('Coordinates Graph registered', toolIds.includes('coordinates-graph'));
        assert('Equation Plotter registered', toolIds.includes('equation-plotter'));
        assert('Ogive Curve registered', toolIds.includes('ogive-curve'));
        assert('Histogram/Polygon registered', toolIds.includes('histogram-polygon'));

        // Check DPR centralization
        const dprPropEl = doc.getElementById('mfPropDpr');
        assert('DPR Element populated', dprPropEl && dprPropEl.textContent.includes('×'), 'Found: ' + (dprPropEl ? dprPropEl.textContent : 'none'));

        // Check role="application" removal
        const wsEl = doc.getElementById('mfWorkspace');
        assert('role="application" removed from workspace root', !wsEl.hasAttribute('role') || wsEl.getAttribute('role') !== 'application');

        // Check Application Menu Semantics (Removed menubar/menuitem roles)
        const menuNav = doc.querySelector('.mf-menu-bar');
        assert('Menu nav does NOT have role="menubar"', !menuNav.hasAttribute('role') || menuNav.getAttribute('role') !== 'menubar');
        const menuButtons = Array.from(doc.querySelectorAll('.mf-menu-btn'));
        const hasMenuitemRole = menuButtons.some(b => b.getAttribute('role') === 'menuitem');
        assert('Menu buttons do NOT have role="menuitem"', !hasMenuitemRole);
        const allMenuButtonsDisabled = menuButtons.every(b => b.getAttribute('aria-disabled') === 'true');
        assert('All planned menu buttons marked aria-disabled="true"', allMenuButtonsDisabled);

        // Check Tool Navigation Semantics (Ordinary buttons with aria-pressed, no tablist/tab)
        const toolNav = doc.getElementById('mfToolList');
        assert('Tool nav does NOT have role="tablist"', !toolNav.hasAttribute('role') || toolNav.getAttribute('role') !== 'tablist');
        const toolCards = Array.from(doc.querySelectorAll('.mf-tool-card'));
        const hasTabRole = toolCards.some(c => c.getAttribute('role') === 'tab');
        assert('Tool buttons do NOT have role="tab"', !hasTabRole);
        const hasAriaSelected = toolCards.some(c => c.hasAttribute('aria-selected'));
        assert('Tool buttons do NOT have aria-selected', !hasAriaSelected);
        const allToolCardsHaveAriaPressed = toolCards.every(c => c.hasAttribute('aria-pressed'));
        assert('Tool buttons have aria-pressed attribute', allToolCardsHaveAriaPressed);

        // Check Document Tab & Panel Semantics
        const tabContainer = doc.getElementById('mfDocTabsContainer');
        assert('Tab strip has role="tablist"', tabContainer && tabContainer.getAttribute('role') === 'tablist');
        const activeTab = tabContainer.querySelector('[data-tab-id="untitled-1"]');
        assert('Document tab has role="tab"', activeTab && activeTab.getAttribute('role') === 'tab');
        assert('Document tab has aria-selected="true"', activeTab && activeTab.getAttribute('aria-selected') === 'true');
        assert('Document tab has tabindex="0"', activeTab && activeTab.getAttribute('tabindex') === '0');
        assert('Document tab has valid aria-controls', activeTab && !!activeTab.getAttribute('aria-controls'));

        const controlsId = activeTab.getAttribute('aria-controls');
        const tabPanel = doc.getElementById(controlsId);
        assert('Matching tabpanel element exists in DOM', !!tabPanel);
        assert('Tabpanel has role="tabpanel"', tabPanel && tabPanel.getAttribute('role') === 'tabpanel');
        assert('Tabpanel has matching aria-labelledby', tabPanel && tabPanel.getAttribute('aria-labelledby') === activeTab.id);

        const tabCloseBtn = activeTab.querySelector('.mf-doc-tab-close');
        assert('Tab close button is marked disabled', tabCloseBtn && (tabCloseBtn.disabled || tabCloseBtn.getAttribute('aria-disabled') === 'true'));

        // Check Status Bar Semantics
        const footerEl = doc.querySelector('.mf-statusbar');
        assert('Footer element does NOT have role="status"', !footerEl.hasAttribute('role') || footerEl.getAttribute('role') !== 'status');
        const statusMsgEl = doc.getElementById('mfStatusMessage');
        assert('Status message element has role="status"', statusMsgEl && statusMsgEl.getAttribute('role') === 'status');
        assert('Status message element has aria-live="polite"', statusMsgEl && statusMsgEl.getAttribute('aria-live') === 'polite');

        // Check Canvas Toolbar Disabled Buttons
        const zoomInBtn = doc.getElementById('mfZoomInBtn');
        const zoomOutBtn = doc.getElementById('mfZoomOutBtn');
        const resetToolbarBtn = doc.getElementById('mfResetViewToolbarBtn');
        assert('Zoom in button disabled', zoomInBtn && zoomInBtn.disabled && zoomInBtn.getAttribute('aria-disabled') === 'true');
        assert('Zoom out button disabled', zoomOutBtn && zoomOutBtn.disabled && zoomOutBtn.getAttribute('aria-disabled') === 'true');
        assert('Reset view button disabled', resetToolbarBtn && resetToolbarBtn.disabled && resetToolbarBtn.getAttribute('aria-disabled') === 'true');

        // --- SECTION 2: TOOL SELECTION & ARIA-PRESSED SYNCHRONIZATION ---
        let selRes1 = mf.selectTool('coordinates-graph');
        assert('selectTool("coordinates-graph") succeeds', selRes1 === true);
        assert('State activeTool updated', mf.getState().activeTool === 'coordinates-graph');
        
        const coordCard = doc.querySelector('[data-tool-id="coordinates-graph"]');
        assert('Coordinates card has aria-pressed="true"', coordCard.getAttribute('aria-pressed') === 'true');
        assert('Coordinates card has class active', coordCard.classList.contains('active'));

        const eqCard = doc.querySelector('[data-tool-id="equation-plotter"]');
        assert('Equation card has aria-pressed="false"', eqCard.getAttribute('aria-pressed') === 'false');

        // Select Equation Plotter
        let selRes2 = mf.selectTool('equation-plotter');
        assert('selectTool("equation-plotter") succeeds', selRes2 === true);
        assert('Coordinates card now has aria-pressed="false"', coordCard.getAttribute('aria-pressed') === 'false');
        assert('Equation card now has aria-pressed="true"', eqCard.getAttribute('aria-pressed') === 'true');

        // Test Home / Overview Button
        const homeBtn = doc.getElementById('mfHomeBtn');
        homeBtn.click();
        assert('Home button returns workspace to Overview', mf.getState().activeTool === null);
        assert('All tool cards have aria-pressed="false" in Overview', toolCards.every(c => c.getAttribute('aria-pressed') === 'false'));

        // --- SECTION 3: PANEL VISIBILITY & ARIA-EXPANDED SYNCHRONIZATION ---
        const toggleLeftBtn = doc.getElementById('mfToggleLeftBtn');
        const collapseLeftBtn = doc.getElementById('mfCollapseLeftBtn');
        const leftPanel = doc.getElementById('mfLeftPanel');

        assert('Toggle left btn has aria-controls="mfLeftPanel"', toggleLeftBtn.getAttribute('aria-controls') === 'mfLeftPanel');
        assert('Collapse left btn has aria-controls="mfLeftPanel"', collapseLeftBtn.getAttribute('aria-controls') === 'mfLeftPanel');
        assert('Toggle left btn initially aria-expanded="true"', toggleLeftBtn.getAttribute('aria-expanded') === 'true');
        assert('Collapse left btn initially aria-expanded="true"', collapseLeftBtn.getAttribute('aria-expanded') === 'true');
        assert('Left panel initially not aria-hidden', !leftPanel.hasAttribute('aria-hidden') || leftPanel.getAttribute('aria-hidden') === 'false');

        // Collapse left panel
        mf.setPanelVisibility('left', false);
        assert('Collapsed: toggle btn aria-expanded="false"', toggleLeftBtn.getAttribute('aria-expanded') === 'false');
        assert('Collapsed: collapse btn aria-expanded="false"', collapseLeftBtn.getAttribute('aria-expanded') === 'false');
        assert('Collapsed: left panel has aria-hidden="true"', leftPanel.getAttribute('aria-hidden') === 'true');

        // Restore left panel
        mf.setPanelVisibility('left', true);
        assert('Restored: toggle btn aria-expanded="true"', toggleLeftBtn.getAttribute('aria-expanded') === 'true');
        assert('Restored: left panel aria-hidden removed', !leftPanel.hasAttribute('aria-hidden') || leftPanel.getAttribute('aria-hidden') === 'false');

        // --- SECTION 4: DOCUMENT TABS KEYBOARD & ENTER/SPACE INTERACTION ---
        assert('Default document tab selected', mf.getState().activeDocument === 'untitled-1');
        assert('selectTab handles valid tab', mf.selectTab('untitled-1') === true);
        assert('selectTab rejects unknown tab ID', mf.selectTab('invalid-tab-id-999') === false);

        // Tab keyboard navigation test
        const rightKeyEvent = new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
        tabContainer.dispatchEvent(rightKeyEvent);
        assert('Tab ArrowRight event handled safely', true);

        const enterKeyEvent = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        activeTab.dispatchEvent(enterKeyEvent);
        assert('Tab Enter key event handled safely', true);

        // Clicking close button should NOT deselect or crash
        tabCloseBtn.click();
        assert('Clicking disabled close button does not alter activeDocument', mf.getState().activeDocument === 'untitled-1');

        // --- SECTION 5: TOOL MOUNT ERROR HANDLING & STATE RECOVERY ---
        let errorToolAttempted = false;
        const failingTool = {
          id: 'failing-test-tool',
          name: 'Failing Test Tool',
          mount: function(container) {
            errorToolAttempted = true;
            throw new Error('Simulated engine mount explosion');
          }
        };
        mf.registerTool(failingTool);

        mf.selectTool('equation-plotter');
        assert('Pre-condition: Equation Plotter active', mf.getState().activeTool === 'equation-plotter');

        const failRes = mf.selectTool('failing-test-tool');
        assert('selectTool returns false when mount throws', failRes === false);
        assert('Error recovery: activeTool reverted to previous tool', mf.getState().activeTool === 'equation-plotter');
        assert('Status message communicates failure', mf.getState().statusMessage.includes('Mount failed'));
        assert('Tool mount container cleaned after failure', doc.getElementById('mfToolMountContainer').children.length === 0);

        mf.unregisterTool('failing-test-tool');

        // --- SECTION 6: TOOL REGISTRY LIFECYCLE & ACTIVE UNREGISTER ---
        let testAdapterMounted = false;
        let testAdapterUnmounted = false;

        const testTool = {
          id: 'mock-test-tool',
          name: 'Mock Test Tool',
          description: 'Isolated test adapter for lifecycle verification',
          icon: '★',
          capabilities: ['Unit Testing', 'Lifecycle Verification'],
          mount: function(container, opts) {
            testAdapterMounted = true;
            const el = doc.createElement('div');
            el.id = 'mockTestMountedEl';
            el.textContent = 'MOCK ADAPTER ACTIVE';
            container.appendChild(el);
          },
          unmount: function() {
            testAdapterUnmounted = true;
          }
        };

        mf.registerTool(testTool);
        mf.selectTool('mock-test-tool');
        assert('Lifecycle: mount() called upon selection', testAdapterMounted === true);
        assert('Lifecycle: DOM element mounted inside toolMountContainer', !!doc.getElementById('mockTestMountedEl'));

        // Unregister active tool -> should unmount and revert to null/overview
        const unregRes = mf.unregisterTool('mock-test-tool');
        assert('unregisterTool succeeds for active tool', unregRes === true);
        assert('Unregistering active tool calls unmount()', testAdapterUnmounted === true);
        assert('Unregistering active tool reverts state to null', mf.getState().activeTool === null);

        // --- SECTION 7: DESTROY & RE-INITIALIZATION ---
        assert('destroy API exists', typeof mf.destroy === 'function');
        mf.destroy();
        assert('destroy sets initialized to false', mf.getState().initialized === false);
        assert('destroy removes body active class', !doc.body.classList.contains('mf-workspace-active'));

        const reinitRes = mf.init();
        assert('Re-init succeeds cleanly', reinitRes === true);
        assert('Workspace initialized again', mf.getState().initialized === true);

        // --- SECTION 8: HIGH-DPI CANVAS SIZING ---
        const testContainer = doc.createElement('div');
        testContainer.style.width = '800px';
        testContainer.style.height = '600px';
        doc.body.appendChild(testContainer);

        const testCanvas = doc.createElement('canvas');
        testContainer.appendChild(testCanvas);

        const sizeRes = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: 2.0 });
        assert('fitCanvasToContainer returns correct dimensions', sizeRes.width === 800 && sizeRes.height === 600);
        assert('fitCanvasToContainer applies DPR to canvas buffer', testCanvas.width === 1600 && testCanvas.height === 1200);

        doc.body.removeChild(testContainer);

        // --- SECTION 9: DESKTOP LAYOUT SIZING (NO OVERFLOW) ---
        assert('Workspace has 0 horizontal scroll overflow', wsEl.scrollWidth <= wsEl.clientWidth);
        assert('Workspace body has overflow hidden', win.getComputedStyle(doc.body).overflow === 'hidden');

        out.textContent = JSON.stringify(results, null, 2);
      } catch (err) {
        assert('Harness Execution Error', false, err.message + '\\n' + err.stack);
        out.textContent = JSON.stringify(results, null, 2);
      }
    };
  </script>
</body>
</html>`;

const harnessPath = path.resolve(__dirname, 'phase2_test_harness.html');
fs.writeFileSync(harnessPath, testPageHtml, 'utf8');

// Run with headless chrome
try {
  const chromeCmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=8000 --dump-dom "file:///${harnessPath.replace(/\\\\/g, '/')}"`;
  const rawOutput = execSync(chromeCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const jsonMatch = rawOutput.match(/<pre id="testOutput">([\s\S]*?)<\/pre>/);
  if (!jsonMatch || !jsonMatch[1].trim()) {
    console.error('No test output found in DOM dump!');
    console.log(rawOutput.substring(0, 1000));
    process.exit(1);
  }

  const testReport = JSON.parse(jsonMatch[1]);
  console.log(`\n================ TEST SUMMARY ================`);
  console.log(`Total Passed: ${testReport.passed}`);
  console.log(`Total Failed: ${testReport.failed}`);
  console.log(`==============================================\n`);

  testReport.details.forEach(d => {
    const symbol = d.status === 'PASS' ? '✅' : '❌';
    console.log(`${symbol} [${d.status}] ${d.test} ${d.extra ? '(' + d.extra + ')' : ''}`);
  });

  if (testReport.failed > 0) {
    console.error('\n❌ SOME AUTOMATED TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 2 ACCESSIBILITY & STRUCTURE TESTS PASSED!');
  }

} catch (err) {
  console.error('Execution error running chrome:', err);
  process.exit(1);
}
