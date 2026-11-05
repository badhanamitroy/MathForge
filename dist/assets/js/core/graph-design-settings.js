(function (window, document) {
  "use strict";

  var DEFAULTS = {
    ratio: "4:3",
    customWidth: 4,
    customHeight: 3,
    background: "#ffffff",
    gridVisible: true,
    gridSpacing: 10,
    majorEvery: 5,
    // null preserves the original per-engine defaults until the user defines
    // an explicit shared K/N scale. This keeps older projects visually stable.
    axisScale: null,
    gridColor: "#000000",
    axesVisible: true,
    axisColor: "#000000",
    fontFamily: "Times New Roman",
    fontSizePt: 11,
    bold: false,
    fontColor: "#111827",
    lineColor: "#000000",
    lineWidth: 3
  };
  var state = copy(DEFAULTS);
  var controlsBound = false;
  var resizeObserver = null;

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  }

  function sanitize(saved) {
    saved = saved && typeof saved === "object" ? saved : {};
    var next = copy(DEFAULTS);
    var ratio = String(saved.ratio || DEFAULTS.ratio);
    if (["1:1", "4:3", "3:4", "16:9", "custom"].indexOf(ratio) !== -1) next.ratio = ratio;
    ["customWidth", "customHeight", "gridSpacing", "majorEvery", "fontSizePt", "lineWidth"].forEach(function (key) {
      var value = Number(saved[key]);
      if (Number.isFinite(value) && value > 0) next[key] = value;
    });
    next.customWidth = Math.max(1, Math.min(10000, next.customWidth));
    next.customHeight = Math.max(1, Math.min(10000, next.customHeight));
    next.gridSpacing = Math.max(4, Math.min(80, next.gridSpacing));
    next.majorEvery = Math.max(2, Math.min(20, Math.round(next.majorEvery)));
    var scale = saved.axisScale && typeof saved.axisScale === "object" ? saved.axisScale : null;
    if (scale && window.MathForgeGraphScale && window.MathForgeGraphScale.validScale(scale.x && scale.x.k, scale.x && scale.x.n) && window.MathForgeGraphScale.validScale(scale.y && scale.y.k, scale.y && scale.y.n)) {
      next.axisScale = { x: { k: Number(scale.x.k), n: Number(scale.x.n) }, y: { k: Number(scale.y.k), n: Number(scale.y.n) } };
    }
    next.fontSizePt = Math.max(6, Math.min(36, next.fontSizePt));
    next.lineWidth = Math.max(1, Math.min(8, next.lineWidth));
    ["gridVisible", "axesVisible", "bold"].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(saved, key)) next[key] = Boolean(saved[key]);
    });
    next.background = validColor(saved.background, DEFAULTS.background);
    next.gridColor = validColor(saved.gridColor, DEFAULTS.gridColor);
    next.axisColor = validColor(saved.axisColor, DEFAULTS.axisColor);
    next.fontColor = validColor(saved.fontColor, DEFAULTS.fontColor);
    next.lineColor = validColor(saved.lineColor, DEFAULTS.lineColor);
    if (saved.fontFamily === "Kalpurush") next.fontFamily = "Noto Sans Bengali";
    else if (["Times New Roman", "Noto Sans Bengali"].indexOf(saved.fontFamily) !== -1) next.fontFamily = saved.fontFamily;
    return next;
  }

  function ratioValue() {
    if (state.ratio === "custom") return state.customWidth / state.customHeight;
    var parts = state.ratio.split(":").map(Number);
    return parts[0] / parts[1];
  }

  function applyCanvasRatio() {
    var stage = document.getElementById("mfCanvasStage");
    var sheet = document.getElementById("mfCanvasSheet");
    if (!stage || !sheet) return;
    var style = window.getComputedStyle ? window.getComputedStyle(stage) : null;
    var padX = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
    var padY = style ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) : 0;
    var availableWidth = Math.max(1, stage.clientWidth - padX);
    var availableHeight = Math.max(1, stage.clientHeight - padY);
    var ratio = ratioValue();
    var width = Math.min(availableWidth, availableHeight * ratio);
    var height = width / ratio;
    sheet.style.aspectRatio = String(ratio);
    sheet.style.width = Math.floor(width) + "px";
    sheet.style.height = Math.floor(height) + "px";
    sheet.dataset.graphRatio = state.ratio === "custom"
      ? state.customWidth + ":" + state.customHeight
      : state.ratio;
  }

  function setElementValue(id, value, eventName) {
    var element = document.getElementById(id);
    if (!element) return;
    if (element.type === "checkbox") element.checked = Boolean(value);
    else element.value = String(value);
    if (eventName) {
      var type = element.type === "checkbox" || element.tagName === "SELECT" ? "change" : "input";
      element.dispatchEvent(new Event(type, { bubbles: true }));
    }
  }

  function activeToolId() {
    var workspace = window.MathForgeWorkspace;
    var active = workspace && workspace.getActiveTool ? workspace.getActiveTool() : null;
    return active && active.id;
  }

  function syncToolApplicability() {
    var pieActive = activeToolId() === "pie-chart";
    if (!document.querySelectorAll) return;
    document.querySelectorAll("[data-mf-cartesian-only]").forEach(function (section) {
      section.hidden = pieActive;
      section.setAttribute("aria-hidden", String(pieActive));
    });
  }

  function syncActiveTool() {
    var toolId = activeToolId();
    var commonInputs = {
      "coordinates-graph": {
        gridVisible: "mfCoordGridVisible", gridColor: "mfCoordGridColor",
        axesVisible: ["mfCoordXAxisVisible", "mfCoordYAxisVisible"],
        axisColor: "mfCoordAxisColor", background: "mfCoordBgColor",
        lineColor: "mfCoordPolyBorderColor", lineWidth: "mfCoordPolyBorderWidth",
      },
      "equation-plotter": {
        gridSpacing: "minorPx", majorEvery: "majorEvery"
      },
      "ogive-curve": {
        gridSpacing: "o_minorPx", majorEvery: "o_majorEvery"
      },
      "histogram-polygon": {
        gridSpacing: "h_minorPx", majorEvery: "h_majorEvery"
      }
    }[toolId];
    if (commonInputs) {
      Object.keys(commonInputs).forEach(function (key) {
        var target = commonInputs[key];
        var value = state[key];
        (Array.isArray(target) ? target : [target]).forEach(function (id) {
          setElementValue(id, value, "sync");
        });
      });
      if (toolId === "equation-plotter") {
        setElementValue("curveWidth", state.lineWidth, "input");
      } else if (toolId === "ogive-curve") {
        setElementValue("o_curveW", state.lineWidth, "input");
      }
    }
  }

  function updateControlUI() {
    var mappings = {
      mfDesignRatio: "ratio", mfDesignCustomWidth: "customWidth", mfDesignCustomHeight: "customHeight",
      mfDesignBackground: "background", mfDesignGridVisible: "gridVisible", mfDesignGridSpacing: "gridSpacing",
      mfDesignMajorEvery: "majorEvery", mfDesignGridColor: "gridColor", mfDesignAxesVisible: "axesVisible",
      mfDesignAxisColor: "axisColor", mfGraphFontFamily: "fontFamily", mfGraphFontSizePt: "fontSizePt",
      mfGraphBold: "bold", mfGraphFontColor: "fontColor", mfDesignLineColor: "lineColor", mfDesignLineWidth: "lineWidth"
    };
    Object.keys(mappings).forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      var value = state[mappings[id]];
      if (element.type === "checkbox") element.checked = Boolean(value);
      else element.value = String(value);
    });
    var custom = document.getElementById("mfDesignCustomRatio");
    if (custom) custom.hidden = state.ratio !== "custom";
    var toolDefaults = {
      "coordinates-graph": { x: { k: 1, n: 1 }, y: { k: 1, n: 1 } },
      "equation-plotter": { x: { k: 5, n: 1 }, y: { k: 1, n: 1 } },
      "ogive-curve": { x: { k: 1, n: 1 }, y: { k: 1, n: 1 } },
      "histogram-polygon": { x: { k: 1, n: 1 }, y: { k: 1, n: 1 } }
    };
    var visibleScale = state.axisScale || toolDefaults[activeToolId()] || toolDefaults["coordinates-graph"];
    [["mfScaleXK", visibleScale.x.k], ["mfScaleXN", visibleScale.x.n], ["mfScaleYK", visibleScale.y.k], ["mfScaleYN", visibleScale.y.n]].forEach(function (entry) {
      var input = document.getElementById(entry[0]);
      if (input && document.activeElement !== input) input.value = String(entry[1]);
    });
    syncToolApplicability();
  }

  function setScaleFromControls() {
    var ids = ["mfScaleXK", "mfScaleXN", "mfScaleYK", "mfScaleYN"];
    var values = ids.map(function (id) { return document.getElementById(id); });
    var message = document.getElementById("mfScaleValidation");
    var xK = values[0] && Number(values[0].value), xN = values[1] && Number(values[1].value);
    var yK = values[2] && Number(values[2].value), yN = values[3] && Number(values[3].value);
    var valid = window.MathForgeGraphScale && window.MathForgeGraphScale.validScale(xK, xN) && window.MathForgeGraphScale.validScale(yK, yN);
    ids.forEach(function (id, index) {
      var input = document.getElementById(id);
      if (input) input.setAttribute("aria-invalid", String(!valid && !(index === 0 || index === 1 ? window.MathForgeGraphScale.validScale(xK, xN) : window.MathForgeGraphScale.validScale(yK, yN))));
    });
    if (message) message.textContent = valid ? "" : "K must be a positive whole number; N must be a positive finite number.";
    if (!valid) return;
    state = sanitize(Object.assign({}, state, { axisScale: { x: { k: xK, n: xN }, y: { k: yK, n: yN } } }));
    updateControlUI();
    notify();
  }

  function notify() {
    applyCanvasRatio();
    syncActiveTool();
    if (typeof document.dispatchEvent === "function") {
      document.dispatchEvent(new CustomEvent("mf:graph-design-changed", { detail: copy(state) }));
    }
  }

  function set(key, value, syncControls) {
    var next = {};
    next[key] = value;
    state = sanitize(Object.assign({}, state, next));
    if (syncControls !== false) updateControlUI();
    notify();
    return copy(state);
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    var fields = {
      mfDesignRatio: "ratio", mfDesignBackground: "background", mfDesignGridVisible: "gridVisible",
      mfDesignGridSpacing: "gridSpacing", mfDesignMajorEvery: "majorEvery", mfDesignGridColor: "gridColor",
      mfDesignAxesVisible: "axesVisible", mfDesignAxisColor: "axisColor", mfGraphFontFamily: "fontFamily",
      mfGraphBold: "bold", mfGraphFontColor: "fontColor",
      mfDesignLineColor: "lineColor", mfDesignLineWidth: "lineWidth"
    };
    Object.keys(fields).forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      element.addEventListener("input", function () {
        if (element.type === "number" && !(Number(element.value) > 0)) return;
        set(fields[id], element.type === "checkbox" ? element.checked : element.value);
      });
      element.addEventListener("change", function () {
        if (element.type === "number" && !(Number(element.value) > 0)) return;
        set(fields[id], element.type === "checkbox" ? element.checked : element.value);
      });
    });
    ["mfScaleXK", "mfScaleXN", "mfScaleYK", "mfScaleYN"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) {
        input.addEventListener("input", setScaleFromControls);
        input.addEventListener("change", setScaleFromControls);
      }
    });
    var fontSizeInput = document.getElementById("mfGraphFontSizePt");
    if (fontSizeInput) {
      fontSizeInput.addEventListener("input", function () {
        var raw = String(fontSizeInput.value || "").trim();
        var value = Number(raw);
        if (!raw || !Number.isFinite(value) || value < 6 || value > 36) return;
        // Keep the user's in-progress text intact (for example, "12.") while
        // committing only complete, in-range values to shared state.
        set("fontSizePt", value, false);
      });
      fontSizeInput.addEventListener("change", function () {
        var raw = String(fontSizeInput.value || "").trim();
        var value = Number(raw);
        if (!raw || !Number.isFinite(value)) {
          updateControlUI();
          return;
        }
        set("fontSizePt", value);
      });
    }
    ["mfDesignCustomWidth", "mfDesignCustomHeight"].forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      ["input", "change"].forEach(function (eventName) {
        element.addEventListener(eventName, function () {
          var width = Number(document.getElementById("mfDesignCustomWidth").value);
          var height = Number(document.getElementById("mfDesignCustomHeight").value);
          if (!(width > 0 && height > 0)) return;
          state = sanitize(Object.assign({}, state, { ratio: "custom", customWidth: width, customHeight: height }));
          updateControlUI();
          notify();
        });
      });
    });
    document.addEventListener("mf:tool-changed", function () { syncActiveTool(); updateControlUI(); });
    window.addEventListener("resize", applyCanvasRatio);
    var stage = document.getElementById("mfCanvasStage");
    if (stage && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(applyCanvasRatio);
      resizeObserver.observe(stage);
    }
    updateControlUI();
    applyCanvasRatio();
  }

  var api = {
    getState: function () { return copy(state); },
    setState: function (saved) {
      state = sanitize(saved);
      updateControlUI();
      notify();
      return true;
    },
    reset: function () { return api.setState(DEFAULTS); },
    set: set,
    sanitize: sanitize,
    syncActiveTool: syncActiveTool
  };
  window.MathForgeGraphDesignSettings = api;
  bindControls();
})(window, document);
