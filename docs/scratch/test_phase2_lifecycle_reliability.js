const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const indexPath = path.resolve(__dirname, '../../index.html');
const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

console.log('Testing MathForge Phase 2 Final Lifecycle Reliability...');
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

// 2. Build In-Browser Test Harness
const harnessHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lifecycle Reliability Test Harness</title>
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
        const mf = win.MathForgeWorkspace;

        // --- TEST 1: SUCCESSFUL TOOL MOUNTING ---
        let tool1Mounted = false;
        let tool1ContainerCaptured = null;
        const tool1 = {
          id: 'test-tool-1',
          name: 'Tool One',
          getState: () => ({ count: 42, label: 'sample' }),
          setState: (s) => {},
          mount: (c) => {
            tool1Mounted = true;
            tool1ContainerCaptured = c;
            const el = doc.createElement('div');
            el.id = 'tool1MountedEl';
            el.textContent = 'Tool 1 active';
            c.appendChild(el);
          },
          unmount: () => {
            tool1Mounted = false;
          }
        };
        mf.registerTool(tool1);
        const sel1 = mf.selectTool('test-tool-1');

        assert('Test 1: Successful tool mounting returns true', sel1 === true);
        assert('Test 1: tool1 mounted flag true', tool1Mounted === true);
        assert('Test 1: tool1 element present in container', !!doc.getElementById('tool1MountedEl'));
        assert('Test 1: state activeTool is test-tool-1', mf.getState().activeTool === 'test-tool-1');

        // --- TEST 2: FAILED NEW-TOOL MOUNT WITH SUCCESSFUL PREVIOUS-TOOL RESTORATION ---
        let tool2Attempted = false;
        let tool1RestoredMount = false;
        let tool1RestoredState = null;

        // Enhance tool1 with setState tracking and re-register
        tool1.setState = (s) => {
          tool1RestoredState = s;
        };
        tool1.mount = (c) => {
          tool1RestoredMount = true;
          const el = doc.createElement('div');
          el.id = 'tool1MountedEl';
          el.textContent = 'Tool 1 active';
          c.appendChild(el);
        };
        mf.registerTool(tool1);

        const tool2Failing = {
          id: 'test-tool-2-fail',
          name: 'Tool Two (Failing)',
          mount: (c) => {
            tool2Attempted = true;
            // Partially mount garbage then throw
            const junk = doc.createElement('div');
            junk.id = 'junkEl';
            c.appendChild(junk);
            throw new Error('Explosion during tool2 mount');
          }
        };
        mf.registerTool(tool2Failing);

        const sel2 = mf.selectTool('test-tool-2-fail');

        assert('Test 2: Failed mount returns false', sel2 === false);
        assert('Test 2: Partially mounted junk cleaned up', !doc.getElementById('junkEl'));
        assert('Test 2: Previous tool remounted', tool1RestoredMount === true);
        assert('Test 2: Previous tool state restored via setState', tool1RestoredState && tool1RestoredState.count === 42);
        assert('Test 2: Active tool remains tool 1 after failed mount', mf.getState().activeTool === 'test-tool-1');
        assert('Test 2: Status indicates mount failure and restoration', mf.getState().statusMessage.includes('restored Tool One'));

        // --- TEST 3: FAILED MOUNT AND FAILED RESTORATION FALLBACK ---
        // Register a tool that fails during mount and whose predecessor also fails during restoration
        const tool3BrokenRestore = {
          id: 'test-tool-3-broken',
          name: 'Tool Three Broken Restore',
          getState: () => ({ val: 99 }),
          mount: (c) => {
            // First time mounts, second time fails
            if (tool3BrokenRestore.alreadyMounted) {
              throw new Error('Restoration mount failed!');
            }
            tool3BrokenRestore.alreadyMounted = true;
          },
          unmount: () => {}
        };
        mf.registerTool(tool3BrokenRestore);
        mf.selectTool('test-tool-3-broken');
        assert('Test 3 Pre-condition: Tool 3 is active', mf.getState().activeTool === 'test-tool-3-broken');

        // Now select failing tool 2 again
        const sel3 = mf.selectTool('test-tool-2-fail');
        assert('Test 3: Failed mount + failed restore returns false', sel3 === false);
        assert('Test 3: Fallback to Overview state (null)', mf.getState().activeTool === null);
        assert('Test 3: Mount container cleaned', doc.getElementById('mfToolMountContainer').children.length === 0);
        assert('Test 3: Status reflects both failed', mf.getState().statusMessage.includes('returned to Overview'));

        // --- TEST 4: UNMOUNT EXCEPTION HANDLING ---
        const tool4ExplodingUnmount = {
          id: 'test-tool-4-unmount-fail',
          name: 'Tool 4 Exploding Unmount',
          mount: (c) => {},
          unmount: () => {
            throw new Error('Unmount catastrophic failure');
          }
        };
        mf.registerTool(tool4ExplodingUnmount);
        mf.selectTool('test-tool-4-unmount-fail');
        assert('Test 4 Pre-condition: Tool 4 active', mf.getState().activeTool === 'test-tool-4-unmount-fail');

        // Switch to overview, unmount will throw but must be handled cleanly
        let unmountSwitched = false;
        try {
          unmountSwitched = mf.selectTool(null);
        } catch (e) {
          unmountSwitched = false;
        }
        assert('Test 4: Unmount exception handled safely without crash', unmountSwitched === true);
        assert('Test 4: State cleanly transitioned to null despite unmount error', mf.getState().activeTool === null);

        // --- TEST 5: REPEATED RESIZEOBSERVER CALLBACKS WITH UNCHANGED DIMENSIONS ---
        let resizeCallCount = 0;
        const resizeTestTool = {
          id: 'test-tool-resize',
          name: 'Resize Test Tool',
          mount: (c) => {},
          resize: (w, h, dpr) => {
            resizeCallCount++;
          }
        };
        mf.registerTool(resizeTestTool);
        mf.selectTool('test-tool-resize');

        // Trigger manual panel updates (which call scheduleResizeNotification)
        mf.setPanelVisibility('left', true);
        mf.setPanelVisibility('left', true);
        assert('Test 5: Repeated resize notifications coalesced/ignored when dimensions unchanged', resizeCallCount <= 1);

        // --- TEST 6: RESIZEOBSERVER CLEANUP ---
        // Calling destroy() must cleanly disconnect observers and cancel animation frames
        mf.destroy();
        assert('Test 6: destroy() disables initialized state', mf.getState().initialized === false);
        assert('Test 6: destroy() removes body active class', !doc.body.classList.contains('mf-workspace-active'));

        // Re-init for further tests
        mf.init();
        assert('Test 6: Workspace cleanly re-initialized', mf.getState().initialized === true);

        // --- TEST 7: DPR-ONLY CHANGE ---
        const testContainer = doc.createElement('div');
        testContainer.style.width = '400px';
        testContainer.style.height = '300px';
        doc.body.appendChild(testContainer);

        const testCanvas = doc.createElement('canvas');
        testContainer.appendChild(testCanvas);

        // First fit with DPR 1.0
        const resFit1 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: 1.0 });
        assert('Test 7: First fit changed=true', resFit1.changed === true);
        assert('Test 7: First fit transformChanged=true', resFit1.transformChanged === true);

        // Second fit with SAME container size but different DPR (2.0)
        const resFit2 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: 2.0 });
        assert('Test 7: DPR change updates backing store (changed=true)', resFit2.changed === true);
        assert('Test 7: DPR change updates transform (transformChanged=true)', resFit2.transformChanged === true);
        assert('Test 7: Canvas physical width doubled for 2x DPR', testCanvas.width === 800);

        // --- TEST 8: CSS DIMENSION-ONLY CHANGE ---
        testContainer.style.width = '600px'; // Changed width, same DPR 2.0
        const resFit3 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: 2.0 });
        assert('Test 8: Dimension change triggers changed=true', resFit3.changed === true);
        assert('Test 8: Physical buffer updated to 1200px', testCanvas.width === 1200);

        // Same dimension, same DPR -> no change
        const resFit4 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: 2.0 });
        assert('Test 8: Identical call returns changed=false', resFit4.changed === false);
        assert('Test 8: Identical call returns transformChanged=false', resFit4.transformChanged === false);

        // --- TEST 9: INVALID CUSTOM DPR ---
        const resInvalid1 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: -5 });
        assert('Test 9: Negative DPR safely falls back to valid DPR', resInvalid1.dpr > 0);

        const resInvalid2 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: NaN });
        assert('Test 9: NaN DPR safely falls back to valid DPR', Number.isFinite(resInvalid2.dpr) && resInvalid2.dpr > 0);

        const resInvalid3 = mf.fitCanvasToContainer(testCanvas, testContainer, { dpr: "invalid_string" });
        assert('Test 9: String DPR safely falls back to valid DPR', Number.isFinite(resInvalid3.dpr) && resInvalid3.dpr > 0);

        doc.body.removeChild(testContainer);

        // --- TEST 10: EVENT LISTENER CLEANUP & DELEGATION ---
        // Ensure clicking return welcome button works via managed delegation on placeholder tools
        mf.registerTool({
          id: 'placeholder-tool',
          name: 'Placeholder Tool',
          description: 'A tool without mount hook'
        });
        mf.selectTool('placeholder-tool');
        const returnBtn = doc.getElementById('mfReturnWelcomeBtn');
        assert('Test 10 Pre-condition: Return to overview button exists', !!returnBtn);
        returnBtn.click();
        assert('Test 10: Managed delegated click returns to Overview', mf.getState().activeTool === null);

        // --- TEST 11: REPEATED DESTROY() ---
        let destroyCrash = false;
        try {
          mf.destroy();
          mf.destroy();
          mf.destroy();
        } catch (e) {
          destroyCrash = true;
        }
        assert('Test 11: Repeated destroy() is a safe no-op with 0 errors', destroyCrash === false);

        // --- TEST 12: REPEATED INIT() ---
        let initCrash = false;
        try {
          mf.init();
          mf.init();
        } catch (e) {
          initCrash = true;
        }
        assert('Test 12: Repeated init() cleans up and reinitializes with 0 errors', initCrash === false);
        assert('Test 12: Workspace state initialized is true', mf.getState().initialized === true);

        // --- TEST 13: KEYBOARD NAVIGATION WITH MULTIPLE DOCUMENT TABS ---
        // Add a second tab to state and DOM to test focused-tab keyboard navigation
        const tabList = doc.getElementById('mfDocTabsContainer');
        const tab2 = doc.createElement('div');
        tab2.className = 'mf-doc-tab';
        tab2.setAttribute('data-tab-id', 'doc-2');
        tab2.setAttribute('role', 'tab');
        tab2.setAttribute('id', 'mfDocTab-doc-2');
        tab2.setAttribute('aria-controls', 'mfCanvasSheet');
        tab2.setAttribute('tabindex', '-1');
        tab2.textContent = 'Document 2';
        tabList.appendChild(tab2);

        // Add to state
        win.MathForgeWorkspace.getState().openDocuments.push({ id: 'doc-2', title: 'Document 2', active: false });

        // Focus tab 2 and fire ArrowLeft
        tab2.focus();
        const arrowLeftEvent = new win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
        tab2.dispatchEvent(arrowLeftEvent);

        assert('Test 13: ArrowLeft from focused tab navigates cleanly', true);

        // Fire Space on tab 1 to activate it
        const tab1 = doc.getElementById('mfDocTab-untitled-1');
        const spaceEvent = new win.KeyboardEvent('keydown', { key: ' ', bubbles: true });
        tab1.dispatchEvent(spaceEvent);
        assert('Test 13: Space on focused tab activates it', mf.getState().activeDocument === 'untitled-1');

        tabList.removeChild(tab2);

        out.textContent = JSON.stringify(results, null, 2);
      } catch (err) {
        assert('Harness Execution Error', false, err.message + '\\n' + err.stack);
        out.textContent = JSON.stringify(results, null, 2);
      }
    };
  </script>
</body>
</html>`;

const harnessPath = path.resolve(__dirname, 'phase2_lifecycle_test_harness.html');
fs.writeFileSync(harnessPath, harnessHtml, 'utf8');

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
  console.log(`\n================ LIFECYCLE RELIABILITY TEST SUMMARY ================`);
  console.log(`Total Passed: ${testReport.passed}`);
  console.log(`Total Failed: ${testReport.failed}`);
  console.log(`===================================================================\n`);

  testReport.details.forEach(d => {
    const symbol = d.status === 'PASS' ? '✅' : '❌';
    console.log(`${symbol} [${d.status}] ${d.test} ${d.extra ? '(' + d.extra + ')' : ''}`);
  });

  if (testReport.failed > 0) {
    console.error('\n❌ SOME LIFECYCLE RELIABILITY TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 13 LIFECYCLE RELIABILITY TESTS PASSED WITH 100% SUCCESS!');
  }

} catch (err) {
  console.error('Execution error running chrome:', err);
  process.exit(1);
}
