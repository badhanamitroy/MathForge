"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scaleSource = fs.readFileSync(path.join(root, "assets/js/core/graph-scale.js"), "utf8");
const source = fs.readFileSync(path.join(root, "assets/js/core/graph-design-settings.js"), "utf8");
const typographySource = fs.readFileSync(path.join(root, "assets/js/core/graph-typography.js"), "utf8");

function makeHarness() {
  const elements = new Map();
  function element(id, type) {
    const listeners = {};
    const value = { id, type: type || "text", tagName: type === "select" ? "SELECT" : "INPUT", value: "", checked: false,
      hidden: false, style: {}, dataset: {}, clientWidth: 0, clientHeight: 0,
      addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
      setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
      dispatchEvent(event) { (listeners[event.type] || []).forEach((callback) => callback(event)); },
      fire(name) { this.dispatchEvent({ type: name, bubbles: true }); } };
    elements.set(id, value);
    return value;
  }
  const ids = {
    mfDesignRatio: "select", mfDesignBackground: "color", mfDesignGridVisible: "checkbox",
    mfDesignGridSpacing: "number", mfDesignMajorEvery: "number", mfDesignGridColor: "color",
    mfDesignAxesVisible: "checkbox", mfDesignAxisColor: "color", mfGraphFontFamily: "select",
    mfGraphFontSizePt: "number", mfGraphBold: "checkbox", mfGraphFontColor: "color",
    mfDesignLineColor: "color", mfDesignLineWidth: "range", mfDesignCustomWidth: "number",
    mfDesignCustomHeight: "number", mfDesignCustomRatio: "div", mfCanvasStage: "div", mfCanvasSheet: "div",
    mfScaleXK: "number", mfScaleXN: "number", mfScaleYK: "number", mfScaleYN: "number", mfScaleValidation: "div"
  };
  Object.entries(ids).forEach(([id, type]) => element(id, type));
  elements.get("mfCanvasStage").clientWidth = 1200;
  elements.get("mfCanvasStage").clientHeight = 700;
  const documentListeners = {};
  const document = {
    getElementById(id) { return elements.get(id) || null; },
    addEventListener(name, callback) { (documentListeners[name] ||= []).push(callback); },
    removeEventListener() {},
    dispatchEvent(event) { (documentListeners[event.type] || []).forEach((callback) => callback(event)); }
  };
  const windowListeners = {};
  const window = {
    getComputedStyle() { return { paddingLeft: "0px", paddingRight: "0px", paddingTop: "0px", paddingBottom: "0px" }; },
    addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); }
  };
  const context = { window, document, Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    Number, String, Boolean, Object, Array, JSON, Math };
  vm.runInNewContext(scaleSource, context, { filename: "graph-scale.js" });
  vm.runInNewContext(source, context, { filename: "graph-design-settings.js" });
  vm.runInNewContext(typographySource, context, { filename: "graph-typography.js" });
  return { settings: window.MathForgeGraphDesignSettings, typography: window.MathForgeGraphTypography, elements };
}

test("shared graph design defaults to 4:3 and sizes the shared canvas at that ratio", () => {
  const { settings, elements } = makeHarness();
  assert.equal(settings.getState().ratio, "4:3");
  const sheet = elements.get("mfCanvasSheet");
  assert.equal(sheet.style.aspectRatio, String(4 / 3));
  assert.ok(Math.abs(parseInt(sheet.style.width, 10) / parseInt(sheet.style.height, 10) - 4 / 3) < 0.003);
  assert.equal(settings.getState().fontSizePt, 11);
});

test("shared graph design accepts each preset and validates custom dimensions before resizing", () => {
  const { settings, elements } = makeHarness();
  for (const ratio of ["1:1", "4:3", "3:4", "16:9"]) {
    settings.set("ratio", ratio);
    assert.equal(settings.getState().ratio, ratio);
    assert.equal(elements.get("mfCanvasSheet").dataset.graphRatio, ratio);
    const parts = ratio.split(":").map(Number);
    const actual = parseInt(elements.get("mfCanvasSheet").style.width, 10) /
      parseInt(elements.get("mfCanvasSheet").style.height, 10);
    assert.ok(Math.abs(actual - parts[0] / parts[1]) < 0.003, ratio);
  }
  settings.set("ratio", "custom");
  const defaultCustomWidth = settings.getState().customWidth;
  elements.get("mfDesignCustomWidth").value = "-2";
  elements.get("mfDesignCustomHeight").value = "3";
  elements.get("mfDesignCustomWidth").fire("input");
  assert.equal(settings.getState().customWidth, defaultCustomWidth);
  elements.get("mfDesignCustomWidth").value = "16";
  elements.get("mfDesignCustomHeight").value = "0";
  elements.get("mfDesignCustomHeight").fire("input");
  assert.equal(settings.getState().customWidth, defaultCustomWidth);
  elements.get("mfDesignCustomWidth").value = "16";
  elements.get("mfDesignCustomHeight").value = "9";
  elements.get("mfDesignCustomHeight").fire("input");
  assert.equal(settings.getState().ratio, "custom");
  assert.equal(elements.get("mfCanvasSheet").dataset.graphRatio, "16:9");
});

