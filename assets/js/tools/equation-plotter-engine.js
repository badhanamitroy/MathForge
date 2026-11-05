(function (window, document) {
  "use strict";
/* Note: parsePair(), clamp() and isoStamp() now come from
   assets/js/common.js — the local copies that used to live here
   were removed so we don't shadow the shared versions. */
function mount(options) {
  options = options || {};
  if (options.workspace) return mountGeneralWorkspace(options);
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
      : `${controlSizePx}px "Times New Roman", "Noto Sans Bengali", serif`;
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

function mountGeneralWorkspace(options) {
  var canvasView = options.canvasView;
  var controlsRoot = options.controlsRoot;
  var cv = canvasView;
  var ctx = cv && cv.getContext("2d");
  var math = window.MathForgeEquationMath;
  var cleanups = [];
  var state = { equations: [], points: [], zoom: 1, panX: 0, panY: 0, lineWidth: 2.5, cleared: false };
  var compiled = Object.create(null);
  var lastErrors = Object.create(null);
  var pointHitBoxes = [];
  var sequence = 0;
  var eqPalette = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#4d7c0f"];
  var dragging = null;
  var hoveredPointId = null;
  var xRateFallback = 5, yRateFallback = 1;

  function listen(target, type, handler, listenerOptions) {
    if (!target) return;
    target.addEventListener(type, handler, listenerOptions);
    cleanups.push(function () { target.removeEventListener(type, handler, listenerOptions); });
  }
  function updateCanvasInteractionClasses() {
    if (!cv || !cv.classList) return;
    var isDragging = Boolean(dragging);
    cv.classList.toggle("mf-equation-point-interactive", true);
    cv.classList.toggle("mf-equation-point-hover", !isDragging && hoveredPointId !== null);
    cv.classList.toggle("mf-equation-canvas-dragging", isDragging);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function nextId(prefix) { sequence += 1; return prefix + "-" + Date.now().toString(36) + "-" + sequence.toString(36); }
  function color(index) { return eqPalette[index % eqPalette.length]; }
  function defaultState() {
    return { equations: [{ id: nextId("eq"), label: "Equation 1", expression: "y = 2x + 3", color: color(0), visible: true }],
      points: [], zoom: 1, panX: 0, panY: 0, lineWidth: 2.5, cleared: false };
  }
  function controlMarkup() {
    var html = '<section class="eq-general-panel" aria-label="Equation Plotter inputs">' +
      '<section class="eq-input-group"><h3>Equations <small>Angles use radians</small></h3><div class="eq-equation-list">';
    state.equations.forEach(function (equation, index) {
      html += '<article class="eq-equation-row" data-eq-row="' + escapeHtml(equation.id) + '">' +
        '<header><strong>Equation ' + (index + 1) + '</strong>' +
        '<label class="eq-visible"><input type="checkbox" data-eq-field="visible" data-eq-id="' + escapeHtml(equation.id) + '"' + (equation.visible ? " checked" : "") + '> Visible</label>' +
        '<input class="eq-color" type="color" aria-label="Equation ' + (index + 1) + ' colour" data-eq-field="color" data-eq-id="' + escapeHtml(equation.id) + '" value="' + escapeHtml(equation.color) + '">' +
        '<button type="button" class="eq-delete" data-eq-delete="' + escapeHtml(equation.id) + '" aria-label="Delete equation ' + (index + 1) + '">Delete</button></header>' +
        '<label>Name<input type="text" data-eq-field="label" data-eq-id="' + escapeHtml(equation.id) + '" value="' + escapeHtml(equation.label) + '"></label>' +
        '<label class="eq-expression-field">Expression<input class="eq-expression" type="text" spellcheck="false" autocomplete="off" data-eq-field="expression" data-eq-id="' + escapeHtml(equation.id) + '" value="' + escapeHtml(equation.expression) + '" placeholder="e.g. y = x^2 or x^2 + y^2 = 25"></label>' +
        '<div class="eq-row-error" data-eq-error="' + escapeHtml(equation.id) + '" role="alert"></div></article>';
    });
    html += '</div><div class="eq-actions"><button type="button" data-eq-action="add-equation">+ Add Equation</button>' +
      '<button class="primary" type="button" data-eq-action="plot">Plot / Update</button><button type="button" data-eq-action="clear-plot">Clear Graph</button></div>' +
      '<p class="eq-hint">Functions, conics and inequalities are inferred from the expression. Examples: <code>y = sin(x)</code>, <code>x^2 + y^2 = 25</code>, <code>y &gt; 2x + 1</code>.</p>' +
      '<div class="eq-feedback" data-eq-feedback role="status" aria-live="polite"></div></section>' +
      '<section class="eq-input-group"><h3>Points</h3><div class="eq-point-list">';
    state.points.forEach(function (point, index) {
      html += '<article class="eq-point-row" data-pt-row="' + escapeHtml(point.id) + '">' +
        '<strong>Point ' + (index + 1) + '</strong><label>Label<input type="text" data-pt-field="label" data-pt-id="' + escapeHtml(point.id) + '" value="' + escapeHtml(point.label) + '"></label>' +
        '<label>x<input type="number" step="any" data-pt-field="x" data-pt-id="' + escapeHtml(point.id) + '" value="' + escapeHtml(point.x) + '"></label>' +
        '<label>y<input type="number" step="any" data-pt-field="y" data-pt-id="' + escapeHtml(point.id) + '" value="' + escapeHtml(point.y) + '"></label>' +
        '<label class="eq-visible"><input type="checkbox" data-pt-field="visible" data-pt-id="' + escapeHtml(point.id) + '"' + (point.visible ? " checked" : "") + '> Visible</label>' +
        '<button type="button" class="eq-delete" data-pt-delete="' + escapeHtml(point.id) + '" aria-label="Delete point ' + (index + 1) + '">Delete</button>' +
        '<div class="eq-row-error" data-pt-error="' + escapeHtml(point.id) + '" role="alert"></div></article>';
    });
    html += '</div><button type="button" data-eq-action="add-point">+ Add Point</button></section>' +
      '<input id="zoom" type="range" min="0.4" max="3" step="0.05" value="' + state.zoom + '" hidden>' +
      '<input id="csize" value="920,690" hidden><input id="origin" value="460,345" hidden>' +
      '<button id="reset" type="button" hidden>Reset graph</button></section>';
    controlsRoot.innerHTML = html;
  }
  function oldValue(saved, id, fallback) {
    if (!saved || !Array.isArray(saved.controls)) return fallback;
    var found = saved.controls.find(function (control) { return control.id === id; });
    return found ? found.value : fallback;
  }
  function oldChecked(saved, id, fallback) {
    if (!saved || !Array.isArray(saved.controls)) return fallback;
    var found = saved.controls.find(function (control) { return control.id === id; });
    return found ? Boolean(found.checked) : fallback;
  }
  function restore(saved) {
    if (!saved || typeof saved !== "object") { state = defaultState(); }
    else if (Array.isArray(saved.equations)) {
      var seen = Object.create(null);
      state = {
        equations: saved.equations.map(function (item, index) {
          item = item || {}; var id = String(item.id || nextId("eq"));
          if (seen[id]) id = nextId("eq"); seen[id] = true;
          return { id: id, label: String(item.label == null ? "Equation " + (index + 1) : item.label), expression: String(item.expression == null ? "" : item.expression),
            color: /^#[0-9a-f]{6}$/i.test(String(item.color || "")) ? item.color : color(index), visible: item.visible !== false };
        }),
        points: Array.isArray(saved.points) ? saved.points.map(function (point, index) {
          point = point || {}; return { id: String(point.id || nextId("pt")), label: String(point.label == null ? String.fromCharCode(65 + index % 26) : point.label),
            x: String(point.x == null ? "" : point.x), y: String(point.y == null ? "" : point.y), visible: point.visible !== false };
        }) : [],
        zoom: bounded(saved.zoom, 1, 0.4, 3), panX: finiteOr(saved.panX, 0), panY: finiteOr(saved.panY, 0), lineWidth: bounded(saved.lineWidth, 2.5, 1, 8), cleared: Boolean(saved.cleared)
      };
    } else if (Array.isArray(saved.controls)) {
      var legacyFunction = String(oldValue(saved, "fn", "Math.pow(0.5, x)")).replace(/\bMath\./g, "");
      var legacyMode = oldValue(saved, "mode", "function");
      var equation = { id: nextId("eq"), label: "Equation 1", expression: "y = " + legacyFunction, color: color(0), visible: true };
      var legacyPoints = String(oldValue(saved, "points", "")).split(/\r?\n/).map(function (line, index) {
        var match = line.match(/^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*$/);
        return match ? { id: nextId("pt"), label: String.fromCharCode(65 + index % 26), x: match[1], y: match[2], visible: oldChecked(saved, "showPoints", true) } : null;
      }).filter(Boolean);
      if (legacyMode === "points" && !legacyFunction) equation.expression = "";
      state = { equations: [equation], points: legacyPoints, zoom: bounded(oldValue(saved, "zoom", 1), 1, 0.4, 3), panX: 0, panY: 0,
        lineWidth: bounded(oldValue(saved, "curveWidth", 2.5), 2.5, 1, 8), cleared: false };
      var oldCanvas = String(oldValue(saved, "csize", "920,690")).split(",").map(Number);
      var oldOrigin = String(oldValue(saved, "origin", "460,345")).split(",").map(Number);
      if (oldCanvas.length === 2 && oldOrigin.length === 2 && oldCanvas.every(Number.isFinite) && oldOrigin.every(Number.isFinite)) {
        state.panX = oldOrigin[0] - oldCanvas[0] / 2; state.panY = oldOrigin[1] - oldCanvas[1] / 2;
      }
    } else state = defaultState();
    compiled = Object.create(null);
    if (math) state.equations.forEach(function (equation) {
      if (!equation.expression.trim()) return;
      try { compiled[equation.id] = math.compile(equation.expression); } catch (ignore) {}
    });
  }
  function finiteOr(value, fallback) { var n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function bounded(value, fallback, minimum, maximum) { var n = Number(value); return Number.isFinite(n) ? Math.max(minimum, Math.min(maximum, n)) : fallback; }
  function getDesign() {
    return window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState() : {
      background: "#ffffff", gridVisible: true, gridSpacing: 10, majorEvery: 5, gridColor: "#000000", axesVisible: true, axisColor: "#000000",
      fontFamily: "Times New Roman", fontSizePt: 11, fontColor: "#111827", bold: false, axisScale: { x: { k: 5, n: 1 }, y: { k: 1, n: 1 } }
    };
  }
  function effectiveRate(axis) {
    return window.MathForgeGraphScale ? window.MathForgeGraphScale.effectiveRate(axis, axis === "x" ? xRateFallback : yRateFallback) : axis === "x" ? xRateFallback : yRateFallback;
  }
  function transform() {
    var design = getDesign();
    var minor = Math.max(1, Number(design.gridSpacing) || 10);
    var zoom = bounded(state.zoom, 1, 0.4, 3);
    return { ox: cv.width / 2 + state.panX, oy: cv.height / 2 + state.panY, minor: minor, zoom: zoom,
      sx: minor * zoom * effectiveRate("x"), sy: minor * zoom * effectiveRate("y") };
  }
  function worldToScreen(x, y, tr) { return [tr.ox + x * tr.sx, tr.oy - y * tr.sy]; }
  function screenToWorld(px, py, tr) { return [(px - tr.ox) / tr.sx, (tr.oy - py) / tr.sy]; }
  function drawPaper(targetCtx, targetCanvas, tr, forceWhite) {
    var design = getDesign(), width = targetCanvas.width, height = targetCanvas.height;
    targetCtx.save();
    targetCtx.fillStyle = forceWhite ? "#FFFFFF" : design.background || "#ffffff";
    targetCtx.fillRect(0, 0, width, height);
    if (design.gridVisible !== false) {
      var spacing = tr.minor * tr.zoom, major = Math.max(2, Math.floor(Number(design.majorEvery) || 5));
      targetCtx.strokeStyle = design.gridColor || "#000000";
      targetCtx.lineWidth = 1;
      targetCtx.globalAlpha = .14;
      targetCtx.beginPath();
      var startX = Math.ceil((0 - tr.ox) / spacing), endX = Math.floor((width - tr.ox) / spacing);
      var startY = Math.ceil((0 - tr.oy) / spacing), endY = Math.floor((height - tr.oy) / spacing);
      for (var ix = startX; ix <= endX; ix++) if (ix % major !== 0) { var gx = tr.ox + ix * spacing; targetCtx.moveTo(gx, 0); targetCtx.lineTo(gx, height); }
      for (var iy = startY; iy <= endY; iy++) if (iy % major !== 0) { var gy = tr.oy + iy * spacing; targetCtx.moveTo(0, gy); targetCtx.lineTo(width, gy); }
      targetCtx.stroke();
      targetCtx.globalAlpha = .38;
      targetCtx.lineWidth = 1.4;
      targetCtx.beginPath();
      for (ix = Math.ceil(startX / major) * major; ix <= endX; ix += major) { gx = tr.ox + ix * spacing; targetCtx.moveTo(gx, 0); targetCtx.lineTo(gx, height); }
      for (iy = Math.ceil(startY / major) * major; iy <= endY; iy += major) { gy = tr.oy + iy * spacing; targetCtx.moveTo(0, gy); targetCtx.lineTo(width, gy); }
      targetCtx.stroke();
    }
    targetCtx.restore();
  }
  function drawAxes(targetCtx, targetCanvas, tr) {
    var design = getDesign();
    if (design.axesVisible === false || !window.drawInfiniteAxes) return;
    targetCtx.save();
    targetCtx.strokeStyle = design.axisColor || "#000000";
    targetCtx.fillStyle = design.fontColor || "#000000";
    targetCtx.lineWidth = 2;
    window.drawInfiniteAxes(targetCtx, targetCanvas, tr.ox, tr.oy, { color: design.axisColor || "#000000", fontColor: design.fontColor || "#000000", lineWidth: 2,
      fontSize: 14, typography: { fontFamily: design.fontFamily, fontSizePt: design.fontSizePt, bold: design.bold } });
    targetCtx.restore();
  }
  function strokeSegment(targetCtx, a, b) { targetCtx.moveTo(a[0], a[1]); targetCtx.lineTo(b[0], b[1]); }
  function drawExplicit(targetCtx, targetCanvas, equation, program, tr) {
    var inverse = program.kind === "explicit-x" || program.kind === "explicit-x-reversed";
    var reversed = program.kind === "explicit-y-reversed" || program.kind === "explicit-x-reversed";
    var span = inverse ? targetCanvas.height : targetCanvas.width;
    var visibleCount = Math.max(1, state.equations.filter(function (item) { return item.visible; }).length);
    var samples = Math.min(Math.max(500, Math.floor(180000 / visibleCount)), Math.max(400, Math.floor(span * 1.6)));
    targetCtx.save(); targetCtx.beginPath(); targetCtx.rect(0, 0, targetCanvas.width, targetCanvas.height); targetCtx.clip();
    targetCtx.beginPath(); targetCtx.strokeStyle = equation.color; targetCtx.lineWidth = state.lineWidth; targetCtx.globalAlpha = 1;
    var started = false, prev = null;
    for (var i = 0; i <= samples; i++) {
      var pixel = i / samples * span;
      var input = inverse ? (tr.oy - pixel) / tr.sy : (pixel - tr.ox) / tr.sx;
      var output = inverse
        ? (reversed ? program.evaluateLeft(0, input) : program.evaluateRight(0, input))
        : (reversed ? program.evaluateLeft(input, 0) : program.evaluateRight(input, 0));
      var point = inverse ? worldToScreen(output, input, tr) : worldToScreen(input, output, tr);
      if (!Number.isFinite(output) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || (prev && Math.abs(point[1] - prev[1]) > targetCanvas.height * 0.7)) {
        started = false; prev = null; continue;
      }
      if (!started) { targetCtx.moveTo(point[0], point[1]); started = true; } else targetCtx.lineTo(point[0], point[1]);
      prev = point;
    }
    targetCtx.stroke(); targetCtx.restore();
  }
  function implicitGridSize(targetCanvas) {
    var visibleCount = Math.max(1, state.equations.filter(function (item) { return item.visible; }).length);
    var budget = Math.max(900, Math.floor(90000 / visibleCount));
    var aspect = targetCanvas.width / Math.max(1, targetCanvas.height);
    var cols = Math.max(40, Math.min(240, Math.floor(Math.sqrt(budget * aspect))));
    return { cols: cols, rows: Math.max(32, Math.min(220, Math.floor(budget / cols))) };
  }
  function contour(targetCtx, targetCanvas, program, tr, colorValue, dashed) {
    var size = implicitGridSize(targetCanvas), cols = size.cols, rows = size.rows;
    var dx = targetCanvas.width / cols, dy = targetCanvas.height / rows;
    var values = new Float64Array((cols + 1) * (rows + 1));
    function valueAt(ix, iy) {
      var px = ix * dx, py = iy * dy, world = screenToWorld(px, py, tr);
      return program.evaluate(world[0], world[1]);
    }
    for (var y = 0; y <= rows; y++) for (var x = 0; x <= cols; x++) values[y * (cols + 1) + x] = valueAt(x, y);
    targetCtx.save(); targetCtx.beginPath(); targetCtx.rect(0, 0, targetCanvas.width, targetCanvas.height); targetCtx.clip();
    targetCtx.beginPath(); targetCtx.strokeStyle = colorValue; targetCtx.lineWidth = state.lineWidth;
    targetCtx.setLineDash(dashed ? [7, 5] : []);
    function interpolate(x1, y1, v1, x2, y2, v2) {
      var t = v1 === v2 ? .5 : v1 / (v1 - v2); t = Math.max(0, Math.min(1, t)); return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    }
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      var x0 = x * dx, y0 = y * dy, x1 = x0 + dx, y1 = y0 + dy;
      var v0 = values[y * (cols + 1) + x], v1 = values[y * (cols + 1) + x + 1];
      var v2 = values[(y + 1) * (cols + 1) + x + 1], v3 = values[(y + 1) * (cols + 1) + x];
      if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
      var edges = [];
      if ((v0 < 0) !== (v1 < 0)) edges.push(interpolate(x0, y0, v0, x1, y0, v1));
      if ((v1 < 0) !== (v2 < 0)) edges.push(interpolate(x1, y0, v1, x1, y1, v2));
      if ((v2 < 0) !== (v3 < 0)) edges.push(interpolate(x1, y1, v2, x0, y1, v3));
      if ((v3 < 0) !== (v0 < 0)) edges.push(interpolate(x0, y1, v3, x0, y0, v0));
      if (edges.length === 2) strokeSegment(targetCtx, edges[0], edges[1]);
      else if (edges.length === 4) {
        var centerWorld = screenToWorld((x0 + x1) / 2, (y0 + y1) / 2, tr);
        var centerNegative = program.evaluate(centerWorld[0], centerWorld[1]) < 0;
        if ((v0 < 0) === centerNegative) { strokeSegment(targetCtx, edges[0], edges[1]); strokeSegment(targetCtx, edges[2], edges[3]); }
        else { strokeSegment(targetCtx, edges[0], edges[3]); strokeSegment(targetCtx, edges[1], edges[2]); }
      }
    }
    targetCtx.stroke(); targetCtx.restore();
  }
  function shadeInequality(targetCtx, targetCanvas, program, tr, colorValue) {
    var size = implicitGridSize(targetCanvas), cols = size.cols, rows = size.rows;
    var dx = targetCanvas.width / cols, dy = targetCanvas.height / rows;
    targetCtx.save(); targetCtx.beginPath(); targetCtx.rect(0, 0, targetCanvas.width, targetCanvas.height); targetCtx.clip();
    targetCtx.fillStyle = colorValue; targetCtx.globalAlpha = .18;
    for (var row = 0; row < rows; row++) {
      var run = -1;
      for (var col = 0; col <= cols; col++) {
        var inside = false;
        if (col < cols) {
          var world = screenToWorld((col + .5) * dx, (row + .5) * dy, tr);
          try { inside = program.test(world[0], world[1]); } catch (ignore) { inside = false; }
        }
        if (inside && run < 0) run = col;
        if (!inside && run >= 0) { targetCtx.fillRect(run * dx, row * dy, (col - run) * dx + .25, dy + .25); run = -1; }
      }
    }
    targetCtx.restore();
  }
  function drawEquation(targetCtx, targetCanvas, equation, program, tr) {
    if (program.operator !== "=") shadeInequality(targetCtx, targetCanvas, program, tr, equation.color);
    if (program.kind === "explicit-y" || program.kind === "explicit-y-reversed" || program.kind === "explicit-x" || program.kind === "explicit-x-reversed") drawExplicit(targetCtx, targetCanvas, equation, program, tr);
    else contour(targetCtx, targetCanvas, program, tr, equation.color, program.operator === "<" || program.operator === ">");
  }
  function drawPoints(targetCtx, targetCanvas, tr, interactive) {
    pointHitBoxes = [];
    var placedLabels = [];
    var design = getDesign();
    targetCtx.save();
    var fontStack = window.MathForgeGraphTypography && window.MathForgeGraphTypography.familyStack
      ? window.MathForgeGraphTypography.familyStack(design.fontFamily)
      : '"Times New Roman", "Noto Sans Bengali", serif';
    targetCtx.font = (Number(design.fontSizePt) || 11) * 1.333 + "px " + fontStack;
    targetCtx.fillStyle = design.fontColor || "#111827";
    state.points.forEach(function (point) {
      if (!point.visible) return;
      var x = Number(point.x), y = Number(point.y);
      if (String(point.x).trim() === "" || String(point.y).trim() === "" || !Number.isFinite(x) || !Number.isFinite(y)) return;
      var xy = worldToScreen(x, y, tr);
      if (xy[0] < -8 || xy[0] > targetCanvas.width + 8 || xy[1] < -8 || xy[1] > targetCanvas.height + 8) return;
      pointHitBoxes.push({ id: point.id, x: xy[0], y: xy[1] });
      var active = interactive && dragging && dragging.mode === "point" && dragging.id === point.id;
      var hovered = interactive && !dragging && hoveredPointId === point.id;
      targetCtx.beginPath(); targetCtx.fillStyle = active ? "#1d4ed8" : "#2563eb"; targetCtx.arc(xy[0], xy[1], active ? 6.5 : hovered ? 5.5 : 4.5, 0, Math.PI * 2); targetCtx.fill();
      if (active || hovered) {
        targetCtx.beginPath(); targetCtx.strokeStyle = active ? "#f59e0b" : "#60a5fa"; targetCtx.lineWidth = active ? 2.5 : 2; targetCtx.arc(xy[0], xy[1], active ? 9 : 8, 0, Math.PI * 2); targetCtx.stroke();
      }
      targetCtx.fillStyle = design.fontColor || "#111827";
      var label = String(point.label || "") + " (" + x + ", " + y + ")";
      var labelWidth = targetCtx.measureText ? targetCtx.measureText(label).width : label.length * 7;
      var height = Math.max(12, (Number(design.fontSizePt) || 11) * 1.5);
      var choices = [[8, -8], [8, height + 2], [-labelWidth - 8, -8], [-labelWidth - 8, height + 2], [10, -height - 5]];
      var chosen = choices[0];
      for (var c = 0; c < choices.length; c++) {
        var candidate = { left: xy[0] + choices[c][0], top: xy[1] + choices[c][1] - height, right: xy[0] + choices[c][0] + labelWidth, bottom: xy[1] + choices[c][1] + 3 };
        var overlaps = placedLabels.some(function (placed) { return candidate.left < placed.right && candidate.right > placed.left && candidate.top < placed.bottom && candidate.bottom > placed.top; });
        if (!overlaps) { chosen = choices[c]; break; }
      }
      targetCtx.fillText(label, xy[0] + chosen[0], xy[1] + chosen[1]);
      placedLabels.push({ left: xy[0] + chosen[0], top: xy[1] + chosen[1] - height, right: xy[0] + chosen[0] + labelWidth, bottom: xy[1] + chosen[1] + 3 });
    });
    targetCtx.restore();
  }
  function renderInto(targetCtx, targetCanvas, forceWhite, interactive) {
    var tr = transform();
    drawPaper(targetCtx, targetCanvas, tr, forceWhite);
    drawAxes(targetCtx, targetCanvas, tr);
    if (state.cleared) pointHitBoxes = [];
    else {
      state.equations.forEach(function (equation) {
        if (!equation.visible || !compiled[equation.id]) return;
        drawEquation(targetCtx, targetCanvas, equation, compiled[equation.id], tr);
      });
      drawPoints(targetCtx, targetCanvas, tr, interactive === true);
    }
  }
  function showErrors(errors) {
    state.equations.forEach(function (equation) {
      var message = errors[equation.id] || "";
      var element = controlsRoot.querySelector('[data-eq-error="' + equation.id + '"]');
      if (element) element.textContent = message;
    });
    var feedback = controlsRoot.querySelector("[data-eq-feedback]");
    if (feedback) feedback.textContent = Object.keys(errors).length ? "Check the equation errors above. Valid equations and points remain available." : "Graph updated. Trigonometric functions use radians.";
  }
  function plot() {
    var nextCompiled = Object.create(null), errors = Object.create(null);
    state.equations.forEach(function (equation) {
      if (!equation.visible) return;
      if (!equation.expression.trim()) { errors[equation.id] = "Enter an equation or hide/remove this row."; return; }
      try { nextCompiled[equation.id] = math.compile(equation.expression); }
      catch (error) { errors[equation.id] = error.message; }
    });
    compiled = nextCompiled;
    lastErrors = errors;
    showErrors(errors);
    render();
  }
  function render() {
    if (!ctx || !cv) return;
    state.points.forEach(function (point) {
      var error = "";
      if (String(point.x).trim() === "" || String(point.y).trim() === "") error = "Enter both coordinates.";
      else if (!Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) error = "Coordinates must be finite numbers.";
      var errorNode = controlsRoot.querySelector('[data-pt-error="' + point.id + '"]');
      if (errorNode) errorNode.textContent = error;
    });
    var zoomInput = document.getElementById("zoom");
    if (zoomInput && document.activeElement !== zoomInput) zoomInput.value = String(state.zoom);
    renderInto(ctx, cv, false, true);
  }
  function findById(items, id) { return items.find(function (item) { return item.id === id; }); }
  function syncPointFields(point) {
    if (!controlsRoot || typeof controlsRoot.querySelectorAll !== "function") return;
    Array.prototype.forEach.call(controlsRoot.querySelectorAll("[data-pt-id]"), function (field) {
      if (field.getAttribute("data-pt-id") !== point.id) return;
      var key = field.getAttribute("data-pt-field");
      if (key === "x" || key === "y") field.value = point[key];
    });
  }
  function handleField(event) {
    var target = event.target;
    var equationField = target.closest && target.closest("[data-eq-field]");
    if (equationField) {
      var equation = findById(state.equations, equationField.getAttribute("data-eq-id"));
      if (!equation) return;
      var key = equationField.getAttribute("data-eq-field");
      equation[key] = key === "visible" ? Boolean(equationField.checked) : equationField.value;
      if (key === "visible") { state.cleared = false; plot(); }
      else if (key === "color") render();
      else {
        var errorNode = controlsRoot.querySelector('[data-eq-error="' + equation.id + '"]');
        if (errorNode) errorNode.textContent = "";
        if (key === "expression") {
          var feedback = controlsRoot.querySelector("[data-eq-feedback]");
          if (feedback) feedback.textContent = "Equation edited. Select Plot / Update to redraw it.";
        }
      }
      return;
    }
    var pointField = target.closest && target.closest("[data-pt-field]");
    if (pointField) {
      var point = findById(state.points, pointField.getAttribute("data-pt-id"));
      if (!point) return;
      var field = pointField.getAttribute("data-pt-field");
      point[field] = field === "visible" ? Boolean(pointField.checked) : pointField.value;
      if (field === "visible" || field === "x" || field === "y" || field === "label") { state.cleared = false; render(); }
      return;
    }
    if (target && target.id === "zoom") { state.zoom = bounded(target.value, 1, .4, 3); render(); }
  }
  function handleAction(event) {
    var target = event.target, action = target.closest && target.closest("[data-eq-action]");
    if (action) {
      var name = action.getAttribute("data-eq-action");
      if (name === "clear-plot") { state.cleared = true; render(); return; }
      if (name === "plot") { state.cleared = false; plot(); return; }
      if (name === "add-equation") state.equations.push({ id: nextId("eq"), label: "Equation " + (state.equations.length + 1), expression: "", color: color(state.equations.length), visible: true });
      if (name === "add-point") state.points.push({ id: nextId("pt"), label: String.fromCharCode(65 + state.points.length % 26), x: "0", y: "0", visible: true });
      controlMarkup(); render(); return;
    }
    var equationDelete = target.closest && target.closest("[data-eq-delete]");
    if (equationDelete) {
      var id = equationDelete.getAttribute("data-eq-delete"); state.equations = state.equations.filter(function (item) { return item.id !== id; });
      delete compiled[id]; state.cleared = false; controlMarkup(); plot(); return;
    }
    var pointDelete = target.closest && target.closest("[data-pt-delete]");
    if (pointDelete) { var pointId = pointDelete.getAttribute("data-pt-delete"); state.points = state.points.filter(function (item) { return item.id !== pointId; }); controlMarkup(); render(); }
  }
  function eventPoint(event) {
    var rect = cv.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return { x: 0, y: 0, inside: false };
    return { x: (event.clientX - rect.left) * (cv.width / rect.width), y: (event.clientY - rect.top) * (cv.height / rect.height) };
  }
  function findPointAt(position) {
    var rect = cv.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0) || position.x < 0 || position.y < 0 || position.x > cv.width || position.y > cv.height) return null;
    var scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
    var nearest = null, distance = 14;
    pointHitBoxes.forEach(function (box) {
      var d = Math.hypot((box.x - position.x) / scaleX, (box.y - position.y) / scaleY);
      if (d <= distance) { nearest = box; distance = d; }
    });
    return nearest;
  }
  function pointerDown(event) {
    if (dragging || event.isPrimary === false || (event.button != null && event.button !== 0)) return;
    var position = eventPoint(event), nearest = findPointAt(position);
    dragging = nearest ? { mode: "point", id: nearest.id, pointerId: event.pointerId } :
      { mode: "pan", pointerId: event.pointerId, x: position.x, y: position.y };
    hoveredPointId = nearest ? nearest.id : null;
    updateCanvasInteractionClasses();
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (event.pointerId != null && typeof cv.setPointerCapture === "function") {
      try { cv.setPointerCapture(event.pointerId); } catch (ignore) {}
    }
    render();
  }
  function pointerMove(event) {
    if (!dragging) {
      var hover = event.pointerType === "touch" ? null : findPointAt(eventPoint(event));
      var nextHoveredId = hover ? hover.id : null;
      if (hoveredPointId !== nextHoveredId) {
        hoveredPointId = nextHoveredId;
        updateCanvasInteractionClasses();
        render();
      }
      return;
    }
    if (dragging.pointerId != null && event.pointerId != null && dragging.pointerId !== event.pointerId) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    var position = eventPoint(event), deltaX = position.x - dragging.x, deltaY = position.y - dragging.y;
    if (dragging.mode === "pan") { state.panX += deltaX; state.panY += deltaY; dragging.x = position.x; dragging.y = position.y; }
    else {
      var tr = transform(), point = findById(state.points, dragging.id);
      if (point) {
        var world = screenToWorld(position.x, position.y, tr);
        point.x = String(Number(world[0].toFixed(5))); point.y = String(Number(world[1].toFixed(5)));
        syncPointFields(point);
      }
    }
    render();
  }
  function finishPointer(event) {
    if (!dragging) return;
    if (event && dragging.pointerId != null && event.pointerId != null && dragging.pointerId !== event.pointerId) return;
    var wasPoint = dragging.mode === "point";
    var pointerId = dragging.pointerId;
    dragging = null;
    if (pointerId != null && typeof cv.releasePointerCapture === "function") {
      try {
        if (typeof cv.hasPointerCapture !== "function" || cv.hasPointerCapture(pointerId)) cv.releasePointerCapture(pointerId);
      } catch (ignore) {}
    }
    hoveredPointId = null;
    updateCanvasInteractionClasses();
    if (wasPoint) controlMarkup();
    render();
  }
  function wheel(event) {
    event.preventDefault();
    var position = eventPoint(event), before = screenToWorld(position.x, position.y, transform());
    state.zoom = bounded(state.zoom * (event.deltaY > 0 ? .9 : 1.1), state.zoom, .4, 3);
    var tr = transform();
    state.panX = position.x - cv.width / 2 - before[0] * tr.sx;
    state.panY = position.y - cv.height / 2 + before[1] * tr.sy;
    render();
  }
  function fitView() { state.zoom = 1; state.panX = 0; state.panY = 0; render(); }
  function currentState() { return JSON.parse(JSON.stringify(state)); }
  function setState(saved) { restore(saved); controlMarkup(); plot(); }
  function reset() { restore(null); controlMarkup(); plot(); fitView(); }
  function exportGraph(format) {
    if (lastErrors && Object.keys(lastErrors).length) throw new Error("Fix invalid equations before exporting.");
    var stale = state.equations.some(function (equation) {
      return equation.visible && equation.expression.trim() && (!compiled[equation.id] || compiled[equation.id].source !== equation.expression.trim());
    });
    if (stale) throw new Error("Select Plot / Update before exporting edited equations.");
    render();
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, cv.width); canvas.height = Math.max(1, cv.height);
    var exportContext = canvas.getContext("2d");
    renderInto(exportContext, canvas, true, false);
    var pngUrl = canvas.toDataURL("image/png");
    if (format === "png") return pngUrl;
    if (format !== "svg") throw new Error("Choose PNG or SVG.");
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + canvas.width + " " + canvas.height + '"><rect width="100%" height="100%" fill="#FFFFFF"/><image x="0" y="0" width="' + canvas.width + '" height="' + canvas.height + '" href="' + pngUrl + '"/></svg>';
    return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  }
  if (!math) throw new Error("The safe Equation Plotter parser was not loaded.");
  state = defaultState();
  controlMarkup();
  listen(controlsRoot, "input", handleField);
  listen(controlsRoot, "change", handleField);
  listen(controlsRoot, "click", handleAction);
  if (typeof window.PointerEvent === "function") {
    listen(cv, "pointerdown", pointerDown, { passive: false });
    listen(window, "pointermove", pointerMove, { passive: false });
    listen(window, "pointerup", finishPointer);
    listen(window, "pointercancel", finishPointer);
    listen(cv, "lostpointercapture", finishPointer);
  } else {
    listen(cv, "mousedown", pointerDown);
    listen(window, "mousemove", pointerMove);
    listen(window, "mouseup", finishPointer);
  }
  listen(window, "blur", finishPointer);
  listen(cv, "wheel", wheel, { passive: false });
  listen(document, "mf:graph-design-changed", render);
  updateCanvasInteractionClasses();
  var instance = { render: render, resize: function (width, height, dpr) { if (canvasView.resize) canvasView.resize(width, height, dpr); render(); },
    reset: reset, fitView: fitView, export: exportGraph, getState: currentState, setState: setState,
    unmount: function () {
      if (dragging && dragging.pointerId != null && typeof cv.releasePointerCapture === "function") {
        try {
          if (typeof cv.hasPointerCapture !== "function" || cv.hasPointerCapture(dragging.pointerId)) cv.releasePointerCapture(dragging.pointerId);
        } catch (ignore) {}
      }
      dragging = null; hoveredPointId = null; updateCanvasInteractionClasses();
      while (cleanups.length) cleanups.pop()();
      if (cv && cv.classList) cv.classList.remove("mf-equation-point-interactive", "mf-equation-point-hover", "mf-equation-canvas-dragging");
      if (controlsRoot) controlsRoot.innerHTML = "";
    } };
  plot();
  return instance;
}

window.MathForgeEquationPlotter = { mount: mount };
if (!document.getElementById('mfWorkspace')) mount({ standalone: true, controlsRoot: document });
})(window, document);
