"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/core/graph-scale.js"), "utf8");
function scaleApi() {
  const window = {};
  vm.runInNewContext(source, { window, Number, Math }, { filename: "graph-scale.js" });
  return window.MathForgeGraphScale;
}

test("K/N conversion maps grid squares to mathematical values and back", () => {
  const scale = scaleApi();
  const examples = [[1, 1, 1, 1], [2, 1, 1, 0.5], [5, 1, 1, 0.2], [5, 1, 8, 1.6], [2, 5, 3, 7.5], [5, 2, 10, 4], [4, 3, 2, 1.5]];
  for (const [k, n, squares, expected] of examples) {
    assert.ok(Math.abs(scale.squaresToValue(squares, k, n) - expected) < 1e-12);
    assert.ok(Math.abs(scale.valueToSquares(expected, k, n) - squares) < 1e-12);
  }
});

test("K/N conversion preserves negative decimals, independent axes, and pixel inverses", () => {
  const scale = scaleApi();
  const xRate = scale.valueToSquares(-2.75, 5, 2);
  const yRate = scale.valueToSquares(3.25, 2, 5);
  assert.equal(xRate, -6.875);
  assert.equal(yRate, 1.3);
  assert.ok(Math.abs(scale.pixelsToValue(scale.valueToPixels(-2.75, 5, 2, 10, 1.4), 5, 2, 10, 1.4) + 2.75) < 1e-12);
  assert.equal(scale.validScale(3, 0.25), true);
  for (const invalid of [[0, 1], [-1, 1], [1.5, 1], [1, 0], [1, -1], [1, Infinity], [NaN, 1]]) {
    assert.equal(scale.validScale(invalid[0], invalid[1]), false);
  }
});

test("projects without K/N retain the engine-supplied legacy scales", () => {
  const scale = scaleApi();
  const window = { MathForgeGraphDesignSettings: { getState() { return { axisScale: null }; } } };
  const sourceContext = { window, Number, Math };
  vm.runInNewContext(source, sourceContext, { filename: "graph-scale.js" });
  assert.equal(window.MathForgeGraphScale.effectiveRate("x", 5), 5);
  assert.equal(window.MathForgeGraphScale.effectiveRate("y", 1), 1);
  assert.equal(scale.validScale(5, 1), true);
});

test("shared Ogive/Histogram mapping and inverse honor independent axis rates and an axis break", () => {
  const window = {};
  const document = { getElementById() { return null; } };
  const common = fs.readFileSync(path.join(__dirname, "../assets/js/common.js"), "utf8");
  vm.runInNewContext(common, { window, document, Number, Math, String, Array, Object, Event: class {} }, { filename: "common.js" });
  const params = { ox: 100, oy: 120, minorPx: 10, xSmallPerUnit: 2.5, ySmallPerUnit: 0.4, zoom: 1.5,
    breakFrom: 0, breakTo: 4, breakGapPx: 75 };
  for (const point of [[-2.25, -3.5], [0, 0], [4, 5.75], [8.5, 2.25]]) {
    const pixel = window.worldToCanvas(point[0], point[1], params);
    const inverse = window.canvasToWorld(pixel[0], pixel[1], params);
    assert.ok(Math.abs(inverse[0] - point[0]) < 1e-10);
    assert.ok(Math.abs(inverse[1] - point[1]) < 1e-10);
  }
});

test("infinite axes span the visible canvas, place arrows at all endpoints, and hide O offscreen", () => {
  const window = {};
  const document = { getElementById() { return null; } };
  const common = fs.readFileSync(path.join(__dirname, "../assets/js/common.js"), "utf8");
  vm.runInNewContext(common, { window, document, Number, Math, String, Array, Object, Event: class {} }, { filename: "common.js" });
  const calls = [];
  const ctx = new Proxy({}, { set(target, key, value) { target[key] = value; return true; } });
  ["save", "restore", "beginPath", "stroke", "fill", "closePath"].forEach((name) => { ctx[name] = () => calls.push([name]); });
  ["moveTo", "lineTo"].forEach((name) => { ctx[name] = (x, y) => calls.push([name, x, y]); });
  ctx.fillText = (text, x, y) => calls.push(["text", text, x, y]);
  const size = { width: 200, height: 120 };
  const visible = window.drawInfiniteAxes(ctx, size, 100, 60, {});
  assert.deepEqual(JSON.parse(JSON.stringify(visible)), { xVisible: true, yVisible: true, originVisible: true });
  assert.ok(calls.some((entry) => entry[0] === "moveTo" && entry[1] === 9 && entry[2] === 60));
  assert.ok(calls.some((entry) => entry[0] === "lineTo" && entry[1] === 191 && entry[2] === 60));
  assert.ok(calls.some((entry) => entry[0] === "moveTo" && entry[1] === 100 && entry[2] === 111));
  assert.ok(calls.some((entry) => entry[0] === "lineTo" && entry[1] === 100 && entry[2] === 9));
  assert.deepEqual(calls.filter((entry) => entry[0] === "text").map((entry) => entry[1]), ["X′", "X", "Y", "Y′", "O"]);

  calls.length = 0;
  const clipped = window.drawInfiniteAxes(ctx, size, -20, 60, {});
  assert.deepEqual(JSON.parse(JSON.stringify(clipped)), { xVisible: true, yVisible: false, originVisible: false });
  assert.deepEqual(calls.filter((entry) => entry[0] === "text").map((entry) => entry[1]), ["X′", "X"]);
  assert.equal(calls.some((entry) => entry[0] === "text" && entry[1] === "O"), false);

  calls.length = 0;
  const horizontalClipped = window.drawInfiniteAxes(ctx, size, 100, -20, {});
  assert.deepEqual(JSON.parse(JSON.stringify(horizontalClipped)), { xVisible: false, yVisible: true, originVisible: false });
  assert.deepEqual(calls.filter((entry) => entry[0] === "text").map((entry) => entry[1]), ["Y", "Y′"]);
});

