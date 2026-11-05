"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const calculationsSource = fs.readFileSync(path.join(root, "assets/js/core/pie-chart-calculations.js"), "utf8");
const engineSource = fs.readFileSync(path.join(root, "assets/js/tools/pie-chart-engine.js"), "utf8");

function loadCalculations() {
  const window = {};
  vm.runInNewContext(calculationsSource, { window, Number, String, Math, Object, Array }, { filename: "pie-chart-calculations.js" });
  return window.MathForgePieCalculations;
}

function loadPieEngine() {
  const calculations = loadCalculations();
  let adapter;
  function fakeNode() {
    return {
      style: { setProperty() {} }, classList: { toggle() {}, contains() { return false; } }, listeners: {}, children: [], parentNode: null,
      addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }, removeEventListener() {},
      appendChild(child) { child.parentNode = this; this.children.push(child); }, removeChild(child) { this.children = this.children.filter((item) => item !== child); child.parentNode = null; },
      setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {}
    };
  }
  const nodes = {
    mfToolControlsContainer: fakeNode(), mfPropertiesContainer: fakeNode(), mfExportPngBtn: fakeNode()
  };
  const document = {
    getElementById(id) { return nodes[id] || null; },
    addEventListener() {}, removeEventListener() {}, activeElement: null,
    createElement(tag) {
      if (tag === "div") return fakeNode();
      if (tag !== "canvas") throw new Error("Unexpected element " + tag);
      return {
        width: 0, height: 0,
        getContext() { return { drawImage() {} }; },
        toBlob(callback, type) { callback(new Blob(["pie-png"], { type })); }
      };
    }
  };
  class MockImage { set src(value) { this._src = value; this.onload(); } }
  class MockDOMParser {
    parseFromString(markup) {
      const svgTag = markup.match(/<svg[^>]*>/)[0];
      return { documentElement: { getAttribute(name) { const match = svgTag.match(new RegExp(name + '="(\\d+)"')); return match && match[1]; } } };
    }
  }
  const url = { createObjectURL() { return "blob:pie-chart"; }, revokeObjectURL() {} };
  const window = {
    MathForgePieCalculations: calculations,
    MathForgeWorkspace: { registerTool(value) { adapter = value; } },
    MathForgeGraphDesignSettings: {
      getState() { return { background: "#ffffff", fontFamily: "Times New Roman", fontSizePt: 11, bold: false, fontColor: "#111827", lineColor: "#ffffff", lineWidth: 1 }; }
    }
  };
  vm.runInNewContext(engineSource, { window, document, Date, Math, Number, String, Object, Array, JSON, Blob, Promise, Image: MockImage, DOMParser: MockDOMParser, URL: url }, { filename: "pie-chart-engine.js" });
  return { adapter, window, calculations, nodes, fakeNode };
}

function validPieState(extra = {}) {
  return {
    title: "Fruit", unit: "kg", mode: "pie", numerals: "en",
    categories: [{ id: "a", name: "A", value: "2", color: "#2563eb" }, { id: "b", name: "B", value: "3", color: "#f97316" }],
    ...extra
  };
}

test("Pie calculations handle English and Bengali decimal numerals", () => {
  const math = loadCalculations();
  assert.equal(math.parseValue("12.5").value, 12.5);
  assert.equal(math.parseValue("১২.৫").value, 12.5);
  assert.equal(math.parseValue("−৩").status, "negative");
  assert.equal(math.parseValue("1x").status, "invalid");
  assert.equal(math.parseValue("").status, "empty");
  assert.equal(math.parseValue("০").status, "zero");
});

