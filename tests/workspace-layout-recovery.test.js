"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/workspace.css"), "utf8");

test("workspace DOM keeps the three semantic panels and Graph Designs controls on the right", () => {
  const workspace = html.slice(html.indexOf("MAIN WORKSPACE"), html.indexOf("E. BOTTOM PANEL"));
  const left = workspace.indexOf('<aside class="mf-side-panel mf-left-panel" id="mfLeftPanel"');
  const center = workspace.indexOf('<section class="mf-canvas-area" id="mfCanvasArea"');
  const right = workspace.indexOf('<aside class="mf-side-panel mf-right-panel" id="mfRightPanel"');
  assert.ok(left >= 0 && left < center && center < right, "left, center, and right panels should be siblings in that order");
  assert.ok(workspace.slice(right).includes('id="mfGraphDesignControls"'));
  assert.ok(workspace.slice(right).includes('id="mfPropertiesContainer"'));
  assert.equal((html.match(/id="mfRightPanel"/g) || []).length, 1);
});

test("desktop workspace has a bounded center row and a non-wrapping scrollable generator row", () => {
  assert.match(css, /\.mf-workspace-body\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/s);
  const stageRule = css.match(/\.mf-canvas-stage\s*\{([^}]*)\}/s)?.[1] || "";
  assert.match(stageRule, /height:\s*auto/);
  assert.match(stageRule, /min-height:\s*0/);
  assert.match(css, /\.mf-generator-toolbar \.mf-tool-list\s*\{[^}]*flex-direction:\s*row;[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.mf-panel-content\s*\{[^}]*overflow-y:\s*auto/s);
});
