"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mathSource = fs.readFileSync(path.join(root, "assets/js/core/equation-math.js"), "utf8");
const engineSource = fs.readFileSync(path.join(root, "assets/js/tools/equation-plotter-engine.js"), "utf8");

function harness() {
  const mathWindow = {};
  vm.runInNewContext(mathSource, { window: mathWindow, Math, Number, String, Object, Array, Error }, { filename: "equation-math.js" });
  const operations = [];
  function makeContext() {
    return {
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
      save() {}, restore() {}, beginPath() {}, closePath() {}, rect() {}, clip() {}, setLineDash(value) { operations.push({ op: "dash", value: Array.from(value), color: this.strokeStyle }); },
      clearRect() {}, fillRect(x, y, width, height) { operations.push({ op: "fillRect", x, y, width, height, color: this.fillStyle }); },
      moveTo(x, y) { operations.push({ op: "moveTo", x, y, color: this.strokeStyle }); }, lineTo(x, y) { operations.push({ op: "lineTo", x, y, color: this.strokeStyle }); },
      stroke() { operations.push({ op: "stroke", color: this.strokeStyle }); }, arc(x, y, r) { operations.push({ op: "arc", x, y, r, color: this.fillStyle }); },
      fill() {}, fillText(text, x, y) { operations.push({ op: "text", text, x, y }); }, measureText(text) { return { width: String(text).length * 7 }; }
    };
  }
  function makeCanvas(width = 920, height = 690) {
    const context = makeContext();
    return { width, height, context, getContext() { return context; }, toDataURL() { return "data:image/png;base64,AAAA"; } };
  }
  const canvas = makeCanvas();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height });
  canvas.listeners = {};
  canvas.addEventListener = (type, handler) => { (canvas.listeners[type] ||= []).push(handler); };
  canvas.removeEventListener = () => {};
  const errors = new Map();
  const controls = { innerHTML: "", listeners: {}, addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
    removeEventListener() {}, querySelector(selector) { if (selector === "[data-eq-feedback]") return { textContent: "" }; const match = selector.match(/data-(?:eq|pt)-error="([^"]+)"/); if (match) { if (!errors.has(selector)) errors.set(selector, { textContent: "" }); return errors.get(selector); } return null; } };
  const document = {
    getElementById(id) { return id === "mfWorkspace" ? {} : null; },
    createElement(tag) { if (tag !== "canvas") throw new Error("Unexpected element " + tag); return makeCanvas(); },
    addEventListener() {}, removeEventListener() {}
  };
  const window = {
    MathForgeEquationMath: mathWindow.MathForgeEquationMath,
    MathForgeGraphDesignSettings: { getState() { return { background: "#17191c", gridVisible: true, gridSpacing: 10, majorEvery: 5,
      gridColor: "#111111", axesVisible: true, axisColor: "#000000", fontFamily: "Times New Roman", fontSizePt: 11, fontColor: "#111827", bold: false }; } },
    MathForgeGraphScale: { effectiveRate(axis) { return axis === "x" ? 5 : 1; } },
    drawInfiniteAxes() { operations.push({ op: "axes" }); }, addEventListener() {}, removeEventListener() {}
  };
  vm.runInNewContext(engineSource, { window, document, Math, Number, String, Object, Array, JSON, Date, Blob, Promise, Float64Array }, { filename: "equation-plotter-engine.js" });
  const engine = window.MathForgeEquationPlotter.mount({ workspace: true, controlsRoot: controls, canvasView: canvas });
  return { engine, controls, canvas, operations, errors };
}

test("workspace Equation Plotter presents independent equation rows and a separate points section", () => {
  const { controls } = harness();
  assert.match(controls.innerHTML, /Equations/);
  assert.match(controls.innerHTML, /\+ Add Equation/);
  assert.match(controls.innerHTML, /Plot \/ Update/);
  assert.match(controls.innerHTML, /Points/);
  assert.match(controls.innerHTML, /\+ Add Point/);
  assert.match(controls.innerHTML, /Clear Graph/);
  assert.match(controls.innerHTML, /Angles use radians/);
  assert.doesNotMatch(controls.innerHTML, /Curve mode|Points \(smooth \+ draggable\)/);
});

test("multiple equations and points render together and persist independently", () => {
  const { engine, operations } = harness();
  const state = {
    equations: [
      { id: "line", label: "Straight Line", expression: "y=2x+3", color: "#2563eb", visible: true },
      { id: "circle", label: "Circle", expression: "x^2+y^2=25", color: "#dc2626", visible: true },
      { id: "parabola", label: "Parabola", expression: "y=x^2", color: "#16a34a", visible: true }
    ], points: [{ id: "A", label: "A", x: "2", y: "3", visible: true }, { id: "B", label: "B", x: "-2", y: "4", visible: false }], zoom: 1, panX: 0, panY: 0, lineWidth: 2.5, cleared: false
  };
  engine.setState(state);
  const saved = engine.getState();
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), state);
  for (const color of ["#2563eb", "#dc2626", "#16a34a"]) assert.ok(operations.some((op) => op.op === "stroke" && op.color === color), color + " equation rendered");
  assert.ok(operations.some((op) => op.op === "text" && op.text.startsWith("A (2, 3)")));
  assert.equal(operations.some((op) => op.op === "text" && op.text.startsWith("B (")), false, "hidden point is omitted");
});

