/**
 * workspace-core.js
 * MathForge — Professional Mathematical Workspace Core
 * Phase 2: Shared Workspace Foundation (Lifecycle Reliability Hardened)
 * Architecture: Direct DOM Integration with Modular Tool Lifecycle
 *
 * Requirements:
 * - 100% Offline-first compatible (direct file:// execution)
 * - Zero ES module imports/exports (classic IIFE namespace)
 * - Reliable tool mount rollback with previous-state preservation
 * - Stable, coalesced ResizeObserver with reentrancy guards
 * - High-DPI canvas foundation tracking buffer and transform changes
 * - Fully managed event delegation with zero unmanaged listeners
 * - Predictable destroy/reinitialize lifecycle policy
 * - Accessible document tabs supporting focused-tab keyboard navigation
 */

(function (window, document) {
  "use strict";

  /* ==========================================================================
     Central Workspace State
     ========================================================================== */
  var state = {
    initialized: false,
    activeTool: null,
    activeDocument: "untitled-1",
    openDocuments: [
      { id: "untitled-1", title: "Untitled Workspace", active: true }
    ],
    panels: {
      left: true,
      right: true,
      bottom: true
    },
    zoom: 1.0,
    statusMessage: "Ready"
  };

  /* ==========================================================================
     Tool Registry & Lifecycle Tracking
     ========================================================================== */
  var registry = Object.create(null);
  var mountedToolInstance = null;

  /* ==========================================================================
     Managed Event Listeners & Observers Lifecycle Tracking
     ========================================================================== */
  var eventCleanups = [];
  var resizeObserverInstance = null;
  var pendingResizeRafId = null;
  var isResizing = false;
  var lastObservedWidth = -1;
  var lastObservedHeight = -1;
  var lastObservedDpr = -1;

  function addManagedListener(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, options);
    eventCleanups.push(function () {
      try {
        target.removeEventListener(type, handler, options);
      } catch (err) {
        // Safe disposal
      }
    });
  }

  function clearManagedListeners() {
    while (eventCleanups.length > 0) {
      try {
        var cleanup = eventCleanups.pop();
        if (typeof cleanup === "function") {
          cleanup();
        }
      } catch (e) {
        console.error("[MathForge] Error cleaning up listener:", e);
      }
    }

    if (resizeObserverInstance) {
      try {
        resizeObserverInstance.disconnect();
      } catch (e) {
        // Safe disposal
      }
      resizeObserverInstance = null;
    }

    cancelPendingResize();
  }

  function cancelPendingResize() {
    if (pendingResizeRafId !== null) {
      if (typeof window.cancelAnimationFrame === "function") {
        try {
          window.cancelAnimationFrame(pendingResizeRafId);
        } catch (e) {
          // Safe disposal
        }
      } else {
        clearTimeout(pendingResizeRafId);
      }
      pendingResizeRafId = null;
    }
  }

  /**
   * Pre-register the four foundational tools as metadata records
   */
  var BUILTIN_TOOLS = [
    {
      id: "coordinates-graph",
      name: "Coordinates Graph",
      description: "Points and coordinate plane plotting",
      icon: "⌖",
      capabilities: [
        "Multiple Independent Point Sets",
        "Per-Point Colors & Shapes",
        "Polygon Fills & Diagonals",
        "Visual Grid & Axis Controls"
      ],
      mount: null,
      unmount: null,
      resize: null,
      render: null,
      getState: null,
      setState: null,
      reset: null,
      export: null
    },
    {
      id: "equation-plotter",
      name: "Equation Plotter",
      description: "Plot equations, relations, inequalities, and coordinate points",
      icon: "ƒ",
      capabilities: [
        "Safe equation and relation parsing",
        "Explicit functions and inverse relations",
        "Implicit conics and shaded inequalities",
        "Multiple equations and coordinate points"
      ],
      mount: null,
      unmount: null,
      resize: null,
      render: null,
      getState: null,
      setState: null,
      reset: null,
      export: null
    },
    {
      id: "ogive-curve",
      name: "Ogive Line",
      description: "Cumulative frequency curve plotter",
      icon: "∿",
      capabilities: [
        "Editable Paper Table Grid",
        "Monotonic CF Validation",
        "Vertical CF Point Dragging",
        "Extrema Auto-Fit Optimization"
      ],
      mount: null,
      unmount: null,
      resize: null,
      render: null,
      getState: null,
      setState: null,
      reset: null,
      export: null
    },
    {
      id: "histogram-polygon",
      name: "Histogram / Polygon",
      description: "Statistical distributions and frequency analysis",
      icon: "▥",
      capabilities: [
        "Frequency Histogram Bars",
        "Continuous Frequency Polygon",
        "Textbook Axis Break (/\\/\\)",
        "Midpoint Dot & Label Indicators"
      ],
      mount: null,
      unmount: null,
      resize: null,
      render: null,
      getState: null,
      setState: null,
      reset: null,
      export: null
    },
    {
      id: "pie-chart",
      name: "Pie Chart",
      description: "Accessible pie and donut charts with percentage and angle calculations",
      icon: "◔",
      capabilities: [
        "Pie and donut chart modes",
        "Bengali and English numerals",
        "Exact and protractor-ready angles",
        "Calculation tables and drawing steps"
      ],
      mount: null,
      unmount: null,
      resize: null,
      render: null,
      getState: null,
      setState: null,
      reset: null,
      export: null
    }
  ];

  /* ==========================================================================
     DOM References Cache
     ========================================================================== */
  var dom = {
    workspace: null,
    toolList: null,
    toolMountContainer: null,
    welcomeContent: null,
    activePlaceholder: null,
    propertiesContainer: null,
    statusMessage: null,
    statusActiveTool: null,
    statusDoc: null,
    statusZoom: null,
    docTabsContainer: null,
    leftPanel: null,
    rightPanel: null,
    bottomPanel: null,
    collapseButtons: {},
    panelToggles: {}
  };

  /* ==========================================================================
     Helper Utilities
     ========================================================================== */
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return obj;
    }
  }

  /**
   * Strictly validates and returns an effective Device Pixel Ratio (DPR).
   * Validates both custom DPR arguments and window.devicePixelRatio.
   *
   * @param {*} [customDpr] - Optional custom DPR to validate
   * @returns {number} Strictly finite, positive DPR (defaults to 1.0)
   */
  function getEffectiveDpr(customDpr) {
    if (typeof customDpr === "number" && Number.isFinite(customDpr) && customDpr > 0) {
      return customDpr;
    }
    var sysDpr = window.devicePixelRatio;
    if (typeof sysDpr === "number" && Number.isFinite(sysDpr) && sysDpr > 0) {
      return sysDpr;
    }
    return 1;
  }

  /* ==========================================================================
     High-DPI Canvas Sizing Foundation
     ========================================================================== */
  /**
   * Resizes an HTML5 Canvas to match its parent container taking into account
   * the physical display devicePixelRatio for crisp High-DPI / Retina rendering.
   *
   * Accurately tracks backing buffer dimensions and context transforms independently:
   * - Only updates canvas.width/height when physical backing dimensions change.
   * - Updates context transform whenever DPR changes (or when buffer resets).
   * - Avoids unnecessary buffer reallocation and canvas clears.
   *
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {HTMLElement} container - Parent element containing the canvas
   * @param {Object} [options] - Configuration options
   * @param {number} [options.dpr] - Custom pixel ratio (strictly validated)
   * @param {boolean} [options.autoScaleContext=true] - Whether to scale 2D context
   * @returns {Object} { width, height, dpr, changed, transformChanged }
   */
  function fitCanvasToContainer(canvas, container, options) {
    if (!canvas || !container) {
      return { width: 0, height: 0, dpr: 1, changed: false, transformChanged: false };
    }

    options = options || {};
    var dpr = getEffectiveDpr(options.dpr);

    var rect = container.getBoundingClientRect();
    var width = Math.floor(rect.width);
    var height = Math.floor(rect.height);

    // If container is hidden or zero-dimensioned, safely return
    if (width <= 0 || height <= 0) {
      return { width: 0, height: 0, dpr: dpr, changed: false, transformChanged: false };
    }

    var physicalWidth = Math.round(width * dpr);
    var physicalHeight = Math.round(height * dpr);

    var backingChanged = (canvas.width !== physicalWidth || canvas.height !== physicalHeight);
    var cssWidthChanged = (canvas.style.width !== (width + "px"));
    var cssHeightChanged = (canvas.style.height !== (height + "px"));

    var prevDpr = canvas._mfAppliedDpr;
    var dprChanged = (prevDpr !== dpr);
    var transformChanged = false;

    // Update backing store dimensions only if changed
    if (backingChanged) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
    }

    // Update CSS layout dimensions only if changed
    if (cssWidthChanged) {
      canvas.style.width = width + "px";
    }
    if (cssHeightChanged) {
      canvas.style.height = height + "px";
    }

    // Canvas buffer resize resets context transforms automatically.
    // If backing store changed OR if DPR changed without buffer change, update transform.
    if (options.autoScaleContext !== false) {
      if (backingChanged || dprChanged) {
        var ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          transformChanged = true;
        }
        canvas._mfAppliedDpr = dpr;
      }
    }

    return {
      width: width,
      height: height,
      dpr: dpr,
      changed: backingChanged,
      transformChanged: transformChanged
    };
  }

  /* ==========================================================================
     Registry & Tool Management
     ========================================================================== */
  function registerTool(tool) {
    if (!tool || typeof tool.id !== "string" || !tool.id.trim()) {
      console.error("[MathForge] Tool registration failed: Invalid tool ID.", tool);
      return false;
    }
    if (typeof tool.name !== "string" || !tool.name.trim()) {
      console.error("[MathForge] Tool registration failed: Invalid tool Name.", tool);
      return false;
    }

    var id = tool.id.trim();
    registry[id] = {
      id: id,
      name: tool.name.trim(),
      description: tool.description || "",
      icon: tool.icon || "◈",
      capabilities: Array.isArray(tool.capabilities) ? tool.capabilities.slice() : [],
      mount: (typeof tool.mount === "function") ? tool.mount : null,
      unmount: (typeof tool.unmount === "function") ? tool.unmount : null,
      resize: (typeof tool.resize === "function") ? tool.resize : null,
      render: (typeof tool.render === "function") ? tool.render : null,
      getState: (typeof tool.getState === "function") ? tool.getState : null,
      setState: (typeof tool.setState === "function") ? tool.setState : null,
      reset: (typeof tool.reset === "function") ? tool.reset : null,
      export: (typeof tool.export === "function") ? tool.export : null
    };

    return true;
  }

  function unregisterTool(id) {
    if (!id || !registry[id]) {
      return false;
    }

    // If unregistering the active tool, unmount it and restore overview state
    if (state.activeTool === id) {
      selectTool(null);
    }

    delete registry[id];
    return true;
  }

  function getRegisteredTools() {
    return Object.keys(registry).map(function (key) {
      return clone(registry[key]);
    });
  }

  function getToolStates() {
    var saved = {};
    Object.keys(registry).forEach(function (id) {
      var tool = registry[id];
      if (typeof tool.getState !== "function") return;
      try {
        saved[id] = clone(tool.getState());
      } catch (err) {
        console.error("[MathForge] Could not capture state for tool '" + id + "':", err);
      }
    });
    return saved;
  }

  function setToolStates(saved) {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return false;
    Object.keys(saved).forEach(function (id) {
      var tool = registry[id];
      if (!tool || typeof tool.setState !== "function") return;
      try {
        tool.setState(clone(saved[id]));
      } catch (err) {
        console.error("[MathForge] Could not restore state for tool '" + id + "':", err);
      }
    });
    return true;
  }

  function resetTools() {
    Object.keys(registry).forEach(function (id) {
      var tool = registry[id];
      if (typeof tool.reset !== "function") return;
      try {
        tool.reset();
      } catch (err) {
        console.error("[MathForge] Could not reset tool '" + id + "':", err);
      }
    });
  }

  function getTool(id) {
    if (!id || !registry[id]) return null;
    return clone(registry[id]);
  }

  /* ==========================================================================
     UI Synchronization Functions
     ========================================================================== */
  function updateLeftPanelUI() {
    if (!dom.toolList) return;
    var cards = dom.toolList.querySelectorAll("[data-tool-id]");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var cardId = card.getAttribute("data-tool-id");
      var isActive = (cardId === state.activeTool);
      if (isActive) {
        card.classList.add("active");
        card.setAttribute("aria-pressed", "true");
      } else {
        card.classList.remove("active");
        card.setAttribute("aria-pressed", "false");
      }
      card.removeAttribute("role");
      card.removeAttribute("aria-selected");
    }
  }

  function updateCentralWorkspaceUI() {
    if (!dom.welcomeContent || !dom.activePlaceholder || !dom.toolMountContainer) return;

    if (!state.activeTool) {
      // Welcome Empty State
      dom.welcomeContent.style.display = "block";
      dom.activePlaceholder.style.display = "none";
      dom.toolMountContainer.classList.remove("active");
      return;
    }

    var tool = registry[state.activeTool];
    if (!tool) return;

    dom.welcomeContent.style.display = "none";

    // If an integrated tool has mounted UI inside toolMountContainer, show it
    if (mountedToolInstance && typeof tool.mount === "function") {
      dom.activePlaceholder.style.display = "none";
      dom.toolMountContainer.classList.add("active");
    } else {
      // Phase 2: Informative active placeholder
      dom.toolMountContainer.classList.remove("active");
      dom.activePlaceholder.style.display = "block";

      var capsHtml = "";
      if (tool.capabilities && tool.capabilities.length > 0) {
        capsHtml = tool.capabilities.map(function (cap) {
          return '<div class="mf-cap-item"><span aria-hidden="true">✓</span> <span>' + escapeHtml(cap) + '</span></div>';
        }).join("");
      }

      dom.activePlaceholder.innerHTML =
        '<div class="mf-active-placeholder-header">' +
          '<div class="mf-active-placeholder-icon" aria-hidden="true">' + escapeHtml(tool.icon) + '</div>' +
          '<div>' +
            '<h2 class="mf-active-placeholder-title">' + escapeHtml(tool.name) + '</h2>' +
            '<span class="mf-status-badge">Canvas adapter unavailable</span>' +
          '</div>' +
        '</div>' +
        '<p class="mf-active-placeholder-desc">' + escapeHtml(tool.description) + '</p>' +
        '<div class="mf-group-label mf-text-left">Tool Capabilities</div>' +
        '<div class="mf-capabilities-list">' + capsHtml + '</div>' +
        '<div class="mf-export-notice mf-mt-md">' +
          'This tool could not be started. Select another tool or reload the workspace.' +
        '</div>' +
        '<div class="mf-mt-lg">' +
          '<button type="button" class="mf-action-btn" id="mfReturnWelcomeBtn">' +
            '← Return to Overview' +
          '</button>' +
        '</div>';
    }
  }

  function updateRightPanelUI() {
    if (!dom.propertiesContainer) return;

    if (!state.activeTool) {
      dom.propertiesContainer.innerHTML =
        '<div class="mf-property-placeholder">' +
          'Select a tool from the Input Tools panel to view its customizable visual properties.' +
        '</div>';
      return;
    }

    var tool = registry[state.activeTool];
    if (!tool) return;

    // If the mounted tool populated custom properties controls into dom.propertiesContainer, preserve them
    if (dom.propertiesContainer.children.length > 0 && !dom.propertiesContainer.querySelector('.mf-property-placeholder')) {
      return;
    }

    dom.propertiesContainer.innerHTML =
      '<div class="mf-property-section">' +
        '<div class="mf-property-title">Active Tool Context</div>' +
        '<div class="mf-property-row">' +
          '<span>Tool Name</span>' +
          '<span class="mf-property-value mf-text-accent-bold">' +
            escapeHtml(tool.name) +
          '</span>' +
        '</div>' +
        '<div class="mf-property-row">' +
          '<span>Identifier</span>' +
          '<span class="mf-property-value">' + escapeHtml(tool.id) + '</span>' +
        '</div>' +
        '<div class="mf-property-row">' +
          '<span>Status</span>' +
          '<span class="mf-property-value mf-text-success">Registered</span>' +
        '</div>' +
      '</div>' +
      '<div class="mf-property-section">' +
        '<div class="mf-property-title">Tool Controls</div>' +
        '<div class="mf-property-placeholder">' +
          'Inputs, graph settings, pan, zoom, reset, and export controls are available in the active tool panel.' +
        '</div>' +
      '</div>';
  }

  function updateStatusBarUI() {
    if (dom.statusActiveTool) {
      if (state.activeTool && registry[state.activeTool]) {
        dom.statusActiveTool.textContent = registry[state.activeTool].name;
      } else {
        dom.statusActiveTool.textContent = "None (Overview)";
      }
    }

    if (dom.statusMessage) {
      dom.statusMessage.textContent = state.statusMessage;
    }

    if (dom.statusDoc) {
      dom.statusDoc.textContent = state.activeDocument;
    }

    if (dom.statusZoom) {
      dom.statusZoom.textContent = Math.round(state.zoom * 100) + "%";
    }
  }

  function updateDprUI() {
    var dprEl = document.getElementById("mfPropDpr");
    if (dprEl) {
      var ratio = getEffectiveDpr();
      dprEl.textContent = ratio.toFixed(1) + "×";
    }
  }

  function updateTabsUI() {
    if (!dom.docTabsContainer) return;
    var tabs = dom.docTabsContainer.querySelectorAll("[data-tab-id]");
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      var tabId = tab.getAttribute("data-tab-id");
      var isCurrent = (tabId === state.activeDocument);

      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", isCurrent ? "true" : "false");
      tab.setAttribute("tabindex", isCurrent ? "0" : "-1");

      var controlsId = tab.getAttribute("aria-controls") || "mfCanvasSheet";
      tab.setAttribute("aria-controls", controlsId);

      if (isCurrent) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }

      var panel = document.getElementById(controlsId);
      if (panel) {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id || ("mfDocTab-" + tabId));
        if (isCurrent) {
          panel.removeAttribute("hidden");
          panel.removeAttribute("aria-hidden");
        } else {
          panel.setAttribute("hidden", "hidden");
          panel.setAttribute("aria-hidden", "true");
        }
      }
    }
  }

  /* ==========================================================================
     Resize Notification with Coalescing & Reentrancy Guards
     ========================================================================== */
  function notifyToolResize(force) {
    if (isResizing) return;

    var container = dom.toolMountContainer;
    if (!container) return;

    var rect = container.getBoundingClientRect();
    var width = Math.floor(rect.width);
    var height = Math.floor(rect.height);
    var dpr = getEffectiveDpr();

    // Ignore callback if dimensions and DPR have not changed unless forced
    if (!force && width === lastObservedWidth && height === lastObservedHeight && dpr === lastObservedDpr) {
      return;
    }

    lastObservedWidth = width;
    lastObservedHeight = height;
    lastObservedDpr = dpr;

    if (mountedToolInstance && typeof mountedToolInstance.resize === "function") {
      isResizing = true;
      try {
        mountedToolInstance.resize(width, height, dpr);
      } catch (err) {
        console.error("[MathForge] Error during tool resize notification:", err);
      } finally {
        isResizing = false;
      }
    }
    updateDprUI();
  }

  function scheduleResizeNotification(force) {
    if (pendingResizeRafId !== null) {
      // Coalesce repeated notifications into the pending animation frame
      return;
    }

    var raf = (typeof window.requestAnimationFrame === "function")
      ? window.requestAnimationFrame
      : function (cb) { return setTimeout(cb, 16); };

    pendingResizeRafId = raf(function () {
      pendingResizeRafId = null;
      notifyToolResize(force);
    });
  }

  function updatePanelVisibilityUI() {
    if (!dom.workspace) return;

    var panelKeys = ["left", "right", "bottom"];
    var panelElements = {
      left: dom.leftPanel,
      right: dom.rightPanel,
      bottom: dom.bottomPanel
    };
    var collapseBtnElements = {
      left: dom.collapseButtons.left,
      right: dom.collapseButtons.right,
      bottom: dom.collapseButtons.bottom
    };

    panelKeys.forEach(function (key) {
      var isVisible = !!state.panels[key];
      var className = key + "-collapsed";
      var panelEl = panelElements[key];
      var toggleBtn = dom.panelToggles[key];
      var collapseBtn = collapseBtnElements[key];

      if (isVisible) {
        dom.workspace.classList.remove(className);
        if (panelEl) {
          panelEl.removeAttribute("aria-hidden");
        }
      } else {
        dom.workspace.classList.add(className);
        if (panelEl) {
          panelEl.setAttribute("aria-hidden", "true");
        }
      }

      if (toggleBtn) {
        if (isVisible) {
          toggleBtn.classList.add("active");
          toggleBtn.setAttribute("aria-pressed", "true");
          toggleBtn.setAttribute("aria-expanded", "true");
        } else {
          toggleBtn.classList.remove("active");
          toggleBtn.setAttribute("aria-pressed", "false");
          toggleBtn.setAttribute("aria-expanded", "false");
        }
      }

      if (collapseBtn) {
        collapseBtn.setAttribute("aria-expanded", isVisible ? "true" : "false");
      }
    });

    scheduleResizeNotification(true);
  }

  function dispatchToolChangedEvent(toolId) {
    if (typeof document.dispatchEvent === "function") {
      try {
        var event = new CustomEvent("mf:tool-changed", {
          detail: { toolId: toolId, tool: toolId ? registry[toolId] : null }
        });
        document.dispatchEvent(event);
      } catch (e) {
        // Safe fallback for older browsers
      }
    }
  }

  /* ==========================================================================
     Tool Selection & Lifecycle Execution with Reliable State Rollback
     ========================================================================== */
  function selectTool(targetId) {
    if (targetId !== null && (!targetId || !registry[targetId])) {
      console.warn("[MathForge] Tool selection ignored: Unknown tool ID '" + targetId + "'.");
      return false;
    }

    // 1. Capture previous active tool ID and state
    var prevToolId = state.activeTool;
    var prevToolState = undefined;
    var prevToolRecord = prevToolId ? registry[prevToolId] : null;

    if (prevToolRecord && typeof prevToolRecord.getState === "function") {
      try {
        prevToolState = prevToolRecord.getState();
      } catch (getStateErr) {
        console.error("[MathForge] Error getting previous tool state:", getStateErr);
      }
    }

    // 2. Safely unmount previous tool
    if (mountedToolInstance) {
      if (typeof mountedToolInstance.unmount === "function") {
        try {
          mountedToolInstance.unmount();
        } catch (unmountErr) {
          console.error("[MathForge] Error unmounting previous tool:", unmountErr);
        }
      }
      mountedToolInstance = null;
    }

    // 3. Validate mount container before attempting mount
    if (!dom.toolMountContainer) {
      console.error("[MathForge] Tool mount container (#mfToolMountContainer) is missing.");
      state.statusMessage = "Mount failed: Mount container missing";
      updateStatusBarUI();
      return false;
    }

    // Clean container before mounting new content
    dom.toolMountContainer.innerHTML = "";

    // 4. If targetId is null, cleanly transition to Overview
    if (targetId === null) {
      state.activeTool = null;
      state.statusMessage = "Overview ready";
      updateLeftPanelUI();
      updateCentralWorkspaceUI();
      updateRightPanelUI();
      updateStatusBarUI();
      dispatchToolChangedEvent(null);
      return true;
    }

    // 5. Attempt to mount the target tool
    var targetTool = registry[targetId];
    var mountSucceeded = true;
    var mountError = null;

    if (typeof targetTool.mount === "function") {
      try {
        // Ensure container is rendered and has layout geometry before mounting
        if (dom.welcomeContent) dom.welcomeContent.style.display = "none";
        if (dom.activePlaceholder) dom.activePlaceholder.style.display = "none";
        dom.toolMountContainer.classList.add("active");

        targetTool.mount(dom.toolMountContainer, {
          dpr: getEffectiveDpr(),
          workspace: window.MathForgeWorkspace
        });
        mountedToolInstance = targetTool;
      } catch (err) {
        mountSucceeded = false;
        mountError = err;
        console.error("[MathForge] Error mounting tool '" + targetId + "':", err);
      }
    } else {
      // In Phase 2, tools without mount hook display the informative placeholder
      mountedToolInstance = null;
    }

    // 6. Handle mount failure with reliable rollback
    if (!mountSucceeded) {
      // Clean up partially mounted new tool DOM
      dom.toolMountContainer.innerHTML = "";
      mountedToolInstance = null;

      // Attempt restoration of previous tool
      var restorationSucceeded = false;
      if (prevToolId && registry[prevToolId]) {
        var restoreTool = registry[prevToolId];
        if (typeof restoreTool.mount === "function") {
          try {
            restoreTool.mount(dom.toolMountContainer, {
              dpr: getEffectiveDpr(),
              workspace: window.MathForgeWorkspace
            });
            mountedToolInstance = restoreTool;
            restorationSucceeded = true;

            // Restore captured state if available
            if (prevToolState !== undefined && typeof restoreTool.setState === "function") {
              try {
                restoreTool.setState(prevToolState);
              } catch (setStateErr) {
                console.error("[MathForge] Error restoring tool state:", setStateErr);
              }
            }
          } catch (restoreErr) {
            console.error("[MathForge] Error restoring previous tool:", restoreErr);
            restorationSucceeded = false;
          }
        } else {
          // Previous tool had no mount hook (placeholder only)
          restorationSucceeded = true;
          mountedToolInstance = null;
        }
      }

      if (restorationSucceeded) {
        state.activeTool = prevToolId;
        var errText = (mountError && mountError.message) ? mountError.message : String(mountError);
        state.statusMessage = "Mount failed: " + errText + "; restored " + registry[prevToolId].name;
      } else {
        // Fallback to Overview if restoration failed or prevToolId was null
        dom.toolMountContainer.innerHTML = "";
        mountedToolInstance = null;
        state.activeTool = null;
        state.statusMessage = "Mount and restoration failed; returned to Overview";
      }

      updateLeftPanelUI();
      updateCentralWorkspaceUI();
      updateRightPanelUI();
      updateStatusBarUI();
      return false;
    }

    // 7. Mount succeeded
    state.activeTool = targetId;
    state.statusMessage = "Tool selected: " + targetTool.name;

    updateLeftPanelUI();
    updateCentralWorkspaceUI();
    updateRightPanelUI();
    updateStatusBarUI();
    dispatchToolChangedEvent(targetId);

    return true;
  }

  /* ==========================================================================
     Document Tab Switching
     ========================================================================== */
  function selectTab(tabId) {
    if (!tabId || typeof tabId !== "string") {
      return false;
    }

    var found = false;
    for (var i = 0; i < state.openDocuments.length; i++) {
      if (state.openDocuments[i].id === tabId) {
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn("[MathForge] Cannot select tab: Unknown document ID '" + tabId + "'.");
      return false;
    }

    state.activeDocument = tabId;
    updateTabsUI();
    updateStatusBarUI();
    return true;
  }

  /* ==========================================================================
     Panel Visibility Operations
     ========================================================================== */
  function setPanelVisibility(panel, visible) {
    if (!state.panels.hasOwnProperty(panel)) {
      console.warn("[MathForge] Unknown panel name: " + panel);
      return false;
    }
    state.panels[panel] = !!visible;
    updatePanelVisibilityUI();
    return true;
  }

  function togglePanel(panel) {
    if (!state.panels.hasOwnProperty(panel)) return false;
    return setPanelVisibility(panel, !state.panels[panel]);
  }

  function isPanelVisible(panel) {
    if (!state.panels.hasOwnProperty(panel)) return false;
    return state.panels[panel];
  }

  /* ==========================================================================
     Event Binding (100% Managed & Delegated)
     ========================================================================== */
  function bindEvents() {
    // Left panel tool selection (Event Delegation)
    if (dom.toolList) {
      addManagedListener(dom.toolList, "click", function (e) {
        var card = e.target.closest("[data-tool-id]");
        if (!card) return;
        var toolId = card.getAttribute("data-tool-id");
        if (toolId) {
          selectTool(toolId);
        }
      });
    }

    // Document tab selection & keyboard navigation
    if (dom.docTabsContainer) {
      // Click delegation
      addManagedListener(dom.docTabsContainer, "click", function (e) {
        var tab = e.target.closest("[data-tab-id]");
        if (!tab) return;
        if (e.target.closest(".mf-doc-tab-close")) return;
        var tabId = tab.getAttribute("data-tab-id");
        if (tabId) {
          selectTab(tabId);
        }
      });

      // Keyboard navigation using the actually focused tab
      addManagedListener(dom.docTabsContainer, "keydown", function (e) {
        var tabs = Array.prototype.slice.call(dom.docTabsContainer.querySelectorAll("[data-tab-id]"));
        if (!tabs || tabs.length === 0) return;

        var focusedEl = document.activeElement;
        var targetTab = (e.target && e.target.closest("[data-tab-id]")) || (focusedEl && focusedEl.closest("[data-tab-id]"));

        var currentIndex = tabs.indexOf(targetTab);
        if (currentIndex === -1) {
          for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].getAttribute("data-tab-id") === state.activeDocument) {
              currentIndex = i;
              break;
            }
          }
        }
        if (currentIndex === -1) currentIndex = 0;

        var newIndex = -1;
        if (e.key === "ArrowRight") {
          newIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === "ArrowLeft") {
          newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (e.key === "Home") {
          newIndex = 0;
        } else if (e.key === "End") {
          newIndex = tabs.length - 1;
        } else if (e.key === "Enter" || e.key === " ") {
          if (targetTab) {
            e.preventDefault();
            selectTab(targetTab.getAttribute("data-tab-id"));
            targetTab.focus();
            return;
          }
        }

        if (newIndex !== -1 && newIndex !== currentIndex) {
          e.preventDefault();
          var newTab = tabs[newIndex];
          var newTabId = newTab.getAttribute("data-tab-id");
          selectTab(newTabId);
          newTab.focus();
        }
      });
    }

    // Home / Overview button in header
    var homeBtn = document.getElementById("mfHomeBtn");
    if (homeBtn) {
      addManagedListener(homeBtn, "click", function () {
        selectTool(null);
      });
    }

    // Managed delegated click listener for "Return to Overview" on persistent canvas stage
    var canvasStage = document.getElementById("mfCanvasStage");
    if (canvasStage) {
      addManagedListener(canvasStage, "click", function (e) {
        if (e.target && (e.target.id === "mfReturnWelcomeBtn" || e.target.closest("#mfReturnWelcomeBtn"))) {
          selectTool(null);
        }
      });
    }

    // Panel toggle buttons in header
    ["left", "right", "bottom"].forEach(function (panelKey) {
      var btn = dom.panelToggles[panelKey];
      if (btn) {
        addManagedListener(btn, "click", function () {
          togglePanel(panelKey);
        });
      }
    });

    // Panel collapse arrow buttons
    var collapseLeftBtn = document.getElementById("mfCollapseLeftBtn");
    if (collapseLeftBtn) {
      addManagedListener(collapseLeftBtn, "click", function () {
        setPanelVisibility("left", false);
      });
    }

    var collapseRightBtn = document.getElementById("mfCollapseRightBtn");
    if (collapseRightBtn) {
      addManagedListener(collapseRightBtn, "click", function () {
        setPanelVisibility("right", false);
      });
    }

    var collapseBottomBtn = document.getElementById("mfCollapseBottomBtn");
    if (collapseBottomBtn) {
      addManagedListener(collapseBottomBtn, "click", function () {
        setPanelVisibility("bottom", false);
      });
    }

    // Welcome screen quick action buttons
    var welcomeQuickTools = document.querySelectorAll("[data-welcome-select-tool]");
    for (var i = 0; i < welcomeQuickTools.length; i++) {
      addManagedListener(welcomeQuickTools[i], "click", function () {
        var toolId = this.getAttribute("data-welcome-select-tool");
        if (toolId) {
          selectTool(toolId);
        }
      });
    }

    // Panel transition synchronization (handles CSS panel animation finish)
    var workspaceBody = document.querySelector(".mf-workspace-body");
    if (workspaceBody) {
      addManagedListener(workspaceBody, "transitionend", function (e) {
        if (e.target && (e.target.classList.contains("mf-side-panel") || e.target.classList.contains("mf-bottom-panel"))) {
          scheduleResizeNotification(true);
        }
      });
    }

    // Modern ResizeObserver on tool mount container and canvas sheet
    if (typeof ResizeObserver !== "undefined" && dom.toolMountContainer) {
      try {
        resizeObserverInstance = new ResizeObserver(function () {
          scheduleResizeNotification(false);
        });
        resizeObserverInstance.observe(dom.toolMountContainer);
        var canvasSheet = document.getElementById("mfCanvasSheet");
        if (canvasSheet) {
          resizeObserverInstance.observe(canvasSheet);
        }
      } catch (err) {
        console.warn("[MathForge] ResizeObserver could not be attached:", err);
      }
    }

    // Global resize listener (debounced window fallback)
    addManagedListener(window, "resize", function () {
      scheduleResizeNotification(false);
    });
  }

  /* ==========================================================================
     Workspace Destruction & Teardown Policy
     ==========================================================================
     Policy:
     - destroy() cleanly detaches all DOM event listeners via eventCleanups.
     - Disconnects and removes the ResizeObserver instance.
     - Cancels any pending requestAnimationFrame or setTimeout tasks.
     - Safely calls unmount() on active tool (swallowing and logging errors).
     - Empties #mfToolMountContainer DOM contents.
     - Resets active state: state.initialized = false; state.activeTool = null;
     - Removes body styling class .mf-workspace-active.
     - Repeated destroy() invocations are safe no-ops.
     ========================================================================== */
  function destroy() {
    if (mountedToolInstance) {
      try {
        if (typeof mountedToolInstance.unmount === "function") {
          mountedToolInstance.unmount();
        }
      } catch (err) {
        console.error("[MathForge] Error unmounting tool during destroy:", err);
      }
      mountedToolInstance = null;
    }

    clearManagedListeners();

    if (dom.toolMountContainer) {
      dom.toolMountContainer.innerHTML = "";
    }

    lastObservedWidth = -1;
    lastObservedHeight = -1;
    lastObservedDpr = -1;
    isResizing = false;

    state.initialized = false;
    state.activeTool = null;

    if (document.body) {
      document.body.classList.remove("mf-workspace-active");
    }
  }

  /* ==========================================================================
     Workspace Initialization Policy
     ==========================================================================
     Policy:
     - If state.initialized is true, calls destroy() first to guarantee no duplicate
       event listeners or lingering state exist.
     - Caches live DOM references and validates required shell nodes.
     - Registers default BUILTIN_TOOLS if not already present in registry.
     - Binds all managed listeners and ResizeObserver.
     - Renders initial UI and activates body class.
     - Returns true upon success; false if workspace shell element missing.
     ========================================================================== */
  function init(options) {
    if (state.initialized) {
      destroy();
    }

    options = options || {};
    if (window.innerWidth <= 820) {
      state.panels.left = false;
      state.panels.right = false;
    }

    // Cache DOM Elements
    dom.workspace = document.querySelector(".mf-workspace") || document.getElementById("mfWorkspace");
    if (!dom.workspace) {
      console.error("[MathForge] Initialization failed: .mf-workspace container element not found.");
      return false;
    }

    dom.toolList = document.getElementById("mfToolList");
    dom.toolMountContainer = document.getElementById("mfToolMountContainer");
    dom.welcomeContent = document.getElementById("mfWelcomeContent");
    dom.activePlaceholder = document.getElementById("mfActivePlaceholder");
    dom.propertiesContainer = document.getElementById("mfPropertiesContainer");
    dom.statusMessage = document.getElementById("mfStatusMessage");
    dom.statusActiveTool = document.getElementById("mfStatusActiveTool");
    dom.statusDoc = document.getElementById("mfStatusDoc");
    dom.statusZoom = document.getElementById("mfStatusZoom");
    dom.docTabsContainer = document.getElementById("mfDocTabsContainer");

    dom.panelToggles.left = document.getElementById("mfToggleLeftBtn");
    dom.panelToggles.right = document.getElementById("mfToggleRightBtn");
    dom.panelToggles.bottom = document.getElementById("mfToggleBottomBtn");

    dom.leftPanel = document.getElementById("mfLeftPanel");
    dom.rightPanel = document.getElementById("mfRightPanel");
    dom.bottomPanel = document.getElementById("mfBottomPanel");

    dom.collapseButtons.left = document.getElementById("mfCollapseLeftBtn");
    dom.collapseButtons.right = document.getElementById("mfCollapseRightBtn");
    dom.collapseButtons.bottom = document.getElementById("mfCollapseBottomBtn");

    // Add active body class to activate fixed desktop styles
    document.body.classList.add("mf-workspace-active");

    // Register built-in tool metadata
    BUILTIN_TOOLS.forEach(function (tool) {
      if (!registry[tool.id]) {
        registerTool(tool);
      }
    });

    // Wire up events
    bindEvents();

    // Initial render
    state.initialized = true;
    updatePanelVisibilityUI();
    updateLeftPanelUI();
    updateCentralWorkspaceUI();
    updateRightPanelUI();
    updateStatusBarUI();
    updateTabsUI();
    updateDprUI();

    // If options specify an initial tool
    if (options.initialTool && registry[options.initialTool]) {
      selectTool(options.initialTool);
    }

    return true;
  }

  /* ==========================================================================
     Public API Exposure
     ========================================================================== */
  window.MathForgeWorkspace = {
    init: init,
    destroy: destroy,
    getState: function () { return clone(state); },
    getActiveTool: function () { return state.activeTool ? getTool(state.activeTool) : null; },
    exportActiveTool: function (format) {
      var active = state.activeTool && registry[state.activeTool];
      if (!active || typeof active.export !== "function") return null;
      return active.export(format);
    },
    selectTool: selectTool,
    registerTool: registerTool,
    unregisterTool: unregisterTool,
    getRegisteredTools: getRegisteredTools,
    getToolStates: getToolStates,
    setToolStates: setToolStates,
    resetTools: resetTools,
    getTool: getTool,
    setPanelVisibility: setPanelVisibility,
    togglePanel: togglePanel,
    isPanelVisible: isPanelVisible,
    selectTab: selectTab,
    fitCanvasToContainer: fitCanvasToContainer,
    getEffectiveDpr: getEffectiveDpr
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
    });
  } else {
    init();
  }

})(window, document);