test("K/N inputs validate independently, update shared state, and round-trip in project settings", () => {
  const { settings, elements } = makeHarness();
  elements.get("mfScaleXK").value = "5";
  elements.get("mfScaleXN").value = "2.5";
  elements.get("mfScaleYK").value = "2";
  elements.get("mfScaleYN").value = "5";
  elements.get("mfScaleYN").fire("input");
  assert.deepEqual(JSON.parse(JSON.stringify(settings.getState().axisScale)), { x: { k: 5, n: 2.5 }, y: { k: 2, n: 5 } });
  const serialized = JSON.stringify(settings.getState());
  settings.setState(JSON.parse(serialized));
  assert.deepEqual(JSON.parse(JSON.stringify(settings.getState().axisScale)), { x: { k: 5, n: 2.5 }, y: { k: 2, n: 5 } });

  elements.get("mfScaleXK").value = "0";
  elements.get("mfScaleXK").fire("change");
  assert.equal(settings.getState().axisScale.x.k, 5);
  assert.equal(elements.get("mfScaleXK").attributes["aria-invalid"], "true");
  assert.match(elements.get("mfScaleValidation").textContent, /positive whole number/);
});

test("shared typography and colors update without recursively redispatching controls", () => {
  const { settings, elements } = makeHarness();
  elements.get("mfGraphFontSizePt").value = "13";
  elements.get("mfGraphFontSizePt").fire("input");
  elements.get("mfGraphFontFamily").value = "Kalpurush";
  elements.get("mfGraphFontFamily").fire("change");
  elements.get("mfGraphFontColor").value = "#123456";
  elements.get("mfGraphFontColor").fire("input");
  const current = settings.getState();
  assert.equal(current.fontSizePt, 13);
  assert.equal(current.fontFamily, "Kalpurush");
  assert.equal(current.fontColor, "#123456");
});

test("font size entry preserves typed values and applies 10, 11, 12, 14, 16, 18, and decimals exactly", () => {
  const { settings, typography: graphTypography, elements } = makeHarness();
  const sizeInput = elements.get("mfGraphFontSizePt");
  for (const size of [10, 11, 12, 14, 16, 18, 12.5, 11.25]) {
    sizeInput.value = String(size);
    sizeInput.fire("input");
    assert.equal(settings.getState().fontSizePt, size);
    assert.equal(sizeInput.value, String(size));
    const typography = graphTypography.read(sizeInput, elements.get("mfGraphBold"), elements.get("mfGraphFontFamily"), elements.get("mfGraphFontColor"));
    assert.equal(typography.fontSizePt, size);
    const expectedPx = size * 96 / 72;
    assert.ok(Math.abs(graphTypography.sizePx(typography) - expectedPx) < 0.0001);
    assert.ok(graphTypography.font(graphTypography.sizePx(typography), typography).startsWith(expectedPx + "px "));
  }
});

test("font size typing keeps intermediate text intact and round-trips through version-1 project settings", () => {
  const { settings, typography: graphTypography, elements } = makeHarness();
  const sizeInput = elements.get("mfGraphFontSizePt");
  sizeInput.value = "1";
  sizeInput.fire("input");
  assert.equal(settings.getState().fontSizePt, 11);
  assert.equal(sizeInput.value, "1");
  assert.equal(graphTypography.read(sizeInput, elements.get("mfGraphBold"), elements.get("mfGraphFontFamily"), elements.get("mfGraphFontColor")).fontSizePt, 11);
  sizeInput.value = "12.";
  sizeInput.fire("input");
  assert.equal(sizeInput.value, "12.");
  assert.equal(settings.getState().fontSizePt, 12);
  sizeInput.value = "12.5";
  sizeInput.fire("input");
  sizeInput.fire("change");

  const project = JSON.parse(JSON.stringify({
    format: "mathforge-project",
    version: 1,
    name: "Font size test",
    toolStates: {},
    graphDesignSettings: settings.getState()
  }));
  const reopened = makeHarness();
  reopened.settings.setState(project.graphDesignSettings);
  assert.equal(reopened.settings.getState().fontSizePt, 12.5);
  assert.equal(reopened.elements.get("mfGraphFontSizePt").value, "12.5");
});

test("toolbar stays left aligned in a non-wrapping, horizontally scrollable row", () => {
  const css = fs.readFileSync(path.join(root, "assets/css/workspace.css"), "utf8");
  assert.match(css, /\.mf-generator-toolbar[^\{]*\{[^}]*justify-content:\s*flex-start;[^}]*flex-wrap:\s*nowrap/s);
  assert.match(css, /\.mf-generator-toolbar \.mf-tool-list[^\{]*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto/s);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of ["coordinates-graph", "equation-plotter", "ogive-curve", "histogram-polygon"]) {
    assert.match(html, new RegExp(`data-tool-id="${id}"`));
  }
});

test("project persistence keeps the version-1 format and optional shared design settings", () => {
  const manager = fs.readFileSync(path.join(root, "assets/js/project-manager.js"), "utf8");
  const coordinates = fs.readFileSync(path.join(root, "assets/js/tools/coordinates-tool.js"), "utf8");
  const engines = ["equation-plotter-engine.js", "ogive-engine.js", "histogram-engine.js"]
    .map((file) => fs.readFileSync(path.join(root, "assets/js/tools", file), "utf8"));
  assert.match(manager, /version: 1/);
  assert.match(manager, /graphDesignSettings: window\.MathForgeGraphDesignSettings/);
  assert.match(manager, /graphDesignSettings: project\.graphDesignSettings \|\| null/);
  assert.match(manager, /MathForgeGraphDesignSettings\.setState\(project\.graphDesignSettings\)/);
  assert.match(coordinates, /sharedTypography = window\.MathForgeGraphDesignSettings\.getState\(\)/);
  assert.match(coordinates, /MathForgeGraphTypography\.read\(/);
  for (const engine of engines) assert.match(engine, /graphTypography\.read\(typographyControls\.sizeInput/);
});

