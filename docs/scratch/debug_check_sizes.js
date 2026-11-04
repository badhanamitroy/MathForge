const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const html = `<!DOCTYPE html>
<html>
<body>
<iframe id="f" src="../../index.html" style="width:1400px; height:900px;"></iframe>
<pre id="res"></pre>
<script>
window.onload = () => {
  setTimeout(() => {
    const f = document.getElementById('f');
    const win = f.contentWindow;
    const doc = f.contentDocument;

    win.MathForgeWorkspace.selectTool('coordinates-graph');

    const canvas = doc.querySelector('.mf-coord-canvas');
    const container = doc.getElementById('mfToolMountContainer');
    const sheet = doc.getElementById('mfCanvasSheet');
    const stage = doc.getElementById('mfCanvasStage');

    const data = {
      canvas_width: canvas ? canvas.width : null,
      canvas_height: canvas ? canvas.height : null,
      canvas_style_w: canvas ? canvas.style.width : null,
      canvas_style_h: canvas ? canvas.style.height : null,
      canvas_rect: canvas ? canvas.getBoundingClientRect() : null,
      container_rect: container ? container.getBoundingClientRect() : null,
      sheet_rect: sheet ? sheet.getBoundingClientRect() : null,
      stage_rect: stage ? stage.getBoundingClientRect() : null,
      dpr: win.devicePixelRatio,
      labelBoxes: win.MathForgeCoordinates.adapter.getState ? win.MathForgeCoordinates.createEngine : null
    };

    document.getElementById('res').textContent = JSON.stringify(data, null, 2);
  }, 300);
};
</script>
</body>
</html>`;

const harnessPath = path.resolve(__dirname, 'debug_harness.html');
fs.writeFileSync(harnessPath, html, 'utf8');

const cmd = '"' + chromePath + '" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --disable-web-security --virtual-time-budget=4000 --dump-dom "file:///' + harnessPath.replace(/\\/g, '/') + '"';
const out = execSync(cmd, { encoding: 'utf8' });
const match = out.match(/<pre id="res">([\s\S]*?)<\/pre>/);
if (match) console.log(match[1]);
else console.log('No match', out.substring(0, 500));
