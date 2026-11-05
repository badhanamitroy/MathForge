(function (window, document) {
  "use strict";

  var calculations = window.MathForgePieCalculations;
  var palette = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#eab308", "#db2777"];
  var fruitNames = ["আম", "কলা", "আপেল", "কমলা", "আঙুর", "পেয়ারা", "পেঁপে", "আনারস"];
  var idCounter = 0;

  function makeId() {
    var id;
    do {
      idCounter += 1;
      id = "pie-category-" + Date.now().toString(36) + "-" + idCounter.toString(36);
    } while (typeof state !== "undefined" && state && Array.isArray(state.categories) && state.categories.some(function (category) { return category.id === id; }));
    return id;
  }

  function extendedColor(index) {
    var hue = (index * 137.508 + 37) % 360;
    var saturation = 0.66;
    var lightness = 0.48;
    var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    var segment = hue / 60;
    var secondary = chroma * (1 - Math.abs(segment % 2 - 1));
    var rgb = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] :
      segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] :
      segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
    var offset = lightness - chroma / 2;
    return "#" + rgb.map(function (component) { return Math.round((component + offset) * 255).toString(16).padStart(2, "0"); }).join("");
  }

  function colorFor(index, color) {
    return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? color : (palette[index] || extendedColor(index));
  }

  function defaultState() {
    return {
      title: "ফলের বিক্রি",
      unit: "কেজি",
      mode: "pie",
      numerals: "bn",
      holeRatio: 0.58,
      slicePercentageFontSize: 12,
      donutCenterLabelFontSize: 12,
      donutCenterValueFontSize: 20,
      showChart: true,
      showCalculationTable: true,
      showDrawingSteps: true,
      categories: fruitNames.map(function (name, index) {
        return { id: makeId(), name: name, value: "", color: palette[index] };
      })
    };
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  var state = defaultState();
  var root = null;
  var controlsHost = null;
  var inputHost = null;
  var propertiesHost = null;
  var lastValidModel = null;
  var toolCleanup = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function formatNumber(value, digits) {
    var locale = state.numerals === "bn" ? "bn-BD" : "en-US";
    return Number(value).toLocaleString(locale, { maximumFractionDigits: digits == null ? 10 : digits });
  }

  function activeModel() {
    if (!calculations) return { valid: false, reason: "unavailable", message: "Pie Chart calculations could not be loaded." };
    return calculations.calculate(state.categories);
  }

  function setStatus(message, invalid) {
    if (!root) return;
    var status = root.querySelector(".pie-render-feedback");
    if (!status) return;
    status.textContent = message || "";
    status.setAttribute("role", invalid ? "alert" : "status");
  }

  function currentDesign() {
    return window.MathForgeGraphDesignSettings
      ? window.MathForgeGraphDesignSettings.getState()
      : { background: "#ffffff", fontFamily: "Times New Roman", fontSizePt: 11, bold: false, fontColor: "#111827", lineColor: "#ffffff", lineWidth: 1 };
  }

  function categoryById(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i];
    }
    return null;
  }

  function renderControls(focusId) {
    if (!inputHost) return;
    var html = '<section class="mf-tool-control-host mf-tool-control-pie-chart" aria-label="Pie Chart inputs">' +
      '<section class="pie-input-section"><h3>Chart information</h3>' +
        '<label>Chart title<input type="text" data-pie-field="title" value="' + escapeHtml(state.title) + '"></label>' +
        '<label>Measurement unit<input type="text" data-pie-field="unit" value="' + escapeHtml(state.unit) + '"></label>' +
      '</section>' +
      '<section class="pie-input-section"><h3>Categories and values</h3>' +
        '<div class="pie-category-table" role="group" aria-label="Pie chart categories">';
    state.categories.forEach(function (category, index) {
      var id = escapeHtml(category.id);
      html += '<div class="pie-category-row" data-pie-row="' + id + '">' +
        '<label>Category<input type="text" data-pie-category="' + id + '" data-pie-key="name" value="' + escapeHtml(category.name) + '" aria-label="Category ' + (index + 1) + ' name"></label>' +
        '<label>Value<input type="text" inputmode="decimal" data-pie-category="' + id + '" data-pie-key="value" value="' + escapeHtml(category.value) + '" aria-label="Category ' + (index + 1) + ' value"></label>' +
        '<label aria-label="Category ' + (index + 1) + ' color"><input type="color" data-pie-category="' + id + '" data-pie-key="color" value="' + escapeHtml(colorFor(index, category.color)) + '"></label>' +
        '<button class="pie-remove-category" type="button" data-pie-remove="' + id + '" aria-label="Remove category ' + (index + 1) + '" title="Remove category">×</button>' +
      '</div>';
    });
    html += '</div><div class="pie-category-actions">' +
      '<button class="primary" type="button" data-pie-action="add">+ Add Category</button>' +
      '<button type="button" data-pie-action="sort">Sort Largest to Smallest</button>' +
      '</div><div class="pie-validation" data-pie-input-validation role="status" aria-live="polite"></div></section>' +
      '<section class="pie-input-section"><h3>Display options</h3>' +
        '<div class="pie-radio-row" role="radiogroup" aria-label="Chart type">' +
          '<label><input type="radio" name="pie-chart-mode" value="pie"' + (state.mode === "pie" ? " checked" : "") + '> Pie Chart</label>' +
          '<label><input type="radio" name="pie-chart-mode" value="donut"' + (state.mode === "donut" ? " checked" : "") + '> Donut</label>' +
        '</div>' +
        '<div class="pie-radio-row" role="radiogroup" aria-label="Numeral display">' +
          '<label><input type="radio" name="pie-numerals" value="bn"' + (state.numerals === "bn" ? " checked" : "") + '> Bengali numerals</label>' +
          '<label><input type="radio" name="pie-numerals" value="en"' + (state.numerals === "en" ? " checked" : "") + '> English numerals</label>' +
        '</div>' +
      '</section></section>';
    inputHost.innerHTML = html;
    if (focusId) {
      var focusTarget = inputHost.querySelector('[data-pie-category="' + focusId + '"][data-pie-key="name"]');
      if (focusTarget) focusTarget.focus();
    }
  }

  function localizeInputValidation(model) {
    if (!inputHost) return;
    var message = inputHost.querySelector("[data-pie-input-validation]");
    if (message) message.textContent = model.valid ? "" : model.message;
    var invalidId = model.reason === "invalid" || model.reason === "negative" ? state.categories[model.rowIndex] && state.categories[model.rowIndex].id : null;
    inputHost.querySelectorAll('[data-pie-key="value"]').forEach(function (input) {
      var invalid = Boolean(invalidId && input.getAttribute("data-pie-category") === invalidId);
      input.setAttribute("aria-invalid", String(invalid));
    });
  }

  function svgNumber(value) {
    var text = Number(value).toFixed(3);
    return text.indexOf(".") === -1 ? text : text.replace(/0+$/, "").replace(/\.$/, "");
  }

  function wedgePath(cx, cy, outerRadius, innerRadius, start, end) {
    var startRadians = start * Math.PI / 180;
    var endRadians = end * Math.PI / 180;
    var x1 = cx + outerRadius * Math.cos(startRadians);
    var y1 = cy + outerRadius * Math.sin(startRadians);
    var x2 = cx + outerRadius * Math.cos(endRadians);
    var y2 = cy + outerRadius * Math.sin(endRadians);
    var large = end - start > 180 ? 1 : 0;
    if (innerRadius <= 0) {
      return "M " + svgNumber(cx) + " " + svgNumber(cy) + " L " + svgNumber(x1) + " " + svgNumber(y1) +
        " A " + outerRadius + " " + outerRadius + " 0 " + large + " 1 " + svgNumber(x2) + " " + svgNumber(y2) + " Z";
    }
    var ix2 = cx + innerRadius * Math.cos(endRadians);
    var iy2 = cy + innerRadius * Math.sin(endRadians);
    var ix1 = cx + innerRadius * Math.cos(startRadians);
    var iy1 = cy + innerRadius * Math.sin(startRadians);
    return "M " + svgNumber(x1) + " " + svgNumber(y1) +
      " A " + outerRadius + " " + outerRadius + " 0 " + large + " 1 " + svgNumber(x2) + " " + svgNumber(y2) +
      " L " + svgNumber(ix2) + " " + svgNumber(iy2) +
      " A " + innerRadius + " " + innerRadius + " 0 " + large + " 0 " + svgNumber(ix1) + " " + svgNumber(iy1) + " Z";
  }

  function buildSvg(model, withLegend) {
    var design = currentDesign();
    var count = model.categories.length;
    var height = withLegend ? Math.max(620, 160 + count * 34) : 520;
    var width = withLegend ? 980 : 520;
    var cx = withLegend ? 270 : 260;
    var cy = height / 2 + (withLegend ? 24 : 0);
    var radius = withLegend ? 218 : 205;
    var innerRadius = state.mode === "donut" ? radius * Math.max(0.35, Math.min(0.72, Number(state.holeRatio) || 0.58)) : 0;
    var sepColor = /^#[0-9a-f]{6}$/i.test(design.lineColor) ? design.lineColor : "#ffffff";
    var sepWidth = Math.max(0.6, Math.min(4, Number(design.lineWidth) * 0.42 || 1));
    var fontFamily = escapeHtml(design.fontFamily || "Times New Roman");
    var title = escapeHtml(state.title || "Pie Chart");
    function fitTextSize(text, requested, maxWidth) {
      return Math.max(8, Math.min(requested, maxWidth / Math.max(1, String(text).length * 0.62)));
    }
    var description = escapeHtml(model.categories.length + " categories; total " + model.total + (state.unit ? " " + state.unit : ""));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="pie-chart-svg" role="img" aria-labelledby="pieSvgTitle pieSvgDesc" viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height + '">' +
      '<title id="pieSvgTitle">' + title + '</title><desc id="pieSvgDesc">' + description + '</desc>' +
      '<rect width="100%" height="100%" fill="' + escapeHtml(design.background || "#ffffff") + '"/>';
    if (withLegend) {
      svg += '<text x="' + (width / 2) + '" y="42" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="26" font-weight="' + (design.bold ? "700" : "600") + '">' + title + ' · ' + (state.mode === "donut" ? "Donut" : "Pie Chart") + '</text>' +
        '<text x="' + (width / 2) + '" y="68" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="16">Total: ' + formatNumber(model.total) + (state.unit ? " " + escapeHtml(state.unit) : "") + '</text>';
    }
    var angle = -90;
    model.categories.forEach(function (category, index) {
      var next = angle + category.exactAngle * 360 / 360;
      var color = colorFor(index, category.color);
      var label = escapeHtml(category.label + ", " + formatNumber(category.value) + " " + state.unit + ", " + formatNumber(category.percentage, 1) + " percent, " + formatNumber(category.exactAngle, 1) + " degrees");
      svg += '<path class="pie-slice" data-pie-index="' + index + '" d="' + wedgePath(cx, cy, radius, innerRadius, angle, next) + '" fill="' + escapeHtml(color) + '" stroke="' + escapeHtml(sepColor) + '" stroke-width="' + sepWidth + '" tabindex="0" focusable="true" role="img" aria-label="' + label + '"><title>' + label + '</title></path>';
      var mid = (angle + next) / 2 * Math.PI / 180;
      if (category.exactAngle >= 18) {
        var labelRadius = innerRadius ? (radius + innerRadius) / 2 : radius * 0.64;
        var labelX = cx + labelRadius * Math.cos(mid);
        var labelY = cy + labelRadius * Math.sin(mid) + design.fontSizePt * 0.35;
        var percentText = formatNumber(category.percentage, 1) + "%";
        var chordWidth = 2 * labelRadius * Math.sin(Math.min(Math.PI, category.exactAngle * Math.PI / 180) / 2) * 0.8;
        var percentSize = fitTextSize(percentText, state.slicePercentageFontSize, Math.max(20, chordWidth));
        svg += '<text class="pie-percent-label" x="' + svgNumber(labelX) + '" y="' + svgNumber(labelY) + '" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" stroke="' + escapeHtml(design.background || "#ffffff") + '" stroke-width="0.8" paint-order="stroke" font-family="' + fontFamily + '" font-size="' + svgNumber(percentSize) + '" font-weight="' + (design.bold ? "700" : "400") + '" pointer-events="none">' + percentText + '</text>';
      }
      if (withLegend) {
        var ly = 100 + index * 34;
        svg += '<rect x="535" y="' + (ly - 13) + '" width="15" height="15" rx="3" fill="' + escapeHtml(color) + '"/>' +
          '<text x="562" y="' + ly + '" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="' + svgNumber(Math.max(12, Number(design.fontSizePt) * 1.25)) + '" font-weight="' + (design.bold ? "700" : "400") + '">' + escapeHtml(category.label) + '</text>' +
          '<text x="950" y="' + ly + '" text-anchor="end" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="' + svgNumber(Math.max(12, Number(design.fontSizePt) * 1.25)) + '" font-weight="' + (design.bold ? "700" : "400") + '">' + formatNumber(category.percentage, 1) + '%</text>';
      }
      angle = next;
    });
    if (innerRadius) {
      var centerWidth = innerRadius * 1.55;
      var centerLabel = state.numerals === "bn" ? "মোট" : "Total";
      var centerValue = formatNumber(model.total);
      var labelSize = fitTextSize(centerLabel, state.donutCenterLabelFontSize, centerWidth);
      var valueSize = fitTextSize(centerValue, state.donutCenterValueFontSize, centerWidth);
      var unitSize = state.unit ? fitTextSize(state.unit, Math.max(10, Number(design.fontSizePt) * 1.05), centerWidth) : 0;
      var labelY = cy - (state.unit ? 17 : 11);
      var valueY = cy + Math.max(2, valueSize * 0.42);
      svg += '<text class="pie-donut-center-label" x="' + cx + '" y="' + svgNumber(labelY) + '" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="' + svgNumber(labelSize) + '" font-weight="' + (design.bold ? "700" : "600") + '">' + centerLabel + '</text>' +
        '<text class="pie-donut-center-value" x="' + cx + '" y="' + svgNumber(valueY) + '" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="' + svgNumber(valueSize) + '" font-weight="' + (design.bold ? "700" : "600") + '">' + centerValue + '</text>';
      if (state.unit) svg += '<text class="pie-donut-center-unit" x="' + cx + '" y="' + svgNumber(valueY + unitSize + 3) + '" text-anchor="middle" fill="' + escapeHtml(design.fontColor || "#111827") + '" font-family="' + fontFamily + '" font-size="' + svgNumber(unitSize) + '">' + escapeHtml(state.unit) + '</text>';
    }
    return svg + "</svg>";
  }

  function renderLegend(model) {
    return '<div class="pie-legend" role="list" aria-label="Chart legend">' + model.categories.map(function (category, index) {
      return '<div class="pie-legend-entry" role="listitem"><button type="button" class="pie-legend-item" data-pie-index="' + index + '" aria-label="' + escapeHtml(category.label + ", " + formatNumber(category.percentage, 1) + " percent") + '">' +
        '<span class="pie-legend-swatch" style="background:' + escapeHtml(colorFor(index, category.color)) + '"></span>' +
        '<span class="pie-legend-name">' + escapeHtml(category.label) + '</span>' +
        '<span>' + formatNumber(category.percentage, 1) + '%</span></button></div>';
    }).join("") + '</div>';
  }

  function calculationTable(model) {
    var unit = state.unit ? " " + escapeHtml(state.unit) : "";
    var body = model.categories.map(function (category) {
      return '<tr><th scope="row">' + escapeHtml(category.label) + '</th>' +
        '<td>' + formatNumber(category.value) + unit + '</td>' +
        '<td>' + formatNumber(category.percentage, 1) + '%</td>' +
        '<td>(' + formatNumber(category.value) + ' ÷ ' + formatNumber(model.total) + ') × ' + formatNumber(360, 0) + '°</td>' +
        '<td>' + formatNumber(category.exactAngle, 1) + '°</td><td>' + formatNumber(category.wholeAngle, 0) + '°</td></tr>';
    }).join("");
    return '<div class="pie-output-section pie-calculation-output-section"><h2>Calculation table</h2><div class="pie-copy-row"><button type="button" data-pie-action="copy">Copy Table</button><span class="pie-copy-feedback" role="status" aria-live="polite"></span></div>' +
      '<table class="pie-calculation-table"><thead><tr><th>Category</th><th>Value' + (unit ? ' and unit' : '') + '</th><th>Percentage</th><th>Angle calculation</th><th>Exact central angle</th><th>Whole-degree angle</th></tr></thead>' +
      '<tbody>' + body + '</tbody><tfoot><tr><th>Total</th><td>' + formatNumber(model.total) + unit + '</td><td>' + formatNumber(100, 0) + '%</td><td>—</td><td>' + formatNumber(360, 0) + '°</td><td>' + formatNumber(model.wholeAngleTotal, 0) + '°</td></tr></tfoot></table></div>';
  }

  function drawingSteps(model) {
    var cumulative = 0;
    var items = ["কম্পাস দিয়ে একটি বৃত্ত আঁকুন। (Draw a circle with a compass.)", "কেন্দ্র থেকে ডান দিকে একটি প্রাথমিক ব্যাসার্ধ আঁকুন। এটিই " + formatNumber(0, 0) + "° দিক। (Draw the starting radius from the center; this is " + formatNumber(0, 0) + "°.)"];
    model.categories.forEach(function (category, index) {
      var start = cumulative;
      cumulative += category.wholeAngle;
      var final = index === model.categories.length - 1;
      var instruction = final
        ? "প্রোট্র্যাক্টরে বাকি " + formatNumber(category.wholeAngle, 0) + "° মেপে শেষ ব্যাসার্ধ রেখাটি টানুন; শেষ খণ্ডটি বৃত্ত সম্পূর্ণ করবে। (Measure the remaining " + formatNumber(category.wholeAngle, 0) + "° and draw the final radius; this sector completes the circle.)"
        : "“" + category.label + "” খণ্ডের জন্য প্রোট্র্যাক্টরে " + formatNumber(category.wholeAngle, 0) + "° মাপুন এবং ব্যাসার্ধ রেখা টানুন। (Measure " + formatNumber(category.wholeAngle, 0) + "° and draw its radius.)";
      items.push(instruction + " অগ্রগতি: " + formatNumber(start, 0) + "° → " + formatNumber(cumulative, 0) + "°। (Progress: " + formatNumber(start, 0) + "° to " + formatNumber(cumulative, 0) + "°.)");
    });
    return '<div class="pie-output-section pie-drawing-output-section"><h2>খাতায় আঁকার ধাপ · Drawing steps</h2><ol class="pie-drawing-steps">' + items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ol></div>";
  }

  function updateAppearance() {
    if (!root) return;
    var design = currentDesign();
    root.style.setProperty("--pie-background", design.background || "#ffffff");
    root.style.setProperty("--pie-font-color", design.fontColor || "#111827");
    root.style.setProperty("--pie-font-family", '"' + (design.fontFamily || "Times New Roman") + '", serif');
    root.style.setProperty("--pie-font-size", (Number(design.fontSizePt) || 11) + "pt");
    root.style.setProperty("--pie-font-weight", design.bold ? "700" : "600");
  }

  function renderWithModel(model, message, invalid) {
    if (!root) return;
    updateAppearance();
    localizeInputValidation(model);
    var title = escapeHtml(state.title || "Pie Chart");
    var typeName = state.mode === "donut" ? "Donut" : "Pie Chart";
    if (!state.showChart && !state.showCalculationTable && !state.showDrawingSteps) {
      root.innerHTML = '<article class="pie-chart-document"><div class="pie-empty-sections" role="status">No output sections are selected. Choose a section in Graph Designs → Choose What to Display.</div><div class="pie-render-feedback" role="' + (invalid ? "alert" : "status") + '">' + escapeHtml(message || "") + '</div></article>';
      return;
    }
    if (!model.valid) {
      root.innerHTML = '<article class="pie-chart-document"><h1 class="pie-chart-title">' + title + '</h1>' +
        '<div class="pie-chart-message" role="status">' + escapeHtml(message || model.message) + '</div><div class="pie-render-feedback" role="status">' + escapeHtml(message || "") + '</div></article>';
      return;
    }
    var output = '<article class="pie-chart-document">';
    if (state.showChart) output += '<section class="pie-chart-output-section"><h1 class="pie-chart-title">' + title + ' · ' + typeName + '</h1>' +
      '<p class="pie-chart-total">Total: ' + formatNumber(model.total) + (state.unit ? " " + escapeHtml(state.unit) : "") + '</p>' +
      '<div class="pie-chart-visual"><div class="pie-chart-graphic">' + buildSvg(model, false) + '</div>' + renderLegend(model) + '</div>' +
      '<div class="pie-tooltip" role="status" aria-live="polite"></div></section>';
    if (state.showCalculationTable) output += calculationTable(model);
    if (state.showDrawingSteps) output += drawingSteps(model);
    root.innerHTML = output +
      '<div class="pie-render-feedback" role="' + (invalid ? "alert" : "status") + '" aria-live="polite">' + escapeHtml(message || "") + '</div></article>';
  }

  function render() {
    var model = activeModel();
    if (model.valid) {
      lastValidModel = model;
      renderWithModel(model, "", false);
      return;
    }
    if (model.reason === "invalid" || model.reason === "negative") {
      if (lastValidModel) renderWithModel(lastValidModel, model.message, true);
      else renderWithModel(model, model.message, true);
      return;
    }
    lastValidModel = null;
    renderWithModel(model, model.message, false);
  }

  function setCategoryFromInput(input) {
    var category = categoryById(input.getAttribute("data-pie-category"));
    if (!category) return;
    var key = input.getAttribute("data-pie-key");
    if (key === "name" || key === "value") category[key] = input.value;
    else if (key === "color") category.color = input.value;
    if (key === "value") {
      var parsed = calculations.parseValue(category.value);
      input.setAttribute("aria-invalid", String(parsed.status === "invalid" || parsed.status === "negative"));
    }
    render();
  }

  function sortCategories() {
    state.categories = state.categories.map(function (category, index) {
      return { category: category, index: index, parsed: calculations.parseValue(category.value) };
    }).sort(function (a, b) {
      var av = a.parsed.status === "positive" ? a.parsed.value : -Infinity;
      var bv = b.parsed.status === "positive" ? b.parsed.value : -Infinity;
      return bv - av || a.index - b.index;
    }).map(function (entry) { return entry.category; });
    renderControls();
    render();
  }

  function writeClipboard(text) {
    if (window.navigator && window.navigator.clipboard && typeof window.navigator.clipboard.writeText === "function") {
      try { return Promise.resolve(window.navigator.clipboard.writeText(text)); }
      catch (error) { return Promise.reject(error); }
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
    textarea.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error("Clipboard access is unavailable."));
  }

  function tableAsTsv(model) {
    var unit = state.unit || "";
    var rows = [["Category", "Value " + unit, "Percentage", "Angle calculation", "Exact central angle", "Whole-degree angle"]];
    model.categories.forEach(function (category) {
      rows.push([category.label, String(category.value) + (unit ? " " + unit : ""), category.percentage.toFixed(1) + "%", "(" + category.value + " / " + model.total + ") * 360", category.exactAngle.toFixed(1) + "°", category.wholeAngle + "°"]);
    });
    rows.push(["Total", String(model.total) + (unit ? " " + unit : ""), "100%", "", "360°", model.wholeAngleTotal + "°"]);
    return rows.map(function (row) {
      return row.map(function (cell) {
        var text = String(cell);
        return /[\t\r\n"]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      }).join("\t");
    }).join("\n");
  }

  function showCopyFeedback(message) {
    if (!root) return;
    var feedback = root.querySelector(".pie-copy-feedback");
    if (feedback) feedback.textContent = message;
  }

  function highlightSlice(index, source) {
    if (!root) return;
    root.querySelectorAll("[data-pie-index]").forEach(function (element) {
      var active = element.getAttribute("data-pie-index") === String(index);
      element.classList.toggle("is-highlighted", active);
    });
    var model = lastValidModel;
    var tooltip = root.querySelector(".pie-tooltip");
    if (tooltip && model && model.categories[index]) {
      var category = model.categories[index];
      tooltip.textContent = category.label + " · " + formatNumber(category.value) + (state.unit ? " " + state.unit : "") +
        " · " + formatNumber(category.percentage, 1) + "% · " + formatNumber(category.exactAngle, 1) + "° exact / " + formatNumber(category.wholeAngle, 0) + "° whole-degree";
    }
    if (source && source.classList && source.classList.contains("pie-legend-item")) {
      var slice = root.querySelector('.pie-slice[data-pie-index="' + index + '"]');
      if (slice) slice.setAttribute("aria-describedby", "pie-active-tooltip");
      if (tooltip) tooltip.id = "pie-active-tooltip";
    }
  }

  function handleInputEvent(event) {
    var target = event.target;
    var field = target.closest && target.closest("[data-pie-field]");
    if (field) {
      state[field.getAttribute("data-pie-field")] = field.value;
      render();
      return;
    }
    var categoryField = target.closest && target.closest("[data-pie-category]");
    if (categoryField && event.type === "input") { setCategoryFromInput(categoryField); return; }
    if (categoryField && event.type === "change") { setCategoryFromInput(categoryField); return; }
    if (target.matches && target.matches('input[name="pie-chart-mode"]')) {
      state.mode = target.value === "donut" ? "donut" : "pie";
      render();
      updateHoleControl();
      return;
    }
    if (target.matches && target.matches('input[name="pie-numerals"]')) {
      state.numerals = target.value === "en" ? "en" : "bn";
      renderControls();
      render();
      return;
    }
    var action = target.closest && target.closest("[data-pie-action]");
    if (action && action.getAttribute("data-pie-action") === "add") {
      var index = state.categories.length;
      var added = { id: makeId(), name: "", value: "", color: colorFor(index) };
      state.categories.push(added);
      renderControls(added.id);
      render();
      return;
    }
    if (action && action.getAttribute("data-pie-action") === "sort") { sortCategories(); return; }
    var remove = target.closest && target.closest("[data-pie-remove]");
    if (remove) {
      var removeId = remove.getAttribute("data-pie-remove");
      state.categories = state.categories.filter(function (category) { return category.id !== removeId; });
      renderControls();
      render();
      return;
    }
  }

  function handleRootEvent(event) {
    var target = event.target;
    var action = target.closest && target.closest('[data-pie-action="copy"]');
    if (action) {
      if (!lastValidModel) { showCopyFeedback("Enter at least two positive values first."); return; }
      writeClipboard(tableAsTsv(lastValidModel)).then(function () { showCopyFeedback("Table copied."); }, function (error) { showCopyFeedback("Copy failed: " + error.message); });
      return;
    }
    var indexed = target.closest && target.closest("[data-pie-index]");
    if (indexed && (event.type === "pointerover" || event.type === "focusin" || event.type === "click")) {
      var indexValue = Number(indexed.getAttribute("data-pie-index"));
      highlightSlice(indexValue, indexed);
      if (event.type === "click" && indexed.classList.contains("pie-legend-item")) {
        var matchingSlice = root.querySelector('.pie-slice[data-pie-index="' + indexValue + '"]');
        if (matchingSlice) matchingSlice.focus();
      }
      return;
    }
    if (event.type === "keydown" && target.classList && target.classList.contains("pie-slice")) {
      var key = event.key;
      if (key === "Enter" || key === " ") { event.preventDefault(); highlightSlice(Number(target.getAttribute("data-pie-index")), target); }
      if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        var slices = root.querySelectorAll(".pie-slice");
        var current = Number(target.getAttribute("data-pie-index"));
        var next = (current + (key === "ArrowRight" ? 1 : slices.length - 1)) % slices.length;
        if (slices[next]) slices[next].focus();
      }
      return;
    }
    if (event.type === "pointerout" && indexed) {
      var related = event.relatedTarget;
      if (related && indexed.contains(related)) return;
      var tooltip = root.querySelector(".pie-tooltip");
      if (tooltip && !root.contains(document.activeElement)) tooltip.textContent = "";
    }
  }

  function bindProperties() {
    propertiesHost = document.getElementById("mfPropertiesContainer");
    if (!propertiesHost) return;
    propertiesHost.innerHTML = '<section class="mf-property-section pie-specific-design"><div class="mf-property-title">Pie Chart appearance</div>' +
      '<label class="mf-design-field pie-hole-control">Donut hole size <input type="range" min="35" max="72" step="1" value="' + Math.round(state.holeRatio * 100) + '" data-pie-hole></label>' +
      '<fieldset class="pie-design-group"><legend>Pie Chart typography</legend>' +
        '<label class="mf-design-field pie-font-control" data-pie-font-group="slice">Slice percentage label font size <span><input type="range" min="8" max="28" step="1" data-pie-font-size="slicePercentageFontSize" value="' + state.slicePercentageFontSize + '"><output data-pie-font-readout="slicePercentageFontSize">' + state.slicePercentageFontSize + ' px</output></span></label>' +
        '<label class="mf-design-field pie-font-control" data-pie-font-group="donut">Donut center label font size <span><input type="range" min="8" max="24" step="1" data-pie-font-size="donutCenterLabelFontSize" value="' + state.donutCenterLabelFontSize + '"><output data-pie-font-readout="donutCenterLabelFontSize">' + state.donutCenterLabelFontSize + ' px</output></span></label>' +
        '<label class="mf-design-field pie-font-control" data-pie-font-group="donut">Donut center value font size <span><input type="range" min="12" max="40" step="1" data-pie-font-size="donutCenterValueFontSize" value="' + state.donutCenterValueFontSize + '"><output data-pie-font-readout="donutCenterValueFontSize">' + state.donutCenterValueFontSize + ' px</output></span></label>' +
        '<small>Uses the shared local font family and color. Text fits the available chart space.</small>' +
      '</fieldset>' +
      '<fieldset class="pie-design-group"><legend>Choose What to Display</legend>' +
        '<label class="pie-display-option"><input type="checkbox" data-pie-display="showChart"' + (state.showChart ? ' checked' : '') + '> Pie / Donut Chart</label>' +
        '<label class="pie-display-option"><input type="checkbox" data-pie-display="showCalculationTable"' + (state.showCalculationTable ? ' checked' : '') + '> Calculation Table</label>' +
        '<label class="pie-display-option"><input type="checkbox" data-pie-display="showDrawingSteps"' + (state.showDrawingSteps ? ' checked' : '') + '> Drawing Steps (Manual Drawing on Paper)</label>' +
      '</fieldset>' +
      '<small>Shared background, font family, and line color apply to the chart.</small></section>';
    var hole = propertiesHost.querySelector("[data-pie-hole]");
    if (hole) {
      var update = function () {
        state.holeRatio = Number(hole.value) / 100;
        render();
      };
      hole.addEventListener("input", update);
      hole.addEventListener("change", update);
      toolCleanup.push(function () { hole.removeEventListener("input", update); hole.removeEventListener("change", update); });
    }
    var onPropertyInput = function (event) { handlePropertyChange(event); };
    propertiesHost.addEventListener("input", onPropertyInput);
    propertiesHost.addEventListener("change", onPropertyInput);
    toolCleanup.push(function () {
      propertiesHost.removeEventListener("input", onPropertyInput);
      propertiesHost.removeEventListener("change", onPropertyInput);
    });
    updateHoleControl();
    syncPiePropertyControls();
  }

  function handlePropertyChange(event) {
    var target = event.target;
    if (target.matches && target.matches("[data-pie-font-size]")) {
      if (event.type !== "input") return;
      var key = target.getAttribute("data-pie-font-size");
      var bounds = key === "slicePercentageFontSize" ? [8, 28] : key === "donutCenterLabelFontSize" ? [8, 24] : [12, 40];
      var value = Number(target.value);
      if (!Number.isFinite(value)) return;
      state[key] = Math.max(bounds[0], Math.min(bounds[1], value));
      syncPiePropertyControls();
      render();
      return;
    }
    if (target.matches && target.matches("[data-pie-display]")) {
      if (event.type !== "change") return;
      var displayKey = target.getAttribute("data-pie-display");
      if (["showChart", "showCalculationTable", "showDrawingSteps"].indexOf(displayKey) === -1) return;
      state[displayKey] = Boolean(target.checked);
      syncPiePropertyControls();
      render();
    }
  }

  function syncPiePropertyControls() {
    if (!propertiesHost) return;
    ["slicePercentageFontSize", "donutCenterLabelFontSize", "donutCenterValueFontSize"].forEach(function (key) {
      var input = propertiesHost.querySelector('[data-pie-font-size="' + key + '"]');
      var readout = propertiesHost.querySelector('[data-pie-font-readout="' + key + '"]');
      if (input) input.value = String(state[key]);
      if (readout) readout.textContent = state[key] + " px";
    });
    var sliceGroup = propertiesHost.querySelector('[data-pie-font-group="slice"]');
    if (sliceGroup) sliceGroup.hidden = !state.showChart;
    propertiesHost.querySelectorAll('[data-pie-font-group="donut"]').forEach(function (group) {
      group.hidden = !state.showChart || state.mode !== "donut";
    });
    ["showChart", "showCalculationTable", "showDrawingSteps"].forEach(function (key) {
      var input = propertiesHost.querySelector('[data-pie-display="' + key + '"]');
      if (input) input.checked = state[key];
    });
  }

  function setPngExportEnabled(enabled) {
    var button = document.getElementById("mfExportPngBtn");
    if (!button) return;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
    button.title = enabled ? "Export Pie Chart as PNG" : "Export graph as PNG";
  }

  function updateHoleControl() {
    if (!propertiesHost) return;
    var label = propertiesHost.querySelector(".pie-hole-control");
    if (label) label.hidden = state.mode !== "donut";
    syncPiePropertyControls();
  }

  function restoreState(saved) {
    var defaults = defaultState();
    saved = saved && typeof saved === "object" ? saved : {};
    var seenIds = Object.create(null);
    state = {
      title: typeof saved.title === "string" ? saved.title : defaults.title,
      unit: typeof saved.unit === "string" ? saved.unit : defaults.unit,
      mode: saved.mode === "donut" ? "donut" : "pie",
      numerals: saved.numerals === "en" ? "en" : "bn",
      holeRatio: Number.isFinite(Number(saved.holeRatio)) ? Math.max(0.35, Math.min(0.72, Number(saved.holeRatio))) : defaults.holeRatio,
      slicePercentageFontSize: boundedNumber(saved.slicePercentageFontSize, defaults.slicePercentageFontSize, 8, 28),
      donutCenterLabelFontSize: boundedNumber(saved.donutCenterLabelFontSize, defaults.donutCenterLabelFontSize, 8, 24),
      donutCenterValueFontSize: boundedNumber(saved.donutCenterValueFontSize, defaults.donutCenterValueFontSize, 12, 40),
      showChart: typeof saved.showChart === "boolean" ? saved.showChart : defaults.showChart,
      showCalculationTable: typeof saved.showCalculationTable === "boolean" ? saved.showCalculationTable : defaults.showCalculationTable,
      showDrawingSteps: typeof saved.showDrawingSteps === "boolean" ? saved.showDrawingSteps : defaults.showDrawingSteps,
      categories: Array.isArray(saved.categories) ? saved.categories.map(function (category, index) {
        category = category && typeof category === "object" ? category : {};
        var categoryId = String(category.id || "");
        if (!categoryId || seenIds[categoryId]) {
          categoryId = makeId();
          while (seenIds[categoryId]) categoryId = makeId();
        }
        seenIds[categoryId] = true;
        return {
          id: categoryId,
          name: String(category.name == null ? "" : category.name),
          value: String(category.value == null ? "" : category.value),
          color: colorFor(index, category.color)
        };
      }) : defaults.categories
    };
    lastValidModel = null;
  }

  function boundedNumber(value, fallback, minimum, maximum) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(minimum, Math.min(maximum, number))) : fallback;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function svgMarkupForExport() {
    if (!state.showChart) throw new Error("The Pie / Donut Chart section is hidden. Enable it in Graph Designs to export the chart.");
    if (!lastValidModel) throw new Error("Enter at least two positive values before exporting the chart.");
    return buildSvg(lastValidModel, true);
  }

  function exportChart(format) {
    format = format || "png";
    var markup = svgMarkupForExport();
    if (format === "svg") return new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    if (format !== "png") throw new Error("Choose PNG or SVG.");
    return new Promise(function (resolve, reject) {
      var svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      var objectUrl = URL.createObjectURL(svgBlob);
      var image = new Image();
      image.onload = function () {
        try {
          var svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
          var width = Number(svg.getAttribute("width")) || 980;
          var height = Number(svg.getAttribute("height")) || 620;
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(objectUrl);
            if (blob) resolve(blob);
            else reject(new Error("The chart could not be converted to PNG."));
          }, "image/png");
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };
      image.onerror = function () { URL.revokeObjectURL(objectUrl); reject(new Error("The chart SVG could not be rendered for PNG export.")); };
      image.src = objectUrl;
    });
  }

  function mount(container) {
    root = document.createElement("div");
    root.className = "mf-pie-chart-root";
    container.appendChild(root);
    controlsHost = document.getElementById("mfToolControlsContainer");
    inputHost = controlsHost;
    setPngExportEnabled(true);
    renderControls();
    bindProperties();
    ["click", "pointerover", "pointerout", "focusin", "keydown"].forEach(function (type) {
      root.addEventListener(type, handleRootEvent);
    });
    toolCleanup.push(function () {
      ["click", "pointerover", "pointerout", "focusin", "keydown"].forEach(function (type) { root.removeEventListener(type, handleRootEvent); });
    });
    ["input", "change", "click"].forEach(function (type) { inputHost.addEventListener(type, handleInputEvent); });
    toolCleanup.push(function () { ["input", "change", "click"].forEach(function (type) { inputHost.removeEventListener(type, handleInputEvent); }); });
    var designChanged = function () { render(); };
    document.addEventListener("mf:graph-design-changed", designChanged);
    toolCleanup.push(function () { document.removeEventListener("mf:graph-design-changed", designChanged); });
    render();
  }

  function unmount() {
    while (toolCleanup.length) toolCleanup.pop()();
    setPngExportEnabled(false);
    if (inputHost) inputHost.innerHTML = "";
    if (propertiesHost) propertiesHost.innerHTML = '<div class="mf-property-placeholder">Select a graph generator to view its specific design settings.</div>';
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    inputHost = null;
    controlsHost = null;
    propertiesHost = null;
  }

  function setState(saved) {
    restoreState(saved);
    if (root) {
      renderControls();
      var hole = propertiesHost && propertiesHost.querySelector("[data-pie-hole]");
      if (hole) hole.value = String(Math.round(state.holeRatio * 100));
      syncPiePropertyControls();
      updateHoleControl();
      render();
    }
  }

  function reset() {
    state = defaultState();
    lastValidModel = null;
    if (root) {
      renderControls();
      var hole = propertiesHost && propertiesHost.querySelector("[data-pie-hole]");
      if (hole) hole.value = String(Math.round(state.holeRatio * 100));
      syncPiePropertyControls();
      updateHoleControl();
      render();
    }
  }

  var adapter = {
    id: "pie-chart",
    name: "Pie Chart",
    description: "Create accessible pie and donut charts with exact and protractor-ready angles.",
    icon: "◔",
    capabilities: ["Pie and donut charts", "Bengali and English numerals", "Exact percentages and angles", "Calculation table and drawing steps"],
    mount: mount,
    unmount: unmount,
    resize: function () { render(); },
    render: render,
    getState: function () { return clone(state); },
    setState: setState,
    reset: reset,
    export: exportChart,
    getCalculation: activeModel
  };

  if (window.MathForgeWorkspace && typeof window.MathForgeWorkspace.registerTool === "function") {
    window.MathForgeWorkspace.registerTool(adapter);
  }
  window.MathForgePieChart = { calculations: calculations, adapter: adapter, getState: function () { return clone(state); } };
})(window, document);
