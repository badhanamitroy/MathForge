"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mathSource = fs.readFileSync(path.join(root, "assets/js/core/equation-math.js"), "utf8");
const engineSource = fs.readFileSync(path.join(root, "assets/js/tools/equation-plotter-engine.js"), "utf8");

function harness(options) {
  options = options || {};
  const mathWindow = {};
  vm.runInNewContext(mathSource, { window: mathWindow, Math, Number, String, Object, Array, Error }, { filename: "equation-math.js" });
  const operations = [];
  const windowListeners = {};
  const pointerCaptures = new Set();
  let xScale = 5, yScale = 1;
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
  canvas.classList = {
    classes: new Set(),
    toggle(name, force) { if (force) this.classes.add(name); else this.classes.delete(name); },
    add(name) { this.classes.add(name); },
    remove(...names) { for (const name of names) this.classes.delete(name); },
    contains(name) { return this.classes.has(name); }
  };
  canvas.setPointerCapture = (pointerId) => pointerCaptures.add(pointerId);
  canvas.hasPointerCapture = (pointerId) => pointerCaptures.has(pointerId);
  canvas.releasePointerCapture = (pointerId) => pointerCaptures.delete(pointerId);
  canvas.addEventListener = (type, handler) => { (canvas.listeners[type] ||= []).push(handler); };
  canvas.removeEventListener = () => {};
  const errors = new Map();
  const controls = { innerHTML: "", listeners: {}, addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
    removeEventListener() {}, querySelectorAll() { return []; },
    querySelector(selector) { if (selector === "[data-eq-feedback]") return { textContent: "" }; const match = selector.match(/data-(?:eq|pt)-error="([^"]+)"/); if (match) { if (!errors.has(selector)) errors.set(selector, { textContent: "" }); return errors.get(selector); } return null; } };
  const document = {
    getElementById(id) { return id === "mfWorkspace" ? {} : null; },
    createElement(tag) { if (tag !== "canvas") throw new Error("Unexpected element " + tag); return makeCanvas(); },
    addEventListener() {}, removeEventListener() {}
  };
  const window = {
    PointerEvent: options.pointerEvents === false ? undefined : function PointerEvent() {},
    MathForgeEquationMath: mathWindow.MathForgeEquationMath,
    MathForgeGraphDesignSettings: { getState() { return { background: "#17191c", gridVisible: true, gridSpacing: 10, majorEvery: 5,
      gridColor: "#111111", axesVisible: true, axisColor: "#000000", fontFamily: "Times New Roman", fontSizePt: 11, fontColor: "#111827", bold: false }; } },
    MathForgeGraphScale: { effectiveRate(axis) { return axis === "x" ? xScale : yScale; } },
    drawInfiniteAxes() { operations.push({ op: "axes" }); },
    addEventListener(type, handler) { (windowListeners[type] ||= []).push(handler); },
    removeEventListener() {}
  };
  vm.runInNewContext(engineSource, { window, document, Math, Number, String, Object, Array, JSON, Date, Blob, Promise, Float64Array }, { filename: "equation-plotter-engine.js" });
  const engine = window.MathForgeEquationPlotter.mount({ workspace: true, controlsRoot: controls, canvasView: canvas });
  return { engine, controls, canvas, operations, errors, window, windowListeners, pointerCaptures,
    setScale(x, y) { xScale = x; yScale = y; } };
}

function dispatchPointer(listeners, type, values) {
  let prevented = false;
  const event = Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0,
    preventDefault() { prevented = true; } }, values || {});
  (listeners[type] || []).forEach((handler) => handler(event));
  return { event, wasPrevented: () => prevented };
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

test("pointer dragging hit-tests points and converts scaled canvas coordinates into graph coordinates", () => {
  const { engine, canvas, controls, windowListeners, pointerCaptures, operations } = harness();
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 460, height: 345 });
  const equation = { id: "line", label: "Line", expression: "y=2x+3", color: "#2563eb", visible: true };
  engine.setState({ equations: [equation], points: [{ id: "P", label: "P", x: "0", y: "0", visible: true }], zoom: 1, panX: 0, panY: 0 });
  const pointFields = ["x", "y"].map((key) => ({ value: "0", getAttribute(name) { return name === "data-pt-id" ? "P" : name === "data-pt-field" ? key : null; } }));
  controls.querySelectorAll = () => pointFields;

  const down = dispatchPointer(canvas.listeners, "pointerdown", { clientX: 240, clientY: 192.5 });
  assert.equal(down.wasPrevented(), true);
  assert.equal(pointerCaptures.has(1), true, "the logical canvas forwards pointer capture to its canvas");
  assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), true);
  dispatchPointer(windowListeners, "pointermove", { clientX: 260, clientY: 172.5 });
  const moved = engine.getState();
  assert.deepEqual([moved.points[0].x, moved.points[0].y], ["0.8", "4"]);
  assert.deepEqual(pointFields.map((field) => field.value), ["0.8", "4"], "coordinate inputs stay in sync during movement");
  assert.deepEqual(moved.equations, [equation], "dragging does not edit equations");
  assert.ok(operations.some((op) => op.op === "arc" && op.x === 500 && op.y === 305), "the point follows the pointer during drag");

  dispatchPointer(windowListeners, "pointerup", {});
  assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), false);
  assert.match(controls.innerHTML, /data-pt-field="x"[^>]*value="0\.8"/);
  assert.match(controls.innerHTML, /data-pt-field="y"[^>]*value="4"/);
  const savedAfterDrag = engine.getState();
  engine.setState(savedAfterDrag);
  assert.deepEqual(engine.getState().points, savedAfterDrag.points, "dragged graph coordinates survive the existing tool-state restore path");
});

