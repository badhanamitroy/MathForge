(function (window, document) {
  "use strict";

  if (window.parent === window) return;

  function collectState() {
    var controls = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select")).map(function (element) {
      return {
        id: element.id || "",
        type: element.type || element.tagName.toLowerCase(),
        value: element.value,
        checked: Boolean(element.checked)
      };
    });
    var tables = Array.prototype.slice.call(document.querySelectorAll("table[id]")).map(function (table) {
      return { id: table.id, rows: table.tBodies.length ? table.tBodies[0].rows.length : 0 };
    });
    return { controls: controls, tables: tables };
  }

  function notifyParent() {
    window.parent.postMessage({ type: "mf:standalone-state", state: collectState() }, "*");
  }

  function restoreState(state) {
    if (!state || !Array.isArray(state.controls)) return;
    (state.tables || []).forEach(function (tableState) {
      var table = document.getElementById(tableState.id);
      if (!table || !table.tBodies.length) return;
      var prefix = table.id.replace(/_table$/, "");
      var add = document.getElementById(prefix + "_addRow");
      var remove = document.getElementById(prefix + "_delRow");
      while (table.tBodies[0].rows.length < tableState.rows && add) add.click();
      while (table.tBodies[0].rows.length > tableState.rows && remove) remove.click();
    });

    var elements = Array.prototype.slice.call(document.querySelectorAll("input, textarea, select"));
    state.controls.forEach(function (saved, index) {
      var element = saved.id ? document.getElementById(saved.id) : elements[index];
      if (!element || element.type === "file") return;
      if (element.type === "checkbox" || element.type === "radio") element.checked = Boolean(saved.checked);
      else element.value = saved.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    notifyParent();
  }

  function runCommand(command) {
    var buttonIds = {
      "export-png": ["download", "o_pngBtn", "h_pngBtn"],
      reset: ["reset", "resetBtn", "o_resetBtn", "h_resetBtn"]
    };
    if (command === "zoom-in" || command === "zoom-out") {
      var slider = document.querySelector('input[type="range"][id$="zoom"], input[type="range"]#zoom');
      if (slider) {
        var step = Number(slider.step) || 0.05;
        var value = Number(slider.value) + (command === "zoom-in" ? step : -step);
        slider.value = String(Math.max(Number(slider.min) || 0, Math.min(Number(slider.max) || 10, value)));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    var ids = buttonIds[command] || [];
    for (var i = 0; i < ids.length; i++) {
      var button = document.getElementById(ids[i]);
      if (button) {
        button.click();
        return;
      }
    }
    if (command === "reset") window.location.reload();
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent || !event.data) return;
    if (event.data.type === "mf:request-state") notifyParent();
    if (event.data.type === "mf:restore") restoreState(event.data.state);
    if (event.data.type === "mf:command") runCommand(event.data.command);
  });

  ["input", "change", "click", "mouseup"].forEach(function (type) {
    document.addEventListener(type, function () { window.setTimeout(notifyParent, 0); }, true);
  });
  window.setTimeout(notifyParent, 0);
})(window, document);
