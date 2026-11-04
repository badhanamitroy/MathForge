const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const html = `<!DOCTYPE html>
<html>
<body>
<iframe id="app" src="../../index.html" style="width:1920px; height:1080px;"></iframe>
<pre id="consoleLog"></pre>
<script>
const out = document.getElementById('consoleLog');
function p(msg) { out.textContent += msg + '\\n'; }

const app = document.getElementById('app');
app.onload = () => {
  const win = app.contentWindow;
  const doc = app.contentDocument;
  let errors = 0;

  win.addEventListener('error', (e) => {
    errors++;
    p('CONSOLE ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
  });

  p('Page loaded. Checking direct interactive elements...');
  
  // 1. Tool buttons test with click
  const toolButtons = doc.querySelectorAll('.mf-tool-card');
  p('Found tool buttons: ' + toolButtons.length);
  toolButtons.forEach(btn => {
    btn.click();
    p('Clicked ' + btn.getAttribute('data-tool-id') + ' -> active=' + btn.classList.contains('active') + ' | aria-pressed=' + btn.getAttribute('aria-pressed'));
  });

  // 2. Overview / Home button test
  const homeBtn = doc.getElementById('mfHomeBtn');
  homeBtn.click();
  p('Clicked Home button -> activeTool=' + win.MathForgeWorkspace.getState().activeTool);

  // 3. Panel toggles test
  const toggleLeftBtn = doc.getElementById('mfToggleLeftBtn');
  toggleLeftBtn.click();
  p('Toggled left panel -> isVisible=' + win.MathForgeWorkspace.isPanelVisible('left') + ' | aria-expanded=' + toggleLeftBtn.getAttribute('aria-expanded'));
  toggleLeftBtn.click();
  p('Restored left panel -> isVisible=' + win.MathForgeWorkspace.isPanelVisible('left') + ' | aria-expanded=' + toggleLeftBtn.getAttribute('aria-expanded'));

  // 4. Document tabs test
  const activeTab = doc.querySelector('.mf-doc-tab');
  p('Active tab ID: ' + activeTab.getAttribute('data-tab-id') + ' | aria-selected=' + activeTab.getAttribute('aria-selected') + ' | aria-controls=' + activeTab.getAttribute('aria-controls'));
  const panel = doc.getElementById(activeTab.getAttribute('aria-controls'));
  p('Tabpanel found: ' + (panel ? 'YES' : 'NO') + ' | role=' + (panel ? panel.getAttribute('role') : ''));

  // 5. Status message test
  const statusEl = doc.getElementById('mfStatusMessage');
  p('Status element text: ' + statusEl.textContent + ' | role=' + statusEl.getAttribute('role') + ' | aria-live=' + statusEl.getAttribute('aria-live'));

  p('Total runtime console errors: ' + errors);
};
</script>
</body>
</html>`;

fs.writeFileSync(path.resolve(__dirname, 'check_index_console.html'), html, 'utf8');

try {
  const filePath = path.resolve(__dirname, 'check_index_console.html').replace(/\\/g, '/');
  const res = execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=5000 --dump-dom "file:///${filePath}"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  console.log(res.split('<pre id="consoleLog">')[1].split('</pre>')[0]);
} catch (e) {
  console.error(e);
}
