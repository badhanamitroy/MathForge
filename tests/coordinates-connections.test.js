"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/tools/coordinates-tool.js"), "utf8");

function coordinatesApi() {
  const window = { drawGraphPaper() {}, drawInfiniteAxes() {} };
  const document = { getElementById() { return null; } };
  vm.runInNewContext(source, { window, document, Math, Number, String, Array, Object, JSON, Date, Set, Map, CustomEvent: class {} }, { filename: "coordinates-tool.js" });
  return window.MathForgeCoordinates;
}

function point(id, label, x, y) { return { id, label, x, y, xRaw: String(x), yRaw: String(y) }; }

test("new points remain independent for one, two, three, and many points", () => {
  const engine = coordinatesApi().createEngine();
  const set = engine.getActiveSet();
  for (let i = 1; i <= 40; i++) {
    set.points.push(point(`p${i}`, `P${i}`, i, -i));
    assert.equal(engine.state.connections.length, 0);
    assert.equal(engine.state.closedShapes.length, 0);
  }
  assert.equal(engine.state.fillEnabled, false);
  assert.equal(set.renderOptions.polygon.visible, false);
});

test("connections use point IDs, allow any independent pair, and reject duplicates", () => {
  const engine = coordinatesApi().createEngine();
  engine.state.pointSets[0].points = [point("A-id", "A", 1, 2), point("B-id", "B", 3, 4), point("C-id", "C", -2, 5)];
  const add = engine.addConnection.bind(engine);
  assert.equal(add({ setId: engine.state.pointSets[0].id, pointId: "A-id" }, { setId: engine.state.pointSets[0].id, pointId: "C-id" }).ok, true);
  assert.equal(add({ setId: engine.state.pointSets[0].id, pointId: "B-id" }, { setId: engine.state.pointSets[0].id, pointId: "C-id" }).ok, true);
  assert.equal(add({ setId: engine.state.pointSets[0].id, pointId: "C-id" }, { setId: engine.state.pointSets[0].id, pointId: "A-id" }).ok, false);
  assert.deepEqual(Array.from(engine.state.connections, (line) => [line.startPointId, line.endPointId]), [["A-id", "C-id"], ["B-id", "C-id"]]);
  assert.equal(add({ setId: engine.state.pointSets[0].id, pointId: "A-id" }, { setId: engine.state.pointSets[0].id, pointId: "A-id" }).ok, false);
});

test("Connect Points selects only existing points, stays active for more segments, and cancels cleanly", () => {
  const engine = coordinatesApi().createEngine();
  const set = engine.getActiveSet();
  set.points = [point("a", "A", 0, 0), point("b", "B", 2, 0), point("c", "C", 1, 2)];
  engine.state.connectionMode = true;
  assert.equal(engine.selectConnectionPoint(null).ok, false, "empty canvas is not a point selection");
  assert.equal(engine.selectConnectionPoint({ setId: set.id, pointId: "a" }).started, true);
  assert.equal(engine.state.connections.length, 0);
  assert.equal(engine.selectConnectionPoint({ setId: set.id, pointId: "b" }).ok, true);
  assert.equal(engine.state.connections.length, 1);
  assert.equal(engine.state.connectionMode, true, "mode remains active for another pair");
  assert.equal(engine.selectConnectionPoint({ setId: set.id, pointId: "b" }).started, true);
  engine.cancelConnection();
  assert.equal(engine.state.connectionMode, false);
  assert.equal(engine.state.connectionStart, null);
  assert.equal(engine.state.connections.length, 1);
});

test("closed shapes require explicit closure and at least three distinct point IDs", () => {
  const engine = coordinatesApi().createEngine();
  const set = engine.getActiveSet();
  set.points = [point("a", "A", 0, 0), point("b", "B", 2, 0)];
  assert.equal(engine.closePointSet(set).ok, false);
  set.points.push(point("c", "C", 1, 2));
  const closed = engine.closePointSet(set);
  assert.equal(closed.ok, true);
  assert.deepEqual(Array.from(closed.shape.pointIds), ["a", "b", "c"]);
  assert.equal(engine.state.fillEnabled, false);
  assert.equal(engine.closePointSet(set).ok, false);
});

test("pruning a deleted point removes its connections and invalid closed shapes", () => {
  const engine = coordinatesApi().createEngine();
  const set = engine.getActiveSet();
  set.points = [point("a", "A", 0, 0), point("b", "B", 2, 0), point("c", "C", 1, 2)];
  engine.addConnection({ setId: set.id, pointId: "a" }, { setId: set.id, pointId: "b" });
  engine.closePointSet(set);
  set.points = set.points.filter((p) => p.id !== "c");
  engine.prunePointReferences(set);
  assert.equal(engine.state.connections.length, 1);
  assert.equal(engine.state.closedShapes.length, 0);
  assert.equal(set.points.length, 2);
});

