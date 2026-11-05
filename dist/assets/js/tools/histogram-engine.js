(function (window, document) {
  "use strict";
/* ============================
   APP: Histogram + Polygon
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

  var hGrid = makeTableGrid({
    tableId:"h_table",
    textareaId:"h_data",
    addBtnId:"h_addRow",
    delBtnId:"h_delRow",
    useBtnId:"h_useTable",
    columnsCount: 3
  });

  const cv = canvasView || document.getElementById("h_cv");
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const graphTypography = window.MathForgeGraphTypography;
  const typographyControls = graphTypography && graphTypography.ensureControls(controlRoot, "histogram");

  function readTypography() {
    return typographyControls ? graphTypography.read(typographyControls.sizeInput, typographyControls.boldInput, typographyControls.familyInput, typographyControls.colorInput) : { fontSizePt: 11, bold: false };
  }

  function sharedAxisRate(axis, fallback) {
    return window.MathForgeGraphScale
      ? window.MathForgeGraphScale.effectiveRate(axis, fallback)
      : Number(fallback);
  }

  function graphFont(sizePx, typography) {
    return graphTypography ? graphTypography.font(sizePx, typography) : `${sizePx}px "Times New Roman", "Noto Sans Bengali", serif`;
  }

  function setVal(spanId, inputId){
    const s = $(spanId), i = $(inputId);
    if(s && i) s.textContent = i.value;
  }
  function refreshVals(){
    setVal('h_zoomVal','h_zoom');
    setVal('h_fontAxisVal','h_fontAxis');
    setVal('h_fontTicksVal','h_fontTicks');
    setVal('h_fontMidVal','h_fontMid');
    setVal('h_fontAxisLabelVal','h_fontAxisLabel');
  }

  function readAnnotation(){
    return {
      show: $('h_showAxisLabels')?.checked,
      xText: $('h_xLabelText')?.value ?? "",
      yText: $('h_yLabelText')?.value ?? "",
      addArrows: $('h_axisLabelArrows')?.checked,
      xOffset: $('h_xLabelOffset')?.value,
      yOffset: $('h_yLabelOffset')?.value,
      fontSize: graphTypography.scaledSizePx(Number($('h_fontAxisLabel')?.value ?? 18), 18, readTypography()),
      typography: readTypography(),
    };
  }

  function parseData(text){
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const rows = [];
    for(const line of lines){
      const parts = line.split(',').map(s => s.trim());
      if(parts.length < 3) throw new Error("Bad line: " + line);
      const lo = Number(parts[0]), hi = Number(parts[1]), f = Number(parts[2]);
      if(!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(f)) throw new Error("Bad numbers: " + line);
      if(hi <= lo) throw new Error("Upper boundary must be > lower boundary: " + line);
      rows.push({lo, hi, f, mid:(lo+hi)/2});
    }
    rows.sort((a,b)=>a.lo-b.lo);
    return rows;
  }

  function applyCanvasSize(){
    const s = parsePair($('h_csize').value);
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
      axis: graphTypography.scaledSizePx(Number($('h_fontAxis')?.value ?? 16), 16, typography),
      ticks: graphTypography.scaledSizePx(Number($('h_fontTicks')?.value ?? 14), 14, typography),
      mid: graphTypography.scaledSizePx(Number($('h_fontMid')?.value ?? 12), 12, typography),
      typography: typography,
    };
  }

  function computeBounds(rows){
    const minX = Math.min(...rows.map(r => r.lo));
    const maxX = Math.max(...rows.map(r => r.hi));
    const maxY = Math.max(...rows.map(r => r.f), 1);
    return {minX,maxX,maxY};
  }

  function drawHistogram(rows, params){
    const alpha = Math.max(0, Math.min(1, Number($('h_barAlpha')?.value ?? 0.18)));
    ctx.save();
    ctx.fillStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";

    for(const r of rows){
      const [x1,y0] = worldToCanvas(r.lo, 0, params);
      const [x2,yf] = worldToCanvas(r.hi, r.f, params);

      const left = Math.min(x1,x2);
      const right = Math.max(x1,x2);
      const top = Math.min(y0,yf);
      const bottom = Math.max(y0,yf);

      ctx.globalAlpha = alpha;
      ctx.fillRect(left, top, right-left, bottom-top);
    }

    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";
    ctx.lineWidth = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineWidth : 1;

    for(const r of rows){
      const [x1,y0] = worldToCanvas(r.lo, 0, params);
      const [x2,yf] = worldToCanvas(r.hi, r.f, params);

      const left = Math.min(x1,x2);
      const right = Math.max(x1,x2);
      const top = Math.min(y0,yf);
      const bottom = Math.max(y0,yf);

      ctx.strokeRect(left, top, right-left, bottom-top);
    }

    ctx.restore();
  }

  function drawFrequencyPolygon(rows, params, fonts){
    if(!rows.length) return;

    const mids = rows.map(r => ({x:r.mid, y:r.f}));
    const start = {x: rows[0].lo, y:0};
    const end   = {x: rows[rows.length-1].hi, y:0};

    ctx.save();
    ctx.strokeStyle = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineColor : "#000";
    ctx.globalAlpha = 1;

    ctx.lineWidth = window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().lineWidth : 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    const [sx,sy] = worldToCanvas(start.x,start.y, params);
    ctx.moveTo(sx,sy);

    for(const p of mids){
      const [px,py] = worldToCanvas(p.x,p.y, params);
      ctx.lineTo(px,py);
    }

    const [ex,ey] = worldToCanvas(end.x,end.y, params);
    ctx.lineTo(ex,ey);
    ctx.stroke();

    if($('h_showMidDots')?.checked){
      ctx.fillStyle=window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().fontColor : "#000";
      for(const p of mids){
        const [px,py] = worldToCanvas(p.x,p.y, params);
        ctx.beginPath();
        ctx.arc(px,py,4,0,Math.PI*2);
        ctx.fill();
      }
    }

    if($('h_showMidLabels')?.checked){
      ctx.fillStyle=window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState().fontColor : "#000";
      ctx.font = graphFont(fonts.mid, fonts.typography);
      ctx.textAlign="center";
      ctx.textBaseline="bottom";
      for(const p of mids){
        const [px,py] = worldToCanvas(p.x,p.y, params);
        ctx.fillText(String(p.x), px, py-8);
      }
    }

    ctx.restore();
  }

  function fitToData(){
    const rows = parseData($('h_data').value);
    applyCanvasSize();

    const minorPx = Number($('h_minorPx').value);
    const majorEvery = Number($('h_majorEvery').value);
    const xSmallPerUnit = sharedAxisRate("x", Number($('h_xSmallPerUnit').value));
    const ySmallPerUnit = sharedAxisRate("y", Number($('h_ySmallPerUnit').value));

    const {minX,maxX,maxY} = computeBounds(rows);

    const pad = 70;
    const baseSx = minorPx * xSmallPerUnit;
    const baseSy = minorPx * ySmallPerUnit;
    const breakGapBasePx = minX > 0 ? majorEvery * minorPx : 0;

    const needZx = (cv.width - 2*pad) / ((maxX - minX) * baseSx + breakGapBasePx);
    const needZy = (cv.height - 2*pad) / ((maxY - 0) * baseSy);
    let z = Math.min(needZx, needZy);
    z = Math.max(0.35, Math.min(4.0, z));
    $('h_zoom').value = (Math.floor(z*100)/100).toFixed(2);

    const oy = cv.height - pad;
    const ox = pad;
    $('h_origin').value = `${Math.round(ox)},${Math.round(oy)}`;
    refreshVals();
    redraw();
  }

  function redraw(){
    try{
      applyCanvasSize();
      const rows = parseData($('h_data').value);

      const origin = parsePair($('h_origin').value);
      if(!origin) throw new Error("Origin format: ox,oy");
      const [ox,oy] = origin;

      const fonts = readFonts();

      const minorPx = Number($('h_minorPx').value);
      const majorEvery = Number($('h_majorEvery').value);
      const zoom = Number($('h_zoom').value);

      const minBoundary = Math.min(...rows.map(r => r.lo));
      const breakFrom = 0;
      const breakTo = minBoundary;
      const breakGapPx = majorEvery * minorPx * zoom;

      const params = {
        ox,oy,
        minorPx,
        majorEvery,
        xSmallPerUnit: sharedAxisRate("x", Number($('h_xSmallPerUnit').value)),
        ySmallPerUnit: sharedAxisRate("y", Number($('h_ySmallPerUnit').value)),
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

      const boundaries = [];
      for(const r of rows) boundaries.push(r.lo);
      boundaries.push(rows[rows.length-1].hi);
      const uniq = [...new Set(boundaries)].sort((a,b)=>a-b);
      drawXBoundaryLabels(ctx, params, uniq, fonts);

      drawYAxisLabels(ctx, params, maxY, fonts, $('h_yLabelStep')?.value ?? 5);

      if($('h_showHist')?.checked) drawHistogram(rows, params);
      if($('h_showPoly')?.checked) drawFrequencyPolygon(rows, params, fonts);

    }catch(e){
      console.warn(e.message);
    }
  }

  function canvasXY(e){
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cv.width / r.width),
      y: (e.clientY - r.top) * (cv.height / r.height),
    };
  }
  function setCursor(mode){
    cv.classList.remove("can-grab","grabbing");
    if(mode) cv.classList.add(mode);
  }
  let drag = {active:false, sx:0, sy:0, startOx:0, startOy:0};

  listen(cv, "mousedown",(e)=>{
    const p = canvasXY(e);
    const origin = parsePair($('h_origin').value);
    if(!origin) return;
    drag.active=true;
    drag.sx=p.x; drag.sy=p.y;
    drag.startOx=origin[0];
    drag.startOy=origin[1];
    setCursor("grabbing");
  });
  listen(window, "mouseup",()=>{ drag.active=false; setCursor("can-grab"); });

  listen(cv, "mousemove",(e)=>{
    if(!drag.active){ setCursor("can-grab"); return; }
    const p=canvasXY(e);
    $('h_origin').value = `${Math.round(drag.startOx + (p.x-drag.sx))},${Math.round(drag.startOy + (p.y-drag.sy))}`;
    redraw();
  });

  listen(cv, "wheel",(e)=>{
    e.preventDefault();
    const {x:mx,y:my} = canvasXY(e);

    const origin = parsePair($('h_origin').value);
    if(!origin) return;
    let [ox,oy]=origin;

    const minorPx = Number($('h_minorPx').value);
    const majorEvery = Number($('h_majorEvery').value);
    const xSmallPerUnit = sharedAxisRate("x", Number($('h_xSmallPerUnit').value));
    const ySmallPerUnit = sharedAxisRate("y", Number($('h_ySmallPerUnit').value));

    const rows = parseData($('h_data').value);
    const minBoundary = Math.min(...rows.map(r => r.lo));

    const oldZ = Number($('h_zoom').value);
    const factor = (e.deltaY > 0) ? 0.92 : 1.08;
    let newZ = Math.max(0.35, Math.min(4.0, oldZ*factor));

    const breakFrom = 0;
    const breakTo = minBoundary;
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

    $('h_zoom').value = (Math.floor(newZ*100)/100).toFixed(2);
    $('h_origin').value = `${Math.round(ox)},${Math.round(oy)}`;
    refreshVals();
    redraw();
  }, {passive:false});

  function downloadPNG(){
    redraw();
    const a = document.createElement("a");
    a.download = `hist-poly-textbook-${isoStamp()}.png`;
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
    a.download = `hist-poly-textbook-${isoStamp()}.svg`;
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
    hGrid.textToTable($('h_data').value);
    refreshVals();
    redraw();
  }

  listen($('h_resetBtn'), "click", resetToDefaults);
  listen($('h_fitBtn'), "click", fitToData);
  listen($('h_pngBtn'), "click", downloadPNG);
  listen($('h_svgBtn'), "click", downloadSVG);

  const live = [
    'h_data','h_showHist','h_showPoly','h_showMidDots','h_showMidLabels',
    'h_showAxisLabels','h_axisLabelArrows',
    'h_xLabelText','h_yLabelText','h_fontAxisLabel','h_xLabelOffset','h_yLabelOffset',
    'h_zoom','h_minorPx','h_majorEvery','h_barAlpha',
    'h_yLabelStep','h_csize','h_origin','h_xSmallPerUnit','h_ySmallPerUnit',
    'h_fontAxis','h_fontTicks','h_fontMid'
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
      var grid = hGrid;
      if (grid && tableState.id === 'h_table' && Array.isArray(tableState.rows)) {
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
    var grid = hGrid;
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

window.MathForgeHistogram = { mount: mount };
if (!document.getElementById('mfWorkspace')) mount({ standalone: true, controlsRoot: document });
})(window, document);
