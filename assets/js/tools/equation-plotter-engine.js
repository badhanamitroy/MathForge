(function (window, document) {
  "use strict";
/* Note: parsePair(), clamp() and isoStamp() now come from
   assets/js/common.js — the local copies that used to live here
   were removed so we don't shadow the shared versions. */
function mount(options) {
  options = options || {};
  var canvasView = options.canvasView || null;
  var controlRoot = options.controlsRoot || document;
  var cleanups = [];
  function getToolControls(selector) {
    var elements = [];
    [controlRoot, document.querySelector("#mfPropertiesContainer .mf-graph-specific-controls")].forEach(function (root) {
      if (!root || !root.querySelectorAll) return;
      Array.prototype.forEach.call(root.querySelectorAll(selector), function (element) {
        if (elements.indexOf(element) === -1) elements.push(element);
      });
    });
    return elements;
  }
  function listen(target, type, handler, listenerOptions) {
    target.addEventListener(type, handler, listenerOptions);
    cleanups.push(function () { target.removeEventListener(type, handler, listenerOptions); });
  }

  const cv = canvasView || document.getElementById("cv");
  const ctx = cv.getContext('2d');
  let clearRequested = false;

  const $ = (id) => document.getElementById(id);
  const graphTypography = window.MathForgeGraphTypography;
  const typographyControls = graphTypography && graphTypography.ensureControls(controlRoot, "eq");

  function readTypography() {
    return typographyControls ? graphTypography.read(typographyControls.sizeInput, typographyControls.boldInput, typographyControls.familyInput, typographyControls.colorInput) : { fontSizePt: 11, bold: false };
  }

  function graphFont(controlSizePx, defaultSizePx, typography) {
    return graphTypography
      ? graphTypography.font(graphTypography.scaledSizePx(controlSizePx, defaultSizePx, typography), typography)
      : `${controlSizePx}px "Times New Roman", "Kalpurush", serif`;
  }

  const valSpans = {
    zoomVal: $('zoomVal'),
    curveWidthVal: $('curveWidthVal'),
    axisFontVal: $('axisFontVal'),
    tickFontVal: $('tickFontVal'),
    labelFontVal: $('labelFontVal'),
  };

  function refreshValueLabels(){
    valSpans.zoomVal.textContent = Number($('zoom').value).toFixed(2);
    valSpans.curveWidthVal.textContent = $('curveWidth').value;
    valSpans.axisFontVal.textContent = $('axisFont').value;
    valSpans.tickFontVal.textContent = $('tickFont').value;
    valSpans.labelFontVal.textContent = $('labelFont').value;
  }

  function parsePoints(text) {
    return text.split('\n')
      .map(s => s.trim()).filter(Boolean)
      .map(line => parsePair(line))
      .filter(Boolean);
  }

  function stringifyPoints(points, decimals){
    const d = Math.max(0, Math.min(10, decimals|0));
    const fmt = (n) => {
      const isInt = Math.abs(n - Math.round(n)) < 1e-12;
      if (isInt) return String(Math.round(n));
      return n.toFixed(d).replace(/0+$/,'').replace(/\.$/,'');
    };
    return points.map(([x,y]) => `${fmt(x)},${fmt(y)}`).join('\n');
  }

  // Interaction state
  let pointHitBoxes = [];   // {i, cx, cy, r}
  let labelHitBoxes = [];   // {i, x, y, w, h}
  const labelOffsets = [];  // per point: {dx, dy}

  const drag = {
    active: false,
    mode: null,         // "pan" | "point" | "label"
    pointIndex: -1,
    startMx: 0,
    startMy: 0,
    startOx: 0,
    startOy: 0,
    startDx: 0,
    startDy: 0,
  };

  function canvasXYFromEvent(e){
    const rect = cv.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (cv.width / rect.width),
      y: (e.clientY - rect.top) * (cv.height / rect.height),
    };
  }

  function setCanvasCursor(cls){
    cv.classList.remove("can-grab","grabbing","can-move-point","can-move-label");
    if (cls) cv.classList.add(cls);
  }

  function ensureLabelOffsets(points){
    while (labelOffsets.length < points.length) labelOffsets.push({dx: 6, dy: -6});
    if (labelOffsets.length > points.length) labelOffsets.length = points.length;
  }

  // world -> canvas using "small squares per unit" and zoom factor (applied to minorPx)
  function worldToCanvas(x, y, ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom) {
    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit; // px per 1 x-unit
    const sy = mp * ySmallPerUnit; // px per 1 y-unit
    return [ox + x * sx, oy - y * sy];
  }
  function canvasToWorld(px, py, ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom){
    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit;
    const sy = mp * ySmallPerUnit;
    const x = (px - ox) / sx;
    const y = (oy - py) / sy;
    return [x, y];
  }

  function sharedAxisRate(axis, fallback) {
    return window.MathForgeGraphScale
      ? window.MathForgeGraphScale.effectiveRate(axis, fallback)
      : Number(fallback);
  }

  function clear() { ctx.clearRect(0,0,cv.width,cv.height); }

  function arrowhead(x1, y1, x2, y2, size=10) {
    const ang = Math.atan2(y2-y1, x2-x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size*Math.cos(ang - Math.PI/7), y2 - size*Math.sin(ang - Math.PI/7));
    ctx.lineTo(x2 - size*Math.cos(ang + Math.PI/7), y2 - size*Math.sin(ang + Math.PI/7));
    ctx.closePath();
    ctx.fill();
  }

  function drawAxes(ox, oy, axisWidth, axisFontPx, tickFontPx, minorPx, xSmallPerUnit, ySmallPerUnit, zoom, typography) {
    const design = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState();
    if (design && !design.axesVisible) return;
    ctx.save();
    ctx.strokeStyle = design ? design.axisColor : "#000";
    ctx.fillStyle = design ? design.fontColor : "#000";
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = axisWidth;

    window.drawInfiniteAxes(ctx, cv, ox, oy, {
      color: design ? design.axisColor : "#000",
      fontColor: design ? design.fontColor : "#000",
      lineWidth: axisWidth,
      fontSize: axisFontPx,
      typography: typography
    });

    // ticks + numbers
    ctx.font = graphFont(tickFontPx, 12, typography);
    ctx.lineWidth = 1;

    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit;
    const sy = mp * ySmallPerUnit;

    const minXUnit = Math.ceil(-ox / sx);
    const maxXUnit = Math.floor((cv.width - ox) / sx);
    const minYUnit = Math.ceil((oy - cv.height) / sy);
    const maxYUnit = Math.floor(oy / sy);

    for (let i=minXUnit; i<=maxXUnit; i++) {
      const x = ox + i*sx;
      ctx.beginPath(); ctx.moveTo(x, oy-4); ctx.lineTo(x, oy+4); ctx.stroke();
      if (i!==0 && i%2===0) ctx.fillText(String(i), x-4, oy+16);
    }
    for (let j=minYUnit; j<=maxYUnit; j++) {
      const y = oy - j*sy;
      ctx.beginPath(); ctx.moveTo(ox-4, y); ctx.lineTo(ox+4, y); ctx.stroke();
      if (j!==0 && j%2===0) ctx.fillText(String(j), ox+8, y+4);
    }

    ctx.restore();
  }

  function drawCurveFromFunction(fnExpr, ox, oy, curveWidth, minorPx, xSmallPerUnit, ySmallPerUnit, zoom) {
    let f;
    try {
      f = compileMathExpression(fnExpr);
      $('functionError').style.display = "none";
    } catch (e) {
      $('functionError').textContent = "Function error: " + e.message;
      $('functionError').style.display = "block";
      return;
    }

    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit;
    const xMin = -(ox / sx);
    const xMax = (cv.width - ox) / sx;

    ctx.save();
    ctx.strokeStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";
    ctx.lineWidth = curveWidth;
    ctx.globalAlpha = 1;

    ctx.beginPath();
    let started = false;

    const steps = 1600;
    const step = (xMax - xMin) / steps;

    for (let x=xMin; x<=xMax; x += step) {
      const y = f(x);
      if (!Number.isFinite(y)) { started = false; continue; }
      const [px,py] = worldToCanvas(x,y,ox,oy,minorPx,xSmallPerUnit,ySmallPerUnit,zoom);
      if (!started) { ctx.moveTo(px,py); started = true; }
      else ctx.lineTo(px,py);
    }

    ctx.stroke();
    ctx.restore();
  }

  function compileMathExpression(source) {
    const text = String(source || "").replace(/\bMath\./g, "");
    const tokens = [];
    let position = 0;
    while (position < text.length) {
      if (/\s/.test(text[position])) { position++; continue; }
      const rest = text.slice(position);
      const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (number) {
        tokens.push({ type: "number", value: Number(number[0]) });
        position += number[0].length;
      } else if (identifier) {
        tokens.push({ type: "name", value: identifier[0].toLowerCase() });
        position += identifier[0].length;
      } else if (rest.startsWith("**")) {
        tokens.push({ type: "operator", value: "^" });
        position += 2;
      } else if ("+-*/%^(),".includes(text[position])) {
        tokens.push({ type: "operator", value: text[position++] });
      } else {
        throw new Error("Unsupported character at position " + (position + 1) + ".");
      }
    }
    if (!tokens.length) throw new Error("Enter a mathematical expression.");

    let cursor = 0;
    const peek = function () { return tokens[cursor]; };
    const take = function () { return tokens[cursor++]; };
    const expect = function (value) {
      if (!peek() || peek().value !== value) throw new Error("Expected '" + value + "'.");
      take();
    };
    const functions = {
      abs: Math.abs, acos: Math.acos, asin: Math.asin, atan: Math.atan,
      ceil: Math.ceil, cos: Math.cos, exp: Math.exp, floor: Math.floor,
      ln: Math.log, log: Math.log, log10: Math.log10, max: Math.max,
      min: Math.min, pow: Math.pow, round: Math.round, sin: Math.sin,
      sqrt: Math.sqrt, tan: Math.tan
    };

    function primary() {
      const token = take();
      if (!token) throw new Error("Expression ended unexpectedly.");
      if (token.type === "number") return function () { return token.value; };
      if (token.value === "(") {
        const inner = addition();
        expect(")");
        return inner;
      }
      if (token.type !== "name") throw new Error("Expected a number, x, constant, or math function.");
      if (token.value === "x") return function (x) { return x; };
      if (token.value === "pi") return function () { return Math.PI; };
      if (token.value === "e") return function () { return Math.E; };
      const mathFunction = functions[token.value];
      if (!mathFunction) throw new Error("Unknown name '" + token.value + "'.");
      expect("(");
      const args = [];
      if (!peek() || peek().value !== ")") {
        args.push(addition());
        while (peek() && peek().value === ",") {
          take();
          args.push(addition());
        }
      }
      expect(")");
      if (args.length === 0 || (["min", "max"].indexOf(token.value) === -1 && args.length !== 1 && token.value !== "pow") ||
          (token.value === "pow" && args.length !== 2)) {
        throw new Error("Invalid number of arguments for " + token.value + "().");
      }
      return function (x) { return mathFunction.apply(Math, args.map(function (arg) { return arg(x); })); };
    }

    function power() {
      const left = primary();
      if (peek() && peek().value === "^") {
        take();
        const right = unary();
        return function (x) { return Math.pow(left(x), right(x)); };
      }
      return left;
    }
    function unary() {
      if (peek() && (peek().value === "+" || peek().value === "-")) {
        const sign = take().value;
        const operand = unary();
        return function (x) { return sign === "-" ? -operand(x) : operand(x); };
      }
      return power();
    }
    function multiplication() {
      let left = unary();
      while (peek() && ["*", "/", "%"].indexOf(peek().value) !== -1) {
        const operator = take().value;
        const previous = left;
        const right = unary();
        left = function (x) {
          if (operator === "*") return previous(x) * right(x);
          if (operator === "/") return previous(x) / right(x);
          return previous(x) % right(x);
        };
      }
      return left;
    }
    function addition() {
      let left = multiplication();
      while (peek() && (peek().value === "+" || peek().value === "-")) {
        const operator = take().value;
        const previous = left;
        const right = multiplication();
        left = function (x) { return operator === "+" ? previous(x) + right(x) : previous(x) - right(x); };
      }
      return left;
    }

    const result = addition();
    if (cursor !== tokens.length) throw new Error("Unexpected token '" + tokens[cursor].value + "'.");
    return result;
  }

  function drawCurveFromPoints(points, ox, oy, curveWidth, minorPx, xSmallPerUnit, ySmallPerUnit, zoom) {
    if (points.length < 2) return;

    points = [...points].sort((a,b)=>a[0]-b[0]);
    const p = points.map(([x,y]) => worldToCanvas(x,y,ox,oy,minorPx,xSmallPerUnit,ySmallPerUnit,zoom));

    ctx.save();
    ctx.strokeStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";
    ctx.lineWidth = curveWidth;
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);

    for (let i=1; i<p.length-1; i++) {
      const midX = (p[i][0] + p[i+1][0]) / 2;
      const midY = (p[i][1] + p[i+1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0], p[i][1], midX, midY);
    }
    ctx.lineTo(p[p.length-1][0], p[p.length-1][1]);

    ctx.stroke();
    ctx.restore();
  }

  function fmt(n, decimals) {
    if (!Number.isFinite(n)) return String(n);
    const isInt = Math.abs(n - Math.round(n)) < 1e-12;
    if (isInt) return String(Math.round(n));
    return n.toFixed(decimals).replace(/0+$/,'').replace(/\.$/,'');
  }

  function drawPointsAndLabels(points, ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit, showPoints, showLabels, labelFontPx, decimals, zoom, typography) {
    pointHitBoxes = [];
    labelHitBoxes = [];

    ctx.save();
    ctx.fillStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().fontColor : "#000";
    ctx.font = graphFont(labelFontPx, 13, typography);

    for (let i=0; i<points.length; i++) {
      const [x,y] = points[i];
      const [px,py] = worldToCanvas(x,y,ox,oy,minorPx,xSmallPerUnit,ySmallPerUnit,zoom);

      // point hit circle
      pointHitBoxes.push({ i, cx:px, cy:py, r:8 });

      if (showPoints) {
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI*2);
        ctx.fill();
      }

      if (showLabels) {
        const off = labelOffsets[i] || {dx:6, dy:-6};
        const text = `(${fmt(x,decimals)}, ${fmt(y,decimals)})`;

        // measure text -> label hit box
        const w = ctx.measureText(text).width;
        const h = labelFontPx;

        const tx = px + off.dx;
        const ty = py + off.dy;

        // draw text (no background to keep textbook feel)
        ctx.fillText(text, tx, ty);

        labelHitBoxes.push({
          i,
          x: tx,
          y: ty - h,
          w: w,
          h: h + 4
        });
      }
    }

    ctx.restore();
  }

  function applyCanvasSize() {
    const s = parsePair($('csize').value);
    if (!s) return alert("Canvas size format: w,h  (e.g., 920,560)");
    const [w,h] = s;
    if (!(w>100 && h>100)) return alert("Canvas size too small.");
    if (!canvasView) {
      cv.width = Math.floor(w);
      cv.height = Math.floor(h);
    } else {
      canvasView.setLogicalSize(Math.floor(w), Math.floor(h));
    }
  }

  function hitTestPoint(mx,my){
    for (let k=pointHitBoxes.length-1; k>=0; k--){
      const b = pointHitBoxes[k];
      const dx = mx - b.cx, dy = my - b.cy;
      if (dx*dx + dy*dy <= b.r*b.r) return b.i;
    }
    return -1;
  }
  function hitTestLabel(mx,my){
    for (let k=labelHitBoxes.length-1; k>=0; k--){
      const b = labelHitBoxes[k];
      if (mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h) return b.i;
    }
    return -1;
  }

  function redraw() {
    applyCanvasSize();

    const origin = parsePair($('origin').value);
    if (!origin) return alert("Origin format: ox,oy (e.g., 480,300)");
    const [ox,oy] = origin;

    const minorPx = Number($('minorPx').value);
    const majorEvery = Number($('majorEvery').value);
    const xSmallPerUnit = sharedAxisRate("x", Number($('xSmallPerUnit').value));
    const ySmallPerUnit = sharedAxisRate("y", Number($('ySmallPerUnit').value));
    const decimals = Math.max(0, Math.min(10, Number($('decimals').value) || 2));
    const zoom = Number($('zoom').value);

    const axisWidth = 2;
    const curveWidth = Number($('curveWidth').value);
    const axisFontPx = Number($('axisFont').value);
    const tickFontPx = Number($('tickFont').value);
    const labelFontPx = Number($('labelFont').value);

    const mode = $('mode').value;
    const showPoints = $('showPoints').checked;
    const showLabels = $('showLabels').checked;

    if (!(minorPx>0 && majorEvery>=2 && xSmallPerUnit>0 && ySmallPerUnit>0)) {
      return alert("Check minorPx / majorEvery / xSmallPerUnit / ySmallPerUnit");
    }

    const points = parsePoints($('points').value);
    ensureLabelOffsets(points);

    clear();
    const typography = readTypography();
    window.drawGraphPaper(ctx, cv, ox, oy, minorPx, majorEvery, zoom);
    drawAxes(ox, oy, axisWidth, axisFontPx, tickFontPx, minorPx, xSmallPerUnit, ySmallPerUnit, zoom, typography);

    if (!clearRequested) {
      if (mode === "points") {
        drawCurveFromPoints(points, ox, oy, curveWidth, minorPx, xSmallPerUnit, ySmallPerUnit, zoom);
      } else {
        drawCurveFromFunction($('fn').value, ox, oy, curveWidth, minorPx, xSmallPerUnit, ySmallPerUnit, zoom);
      }
      drawPointsAndLabels(points, ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit, showPoints, showLabels, labelFontPx, decimals, zoom, typography);
    }
  }

  function downloadPNG() {
    redraw();
    const a = document.createElement('a');
    a.download = `graph-${isoStamp()}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  }

  function resetSample(){
    clearRequested = false;
    $('mode').value = "function";
    $('fn').value = "Math.pow(0.5, x)";
    $('points').value = `2,0.25
1,0.5
0,1
-1,2
-2,4
-3,8
-4,16
-5,32`;

    $('showPoints').checked = true;
    $('showLabels').checked = true;

    $('xSmallPerUnit').value = 5;
    $('ySmallPerUnit').value = 1;
    $('minorPx').value = 10;
    $('majorEvery').value = 5;
    $('decimals').value = 2;

    $('zoom').value = 1.0;
    $('curveWidth').value = 3;

    $('axisFont').value = 14;
    $('tickFont').value = 12;
    $('labelFont').value = 13;
    if (typographyControls) {
      typographyControls.sizeInput.value = String(graphTypography.defaultSizePt);
      typographyControls.boldInput.checked = false;
    }

    $('csize').value = "920,560";
    $('origin').value = "480,300";

    labelOffsets.length = 0;

    refreshValueLabels();
    redraw();
  }

  // ---------- Interactive Pan/Zoom/Drag ----------
  function updateOrigin(ox, oy){
    $('origin').value = `${Math.round(ox)},${Math.round(oy)}`;
  }

  listen(cv, "mousemove", (e) => {
    const {x:mx, y:my} = canvasXYFromEvent(e);

    if (drag.active){
      const dx = mx - drag.startMx;
      const dy = my - drag.startMy;

      if (drag.mode === "pan"){
        updateOrigin(drag.startOx + dx, drag.startOy + dy);
        redraw();
        setCanvasCursor("grabbing");
        return;
      }

      const points = parsePoints($('points').value);
      const origin = parsePair($('origin').value);
      if (!origin) return;
      const [ox,oy] = origin;

      const minorPx = Number($('minorPx').value);
      const xSmallPerUnit = sharedAxisRate("x", Number($('xSmallPerUnit').value));
      const ySmallPerUnit = sharedAxisRate("y", Number($('ySmallPerUnit').value));
      const zoom = Number($('zoom').value);

      if (drag.mode === "point"){
        // move point by cursor: convert mouse canvas -> world
        const [wx, wy] = canvasToWorld(mx, my, ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom);
        points[drag.pointIndex] = [wx, wy];
        $('points').value = stringifyPoints(points, Number($('decimals').value));
        redraw();
        setCanvasCursor("can-move-point");
        return;
      }

      if (drag.mode === "label"){
        labelOffsets[drag.pointIndex].dx = Math.round(drag.startDx + dx);
        labelOffsets[drag.pointIndex].dy = Math.round(drag.startDy + dy);
        redraw();
        setCanvasCursor("grabbing");
        return;
      }
    }

    // hover state
    const li = hitTestLabel(mx,my);
    const pi = hitTestPoint(mx,my);

    const mode = $('mode').value;
    if (li >= 0){
      setCanvasCursor("can-move-label");
      return;
    }
    if (pi >= 0 && mode === "points"){
      setCanvasCursor("can-move-point");
      return;
    }
    setCanvasCursor("can-grab");
  });

  listen(cv, "mousedown", (e) => {
    const {x:mx, y:my} = canvasXYFromEvent(e);

    const li = hitTestLabel(mx,my);
    if (li >= 0){
      drag.active = true;
      drag.mode = "label";
      drag.pointIndex = li;
      drag.startMx = mx;
      drag.startMy = my;
      drag.startDx = labelOffsets[li]?.dx ?? 6;
      drag.startDy = labelOffsets[li]?.dy ?? -6;
      setCanvasCursor("grabbing");
      return;
    }

    const pi = hitTestPoint(mx,my);
    if (pi >= 0 && $('mode').value === "points"){
      drag.active = true;
      drag.mode = "point";
      drag.pointIndex = pi;
      drag.startMx = mx;
      drag.startMy = my;
      setCanvasCursor("can-move-point");
      return;
    }

    // pan
    const origin = parsePair($('origin').value);
    if (!origin) return;
    drag.active = true;
    drag.mode = "pan";
    drag.startMx = mx;
    drag.startMy = my;
    drag.startOx = origin[0];
    drag.startOy = origin[1];
    setCanvasCursor("grabbing");
  });

  listen(window, "mouseup", () => {
    drag.active = false;
    drag.mode = null;
    drag.pointIndex = -1;
    setCanvasCursor("can-grab");
  });

  // wheel zoom (keeps origin visually stable)
  listen(cv, "wheel", (e) => {
    e.preventDefault();

    const z = Number($('zoom').value);
    const delta = (e.deltaY > 0) ? 0.92 : 1.08;
    let nz = z * delta;
    nz = Math.max(0.4, Math.min(3.0, nz));

    $('zoom').value = nz.toFixed(2);
    refreshValueLabels();
    redraw();
  }, { passive:false });

  // ---------- UI wiring ----------
  listen($('draw'), 'click', () => {
    clearRequested = false;
    redraw();
  });
  listen($('download'), 'click', downloadPNG);
  listen($('reset'), 'click', resetSample);
  listen($('clearGraph'), 'click', () => {
    clearRequested = true;
    $('functionError').style.display = "none";
    redraw();
  });

  ['mode','fn','points'].forEach(id => listen($(id), 'input', () => {
    clearRequested = false;
    redraw();
  }));
  ['showPoints','showLabels','xSmallPerUnit','ySmallPerUnit','minorPx','majorEvery','decimals','csize','origin']
    .forEach(id => listen($(id), 'input', redraw));

  ['zoom','curveWidth','axisFont','tickFont','labelFont'].forEach(id => {
    listen($(id), 'input', () => { refreshValueLabels(); redraw(); });
  });
  if (typographyControls) {
    listen(typographyControls.sizeInput, "input", redraw);
    listen(typographyControls.boldInput, "change", redraw);
  }

  refreshValueLabels();
  redraw();


  function captureState() {
    var controls = getToolControls('input, textarea, select').map(function (element) {
      return { id: element.id || '', type: element.type || element.tagName.toLowerCase(), value: element.value, checked: Boolean(element.checked) };
    });
    var tables = getToolControls('table[id]').map(function (table) {
      return { id: table.id, rows: Array.prototype.slice.call(table.tBodies[0] ? table.tBodies[0].rows : []).map(function (row) {
        return Array.prototype.slice.call(row.querySelectorAll('input')).map(function (input) { return input.value; });
      }) };
    });
    return { controls: controls, tables: tables };
  }

  function restoreState(saved) {
    if (!saved || !Array.isArray(saved.controls)) return;
    (saved.tables || []).forEach(function (tableState) {
      var grid = null;
      if (grid && tableState.id === '' && Array.isArray(tableState.rows)) {
        grid.textToTable(tableState.rows.map(function (row) { return row.join(','); }).join('\n'));
      }
    });
    var controls = getToolControls('input, textarea, select');
    saved.controls.forEach(function (item, index) {
      var element = item.id ? document.getElementById(item.id) : controls[index];
      if (!element || element.type === 'file') return;
      if (element.type === 'checkbox' || element.type === 'radio') element.checked = Boolean(item.checked);
      else element.value = item.value;
    });
    if (typeof refreshValueLabels === 'function') refreshValueLabels();
    if (typeof refreshVals === 'function') refreshVals();
    redraw();
  }

  function dispose() {
    while (cleanups.length) cleanups.pop()();
    var grid = null;
    if (grid && typeof grid.destroy === 'function') grid.destroy();
    if (canvasView && typeof canvasView.destroy === 'function') canvasView.destroy();
  }

  return {
    render: redraw,
    resize: function (width, height, dpr) {
      if (canvasView && typeof canvasView.resize === 'function') canvasView.resize(width, height, dpr);
      redraw();
    },
    reset: resetSample,
    export: function (format) {
      if (format && format !== 'png') return null;
      downloadPNG();
      return cv.toDataURL('image/png');
    },
    getState: captureState,
    setState: restoreState,
    unmount: dispose
  };
}

window.MathForgeEquationPlotter = { mount: mount };
if (!document.getElementById('mfWorkspace')) mount({ standalone: true, controlsRoot: document });
})(window, document);