test("pointer dragging remains accurate with independent K/N scales, zoom, and pan", () => {
  const { engine, canvas, windowListeners, setScale } = harness();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 460, height: 345 });
  setScale(2, 3);
  engine.setState({ equations: [], points: [{ id: "P", label: "P", x: "2", y: "1", visible: true }], zoom: 1.5, panX: -20, panY: 15 });

  dispatchPointer(canvas.listeners, "pointerdown", { clientX: 250, clientY: 157.5 });
  dispatchPointer(windowListeners, "pointermove", { clientX: 280, clientY: 135 });
  assert.deepEqual([engine.getState().points[0].x, engine.getState().points[0].y], ["4", "2"]);
  dispatchPointer(windowListeners, "pointerup", {});
});

test("nearby points select the closest hit target and pointer cancellation releases the drag", () => {
  const { engine, canvas, windowListeners, pointerCaptures } = harness();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 460, height: 345 });
  engine.setState({ equations: [], points: [
    { id: "A", label: "A", x: "0", y: "0", visible: true },
    { id: "B", label: "B", x: "0.2", y: "0", visible: true }
  ], zoom: 1, panX: 0, panY: 0 });

  dispatchPointer(windowListeners, "pointermove", { clientX: 234, clientY: 172.5 });
  assert.equal(canvas.classList.contains("mf-equation-point-hover"), true);
  dispatchPointer(canvas.listeners, "pointerdown", { clientX: 234, clientY: 172.5 });
  dispatchPointer(windowListeners, "pointermove", { clientX: 244, clientY: 172.5 });
  assert.deepEqual(engine.getState().points.map((point) => point.x), ["0", "0.56"], "the nearest of two close points moves");
  dispatchPointer(windowListeners, "pointercancel", {});
  assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), false);
  assert.equal(pointerCaptures.has(1), false, "cancellation releases pointer capture");

  const cancelledPosition = engine.getState().points[1].x;
  dispatchPointer(windowListeners, "pointermove", { clientX: 280, clientY: 172.5 });
  assert.equal(engine.getState().points[1].x, cancelledPosition, "moves after cancellation do not continue the old drag");

  dispatchPointer(canvas.listeners, "pointerdown", { pointerId: 2, clientX: 234, clientY: 172.5 });
  dispatchPointer(windowListeners, "pointermove", { pointerId: 2, clientX: 250, clientY: 172.5 });
  dispatchPointer(windowListeners, "pointerup", { pointerId: 2 });
  assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), false, "a later pointer can complete a new drag");
});

test("touch and pen pointers can drag points and continue tracking beyond the canvas edge", () => {
  for (const [pointerId, pointerType] of [[3, "touch"], [4, "pen"]]) {
    const { engine, canvas, windowListeners, pointerCaptures } = harness();
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 460, height: 345 });
    engine.setState({ equations: [], points: [{ id: "P", label: "P", x: "0", y: "0", visible: true }], zoom: 1, panX: 0, panY: 0 });
    assert.equal(canvas.classList.contains("mf-equation-point-interactive"), true, "touch behavior is configured before pointerdown");
    dispatchPointer(canvas.listeners, "pointerdown", { pointerId, pointerType, clientX: 230, clientY: 172.5 });
    assert.equal(pointerCaptures.has(pointerId), true);
    dispatchPointer(windowListeners, "pointermove", { pointerId, pointerType, clientX: 500, clientY: 172.5 });
    assert.equal(engine.getState().points[0].x, "10.8");
    dispatchPointer(windowListeners, "pointerup", { pointerId, pointerType });
    assert.equal(pointerCaptures.has(pointerId), false);
    assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), false);
  }
});

test("mouse fallback remains available when Pointer Events are unsupported", () => {
  const { engine, canvas, windowListeners } = harness({ pointerEvents: false });
  engine.setState({ equations: [], points: [{ id: "P", label: "P", x: "0", y: "0", visible: true }], zoom: 1, panX: 0, panY: 0 });
  dispatchPointer(canvas.listeners, "mousedown", { pointerId: undefined, clientX: 460, clientY: 345 });
  dispatchPointer(windowListeners, "mousemove", { pointerId: undefined, clientX: 510, clientY: 345 });
  assert.equal(engine.getState().points[0].x, "1");
  dispatchPointer(windowListeners, "mouseup", { pointerId: undefined });
  assert.equal(canvas.classList.contains("mf-equation-canvas-dragging"), false);
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
