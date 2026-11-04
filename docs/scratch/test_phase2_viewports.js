const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const indexPath = path.resolve(__dirname, '../../index.html');
const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');

const viewports = [
  { name: 'Full HD Desktop', width: 1920, height: 1080, type: 'desktop' },
  { name: 'Standard Laptop', width: 1366, height: 768, type: 'desktop' },
  { name: 'HD Desktop', width: 1280, height: 720, type: 'desktop' },
  { name: 'Compact Desktop', width: 1024, height: 768, type: 'desktop' },
  { name: 'iPad Air / Tablet', width: 820, height: 1180, type: 'tablet' },
  { name: 'Tablet Portrait', width: 768, height: 1024, type: 'tablet' },
  { name: 'Mobile Portrait', width: 390, height: 844, type: 'mobile' }
];

console.log('Testing MathForge Phase 2 Viewports Across 7 Target Breakpoints & Collapse Combinations...\n');

let allPassed = true;
const summary = [];

viewports.forEach(vp => {
  const runnerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;">
  <iframe id="f" src="${fileUrl}" style="width:${vp.width}px; height:${vp.height}px; border:none;"></iframe>
  <pre id="res"></pre>
  <script>
    const f = document.getElementById('f');
    f.onload = () => {
      const win = f.contentWindow;
      const doc = f.contentDocument;
      const mf = win.MathForgeWorkspace;

      const ws = doc.getElementById('mfWorkspace');
      const header = doc.querySelector('.mf-header');
      const leftPanel = doc.getElementById('mfLeftPanel');
      const rightPanel = doc.getElementById('mfRightPanel');
      const canvasArea = doc.getElementById('mfCanvasArea');
      const bottomPanel = doc.getElementById('mfBottomPanel');
      const statusbar = doc.querySelector('.mf-statusbar');

      const hRect = header ? header.getBoundingClientRect() : null;
      const leftRect = leftPanel ? leftPanel.getBoundingClientRect() : null;
      const rightRect = rightPanel ? rightPanel.getBoundingClientRect() : null;
      const cRect = canvasArea ? canvasArea.getBoundingClientRect() : null;
      const bRect = bottomPanel ? bottomPanel.getBoundingClientRect() : null;
      const sRect = statusbar ? statusbar.getBoundingClientRect() : null;

      const bodyScrollWidth = doc.body.scrollWidth;
      const bodyClientWidth = doc.body.clientWidth;
      const wsScrollWidth = ws.scrollWidth;
      const wsClientWidth = ws.clientWidth;

      const hasHorizontalOverflow = bodyScrollWidth > bodyClientWidth + 1 || wsScrollWidth > wsClientWidth + 1;

      // Test collapse states
      // 1. Collapse left
      mf.setPanelVisibility('left', false);
      const leftCollapsedWidth = leftPanel.getBoundingClientRect().width;
      const leftHidden = (leftCollapsedWidth === 0 || win.getComputedStyle(leftPanel).display === 'none');

      // 2. Collapse right
      mf.setPanelVisibility('right', false);
      const rightCollapsedWidth = rightPanel.getBoundingClientRect().width;
      const rightHidden = (rightCollapsedWidth === 0 || win.getComputedStyle(rightPanel).display === 'none');

      // Both collapsed canvas area check
      const bothCollapsedCanvasWidth = canvasArea.getBoundingClientRect().width;
      const bothCollapsedOk = (bothCollapsedCanvasWidth >= (cRect ? cRect.width : 0));

      // Restore
      mf.setPanelVisibility('left', true);
      mf.setPanelVisibility('right', true);

      const out = {
        name: "${vp.name}",
        width: ${vp.width},
        height: ${vp.height},
        type: "${vp.type}",
        headerVisible: !!hRect && hRect.height > 30,
        leftVisible: !!leftRect && leftRect.width > 0,
        rightVisible: !!rightRect && rightRect.width > 0,
        canvasVisible: !!cRect && cRect.width > 200 && cRect.height > 150,
        canvasWidth: cRect ? Math.round(cRect.width) : 0,
        canvasHeight: cRect ? Math.round(cRect.height) : 0,
        bottomVisible: !!bRect && bRect.height > 20,
        statusVisible: !!sRect && sRect.height > 15,
        hasHorizontalOverflow: hasHorizontalOverflow,
        leftCollapsePass: leftHidden,
        rightCollapsePass: rightHidden,
        bothCollapsePass: bothCollapsedOk,
        bodyOverflowSetting: win.getComputedStyle(doc.body).overflow
      };

      document.getElementById('res').textContent = JSON.stringify(out);
    };
  </script>
</body>
</html>`;

  const tmpHtml = path.resolve(__dirname, `vp_${vp.width}x${vp.height}.html`);
  fs.writeFileSync(tmpHtml, runnerHtml, 'utf8');

  try {
    const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --window-size=${vp.width + 50},${vp.height + 100} --virtual-time-budget=5000 --dump-dom "file:///${tmpHtml.replace(/\\\\/g, '/')}"`;
    const dom = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

    const match = dom.match(/<pre id="res">([\s\S]*?)<\/pre>/);
    if (!match || !match[1]) {
      throw new Error('No JSON output from Chrome');
    }

    const data = JSON.parse(match[1]);
    const pass = !data.hasHorizontalOverflow && 
                 data.headerVisible && 
                 data.canvasVisible && 
                 data.statusVisible &&
                 data.leftCollapsePass &&
                 data.rightCollapsePass &&
                 data.bothCollapsePass;
    if (!pass) allPassed = false;

    summary.push({ ...data, pass });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${data.name} (${data.width}x${data.height}): Canvas: ${data.canvasWidth}x${data.canvasHeight}px | Overflow: ${data.hasHorizontalOverflow ? 'YES (BAD)' : 'NONE (0px)'} | Collapse L/R/Both: ${data.leftCollapsePass && data.rightCollapsePass && data.bothCollapsePass ? 'OK' : 'FAIL'}`);
  } catch (err) {
    console.error(`Error testing ${vp.name}:`, err.message);
    allPassed = false;
  } finally {
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml);
  }
});

console.log('\n================ VIEWPORT & RESPONSIVE SUMMARY ================');
console.table(summary.map(s => ({
  Viewport: s.name,
  Resolution: `${s.width}x${s.height}`,
  Type: s.type,
  Header: s.headerVisible ? '✓' : '✗',
  LeftPanel: s.leftVisible ? '✓' : '✗',
  CanvasArea: `${s.canvasWidth}x${s.canvasHeight}`,
  RightPanel: s.rightVisible ? '✓' : '✗',
  BottomPanel: s.bottomVisible ? '✓' : '✗',
  Statusbar: s.statusVisible ? '✓' : '✗',
  NoOverflow: !s.hasHorizontalOverflow ? '✓' : '✗',
  CollapseTests: (s.leftCollapsePass && s.rightCollapsePass && s.bothCollapsePass) ? '✓' : '✗',
  Result: s.pass ? 'PASS' : 'FAIL'
})));

if (!allPassed) {
  console.error('\n❌ SOME VIEWPORT TESTS FAILED!');
  process.exit(1);
} else {
  console.log('🎉 ALL 7 VIEWPORTS PASSED WITH ZERO OVERFLOW AND PERFECT COLLAPSE BEHAVIOR!');
}