test("Clear Graph hides plotted content without deleting saved equations or points", () => {
  const { engine, controls, operations } = harness();
  engine.setState({ equations: [{ id: "line", label: "Line", expression: "y=x", color: "#2563eb", visible: true }],
    points: [{ id: "A", label: "A", x: "1", y: "1", visible: true }], zoom: 1, panX: 0, panY: 0 });
  const before = engine.getState();
  const strokesBeforeClear = operations.filter((op) => op.op === "stroke" && op.color === "#2563eb").length;
  const clear = { getAttribute() { return "clear-plot"; } };
  clear.closest = (selector) => selector === "[data-eq-action]" ? clear : null;
  controls.listeners.click[0]({ target: clear });
  const cleared = engine.getState();
  assert.equal(cleared.cleared, true);
  assert.deepEqual(cleared.equations, before.equations);
  assert.deepEqual(cleared.points, before.points);
  const curveStrokes = operations.filter((op) => op.op === "stroke" && op.color === "#2563eb");
  assert.equal(curveStrokes.length, strokesBeforeClear, "no new equation stroke is drawn after clearing");
});

test("equation edits, visibility, add and delete actions do not alter other rows", () => {
  const { engine, controls } = harness();
  engine.setState({ equations: [
    { id: "line", label: "Line", expression: "y=2x+3", color: "#2563eb", visible: true },
    { id: "circle", label: "Circle", expression: "x^2+y^2=25", color: "#dc2626", visible: true }
  ], points: [{ id: "A", label: "A", x: "2", y: "3", visible: true }], zoom: 1, panX: 0, panY: 0 });
  function fieldEvent(id, key, value, type) {
    const node = { value, checked: Boolean(value), getAttribute(name) { return name === "data-eq-id" ? id : name === "data-eq-field" ? key : null; } };
    node.closest = (selector) => selector === "[data-eq-field]" ? node : null;
    controls.listeners[type][0]({ target: node, type });
  }
  fieldEvent("line", "expression", "y=x^3", "input");
  assert.equal(engine.getState().equations[0].expression, "y=x^3");
  assert.equal(engine.getState().equations[1].expression, "x^2+y^2=25");
  fieldEvent("circle", "visible", false, "change");
  assert.equal(engine.getState().equations[1].visible, false);
  assert.equal(engine.getState().points[0].label, "A");
  const add = { getAttribute() { return "add-equation"; } };
  add.closest = (selector) => selector === "[data-eq-action]" ? add : null;
  controls.listeners.click[0]({ target: add });
  assert.equal(engine.getState().equations.length, 3);
  const deletePoint = { getAttribute() { return "A"; } };
  deletePoint.closest = (selector) => selector === "[data-pt-delete]" ? deletePoint : null;
  controls.listeners.click[0]({ target: deletePoint });
  assert.equal(engine.getState().points.length, 0);
  assert.equal(engine.getState().equations.length, 3);
});

test("point positions respect K/N scale, zoom and pan on the shared plane", () => {
  const { engine, operations } = harness();
  const point = { id: "origin", label: "O", x: "0", y: "0", visible: true };
  engine.setState({ equations: [], points: [point], zoom: 1, panX: 0, panY: 0 });
  let marker = operations.filter((op) => op.op === "arc").at(-1);
  assert.deepEqual([marker.x, marker.y], [460, 345]);
  engine.setState({ equations: [], points: [{ id: "P", label: "P", x: "1", y: "1", visible: true }], zoom: 2, panX: 20, panY: -10 });
  marker = operations.filter((op) => op.op === "arc").at(-1);
  assert.deepEqual([marker.x, marker.y], [580, 315]);
});

test("invalid expressions show row feedback without crashing and discontinuous curves split", () => {
  const { engine, controls, operations } = harness();
  engine.setState({ equations: [
    { id: "bad", label: "Bad", expression: "y = window.alert(1)", color: "#dc2626", visible: true },
    { id: "tan", label: "Tangent", expression: "y=tan(x)", color: "#2563eb", visible: true }
  ], points: [], zoom: 1, panX: 0, panY: 0 });
  assert.equal(controls.querySelector('[data-eq-error="bad"]').textContent.length > 0, true);
  const tanMoves = operations.filter((op) => op.op === "moveTo" && op.color === "#2563eb");
  assert.ok(tanMoves.length > 1, "tangent discontinuities start separate curve segments");
});

test("PNG uses a white render surface and SVG contains an explicit white background", async () => {
  const { engine, operations } = harness();
  engine.setState({ equations: [{ id: "eq", label: "Circle", expression: "x^2+y^2<=16", color: "#2563eb", visible: true }],
    points: [{ id: "P", label: "P", x: "1", y: "1", visible: true }], zoom: 1, panX: 0, panY: 0 });
  const pngUrl = engine.export("png");
  assert.match(pngUrl, /^data:image\/png/);
  const whiteFills = operations.filter((op) => op.op === "fillRect" && op.color.toUpperCase() === "#FFFFFF");
  assert.ok(whiteFills.length > 0, "export renderer fills opaque pure white, independently of workspace theme");
  const svg = await engine.export("svg").text();
  assert.match(svg, /<rect width="100%" height="100%" fill="#FFFFFF"\/>/);
  assert.match(svg, /<image[^>]+href="data:image\/png/);
});

test("legacy Equation project control state restores its expression and points", () => {
  const { engine } = harness();
  engine.setState({ controls: [
    { id: "fn", value: "Math.pow(0.5, x)" }, { id: "mode", value: "function" },
    { id: "points", value: "2,3\n-1,4" }, { id: "zoom", value: "1.25" }, { id: "origin", value: "500,320" }, { id: "csize", value: "920,560" }
  ] });
  const saved = engine.getState();
  assert.equal(saved.equations[0].expression, "y = pow(0.5, x)");
  assert.deepEqual(saved.points.map((point) => [point.x, point.y]), [["2", "3"], ["-1", "4"]]);
  assert.equal(saved.zoom, 1.25);
});
