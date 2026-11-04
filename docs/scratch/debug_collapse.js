const fs = require("fs");
const { execSync } = require("child_process");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const testHtml = `<!DOCTYPE html><html><body><iframe id="f" src="file:///D:/MathForge/index.html" style="width:1920px;height:1080px;"></iframe>
<pre id="out"></pre>
<script>
const f = document.getElementById("f");
f.onload = () => {
  const mf = f.contentWindow.MathForgeWorkspace;
  const doc = f.contentDocument;
  const left = doc.getElementById("mfLeftPanel");
  const right = doc.getElementById("mfRightPanel");
  const canvas = doc.getElementById("mfCanvasArea");
  const initialCanvasWidth = canvas.getBoundingClientRect().width;

  mf.setPanelVisibility("left", false);
  const leftWidth = left.getBoundingClientRect().width;
  const leftDisplay = f.contentWindow.getComputedStyle(left).display;

  mf.setPanelVisibility("right", false);
  const rightWidth = right.getBoundingClientRect().width;
  const rightDisplay = f.contentWindow.getComputedStyle(right).display;

  const bothCanvasWidth = canvas.getBoundingClientRect().width;

  document.getElementById("out").textContent = JSON.stringify({
    initialCanvasWidth,
    leftWidth,
    leftDisplay,
    rightWidth,
    rightDisplay,
    bothCanvasWidth
  }, null, 2);
};
</script></body></html>`;
fs.writeFileSync("docs/scratch/temp_debug.html", testHtml);
const cmd = `"${chromePath}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --virtual-time-budget=3000 --dump-dom "file:///D:/MathForge/docs/scratch/temp_debug.html"`;
const dom = execSync(cmd, { encoding: "utf8" });
console.log(dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1]);
