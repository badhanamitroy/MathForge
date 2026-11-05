"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/core/equation-math.js"), "utf8");
function loadMath() {
  const window = {};
  vm.runInNewContext(source, { window, Math, Number, String, Object, Array, Error }, { filename: "equation-math.js" });
  return window.MathForgeEquationMath;
}

test("safe parser compiles linear, quadratic, cubic, square-root and general single-variable functions", () => {
  const math = loadMath();
  const cases = [
    ["y = 2x + 3", 2, 7], ["y=x^2", 3, 9], ["y=x^3", 2, 8], ["y=sqrt(x)", 9, 3],
    ["y = abs(x) + exp(0)", -2, 3], ["y=ln(e^x)", 2, 2], ["y=log10(100)", 0, 2]
  ];
  cases.forEach(([sourceText, x, expected]) => {
    const compiled = math.compile(sourceText);
    assert.equal(compiled.kind, "explicit-y", sourceText);
    assert.ok(Math.abs(compiled.evaluateRight(x, 0) - expected) < 1e-9, sourceText);
  });
});

test("implicit conics compile without unsafe evaluation", () => {
  const math = loadMath();
  const cases = [
    ["x^2 + y^2 = 25", 3, 4, 0],
    ["x^2/9 + y^2/4 = 1", 3, 0, 0],
    ["y^2 = 4x", 1, 2, 0],
    ["x^2/9 - y^2/4 = 1", 3, 0, 0]
  ];
  cases.forEach(([sourceText, x, y, expected]) => {
    const compiled = math.compile(sourceText);
    assert.equal(compiled.kind, "implicit", sourceText);
    assert.equal(compiled.evaluate(x, y), expected, sourceText);
  });
  assert.throws(() => math.compile("window.alert(1)"), /Unsupported (?:name|character)/);
  assert.throws(() => math.compile("y = x; alert(1)"), /Unsupported character/);
});

test("trigonometric functions and combinations use radians", () => {
  const math = loadMath();
  const sin = math.compile("y=sin(x)");
  const combined = math.compile("y=2sin(x)+cos(x)");
  assert.ok(Math.abs(sin.evaluateRight(Math.PI / 2, 0) - 1) < 1e-12);
  assert.ok(Math.abs(combined.evaluateRight(0, 0) - 1) < 1e-12);
  assert.equal(math.compile("y=tan(x)").kind, "explicit-y");
});

test("strict and inclusive inequalities evaluate the correct shaded side", () => {
  const math = loadMath();
  const cases = [
    ["y > 2x + 1", 2, 6, true], ["y > 2x + 1", 2, 4, false],
    ["y <= x^2", 2, 4, true], ["y <= x^2", 2, 5, false],
    ["x^2 + y^2 <= 16", 0, 4, true], ["x^2 + y^2 <= 16", 0, 5, false]
  ];
  cases.forEach(([sourceText, x, y, expected]) => assert.equal(math.compile(sourceText).test(x, y), expected, sourceText));
  assert.equal(math.compile("y < x").operator, "<");
  assert.equal(math.compile("y >= x").operator, ">=");
});

test("vertical explicit relations are classified for inverse plotting", () => {
  const math = loadMath();
  assert.equal(math.compile("x = y^2").kind, "explicit-x");
  assert.equal(math.compile("y^2 = x").kind, "explicit-x-reversed");
  assert.equal(math.compile("x = y^2").evaluateRight(0, 3), 9);
  assert.equal(math.compile("y^2 = x").evaluateLeft(0, 3), 9);
});
