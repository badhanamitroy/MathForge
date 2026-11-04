const fs = require('fs');
const html = fs.readFileSync('Coordinates_graph.html', 'utf8').replace(/\r\n/g, '\n');

const targetControls = '<div class="row">\n          <label><input id="showLabels" type="checkbox" checked /> Show point labels</label>\n        </div>\n\n        <div class="btns">';
console.log('Controls:', html.includes(targetControls));

const targetState = 'const showLabelsEl = document.getElementById("showLabels");';
console.log('State:', html.includes(targetState));

const targetTransform = `  function makeTransform(bounds, padPx) {
    const W = canvas.width, H = canvas.height;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;

    const sx = (W - 2*padPx) / worldW;
    const sy = (H - 2*padPx) / worldH;
    const scale = Math.min(sx, sy);

    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const offsetX = (W - drawW) / 2;
    const offsetY = (H - drawH) / 2;

    const xToPx = (x) => offsetX + (x - bounds.minX) * scale;
    const yToPx = (y) => offsetY + (bounds.maxY - y) * scale;

    return { scale, xToPx, yToPx };
  }`.replace(/\r\n/g, '\n');
console.log('Transform:', html.includes(targetTransform));
if (!html.includes(targetTransform)) {
  const idx = html.indexOf('makeTransform');
  console.log('Actual snippet:', JSON.stringify(html.slice(idx - 10, idx + 200)));
}

const targetDrawSet = `      if (showLabels) {
        const off = set.pointOffsets[p.label] || { dx: 20, dy: -20 };
        const text = \`\${p.label}(\${p.xRaw}, \${p.yRaw})\`;
        const bbox = drawTextBox(ctx, text, px + off.dx, py + off.dy, { fontSize: FONT.point, align: "left" });
        labelBoxes.push({ setId: set.id, label: p.label, x: bbox.bx, y: bbox.by, w: bbox.bw, h: bbox.bh });
      }`.replace(/\r\n/g, '\n');
console.log('DrawSet:', html.includes(targetDrawSet));

const targetDrawGrid = `  function drawGrid(bounds, tf, settings) {
    const { FONT, offsets, minorTick } = settings;
    const { scale, xToPx, yToPx } = tf;`.replace(/\r\n/g, '\n');
console.log('DrawGrid start:', html.includes(targetDrawGrid));
