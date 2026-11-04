const fs = require('fs');

let html = fs.readFileSync('Coordinates_graph.html', 'utf8');

// Normalize line endings to \n for clean string replacements
let normHtml = html.replace(/\r\n/g, '\n');

// 1. Controls
const targetControls = '<div class="row">\n          <label><input id="showLabels" type="checkbox" checked /> Show point labels</label>\n        </div>\n\n        <div class="btns">';

const newControls = `<div class="sectionTitle">View & Canvas background</div>
        <div class="row">
          <label>Zoom</label>
          <input id="viewZoom" type="range" min="0.4" max="3.0" value="1.0" step="0.05" />
          <div class="val" id="viewZoomVal">100%</div>
        </div>
        <div class="row">
          <label>Background color</label>
          <input id="canvasBgColor" type="color" value="#ffffff" />
        </div>
        <div class="btns" style="margin-top:6px;">
          <button id="resetViewBtn" type="button">Reset View</button>
          <button id="resetBgBtn" type="button">Default Background</button>
        </div>

        <div class="sectionTitle">Grid controls</div>
        <div class="row">
          <label><input id="gridVisible" type="checkbox" checked /> Show grid lines</label>
        </div>
        <div class="row">
          <label>Grid line color</label>
          <input id="gridColor" type="color" value="#000000" />
        </div>
        <div class="row">
          <label>Grid opacity</label>
          <input id="gridOpacity" type="range" min="0" max="100" value="15" />
          <div class="val" id="gridOpacityVal">15%</div>
        </div>

        <div class="sectionTitle">Axis controls</div>
        <div class="row">
          <label><input id="xAxisVisible" type="checkbox" checked /> Show X-axis</label>
        </div>
        <div class="row">
          <label><input id="yAxisVisible" type="checkbox" checked /> Show Y-axis</label>
        </div>
        <div class="row">
          <label>Axis color</label>
          <input id="axisColor" type="color" value="#000000" />
        </div>
        <div class="row">
          <label>Axis line width</label>
          <input id="axisWidth" type="range" min="1" max="8" value="2" />
          <div class="val" id="axisWidthVal">2</div>
        </div>
        <div class="row">
          <label><input id="axisLabelsVisible" type="checkbox" checked /> Show axis & tick numbers</label>
        </div>

        <div class="sectionTitle">Coordinate label controls</div>
        <div class="row">
          <label><input id="showLabels" type="checkbox" checked /> Show point labels</label>
        </div>
        <div class="row">
          <label>Coordinate precision</label>
          <select id="coordPrecision">
            <option value="auto" selected>Auto (keep fractions/raw)</option>
            <option value="0">0 decimals (Integer)</option>
            <option value="1">1 decimal</option>
            <option value="2">2 decimals</option>
            <option value="3">3 decimals</option>
          </select>
        </div>

        <div class="btns">`;

// 2. State & DOM references
const targetState = 'const showLabelsEl = document.getElementById("showLabels");';
const newState = `const showLabelsEl = document.getElementById("showLabels");

  let viewZoom = 1.0;
  let viewOffset = { x: 0, y: 0 };

  const viewZoomEl = document.getElementById("viewZoom");
  const viewZoomValEl = document.getElementById("viewZoomVal");
  const canvasBgColorEl = document.getElementById("canvasBgColor");
  const resetViewBtn = document.getElementById("resetViewBtn");
  const resetBgBtn = document.getElementById("resetBgBtn");

  const gridVisibleEl = document.getElementById("gridVisible");
  const gridColorEl = document.getElementById("gridColor");
  const gridOpacityEl = document.getElementById("gridOpacity");
  const gridOpacityValEl = document.getElementById("gridOpacityVal");

  const xAxisVisibleEl = document.getElementById("xAxisVisible");
  const yAxisVisibleEl = document.getElementById("yAxisVisible");
  const axisColorEl = document.getElementById("axisColor");
  const axisWidthEl = document.getElementById("axisWidth");
  const axisWidthValEl = document.getElementById("axisWidthVal");
  const axisLabelsVisibleEl = document.getElementById("axisLabelsVisible");

  const coordPrecisionEl = document.getElementById("coordPrecision");`;

// 3. Transform
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

