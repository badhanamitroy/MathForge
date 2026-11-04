const { execSync } = require('child_process');
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const html = `<!DOCTYPE html>
<html>
<body>
<iframe id="app" src="../../Coordinates_graph.html" style="width:1200px; height:800px;"></iframe>
<pre id="consoleLog"></pre>
<script>
const out = document.getElementById('consoleLog');
function p(msg) { out.textContent += msg + '\\n'; }

const app = document.getElementById('app');
app.onload = () => {
  const win = app.contentWindow;
  const doc = app.contentDocument;

  win.addEventListener('error', (e) => {
    p('CONSOLE ERROR: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
  });

  p('Page loaded. Checking elements...');
  const resetViewBtn = doc.getElementById('resetViewBtn');
  const viewZoom = doc.getElementById('viewZoom');
  const viewZoomVal = doc.getElementById('viewZoomVal');
  const canvas = doc.getElementById('canvas');

  p('resetViewBtn: ' + (resetViewBtn ? 'FOUND' : 'MISSING'));
  p('viewZoom: ' + (viewZoom ? 'FOUND' : 'MISSING'));
  p('canvas: ' + (canvas ? 'FOUND' : 'MISSING'));

  // Let's test clicking resetViewBtn directly
  p('Clicking resetViewBtn...');
  try {
    resetViewBtn.click();
    p('resetViewBtn clicked successfully with 0 exceptions!');
  } catch(err) {
    p('ERROR on click: ' + err.message);
  }

  // Let's test wheel zoom
  p('Testing wheel zoom...');
  try {
    canvas.dispatchEvent(new win.WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    p('Wheel zoom dispatched. viewZoom=' + viewZoom.value);
  } catch(err) {
    p('ERROR on wheel: ' + err.message);
  }

  // Now test resetViewBtn again after zoom
  p('Clicking resetViewBtn after zoom...');
  try {
    resetViewBtn.click();
    p('After resetViewBtn: viewZoom=' + viewZoom.value + ' | valText=' + viewZoomVal.textContent);
  } catch(err) {
    p('ERROR on resetViewBtn: ' + err.message);
  }
};
</script>
</body>
</html>`;

fs.writeFileSync('docs/scratch/check_console_errors.html', html, 'utf8');

try {
  const res = execSync(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=5000 --dump-dom "file:///C:/Users/Dell/Downloads/Textbook-Graph-Suite-main/Textbook-Graph-Suite-main/docs/scratch/check_console_errors.html"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  console.log(res.split('<pre id="consoleLog">')[1].split('</pre>')[0]);
} catch (e) {
  console.error(e);
}
