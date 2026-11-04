const { execSync } = require('child_process');
const fs = require('fs');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="400" height="300" style="width:400px; height:300px; border:1px solid black;"></canvas>
<pre id="out"></pre>
<script>
const c = document.getElementById('c');
const out = document.getElementById('out');
function log(msg) { out.textContent += msg + '\\n'; console.log(msg); }

let moves = 0;
c.addEventListener('mousedown', (e) => {
  log('mousedown on canvas');
});
c.addEventListener('mousemove', (e) => {
  moves++;
  log('mousemove: ' + moves);
});
c.addEventListener('dragstart', (e) => {
  log('DRAGSTART FIRED!');
});
</script>
</body>
</html>`;

fs.writeFileSync('docs/scratch/test_drag_native.html', html, 'utf8');

const runner = `
const puppeteer = require('puppeteer-core');
// or let's test via Chrome CDP
`;