const newTransform = `  function formatCoordinate(val, rawVal, precision) {
    if (precision === "auto" || precision == null || precision === "") {
      return rawVal != null ? String(rawVal) : String(val);
    }
    const p = Number(precision);
    if (isNaN(p)) return String(rawVal != null ? rawVal : val);
    const num = Number(val);
    return isNaN(num) ? String(rawVal) : num.toFixed(p);
  }

  function makeTransform(bounds, padPx) {
    const W = canvas.width, H = canvas.height;
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;

    const sx = (W - 2*padPx) / worldW;
    const sy = (H - 2*padPx) / worldH;
    const baseScale = Math.min(sx, sy);
    const scale = baseScale * viewZoom;

    const drawW = worldW * scale;
    const drawH = worldH * scale;
    const offsetX = (W - drawW) / 2 + viewOffset.x;
    const offsetY = (H - drawH) / 2 + viewOffset.y;

    const xToPx = (x) => offsetX + (x - bounds.minX) * scale;
    const yToPx = (y) => offsetY + (bounds.maxY - y) * scale;

    return { scale, xToPx, yToPx };
  }`;

// 4. DrawSet
const targetDrawSet = `      if (showLabels) {
        const off = set.pointOffsets[p.label] || { dx: 20, dy: -20 };
        const text = \`\${p.label}(\${p.xRaw}, \${p.yRaw})\`;
        const bbox = drawTextBox(ctx, text, px + off.dx, py + off.dy, { fontSize: FONT.point, align: "left" });
        labelBoxes.push({ setId: set.id, label: p.label, x: bbox.bx, y: bbox.by, w: bbox.bw, h: bbox.bh });
      }`.replace(/\r\n/g, '\n');

const newDrawSet = `      if (showLabels) {
        const off = set.pointOffsets[p.label] || { dx: 20, dy: -20 };
        const prec = coordPrecisionEl ? coordPrecisionEl.value : "auto";
        const text = \`\${p.label}(\${formatCoordinate(p.x, p.xRaw, prec)}, \${formatCoordinate(p.y, p.yRaw, prec)})\`;
        let targetX = px + off.dx;
        let targetY = py + off.dy;

        // Collision avoidance: if using default offset and collides with existing label box, stagger vertically
        if (!set.pointOffsets[p.label]) {
          let shifts = 0;
          while (shifts < 4) {
            const collides = labelBoxes.some(box =>
              Math.abs(targetX - box.x) < 45 && Math.abs(targetY - box.y) < 20
            );
            if (collides) {
              targetY += 22;
              shifts++;
            } else {
              break;
            }
          }
        }

        const bbox = drawTextBox(ctx, text, targetX, targetY, { fontSize: FONT.point, align: "left" });
        labelBoxes.push({ setId: set.id, label: p.label, x: bbox.bx, y: bbox.by, w: bbox.bw, h: bbox.bh });
      }`;

// 5. DrawGrid
const targetDrawGrid = `  function drawGrid(bounds, tf, settings) {
    const { FONT, offsets, minorTick } = settings;
    const { scale, xToPx, yToPx } = tf;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = Math.floor(bounds.minX);
    const endX   = Math.ceil(bounds.maxX);
    const startY = Math.floor(bounds.minY);
    const endY   = Math.ceil(bounds.maxY);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    for (let x = startX; x <= endX; x++) {
      ctx.beginPath();
      ctx.moveTo(xToPx(x), yToPx(bounds.minY));
      ctx.lineTo(xToPx(x), yToPx(bounds.maxY));
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y++) {
      ctx.beginPath();
      ctx.moveTo(xToPx(bounds.minX), yToPx(y));
      ctx.lineTo(xToPx(bounds.maxX), yToPx(y));
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1.2;
    for (let x = Math.ceil(startX/5)*5; x <= endX; x += 5) {
      ctx.beginPath();
      ctx.moveTo(xToPx(x), yToPx(bounds.minY));
      ctx.lineTo(xToPx(x), yToPx(bounds.maxY));
      ctx.stroke();
    }
    for (let y = Math.ceil(startY/5)*5; y <= endY; y += 5) {
      ctx.beginPath();
      ctx.moveTo(xToPx(bounds.minX), yToPx(y));
      ctx.lineTo(xToPx(bounds.maxX), yToPx(y));
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(xToPx(bounds.minX), yToPx(0));
    ctx.lineTo(xToPx(bounds.maxX), yToPx(0));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xToPx(0), yToPx(bounds.minY));
    ctx.lineTo(xToPx(0), yToPx(bounds.maxY));
    ctx.stroke();

    drawTextBox(ctx, "X", xToPx(bounds.maxX) - 12, yToPx(0) - 16, { fontSize: FONT.axis });
    drawTextBox(ctx, "Y", xToPx(0) + 14, yToPx(bounds.maxY) + 26, { fontSize: FONT.axis });

    const step = niceStepForLabels(scale);

    for (let x = Math.ceil(startX/step)*step; x <= endX; x += step) {
      const px = xToPx(x);
      const py = yToPx(0);

      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = minorTick.width;
      ctx.beginPath();
      ctx.moveTo(px, py - minorTick.len);
      ctx.lineTo(px, py + minorTick.len);
      ctx.stroke();

      if (x !== 0) {
        drawTextBox(ctx, String(x), px + offsets.xTick.dx, py + offsets.xTick.dy, { fontSize: FONT.ticks, align: "center" });
      }
    }

    for (let y = Math.ceil(startY/step)*step; y <= endY; y += step) {
      const px = xToPx(0);
      const py = yToPx(y);

      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = minorTick.width;
      ctx.beginPath();
      ctx.moveTo(px - minorTick.len, py);
      ctx.lineTo(px + minorTick.len, py);
      ctx.stroke();

      if (y !== 0) {
        drawTextBox(ctx, String(y), px + offsets.yTick.dx, py + offsets.yTick.dy, { fontSize: FONT.ticks, align: "right" });
      }
    }

    drawTextBox(ctx, "O", xToPx(0) + offsets.origin.dx, yToPx(0) + offsets.origin.dy, { fontSize: FONT.ticks });
  }`.replace(/\r\n/g, '\n');