test("grid major lines and axes share the transformed origin without treating major intervals as units", () => {
  const window = {};
  const document = { getElementById() { return null; } };
  const common = fs.readFileSync(path.join(__dirname, "../assets/js/common.js"), "utf8");
  vm.runInNewContext(common, { window, document, Number, Math, String, Array, Object, Event: class {} }, { filename: "common.js" });
  const scale = scaleApi();
  const calls = [];
  const ctx = new Proxy({}, { set(target, key, value) { target[key] = value; return true; } });
  ["save", "restore", "beginPath", "stroke", "fill", "closePath", "fillRect"].forEach((name) => { ctx[name] = () => {}; });
  ["moveTo", "lineTo"].forEach((name) => { ctx[name] = (x, y) => calls.push([name, x, y]); });
  const canvas = { width: 200, height: 120 };
  const ox = 73.5, oy = 42.25, minorPx = 8, majorEvery = 5;
  window.drawGraphPaper(ctx, canvas, ox, oy, minorPx, majorEvery, 1);
  assert.ok(calls.some(([name, x, y]) => name === "moveTo" && x === ox && y === 0));
  assert.ok(calls.some(([name, x, y]) => name === "moveTo" && x === 0 && y === oy));
  assert.equal(scale.squaresToValue(majorEvery, 5, 2), 2);
  assert.equal(scale.valueToSquares(2, 5, 2), majorEvery);
});

test("Coordinates origin and inverse transform use independent K/N rates after zoom and pan", () => {
  const state = { axisScale: { x: { k: 5, n: 2 }, y: { k: 2, n: 5 } } };
  const window = {
    MathForgeGraphDesignSettings: { getState() { return state; } },
    MathForgeGraphScale: { effectiveRate(axis, fallback) { const value = state.axisScale[axis]; return value ? value.k / value.n : fallback; } }
  };
  const document = { getElementById() { return null; } };
  const source = fs.readFileSync(path.join(__dirname, "../assets/js/tools/coordinates-tool.js"), "utf8");
  vm.runInNewContext(source, { window, document, Math, Number, String, Array, Object, JSON, Date, CustomEvent: class {} }, { filename: "coordinates-tool.js" });
  const transform = window.MathForgeCoordinates.makeTransform({ minX: -10, maxX: 10, minY: -10, maxY: 10 }, 40, 400, 300, 1.5, { x: 13, y: -9 });
  const origin = [transform.xToPx(0), transform.yToPx(0)];
  assert.ok(Number.isFinite(origin[0]) && Number.isFinite(origin[1]));
  assert.ok(Math.abs(transform.xToPx(2) - origin[0] - 2 * transform.scaleX * 1.5) < 1e-10);
  assert.ok(Math.abs(origin[1] - transform.yToPx(3) - 3 * transform.scaleY * 1.5) < 1e-10);
  assert.ok(Math.abs(transform.pxToX(transform.xToPx(-3.25)) + 3.25) < 1e-10);
  assert.ok(Math.abs(transform.pxToY(transform.yToPx(2.75)) - 2.75) < 1e-10);
});

test("all four workspace engines consume the shared K/N source of truth", () => {
  const files = [
    "../assets/js/tools/coordinates-tool.js",
    "../assets/js/tools/equation-plotter-engine.js",
    "../assets/js/tools/ogive-engine.js",
    "../assets/js/tools/histogram-engine.js"
  ];
  const sources = files.map((file) => fs.readFileSync(path.join(__dirname, file), "utf8"));
  const common = fs.readFileSync(path.join(__dirname, "../assets/js/common.js"), "utf8");
  assert.match(sources[0], /sharedScale\.x\.k\s*\/\s*sharedScale\.x\.n/);
  assert.match(sources[0], /sharedScale\.y\.k\s*\/\s*sharedScale\.y\.n/);
  assert.match(sources[0], /drawInfiniteAxes\(/);
  assert.match(sources[1], /drawInfiniteAxes\(/);
  assert.match(common, /window\.drawAxes[\s\S]*?window\.drawInfiniteAxes\(/);
  assert.match(sources[2], /drawAxes\(ctx, cv/);
  assert.match(sources[3], /drawAxes\(ctx, cv/);
  for (const source of sources.slice(1)) {
    assert.match(source, /MathForgeGraphScale/);
    assert.match(source, /sharedAxisRate\("x"/);
    assert.match(source, /sharedAxisRate\("y"/);
  }
});
