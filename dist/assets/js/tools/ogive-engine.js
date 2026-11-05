(function (window, document) {
  "use strict";
/* ============================
   Ogive App
   (makeTableGrid, worldToCanvas/canvasToWorld, drawGraphPaper,
   arrowhead, drawAxes, drawAxisBreakGlyph, drawYAxisLabels,
   drawXBoundaryLabels, drawAxisAnnotations, parsePair, clamp,
   isoStamp all now come from assets/js/common.js)
============================ */
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

  const $ = (id) => document.getElementById(id);
  const graphTypography = window.MathForgeGraphTypography;
  const typographyControls = graphTypography && graphTypography.ensureControls(controlRoot, "ogive");

  function readTypography() {
    return typographyControls ? graphTypography.read(typographyControls.sizeInput, typographyControls.boldInput, typographyControls.familyInput, typographyControls.colorInput) : { fontSizePt: 11, bold: false };
  }

  function sharedAxisRate(axis, fallback) {
    return window.MathForgeGraphScale
      ? window.MathForgeGraphScale.effectiveRate(axis, fallback)
      : Number(fallback);
  }

  function graphFont(sizePx, typography) {
    return graphTypography ? graphTypography.font(sizePx, typography) : `${sizePx}px "Times New Roman", "Kalpurush", serif`;
  }
  var oGrid = makeTableGrid({
    tableId:"o_table",
    textareaId:"o_data",
    addBtnId:"o_addRow",
    delBtnId:"o_delRow",
    useBtnId:"o_useTable",
    columnsCount: 3
  });

  listen($('o_useTable'), "click", function (event) {
    if ($('o_inputMode').value !== "frequency") return;
    event.stopImmediatePropagation();
    const errorEl = $('o_tableError');
    try {
      let total = 0;
      const converted = oGrid.tableToText().split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
        const parts = line.split(",").map(value => value.trim());
        const lo = Number(parts[0]), hi = Number(parts[1]), frequency = Number(parts[2]);
        if (parts.length !== 3 || !Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(frequency) || hi <= lo || frequency < 0) {
          throw new Error("Row " + (index + 1) + " needs valid boundaries and a non-negative frequency.");
        }
        total += frequency;
        return [lo, hi, total].join(",");
      });
      if (!converted.length) throw new Error("Enter at least one frequency row.");
      $('o_data').value = converted.join("\n");
      $('o_data').dispatchEvent(new Event("input", { bubbles: true }));
      errorEl.style.display = "none";
      errorEl.textContent = "";
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = "block";
    }
  }, true);

  const cv = canvasView || document.getElementById("o_cv");
  const ctx = cv.getContext('2d');

  function setVal(spanId, inputId){
    const s = $(spanId), i = $(inputId);
    if(s && i) s.textContent = i.value;
  }

  function refreshVals(){
    setVal('o_zoomVal','o_zoom');
    setVal('o_fontAxisVal','o_fontAxis');
    setVal('o_fontTicksVal','o_fontTicks');
    setVal('o_fontPointVal','o_fontPoint');
    setVal('o_fontAxisLabelVal','o_fontAxisLabel');
  }

  function parseData(text){
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const rows = [];
    for(const line of lines){
      const parts = line.split(',').map(s => s.trim());
      if(parts.length < 3) throw new Error("Bad line: " + line);
      const lo = Number(parts[0]), hi = Number(parts[1]), cf = Number(parts[2]);
      if(!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(cf)) throw new Error("Bad numbers: " + line);
      if(hi <= lo) throw new Error("Upper boundary must be > lower boundary: " + line);
      rows.push({lo, hi, cf});
    }
    rows.sort((a,b)=>a.lo-b.lo);
    for(let i=1;i<rows.length;i++){
      if(rows[i].cf < rows[i-1].cf) throw new Error("Cumulative frequency must be nondecreasing (line " + (i+1) + ")");
    }
    return rows;
  }

  function applyCanvasSize(){
    const s = parsePair($('o_csize').value);
    if(!s) throw new Error("Canvas size format: w,h");
    const [w,h] = s;
    if (!canvasView) {
      cv.width = Math.floor(w);
      cv.height = Math.floor(h);
    } else {
      canvasView.setLogicalSize(Math.floor(w), Math.floor(h));
    }
  }

  function readFonts(){
    const typography = readTypography();
    return {
      axis: graphTypography.scaledSizePx(Number($('o_fontAxis')?.value ?? 16), 16, typography),
      ticks: graphTypography.scaledSizePx(Number($('o_fontTicks')?.value ?? 14), 14, typography),
      point: graphTypography.scaledSizePx(Number($('o_fontPoint')?.value ?? 12), 12, typography),
      typography: typography,
    };
  }

  function readAnnotation(){
    return {
      show: $('o_showAxisLabels')?.checked,
      xText: $('o_xLabelText')?.value ?? "",
      yText: $('o_yLabelText')?.value ?? "",
      addArrows: $('o_axisLabelArrows')?.checked,
      xOffset: $('o_xLabelOffset')?.value,
      yOffset: $('o_yLabelOffset')?.value,
      fontSize: graphTypography.scaledSizePx(Number($('o_fontAxisLabel')?.value ?? 18), 18, readTypography()),
      typography: readTypography(),
    };
  }

  function computeBounds(rows){
    const minX = Math.min(...rows.map(r => r.lo));
    const maxX = Math.max(...rows.map(r => r.hi));
    const maxY = Math.max(...rows.map(r => r.cf), 1);
    return {minX,maxX,maxY};
  }

  function buildOgivePoints(rows){
    const minLo = rows[0].lo;
    const pts = [{x: minLo, y: 0, kind:"start", rowIndex:-1}];
    for(let i=0;i<rows.length;i++){
      const r = rows[i];
      pts.push({x: r.hi, y: r.cf, kind:"data", rowIndex:i});
    }
    return pts;
  }

  let pointHit = []; // {rowIndex, cx, cy, r}
  const dragState = {active:false, mode:null, rowIndex:-1, startOx:0, startOy:0, startMx:0, startMy:0};

  function drawOgiveCurve(points, params, fonts){
    pointHit = [];
    const w = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineWidth : Math.max(1, Number($('o_curveW')?.value ?? 4));

    ctx.save();
    ctx.strokeStyle=window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";
    ctx.lineWidth=w;
    ctx.lineJoin="round";
    ctx.lineCap="round";
    ctx.globalAlpha=1;

    ctx.beginPath();
    let [x0,y0] = worldToCanvas(points[0].x, points[0].y, params);
    ctx.moveTo(x0,y0);
    for(let i=1;i<points.length;i++){
      const [px,py] = worldToCanvas(points[i].x, points[i].y, params);
      ctx.lineTo(px,py);
    }
    ctx.stroke();

    if($('o_showDots')?.checked){
      ctx.fillStyle=window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().fontColor : "#000";
      for(const p of points){
        const [px,py] = worldToCanvas(p.x,p.y, params);
        const r = 5;
        ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
        if(p.kind === "data") pointHit.push({rowIndex:p.rowIndex, cx:px, cy:py, r:10});
      }
    }

    if($('o_showPointLabels')?.checked){
      ctx.fillStyle=window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().fontColor : "#000";
      ctx.font = graphFont(fonts.point, fonts.typography);
      ctx.textAlign="left";
      ctx.textBaseline="bottom";
      for(const p of points){
        const [px,py] = worldToCanvas(p.x,p.y, params);
        ctx.fillText(`(${p.x}, ${p.y})`, px+8, py-8);
      }
    }

    ctx.restore();
  }

  function fitToData(){
    const rows = parseData($('o_data').value);
    applyCanvasSize();

    const minorPx = Number($('o_minorPx').value);
    const majorEvery = Number($('o_majorEvery').value);
    const xSmallPerUnit = sharedAxisRate("x", Number($('o_xSmallPerUnit').value));
    const ySmallPerUnit = sharedAxisRate("y", Number($('o_ySmallPerUnit').value));

    const {minX,maxX,maxY} = computeBounds(rows);

    const pad = 70;
    const baseSx = minorPx * xSmallPerUnit;
    const baseSy = minorPx * ySmallPerUnit;
    const breakGapBasePx = minX > 0 ? majorEvery * minorPx : 0;

    const needZx = (cv.width - 2*pad) / ((maxX - minX) * baseSx + breakGapBasePx);
    const needZy = (cv.height - 2*pad) / ((maxY - 0) * baseSy);
    let z = Math.min(needZx, needZy);
    z = Math.max(0.35, Math.min(4.0, z));
    $('o_zoom').value = (Math.floor(z*100)/100).toFixed(2);

    const oy = cv.height - pad;
    const ox = pad;

    $('o_origin').value = `${Math.round(ox)},${Math.round(oy)}`;
    refreshVals();
    redraw();
  }

  function redraw(){
    try{
      applyCanvasSize();
      const rows = parseData($('o_data').value);
      if(rows.length === 0) return;

      const origin = parsePair($('o_origin').value);
      if(!origin) throw new Error("Origin format: ox,oy");
      const [ox,oy] = origin;

      const fonts = readFonts();

      const minorPx = Number($('o_minorPx').value);
      const majorEvery = Number($('o_majorEvery').value);
      const zoom = Number($('o_zoom').value);

      const firstLowerBoundary = rows[0].lo;

      const breakFrom = 0;
      const breakTo = firstLowerBoundary;
      const breakGapPx = majorEvery * minorPx * zoom;

      const params = {
        ox,oy,
        minorPx,
        majorEvery,
        xSmallPerUnit: sharedAxisRate("x", Number($('o_xSmallPerUnit').value)),
        ySmallPerUnit: sharedAxisRate("y", Number($('o_ySmallPerUnit').value)),
        zoom,
        breakFrom,
        breakTo,
        breakGapPx,
      };

      const {maxY} = computeBounds(rows);

      clearCanvas(ctx, cv);
      drawGraphPaper(ctx, cv, params.ox, params.oy, params.minorPx, params.majorEvery, params.zoom);

      drawAxes(ctx, cv, params.ox, params.oy, fonts);
      drawAxisBreakGlyph(ctx, params);
      drawAxisAnnotations(ctx, cv, params, readAnnotation());

      const upperBounds = rows.map(r => r.hi);
      const xLabels = [rows[0].lo, ...upperBounds];
      drawXBoundaryLabels(ctx, params, xLabels, fonts);

      drawYAxisLabels(ctx, params, maxY, fonts, $('o_yLabelStep')?.value ?? 5);

      const pts = buildOgivePoints(rows);
      drawOgiveCurve(pts, params, fonts);

    }catch(e){
      console.warn(e.message);
    }
  }

  // ====== DRAG POINTS + PAN + ZOOM ======
  function canvasXY(e){
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cv.width / r.width),
      y: (e.clientY - r.top) * (cv.height / r.height),
    };
  }

  function hitTestPoint(mx,my){
    for(let i=pointHit.length-1;i>=0;i--){
      const b = pointHit[i];
      const dx = mx-b.cx, dy = my-b.cy;
      if(dx*dx + dy*dy <= b.r*b.r) return b.rowIndex;
    }
    return -1;
  }

  function setCursor(mode){
    cv.classList.remove("can-grab","grabbing","can-move-point");
    if(mode) cv.classList.add(mode);
  }

  function rowsToText(rows){
    return rows.map(r => `${r.lo},${r.hi},${r.cf}`).join("\n");
  }

  listen(cv, "mousemove", (e) => {
    const {x:mx,y:my} = canvasXY(e);

    if(dragState.active){
      if(dragState.mode === "pan"){
        const dx = mx - dragState.startMx;
        const dy = my - dragState.startMy;
        $('o_origin').value = `${Math.round(dragState.startOx + dx)},${Math.round(dragState.startOy + dy)}`;
        redraw();
        setCursor("grabbing");
        return;
      }

      if(dragState.mode === "point"){
        const origin = parsePair($('o_origin').value);
        if(!origin) return;
        const [ox,oy] = origin;

        const rows = parseData($('o_data').value);

        const minorPx = Number($('o_minorPx').value);
        const majorEvery = Number($('o_majorEvery').value);
        const zoom = Number($('o_zoom').value);
        const xSmallPerUnit = sharedAxisRate("x", Number($('o_xSmallPerUnit').value));
        const ySmallPerUnit = sharedAxisRate("y", Number($('o_ySmallPerUnit').value));
        const firstLowerBoundary = rows[0].lo;

        const breakFrom = 0;
        const breakTo = firstLowerBoundary;
        const breakGapPx = majorEvery * minorPx * zoom;

        const params = {ox,oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom, breakFrom, breakTo, breakGapPx};

        const [, wy] = canvasToWorld(mx,my, params);

        const i = dragState.rowIndex;
        if(i < 0 || i >= rows.length) return;

        const prev = (i === 0) ? 0 : rows[i-1].cf;
        const next = (i === rows.length-1) ? Infinity : rows[i+1].cf;

        let newCF = Math.round(wy);
        if(!Number.isFinite(newCF)) return;
        newCF = clamp(newCF, prev, (next===Infinity ? 1e9 : next));

        rows[i].cf = newCF;

        $('o_data').value = rowsToText(rows);
        $('o_data').dispatchEvent(new Event("input", {bubbles:true}));

        // sync table view
        oGrid.textToTable($('o_data').value);

        redraw();
        setCursor("can-move-point");
        return;
      }
    }

    const pi = hitTestPoint(mx,my);
    if(pi >= 0){
      setCursor("can-move-point");
      return;
    }
    setCursor("can-grab");
  });

  listen(cv, "mousedown",(e)=>{
    const {x:mx,y:my} = canvasXY(e);

    const pi = hitTestPoint(mx,my);
    if(pi >= 0){
      dragState.active = true;
      dragState.mode = "point";
      dragState.rowIndex = pi;
      setCursor("can-move-point");
      return;
    }

    const origin = parsePair($('o_origin').value);
    if(!origin) return;
    dragState.active = true;
    dragState.mode = "pan";
    dragState.startMx = mx;
    dragState.startMy = my;
    dragState.startOx = origin[0];
    dragState.startOy = origin[1];
    setCursor("grabbing");
  });

  listen(window, "mouseup",()=>{
    dragState.active = false;
    dragState.mode = null;
    dragState.rowIndex = -1;
    setCursor("can-grab");
  });

  listen(cv, "wheel",(e)=>{
    e.preventDefault();
    const {x:mx,y:my} = canvasXY(e);

    const origin = parsePair($('o_origin').value);
    if(!origin) return;
    let [ox,oy]=origin;

    const minorPx = Number($('o_minorPx').value);
    const majorEvery = Number($('o_majorEvery').value);
    const xSmallPerUnit = sharedAxisRate("x", Number($('o_xSmallPerUnit').value));
    const ySmallPerUnit = sharedAxisRate("y", Number($('o_ySmallPerUnit').value));

    const rows = parseData($('o_data').value);
    const firstLowerBoundary = rows[0].lo;

    const oldZ = Number($('o_zoom').value);
    const factor = (e.deltaY > 0) ? 0.92 : 1.08;
    let newZ = Math.max(0.35, Math.min(4.0, oldZ*factor));

    const breakFrom = 0;
    const breakTo = firstLowerBoundary;
    const oldGapPx = majorEvery * minorPx * oldZ;
    const newGapPx = majorEvery * minorPx * newZ;

    const paramsOld = {ox,oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom: oldZ, breakFrom, breakTo, breakGapPx: oldGapPx};
    const [wx,wy] = canvasToWorld(mx,my, paramsOld);

    const mp2 = minorPx * newZ;
    const sx2 = mp2 * xSmallPerUnit;
    const sy2 = mp2 * ySmallPerUnit;

    const removed = (breakTo - breakFrom);

    if(wx <= breakFrom || !(breakTo > breakFrom)){
      ox = mx - wx*sx2;
    }else{
      ox = mx - (wx - removed)*sx2 - newGapPx;
    }
    oy = my + wy*sy2;

    $('o_zoom').value = (Math.floor(newZ*100)/100).toFixed(2);
    $('o_origin').value = `${Math.round(ox)},${Math.round(oy)}`;
    refreshVals();
    redraw();
  }, {passive:false});

  function downloadPNG(){
    redraw();
    const a = document.createElement("a");
    a.download = `ogive-${isoStamp()}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  }

  function downloadSVG(){
    redraw();
    const png = cv.toDataURL("image/png");
    const W=cv.width,H=cv.height;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <image href="${png}" width="${W}" height="${H}" />
    </svg>`;
    const blob = new Blob([svg], {type:"image/svg+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `ogive-${isoStamp()}.svg`;
    a.href = url;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }

  function resetToDefaults() {
    if (!options.workspace) { window.location.reload(); return; }
    Array.prototype.forEach.call(controlRoot.querySelectorAll('input, textarea, select'), function (element) {
      if (element.classList.contains('cellInput') || element.type === 'file') return;
      if (element.type === 'checkbox' || element.type === 'radio') element.checked = element.defaultChecked;
      else element.value = element.defaultValue;
    });
    oGrid.textToTable($('o_data').value);
    $('o_tableError').textContent = '';
    $('o_tableError').style.display = 'none';
    refreshVals();
    redraw();
  }

  listen($('o_fitBtn'), "click", fitToData);
  listen($('o_resetBtn'), "click", resetToDefaults);
  listen($('o_pngBtn'), "click", downloadPNG);
  listen($('o_svgBtn'), "click", downloadSVG);

  const live = [
    'o_data','o_showDots','o_showPointLabels',
    'o_showAxisLabels','o_axisLabelArrows',
    'o_xLabelText','o_yLabelText','o_fontAxisLabel','o_xLabelOffset','o_yLabelOffset',
    'o_zoom','o_minorPx','o_majorEvery','o_yLabelStep','o_curveW',
    'o_csize','o_origin','o_xSmallPerUnit','o_ySmallPerUnit',
    'o_fontAxis','o_fontTicks','o_fontPoint'
  ];

  live.forEach(id => {
    const el = $(id);
    if(el) listen(el, "input", ()=>{ refreshVals(); redraw(); });
  });

  if (typographyControls) {
    listen(typographyControls.sizeInput, "input", redraw);
    listen(typographyControls.boldInput, "change", redraw);
  }

  refreshVals();
  redraw();
  setCursor("can-grab");


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
      var grid = oGrid;
      if (grid && tableState.id === 'o_table' && Array.isArray(tableState.rows)) {
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
    var grid = oGrid;
    if (grid && typeof grid.destroy === 'function') grid.destroy();
    if (canvasView && typeof canvasView.destroy === 'function') canvasView.destroy();
  }

  return {
    render: redraw,
    resize: function (width, height, dpr) {
      if (canvasView && typeof canvasView.resize === 'function') canvasView.resize(width, height, dpr);
      redraw();
    },
    reset: resetToDefaults,
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

window.MathForgeOgive = { mount: mount };
if (!document.getElementById('mfWorkspace')) mount({ standalone: true, controlsRoot: document });
})(window, document);