const newDrawGrid = `  function drawGrid(bounds, tf, settings) {
    const { FONT, offsets, minorTick } = settings;
    const { scale, xToPx, yToPx } = tf;

    const bgColor = canvasBgColorEl ? canvasBgColorEl.value : "#ffffff";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = Math.floor(bounds.minX);
    const endX   = Math.ceil(bounds.maxX);
    const startY = Math.floor(bounds.minY);
    const endY   = Math.ceil(bounds.maxY);

    const isGridOn = gridVisibleEl ? gridVisibleEl.checked : true;
    if (isGridOn) {
      const gColor = gridColorEl ? gridColorEl.value : "#000000";
      const gOpacity = gridOpacityEl ? (Number(gridOpacityEl.value) / 100) : 0.15;

      ctx.save();
      ctx.strokeStyle = gColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, gOpacity * 0.55));
      for (let x = startX; x <= endX; x++) {
        ctx.beginPath();
        ctx.moveTo(xToPx(x), yToPx(bounds.minY));
        ctx.lineTo(xToPx(x), yToPx(bounds.maxY));
        ctx.stroke();
      }
      for (let y = startY; y <= endY; y++) {
        ctx.beginPath();
        ctx.moveTo(xToPx(bounds.minX), yToPx(y));
        ctx.lineTo(xToPx(bounds.maxX), yToPx(y));
        ctx.stroke();
      }

      ctx.lineWidth = 1.2;
      ctx.globalAlpha = Math.max(0, Math.min(1, gOpacity * 1.2));
      for (let x = Math.ceil(startX/5)*5; x <= endX; x += 5) {
        ctx.beginPath();
        ctx.moveTo(xToPx(x), yToPx(bounds.minY));
        ctx.lineTo(xToPx(x), yToPx(bounds.maxY));
        ctx.stroke();
      }
      for (let y = Math.ceil(startY/5)*5; y <= endY; y += 5) {
        ctx.beginPath();
        ctx.moveTo(xToPx(bounds.minX), yToPx(y));
        ctx.lineTo(xToPx(bounds.maxX), yToPx(y));
        ctx.stroke();
      }
      ctx.restore();
    }

    const isXOn = xAxisVisibleEl ? xAxisVisibleEl.checked : true;
    const isYOn = yAxisVisibleEl ? yAxisVisibleEl.checked : true;
    const aColor = axisColorEl ? axisColorEl.value : "#000000";
    const aWidth = axisWidthEl ? Math.max(1, Number(axisWidthEl.value) || 2) : 2;
    const isAxisLabelsOn = axisLabelsVisibleEl ? axisLabelsVisibleEl.checked : true;

    ctx.save();
    ctx.strokeStyle = aColor;
    ctx.lineWidth = aWidth;

    if (isXOn) {
      ctx.beginPath();
      ctx.moveTo(xToPx(bounds.minX), yToPx(0));
      ctx.lineTo(xToPx(bounds.maxX), yToPx(0));
      ctx.stroke();

      if (isAxisLabelsOn) {
        drawTextBox(ctx, "X", xToPx(bounds.maxX) - 12, yToPx(0) - 16, { fontSize: FONT.axis, color: aColor });
      }
    }

    if (isYOn) {
      ctx.beginPath();
      ctx.moveTo(xToPx(0), yToPx(bounds.minY));
      ctx.lineTo(xToPx(0), yToPx(bounds.maxY));
      ctx.stroke();

      if (isAxisLabelsOn) {
        drawTextBox(ctx, "Y", xToPx(0) + 14, yToPx(bounds.maxY) + 26, { fontSize: FONT.axis, color: aColor });
      }
    }
    ctx.restore();

    const step = niceStepForLabels(scale);

    if (isXOn) {
      for (let x = Math.ceil(startX/step)*step; x <= endX; x += step) {
        const px = xToPx(x);
        const py = yToPx(0);

        ctx.save();
        ctx.strokeStyle = aColor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = minorTick.width;
        ctx.beginPath();
        ctx.moveTo(px, py - minorTick.len);
        ctx.lineTo(px, py + minorTick.len);
        ctx.stroke();
        ctx.restore();

        if (isAxisLabelsOn && x !== 0) {
          drawTextBox(ctx, String(x), px + offsets.xTick.dx, py + offsets.xTick.dy, { fontSize: FONT.ticks, align: "center", color: aColor });
        }
      }
    }

    if (isYOn) {
      for (let y = Math.ceil(startY/step)*step; y <= endY; y += step) {
        const px = xToPx(0);
        const py = yToPx(y);

        ctx.save();
        ctx.strokeStyle = aColor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = minorTick.width;
        ctx.beginPath();
        ctx.moveTo(px - minorTick.len, py);
        ctx.lineTo(px + minorTick.len, py);
        ctx.stroke();
        ctx.restore();

        if (isAxisLabelsOn && y !== 0) {
          drawTextBox(ctx, String(y), px + offsets.yTick.dx, py + offsets.yTick.dy, { fontSize: FONT.ticks, align: "right", color: aColor });
        }
      }
    }

    if (isAxisLabelsOn && (isXOn || isYOn)) {
      drawTextBox(ctx, "O", xToPx(0) + offsets.origin.dx, yToPx(0) + offsets.origin.dy, { fontSize: FONT.ticks, color: aColor });
    }
  }`;

