"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/js/project-manager.js"), "utf8");

function managerHarness() {
  const elements = new Map();
  const listeners = new Map();
  let downloadBlob = null;
  let activeTool = "histogram-polygon";
  let toolStates = { "histogram-polygon": { rows: [{ lo: -2.5, hi: 1.25, frequency: 4 }] } };
  let designState = { axisScale: { x: { k: 5, n: 1 }, y: { k: 2, n: 5 } } };
  const stored = new Map();

  function element(id) {
    if (!elements.has(id)) {
      const entry = {
        id, value: id === "mfSaveAsName" ? "Local backup" : "", textContent: "", innerHTML: "", disabled: false, style: {},
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener(type, callback) { listeners.set(id + ":" + type, callback); },
        removeEventListener(type) { listeners.delete(id + ":" + type); },
        focus() {}, setAttribute() {}, appendChild(child) { this.child = child; }, remove() {}, click() { if (id === "download-link") return; }
      };
      elements.set(id, entry);
    }
    return elements.get(id);
  }

  const document = {
    readyState: "complete",
    body: { appendChild(link) { if (link.download) listeners.set("download", link); } },
    getElementById: element,
    createElement(tag) { return element(tag === "a" ? "download-link" : "created-" + tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, callback) { listeners.set("document:" + type, callback); },
    removeEventListener(type) { listeners.delete("document:" + type); }
  };
  const workspace = {
    getState() { return { activeTool }; },
    getToolStates() { return JSON.parse(JSON.stringify(toolStates)); },
    selectTool(id) { activeTool = id; },
    resetTools() { toolStates = {}; },
    setToolStates(value) { toolStates = JSON.parse(JSON.stringify(value)); }
  };
  const window = {
    location: { pathname: "/index.html" }, navigator: {}, MathForgeWorkspace: workspace,
    MathForgeGraphDesignSettings: {
      getState() { return JSON.parse(JSON.stringify(designState)); },
      setState(value) { designState = JSON.parse(JSON.stringify(value)); },
      reset() { designState = {}; }
    },
    MathForgeProjectStorage: {
      open: async () => ({}),
      async get(id) { return stored.get(id) || null; },
      async getAll() { return Array.from(stored.values()); },
      async putMany(projects) { for (const project of projects) stored.set(project.id, JSON.parse(JSON.stringify(project))); }
    },
    MathForgeProjectFileAdapter: { getCurrentFileHandle() { return null; }, setCurrentFileHandle() {}, setProjectManager() {} },
    clearTimeout() {}, setTimeout(callback) { callback(); return 1; }, addEventListener() {}, close() {}
  };
  const url = { createObjectURL(blob) { downloadBlob = blob; return "blob:mathforge-test"; }, revokeObjectURL() {} };
  element("mfStatusMessage");
  vm.runInNewContext(source, { window, document, URL: url, Blob, Uint8Array, Date, Math, JSON, Promise, Error, console,
    Event: class { constructor(type) { this.type = type; } } }, { filename: "project-manager.js" });
  return {
    manager: window.MathForgeProjectManager,
    stored,
    elements,
    workspace,
    getDownload: () => downloadBlob,
    getDesign: () => designState,
    getToolStates: () => toolStates,
    setWorkspaceState(tool, states) { activeTool = tool; toolStates = states; },
    setDesignState(value) { designState = value; },
    acceptDialog(value) {
      element("mfDialogField").child.value = value;
      listeners.get("mfDialogConfirm:click")();
    }
  };
}

test("Save File As fallback downloads a version-1 project, then that project can be opened and saved intact", async () => {
  const harness = managerHarness();
  await harness.manager.ready;
  await harness.manager.saveAs();
  const download = harness.getDownload();
  assert.ok(download, "Save As fallback created a project download");
  const downloadedProject = JSON.parse(await download.text());
  assert.equal(downloadedProject.format, "mathforge-project");
  assert.equal(downloadedProject.version, 1);
  assert.equal(downloadedProject.name, "Local backup");
  assert.deepEqual(downloadedProject.graphDesignSettings.axisScale, { x: { k: 5, n: 1 }, y: { k: 2, n: 5 } });
  assert.equal(harness.elements.get("mfStorageNotice").textContent, "Project downloaded");
  assert.equal(harness.elements.get("mfStatusMessage").textContent, "");

  assert.equal(await harness.manager.loadProjectText(await download.text(), "Local backup.mathforge", null), true);
  await harness.manager.save(true);
  assert.deepEqual(harness.getToolStates(), downloadedProject.toolStates);
  assert.deepEqual(harness.getDesign().axisScale, downloadedProject.graphDesignSettings.axisScale);
  const savedAgain = Array.from(harness.stored.values()).find((project) => project.name === "Local backup");
  assert.ok(savedAgain);
  assert.deepEqual(savedAgain.toolStates, downloadedProject.toolStates);
  assert.equal(harness.elements.get("mfStorageNotice").textContent, "Saved locally");
});

test("queued saves retain graph switches, K/N changes, and a renamed project", async () => {
  const harness = managerHarness();
  await harness.manager.ready;
  harness.setWorkspaceState("coordinates-graph", {
    "coordinates-graph": { pointSets: [{ points: [{ x: -3.5, y: 2.25 }] }] }
  });
  harness.setDesignState({ axisScale: { x: { k: 7, n: 2 }, y: { k: 3, n: 4 } } });

  await Promise.all([harness.manager.save(true), harness.manager.save(true)]);
  const latest = Array.from(harness.stored.values()).find((project) => project.activeTool === "coordinates-graph");
  assert.ok(latest);
  assert.deepEqual(latest.graphDesignSettings.axisScale, { x: { k: 7, n: 2 }, y: { k: 3, n: 4 } });
  assert.deepEqual(latest.toolStates["coordinates-graph"].pointSets[0].points[0], { x: -3.5, y: 2.25 });

  const renamePromise = harness.manager.rename();
  harness.acceptDialog("Renamed project");
  await renamePromise;
  await harness.manager.save(true);
  const renamed = Array.from(harness.stored.values()).find((project) => project.name === "Renamed project");
  assert.ok(renamed);
  assert.equal(renamed.activeTool, "coordinates-graph");
  assert.deepEqual(renamed.graphDesignSettings.axisScale, { x: { k: 7, n: 2 }, y: { k: 3, n: 4 } });
});