test("Pie calculations exclude empty and zero values and compute percentages and exact angles", () => {
  const math = loadCalculations();
  const result = math.calculate([
    { id: "a", name: "A", value: "1.5" },
    { id: "blank", name: "Blank", value: "" },
    { id: "zero", name: "Zero", value: "0" },
    { id: "b", name: "B", value: "3.5" }
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.categories.length, 2);
  assert.equal(result.total, 5);
  assert.deepEqual(Array.from(result.categories, (item) => Number(item.percentage.toFixed(1))), [30, 70]);
  assert.deepEqual(Array.from(result.categories, (item) => Number(item.exactAngle.toFixed(1))), [108, 252]);
  assert.equal(result.exactAngleTotal, 360);
  assert.equal(result.wholeAngleTotal, 360);
});

test("Pie calculations reject negative and malformed values and require two positive categories", () => {
  const math = loadCalculations();
  assert.equal(math.calculate([{ value: 2 }, { value: -1 }]).reason, "negative");
  assert.equal(math.calculate([{ value: 2 }, { value: "2x" }]).reason, "invalid");
  assert.equal(math.calculate([{ value: 0 }, { value: "" }]).reason, "insufficient");
  assert.equal(math.calculate([{ value: 4 }]).reason, "insufficient");
});

test("largest remainder allocation is deterministic and ties retain category order", () => {
  const math = loadCalculations();
  const exact = [120.4, 120.4, 119.2];
  assert.deepEqual(math.allocateWholeDegrees(exact), [121, 120, 119]);
  assert.deepEqual(math.allocateWholeDegrees(exact), [121, 120, 119]);
  const result = math.calculate(Array.from({ length: 7 }, (_, index) => ({ id: String(index), value: "1" })));
  assert.equal(result.wholeAngleTotal, 360);
  assert.deepEqual(Array.from(result.categories, (item) => item.wholeAngle), [52, 52, 52, 51, 51, 51, 51]);
});

test("native Pie tool renders accessible pie/donut SVG exports and supports more than eight colors", async () => {
  const { adapter } = loadPieEngine();
  const categories = Array.from({ length: 12 }, (_, index) => ({
    id: "c" + index, name: "Category " + index, value: index === 11 ? "0.01" : String(index + 1)
  }));
  adapter.setState({ title: "Sales & fruit", unit: "kg", mode: "donut", numerals: "en", categories });
  adapter.render();
  const svg = await adapter.export("svg");
  const markup = await svg.text();
  assert.equal(adapter.id, "pie-chart");
  assert.equal(adapter.getCalculation().valid, true);
  assert.equal(adapter.getCalculation().categories.length, 12);
  assert.match(markup, /<title id="pieSvgTitle">Sales &amp; fruit<\/title>/);
  assert.equal((markup.match(/class="pie-slice"/g) || []).length, 12);
  assert.ok((markup.match(/class="pie-percent-label"/g) || []).length < 12, "small slices omit in-slice labels");
  assert.match(markup, /Category 11/);
  assert.match(markup, /tabindex="0" focusable="true" role="img" aria-label=/);
  assert.match(markup, /class="pie-percent-label"/);
  assert.match(markup, /font-family="Times New Roman"/);
  assert.match(markup, />66\.01<\/text>/, "donut total is present in the center");
  assert.doesNotMatch(markup, /<iframe|axis|grid/);
  assert.match(adapter.getState().categories[8].color, /^#[0-9a-f]{6}$/i, "categories beyond the initial palette receive a deterministic color");
});

test("Pie mode omits a donut center and duplicate restored category IDs are repaired", async () => {
  const { adapter } = loadPieEngine();
  adapter.setState({
    title: "Simple pie", mode: "pie", categories: [
      { id: "duplicate", name: "A", value: "2" },
      { id: "duplicate", name: "B", value: "3" }
    ]
  });
  const ids = Array.from(adapter.getState().categories, (item) => item.id);
  assert.notEqual(ids[0], ids[1]);
  adapter.render();
  const markup = await (await adapter.export("svg")).text();
  assert.equal((markup.match(/class="pie-slice"/g) || []).length, 2);
  assert.doesNotMatch(markup, />5<\/text>/);
});

test("Pie integration uses its independent project state and delegates native export", () => {
  const { adapter } = loadPieEngine();
  adapter.setState({
    title: "Fruit", unit: "kg", mode: "pie", numerals: "bn", holeRatio: 0.61,
    categories: [{ id: "mango", name: "আম", value: "২", color: "#2563eb" }, { id: "banana", name: "কলা", value: "৩", color: "#f97316" }]
  });
  const state = adapter.getState();
  assert.equal(state.mode, "pie");
  assert.equal(state.numerals, "bn");
  assert.equal(state.holeRatio, 0.61);
  assert.deepEqual(Array.from(state.categories, (item) => item.id), ["mango", "banana"]);
  assert.match(fs.readFileSync(path.join(root, "assets/js/project-manager.js"), "utf8"), /"histogram-polygon", "pie-chart"/);
  assert.match(fs.readFileSync(path.join(root, "assets/js/project-manager.js"), "utf8"), /exportActiveTool\(format\)/);
});

test("Pie PNG export rasterizes the same SVG composition", async () => {
  const { adapter } = loadPieEngine();
  adapter.setState({ title: "Fruit", unit: "kg", mode: "donut", categories: [{ name: "A", value: "2" }, { name: "B", value: "3" }] });
  adapter.render();
  const png = await adapter.export("png");
  assert.equal(png.type, "image/png");
  assert.equal(await png.text(), "pie-png");
});

test("Pie typography preferences have safe defaults and independent bounds for older projects", () => {
  const { adapter } = loadPieEngine();
  const limits = [
    ["slicePercentageFontSize", 8, 28],
    ["donutCenterLabelFontSize", 8, 24],
    ["donutCenterValueFontSize", 12, 40]
  ];
  for (const [key, minimum, maximum] of limits) {
    adapter.setState(validPieState({ [key]: -100 }));
    assert.equal(adapter.getState()[key], minimum, key + " minimum");
    adapter.setState(validPieState({ [key]: 100 }));
    assert.equal(adapter.getState()[key], maximum, key + " maximum");
  }
  adapter.setState({ categories: validPieState().categories });
  assert.deepEqual({
    slice: adapter.getState().slicePercentageFontSize,
    label: adapter.getState().donutCenterLabelFontSize,
    value: adapter.getState().donutCenterValueFontSize,
    chart: adapter.getState().showChart,
    table: adapter.getState().showCalculationTable,
    steps: adapter.getState().showDrawingSteps
  }, { slice: 12, label: 12, value: 20, chart: true, table: true, steps: true });
});

test("each Pie typography preference changes independently", async () => {
  const { adapter } = loadPieEngine();
  const cases = [
    ["slicePercentageFontSize", 16, /class="pie-percent-label"[^>]*font-size="16"/, /class="pie-donut-center-label"[^>]*font-size="12"/, /class="pie-donut-center-value"[^>]*font-size="20"/],
    ["donutCenterLabelFontSize", 18, /class="pie-percent-label"[^>]*font-size="12"/, /class="pie-donut-center-label"[^>]*font-size="18"/, /class="pie-donut-center-value"[^>]*font-size="20"/],
    ["donutCenterValueFontSize", 32, /class="pie-percent-label"[^>]*font-size="12"/, /class="pie-donut-center-label"[^>]*font-size="12"/, /class="pie-donut-center-value"[^>]*font-size="32"/]
  ];
  for (const [key, value, slicePattern, labelPattern, centerValuePattern] of cases) {
    adapter.setState(validPieState({ mode: "donut", [key]: value }));
    adapter.render();
    const markup = await (await adapter.export("svg")).text();
    assert.match(markup, slicePattern);
    assert.match(markup, labelPattern);
    assert.match(markup, centerValuePattern);
  }
});

test("Pie and Donut SVGs use the selected Pie-only font sizes", async () => {
  const { adapter } = loadPieEngine();
  adapter.setState(validPieState({ mode: "pie", slicePercentageFontSize: 17 }));
  adapter.render();
  let markup = await (await adapter.export("svg")).text();
  assert.match(markup, /class="pie-percent-label"[^>]*font-size="17"/);
  adapter.setState(validPieState({ mode: "donut", slicePercentageFontSize: 18, donutCenterLabelFontSize: 15, donutCenterValueFontSize: 31 }));
  adapter.render();
  markup = await (await adapter.export("svg")).text();
  assert.match(markup, /class="pie-percent-label"[^>]*font-size="18"/);
  assert.match(markup, /class="pie-donut-center-label"[^>]*font-size="15"/);
  assert.match(markup, /class="pie-donut-center-value"[^>]*font-size="31"/);
  assert.match(markup, />Total<\/text>/);
});

test("Pie output visibility supports every combination without rendering hidden sections", () => {
  const { adapter, fakeNode } = loadPieEngine();
  const container = fakeNode();
  adapter.setState(validPieState());
  adapter.mount(container);
  const rootNode = container.children[0];
  const cases = [
    [{ showChart: true, showCalculationTable: true, showDrawingSteps: true }, ["pie-chart-output-section", "pie-calculation-output-section", "pie-drawing-output-section"]],
    [{ showChart: false, showCalculationTable: true, showDrawingSteps: true }, ["pie-calculation-output-section", "pie-drawing-output-section"]],
    [{ showChart: true, showCalculationTable: false, showDrawingSteps: true }, ["pie-chart-output-section", "pie-drawing-output-section"]],
    [{ showChart: true, showCalculationTable: true, showDrawingSteps: false }, ["pie-chart-output-section", "pie-calculation-output-section"]],
    [{ showChart: true, showCalculationTable: false, showDrawingSteps: false }, ["pie-chart-output-section"]],
    [{ showChart: false, showCalculationTable: true, showDrawingSteps: false }, ["pie-calculation-output-section"]],
    [{ showChart: false, showCalculationTable: false, showDrawingSteps: true }, ["pie-drawing-output-section"]]
  ];
  for (const [settings, expected] of cases) {
    adapter.setState(validPieState(settings));
    const markup = rootNode.innerHTML;
    for (const token of ["pie-chart-output-section", "pie-calculation-output-section", "pie-drawing-output-section"]) {
      assert.equal(markup.includes(token), expected.includes(token), token + " visibility for " + JSON.stringify(settings));
    }
    assert.equal(adapter.getCalculation().valid, true, "calculations continue when chart is hidden");
  }
  adapter.setState(validPieState({ showChart: false, showCalculationTable: false, showDrawingSteps: false }));
  assert.match(rootNode.innerHTML, /No output sections are selected/);
  assert.doesNotMatch(rootNode.innerHTML, /pie-chart-output-section|pie-calculation-output-section|pie-drawing-output-section/);
  assert.throws(() => adapter.export("svg"), /section is hidden/);
  adapter.unmount();
});

test("Pie visibility and font settings survive state save and restore", () => {
  const { adapter } = loadPieEngine();
  const selected = validPieState({
    mode: "donut", slicePercentageFontSize: 19, donutCenterLabelFontSize: 16, donutCenterValueFontSize: 34,
    showChart: false, showCalculationTable: true, showDrawingSteps: false
  });
  adapter.setState(selected);
  const saved = adapter.getState();
  const { adapter: reopened } = loadPieEngine();
  reopened.setState(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.getState())), JSON.parse(JSON.stringify(saved)));
});