// 6. Mouse & Wheel
const targetMouseEvents = `  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = canvasPointFromEvent(e);

    if (drag.active) {
      const dx = x - drag.startMouseX;
      const dy = y - drag.startMouseY;
      const targetSet = getSetById(drag.setId);
      if (!targetSet) return;
      const currentOff = targetSet.pointOffsets[drag.label] || { dx: 20, dy: -20 };
      currentOff.dx = Math.round(drag.startDX + dx);
      currentOff.dy = Math.round(drag.startDY + dy);
      targetSet.pointOffsets[drag.label] = currentOff;
      updatePointSliderUI(drag.setId, drag.label);
      drawFromUI();
      setCanvasCursor("dragging");
      return;
    }

    const hit = hitTestLabel(x, y);
    setCanvasCursor(hit ? "can-drag" : null);
  });

  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = canvasPointFromEvent(e);
    const hit = hitTestLabel(x, y);
    if (!hit) return;

    drag.active = true;
    drag.setId = hit.setId;
    drag.label = hit.label;
    drag.startMouseX = x;
    drag.startMouseY = y;
    const targetSet = getSetById(hit.setId);
    const currentOff = targetSet.pointOffsets[hit.label] || { dx: 20, dy: -20 };
    drag.startDX = currentOff.dx;
    drag.startDY = currentOff.dy;

    setCanvasCursor("dragging");
  });

  window.addEventListener("mouseup", () => {
    if (drag.active) {
      drag.active = false;
      drag.setId = null;
      drag.label = null;
      setCanvasCursor(null);
    }
  });`.replace(/\r\n/g, '\n');

