const fs = require('fs');
const p = 'Coordinates_graph.html';
let content = fs.readFileSync(p, 'utf8');

// Normalize line endings to \n for uniform processing, then we can save back
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. defaultRenderOptions: ensure fillVisible: true
if (!content.includes('fillVisible: true')) {
  content = content.replace(
    'polygon: {\n        visible: true,',
    'polygon: {\n        visible: true,\n        fillVisible: true,'
  );
  console.log('Added fillVisible to defaultRenderOptions');
}

// 2. getSetRenderOptions: ensure next.polygon.fillVisible
if (!content.includes('next.polygon.fillVisible =')) {
  content = content.replace(
    'next.polygon.fillOpacity = Math.max(0, Math.min(1, Number(next.polygon.fillOpacity) || 0));',
    'next.polygon.visible = Boolean(next.polygon.visible);\n    next.polygon.fillVisible = next.polygon.fillVisible !== false;\n    next.polygon.fillOpacity = Math.max(0, Math.min(1, Number(next.polygon.fillOpacity) || 0));'
  );
  console.log('Added fillVisible to getSetRenderOptions');
}

// 3. syncSetStyleControlsFromActiveSet: sync polygonFillVisible
if (!content.includes('polygonFillVisibleEl.checked =')) {
  content = content.replace(
    'if (polygonVisibleEl) polygonVisibleEl.checked = Boolean(polygon.visible);',
    'if (polygonVisibleEl) polygonVisibleEl.checked = Boolean(polygon.visible);\n    if (polygonFillVisibleEl) polygonFillVisibleEl.checked = Boolean(polygon.fillVisible !== false);'
  );
  console.log('Added polygonFillVisible sync to syncSetStyleControlsFromActiveSet');
}

// 4. applyActiveSetStyleControls: apply polygonFillVisible
if (!content.includes('options.polygon.fillVisible =')) {
  content = content.replace(
    'if (polygonVisibleEl) options.polygon.visible = polygonVisibleEl.checked;',
    'if (polygonVisibleEl) options.polygon.visible = polygonVisibleEl.checked;\n    if (polygonFillVisibleEl) options.polygon.fillVisible = polygonFillVisibleEl.checked;'
  );
  console.log('Added polygonFillVisible apply to applyActiveSetStyleControls');
}

// 5. drawSetPolygon: check fillVisible and wrap in save/restore
const oldDrawSetPoly = `  function drawSetPolygon(set, tf) {
    const renderOptions = getSetRenderOptions(set);
    if (!renderOptions.polygon.visible || set.points.length < 3) return;

    const { xToPx, yToPx } = tf;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(set.points[0].x), yToPx(set.points[0].y));
    for (let i = 1; i < set.points.length; i++) ctx.lineTo(xToPx(set.points[i].x), yToPx(set.points[i].y));
    ctx.closePath();

    if (renderOptions.polygon.fillOpacity > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(renderOptions.polygon.fillOpacity) || 0));
      ctx.fillStyle = renderOptions.polygon.fillColor || DEFAULT_FILL_COLOR;
      ctx.fill();
    }

    if (renderOptions.polygon.borderVisible) {
      ctx.globalAlpha = 1;
      ctx.setLineDash(resolveDashPattern(renderOptions.polygon.borderStyle));
      ctx.strokeStyle = renderOptions.polygon.borderColor || DEFAULT_BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Number(renderOptions.polygon.borderWidth) || 3);
      ctx.stroke();
    }
    ctx.restore();
  }`;

const newDrawSetPoly = `  function drawSetPolygon(set, tf) {
    const renderOptions = getSetRenderOptions(set);
    if (!renderOptions.polygon.visible || set.points.length < 3) return;

    const { xToPx, yToPx } = tf;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(set.points[0].x), yToPx(set.points[0].y));
    for (let i = 1; i < set.points.length; i++) ctx.lineTo(xToPx(set.points[i].x), yToPx(set.points[i].y));
    ctx.closePath();

    if (renderOptions.polygon.fillVisible && renderOptions.polygon.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(renderOptions.polygon.fillOpacity) || 0));
      ctx.fillStyle = renderOptions.polygon.fillColor || DEFAULT_FILL_COLOR;
      ctx.fill();
      ctx.restore();
    }

    if (renderOptions.polygon.borderVisible) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.setLineDash(resolveDashPattern(renderOptions.polygon.borderStyle));
      ctx.strokeStyle = renderOptions.polygon.borderColor || DEFAULT_BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Number(renderOptions.polygon.borderWidth) || 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }`;

if (content.includes(oldDrawSetPoly)) {
  content = content.replace(oldDrawSetPoly, newDrawSetPoly);
  console.log('Replaced drawSetPolygon with fillVisible check and isolated canvas state');
} else {
  console.log('oldDrawSetPoly match not found, checking if already updated...');
}

// Convert back to CRLF if file was CRLF
if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(p, content, 'utf8');
console.log('Coordinates_graph.html update script completed.');
