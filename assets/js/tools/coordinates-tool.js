/**
 * coordinates-tool.js
 * MathForge â€” Professional Coordinates Graph Shared Engine & Adapter
 *
 * Architecture:
 * - Direct DOM Integration with Modular Tool Lifecycle (Strategy A)
 * - Single source of truth: 100% shared mathematical calculation and rendering algorithms
 * - Dual execution mode: Standalone Page (Coordinates_graph.html) & Workspace Host (index.html)
 * - 100% Offline-compatible (file:// protocol, zero external dependencies)
 * - Complete event listener tracking with guaranteed teardown on unmount
 * - State persistence across tool switches via getState() / setState()
 */

(function (window, document) {
  "use strict";

  /* ==========================================================================
     1. Mathematical Constants & Configuration Defaults
     ========================================================================== */
  var DEFAULT_POINT_COLOR = "#000000";
  var DEFAULT_POINT_SHAPE = "circle";
  var POINT_SHAPES = ["circle", "square", "triangle", "diamond"];
  var DEFAULT_FILL_COLOR = "#5b8def";
  var DEFAULT_BORDER_COLOR = "#111827";
  var DEFAULT_DIAGONAL_COLOR = "#475569";
  var DEFAULT_CONNECTION_COLOR = "#111827";

  function makePointId() {
    return "point-" + Date.now() + "-" + Math.random().toString(16).slice(2, 10);
  }

  function makeConnectionId() {
    return "connection-" + Date.now() + "-" + Math.random().toString(16).slice(2, 10);
  }

  function makeShapeId() {
    return "shape-" + Date.now() + "-" + Math.random().toString(16).slice(2, 10);
  }

  function defaultRenderOptions() {
    return {
      polygon: {
        visible: false,
        fillVisible: false,
        fillColor: DEFAULT_FILL_COLOR,
        fillOpacity: 0.18,
        borderVisible: true,
        borderColor: DEFAULT_BORDER_COLOR,
        borderWidth: 3,
        borderStyle: "solid"
      },
      diagonals: {
        visible: false,
        color: DEFAULT_DIAGONAL_COLOR,
        width: 2,
        style: "dashed"
      }
    };
  }

  function defaultSampleText() {
    return "P(1,-1)\nQ(3,1)\nR(4,10/9)\n";
  }

  function normalizeLineStyle(value) {
    return value === "dotted" ? "dotted" : value === "solid" ? "solid" : "dashed";
  }

  function resolveDashPattern(styleName) {
    switch (normalizeLineStyle(styleName)) {
      case "dotted": return [2, 5];
      case "solid": return [];
      default: return [10, 8];
    }
  }

  function normalizePointStyle(style) {
    style = style || {};
    var color = /^#[0-9a-fA-F]{6}$/.test(style.color || "") ? style.color : DEFAULT_POINT_COLOR;
    var shape = POINT_SHAPES.indexOf(style.shape) !== -1 ? style.shape : DEFAULT_POINT_SHAPE;
    return { color: color, shape: shape };
  }

  function getPointStyleKey(point) {
    var label = point && point.label ? String(point.label) : "";
    var xRaw = point && point.xRaw != null ? String(point.xRaw) : String(point.x);
    var yRaw = point && point.yRaw != null ? String(point.yRaw) : String(point.y);
    return label + ":" + xRaw + ":" + yRaw;
  }

  function preservePointStyles(existingPoints, parsedPoints) {
    var styleMap = Object.create(null);
    var labelMap = Object.create(null);
    var i;
    for (i = 0; i < (existingPoints || []).length; i++) {
      var pt = existingPoints[i];
      var key = getPointStyleKey(pt);
      styleMap[key] = normalizePointStyle(pt.style);
      if (pt.label && !labelMap[String(pt.label).toUpperCase()]) labelMap[String(pt.label).toUpperCase()] = pt;
    }

    for (i = 0; i < (parsedPoints || []).length; i++) {
      var p = parsedPoints[i];
      var k = getPointStyleKey(p);
      var matchingStyle = styleMap[k];
      p.style = normalizePointStyle(matchingStyle || p.style);
      var matchingPoint = labelMap[String(p.label || "").toUpperCase()];
      p.id = matchingPoint && matchingPoint.id ? matchingPoint.id : makePointId();
    }

    return parsedPoints;
  }

  function connectionKey(connection) {
    var start = String(connection.startSetId || connection.setId || "") + "/" + String(connection.startPointId || "");
    var end = String(connection.endSetId || connection.setId || "") + "/" + String(connection.endPointId || "");
    return [start, end].sort().join("::");
  }

  function addConnection(state, start, end) {
    if (!state || !start || !end || !start.pointId || !end.pointId) return { ok: false, reason: "Select two existing points." };
    if (!findPointByRef(state.pointSets, start.setId, start.pointId) || !findPointByRef(state.pointSets, end.setId, end.pointId)) return { ok: false, reason: "Select two existing points." };
    if (start.setId === end.setId && start.pointId === end.pointId) return { ok: false, reason: "Choose a different endpoint." };
    if (!Array.isArray(state.connections)) state.connections = [];
    var candidate = { id: makeConnectionId(), startSetId: start.setId, startPointId: start.pointId, endSetId: end.setId, endPointId: end.pointId };
    var key = connectionKey(candidate);
    if (state.connections.some(function (item) { return connectionKey(item) === key; })) return { ok: false, reason: "That connection already exists." };
    state.connections.push(candidate);
    return { ok: true, connection: candidate };
  }

  function selectConnectionPoint(state, pointRef) {
    if (!state || !state.connectionMode) return { ok: false, reason: "Enable Connect Points mode first." };
    if (!pointRef || !pointRef.pointId || !findPointByRef(state.pointSets, pointRef.setId, pointRef.pointId)) {
      return { ok: false, reason: "Select an existing point." };
    }
    if (!state.connectionStart) {
      state.connectionStart = { setId: pointRef.setId, pointId: pointRef.pointId };
      return { ok: true, started: true };
    }
    var result = addConnection(state, state.connectionStart, pointRef);
    if (result.ok) state.connectionStart = null;
    result.started = false;
    return result;
  }

  function cancelConnection(state) {
    if (!state) return;
    state.connectionMode = false;
    state.connectionStart = null;
  }

  function closePointSet(state, set) {
    var points = set && Array.isArray(set.points) ? set.points : [];
    var ids = Array.from(new Set(points.map(function (point) { return point.id; }).filter(Boolean)));
    if (new Set(ids).size < 3) return { ok: false, reason: "A closed shape needs at least three distinct points." };
    if (!Array.isArray(state.closedShapes)) state.closedShapes = [];
    if (state.closedShapes.some(function (shape) { return shape.setId === set.id; })) return { ok: false, reason: "This point set already has a closed shape." };
    var shape = { id: makeShapeId(), setId: set.id, pointIds: ids.slice() };
    state.closedShapes.push(shape);
    return { ok: true, shape: shape };
  }

  function prunePointReferences(state, set) {
    if (!set) return;
    var ids = Object.create(null);
    (set.points || []).forEach(function (point) { if (point.id) ids[point.id] = true; });
    state.connections = (state.connections || []).filter(function (line) {
      var startExists = line.startSetId === set.id ? ids[line.startPointId] : true;
      var endExists = line.endSetId === set.id ? ids[line.endPointId] : true;
      return startExists && endExists;
    });
    state.closedShapes = (state.closedShapes || []).filter(function (shape) {
      if (shape.setId !== set.id) return true;
      shape.pointIds = (shape.pointIds || []).filter(function (id) { return ids[id]; });
      return new Set(shape.pointIds).size >= 3;
    });
    if (state.connectionStart && state.connectionStart.setId === set.id && !ids[state.connectionStart.pointId]) state.connectionStart = null;
  }

  function makeSetId() {
    return "set-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function ensurePointOffsets(set) {
    if (!set || !set.points) return;
    if (!set.pointOffsets) set.pointOffsets = Object.create(null);
    for (var i = 0; i < set.points.length; i++) {
      var p = set.points[i];
      if (!set.pointOffsets[p.label]) {
        set.pointOffsets[p.label] = { dx: 20, dy: -20 };
      }
    }
  }

  /* ==========================================================================
     2. Mathematical Parsing & Calculation Engine (Pure Core)
     ========================================================================== */
  function parseNumberOrFractionKeepRaw(raw) {
    var s = String(raw).trim();
    var frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (frac) {
      var num = Number(frac[1]);
      var den = Number(frac[2]);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
        throw new Error("Invalid fraction: " + s);
      }
      return { value: num / den, raw: s.replace(/\s+/g, "") };
    }

    var n = Number(s);
    if (!Number.isFinite(n)) throw new Error("Invalid number: " + s);
    return { value: n, raw: s };
  }

  function parsePoints(text) {
    var lines = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var pts = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*[\(:]?\s*([-\d./\s]+)\s*[, ]\s*([-\d./\s]+)\s*\)?$/);
      if (m) {
        var xr = parseNumberOrFractionKeepRaw(m[2]);
        var yr = parseNumberOrFractionKeepRaw(m[3]);
        pts.push({ label: m[1].toUpperCase(), x: xr.value, y: yr.value, xRaw: xr.raw, yRaw: yr.raw });
        continue;
      }

      m = line.match(/^([-\d./\s]+)\s*[, ]\s*([-\d./\s]+)$/);
      if (m) {
        var xr2 = parseNumberOrFractionKeepRaw(m[1]);
        var yr2 = parseNumberOrFractionKeepRaw(m[2]);
        pts.push({ label: "", x: xr2.value, y: yr2.value, xRaw: xr2.raw, yRaw: yr2.raw });
        continue;
      }

      throw new Error("Could not parse line: " + line);
    }

    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (var j = 0; j < pts.length; j++) {
      if (!pts[j].label) {
        pts[j].label = letters[j] || ("P" + (j + 1));
      }
    }
    return pts;
  }

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

    // Always include origin (0,0) so coordinate axes can always be drawn
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
    if (worldW <= 0) worldW = 10;
    if (worldH <= 0) worldH = 10;

    var sharedScale = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
      ? window.MathForgeGraphDesignSettings.getState().axisScale : null;
    var rateX = window.MathForgeGraphScale
      ? window.MathForgeGraphScale.effectiveRate("x", 1)
      : (sharedScale ? sharedScale.x.k / sharedScale.x.n : 1);
    var rateY = window.MathForgeGraphScale
      ? window.MathForgeGraphScale.effectiveRate("y", 1)
      : (sharedScale ? sharedScale.y.k / sharedScale.y.n : 1);
    var squarePx = Math.min((W - 2 * padPx) / (worldW * rateX), (H - 2 * padPx) / (worldH * rateY));
    var zoom = viewZoom || 1.0;
    var scaleX = squarePx * rateX * zoom;
    var scaleY = squarePx * rateY * zoom;
    var baseScale = Math.min(scaleX, scaleY);
    var scale = baseScale * zoom;

    var drawW = worldW * scaleX * zoom;
    var drawH = worldH * scaleY * zoom;
    var offsetX = (W - drawW) / 2 + (viewOffset ? viewOffset.x : 0);
    var offsetY = (H - drawH) / 2 + (viewOffset ? viewOffset.y : 0);

    return {
      scale: scale,
      baseScale: baseScale,
      scaleX: scaleX,
      scaleY: scaleY,
      squarePx: squarePx * zoom,
      rateX: rateX,
      rateY: rateY,
      unitsPerSquareX: 1 / rateX,
      unitsPerSquareY: 1 / rateY,
      offsetX: offsetX,
      offsetY: offsetY,
      padPx: padPx,
      bounds: bounds,
      drawW: drawW,
      drawH: drawH,
      xToPx: function (x) { return offsetX + (x - bounds.minX) * scaleX * zoom; },
      yToPx: function (y) { return offsetY + (bounds.maxY - y) * scaleY * zoom; },
      pxToX: function (px) { return bounds.minX + (px - offsetX) / (scaleX * zoom); },
      pxToY: function (py) { return bounds.maxY - (py - offsetY) / (scaleY * zoom); }
    };
  }

  function niceStepForLabels(scale) {
    var pxPerUnit = scale;
    if (pxPerUnit >= 42) return 1;
    if (pxPerUnit >= 26) return 2;
    if (pxPerUnit >= 15) return 5;
    return 10;
  }

  function formatCoordinate(val, rawVal, precision) {
    if (precision === "auto" || precision == null || precision === "") {
      return rawVal != null ? String(rawVal) : String(val);
    }
    var p = Number(precision);
    if (isNaN(p)) return String(rawVal != null ? rawVal : val);
    var num = Number(val);
    return isNaN(num) ? String(rawVal) : num.toFixed(p);
  }

  /* ==========================================================================
     3. 2D Canvas Rendering Functions (Pure Core)
     ========================================================================== */
  function drawPointMarker(ctx, x, y, shape, color) {
    var markerShape = POINT_SHAPES.indexOf(shape) !== -1 ? shape : DEFAULT_POINT_SHAPE;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();

    switch (markerShape) {
      case "square":
        ctx.rect(-6, -6, 12, 12);
        break;
      case "triangle":
        ctx.moveTo(0, -8);
        ctx.lineTo(7, 7);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        break;
      case "diamond":
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        break;
      default:
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        break;
    }

    ctx.fillStyle = color || DEFAULT_POINT_COLOR;
    ctx.fill();
    ctx.restore();
  }

  function drawTextBox(ctx, text, x, y, options) {
    options = options || {};
    var fontSize = options.fontSize || 14;
    var typography = options.typography || { fontSizePt: 11, bold: false };
    var defaultFontSize = options.defaultFontSize || fontSize;
    var graphTypography = window.MathForgeGraphTypography;
    if (graphTypography) fontSize = graphTypography.scaledSizePx(fontSize, defaultFontSize, typography);
    var padding = options.padding || 6;
    var bg = options.bg || "rgba(255,255,255,0.92)";
    var color = options.color || (typography && typography.fontColor) || "#000000";
    var align = options.align || "left";
    var baseline = options.baseline || "middle";

    ctx.font = graphTypography ? graphTypography.font(fontSize, typography) : fontSize + 'px "Times New Roman", "Noto Sans Bengali", serif';
    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    var w = ctx.measureText(text).width;
    var h = fontSize;

    var bx = x, by = y - h / 2;
    if (align === "center") bx -= w / 2;
    if (align === "right") bx -= w;

    ctx.fillStyle = bg;
    ctx.fillRect(bx - padding, by - padding, w + padding * 2, h + padding * 2);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    return { bx: bx - padding, by: by - padding, bw: w + padding * 2, bh: h + padding * 2 };
  }

  function drawGrid(ctx, bounds, tf, settings, width, height, viewOpts) {
    viewOpts = viewOpts || {};
    var FONT = settings.FONT;
    var offsets = settings.offsets;
    var minorTick = settings.minorTick;
    var scale = tf.scale;
    var xToPx = tf.xToPx;
    var yToPx = tf.yToPx;

    var bgColor = viewOpts.canvasBgColor || "#ffffff";
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    var padPx = tf.padPx || 40;
    var visMinX = Math.min(bounds.minX, tf.pxToX ? tf.pxToX(padPx) : bounds.minX);
    var visMaxX = Math.max(bounds.maxX, tf.pxToX ? tf.pxToX(width - padPx) : bounds.maxX);
    var worldYTop = tf.pxToY ? tf.pxToY(padPx) : bounds.maxY;
    var worldYBottom = tf.pxToY ? tf.pxToY(height - padPx) : bounds.minY;
    var visMinY = Math.min(bounds.minY, Math.min(worldYTop, worldYBottom));
    var visMaxY = Math.max(bounds.maxY, Math.max(worldYTop, worldYBottom));

    var isGridOn = viewOpts.gridVisible !== false;
    if (isGridOn) {
      var gColor = viewOpts.gridColor || "#000000";
      var gOpacity = (viewOpts.gridOpacity != null) ? viewOpts.gridOpacity : 0.15;
      var logicalWidth = width;
      var logicalHeight = height;
      var paperCanvas = { width: logicalWidth, height: logicalHeight };
      var originX = xToPx(0);
      var originY = yToPx(0);
      var sharedDesign = window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState
        ? window.MathForgeGraphDesignSettings.getState() : null;
      var minorSquarePx = tf.squarePx || (sharedDesign ? sharedDesign.gridSpacing : scale / 5);
      var majorEvery = sharedDesign ? sharedDesign.majorEvery : 5;
      window.drawGraphPaper(ctx, paperCanvas, originX, originY, minorSquarePx, majorEvery, 1, {
        color: gColor,
        opacityScale: Math.max(0, Number(gOpacity) || 0) / 0.15
      });
    }

    var startX = Math.floor(visMinX);
    var endX = Math.ceil(visMaxX);
    var startY = Math.floor(visMinY);
    var endY = Math.ceil(visMaxY);
    var isXOn = viewOpts.xAxisVisible !== false;
    var isYOn = viewOpts.yAxisVisible !== false;
    var aColor = viewOpts.axisColor || "#000000";
    var aWidth = viewOpts.axisWidth || 2;
    var isAxisLabelsOn = viewOpts.axisLabelsVisible !== false;

    window.drawInfiniteAxes(ctx, { width: width, height: height }, xToPx(0), yToPx(0), {
      color: aColor,
      fontColor: viewOpts.fontColor || aColor,
      lineWidth: aWidth,
      fontSize: FONT.axis,
      typography: viewOpts.typography,
      showX: isXOn,
      showY: isYOn,
      showLabels: isAxisLabelsOn,
      showOrigin: isAxisLabelsOn
    });

    var majorInterval = sharedDesign && Number(sharedDesign.majorEvery) > 0 ? Number(sharedDesign.majorEvery) : 5;
    var stepX = tf.unitsPerSquareX * majorInterval;
    var stepY = tf.unitsPerSquareY * majorInterval;
    function axisLabel(value) {
      var clean = Math.abs(value) < 1e-10 ? 0 : value;
      return String(Number(clean.toFixed(8)));
    }

    if (isXOn) {
      for (var tx = Math.ceil(startX / stepX) * stepX; tx <= endX; tx += stepX) {
        var px = xToPx(tx);
        var py = yToPx(0);

        ctx.save();
        ctx.strokeStyle = aColor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = minorTick.width;
        ctx.beginPath();
        ctx.moveTo(px, py - minorTick.len);
        ctx.lineTo(px, py + minorTick.len);
        ctx.stroke();
        ctx.restore();

        if (isAxisLabelsOn && tx !== 0) {
          drawTextBox(ctx, axisLabel(tx), px + offsets.xTick.dx, py + offsets.xTick.dy, { fontSize: FONT.ticks, defaultFontSize: 16, typography: viewOpts.typography, align: "center", color: viewOpts.fontColor || aColor });
        }
      }
    }

    if (isYOn) {
      for (var ty = Math.ceil(startY / stepY) * stepY; ty <= endY; ty += stepY) {
        var py2 = yToPx(ty);
        var px2 = xToPx(0);

        ctx.save();
        ctx.strokeStyle = aColor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = minorTick.width;
        ctx.beginPath();
        ctx.moveTo(px2 - minorTick.len, py2);
        ctx.lineTo(px2 + minorTick.len, py2);
        ctx.stroke();
        ctx.restore();

        if (isAxisLabelsOn && ty !== 0) {
          drawTextBox(ctx, axisLabel(ty), px2 + offsets.yTick.dx, py2 + offsets.yTick.dy, { fontSize: FONT.ticks, defaultFontSize: 16, typography: viewOpts.typography, align: "right", color: viewOpts.fontColor || aColor });
        }
      }
    }

  }

  function drawSetPolygon(ctx, set, tf) {
    if (!set || !set.points || set.points.length < 3) return;
    var renderOptions = set.renderOptions || defaultRenderOptions();
    if (!renderOptions.polygon || !renderOptions.polygon.visible) return;

    var poly = renderOptions.polygon;
    var xToPx = tf.xToPx;
    var yToPx = tf.yToPx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(set.points[0].x), yToPx(set.points[0].y));
    for (var i = 1; i < set.points.length; i++) {
      ctx.lineTo(xToPx(set.points[i].x), yToPx(set.points[i].y));
    }
    ctx.closePath();

    if (poly.fillVisible !== false && poly.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(poly.fillOpacity) || 0));
      ctx.fillStyle = poly.fillColor || DEFAULT_FILL_COLOR;
      ctx.fill();
      ctx.restore();
    }

    if (poly.borderVisible !== false) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.setLineDash(resolveDashPattern(poly.borderStyle));
      ctx.strokeStyle = poly.borderColor || DEFAULT_BORDER_COLOR;
      ctx.lineWidth = Math.max(1, Number(poly.borderWidth) || 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDiagonalsForSets(ctx, sets, tf) {
    if (!sets || sets.length === 0) return;
    for (var s = 0; s < sets.length; s++) {
      var set = sets[s];
      var renderOptions = set.renderOptions || defaultRenderOptions();
      var diag = renderOptions.diagonals;
      if (!diag || !diag.visible || !set.points || set.points.length < 4) continue;

      var xToPx = tf.xToPx;
      var yToPx = tf.yToPx;
      var A = set.points[0], B = set.points[1], C = set.points[2], D = set.points[3];

      ctx.save();
      ctx.setLineDash(resolveDashPattern(diag.style));
      ctx.lineWidth = Math.max(1, Number(diag.width) || 2);
      ctx.strokeStyle = diag.color || DEFAULT_DIAGONAL_COLOR;
      ctx.beginPath(); ctx.moveTo(xToPx(A.x), yToPx(A.y)); ctx.lineTo(xToPx(C.x), yToPx(C.y)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xToPx(B.x), yToPx(B.y)); ctx.lineTo(xToPx(D.x), yToPx(D.y)); ctx.stroke();
      ctx.restore();
    }
  }

  function findPointByRef(sets, setId, pointId) {
    var set = (sets || []).find(function (item) { return item.id === setId; });
    var point = set && (set.points || []).find(function (item) { return item.id === pointId; });
    return point ? { set: set, point: point } : null;
  }

  function drawClosedShapes(ctx, state, sets, tf) {
    (state.closedShapes || []).forEach(function (shape) {
      var set = (sets || []).find(function (item) { return item.id === shape.setId; });
      var ids = Array.from(new Set((shape.pointIds || []).filter(function (id) {
        return set && (set.points || []).some(function (point) { return point.id === id; });
      })));
      if (ids.length < 3 || new Set(ids).size < 3) return;
      var points = ids.map(function (id) { return set.points.find(function (point) { return point.id === id; }); });
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tf.xToPx(points[0].x), tf.yToPx(points[0].y));
      for (var i = 1; i < points.length; i++) ctx.lineTo(tf.xToPx(points[i].x), tf.yToPx(points[i].y));
      ctx.closePath();
      if (state.fillEnabled && Number(state.fillOpacity) > 0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, Number(state.fillOpacity) || 0));
        ctx.fillStyle = /^#[0-9a-fA-F]{6}$/.test(state.fillColor || "") ? state.fillColor : DEFAULT_FILL_COLOR;
        ctx.fill();
        ctx.restore();
      }
      if (state.connectionsVisible !== false) {
        ctx.save();
        ctx.setLineDash(resolveDashPattern(state.connectionStyle));
        ctx.strokeStyle = /^#[0-9a-fA-F]{6}$/.test(state.connectionColor || "") ? state.connectionColor : DEFAULT_CONNECTION_COLOR;
        ctx.lineWidth = Math.max(1, Math.min(16, Number(state.connectionWidth) || 2));
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    });
  }

  function drawConnections(ctx, state, sets, tf) {
    if (state.connectionsVisible === false) return;
    var closedEdges = Object.create(null);
    (state.closedShapes || []).forEach(function (shape) {
      var ids = shape.pointIds || [];
      for (var i = 0; i < ids.length; i++) {
        var a = ids[i], b = ids[(i + 1) % ids.length];
        closedEdges[shape.setId + ":" + [a, b].sort().join(":")] = true;
      }
    });
    ctx.save();
    ctx.setLineDash(resolveDashPattern(state.connectionStyle));
    ctx.strokeStyle = /^#[0-9a-fA-F]{6}$/.test(state.connectionColor || "") ? state.connectionColor : DEFAULT_CONNECTION_COLOR;
    ctx.lineWidth = Math.max(1, Math.min(16, Number(state.connectionWidth) || 2));
    (state.connections || []).forEach(function (line) {
      var key = line.startSetId === line.endSetId
        ? line.startSetId + ":" + [line.startPointId, line.endPointId].sort().join(":") : "";
      if (key && closedEdges[key]) return;
      var start = findPointByRef(sets, line.startSetId, line.startPointId);
      var end = findPointByRef(sets, line.endSetId, line.endPointId);
      if (!start || !end) return;
      ctx.beginPath();
      ctx.moveTo(tf.xToPx(start.point.x), tf.yToPx(start.point.y));
      ctx.lineTo(tf.xToPx(end.point.x), tf.yToPx(end.point.y));
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSet(ctx, set, tf, settings, showLabels, labelBoxes, coordPrecision) {
    if (!set || !set.points || set.points.length === 0) return;
    var FONT = settings.FONT;
    var xToPx = tf.xToPx;
    var yToPx = tf.yToPx;

    drawSetPolygon(ctx, set, tf);

    for (var i = 0; i < set.points.length; i++) {
      var p = set.points[i];
      var px = xToPx(p.x), py = yToPx(p.y);
      var pStyle = normalizePointStyle(p.style);
      drawPointMarker(ctx, px, py, pStyle.shape, pStyle.color);

      if (showLabels) {
        var off = (set.pointOffsets && set.pointOffsets[p.label]) ? set.pointOffsets[p.label] : { dx: 20, dy: -20 };
        var prec = coordPrecision || "auto";
        var text = p.label + "(" + formatCoordinate(p.x, p.xRaw, prec) + ", " + formatCoordinate(p.y, p.yRaw, prec) + ")";
        var targetX = px + off.dx;
        var targetY = py + off.dy;

        // Collision avoidance: if using default offset and collides with existing label box, stagger vertically
        if (!set.pointOffsets || !set.pointOffsets[p.label]) {
          var shifts = 0;
          while (shifts < 4) {
            var collides = false;
            for (var b = 0; b < labelBoxes.length; b++) {
              var box = labelBoxes[b];
              if (Math.abs(targetX - box.x) < 45 && Math.abs(targetY - box.y) < 20) {
                collides = true;
                break;
              }
            }
            if (collides) {
              targetY += 22;
              shifts++;
            } else {
              break;
            }
          }
        }

        var bbox = drawTextBox(ctx, text, targetX, targetY, { fontSize: FONT.point, defaultFontSize: 17, typography: settings.typography, align: "left" });
        labelBoxes.push({ setId: set.id, label: p.label, x: bbox.bx, y: bbox.by, w: bbox.bw, h: bbox.bh });
      }
    }
  }

  function hitTestLabel(labelBoxes, mx, my) {
    for (var i = labelBoxes.length - 1; i >= 0; i--) {
      var b = labelBoxes[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  /* ==========================================================================
     4. Coordinates Graph Engine Instance (Stateful Controller)
     ========================================================================== */
  function createCoordinatesEngine() {
    var state = {
      pointSets: [],
      activeSetId: null,
      connections: [],
      connectionsVisible: true,
      connectionColor: DEFAULT_CONNECTION_COLOR,
      connectionWidth: 2,
      connectionStyle: "solid",
      connectionMode: false,
      connectionStart: null,
      closedShapes: [],
      fillEnabled: false,
      fillColor: DEFAULT_FILL_COLOR,
      fillOpacity: 0.18,
      viewZoom: 1.0,
      viewOffset: { x: 0, y: 0 },
      canvasBgColor: "#ffffff",
      marginUnits: 2,
      showLabels: true,
      coordPrecision: "auto",
      gridVisible: true,
      gridColor: "#000000",
      gridOpacity: 0.15,
      xAxisVisible: true,
      yAxisVisible: true,
      axisColor: "#000000",
      axisWidth: 2,
      axisLabelsVisible: true,
      fontAxis: 20,
      fontTicks: 16,
      fontPoint: 17,
      fontSizePt: 11,
      bold: false,
      minorTickWidth: 2,
      minorTickLen: 8,
      xTickDX: 0,
      xTickDY: 28,
      yTickDX: -20,
      yTickDY: 0,
      oDX: 16,
      oDY: 18
    };

    var setRenderOptionsMap = new Map();
    var labelBoxes = [];
    var lastTf = null;
    var drag = { active: false, mode: null, setId: null, label: null, startMouseX: 0, startMouseY: 0, startDX: 0, startDY: 0, startPanX: 0, startPanY: 0 };

    function buildSet(name, inputText) {
      var set = {
        id: makeSetId(),
        name: name || ("Set " + (state.pointSets.length + 1)),
        inputText: String(inputText != null ? inputText : defaultSampleText()),
        points: [],
        pointOffsets: Object.create(null),
        renderOptions: defaultRenderOptions()
      };

      if (set.inputText.trim()) {
        try {
          var parsed = parsePoints(set.inputText);
          set.points = preservePointStyles([], parsed);
        } catch (err) {
          set.points = [];
        }
      }

      ensurePointOffsets(set);
      set.renderOptions = defaultRenderOptions();
      setRenderOptionsMap.set(set.id, set.renderOptions);
      return set;
    }

    function initDefaultSets() {
      state.pointSets.length = 0;
      var s1 = buildSet("Set 1", "");
      state.pointSets.push(s1);
      state.activeSetId = s1.id;
    }

    initDefaultSets();

    function getSetById(id) {
      for (var i = 0; i < state.pointSets.length; i++) {
        if (state.pointSets[i].id === id) return state.pointSets[i];
      }
      return state.pointSets[0] || null;
    }

    function getActiveSet() {
      return getSetById(state.activeSetId);
    }

    function getSettings() {
      return {
        FONT: {
          axis: state.fontAxis,
          ticks: state.fontTicks,
          point: state.fontPoint,
          caption: Math.max(14, state.fontTicks)
        },
        typography: window.MathForgeGraphTypography
          ? window.MathForgeGraphTypography.read(
              document.getElementById("mfGraphFontSizePt"),
              document.getElementById("mfGraphBold"),
              document.getElementById("mfGraphFontFamily"),
              document.getElementById("mfGraphFontColor")
            )
          : { fontSizePt: state.fontSizePt, bold: state.bold },
        minorTick: {
          width: state.minorTickWidth,
          len: state.minorTickLen
        },
        offsets: {
          xTick: { dx: state.xTickDX, dy: state.xTickDY },
          yTick: { dx: state.yTickDX, dy: state.yTickDY },
          origin: { dx: state.oDX, dy: state.oDY }
        }
      };
    }

    function draw(canvas) {
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;

      var allPoints = [];
      for (var s = 0; s < state.pointSets.length; s++) {
        var set = state.pointSets[s];
        if (set.inputText && set.inputText.trim()) {
          try {
            var parsed = parsePoints(set.inputText);
            set.points = preservePointStyles(set.points, parsed);
            ensurePointOffsets(set);
            allPoints.push.apply(allPoints, set.points);
          } catch (e) {
            // retain parsed points
          }
        }
      }

      var settings = getSettings();
      var dataBounds = computeBounds(allPoints, state.marginUnits);
      var padPx = Math.max(38, Math.min(52, Math.round(settings.FONT.axis * 1.5 + settings.FONT.ticks * 1.2)));

      var logicalW = canvas.clientWidth || (canvas._mfAppliedDpr ? Math.round(canvas.width / canvas._mfAppliedDpr) : canvas.width);
      var logicalH = canvas.clientHeight || (canvas._mfAppliedDpr ? Math.round(canvas.height / canvas._mfAppliedDpr) : canvas.height);

      var fittedBounds = computeFittedBounds(dataBounds, padPx, logicalW, logicalH);
      var tf = makeTransform(fittedBounds, padPx, logicalW, logicalH, state.viewZoom, state.viewOffset);
      lastTf = tf;

      labelBoxes = [];
      drawGrid(ctx, fittedBounds, tf, settings, logicalW, logicalH, {
        canvasBgColor: state.canvasBgColor,
        gridVisible: state.gridVisible,
        gridColor: state.gridColor,
        gridOpacity: state.gridOpacity,
        typography: settings.typography,
        xAxisVisible: state.xAxisVisible,
        yAxisVisible: state.yAxisVisible,
        axisColor: state.axisColor,
        axisWidth: state.axisWidth,
        axisLabelsVisible: state.axisLabelsVisible,
        fontColor: settings.typography.fontColor
      });

      if (state.connectionsVisible !== false) drawDiagonalsForSets(ctx, state.pointSets, tf);
      drawClosedShapes(ctx, state, state.pointSets, tf);
      drawConnections(ctx, state, state.pointSets, tf);
      for (var j = 0; j < state.pointSets.length; j++) {
        drawSet(ctx, state.pointSets[j], tf, settings, state.showLabels, labelBoxes, state.coordPrecision);
      }
      if (state.connectionStart) {
        var selected = findPointByRef(state.pointSets, state.connectionStart.setId, state.connectionStart.pointId);
        if (selected) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(tf.xToPx(selected.point.x), tf.yToPx(selected.point.y), 11, 0, Math.PI * 2);
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.stroke();
          ctx.restore();
        }
      }
      drawTextBox(ctx, "Small grid = 1 unit", 16, logicalH - 14, { fontSize: settings.FONT.caption, defaultFontSize: 16, typography: settings.typography, align: "left" });
    }

    function resetView() {
      state.viewZoom = 1.0;
      state.viewOffset.x = 0;
      state.viewOffset.y = 0;
    }

    function hitTestPointMarker(mx, my) {
      if (!lastTf) return null;
      var threshold = 12; // 12px hit radius around marker
      var thresholdSq = threshold * threshold;
      for (var s = state.pointSets.length - 1; s >= 0; s--) {
        var set = state.pointSets[s];
        if (!set.points) continue;
        for (var i = set.points.length - 1; i >= 0; i--) {
          var p = set.points[i];
          var px = lastTf.xToPx(p.x);
          var py = lastTf.yToPx(p.y);
          var distSq = (mx - px) * (mx - px) + (my - py) * (my - py);
          if (distSq <= thresholdSq) {
            return { setId: set.id, label: p.label, point: p, px: px, py: py };
          }
        }
      }
      return null;
    }

    return {
      state: state,
      buildSet: buildSet,
      getSetById: getSetById,
      getActiveSet: getActiveSet,
      getSettings: getSettings,
      draw: draw,
      resetView: resetView,
      hitTestPointMarker: hitTestPointMarker,
      addConnection: function (start, end) { return addConnection(state, start, end); },
      selectConnectionPoint: function (pointRef) { return selectConnectionPoint(state, pointRef); },
      cancelConnection: function () { cancelConnection(state); },
      closePointSet: function (set) { return closePointSet(state, set); },
      prunePointReferences: function (set) { prunePointReferences(state, set); },
      getLastTransform: function () { return lastTf; },
      getLabelBoxes: function () { return labelBoxes; },
      getDrag: function () { return drag; }
    };
  }

  /* ==========================================================================
     5. Standalone Page Bridge (For Coordinates_graph.html)
     ========================================================================== */
  function initStandalone(doc) {
    doc = doc || document;
    var canvas = doc.getElementById("canvas");
    if (!canvas) return;

    var engine = createCoordinatesEngine();
    var state = engine.state;
    var drag = engine.getDrag();
    var graphTypography = window.MathForgeGraphTypography;
    var typographyHost = doc.getElementById("fontAxis");
    typographyHost = typographyHost && typographyHost.closest ? typographyHost.closest(".body") : null;
    var typographyControls = graphTypography && graphTypography.ensureControls(doc, "coord", typographyHost);

    var pointsInput = doc.getElementById("pointsInput");
    var marginUnitsEl = doc.getElementById("marginUnits");
    var showDiagonalsEl = doc.getElementById("showDiagonals");
    var showLabelsEl = doc.getElementById("showLabels");
    var viewZoomEl = doc.getElementById("viewZoom");
    var viewZoomValEl = doc.getElementById("viewZoomVal");
    var canvasBgColorEl = doc.getElementById("canvasBgColor");
    var resetViewBtn = doc.getElementById("resetViewBtn");
    var resetBgBtn = doc.getElementById("resetBgBtn");
    var gridVisibleEl = doc.getElementById("gridVisible");
    var gridColorEl = doc.getElementById("gridColor");
    var gridOpacityEl = doc.getElementById("gridOpacity");
    var gridOpacityValEl = doc.getElementById("gridOpacityVal");
    var xAxisVisibleEl = doc.getElementById("xAxisVisible");
    var yAxisVisibleEl = doc.getElementById("yAxisVisible");
    var axisColorEl = doc.getElementById("axisColor");
    var axisWidthEl = doc.getElementById("axisWidth");
    var axisWidthValEl = doc.getElementById("axisWidthVal");
    var axisLabelsVisibleEl = doc.getElementById("axisLabelsVisible");
    var coordPrecisionEl = doc.getElementById("coordPrecision");
    var polygonVisibleEl = doc.getElementById("polygonVisible");
    var polygonFillVisibleEl = doc.getElementById("polygonFillVisible");
    var polygonFillColorEl = doc.getElementById("polygonFillColor");
    var polygonFillOpacityEl = doc.getElementById("polygonFillOpacity");
    var polygonFillOpacityValEl = doc.getElementById("polygonFillOpacityVal");
    var polygonBorderVisibleEl = doc.getElementById("polygonBorderVisible");
    var polygonBorderColorEl = doc.getElementById("polygonBorderColor");
    var polygonBorderWidthEl = doc.getElementById("polygonBorderWidth");
    var polygonBorderWidthValEl = doc.getElementById("polygonBorderWidthVal");
    var diagonalColorEl = doc.getElementById("diagonalColor");
    var diagonalWidthEl = doc.getElementById("diagonalWidth");
    var diagonalWidthValEl = doc.getElementById("diagonalWidthVal");
    var diagonalStyleEl = doc.getElementById("diagonalStyle");
    var pointControlsWrap = doc.getElementById("pointControls");
    var setListEl = doc.getElementById("setList");
    var addSetBtn = doc.getElementById("addSetBtn");

    var controls = {
      fontAxis: doc.getElementById("fontAxis"),
      fontTicks: doc.getElementById("fontTicks"),
      fontPoint: doc.getElementById("fontPoint"),
      minorTickWidth: doc.getElementById("minorTickWidth"),
      minorTickLen: doc.getElementById("minorTickLen"),
      xTickDX: doc.getElementById("xTickDX"),
      xTickDY: doc.getElementById("xTickDY"),
      yTickDX: doc.getElementById("yTickDX"),
      yTickDY: doc.getElementById("yTickDY"),
      oDX: doc.getElementById("oDX"),
      oDY: doc.getElementById("oDY")
    };

    var valSpans = {
      fontAxisVal: doc.getElementById("fontAxisVal"),
      fontTicksVal: doc.getElementById("fontTicksVal"),
      fontPointVal: doc.getElementById("fontPointVal"),
      minorTickWidthVal: doc.getElementById("minorTickWidthVal"),
      minorTickLenVal: doc.getElementById("minorTickLenVal"),
      xTickDXVal: doc.getElementById("xTickDXVal"),
      xTickDYVal: doc.getElementById("xTickDYVal"),
      yTickDXVal: doc.getElementById("yTickDXVal"),
      yTickDYVal: doc.getElementById("yTickDYVal"),
      oDXVal: doc.getElementById("oDXVal"),
      oDYVal: doc.getElementById("oDYVal")
    };

    function refreshValueLabels() {
      for (var k in valSpans) {
        if (valSpans.hasOwnProperty(k)) {
          var inputId = k.replace("Val", "");
          var input = doc.getElementById(inputId);
          if (input && valSpans[k]) {
            valSpans[k].textContent = input.value;
          }
        }
      }
    }

    function syncStateFromUI() {
      if (marginUnitsEl) state.marginUnits = Number(marginUnitsEl.value || 0);
      if (showLabelsEl) state.showLabels = showLabelsEl.checked;
      if (coordPrecisionEl) state.coordPrecision = coordPrecisionEl.value;
      if (gridVisibleEl) state.gridVisible = gridVisibleEl.checked;
      if (gridColorEl) state.gridColor = gridColorEl.value;
      if (gridOpacityEl) state.gridOpacity = Number(gridOpacityEl.value) / 100;
      if (xAxisVisibleEl) state.xAxisVisible = xAxisVisibleEl.checked;
      if (yAxisVisibleEl) state.yAxisVisible = yAxisVisibleEl.checked;
      if (axisColorEl) state.axisColor = axisColorEl.value;
      if (axisWidthEl) state.axisWidth = Number(axisWidthEl.value) || 2;
      if (axisLabelsVisibleEl) state.axisLabelsVisible = axisLabelsVisibleEl.checked;
      if (canvasBgColorEl) state.canvasBgColor = canvasBgColorEl.value;
      if (viewZoomEl) state.viewZoom = Number(viewZoomEl.value) || 1.0;
      if (typographyControls) {
        var typography = graphTypography.read(typographyControls.sizeInput, typographyControls.boldInput);
        state.fontSizePt = typography.fontSizePt;
        state.bold = typography.bold;
      }

      for (var c in controls) {
        if (controls.hasOwnProperty(c) && controls[c]) {
          state[c] = Number(controls[c].value);
        }
      }

      var activeSet = engine.getActiveSet();
      if (activeSet && activeSet.renderOptions) {
        var poly = activeSet.renderOptions.polygon;
        var diag = activeSet.renderOptions.diagonals;
        if (polygonVisibleEl) poly.visible = polygonVisibleEl.checked;
        if (polygonFillVisibleEl) poly.fillVisible = polygonFillVisibleEl.checked;
        if (polygonFillColorEl) poly.fillColor = polygonFillColorEl.value;
        if (polygonFillOpacityEl) poly.fillOpacity = Number(polygonFillOpacityEl.value) / 100;
        if (polygonBorderVisibleEl) poly.borderVisible = polygonBorderVisibleEl.checked;
        if (polygonBorderColorEl) poly.borderColor = polygonBorderColorEl.value;
        if (polygonBorderWidthEl) poly.borderWidth = Number(polygonBorderWidthEl.value) || 3;

        if (showDiagonalsEl) diag.visible = showDiagonalsEl.checked;
        if (diagonalColorEl) diag.color = diagonalColorEl.value;
        if (diagonalWidthEl) diag.width = Number(diagonalWidthEl.value) || 2;
        if (diagonalStyleEl) diag.style = normalizeLineStyle(diagonalStyleEl.value);
      }
    }

    function syncUIFromActiveSet() {
      var activeSet = engine.getActiveSet();
      if (!activeSet) return;
      var opts = activeSet.renderOptions || defaultRenderOptions();
      var poly = opts.polygon;
      var diag = opts.diagonals;

      if (polygonVisibleEl) polygonVisibleEl.checked = Boolean(poly.visible);
      if (polygonFillVisibleEl) polygonFillVisibleEl.checked = poly.fillVisible !== false;
      if (polygonFillColorEl) polygonFillColorEl.value = poly.fillColor || DEFAULT_FILL_COLOR;
      if (polygonFillOpacityEl) {
        var op = Math.round((Number(poly.fillOpacity) || 0) * 100);
        polygonFillOpacityEl.value = String(op);
        if (polygonFillOpacityValEl) polygonFillOpacityValEl.textContent = op + "%";
      }
      if (polygonBorderVisibleEl) polygonBorderVisibleEl.checked = Boolean(poly.borderVisible);
      if (polygonBorderColorEl) polygonBorderColorEl.value = poly.borderColor || DEFAULT_BORDER_COLOR;
      if (polygonBorderWidthEl) {
        polygonBorderWidthEl.value = String(Math.max(1, Number(poly.borderWidth) || 3));
        if (polygonBorderWidthValEl) polygonBorderWidthValEl.textContent = polygonBorderWidthEl.value;
      }
      if (diagonalColorEl) diagonalColorEl.value = diag.color || DEFAULT_DIAGONAL_COLOR;
      if (diagonalWidthEl) {
        diagonalWidthEl.value = String(Math.max(1, Number(diag.width) || 2));
        if (diagonalWidthValEl) diagonalWidthValEl.textContent = diagonalWidthEl.value;
      }
      if (diagonalStyleEl) diagonalStyleEl.value = normalizeLineStyle(diag.style);
      if (showDiagonalsEl) showDiagonalsEl.checked = Boolean(diag.visible);
      if (typographyControls) {
        if (!window.MathForgeGraphDesignSettings) {
          typographyControls.sizeInput.value = String(state.fontSizePt || 11);
          typographyControls.boldInput.checked = Boolean(state.bold);
        }
      }
    }

    function rebuildPointControls(points) {
      if (!pointControlsWrap) return;
      var activeSet = engine.getActiveSet();
      if (!activeSet) return;
      pointControlsWrap.innerHTML = "";

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var label = p.label;
        var off = (activeSet.pointOffsets && activeSet.pointOffsets[label]) ? activeSet.pointOffsets[label] : { dx: 20, dy: -20 };
        var pStyle = normalizePointStyle(p.style);

        var card = doc.createElement("div");
        card.className = "pointCard";

        var head = doc.createElement("div");
        head.className = "pointCardHeader";
        head.innerHTML = "<span>" + escapeHtml(activeSet.name) + " â€¢ " + escapeHtml(label) + " label offset</span><span style=\"opacity:.85\">" + escapeHtml(label) + "(" + p.xRaw + ", " + p.yRaw + ")</span>";
        card.appendChild(head);

        var rowDX = doc.createElement("div");
        rowDX.className = "miniRow";
        rowDX.innerHTML = "<label>dx (px)</label>" +
          "<input id=\"pt-" + activeSet.id + "-" + label + "-dx\" type=\"range\" min=\"-220\" max=\"260\" value=\"" + off.dx + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-key=\"dx\">" +
          "<div class=\"val\" id=\"val-" + activeSet.id + "-" + label + "-dx\">" + off.dx + "</div>";
        card.appendChild(rowDX);

        var rowDY = doc.createElement("div");
        rowDY.className = "miniRow";
        rowDY.innerHTML = "<label>dy (px)</label>" +
          "<input id=\"pt-" + activeSet.id + "-" + label + "-dy\" type=\"range\" min=\"-240\" max=\"220\" value=\"" + off.dy + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-key=\"dy\">" +
          "<div class=\"val\" id=\"val-" + activeSet.id + "-" + label + "-dy\">" + off.dy + "</div>";
        card.appendChild(rowDY);

        var colorRow = doc.createElement("div");
        colorRow.className = "styleRow";
        colorRow.innerHTML = "<label>Color</label><input type=\"color\" value=\"" + pStyle.color + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-style-key=\"color\">";
        card.appendChild(colorRow);

        var shapeRow = doc.createElement("div");
        shapeRow.className = "styleRow";
        var shapeSelect = doc.createElement("select");
        shapeSelect.dataset.setId = activeSet.id;
        shapeSelect.dataset.label = label;
        shapeSelect.dataset.styleKey = "shape";
        for (var s = 0; s < POINT_SHAPES.length; s++) {
          var shape = POINT_SHAPES[s];
          var option = doc.createElement("option");
          option.value = shape;
          option.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
          if (shape === pStyle.shape) option.selected = true;
          shapeSelect.appendChild(option);
        }
        shapeRow.innerHTML = "<label>Shape</label>";
        shapeRow.appendChild(shapeSelect);
        card.appendChild(shapeRow);

        (function (curCard, curLabel) {
          curCard.querySelectorAll("input[type='range']").forEach(function (sl) {
            sl.addEventListener("input", function (e) {
              var sId = e.target.dataset.setId;
              var lab = e.target.dataset.label;
              var key = e.target.dataset.key;
              var targetSet = engine.getSetById(sId);
              if (!targetSet.pointOffsets[lab]) targetSet.pointOffsets[lab] = { dx: 20, dy: -20 };
              targetSet.pointOffsets[lab][key] = Number(e.target.value);
              var vEl = doc.getElementById("val-" + sId + "-" + lab + "-" + key);
              if (vEl) vEl.textContent = e.target.value;
              engine.draw(canvas);
            });
          });

          var colInp = colorRow.querySelector("input[type='color']");
          if (colInp) {
            colInp.addEventListener("input", function (e) {
              var targetSet = engine.getSetById(e.target.dataset.setId);
              var pt = targetSet.points.find(function (p) { return p.label === curLabel; });
              if (pt) {
                pt.style = normalizePointStyle({ color: e.target.value, shape: pt.style.shape });
                engine.draw(canvas);
              }
            });
          }

          shapeSelect.addEventListener("change", function (e) {
            var targetSet = engine.getSetById(e.target.dataset.setId);
            var pt = targetSet.points.find(function (p) { return p.label === curLabel; });
            if (pt) {
              pt.style = normalizePointStyle({ color: pt.style.color, shape: e.target.value });
              engine.draw(canvas);
            }
          });
        })(card, label);

        pointControlsWrap.appendChild(card);
      }
    }

    function updatePointSliderUI(setId, label) {
      var targetSet = engine.getSetById(setId);
      var off = (targetSet && targetSet.pointOffsets && targetSet.pointOffsets[label]) ? targetSet.pointOffsets[label] : { dx: 20, dy: -20 };
      var dxEl = doc.getElementById("pt-" + setId + "-" + label + "-dx");
      var dyEl = doc.getElementById("pt-" + setId + "-" + label + "-dy");
      var dxVal = doc.getElementById("val-" + setId + "-" + label + "-dx");
      var dyVal = doc.getElementById("val-" + setId + "-" + label + "-dy");
      if (dxEl && dxVal) { dxEl.value = off.dx; dxVal.textContent = off.dx; }
      if (dyEl && dyVal) { dyEl.value = off.dy; dyVal.textContent = off.dy; }
    }

    function refreshSetManager() {
      if (!setListEl) return;
      setListEl.innerHTML = "";
      state.pointSets.forEach(function (set, index) {
        var row = doc.createElement("div");
        row.className = "setItem" + (set.id === state.activeSetId ? " active" : "");

        var nameRow = doc.createElement("div");
        nameRow.className = "setItemRow";

        var nameEl = doc.createElement("input");
        nameEl.type = "text";
        nameEl.className = "setNameInput";
        nameEl.value = set.name || ("Set " + (index + 1));
        nameEl.addEventListener("input", function () {
          set.name = nameEl.value.trim() || ("Set " + (index + 1));
          refreshSetManager();
          engine.draw(canvas);
        });

        var selectBtn = doc.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "setBtn";
        selectBtn.textContent = set.id === state.activeSetId ? "Active" : "Select";
        selectBtn.disabled = set.id === state.activeSetId;
        selectBtn.addEventListener("click", function () {
          state.activeSetId = set.id;
          renderAll();
        });

        var removeBtn = doc.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "setBtn";
        removeBtn.textContent = "Remove";
        removeBtn.disabled = state.pointSets.length <= 1;
        removeBtn.addEventListener("click", function () {
          if (state.pointSets.length <= 1) return;
          var removeIndex = state.pointSets.findIndex(function (s) { return s.id === set.id; });
          state.pointSets.splice(removeIndex, 1);
          state.activeSetId = state.pointSets[Math.max(0, removeIndex - 1)].id;
          renderAll();
        });

        nameRow.appendChild(nameEl);
        var actionWrap = doc.createElement("div");
        actionWrap.className = "setItemActions";
        actionWrap.appendChild(selectBtn);
        actionWrap.appendChild(removeBtn);
        nameRow.appendChild(actionWrap);
        row.appendChild(nameRow);
        setListEl.appendChild(row);
      });
    }

    function renderAll() {
      refreshSetManager();
      var activeSet = engine.getActiveSet();
      if (activeSet) {
        if (pointsInput) pointsInput.value = activeSet.inputText;
        rebuildPointControls(activeSet.points);
        syncUIFromActiveSet();
      }
      refreshValueLabels();
      syncStateFromUI();
      engine.draw(canvas);
    }

    function canvasPointFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      var logicalW = canvas.clientWidth || (canvas._mfAppliedDpr ? Math.round(canvas.width / canvas._mfAppliedDpr) : canvas.width);
      var logicalH = canvas.clientHeight || (canvas._mfAppliedDpr ? Math.round(canvas.height / canvas._mfAppliedDpr) : canvas.height);
      var scaleX = rect.width > 0 ? (logicalW / rect.width) : 1;
      var scaleY = rect.height > 0 ? (logicalH / rect.height) : 1;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    function setCanvasCursor(mode) {
      canvas.classList.remove("dragging");
      canvas.classList.remove("can-drag");
      if (mode === "dragging") {
        canvas.classList.add("dragging");
        canvas.style.cursor = "grabbing";
      } else if (mode === "can-drag") {
        canvas.classList.add("can-drag");
        canvas.style.cursor = "grab";
      } else if (mode === "pointer") {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "default";
      }
    }

    function handleStandaloneDragMouseMove(e) {
      if (!drag.active) return;
      if (e._mfHandledStandaloneDrag) return;
      e._mfHandledStandaloneDrag = true;

      var pt = canvasPointFromEvent(e);
      var dx = pt.x - drag.startMouseX;
      var dy = pt.y - drag.startMouseY;

      if (drag.mode === "pan") {
        state.viewOffset.x = drag.startPanX + dx;
        state.viewOffset.y = drag.startPanY + dy;
        engine.draw(canvas);
        setCanvasCursor("dragging");
        return;
      }

      if (drag.mode === "label") {
        var targetSet = engine.getSetById(drag.setId);
        if (!targetSet) return;
        if (!targetSet.pointOffsets) targetSet.pointOffsets = Object.create(null);
        var currentOff = targetSet.pointOffsets[drag.label] || { dx: 20, dy: -20 };
        currentOff.dx = Math.round(drag.startDX + dx);
        currentOff.dy = Math.round(drag.startDY + dy);
        targetSet.pointOffsets[drag.label] = currentOff;
        updatePointSliderUI(drag.setId, drag.label);
        engine.draw(canvas);
        setCanvasCursor("dragging");
        return;
      }

      if (drag.mode === "point-marker") {
        setCanvasCursor("pointer");
        return;
      }
    }

    // Canvas Mouse Interactions (Empty space pan, Label drag, Wheel zoom)
    canvas.addEventListener("mousemove", function (e) {
      if (drag.active) {
        handleStandaloneDragMouseMove(e);
        return;
      }

      var pt = canvasPointFromEvent(e);
      var hitL = hitTestLabel(engine.getLabelBoxes(), pt.x, pt.y);
      if (hitL) {
        setCanvasCursor("can-drag");
      } else if (engine.hitTestPointMarker(pt.x, pt.y)) {
        setCanvasCursor("pointer");
      } else {
        setCanvasCursor(null);
      }
    });

    if (doc.defaultView) {
      doc.defaultView.addEventListener("mousemove", function (e) {
        if (drag.active) {
          handleStandaloneDragMouseMove(e);
        }
      });
    }

    canvas.addEventListener("mousedown", function (e) {
      var pt = canvasPointFromEvent(e);
      var hit = hitTestLabel(engine.getLabelBoxes(), pt.x, pt.y);

      if (hit) {
        drag.active = true;
        drag.mode = "label";
        drag.setId = hit.setId;
        drag.label = hit.label;
        drag.startMouseX = pt.x;
        drag.startMouseY = pt.y;
        var targetSet = engine.getSetById(hit.setId);
        var currentOff = (targetSet && targetSet.pointOffsets && targetSet.pointOffsets[hit.label]) ? targetSet.pointOffsets[hit.label] : { dx: 20, dy: -20 };
        drag.startDX = currentOff.dx;
        drag.startDY = currentOff.dy;
        setCanvasCursor("dragging");
        return;
      }

      // Check if clicking directly on a point marker (do NOT pan, do NOT change coordinates)
      var hitMarker = engine.hitTestPointMarker(pt.x, pt.y);
      if (hitMarker) {
        drag.active = true;
        drag.mode = "point-marker";
        drag.setId = hitMarker.setId;
        drag.label = hitMarker.label;
        drag.startMouseX = pt.x;
        drag.startMouseY = pt.y;
        setCanvasCursor("pointer");
        return;
      }

      // Pan genuinely empty canvas space
      drag.active = true;
      drag.mode = "pan";
      drag.setId = null;
      drag.label = null;
      drag.startMouseX = pt.x;
      drag.startMouseY = pt.y;
      drag.startPanX = state.viewOffset.x;
      drag.startPanY = state.viewOffset.y;
      setCanvasCursor("dragging");
    });

    window.addEventListener("mouseup", function () {
      if (drag.active) {
        drag.active = false;
        drag.mode = null;
        drag.setId = null;
        drag.label = null;
        setCanvasCursor(null);
      }
    });

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.08 : 0.92;
      state.viewZoom = Math.max(0.4, Math.min(3.0, state.viewZoom * factor));
      if (viewZoomEl) {
        viewZoomEl.value = state.viewZoom.toFixed(2);
        if (viewZoomValEl) viewZoomValEl.textContent = Math.round(state.viewZoom * 100) + "%";
      }
      engine.draw(canvas);
    }, { passive: false });

    // Inputs & Buttons Wiring
    if (pointsInput) {
      pointsInput.addEventListener("input", function () {
        var activeSet = engine.getActiveSet();
        if (!activeSet) return;
        activeSet.inputText = pointsInput.value;
        try {
          var parsed = parsePoints(activeSet.inputText);
          activeSet.points = preservePointStyles(activeSet.points, parsed);
          engine.prunePointReferences(activeSet);
          ensurePointOffsets(activeSet);
          rebuildPointControls(activeSet.points);
        } catch (err) {}
        engine.draw(canvas);
      });
    }

    if (addSetBtn) {
      addSetBtn.addEventListener("click", function () {
        var nextIndex = state.pointSets.length + 1;
            var nextSet = engine.buildSet("Set " + nextIndex, "");
        state.pointSets.push(nextSet);
        state.activeSetId = nextSet.id;
        renderAll();
      });
    }

    if (viewZoomEl) {
      viewZoomEl.addEventListener("input", function () {
        state.viewZoom = Number(viewZoomEl.value) || 1.0;
        if (viewZoomValEl) viewZoomValEl.textContent = Math.round(state.viewZoom * 100) + "%";
        engine.draw(canvas);
      });
    }

    if (resetViewBtn) {
      resetViewBtn.addEventListener("click", function () {
        state.viewZoom = 1.0;
        state.viewOffset.x = 0;
        state.viewOffset.y = 0;
        if (viewZoomEl) {
          viewZoomEl.value = "1.0";
          if (viewZoomValEl) viewZoomValEl.textContent = "100%";
        }
        engine.draw(canvas);
      });
    }

    if (resetBgBtn) {
      resetBgBtn.addEventListener("click", function () {
        state.canvasBgColor = "#ffffff";
        if (canvasBgColorEl) canvasBgColorEl.value = "#ffffff";
        engine.draw(canvas);
      });
    }

    [
      marginUnitsEl, showDiagonalsEl, showLabelsEl, canvasBgColorEl,
      gridVisibleEl, gridColorEl, gridOpacityEl, xAxisVisibleEl, yAxisVisibleEl,
      axisColorEl, axisWidthEl, axisLabelsVisibleEl, coordPrecisionEl,
      polygonVisibleEl, polygonFillVisibleEl, polygonFillColorEl, polygonFillOpacityEl,
      polygonBorderVisibleEl, polygonBorderColorEl, polygonBorderWidthEl,
      diagonalColorEl, diagonalWidthEl, diagonalStyleEl
    ].forEach(function (el) {
      if (el) {
        el.addEventListener("input", function () {
          syncStateFromUI();
          if (polygonFillOpacityValEl && polygonFillOpacityEl) polygonFillOpacityValEl.textContent = polygonFillOpacityEl.value + "%";
          if (polygonBorderWidthValEl && polygonBorderWidthEl) polygonBorderWidthValEl.textContent = polygonBorderWidthEl.value;
          if (diagonalWidthValEl && diagonalWidthEl) diagonalWidthValEl.textContent = diagonalWidthEl.value;
          if (gridOpacityValEl && gridOpacityEl) gridOpacityValEl.textContent = gridOpacityEl.value + "%";
          if (axisWidthValEl && axisWidthEl) axisWidthValEl.textContent = axisWidthEl.value;
          engine.draw(canvas);
        });
        el.addEventListener("change", function () {
          syncStateFromUI();
          engine.draw(canvas);
        });
      }
    });

    if (typographyControls) {
      [typographyControls.sizeInput, typographyControls.boldInput].forEach(function (el) {
        el.addEventListener("input", function () {
          syncStateFromUI();
          engine.draw(canvas);
        });
        el.addEventListener("change", function () {
          syncStateFromUI();
          engine.draw(canvas);
        });
      });
    }

    for (var k in controls) {
      if (controls.hasOwnProperty(k) && controls[k]) {
        controls[k].addEventListener("input", function () {
          syncStateFromUI();
          refreshValueLabels();
          engine.draw(canvas);
        });
      }
    }

    var drawBtn = doc.getElementById("drawBtn");
    if (drawBtn) {
      drawBtn.addEventListener("click", function () {
        syncStateFromUI();
        engine.draw(canvas);
      });
    }

    var downloadBtn = doc.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        var stamp = (typeof window.isoStamp === "function") ? window.isoStamp() : new Date().toISOString().replace(/[:.]/g, "-");
        var link = doc.createElement("a");
        link.download = "graph-" + stamp + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      });
    }

    var resetBtn = doc.getElementById("resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        initDefaultSets();
        state.viewZoom = 1.0;
        state.viewOffset.x = 0;
        state.viewOffset.y = 0;
        state.canvasBgColor = "#ffffff";
        renderAll();
      });
    }

    // Initial render
    renderAll();
  }

  /* ==========================================================================
     6. Workspace Modular Tool Lifecycle Adapter (Strategy A)
     ========================================================================== */
  function createWorkspaceAdapter() {
    var engine = createCoordinatesEngine();
    var state = engine.state;
    var inputRows = [];
    var cleanups = [];
    var mountedCanvas = null;
    var mountedContainer = null;
    var leftPanelInputsContainer = null;
    var rightPanelPropsContainer = null;
    var syncActiveUI = null;

    function addListener(target, type, handler, options) {
      if (!target || typeof target.addEventListener !== "function") return;
      target.addEventListener(type, handler, options);
      cleanups.push(function () {
        try { target.removeEventListener(type, handler, options); } catch (e) {}
      });
    }

    function clearCleanups() {
      while (cleanups.length > 0) {
        var cleanup = cleanups.pop();
        try { cleanup(); } catch (e) {}
      }
    }

    function renderUI() {
      if (mountedCanvas) {
        engine.draw(mountedCanvas);
      }
    }

    function buildInputRow(label, x, y, id) {
      return {
        id: id || null,
        label: label == null ? "" : String(label),
        x: x == null ? "" : String(x),
        y: y == null ? "" : String(y)
      };
    }

    function nextAutoLabel() {
      var index = 0;
      while (index < 26 && inputRows.some(function (row) { return row.label.toUpperCase() === String.fromCharCode(65 + index); })) index++;
      if (index < 26) return String.fromCharCode(65 + index);
      var suffix = inputRows.length + 1;
      while (inputRows.some(function (row) { return row.label.toUpperCase() === ("P" + suffix); })) suffix++;
      return "P" + suffix;
    }

    function syncInputRowsFromActiveSet() {
      var activeSet = engine.getActiveSet();
      inputRows = [];
      if (activeSet && Array.isArray(activeSet.draftRows)) {
        inputRows = activeSet.draftRows.map(function (row) {
          return buildInputRow(row.label, row.x, row.y, row.id);
        });
      } else if (activeSet && activeSet.points && activeSet.points.length) {
        inputRows = activeSet.points.map(function (point) {
          return buildInputRow(point.label, point.xRaw != null ? point.xRaw : point.x, point.yRaw != null ? point.yRaw : point.y, point.id);
        });
      }
      if (inputRows.length === 0) inputRows.push(buildInputRow("A", "", ""));
    }

    function renderInputRows() {
      var container = document.getElementById("mfCoordInputRows");
      if (!container) return;
      container.innerHTML = inputRows.map(function (row, index) {
        return '<div class="mf-coord-row-item" data-row-index="' + index + '">' +
          '<input class="mf-coord-input-label" type="text" aria-label="Point ' + (index + 1) + ' label" value="' + escapeHtml(row.label) + '" data-field="label" maxlength="12">' +
          '<input class="mf-coord-input-coord" type="text" inputmode="decimal" aria-label="Point ' + (index + 1) + ' x coordinate" value="' + escapeHtml(row.x) + '" data-field="x">' +
          '<input class="mf-coord-input-coord" type="text" inputmode="decimal" aria-label="Point ' + (index + 1) + ' y coordinate" value="' + escapeHtml(row.y) + '" data-field="y">' +
          '<button type="button" class="mf-coord-btn-del" data-action="remove-point" data-row-index="' + index + '" aria-label="Remove point ' + (index + 1) + '">×</button>' +
          '</div>';
      }).join("");
    }

    function validateInputRows() {
      var errors = [];
      var seen = Object.create(null);
      inputRows.forEach(function (row, index) {
        var label = String(row.label || "").trim();
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(label)) {
          errors.push({ error: "Point " + (index + 1) + ": label must start with a letter and contain only letters, digits, or underscores." });
          return;
        }
        if (seen[label.toUpperCase()]) errors.push({ error: "Point " + (index + 1) + ": label is already used." });
        seen[label.toUpperCase()] = true;
        if (!String(row.x || "").trim() || !String(row.y || "").trim()) {
          errors.push({ error: "Point " + (index + 1) + ": X and Y coordinates are required." });
          return;
        }
        try {
          parseNumberOrFractionKeepRaw(row.x);
          parseNumberOrFractionKeepRaw(row.y);
        } catch (error) {
          errors.push({ error: "Point " + (index + 1) + ": enter valid finite X and Y coordinates." });
        }
      });
      return errors;
    }

    function rowsToInputText() {
      return inputRows.map(function (row) {
        return row.label.trim().toUpperCase() + "(" + row.x.trim() + "," + row.y.trim() + ")";
      }).join("\n");
    }

    function doFullReset() {
      var defaults = createCoordinatesEngine().state;
      Object.keys(state).forEach(function (key) { delete state[key]; });
      Object.keys(defaults).forEach(function (key) { state[key] = defaults[key]; });
      inputRows = [buildInputRow("A", "", "")];
      syncActiveUI && syncActiveUI();
      renderUI();
    }

    return {
      id: "coordinates-graph",
      name: "Coordinates Graph",
      description: "Points and coordinate plane plotting",
      icon: "âŒ–",
      capabilities: [
        "Multiple Independent Point Sets",
        "Per-Point Colors & Shapes",
        "Polygon Fills & Diagonals",
        "Visual Grid & Axis Controls"
      ],

      mount: function (container, options) {
        options = options || {};
        mountedContainer = container;

        // Clean container and create canvas
        container.innerHTML = "";
        mountedCanvas = document.createElement("canvas");
        mountedCanvas.className = "mf-coord-canvas";
        mountedCanvas.id = "mfCoordCanvas";
        container.appendChild(mountedCanvas);

        // Fit canvas using High-DPI Foundation
        if (window.MathForgeWorkspace && typeof window.MathForgeWorkspace.fitCanvasToContainer === "function") {
          window.MathForgeWorkspace.fitCanvasToContainer(mountedCanvas, container, { dpr: options.dpr });
        }

        // Mount Left Panel Inputs Section in #mfLeftPanel below #mfToolList
        var leftPanel = document.getElementById("mfLeftPanel");
        if (leftPanel) {
          leftPanelInputsContainer = document.createElement("div");
          leftPanelInputsContainer.id = "mfCoordToolInputs";
          leftPanelInputsContainer.className = "mf-coord-tool-inputs";

          leftPanelInputsContainer.innerHTML =
            '<div class="mf-coord-card">' +
              '<div class="mf-coord-card-header">' +
                '<div class="mf-coord-card-title">Coordinate Input</div>' +
                '<div class="mf-coord-card-subtitle">Add and manage coordinate points.</div>' +
              '</div>' +
              '<div class="mf-coord-table-header">' +
                '<span>Label</span>' +
                '<span class="mf-col-x">X</span>' +
                '<span class="mf-col-y">Y</span>' +
                '<span></span>' +
              '</div>' +
              '<div id="mfCoordInputRows" class="mf-coord-point-rows"></div>' +
              '<div id="mfCoordValidationMsg" class="mf-coord-validation-msg" style="display:none;"></div>' +
              '<div class="mf-coord-actions-row">' +
                '<button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordAddPointBtn">+ Add Point</button>' +
                '<button type="button" class="mf-coord-btn mf-btn-primary mf-btn-plot" id="mfCoordPlotBtn">&#9654; Plot Points</button>' +
              '</div>' +
            '</div>' +
            '<div class="mf-coord-card mf-coord-connections-card">' +
              '<div class="mf-coord-card-header"><div class="mf-coord-card-title">Lines &amp; Connections</div><div class="mf-coord-card-subtitle">Points stay independent until you connect them.</div></div>' +
              '<div class="mf-coord-actions-row"><button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordConnectModeBtn" aria-pressed="false">Connect Points</button><button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordCancelConnectionBtn" disabled>Cancel Connection</button></div>' +
              '<div class="mf-coord-hint" id="mfCoordConnectHint" role="status" aria-live="polite">Select Connect Points, then choose two points on the graph.</div>' +
              '<label class="mf-coord-check-row"><input id="mfCoordLinesVisible" type="checkbox" checked> Show All Lines</label>' +
              '<div class="mf-coord-style-row"><span>Line Colour</span><input id="mfCoordLineColor" type="color" value="#111827"></div>' +
              '<div class="mf-coord-row"><label>Line Thickness</label><input id="mfCoordLineWidth" type="range" min="1" max="12" value="2"><div class="val" id="mfCoordLineWidthVal">2</div></div>' +
              '<div class="mf-coord-row"><label>Line Style</label><select id="mfCoordLineStyle"><option value="solid" selected>Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></div>' +
              '<div class="mf-coord-actions-row"><button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordClearConnectionsBtn">Clear All Connections</button></div>' +
              '<div class="mf-coord-connection-list" id="mfCoordConnectionList"></div>' +
            '</div>' +
            '<div class="mf-coord-card mf-coord-fill-card">' +
              '<div class="mf-coord-card-header"><div class="mf-coord-card-title">Fill</div><div class="mf-coord-card-subtitle">Close a point set explicitly before filling it.</div></div>' +
              '<button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordCloseShapeBtn">Close Shape (active set)</button>' +
              '<button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordOpenShapeBtn" hidden>Reopen Shape (active set)</button>' +
              '<label class="mf-coord-check-row"><input id="mfCoordFillEnabled" type="checkbox"> Enable Fill</label>' +
              '<div class="mf-coord-style-row"><span>Fill Colour</span><input id="mfCoordFillColor" type="color" value="#5b8def"></div>' +
              '<div class="mf-coord-row"><label>Fill Opacity</label><input id="mfCoordFillOpacity" type="range" min="0" max="100" value="18"><div class="val" id="mfCoordFillOpacityVal">18%</div></div>' +
              '<button type="button" class="mf-coord-btn mf-btn-add" id="mfCoordNoFillBtn">Disable Fill / No Fill</button>' +
              '<div class="mf-coord-hint" id="mfCoordShapeHint" role="status" aria-live="polite"></div>' +
            '</div>' +
            '<div class="mf-coord-section-title">Point Sets</div>' +
            '<div class="mf-coord-set-manager">' +
              '<div class="mf-coord-set-header">' +
                '<span class="mf-group-label" style="margin:0;">Active Sets</span>' +
                '<button type="button" class="mf-coord-btn-sm" id="mfCoordAddSetBtn">+ Add Set</button>' +
              '</div>' +
              '<div id="mfCoordSetList" class="mf-coord-set-list"></div>' +
            '</div>' +
            '<div class="mf-coord-input-footnote">Point style settings are in Graph Designs.</div>';

          var panelContent = leftPanel.querySelector(".mf-panel-content");
          if (panelContent) {
            panelContent.appendChild(leftPanelInputsContainer);
          }
        }

        // Mount Right Panel Visual Parameters in #mfPropertiesContainer
        var propContainer = document.getElementById("mfPropertiesContainer");
        if (propContainer) {
          rightPanelPropsContainer = propContainer;
          propContainer.innerHTML =
            '<div class="mf-coord-properties">' +
            '<div class="mf-coord-section-title">Active Tool Context</div>' +
            '<div class="mf-property-row"><span>Engine</span><span class="mf-property-value mf-text-accent-bold">Coordinates Graph</span></div>' +
            '<div class="mf-property-row"><span>Status</span><span class="mf-property-value mf-text-success">Integrated (Active)</span></div>' +

            '<div class="mf-coord-section-title">Point &amp; Marker Styling</div>' +
            '<div class="mf-coord-hint">Click &amp; drag labels on the canvas or adjust a point below:</div>' +
            '<div id="mfCoordPointControls" class="mf-coord-point-controls"></div>' +
            '<div class="mf-coord-section-title">Diagonal Controls</div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordShowDiagonals" type="checkbox"> Show diagonals</label></div>' +
            '<div class="mf-coord-style-row"><span>Color</span><input id="mfCoordDiagColor" type="color" value="#475569"></div>' +
            '<div class="mf-coord-row"><label>Width</label><input id="mfCoordDiagWidth" type="range" min="1" max="10" value="2"><div class="val" id="mfCoordDiagWidthVal">2</div></div>' +
            '<div class="mf-coord-row"><label>Style</label><select id="mfCoordDiagStyle"><option value="solid">Solid</option><option value="dashed" selected>Dashed</option><option value="dotted">Dotted</option></select></div>' +

            '<div class="mf-coord-section-title">Grid & Axes</div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordGridVisible" type="checkbox" checked> Show grid</label></div>' +
            '<div class="mf-coord-style-row"><span>Grid Color</span><input id="mfCoordGridColor" type="color" value="#000000"></div>' +
            '<div class="mf-coord-row"><label>Grid Opacity</label><input id="mfCoordGridOpacity" type="range" min="0" max="100" value="15"><div class="val" id="mfCoordGridOpacityVal">15%</div></div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordXAxisVisible" type="checkbox" checked> Show X-Axis</label></div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordYAxisVisible" type="checkbox" checked> Show Y-Axis</label></div>' +
            '<div class="mf-coord-style-row"><span>Axis Color</span><input id="mfCoordAxisColor" type="color" value="#000000"></div>' +
            '<div class="mf-coord-row"><label>Axis Width</label><input id="mfCoordAxisWidth" type="range" min="1" max="8" value="2"><div class="val" id="mfCoordAxisWidthVal">2</div></div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordAxisLabelsVisible" type="checkbox" checked> Show numbers</label></div>' +

            '<div class="mf-coord-section-title">Labels & View</div>' +
            '<div class="mf-coord-row"><label><input id="mfCoordShowLabels" type="checkbox" checked> Show labels</label></div>' +
            '<div class="mf-coord-row"><label>Precision</label><select id="mfCoordPrecision"><option value="auto" selected>Auto</option><option value="0">0 decimals</option><option value="1">1 decimal</option><option value="2">2 decimals</option><option value="3">3 decimals</option></select></div>' +
            '<div class="mf-coord-style-row"><span>Background</span><input id="mfCoordBgColor" type="color" value="#ffffff"></div>' +
            '<div class="mf-coord-btn-group">' +
              '<button type="button" class="mf-coord-btn-sm" id="mfCoordResetViewBtn">âŸ² Reset View</button>' +
              '<button type="button" class="mf-coord-btn-sm" id="mfCoordResetBgBtn">Default BG</button>' +
            '</div>' +
            '</div>';
          ["mfCoordGridVisible", "mfCoordGridColor", "mfCoordGridOpacity", "mfCoordXAxisVisible", "mfCoordYAxisVisible", "mfCoordAxisColor", "mfCoordAxisWidth", "mfCoordAxisLabelsVisible", "mfCoordShowLabels", "mfCoordBgColor", "mfCoordPolyBorderColor", "mfCoordPolyBorderWidth"].forEach(function (id) {
            var input = document.getElementById(id);
            var row = input && input.closest(".mf-coord-row, .mf-coord-style-row");
            if (row) row.hidden = true;
          });
          Array.prototype.forEach.call(propContainer.querySelectorAll(".mf-coord-section-title"), function (title) {
            if (/grid & axes|labels & view/i.test(title.textContent)) title.hidden = true;
          });
          if (window.MathForgeGraphTypography) {
            window.MathForgeGraphTypography.ensureControls(
              document,
              "coord",
              propContainer.querySelector(".mf-coord-properties")
            );
          }
        }

        // Enable toolbar buttons
        var resetViewToolbarBtn = document.getElementById("mfResetViewToolbarBtn");
        if (resetViewToolbarBtn) {
          resetViewToolbarBtn.removeAttribute("disabled");
          resetViewToolbarBtn.removeAttribute("aria-disabled");
          resetViewToolbarBtn.setAttribute("title", "Reset - Clear all and restore empty coordinate plane");
          resetViewToolbarBtn.setAttribute("aria-label", "Reset - Clear all and restore empty coordinate plane");
          addListener(resetViewToolbarBtn, "click", function () {
            doFullReset();
          });
        }

        var zoomInBtn = document.getElementById("mfZoomInBtn");
        if (zoomInBtn) {
          zoomInBtn.removeAttribute("disabled");
          zoomInBtn.removeAttribute("aria-disabled");
          addListener(zoomInBtn, "click", function () {
            state.viewZoom = Math.min(3.0, state.viewZoom * 1.15);
            updateZoomReadout();
            renderUI();
          });
        }

        var zoomOutBtn = document.getElementById("mfZoomOutBtn");
        if (zoomOutBtn) {
          zoomOutBtn.removeAttribute("disabled");
          zoomOutBtn.removeAttribute("aria-disabled");
          addListener(zoomOutBtn, "click", function () {
            state.viewZoom = Math.max(0.4, state.viewZoom * 0.85);
            updateZoomReadout();
            renderUI();
          });
        }

        var exportPngBtn = document.getElementById("mfExportPngBtn");
        if (exportPngBtn) {
          exportPngBtn.removeAttribute("disabled");
          exportPngBtn.setAttribute("aria-disabled", "false");
        }

        function updateZoomReadout() {
          var readout = document.getElementById("mfCanvasZoomReadout");
          if (readout) {
            readout.textContent = "Coordinates Â· " + Math.round(state.viewZoom * 100) + "%";
          }
          var statusZoom = document.getElementById("mfStatusZoom");
          if (statusZoom) {
            statusZoom.textContent = Math.round(state.viewZoom * 100) + "%";
          }
        }

        function updatePointSliderUI(setId, label) {
          var targetSet = engine.getSetById(setId);
          var off = (targetSet && targetSet.pointOffsets && targetSet.pointOffsets[label]) ? targetSet.pointOffsets[label] : { dx: 20, dy: -20 };
          var dxEl = document.getElementById("mfCoordPt-" + setId + "-" + label + "-dx");
          var dyEl = document.getElementById("mfCoordPt-" + setId + "-" + label + "-dy");
          var dxVal = document.getElementById("mfCoordVal-" + setId + "-" + label + "-dx");
          var dyVal = document.getElementById("mfCoordVal-" + setId + "-" + label + "-dy");
          if (dxEl && dxVal) { dxEl.value = off.dx; dxVal.textContent = off.dx; }
          if (dyEl && dyVal) { dyEl.value = off.dy; dyVal.textContent = off.dy; }
        }

        function refreshSetManagerUI() {
          var setListEl = document.getElementById("mfCoordSetList");
          if (!setListEl) return;
          setListEl.innerHTML = "";
          state.pointSets.forEach(function (set, index) {
            var row = document.createElement("div");
            row.className = "mf-coord-set-item" + (set.id === state.activeSetId ? " active" : "");

            var nameRow = document.createElement("div");
            nameRow.className = "mf-coord-set-row";

            var nameEl = document.createElement("input");
            nameEl.type = "text";
            nameEl.className = "mf-coord-set-name";
            nameEl.setAttribute("data-set-id", set.id);
            nameEl.value = set.name || ("Set " + (index + 1));

            var actionWrap = document.createElement("div");
            actionWrap.className = "mf-coord-set-actions";

            var selectBtn = document.createElement("button");
            selectBtn.type = "button";
            selectBtn.className = "mf-coord-btn-sm";
            selectBtn.setAttribute("data-action", "select");
            selectBtn.setAttribute("data-set-id", set.id);
            selectBtn.textContent = set.id === state.activeSetId ? "Active" : "Select";
            if (set.id === state.activeSetId) selectBtn.disabled = true;

            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "mf-coord-btn-sm";
            removeBtn.setAttribute("data-action", "remove");
            removeBtn.setAttribute("data-set-id", set.id);
            removeBtn.textContent = "Remove";
            if (state.pointSets.length <= 1) removeBtn.disabled = true;

            actionWrap.appendChild(selectBtn);
            actionWrap.appendChild(removeBtn);
            nameRow.appendChild(nameEl);
            nameRow.appendChild(actionWrap);
            row.appendChild(nameRow);
            setListEl.appendChild(row);
          });
        }

        function rebuildPointControlsUI() {
          var wrap = document.getElementById("mfCoordPointControls");
          if (!wrap) return;
          var activeSet = engine.getActiveSet();
          if (!activeSet || !activeSet.points || activeSet.points.length === 0) {
            wrap.innerHTML = '<div class="mf-coord-hint">No valid points in active set.</div>';
            return;
          }
          wrap.innerHTML = "";

          for (var i = 0; i < activeSet.points.length; i++) {
            var p = activeSet.points[i];
            var label = p.label;
            var off = (activeSet.pointOffsets && activeSet.pointOffsets[label]) ? activeSet.pointOffsets[label] : { dx: 20, dy: -20 };
            var pStyle = normalizePointStyle(p.style);

            var card = document.createElement("div");
            card.className = "mf-coord-point-card";

            var head = document.createElement("div");
            head.className = "mf-coord-point-header";
            head.innerHTML = "<span>" + escapeHtml(activeSet.name) + " â€¢ " + escapeHtml(label) + " label offset</span><span style=\"opacity:.85\">" + escapeHtml(label) + "(" + (p.xRaw != null ? p.xRaw : p.x) + ", " + (p.yRaw != null ? p.yRaw : p.y) + ")</span>";
            card.appendChild(head);

            var rowDX = document.createElement("div");
            rowDX.className = "mf-coord-mini-row";
            rowDX.innerHTML = "<label>dx (px)</label>" +
              "<input id=\"mfCoordPt-" + activeSet.id + "-" + label + "-dx\" type=\"range\" min=\"-220\" max=\"260\" value=\"" + off.dx + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-key=\"dx\">" +
              "<div class=\"val\" id=\"mfCoordVal-" + activeSet.id + "-" + label + "-dx\">" + off.dx + "</div>";
            card.appendChild(rowDX);

            var rowDY = document.createElement("div");
            rowDY.className = "mf-coord-mini-row";
            rowDY.innerHTML = "<label>dy (px)</label>" +
              "<input id=\"mfCoordPt-" + activeSet.id + "-" + label + "-dy\" type=\"range\" min=\"-240\" max=\"220\" value=\"" + off.dy + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-key=\"dy\">" +
              "<div class=\"val\" id=\"mfCoordVal-" + activeSet.id + "-" + label + "-dy\">" + off.dy + "</div>";
            card.appendChild(rowDY);

            var colorRow = document.createElement("div");
            colorRow.className = "mf-coord-style-row";
            colorRow.innerHTML = "<label>Color</label><input type=\"color\" value=\"" + pStyle.color + "\" data-set-id=\"" + activeSet.id + "\" data-label=\"" + label + "\" data-style-key=\"color\">";
            card.appendChild(colorRow);

            var shapeRow = document.createElement("div");
            shapeRow.className = "mf-coord-style-row";
            var shapeSelect = document.createElement("select");
            shapeSelect.dataset.setId = activeSet.id;
            shapeSelect.dataset.label = label;
            shapeSelect.dataset.styleKey = "shape";
            for (var s = 0; s < POINT_SHAPES.length; s++) {
              var shape = POINT_SHAPES[s];
              var option = document.createElement("option");
              option.value = shape;
              option.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
              if (shape === pStyle.shape) option.selected = true;
              shapeSelect.appendChild(option);
            }
            shapeRow.innerHTML = "<label>Shape</label>";
            shapeRow.appendChild(shapeSelect);
            card.appendChild(shapeRow);

            wrap.appendChild(card);
          }
        }

        function syncUIFromActiveSet() {
          refreshSetManagerUI();
          var activeSet = engine.getActiveSet();
          if (!activeSet) return;

          syncInputRowsFromActiveSet();
          renderInputRows();
          rebuildPointControlsUI();

          var marginUnitsInp = document.getElementById("mfCoordMarginUnits");
          if (marginUnitsInp) marginUnitsInp.value = state.marginUnits;

          var opts = activeSet.renderOptions || defaultRenderOptions();
          var poly = opts.polygon;
          var diag = opts.diagonals;

          var polyVis = document.getElementById("mfCoordPolyVisible");
          if (polyVis) polyVis.checked = Boolean(poly.visible);
          var polyFillVis = document.getElementById("mfCoordPolyFillVisible");
          if (polyFillVis) polyFillVis.checked = poly.fillVisible !== false;
          var polyFillCol = document.getElementById("mfCoordPolyFillColor");
          if (polyFillCol) polyFillCol.value = poly.fillColor || DEFAULT_FILL_COLOR;
          var polyFillOp = document.getElementById("mfCoordPolyFillOpacity");
          if (polyFillOp) {
            var opVal = Math.round((Number(poly.fillOpacity) || 0) * 100);
            polyFillOp.value = String(opVal);
            var opValEl = document.getElementById("mfCoordPolyFillOpacityVal");
            if (opValEl) opValEl.textContent = opVal + "%";
          }
          var polyBorderVis = document.getElementById("mfCoordPolyBorderVisible");
          if (polyBorderVis) polyBorderVis.checked = Boolean(poly.borderVisible);
          var polyBorderCol = document.getElementById("mfCoordPolyBorderColor");
          if (polyBorderCol) polyBorderCol.value = poly.borderColor || DEFAULT_BORDER_COLOR;
          var polyBorderW = document.getElementById("mfCoordPolyBorderWidth");
          if (polyBorderW) {
            polyBorderW.value = String(Math.max(1, Number(poly.borderWidth) || 3));
            var bwValEl = document.getElementById("mfCoordPolyBorderWidthVal");
            if (bwValEl) bwValEl.textContent = polyBorderW.value;
          }

          var diagVis = document.getElementById("mfCoordShowDiagonals");
          if (diagVis) diagVis.checked = Boolean(diag.visible);
          var diagCol = document.getElementById("mfCoordDiagColor");
          if (diagCol) diagCol.value = diag.color || DEFAULT_DIAGONAL_COLOR;
          var diagW = document.getElementById("mfCoordDiagWidth");
          if (diagW) {
            diagW.value = String(Math.max(1, Number(diag.width) || 2));
            var dwValEl = document.getElementById("mfCoordDiagWidthVal");
            if (dwValEl) dwValEl.textContent = diagW.value;
          }
          var diagStyle = document.getElementById("mfCoordDiagStyle");
          if (diagStyle) diagStyle.value = normalizeLineStyle(diag.style);

          var gridVis = document.getElementById("mfCoordGridVisible");
          if (gridVis) gridVis.checked = Boolean(state.gridVisible);
          var gridCol = document.getElementById("mfCoordGridColor");
          if (gridCol) gridCol.value = state.gridColor;
          var gridOp = document.getElementById("mfCoordGridOpacity");
          if (gridOp) {
            var gOp = Math.round((Number(state.gridOpacity) || 0) * 100);
            gridOp.value = String(gOp);
            var gOpVal = document.getElementById("mfCoordGridOpacityVal");
            if (gOpVal) gOpVal.textContent = gOp + "%";
          }

          var xVis = document.getElementById("mfCoordXAxisVisible");
          if (xVis) xVis.checked = Boolean(state.xAxisVisible);
          var yVis = document.getElementById("mfCoordYAxisVisible");
          if (yVis) yVis.checked = Boolean(state.yAxisVisible);
          var axisCol = document.getElementById("mfCoordAxisColor");
          if (axisCol) axisCol.value = state.axisColor;
          var axisW = document.getElementById("mfCoordAxisWidth");
          if (axisW) {
            axisW.value = String(state.axisWidth || 2);
            var aVal = document.getElementById("mfCoordAxisWidthVal");
            if (aVal) aVal.textContent = axisW.value;
          }
          var axisLbl = document.getElementById("mfCoordAxisLabelsVisible");
          if (axisLbl) axisLbl.checked = Boolean(state.axisLabelsVisible);

          var showLbl = document.getElementById("mfCoordShowLabels");
          if (showLbl) showLbl.checked = Boolean(state.showLabels);
          var prec = document.getElementById("mfCoordPrecision");
          if (prec) prec.value = state.coordPrecision;
          var bgCol = document.getElementById("mfCoordBgColor");
          if (bgCol) bgCol.value = state.canvasBgColor;
          var graphFontSize = document.getElementById("mfGraphFontSizePt");
          if (graphFontSize) graphFontSize.value = String(state.fontSizePt || 11);
          var graphBold = document.getElementById("mfGraphBold");
          if (graphBold) graphBold.checked = Boolean(state.bold);

          syncConnectionUI();

          updateZoomReadout();
        }

        function syncConnectionUI() {
          var modeBtn = document.getElementById("mfCoordConnectModeBtn");
          var cancelBtn = document.getElementById("mfCoordCancelConnectionBtn");
          var hint = document.getElementById("mfCoordConnectHint");
          if (modeBtn) {
            modeBtn.classList.toggle("active", Boolean(state.connectionMode));
            modeBtn.setAttribute("aria-pressed", state.connectionMode ? "true" : "false");
            modeBtn.textContent = state.connectionMode ? "Connect Points: On" : "Connect Points";
          }
          if (cancelBtn) cancelBtn.disabled = !state.connectionMode && !state.connectionStart;
          if (hint) {
            if (state.connectionStart) hint.textContent = "Select the next point to create a line segment.";
            else if (state.connectionMode) hint.textContent = "Select a starting point on the graph.";
            else hint.textContent = "Select Connect Points, then choose two points on the graph.";
          }
          var linesVisible = document.getElementById("mfCoordLinesVisible");
          var lineColor = document.getElementById("mfCoordLineColor");
          var lineWidth = document.getElementById("mfCoordLineWidth");
          var lineStyle = document.getElementById("mfCoordLineStyle");
          if (linesVisible) linesVisible.checked = state.connectionsVisible !== false;
          if (lineColor) lineColor.value = state.connectionColor || DEFAULT_CONNECTION_COLOR;
          if (lineWidth) {
            lineWidth.value = String(Math.max(1, Math.min(12, Number(state.connectionWidth) || 2)));
            var widthVal = document.getElementById("mfCoordLineWidthVal");
            if (widthVal) widthVal.textContent = lineWidth.value;
          }
          if (lineStyle) lineStyle.value = normalizeLineStyle(state.connectionStyle);
          var fillEnabled = document.getElementById("mfCoordFillEnabled");
          var fillColor = document.getElementById("mfCoordFillColor");
          var fillOpacity = document.getElementById("mfCoordFillOpacity");
          if (fillEnabled) fillEnabled.checked = Boolean(state.fillEnabled);
          if (fillColor) fillColor.value = state.fillColor || DEFAULT_FILL_COLOR;
          if (fillOpacity) {
            fillOpacity.value = String(Math.round(Math.max(0, Math.min(1, Number(state.fillOpacity) || 0)) * 100));
            var opacityVal = document.getElementById("mfCoordFillOpacityVal");
            if (opacityVal) opacityVal.textContent = fillOpacity.value + "%";
          }
          var shapeHint = document.getElementById("mfCoordShapeHint");
          var activeSet = engine.getActiveSet();
          var activeShape = (state.closedShapes || []).find(function (shape) { return activeSet && shape.setId === activeSet.id; });
          if (shapeHint) shapeHint.textContent = activeShape ? "Active set is explicitly closed and ready to fill." : "No closed shape in the active set.";
          var reopenShape = document.getElementById("mfCoordOpenShapeBtn");
          if (reopenShape) reopenShape.hidden = !activeShape;
          var connectionList = document.getElementById("mfCoordConnectionList");
          if (connectionList) {
            connectionList.innerHTML = "";
            (state.connections || []).forEach(function (connection) {
              var start = findPointByRef(state.pointSets, connection.startSetId, connection.startPointId);
              var end = findPointByRef(state.pointSets, connection.endSetId, connection.endPointId);
              if (!start || !end) return;
              var row = document.createElement("div");
              row.className = "mf-coord-connection-item";
              var label = document.createElement("span");
              label.textContent = start.point.label + "–" + end.point.label;
              var remove = document.createElement("button");
              remove.type = "button";
              remove.className = "mf-coord-btn-del";
              remove.dataset.connectionId = connection.id;
              remove.setAttribute("aria-label", "Remove connection " + label.textContent);
              remove.textContent = "×";
              row.appendChild(label);
              row.appendChild(remove);
              connectionList.appendChild(row);
            });
          }
        }

        // Wire canvas mouse interactions
        var drag = engine.getDrag();

        function canvasPointFromEvent(e) {
          var rect = mountedCanvas.getBoundingClientRect();
          var logicalW = mountedCanvas.clientWidth || (mountedCanvas._mfAppliedDpr ? Math.round(mountedCanvas.width / mountedCanvas._mfAppliedDpr) : mountedCanvas.width);
          var logicalH = mountedCanvas.clientHeight || (mountedCanvas._mfAppliedDpr ? Math.round(mountedCanvas.height / mountedCanvas._mfAppliedDpr) : mountedCanvas.height);
          var scaleX = rect.width > 0 ? (logicalW / rect.width) : 1;
          var scaleY = rect.height > 0 ? (logicalH / rect.height) : 1;
          return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
          };
        }

        function setCanvasCursor(mode) {
          mountedCanvas.classList.remove("dragging");
          mountedCanvas.classList.remove("can-drag");
          if (mode === "dragging") {
            mountedCanvas.classList.add("dragging");
            mountedCanvas.style.cursor = "grabbing";
          } else if (mode === "can-drag") {
            mountedCanvas.classList.add("can-drag");
            mountedCanvas.style.cursor = "grab";
          } else if (mode === "pointer") {
            mountedCanvas.style.cursor = "pointer";
          } else {
            mountedCanvas.style.cursor = "default";
          }
        }

        function handleDragMouseMove(e) {
          if (!drag.active) return;
          if (e._mfHandledDrag) return;
          e._mfHandledDrag = true;

          var pt = canvasPointFromEvent(e);
          var dx = pt.x - drag.startMouseX;
          var dy = pt.y - drag.startMouseY;

          if (drag.mode === "pan") {
            state.viewOffset.x = drag.startPanX + dx;
            state.viewOffset.y = drag.startPanY + dy;
            renderUI();
            setCanvasCursor("dragging");
            return;
          }

          if (drag.mode === "label") {
            var targetSet = engine.getSetById(drag.setId);
            if (!targetSet) return;
            if (!targetSet.pointOffsets) targetSet.pointOffsets = Object.create(null);
            var currentOff = targetSet.pointOffsets[drag.label] || { dx: 20, dy: -20 };
            currentOff.dx = Math.round(drag.startDX + dx);
            currentOff.dy = Math.round(drag.startDY + dy);
            targetSet.pointOffsets[drag.label] = currentOff;
            updatePointSliderUI(drag.setId, drag.label);
            renderUI();
            setCanvasCursor("dragging");
            return;
          }

          if (drag.mode === "point-marker") {
            setCanvasCursor("pointer");
            return;
          }
        }

        addListener(mountedCanvas, "mousemove", function (e) {
          if (drag.active) {
            handleDragMouseMove(e);
            return;
          }

          var pt = canvasPointFromEvent(e);
          var hitL = hitTestLabel(engine.getLabelBoxes(), pt.x, pt.y);
          if (hitL) {
            setCanvasCursor("can-drag");
          } else if (engine.hitTestPointMarker(pt.x, pt.y)) {
            setCanvasCursor("pointer");
          } else {
            setCanvasCursor(null);
          }
        });

        addListener(window, "mousemove", function (e) {
          if (drag.active) {
            handleDragMouseMove(e);
          }
        });

        addListener(mountedCanvas, "mousedown", function (e) {
          var pt = canvasPointFromEvent(e);
          if (state.connectionMode) {
            var connectHit = engine.hitTestPointMarker(pt.x, pt.y);
            e.preventDefault();
            if (!connectHit) {
              var connectHint = document.getElementById("mfCoordConnectHint");
              if (connectHint) connectHint.textContent = "Select an existing point. Empty canvas does not create a point in connection mode.";
              return;
            }
            var result = engine.selectConnectionPoint({ setId: connectHit.setId, pointId: connectHit.point.id });
            syncConnectionUI();
            var connectHintResult = document.getElementById("mfCoordConnectHint");
            if (connectHintResult && result.started) connectHintResult.textContent = "Starting point selected. Select the next point.";
            else if (connectHintResult) connectHintResult.textContent = result.ok ? "Line created. Select another point pair, or cancel connection mode." : result.reason;
            renderUI();
            return;
          }
          var hit = hitTestLabel(engine.getLabelBoxes(), pt.x, pt.y);

          if (hit) {
            drag.active = true;
            drag.mode = "label";
            drag.setId = hit.setId;
            drag.label = hit.label;
            drag.startMouseX = pt.x;
            drag.startMouseY = pt.y;
            var targetSet = engine.getSetById(hit.setId);
            var currentOff = (targetSet && targetSet.pointOffsets && targetSet.pointOffsets[hit.label]) ? targetSet.pointOffsets[hit.label] : { dx: 20, dy: -20 };
            drag.startDX = currentOff.dx;
            drag.startDY = currentOff.dy;
            setCanvasCursor("dragging");
            return;
          }

          // Check if clicking directly on a point marker (do NOT pan, do NOT change coordinates)
          var hitMarker = engine.hitTestPointMarker(pt.x, pt.y);
          if (hitMarker) {
            drag.active = true;
            drag.mode = "point-marker";
            drag.setId = hitMarker.setId;
            drag.label = hitMarker.label;
            drag.startMouseX = pt.x;
            drag.startMouseY = pt.y;
            setCanvasCursor("pointer");
            return;
          }

          // Pan genuinely empty canvas space
          drag.active = true;
          drag.mode = "pan";
          drag.setId = null;
          drag.label = null;
          drag.startMouseX = pt.x;
          drag.startMouseY = pt.y;
          drag.startPanX = state.viewOffset.x;
          drag.startPanY = state.viewOffset.y;
          setCanvasCursor("dragging");
        });

        // Window mouseup listener (strictly managed with guaranteed unmount cleanup)
        addListener(window, "mouseup", function () {
          if (drag.active) {
            drag.active = false;
            drag.mode = null;
            drag.setId = null;
            drag.label = null;
            setCanvasCursor(null);
          }
        });

        addListener(mountedCanvas, "wheel", function (e) {
          e.preventDefault();
          var factor = e.deltaY < 0 ? 1.08 : 0.92;
          state.viewZoom = Math.max(0.4, Math.min(3.0, state.viewZoom * factor));
          updateZoomReadout();
          renderUI();
        }, { passive: false });

        // [Phase 3B.3] Textarea replaced by structured input card.

        // Initialize input rows on mount
        if (inputRows.length === 0) {
          inputRows = [buildInputRow('A', '', '')];
        }
        renderInputRows();

        var inputRowsContainer = document.getElementById("mfCoordInputRows");
        if (inputRowsContainer) {
          addListener(inputRowsContainer, "input", function (event) {
            var input = event.target;
            var rowEl = input.closest("[data-row-index]");
            if (!rowEl || !input.dataset.field) return;
            var rowIndex = Number(rowEl.dataset.rowIndex);
            if (!inputRows[rowIndex]) return;
            inputRows[rowIndex][input.dataset.field] = input.value;
            var activeSet = engine.getActiveSet();
            if (activeSet) activeSet.draftRows = inputRows.map(function (row) { return buildInputRow(row.label, row.x, row.y, row.id); });
          });
          addListener(inputRowsContainer, "click", function (event) {
            var button = event.target.closest("button[data-action='remove-point']");
            if (!button) return;
            inputRows.splice(Number(button.dataset.rowIndex), 1);
            if (inputRows.length === 0) inputRows.push(buildInputRow("A", "", ""));
            renderInputRows();
            var activeSet = engine.getActiveSet();
            if (activeSet) activeSet.draftRows = inputRows.map(function (row) { return buildInputRow(row.label, row.x, row.y, row.id); });
          });
        }

        // Wire Add Point button
        var addPointBtn = document.getElementById('mfCoordAddPointBtn');
        if (addPointBtn) {
          addListener(addPointBtn, 'click', function () {
            inputRows.push(buildInputRow(nextAutoLabel(), '', ''));
            renderInputRows();
            var activeSet = engine.getActiveSet();
            if (activeSet) activeSet.draftRows = inputRows.map(function (row) { return buildInputRow(row.label, row.x, row.y, row.id); });
            var rowsContainer = document.getElementById('mfCoordInputRows');
            if (rowsContainer) rowsContainer.scrollTop = rowsContainer.scrollHeight;
          });
        }

        // Wire Plot Points button
        var plotBtn = document.getElementById('mfCoordPlotBtn');
        if (plotBtn) {
          addListener(plotBtn, 'click', function () {
            var validationEl = document.getElementById('mfCoordValidationMsg');
            var errors = validateInputRows();
            if (errors.length > 0) {
              if (validationEl) {
                validationEl.style.display = '';
                validationEl.textContent = errors.map(function (e) { return e.error; }).join(' Â· ');
              }
              return;
            }
            if (validationEl) validationEl.style.display = 'none';
            var text = rowsToInputText();
            var activeSet = engine.getActiveSet();
            if (activeSet) {
              activeSet.inputText = text;
              delete activeSet.draftRows;
              try {
                var parsed = parsePoints(text);
                activeSet.points = preservePointStyles(activeSet.points, parsed);
                activeSet.points.forEach(function (point, index) {
                  if (inputRows[index] && inputRows[index].id) point.id = inputRows[index].id;
                });
                ensurePointOffsets(activeSet);
                engine.prunePointReferences(activeSet);
              } catch (err) { activeSet.points = []; }
            }
            state.marginUnits = 2;
            rebuildPointControlsUI();
            renderUI();
          });
        }

        var addSetBtn = document.getElementById("mfCoordAddSetBtn");
        if (addSetBtn) {
          addListener(addSetBtn, "click", function () {
            var nextIndex = state.pointSets.length + 1;
            var nextSet = engine.buildSet("Set " + nextIndex, "");
            state.pointSets.push(nextSet);
            state.activeSetId = nextSet.id;
            syncUIFromActiveSet();
            renderUI();
          });
        }

        var connectModeBtn = document.getElementById("mfCoordConnectModeBtn");
        if (connectModeBtn) addListener(connectModeBtn, "click", function () {
          state.connectionMode = !state.connectionMode;
          state.connectionStart = null;
          syncConnectionUI();
          renderUI();
        });
        var cancelConnectionBtn = document.getElementById("mfCoordCancelConnectionBtn");
        if (cancelConnectionBtn) addListener(cancelConnectionBtn, "click", function () {
          engine.cancelConnection();
          syncConnectionUI();
          renderUI();
        });
        var linesVisibleInput = document.getElementById("mfCoordLinesVisible");
        if (linesVisibleInput) addListener(linesVisibleInput, "change", function () {
          state.connectionsVisible = linesVisibleInput.checked;
          renderUI();
        });
        var lineColorInput = document.getElementById("mfCoordLineColor");
        if (lineColorInput) addListener(lineColorInput, "input", function () {
          state.connectionColor = lineColorInput.value;
          renderUI();
        });
        var lineWidthInput = document.getElementById("mfCoordLineWidth");
        if (lineWidthInput) addListener(lineWidthInput, "input", function () {
          state.connectionWidth = Math.max(1, Math.min(12, Number(lineWidthInput.value) || 2));
          var value = document.getElementById("mfCoordLineWidthVal");
          if (value) value.textContent = lineWidthInput.value;
          renderUI();
        });
        var lineStyleInput = document.getElementById("mfCoordLineStyle");
        if (lineStyleInput) addListener(lineStyleInput, "change", function () {
          state.connectionStyle = normalizeLineStyle(lineStyleInput.value);
          renderUI();
        });
        var clearConnectionsBtn = document.getElementById("mfCoordClearConnectionsBtn");
        if (clearConnectionsBtn) addListener(clearConnectionsBtn, "click", function () {
          state.connections = [];
          state.connectionStart = null;
          syncConnectionUI();
          renderUI();
        });
        var connectionList = document.getElementById("mfCoordConnectionList");
        if (connectionList) addListener(connectionList, "click", function (event) {
          var button = event.target.closest("button[data-connection-id]");
          if (!button) return;
          state.connections = state.connections.filter(function (line) { return line.id !== button.dataset.connectionId; });
          syncConnectionUI();
          renderUI();
        });
        var closeShapeBtn = document.getElementById("mfCoordCloseShapeBtn");
        if (closeShapeBtn) addListener(closeShapeBtn, "click", function () {
          var result = engine.closePointSet(engine.getActiveSet());
          syncConnectionUI();
          var hint = document.getElementById("mfCoordShapeHint");
          if (hint) hint.textContent = result.ok ? "Shape closed. Enable Fill to colour its interior." : result.reason;
          renderUI();
        });
        var openShapeBtn = document.getElementById("mfCoordOpenShapeBtn");
        if (openShapeBtn) addListener(openShapeBtn, "click", function () {
          var activeSet = engine.getActiveSet();
          state.closedShapes = state.closedShapes.filter(function (shape) { return !activeSet || shape.setId !== activeSet.id; });
          syncConnectionUI();
          var hint = document.getElementById("mfCoordShapeHint");
          if (hint) hint.textContent = "Shape reopened. Its points and connections remain.";
          renderUI();
        });
        var fillEnabledInput = document.getElementById("mfCoordFillEnabled");
        if (fillEnabledInput) addListener(fillEnabledInput, "change", function () {
          state.fillEnabled = fillEnabledInput.checked;
          renderUI();
        });
        var fillColorInput = document.getElementById("mfCoordFillColor");
        if (fillColorInput) addListener(fillColorInput, "input", function () {
          state.fillColor = fillColorInput.value;
          renderUI();
        });
        var fillOpacityInput = document.getElementById("mfCoordFillOpacity");
        if (fillOpacityInput) addListener(fillOpacityInput, "input", function () {
          state.fillOpacity = Math.max(0, Math.min(1, Number(fillOpacityInput.value) / 100));
          var value = document.getElementById("mfCoordFillOpacityVal");
          if (value) value.textContent = fillOpacityInput.value + "%";
          renderUI();
        });
        var noFillBtn = document.getElementById("mfCoordNoFillBtn");
        if (noFillBtn) addListener(noFillBtn, "click", function () {
          state.fillEnabled = false;
          if (fillEnabledInput) fillEnabledInput.checked = false;
          syncConnectionUI();
          renderUI();
        });

        // Delegated events for Set Manager & Point Controls
        var setListEl = document.getElementById("mfCoordSetList");
        if (setListEl) {
          addListener(setListEl, "input", function (e) {
            if (e.target && e.target.classList.contains("mf-coord-set-name")) {
              var sId = e.target.getAttribute("data-set-id");
              var s = engine.getSetById(sId);
              if (s) {
                s.name = e.target.value.trim() || "Set";
                rebuildPointControlsUI();
                renderUI();
              }
            }
          });

          addListener(setListEl, "click", function (e) {
            var btn = e.target.closest("button[data-action]");
            if (!btn) return;
            var action = btn.getAttribute("data-action");
            var sId = btn.getAttribute("data-set-id");
            if (action === "select") {
              state.activeSetId = sId;
              syncUIFromActiveSet();
              renderUI();
            } else if (action === "remove") {
              if (state.pointSets.length <= 1) return;
              var remIdx = state.pointSets.findIndex(function (s) { return s.id === sId; });
              if (remIdx !== -1) {
                state.connections = state.connections.filter(function (line) { return line.startSetId !== sId && line.endSetId !== sId; });
                state.closedShapes = state.closedShapes.filter(function (shape) { return shape.setId !== sId; });
                if (state.connectionStart && state.connectionStart.setId === sId) state.connectionStart = null;
                state.pointSets.splice(remIdx, 1);
                state.activeSetId = state.pointSets[Math.max(0, remIdx - 1)].id;
                syncUIFromActiveSet();
                syncConnectionUI();
                renderUI();
              }
            }
          });
        }

        var pointControlsWrap = document.getElementById("mfCoordPointControls");
        if (pointControlsWrap) {
          addListener(pointControlsWrap, "input", function (e) {
            if (!e.target) return;
            if (e.target.type === "range") {
              var sId = e.target.dataset.setId;
              var lab = e.target.dataset.label;
              var key = e.target.dataset.key;
              var targetSet = engine.getSetById(sId);
              if (targetSet) {
                if (!targetSet.pointOffsets) targetSet.pointOffsets = Object.create(null);
                if (!targetSet.pointOffsets[lab]) targetSet.pointOffsets[lab] = { dx: 20, dy: -20 };
                targetSet.pointOffsets[lab][key] = Number(e.target.value);
                var vEl = document.getElementById("mfCoordVal-" + sId + "-" + lab + "-" + key);
                if (vEl) vEl.textContent = e.target.value;
                renderUI();
              }
            } else if (e.target.type === "color") {
              var sId = e.target.dataset.setId;
              var lab = e.target.dataset.label;
              var targetSet = engine.getSetById(sId);
              if (targetSet && targetSet.points) {
                var pt = targetSet.points.find(function (p) { return p.label === lab; });
                if (pt) {
                  pt.style = normalizePointStyle({ color: e.target.value, shape: (pt.style && pt.style.shape) || DEFAULT_POINT_SHAPE });
                  renderUI();
                }
              }
            }
          });

          addListener(pointControlsWrap, "change", function (e) {
            if (!e.target) return;
            if (e.target.tagName === "SELECT") {
              var sId = e.target.dataset.setId;
              var lab = e.target.dataset.label;
              var targetSet = engine.getSetById(sId);
              if (targetSet && targetSet.points) {
                var pt = targetSet.points.find(function (p) { return p.label === lab; });
                if (pt) {
                  pt.style = normalizePointStyle({ color: (pt.style && pt.style.color) || DEFAULT_POINT_COLOR, shape: e.target.value });
                  renderUI();
                }
              }
            }
          });
        }

        // Wire right panel controls
        var resetViewBtn = document.getElementById("mfCoordResetViewBtn");
        if (resetViewBtn) {
          addListener(resetViewBtn, "click", function () {
            doFullReset();
          });
        }

        var resetBgBtn = document.getElementById("mfCoordResetBgBtn");
        if (resetBgBtn) {
          addListener(resetBgBtn, "click", function () {
            state.canvasBgColor = "#ffffff";
            var bgCol = document.getElementById("mfCoordBgColor");
            if (bgCol) bgCol.value = "#ffffff";
            renderUI();
          });
        }

        // Checkboxes & style inputs in properties panel
        var propMappings = [
          { id: "mfCoordShowDiagonals", key: "diagVisible", isDiag: true },
          { id: "mfCoordDiagColor", key: "diagColor", isDiag: true },
          { id: "mfCoordDiagWidth", key: "diagWidth", isDiag: true },
          { id: "mfCoordDiagStyle", key: "diagStyle", isDiag: true },
          { id: "mfCoordGridVisible", key: "gridVisible" },
          { id: "mfCoordGridColor", key: "gridColor" },
          { id: "mfCoordGridOpacity", key: "gridOpacity" },
          { id: "mfCoordXAxisVisible", key: "xAxisVisible" },
          { id: "mfCoordYAxisVisible", key: "yAxisVisible" },
          { id: "mfCoordAxisColor", key: "axisColor" },
          { id: "mfCoordAxisWidth", key: "axisWidth" },
          { id: "mfCoordAxisLabelsVisible", key: "axisLabelsVisible" },
          { id: "mfCoordShowLabels", key: "showLabels" },
          { id: "mfCoordPrecision", key: "coordPrecision" },
          { id: "mfCoordBgColor", key: "canvasBgColor" }
        ];

        propMappings.forEach(function (m) {
          var el = document.getElementById(m.id);
          if (!el) return;
          var evtType = (el.type === "checkbox" || el.tagName === "SELECT") ? "change" : "input";
          addListener(el, evtType, function () {
            var activeSet = engine.getActiveSet();
            if (m.isDiag && activeSet && activeSet.renderOptions) {
              var diag = activeSet.renderOptions.diagonals;
              if (m.id === "mfCoordShowDiagonals") diag.visible = el.checked;
              if (m.id === "mfCoordDiagColor") diag.color = el.value;
              if (m.id === "mfCoordDiagWidth") {
                diag.width = Number(el.value) || 2;
                var dVal = document.getElementById("mfCoordDiagWidthVal");
                if (dVal) dVal.textContent = el.value;
              }
              if (m.id === "mfCoordDiagStyle") diag.style = normalizeLineStyle(el.value);
            } else {
              if (el.type === "checkbox") state[m.key] = el.checked;
              else if (m.key === "gridOpacity") {
                state[m.key] = Number(el.value) / 100;
                var gVal = document.getElementById("mfCoordGridOpacityVal");
                if (gVal) gVal.textContent = el.value + "%";
              } else if (m.key === "axisWidth") {
                state[m.key] = Number(el.value) || 2;
                var aVal = document.getElementById("mfCoordAxisWidthVal");
                if (aVal) aVal.textContent = el.value;
              } else {
                state[m.key] = el.value;
              }
            }
            renderUI();
          });
        });

        // Initial sync and render
        syncActiveUI = syncUIFromActiveSet;
        syncUIFromActiveSet();
        addListener(document, "mf:graph-design-changed", renderUI);
        renderUI();
      },

      unmount: function () {
        syncActiveUI = null;
        // Detach 100% of listeners (including window mouseup)
        clearCleanups();

        // Clean up DOM components injected into left and right panels
        if (leftPanelInputsContainer && leftPanelInputsContainer.parentNode) {
          leftPanelInputsContainer.parentNode.removeChild(leftPanelInputsContainer);
          leftPanelInputsContainer = null;
        }

        if (rightPanelPropsContainer) {
          rightPanelPropsContainer.innerHTML = '<div class="mf-property-placeholder">Select a tool from the Input Tools panel to view its customizable visual properties.</div>';
          rightPanelPropsContainer = null;
        }

        // Disable toolbar buttons
        ["mfResetViewToolbarBtn", "mfZoomInBtn", "mfZoomOutBtn", "mfExportPngBtn"].forEach(function (btnId) {
          var btn = document.getElementById(btnId);
          if (btn) {
            btn.setAttribute("disabled", "disabled");
            btn.setAttribute("aria-disabled", "true");
          }
        });

        var readout = document.getElementById("mfCanvasZoomReadout");
        if (readout) {
          readout.textContent = "Workspace Â· 100%";
        }

        if (mountedContainer) {
          mountedContainer.innerHTML = "";
          mountedContainer = null;
        }
        mountedCanvas = null;
      },

      resize: function (width, height, dpr) {
        if (!mountedCanvas || !mountedContainer) return;
        if (window.MathForgeWorkspace && typeof window.MathForgeWorkspace.fitCanvasToContainer === "function") {
          window.MathForgeWorkspace.fitCanvasToContainer(mountedCanvas, mountedContainer, { dpr: dpr });
        }
        renderUI();
      },

      render: function () {
        renderUI();
      },

      getState: function () {
        try {
          return JSON.parse(JSON.stringify(state));
        } catch (e) {
          return state;
        }
      },

      setState: function (savedState) {
        if (!savedState || typeof savedState !== "object") return;
        Object.keys(state).forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(savedState, key) && key !== "fontSizePt" && key !== "bold") delete state[key];
        });
        for (var k in savedState) {
          if (savedState.hasOwnProperty(k)) {
            state[k] = savedState[k];
          }
        }
        state.connections = Array.isArray(state.connections) ? state.connections : [];
        state.connectionsVisible = savedState.connectionsVisible === undefined ? true : savedState.connectionsVisible !== false;
        state.connectionColor = /^#[0-9a-fA-F]{6}$/.test(state.connectionColor || "") ? state.connectionColor : DEFAULT_CONNECTION_COLOR;
        state.connectionWidth = Math.max(1, Math.min(12, Number(state.connectionWidth) || 2));
        state.connectionStyle = normalizeLineStyle(state.connectionStyle || "solid");
        state.closedShapes = Array.isArray(state.closedShapes) ? state.closedShapes : [];
        state.fillEnabled = savedState.fillEnabled === undefined ? false : Boolean(state.fillEnabled);
        state.fillColor = /^#[0-9a-fA-F]{6}$/.test(state.fillColor || "") ? state.fillColor : DEFAULT_FILL_COLOR;
        state.fillOpacity = savedState.fillOpacity === undefined ? 0.18 : Math.max(0, Math.min(1, Number(state.fillOpacity) || 0));
        state.connectionMode = false;
        state.connectionStart = null;
        state.pointSets = Array.isArray(state.pointSets) ? state.pointSets : [];
        (state.pointSets || []).forEach(function (set) {
          set.id = set.id || makeSetId();
          set.points = Array.isArray(set.points) ? set.points : [];
          if (set.inputText && set.inputText.trim()) {
            try { set.points = preservePointStyles(set.points, parsePoints(set.inputText)); } catch (ignoreParse) { /* keep saved points */ }
          }
          set.points.forEach(function (point) { if (!point.id) point.id = makePointId(); });
          set.renderOptions = set.renderOptions || defaultRenderOptions();
          set.renderOptions.polygon = Object.assign(defaultRenderOptions().polygon, set.renderOptions.polygon || {});
          set.renderOptions.diagonals = Object.assign(defaultRenderOptions().diagonals, set.renderOptions.diagonals || {});
          ensurePointOffsets(set);
        });
        if (!state.pointSets.length) {
          var emptySet = engine.buildSet("Set 1", "");
          state.pointSets.push(emptySet);
          state.activeSetId = emptySet.id;
        }
        // Older v1 projects represented a closed polygon through per-set render options.
        // Convert that saved intent once into stable point-ID shape data, then turn off
        // the legacy auto-polygon path so future points remain independent.
        if (!Array.isArray(savedState.closedShapes)) {
          (state.pointSets || []).forEach(function (set) {
            var polygon = set.renderOptions && set.renderOptions.polygon;
            if (polygon && polygon.visible && set.points.length >= 3) {
              var legacyShape = { id: makeShapeId(), setId: set.id, pointIds: set.points.map(function (point) { return point.id; }) };
              state.closedShapes.push(legacyShape);
              if (savedState.fillEnabled === undefined && polygon.fillVisible !== false) state.fillEnabled = true;
              if (savedState.fillColor === undefined && polygon.fillColor) state.fillColor = polygon.fillColor;
              if (savedState.fillOpacity === undefined && Number.isFinite(Number(polygon.fillOpacity))) state.fillOpacity = Math.max(0, Math.min(1, Number(polygon.fillOpacity)));
              polygon.visible = false;
              polygon.fillVisible = false;
            }
          });
        }
        state.connections = state.connections.filter(function (line) {
          if (!line || !line.startPointId || !line.endPointId) return false;
          return findPointByRef(state.pointSets, line.startSetId || line.setId, line.startPointId) &&
            findPointByRef(state.pointSets, line.endSetId || line.setId, line.endPointId);
        }).map(function (line) {
          line.startSetId = line.startSetId || line.setId;
          line.endSetId = line.endSetId || line.setId;
          line.id = line.id || makeConnectionId();
          return line;
        });
        state.closedShapes = state.closedShapes.filter(function (shape) {
          var set = (state.pointSets || []).find(function (item) { return item.id === shape.setId; });
          if (!set) return false;
          shape.pointIds = (shape.pointIds || []).filter(function (id) { return set.points.some(function (point) { return point.id === id; }); });
          shape.id = shape.id || makeShapeId();
          return new Set(shape.pointIds).size >= 3;
        });
        state.fontSizePt = Math.max(6, Math.min(36, Number(state.fontSizePt) || 11));
        state.bold = Boolean(state.bold);
        if (window.MathForgeGraphDesignSettings && window.MathForgeGraphDesignSettings.getState) {
          var sharedTypography = window.MathForgeGraphDesignSettings.getState();
          state.fontSizePt = sharedTypography.fontSizePt;
          state.bold = sharedTypography.bold;
        }
        if (typeof syncActiveUI === "function") {
          syncActiveUI();
        }
        renderUI();
      },

      reset: function () {
        doFullReset();
      },

      export: function (format) {
        if (!mountedCanvas) return null;
        if (format === "png" || !format) {
          return mountedCanvas.toDataURL("image/png");
        }
        return null;
      },

      resetView: function () {
        if (engine && typeof engine.resetView === "function") {
          engine.resetView();
        }
        var readout = document.getElementById("mfCanvasZoomReadout");
        if (readout) {
          readout.textContent = "Coordinates Â· 100%";
        }
        var statusZoom = document.getElementById("mfStatusZoom");
        if (statusZoom) {
          statusZoom.textContent = "100%";
        }
        renderUI();
      },

      getEngine: function () {
        return engine;
      }
    };
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ==========================================================================
     7. Public Namespace & Auto-Registration
     ========================================================================== */
  var coordinatesToolAdapter = createWorkspaceAdapter();

  window.MathForgeCoordinates = {
    parsePoints: parsePoints,
    computeBounds: computeBounds,
    computeFittedBounds: computeFittedBounds,
    makeTransform: makeTransform,
    formatCoordinate: formatCoordinate,
    createEngine: createCoordinatesEngine,
    initStandalone: initStandalone,
    adapter: coordinatesToolAdapter
  };

  // Register in MathForgeWorkspace if workspace shell is present
  if (window.MathForgeWorkspace && typeof window.MathForgeWorkspace.registerTool === "function") {
    window.MathForgeWorkspace.registerTool(coordinatesToolAdapter);
  }

})(window, document);