const newMouseEvents = `  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = canvasPointFromEvent(e);

    if (drag.active) {
      const dx = x - drag.startMouseX;
      const dy = y - drag.startMouseY;

      if (drag.mode === "pan") {
        viewOffset.x = drag.startPanX + dx;
        viewOffset.y = drag.startPanY + dy;
        drawFromUI();
        setCanvasCursor("dragging");
        return;
      }

      const targetSet = getSetById(drag.setId);
      if (!targetSet) return;
      const currentOff = targetSet.pointOffsets[drag.label] || { dx: 20, dy: -20 };
      currentOff.dx = Math.round(drag.startDX + dx);
      currentOff.dy = Math.round(drag.startDY + dy);
      targetSet.pointOffsets[drag.label] = currentOff;
      updatePointSliderUI(drag.setId, drag.label);
      drawFromUI();
      setCanvasCursor("dragging");
      return;
    }

    const hit = hitTestLabel(x, y);
    setCanvasCursor(hit ? "can-drag" : null);
  });

  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = canvasPointFromEvent(e);
    const hit = hitTestLabel(x, y);

    if (hit) {
      drag.active = true;
      drag.mode = "label";
      drag.setId = hit.setId;
      drag.label = hit.label;
      drag.startMouseX = x;
      drag.startMouseY = y;
      const targetSet = getSetById(hit.setId);
      const currentOff = targetSet.pointOffsets[hit.label] || { dx: 20, dy: -20 };
      drag.startDX = currentOff.dx;
      drag.startDY = currentOff.dy;
      setCanvasCursor("dragging");
      return;
    }

    // Pan empty space
    drag.active = true;
    drag.mode = "pan";
    drag.setId = null;
    drag.label = null;
    drag.startMouseX = x;
    drag.startMouseY = y;
    drag.startPanX = viewOffset.x;
    drag.startPanY = viewOffset.y;
    setCanvasCursor("dragging");
  });

  window.addEventListener("mouseup", () => {
    if (drag.active) {
      drag.active = false;
      drag.mode = null;
      drag.setId = null;
      drag.label = null;
      setCanvasCursor(null);
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    viewZoom = Math.max(0.4, Math.min(3.0, viewZoom * factor));
    if (viewZoomEl) {
      viewZoomEl.value = viewZoom.toFixed(2);
      if (viewZoomValEl) viewZoomValEl.textContent = \`\${Math.round(viewZoom * 100)}%\`;
    }
    drawFromUI();
  }, { passive: false });`;

// 7. Reset and Listeners
const targetReset = `  document.getElementById("resetBtn").addEventListener("click", () => {
    const activeSet = getActiveSet();
    if (!activeSet) return;

    activeSet.inputText = defaultSampleText();
    pointsInput.value = activeSet.inputText;
    activeSet.points = preservePointStyles([], parsePoints(activeSet.inputText));
    activeSet.pointOffsets = Object.create(null);
    ensurePointOffsets(activeSet);
    activeSet.renderOptions = defaultRenderOptions();
    setRenderOptionsMap.set(activeSet.id, activeSet.renderOptions);
    marginUnitsEl.value = 2;
    showDiagonalsEl.checked = false;
    showLabelsEl.checked = true;

    controls.fontAxis.value = 20;
    controls.fontTicks.value = 16;
    controls.fontPoint.value = 17;

    controls.minorTickWidth.value = 2;
    controls.minorTickLen.value = 8;

    controls.xTickDX.value = 0;
    controls.xTickDY.value = 28;
    controls.yTickDX.value = -20;
    controls.yTickDY.value = 0;

    controls.oDX.value = 16;
    controls.oDY.value = 18;

    refreshValueLabels();
    renderSetListAndControls();
    drawFromUI();
  });`.replace(/\r\n/g, '\n');

