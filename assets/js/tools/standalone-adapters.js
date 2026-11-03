(function (window, document) {
  "use strict";

  var toolDefinitions = [
    {
      id: "equation-plotter",
      name: "Equation Plotter",
      description: "Plot mathematical functions and points",
      icon: "ƒ",
      engine: function () { return window.MathForgeEquationPlotter; },
      canvasLabel: "Equation plotter graph",
      actions: ""
    },
    {
      id: "ogive-curve",
      name: "Ogive Line",
      description: "Cumulative frequency curve",
      icon: "∿",
      engine: function () { return window.MathForgeOgive; },
      canvasLabel: "Ogive graph",
      actions: '<div class="card"><div class="body"><div class="btns">' +
        '<button id="o_resetBtn" type="button">Reset</button>' +
        '<button id="o_fitBtn" type="button">Fit</button>' +
        '<button class="good" id="o_pngBtn" type="button">PNG</button>' +
        '<button class="good" id="o_svgBtn" type="button">SVG</button>' +
        '</div></div></div>'
    },
    {
      id: "histogram-polygon",
      name: "Histogram / Polygon",
      description: "Frequency histogram and polygon",
      icon: "▥",
      engine: function () { return window.MathForgeHistogram; },
      canvasLabel: "Histogram and frequency polygon graph",
      actions: '<div class="card"><div class="body"><div class="btns">' +
        '<button id="h_resetBtn" type="button">Reset</button>' +
        '<button id="h_fitBtn" type="button">Fit</button>' +
        '<button class="good" id="h_pngBtn" type="button">PNG</button>' +
        '<button class="good" id="h_svgBtn" type="button">SVG</button>' +
        '</div></div></div>'
    }
  ];

  var zoomInputIds = {
    "equation-plotter": "zoom",
    "ogive-curve": "o_zoom",
    "histogram-polygon": "h_zoom"
  };
  var canvasSizeInputIds = {
    "equation-plotter": "csize",
    "ogive-curve": "o_csize",
    "histogram-polygon": "h_csize"
  };

  function makeCanvasView(canvas, container, dpr, initialSize) {
    var width = 0;
    var height = 0;
    var displayWidth = 0;
    var displayHeight = 0;
    var ratio = 1;
    if (initialSize && initialSize.length === 2 && initialSize[0] > 0 && initialSize[1] > 0) {
      width = Math.floor(initialSize[0]);
      height = Math.floor(initialSize[1]);
    } else {
      width = 920;
      height = 560;
    }
    var context = canvas.getContext("2d");
    function updateContext() {
      var bufferWidth = Math.max(1, Math.round(displayWidth * ratio));
      var bufferHeight = Math.max(1, Math.round(displayHeight * ratio));
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      context = canvas.getContext("2d");
      var scale = Math.min(displayWidth / width, displayHeight / height);
      var offsetX = (displayWidth - width * scale) / 2;
      var offsetY = (displayHeight - height * scale) / 2;
      context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
      context.beginPath();
      context.rect(0, 0, width, height);
      context.clip();
    }
    var view = {
      get width() { return width; },
      get height() { return height; },
      get displayWidth() { return displayWidth; },
      get displayHeight() { return displayHeight; },
      getContext: function (type) {
        return type === "2d" ? context : canvas.getContext(type);
      },
      getBoundingClientRect: function () {
        var rect = canvas.getBoundingClientRect();
        var scale = Math.min(displayWidth / width, displayHeight / height);
        var drawnWidth = width * scale;
        var drawnHeight = height * scale;
        var left = rect.left + (displayWidth - drawnWidth) / 2;
        var top = rect.top + (displayHeight - drawnHeight) / 2;
        return {
          left: left,
          top: top,
          right: left + drawnWidth,
          bottom: top + drawnHeight,
          width: drawnWidth,
          height: drawnHeight
        };
      },
      addEventListener: function () { return canvas.addEventListener.apply(canvas, arguments); },
      removeEventListener: function () { return canvas.removeEventListener.apply(canvas, arguments); },
      classList: canvas.classList,
      toDataURL: function () { return canvas.toDataURL.apply(canvas, arguments); },
      resize: function (nextWidth, nextHeight, nextDpr) {
        var rect = container.getBoundingClientRect();
        displayWidth = Math.max(1, Math.floor(Number(nextWidth) || rect.width || 1));
        displayHeight = Math.max(1, Math.floor(Number(nextHeight) || rect.height || 1));
        ratio = Number.isFinite(nextDpr) && nextDpr > 0 ? nextDpr : 1;
        canvas.style.width = displayWidth + "px";
        canvas.style.height = displayHeight + "px";
        updateContext();
      },
      setLogicalSize: function (logicalWidth, logicalHeight) {
        logicalWidth = Math.floor(Number(logicalWidth));
        logicalHeight = Math.floor(Number(logicalHeight));
        if (!(logicalWidth > 0 && logicalHeight > 0)) {
          throw new Error("Canvas dimensions must be positive.");
        }
        if (logicalWidth === width && logicalHeight === height) return;
        width = logicalWidth;
        height = logicalHeight;
        updateContext();
      },
      destroy: function () {
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
    };
    view.resize(0, 0, dpr);
    return view;
  }

  function setButtonEnabled(button, enabled, title) {
    if (!button) return;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
    if (title) button.title = title;
  }

  function createAdapter(definition) {
    var engineInstance = null;
    var controlsHost = null;
    var canvasView = null;
    var canvasElement = null;
    var toolbarCleanups = [];
    var savedState = null;
    var workspace = false;

    function bindToolbar(id, handler) {
      var button = document.getElementById(id);
      if (!button) return;
      var listener = function (event) {
        event.preventDefault();
        handler();
      };
      button.addEventListener("click", listener);
      toolbarCleanups.push(function () { button.removeEventListener("click", listener); });
    }

    function cleanToolbar() {
      while (toolbarCleanups.length) toolbarCleanups.pop()();
      ["mfZoomInBtn", "mfZoomOutBtn", "mfResetViewToolbarBtn", "mfExportPngBtn"]
        .forEach(function (id) { setButtonEnabled(document.getElementById(id), false); });
    }

    function adapterUnmount() {
      if (engineInstance) {
        savedState = engineInstance.getState();
        engineInstance.unmount();
        engineInstance = null;
      }
      cleanToolbar();
      canvasView = null;
      if (canvasElement && canvasElement.parentNode) canvasElement.parentNode.removeChild(canvasElement);
      canvasElement = null;
      if (controlsHost && controlsHost.parentNode) controlsHost.parentNode.removeChild(controlsHost);
      controlsHost = null;
    }

    var adapter = {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      capabilities: ["Original standalone controls", "Shared responsive graph canvas", "Pan, zoom and export"],

      mount: function (container, options) {
        options = options || {};
        workspace = Boolean(options.workspace);
        if (!workspace) throw new Error("The shared graph adapter requires the MathForge workspace.");
        var template = window.MathForgeToolControlTemplates && window.MathForgeToolControlTemplates[definition.id];
        var engineApi = definition.engine();
        var host = document.getElementById("mfToolControlsContainer");
        if (!template || !engineApi || typeof engineApi.mount !== "function" || !host) {
          throw new Error("The " + definition.name + " workspace resources could not be initialized.");
        }

        controlsHost = document.createElement("section");
        controlsHost.className = "mf-tool-control-host mf-tool-control-" + definition.id;
        controlsHost.setAttribute("aria-label", definition.name + " controls");
        controlsHost.innerHTML = template + definition.actions;
        host.appendChild(controlsHost);

        canvasElement = document.createElement("canvas");
        canvasElement.className = "mf-shared-graph-canvas";
        canvasElement.setAttribute("aria-label", definition.canvasLabel);
        container.appendChild(canvasElement);
        var canvasSize = window.parsePair && window.parsePair(document.getElementById(canvasSizeInputIds[definition.id]).value);
        canvasView = makeCanvasView(canvasElement, container, options.dpr, canvasSize);

        try {
          engineInstance = engineApi.mount({
            workspace: true,
            controlsRoot: controlsHost,
            canvasView: canvasView
          });
          if (savedState) {
            engineInstance.setState(savedState);
          } else if (definition.id === "equation-plotter") {
            fitEquationToCanvas();
          } else {
            var fitButton = document.getElementById(definition.id === "ogive-curve" ? "o_fitBtn" : "h_fitBtn");
            if (fitButton) fitButton.click();
          }
        } catch (error) {
          adapterUnmount();
          throw error;
        }

        var zoomId = zoomInputIds[definition.id];
        var zoomInput = document.getElementById(zoomId);
        function changeZoom(direction) {
          if (!zoomInput) return;
          var min = Number(zoomInput.min) || 0.35;
          var max = Number(zoomInput.max) || 4;
          var current = Number(zoomInput.value) || 1;
          zoomInput.value = String(Math.max(min, Math.min(max, current * (direction > 0 ? 1.15 : 0.87))));
          zoomInput.dispatchEvent(new Event("input", { bubbles: true }));
        }

        setButtonEnabled(document.getElementById("mfZoomInBtn"), true, "Zoom in");
        setButtonEnabled(document.getElementById("mfZoomOutBtn"), true, "Zoom out");
        setButtonEnabled(document.getElementById("mfResetViewToolbarBtn"), true, "Reset graph");
        setButtonEnabled(document.getElementById("mfExportPngBtn"), true, "Export graph as PNG");
        bindToolbar("mfZoomInBtn", function () { changeZoom(1); });
        bindToolbar("mfZoomOutBtn", function () { changeZoom(-1); });
        bindToolbar("mfResetViewToolbarBtn", function () {
          engineInstance.reset();
          fitWorkspaceView();
        });
        bindWorkspaceReset();
      },

      unmount: adapterUnmount,
      resize: function (width, height, dpr) {
        if (!engineInstance || !canvasView) return;
        engineInstance.resize(width, height, dpr);
      },
      render: function () {
        if (engineInstance) engineInstance.render();
      },
      getState: function () {
        return engineInstance ? engineInstance.getState() : savedState;
      },
      setState: function (nextState) {
        savedState = nextState || null;
        if (engineInstance && savedState) engineInstance.setState(savedState);
      },
      reset: function () {
        savedState = null;
        if (engineInstance) {
          engineInstance.reset();
          fitWorkspaceView();
        }
      },
      export: function (format) {
        return engineInstance ? engineInstance.export(format || "png") : null;
      }
    };

    function fitEquationToCanvas() {
      var sourceSize = window.parsePair && window.parsePair(document.getElementById("csize").value);
      var originInput = document.getElementById("origin");
      var zoomInput = document.getElementById("zoom");
      var origin = window.parsePair && window.parsePair(originInput.value);
      if (!sourceSize || !origin || !zoomInput || sourceSize[0] <= 0 || sourceSize[1] <= 0) return;
      var scale = Math.min(canvasView.width / sourceSize[0], canvasView.height / sourceSize[1]);
      var initialZoom = Number(zoomInput.value) || 1;
      var zoom = Math.max(Number(zoomInput.min) || 0.4, Math.min(Number(zoomInput.max) || 3, initialZoom * scale));
      var appliedScale = zoom / initialZoom;
      originInput.value = Math.round(origin[0] * appliedScale + (canvasView.width - sourceSize[0] * appliedScale) / 2) +
        "," + Math.round(origin[1] * appliedScale + (canvasView.height - sourceSize[1] * appliedScale) / 2);
      zoomInput.value = String(zoom);
      zoomInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function fitWorkspaceView() {
      if (definition.id === "equation-plotter") {
        fitEquationToCanvas();
        return;
      }
      var fitButton = document.getElementById(definition.id === "ogive-curve" ? "o_fitBtn" : "h_fitBtn");
      if (fitButton) fitButton.click();
    }

    function bindWorkspaceReset() {
      var resetId = definition.id === "equation-plotter" ? "reset" :
        definition.id === "ogive-curve" ? "o_resetBtn" : "h_resetBtn";
      var button = document.getElementById(resetId);
      if (!button) return;
      var listener = fitWorkspaceView;
      button.addEventListener("click", listener);
      toolbarCleanups.push(function () { button.removeEventListener("click", listener); });
    }

    return adapter;
  }

  toolDefinitions.forEach(function (definition) {
    var adapter = createAdapter(definition);
    if (window.MathForgeWorkspace && typeof window.MathForgeWorkspace.registerTool === "function") {
      window.MathForgeWorkspace.registerTool(adapter);
    }
  });
})(window, document);
