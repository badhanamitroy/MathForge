const { execSync } = require('child_process');
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const testHtml = `<!DOCTYPE html>
<html>
<body>
<iframe id="f" src="../../Coordinates_graph.html" style="width:1200px; height:800px;"></iframe>
<pre id="log"></pre>
<script>
const logEl = document.getElementById('log');
function log(msg) { logEl.textContent += msg + '\\n'; console.log(msg); }

const f = document.getElementById('f');
f.onload = () => {
  const win = f.contentWindow;
  const doc = f.contentDocument;

  win.onerror = (msg, url, line, col, err) => {
    log('WINDOW ERROR: ' + msg + ' at ' + line + ':' + col);
  };

  const canvas = doc.getElementById('canvas');
  const resetViewBtn = doc.getElementById('resetViewBtn');
  const viewZoomEl = doc.getElementById('viewZoom');
  const viewZoomValEl = doc.getElementById('viewZoomVal');

  log('resetViewBtn exists: ' + !!resetViewBtn);
  log('viewZoomEl exists: ' + !!viewZoomEl);
  log('Initial viewZoom: ' + viewZoomEl.value);

  // Zoom in
  viewZoomEl.value = '2.0';
  viewZoomEl.dispatchEvent(new win.Event('input', { bubbles: true }));
  log('Zoomed to: ' + viewZoomEl.value + ' | valText: ' + viewZoomValEl.textContent);

  // Try clicking resetViewBtn
  try {
    resetViewBtn.click();
    log('Clicked resetViewBtn');
    log('After resetViewBtn -> Zoom: ' + viewZoomEl.value + ' | valText: ' + viewZoomValEl.textContent);
  } catch (e) {
    log('Error clicking resetViewBtn: ' + e.message);
  }

  // Now test mouse drag for pan
  log('\\n--- TESTING MOUSE PAN ---');
  const rect = canvas.getBoundingClientRect();
  log('Canvas rect: ' + rect.left + ',' + rect.top + ' ' + rect.width + 'x' + rect.height);

  // Listen to drag events
  canvas.addEventListener('dragstart', (e) => {
    log('DRAGSTART fired on canvas!');
  });

  // Dispatch mousedown
  const downEv = new win.MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + 100,
    clientY: rect.top + 100,
    button: 0
  });
  const downDefault = canvas.dispatchEvent(downEv);
  log('mousedown dispatched, defaultPrevented: ' + !downDefault);

  // Dispatch mousemove
  const moveEv = new win.MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + 200,
    clientY: rect.top + 200,
    button: 0
  });
  canvas.dispatchEvent(moveEv);
  log('mousemove dispatched to (200, 200)');

  // Dispatch mouseup
  const upEv = new win.MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + 200,
    clientY: rect.top + 200,
    button: 0
  });
  win.dispatchEvent(upEv);
  log('mouseup dispatched');
};
</script>
</body>
</html>`;

fs.writeFileSync('docs/scratch/investigate_pan_reset.html', testHtml, 'utf8');

try {
  const out = execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=5000 --dump-dom "file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/docs/scratch/investigate_pan_reset.html"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  console.log(out.split('<pre id="log">')[1].split('</pre>')[0]);
} catch (e) {
  console.error(e);
}