const newResetAndListeners = `  if (viewZoomEl) {
    viewZoomEl.addEventListener("input", () => {
      viewZoom = Number(viewZoomEl.value) || 1.0;
      if (viewZoomValEl) viewZoomValEl.textContent = \`\${Math.round(viewZoom * 100)}%\`;
      drawFromUI();
    });
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", () => {
      viewZoom = 1.0;
      viewOffset.x = 0;
      viewOffset.y = 0;
      if (viewZoomEl) {
        viewZoomEl.value = "1.0";
        if (viewZoomValEl) viewZoomValEl.textContent = "100%";
      }
      drawFromUI();
    });
  }

  if (canvasBgColorEl) {
    canvasBgColorEl.addEventListener("input", drawFromUI);
  }

  if (resetBgBtn) {
    resetBgBtn.addEventListener("click", () => {
      if (canvasBgColorEl) canvasBgColorEl.value = "#ffffff";
      drawFromUI();
    });
  }

  if (gridVisibleEl) gridVisibleEl.addEventListener("change", drawFromUI);
  if (gridColorEl) gridColorEl.addEventListener("input", drawFromUI);
  if (gridOpacityEl) {
    gridOpacityEl.addEventListener("input", () => {
      if (gridOpacityValEl) gridOpacityValEl.textContent = \`\${gridOpacityEl.value}%\`;
      drawFromUI();
    });
  }

  if (xAxisVisibleEl) xAxisVisibleEl.addEventListener("change", drawFromUI);
  if (yAxisVisibleEl) yAxisVisibleEl.addEventListener("change", drawFromUI);
  if (axisColorEl) axisColorEl.addEventListener("input", drawFromUI);
  if (axisWidthEl) {
    axisWidthEl.addEventListener("input", () => {
      if (axisWidthValEl) axisWidthValEl.textContent = axisWidthEl.value;
      drawFromUI();
    });
  }
  if (axisLabelsVisibleEl) axisLabelsVisibleEl.addEventListener("change", drawFromUI);
  if (coordPrecisionEl) coordPrecisionEl.addEventListener("change", drawFromUI);

  document.getElementById("resetBtn").addEventListener("click", () => {
    const activeSet = getActiveSet();
    if (!activeSet) return;

    activeSet.inputText = defaultSampleText();
    pointsInput.value = activeSet.inputText;
    activeSet.points = preservePointStyles([], parsePoints(activeSet.inputText));
    activeSet.pointOffsets = Object.create(null);
    ensurePointOffsets(activeSet);
    activeSet.renderOptions = defaultRenderOptions();
    setRenderOptionsMap.set(activeSet.id, activeSet.renderOptions);
    marginUnitsEl.value = 2;
    showDiagonalsEl.checked = false;
    showLabelsEl.checked = true;

    // Reset Phase 2.4 graph customization and view settings
    viewZoom = 1.0;
    viewOffset = { x: 0, y: 0 };
    if (viewZoomEl) viewZoomEl.value = "1.0";
    if (viewZoomValEl) viewZoomValEl.textContent = "100%";
    if (canvasBgColorEl) canvasBgColorEl.value = "#ffffff";
    if (gridVisibleEl) gridVisibleEl.checked = true;
    if (gridColorEl) gridColorEl.value = "#000000";
    if (gridOpacityEl) gridOpacityEl.value = "15";
    if (gridOpacityValEl) gridOpacityValEl.textContent = "15%";
    if (xAxisVisibleEl) xAxisVisibleEl.checked = true;
    if (yAxisVisibleEl) yAxisVisibleEl.checked = true;
    if (axisColorEl) axisColorEl.value = "#000000";
    if (axisWidthEl) axisWidthEl.value = "2";
    if (axisWidthValEl) axisWidthValEl.textContent = "2";
    if (axisLabelsVisibleEl) axisLabelsVisibleEl.checked = true;
    if (coordPrecisionEl) coordPrecisionEl.value = "auto";

    controls.fontAxis.value = 20;
    controls.fontTicks.value = 16;
    controls.fontPoint.value = 17;

    controls.minorTickWidth.value = 2;
    controls.minorTickLen.value = 8;

    controls.xTickDX.value = 0;
    controls.xTickDY.value = 28;
    controls.yTickDX.value = -20;
    controls.yTickDY.value = 0;

    controls.oDX.value = 16;
    controls.oDY.value = 18;

    refreshValueLabels();
    renderSetListAndControls();
    drawFromUI();
  });`;

function doReplace(label, target, replacement) {
  if (!normHtml.includes(target)) {
    throw new Error('Target not found for: ' + label);
  }
  normHtml = normHtml.replace(target, replacement);
  console.log('Replaced block:', label);
}

doReplace('controls', targetControls, newControls);
doReplace('state', targetState, newState);
doReplace('transform', targetTransform, newTransform);
doReplace('drawSet', targetDrawSet, newDrawSet);
doReplace('drawGrid', targetDrawGrid, newDrawGrid);
doReplace('mouseEvents', targetMouseEvents, newMouseEvents);
doReplace('reset', targetReset, newResetAndListeners);

// Restore CRLF line endings
const finalHtml = normHtml.replace(/\n/g, '\r\n');
fs.writeFileSync('Coordinates_graph.html', finalHtml, 'utf8');
console.log('SUCCESS: Coordinates_graph.html updated with Phase 2.4 features!');
