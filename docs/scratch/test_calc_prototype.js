const points = [
  { label: 'P', x: 1, y: -1 },
  { label: 'Q', x: 3, y: 1 },
  { label: 'R', x: 4, y: 10/9 }
];

function computeBounds(points, marginUnits) {
  if (!points || points.length === 0) {
    return { minX: -5, maxX: 5, minY: -5, maxY: 5 };
  }
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < points.length; i++) {
    var p = points[i];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  minX = Math.min(minX, 0); maxX = Math.max(maxX, 0);
  minY = Math.min(minY, 0); maxY = Math.max(maxY, 0);

  marginUnits = Number(marginUnits) || 0;
  minX -= marginUnits; maxX += marginUnits;
  minY -= marginUnits; maxY += marginUnits;

  if (minX === maxX) { minX -= 5; maxX += 5; }
  if (minY === maxY) { minY -= 5; maxY += 5; }

  return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
}

function computeFittedBounds(dataBounds, padPx, canvasWidth, canvasHeight) {
  padPx = Number(padPx) || 40;
  var W = Number(canvasWidth) || 800;
  var H = Number(canvasHeight) || 600;
  var usableW = Math.max(10, W - 2 * padPx);
  var usableH = Math.max(10, H - 2 * padPx);

  var dataW = dataBounds.maxX - dataBounds.minX;
  var dataH = dataBounds.maxY - dataBounds.minY;
  if (dataW <= 0) dataW = 10;
  if (dataH <= 0) dataH = 10;

  var baseScale = Math.min(usableW / dataW, usableH / dataH);

  var visibleWorldW = usableW / baseScale;
  var visibleWorldH = usableH / baseScale;

  var centerX = (dataBounds.minX + dataBounds.maxX) / 2;
  var centerY = (dataBounds.minY + dataBounds.maxY) / 2;

  return {
    minX: centerX - visibleWorldW / 2,
    maxX: centerX + visibleWorldW / 2,
    minY: centerY - visibleWorldH / 2,
    maxY: centerY + visibleWorldH / 2,
    baseScale: baseScale,
    dataBounds: dataBounds
  };
}

function makeTransform(bounds, padPx, canvasWidth, canvasHeight, viewZoom, viewOffset) {
  var W = canvasWidth, H = canvasHeight;
  var worldW = bounds.maxX - bounds.minX;
  var worldH = bounds.maxY - bounds.minY;

  var sx = (W - 2 * padPx) / worldW;
  var sy = (H - 2 * padPx) / worldH;
  var baseScale = Math.min(sx, sy);
  var scale = baseScale * (viewZoom || 1.0);

  var drawW = worldW * scale;
  var drawH = worldH * scale;
  var offsetX = (W - drawW) / 2 + (viewOffset ? viewOffset.x : 0);
  var offsetY = (H - drawH) / 2 + (viewOffset ? viewOffset.y : 0);

  return {
    scale: scale,
    baseScale: baseScale,
    offsetX: offsetX,
    offsetY: offsetY,
    padPx: padPx,
    bounds: bounds,
    drawW: drawW,
    drawH: drawH,
    xToPx: function (x) { return offsetX + (x - bounds.minX) * scale; },
    yToPx: function (y) { return offsetY + (bounds.maxY - y) * scale; },
    pxToX: function (px) { return bounds.minX + (px - offsetX) / scale; },
    pxToY: function (py) { return bounds.maxY - (py - offsetY) / scale; }
  };
}

// Test with various canvas sizes
const sizes = [
  { w: 1000, h: 650, name: 'Standard Desktop Workspace' },
  { w: 1400, h: 800, name: 'Large Desktop Workspace' },
  { w: 800, h: 600, name: 'Compact Workspace' },
  { w: 600, h: 700, name: 'Portrait / Narrow Viewport' }
];

const dataBounds = computeBounds(points, 2);
console.log('Data bounds:', dataBounds);

sizes.forEach(sz => {
  const padPx = 40;
  const fitted = computeFittedBounds(dataBounds, padPx, sz.w, sz.h);
  const tf = makeTransform(fitted, padPx, sz.w, sz.h, 1.0, { x: 0, y: 0 });
  const gridArea = tf.drawW * tf.drawH;
  const canvasArea = sz.w * sz.h;
  const utilization = ((gridArea / canvasArea) * 100).toFixed(1);

  console.log(`\n=== ${sz.name} (${sz.w}x${sz.h}) ===`);
  console.log(`Fitted bounds: X=[${fitted.minX.toFixed(2)}, ${fitted.maxX.toFixed(2)}], Y=[${fitted.minY.toFixed(2)}, ${fitted.maxY.toFixed(2)}]`);
  console.log(`Base scale: ${tf.scale.toFixed(2)} px/unit`);
  console.log(`Drawn rect: ${tf.drawW.toFixed(1)} x ${tf.drawH.toFixed(1)} at offset (${tf.offsetX.toFixed(1)}, ${tf.offsetY.toFixed(1)})`);
  console.log(`Canvas utilization: ${utilization}%`);
  
  // Verify all points inside canvas
  points.forEach(p => {
    const px = tf.xToPx(p.x);
    const py = tf.yToPx(p.y);
    const inside = px >= padPx && px <= sz.w - padPx && py >= padPx && py <= sz.h - padPx;
    if (!inside) console.error(`  FAIL: Point ${p.label} at (${px}, ${py}) is outside margins!`);
  });
  
  // Verify origin inside canvas
  const ox = tf.xToPx(0);
  const oy = tf.yToPx(0);
  const originInside = ox >= padPx && ox <= sz.w - padPx && oy >= padPx && oy <= sz.h - padPx;
  console.log(`Origin (0,0) at (${ox.toFixed(1)}, ${oy.toFixed(1)}), inside: ${originInside}`);
});
