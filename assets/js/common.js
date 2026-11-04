// assets/js/common.js
(function(){
  "use strict";

  // ---------- Small DOM / math helpers (original) ----------
  window.$id = (id) => document.getElementById(id);

  // parse "w,h" => [w,h] or null
  window.parsePair = (s) => {
    if (typeof s !== "string") return null;
    const [a,b] = s.split(",").map(t => Number(String(t).trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return [a,b];
  };

  window.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  window.isoStamp = () => new Date().toISOString().replace(/[:.]/g,'-');

  // ============================================================
  // Shared: Editable "paper table" grid (paste-friendly input).
  // Was duplicated character-for-character in Ogiveline.html and
  // Polygonal.html — now lives here once.
  // ============================================================
  window.makeTableGrid = function(opts){
    const {
      tableId, textareaId,
      addBtnId, delBtnId, useBtnId,
      columnsCount = 3
    } = opts;

    const table = document.getElementById(tableId);
    const tbody = table.querySelector("tbody");
    const hidden = document.getElementById(textareaId);

    const btnAdd = document.getElementById(addBtnId);
    const btnDel = document.getElementById(delBtnId);
    const btnUse = document.getElementById(useBtnId);
    const cleanups = [];

    function listen(target, type, handler, options) {
      if (!target) return;
      target.addEventListener(type, handler, options);
      cleanups.push(function () { target.removeEventListener(type, handler, options); });
    }

    function makeCellInput(value=""){
      const inp = document.createElement("input");
      inp.className = "cellInput";
      inp.value = value;
      inp.inputMode = "decimal";
      inp.autocomplete = "off";
      inp.spellcheck = false;
      return inp;
    }

    function renumber(){
      [...tbody.querySelectorAll("tr")].forEach((tr,i)=>{
        tr.querySelector(".rowIndex").textContent = String(i+1);
      });
    }

    function addRow(values){
      const tr = document.createElement("tr");

      const idx = document.createElement("td");
      idx.className = "rowIndex";
      idx.textContent = String(tbody.children.length + 1);
      tr.appendChild(idx);

      for(let c=0;c<columnsCount;c++){
        const td = document.createElement("td");
        const inp = makeCellInput((values && values[c]) ? values[c] : "");
        td.appendChild(inp);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
      renumber();
    }

    function delRow(){
      if(tbody.children.length > 1) tbody.removeChild(tbody.lastElementChild);
      renumber();
    }

    function tableToText(){
      const lines = [];
      for(const tr of [...tbody.querySelectorAll("tr")]){
        const inputs = [...tr.querySelectorAll("input.cellInput")];
        const vals = inputs.map(i => i.value.trim());
        const allEmpty = vals.every(v => !v);
        if(allEmpty) continue;
        lines.push(vals.join(","));
      }
      return lines.join("\n");
    }

    function textToTable(text){
      tbody.innerHTML = "";
      const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if(lines.length === 0){
        addRow();
        return;
      }
      for(const line of lines){
        const parts = line.split(",").map(s=>s.trim());
        addRow(parts.slice(0, columnsCount));
      }
    }

    // Paste tab/newline (Excel/Sheets style)
    listen(table, "paste", (e) => {
      const active = document.activeElement;
      if(!(active instanceof HTMLInputElement) || !active.classList.contains("cellInput")) return;
      e.preventDefault();

      const text = (e.clipboardData || window.clipboardData).getData("text");
      const rows = text.split(/\r?\n/).filter(r=>r.length);
      const grid = rows.map(r => r.split("\t"));

      const startTd = active.closest("td");
      const startTr = active.closest("tr");
      const r0 = [...tbody.children].indexOf(startTr);
      const c0 = [...startTr.querySelectorAll("td")].indexOf(startTd) - 1; // ignore index column

      while(tbody.children.length < r0 + grid.length) addRow();

      for(let r=0;r<grid.length;r++){
        const tr = tbody.children[r0 + r];
        const ins = [...tr.querySelectorAll("input.cellInput")];
        for(let c=0;c<grid[r].length;c++){
          const cc = c0 + c;
          if(cc >= 0 && cc < columnsCount){
            ins[cc].value = grid[r][c].trim();
          }
        }
      }
    });

    // Enter behaves like Tab
    listen(table, "keydown", (e) => {
      const active = document.activeElement;
      if(!(active instanceof HTMLInputElement) || !active.classList.contains("cellInput")) return;
      if(e.key === "Enter"){
        e.preventDefault();
        const all = [...table.querySelectorAll("input.cellInput")];
        const i = all.indexOf(active);
        if(i >= 0 && i < all.length-1) all[i+1].focus();
      }
    });

    listen(btnAdd, "click", () => addRow());
    listen(btnDel, "click", () => delRow());

    listen(btnUse, "click", () => {
      hidden.value = tableToText();
      hidden.dispatchEvent(new Event("input", {bubbles:true}));
    });

    // init from hidden textarea
    textToTable(hidden.value);

    return {
      textToTable,
      tableToText,
      addRow,
      delRow,
      destroy: function () {
        while (cleanups.length) cleanups.pop()();
      }
    };
  };

  // ============================================================
  // Shared: World <-> Canvas coordinate mapping, with support
  // for an optional "axis break" gap on the X axis.
  //
  // params = { ox, oy, minorPx, xSmallPerUnit, ySmallPerUnit,
  //            zoom, breakFrom, breakTo, breakGapPx }
  // ============================================================
  window.xMapWithBreak = function(x, ox, minorPx, xSmallPerUnit, zoom, breakFrom, breakTo, breakGapPx){
    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit;
    if(!(breakTo > breakFrom)) return ox + x*sx;
    if(x <= breakFrom) return ox + x*sx;
    const removed = (breakTo - breakFrom);
    const xCompressed = x - removed;
    return ox + xCompressed*sx + breakGapPx;
  };

  window.xUnmapWithBreak = function(px, ox, minorPx, xSmallPerUnit, zoom, breakFrom, breakTo, breakGapPx){
    const mp = minorPx * zoom;
    const sx = mp * xSmallPerUnit;
    if(!(breakTo > breakFrom)) return (px-ox)/sx;

    const breakFromPx = ox + breakFrom*sx;
    const afterGapStartPx = breakFromPx + breakGapPx;

    if(px <= breakFromPx) return (px-ox)/sx;
    if(px < afterGapStartPx) return breakFrom;

    const removed = (breakTo - breakFrom);
    const xCompressed = (px - ox - breakGapPx)/sx;
    return xCompressed + removed;
  };

  window.worldToCanvas = function(x, y, params){
    const {ox,oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom, breakFrom, breakTo, breakGapPx} = params;
    const mp = minorPx * zoom;
    const sy = mp * ySmallPerUnit;
    const px = window.xMapWithBreak(x, ox, minorPx, xSmallPerUnit, zoom, breakFrom, breakTo, breakGapPx);
    const py = oy - y*sy;
    return [px, py];
  };

  window.canvasToWorld = function(px, py, params){
    const {ox,oy, minorPx, xSmallPerUnit, ySmallPerUnit, zoom, breakFrom, breakTo, breakGapPx} = params;
    const mp = minorPx * zoom;
    const sy = mp * ySmallPerUnit;
    const x = window.xUnmapWithBreak(px, ox, minorPx, xSmallPerUnit, zoom, breakFrom, breakTo, breakGapPx);
    const y = (oy - py)/sy;
    return [x, y];
  };

  // ============================================================
  // Shared: Canvas drawing primitives (graph paper, axes, arrow,
  // break glyph, tick labels). Each takes ctx + cv explicitly
  // since every tool owns its own canvas.
  // ============================================================
  window.clearCanvas = function(ctx, cv){
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,cv.width,cv.height);
  };

  window.drawGraphPaper = function(ctx, cv, ox, oy, minorPx, majorEvery, zoom, options){
    options = options || {};
    const sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    const mp = Math.max(0.5, Math.abs(Number(minorPx) * Number(zoom || 1)));
    const every = Math.max(2, Math.floor(Number(majorEvery) || 5));
    const rawAlphaScale = Number(options.opacityScale ?? 1);
    const alphaScale = Number.isFinite(rawAlphaScale) ? Math.max(0, rawAlphaScale) : 1;
    const firstX = Math.ceil(-ox / mp);
    const lastX = Math.floor((cv.width - ox) / mp);
    const firstY = Math.ceil(-oy / mp);
    const lastY = Math.floor((cv.height - oy) / mp);

    ctx.save();
    ctx.fillStyle = sharedDesign ? sharedDesign.background : "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (sharedDesign && !sharedDesign.gridVisible) {
      ctx.restore();
      return;
    }
    ctx.strokeStyle = sharedDesign ? sharedDesign.gridColor : (options.color || "#000000");
    ctx.globalAlpha = Math.min(1, 0.12 * alphaScale);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=firstX; i<=lastX; i++){
      if(i % every === 0) continue;
      const x = ox + i * mp;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cv.height);
    }
    for(let i=firstY; i<=lastY; i++){
      if(i % every === 0) continue;
      const y = oy + i * mp;
      ctx.moveTo(0, y);
      ctx.lineTo(cv.width, y);
    }
    ctx.stroke();

    ctx.globalAlpha = Math.min(1, 0.35 * alphaScale);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for(let i=Math.ceil(firstX / every) * every; i<=lastX; i+=every){
      const x = ox + i * mp;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cv.height);
    }
    for(let i=Math.ceil(firstY / every) * every; i<=lastY; i+=every){
      const y = oy + i * mp;
      ctx.moveTo(0, y);
      ctx.lineTo(cv.width, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  window.arrowhead = function(ctx, x1, y1, x2, y2, size=10){
    const ang = Math.atan2(y2-y1, x2-x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size*Math.cos(ang - Math.PI/7), y2 - size*Math.sin(ang - Math.PI/7));
    ctx.lineTo(x2 - size*Math.cos(ang + Math.PI/7), y2 - size*Math.sin(ang + Math.PI/7));
    ctx.closePath();
    ctx.fill();
  };

  window.drawInfiniteAxes = function(ctx, cv, ox, oy, options){
    options = options || {};
    const width = Number(cv.width), height = Number(cv.height);
    const xVisible = options.showX !== false && Number.isFinite(oy) && oy >= 0 && oy <= height;
    const yVisible = options.showY !== false && Number.isFinite(ox) && ox >= 0 && ox <= width;
    if (!xVisible && !yVisible) return { xVisible, yVisible, originVisible: false };

    const inset = Math.max(7, Math.min(10, Number(options.arrowSize) || 9));
    const arrowSize = Math.max(5, Math.min(12, Number(options.arrowSize) || 9));
    const color = options.color || "#000000";
    const fontColor = options.fontColor || color;
    const lineWidth = Math.max(1, Number(options.lineWidth) || 2);
    const fontSize = Math.max(8, Number(options.fontSize) || 14);
    const typography = window.MathForgeGraphTypography;
    const axisFont = typography
      ? typography.font(fontSize, options.typography)
      : fontSize + 'px "Times New Roman", "Kalpurush", serif';

    function drawTip(x, y, dx, dy){
      const baseX = x - dx * arrowSize;
      const baseY = y - dy * arrowSize;
      const wing = arrowSize * 0.52;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(baseX - dy * wing, baseY + dx * wing);
      ctx.lineTo(baseX + dy * wing, baseY - dx * wing);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";
    if (xVisible) {
      ctx.beginPath();
      ctx.moveTo(inset, oy);
      ctx.lineTo(width - inset, oy);
      ctx.stroke();
      drawTip(inset, oy, -1, 0);
      drawTip(width - inset, oy, 1, 0);
    }
    if (yVisible) {
      ctx.beginPath();
      ctx.moveTo(ox, height - inset);
      ctx.lineTo(ox, inset);
      ctx.stroke();
      drawTip(ox, inset, 0, -1);
      drawTip(ox, height - inset, 0, 1);
    }

    if (options.showLabels !== false) {
      ctx.fillStyle = fontColor;
      ctx.font = axisFont;
      ctx.textBaseline = "middle";
      if (xVisible) {
        const labelY = oy < fontSize + 5 ? oy + fontSize + 5 : oy - fontSize - 3;
        ctx.textAlign = "left";
        ctx.fillText("X′", inset + arrowSize + 4, labelY);
        ctx.textAlign = "right";
        ctx.fillText("X", width - inset - arrowSize - 4, labelY);
      }
      if (yVisible) {
        const labelX = ox > width - fontSize * 2 ? ox - 8 : ox + 8;
        ctx.textAlign = ox > width - fontSize * 2 ? "right" : "left";
        ctx.textBaseline = "top";
        ctx.fillText("Y", labelX, inset + arrowSize + 2);
        ctx.textBaseline = "bottom";
        ctx.fillText("Y′", labelX, height - inset - arrowSize - 2);
      }

      const originVisible = xVisible && yVisible;
      if (originVisible && options.showOrigin !== false) {
        const originX = ox > width - fontSize * 2 ? ox - 7 : ox + 7;
        const originY = oy > fontSize + 4 ? oy - 7 : oy + 7;
        ctx.textAlign = ox > width - fontSize * 2 ? "right" : "left";
        ctx.textBaseline = oy > fontSize + 4 ? "bottom" : "top";
        ctx.fillText("O", originX, originY);
      }
    }
    ctx.restore();
    return { xVisible, yVisible, originVisible: xVisible && yVisible };
  };

  window.drawAxes = function(ctx, cv, ox, oy, fonts){
    const sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    if (sharedDesign && !sharedDesign.axesVisible) return;
    window.drawInfiniteAxes(ctx, cv, ox, oy, {
      color: sharedDesign ? sharedDesign.axisColor : "#000",
      fontColor: sharedDesign ? sharedDesign.fontColor : "#000",
      lineWidth: 2,
      fontSize: fonts.axis,
      typography: fonts.typography
    });
  };

  window.drawAxisBreakGlyph = function(ctx, params){
    const {ox, oy, minorPx, majorEvery, zoom, breakFrom, breakTo} = params;
    if(!(breakTo > breakFrom)) return;

    const gapPx = majorEvery * minorPx * zoom;
    const cx = ox + gapPx * 0.5;
    const y = oy;

    const amp = 10;
    const step = 12;

    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.95;

    ctx.beginPath();
    ctx.moveTo(cx - step, y - amp);
    ctx.lineTo(cx - step/2, y + amp);
    ctx.lineTo(cx, y - amp);
    ctx.lineTo(cx + step/2, y + amp);
    ctx.lineTo(cx + step, y - amp);
    ctx.stroke();
    ctx.restore();
  };

  // step = numeric Y-labelling interval (each tool reads its own
  // "Y labels step" input and passes the value in)
  window.drawYAxisLabels = function(ctx, params, yMax, fonts, step){
    const {ox,oy, minorPx, ySmallPerUnit, zoom} = params;
    const mp = minorPx * zoom;
    const sy = mp * ySmallPerUnit;
    const st = Math.max(1, Number(step) || 1);

    ctx.save();
    const sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    if (sharedDesign && !sharedDesign.axesVisible) return;
    ctx.fillStyle = sharedDesign ? sharedDesign.fontColor : "#000";
    ctx.strokeStyle = sharedDesign ? sharedDesign.axisColor : "#000";
    const typography = window.MathForgeGraphTypography;
    ctx.font = typography ? typography.font(fonts.ticks, fonts.typography) : `${fonts.ticks}px "Times New Roman", "Kalpurush", serif`;
    ctx.globalAlpha = 0.95;

    for(let y=0; y<=yMax; y+=st){
      const py = oy - y*sy;

      ctx.beginPath();
      ctx.moveTo(ox-5, py);
      ctx.lineTo(ox+5, py);
      ctx.stroke();

      if(y !== 0){
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(String(y), ox-8, py);
      }
    }
    ctx.restore();
  };

  window.drawXBoundaryLabels = function(ctx, params, boundaries, fonts){
    const {oy} = params;

    ctx.save();
    const sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    if (sharedDesign && !sharedDesign.axesVisible) return;
    ctx.fillStyle = sharedDesign ? sharedDesign.fontColor : "#000";
    ctx.strokeStyle = sharedDesign ? sharedDesign.axisColor : "#000";
    const typography = window.MathForgeGraphTypography;
    ctx.font = typography ? typography.font(fonts.ticks, fonts.typography) : `${fonts.ticks}px "Times New Roman", "Kalpurush", serif`;
    ctx.globalAlpha = 0.95;

    const tickLen = 6;

    for(const b of boundaries){
      const [px] = window.worldToCanvas(b, 0, params);

      ctx.beginPath();
      ctx.moveTo(px, oy - tickLen);
      ctx.lineTo(px, oy + tickLen);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(b), px, oy + 10);
    }

    ctx.restore();
  };

  // annotation = { show, xText, yText, addArrows, xOffset, yOffset, fontSize }
  // Each tool builds this object from ITS OWN control ids and passes
  // it in, so we no longer need to reuse "h_..." ids on a non-histogram
  // page just to share this drawing code.
  window.drawAxisAnnotations = function(ctx, cv, params, annotation){
    if(!annotation || annotation.show === false) return;
    const sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState() : null;
    if (sharedDesign && !sharedDesign.axesVisible) return;

    const xTextRaw = annotation.xText || "";
    const yTextRaw = annotation.yText || "";
    const addArrows = !!annotation.addArrows;

    const xOffset = Number(annotation.xOffset ?? 45);
    const yOffset = Number(annotation.yOffset ?? 55);
    const size = Number(annotation.fontSize ?? 18);

    const xText = addArrows ? xTextRaw : xTextRaw.replace(/[→➡]/g, "").trim();
    const yText = addArrows ? yTextRaw : yTextRaw.replace(/[↑⬆]/g, "").trim();

    ctx.save();
    ctx.fillStyle = sharedDesign ? sharedDesign.fontColor : "#000";
    ctx.globalAlpha = 0.95;
    const typography = window.MathForgeGraphTypography;
    ctx.font = typography ? typography.font(size, annotation.typography) : `${size}px "Times New Roman", "Kalpurush", serif`;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(xText, cv.width/2, params.oy + xOffset);

    ctx.translate(params.ox - yOffset, cv.height/2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(yText, 0, 0);

    ctx.restore();
  };

})();