test("visibility and fill are stored independently and serialized with ID references", () => {
  const api = coordinatesApi();
  const engine = api.createEngine();
  const set = engine.getActiveSet();
  set.points = [point("a", "A", 0, 0), point("b", "B", 2, 0), point("c", "C", 1, 2)];
  engine.addConnection({ setId: set.id, pointId: "a" }, { setId: set.id, pointId: "b" });
  engine.closePointSet(set);
  engine.state.connectionsVisible = false;
  engine.state.fillEnabled = true;
  engine.state.fillColor = "#ff0000";
  engine.state.fillOpacity = 0.4;
  const saved = JSON.parse(JSON.stringify(engine.state));
  assert.equal(saved.connectionsVisible, false);
  assert.equal(saved.fillEnabled, true);
  assert.equal(saved.fillColor, "#ff0000");
  assert.equal(saved.fillOpacity, 0.4);
  assert.equal(saved.connections[0].startPointId, "a");
  assert.equal(saved.closedShapes[0].pointIds.length, 3);
  api.adapter.setState(saved);
  const reopened = api.adapter.getState();
  assert.equal(reopened.connectionsVisible, false);
  assert.equal(reopened.fillEnabled, true);
  assert.equal(reopened.connections[0].startPointId, "a");
  assert.deepEqual(Array.from(reopened.closedShapes[0].pointIds), ["a", "b", "c"]);
});

test("renderer draws no implicit links or fills, and line visibility leaves point markers visible", () => {
  const api = coordinatesApi();
  const engine = api.createEngine();
  const set = engine.getActiveSet();
  set.points = [point("a", "A", 0, 0), point("b", "B", 2, 0), point("c", "C", 1, 2)];
  engine.state.gridVisible = false;
  engine.state.xAxisVisible = false;
  engine.state.yAxisVisible = false;
  engine.state.showLabels = false;
  const calls = { lineTo: 0, arcs: 0, closedFills: [], closed: false };
  const ctx = {
    save() {}, restore() {}, beginPath() { this.closed = false; }, closePath() { this.closed = true; },
    moveTo() {}, lineTo() { calls.lineTo++; }, stroke() {}, setLineDash() {}, fillRect() {}, fillText() {},
    translate() {}, rect() {}, arc() { calls.arcs++; }, fill() { if (this.closed) calls.closedFills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
    clearRect() {}, measureText(text) { return { width: String(text).length * 7 }; }
  };
  const canvas = { width: 400, height: 300, clientWidth: 400, clientHeight: 300, getContext() { return ctx; } };
  engine.draw(canvas);
  assert.equal(calls.lineTo, 0, "three points alone do not create a path");
  assert.equal(calls.closedFills.length, 0, "three points alone are not filled");
  calls.arcs = 0;
  engine.addConnection({ setId: set.id, pointId: "a" }, { setId: set.id, pointId: "b" });
  engine.state.connectionsVisible = false;
  engine.draw(canvas);
  assert.equal(calls.lineTo, 0, "hidden connections do not render");
  assert.equal(calls.arcs, 3, "points remain visible while connections are hidden");
  engine.state.connectionsVisible = true;
  engine.state.fillEnabled = true;
  engine.state.fillColor = "#abcdef";
  engine.state.fillOpacity = 0.35;
  engine.closePointSet(set);
  calls.lineTo = 0;
  engine.draw(canvas);
  assert.equal(calls.lineTo, 2, "polygon boundary already covers the matching connection without drawing a duplicate edge");
  assert.deepEqual(calls.closedFills, [{ color: "#abcdef", alpha: 0.35 }]);
});

test("version 1 project state gets stable point IDs and migrates saved polygons", () => {
  const api = coordinatesApi();
  const legacy = {
    pointSets: [{ id: "set-old", inputText: "A(0,0)\nB(2,0)\nC(1,2)", points: [
      { label: "A", x: 0, y: 0 }, { label: "B", x: 2, y: 0 }, { label: "C", x: 1, y: 2 }
    ], renderOptions: { polygon: { visible: true, fillVisible: true, fillColor: "#123456", fillOpacity: 0.3 } } }],
    activeSetId: "set-old"
  };
  api.adapter.setState(legacy);
  const state = api.adapter.getState();
  assert.ok(state.pointSets[0].points.every((p) => p.id));
  assert.equal(state.closedShapes.length, 1);
  assert.deepEqual(Array.from(state.closedShapes[0].pointIds), state.pointSets[0].points.map((p) => p.id));
  assert.equal(state.fillEnabled, true);
  assert.equal(state.pointSets[0].renderOptions.polygon.visible, false);
});
