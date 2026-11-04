"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manifest declares the existing JSON .mathforge project type and in-scope route", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const handler = manifest.file_handlers[0];
  assert.equal(handler.accept["application/json"][0], ".mathforge");
  assert.equal(new URL(handler.action, "https://mathforge.test/app/").pathname, "/app/open-project");
  assert.equal(new URL(manifest.scope, "https://mathforge.test/app/").pathname, "/app/");
  assert.match(read("assets/js/project-manager.js"), /var PROJECT_MIME_TYPE = "application\/json"/);
  assert.match(read("index.html"), /accept="\.mathforge,\.json,application\/json"/);
});

test("project manager retains the existing version-1 JSON shape and routes both imports through one loader", () => {
  const manager = read("assets/js/project-manager.js");
  const adapter = read("assets/js/core/project-file-adapter.js");
  const index = read("index.html");
  for (const field of ["format: \"mathforge-project\"", "version: 1", "id: currentId", "name: currentName",
    "updatedAt:", "activeTool:", "toolStates:"]) {
    assert.ok(manager.includes(field), `project serialization is missing ${field}`);
  }
  assert.match(manager, /function validateProject\(project\)/);
  assert.match(manager, /async function loadProjectText\(text, source, handle, options\)/);
  assert.match(manager, /await loadProjectText\(text, file\.name \|\| "project file", null\)/);
  assert.match(adapter, /manager\.loadProjectText\(text, handle\.name, handle, \{ confirmReplace: confirmReplace \}\)/);
  assert.doesNotMatch(adapter, /JSON\.parse|validateProject/);
  assert.ok(index.indexOf("assets/js/core/project-file-adapter.js") < index.indexOf("assets/js/project-manager.js"));
});

test("adapter registers LaunchQueue early and queues multiple files with explicit replacement confirmation", async () => {
  let consumer;
  const context = {
    URL,
    window: {
      location: { protocol: "https:" },
      isSecureContext: false,
      navigator: {},
      launchQueue: { setConsumer(callback) { consumer = callback; } }
    },
    document: {
      currentScript: { src: "https://mathforge.test/app/assets/js/core/project-file-adapter.js" },
      baseURI: "https://mathforge.test/app/"
    }
  };
  vm.runInNewContext(read("assets/js/core/project-file-adapter.js"), context);
  const adapter = context.window.MathForgeProjectFileAdapter;
  assert.equal(adapter.supported, true);
  assert.equal(adapter.registered, true);
  assert.equal(typeof consumer, "function");

  const received = [];
  const handle = {
    kind: "file",
    name: "launch.mathforge",
    getFile: async () => ({ size: 12, type: "application/json", text: async () => "{\"format\":\"test\"}" })
  };
  const secondHandle = {
    kind: "file",
    name: "second.mathforge",
    getFile: async () => ({ size: 13, type: "application/json", text: async () => "{\"format\":\"second\"}" })
  };
  const queued = adapter.handleLaunchParams({ files: [handle, secondHandle] });
  await Promise.resolve();
  assert.equal(received.length, 0);
  adapter.setProjectManager({
    ready: Promise.resolve(true),
    async loadProjectText(text, name, fileHandle, options) {
      received.push({ text, name, confirmReplace: options.confirmReplace });
      adapter.setCurrentFileHandle(fileHandle);
      return true;
    },
    reportFileError(message) { received.push({ error: message }); }
  });
  await queued;
  assert.deepEqual(received, [
    { text: "{\"format\":\"test\"}", name: "launch.mathforge", confirmReplace: false },
    { text: "{\"format\":\"second\"}", name: "second.mathforge", confirmReplace: true }
  ]);
  assert.equal(adapter.getCurrentFileHandle(), secondHandle);
});

test("adapter stops a multi-file launch when the user cancels a replacement", async () => {
  const context = {
    URL,
    window: {
      location: { protocol: "file:" },
      isSecureContext: false,
      navigator: {},
      launchQueue: null
    },
    document: {
      currentScript: { src: "file:///D:/MathForge/assets/js/core/project-file-adapter.js" },
      baseURI: "file:///D:/MathForge/"
    }
  };
  vm.runInNewContext(read("assets/js/core/project-file-adapter.js"), context);
  const adapter = context.window.MathForgeProjectFileAdapter;
  const opened = [];
  const files = ["one", "two", "three"].map((name) => ({
    kind: "file",
    name: name + ".mathforge",
    getFile: async () => ({ size: 10, type: "application/json", text: async () => name })
  }));
  adapter.setProjectManager({
    ready: Promise.resolve(true),
    async loadProjectText(text, name, handle, options) {
      opened.push({ text, confirmReplace: options.confirmReplace });
      return name !== "two.mathforge";
    },
    reportFileError(message) { assert.fail(message); }
  });
  await adapter.handleLaunchParams({ files });
  assert.deepEqual(opened, [
    { text: "one", confirmReplace: false },
    { text: "two", confirmReplace: true }
  ]);
});

test("adapter rejects unsupported launch files without passing them to the manager", async () => {
  const context = {
    URL,
    window: {
      location: { protocol: "file:" },
      isSecureContext: false,
      navigator: {},
      launchQueue: { setConsumer() {} }
    },
    document: {
      currentScript: { src: "file:///D:/MathForge/assets/js/core/project-file-adapter.js" },
      baseURI: "file:///D:/MathForge/"
    }
  };
  vm.runInNewContext(read("assets/js/core/project-file-adapter.js"), context);
  const adapter = context.window.MathForgeProjectFileAdapter;
  const messages = [];
  let imported = 0;
  adapter.setProjectManager({
    ready: Promise.resolve(true),
    async loadProjectText() { imported++; },
    reportFileError(message) { messages.push(message); }
  });
  await adapter.handleLaunchParams({ files: [
    { kind: "file", name: "wrong.txt", getFile: async () => ({}) },
    { kind: "file", name: "wrong-type.mathforge", getFile: async () => ({ size: 5, type: "text/plain", text: async () => "{}" }) },
    { kind: "file", name: "too-large.mathforge", getFile: async () => ({ size: 10 * 1024 * 1024 + 1, type: "application/json" }) }
  ] });
  assert.equal(imported, 0);
  assert.equal(messages.length, 3);
});

test("adapter requests write permission before creating a writable and writes the supplied serialization", async () => {
  const context = {
    URL,
    window: {
      location: { protocol: "file:" },
      isSecureContext: false,
      navigator: {},
      launchQueue: null
    },
    document: {
      currentScript: { src: "file:///D:/MathForge/assets/js/core/project-file-adapter.js" },
      baseURI: "file:///D:/MathForge/"
    }
  };
  vm.runInNewContext(read("assets/js/core/project-file-adapter.js"), context);
  const adapter = context.window.MathForgeProjectFileAdapter;
  let permission = "denied";
  let creates = 0;
  let saved = "";
  const handle = {
    kind: "file",
    async queryPermission() { return "prompt"; },
    async requestPermission() { return permission; },
    async createWritable() {
      creates++;
      return { async write(contents) { saved = contents; }, async close() {} };
    }
  };
  await assert.rejects(adapter.writeFile(handle, "{\"format\":\"mathforge-project\"}"), /permission was denied/i);
  assert.equal(creates, 0);
  permission = "granted";
  await adapter.writeFile(handle, "{\"format\":\"mathforge-project\"}");
  assert.equal(creates, 1);
  assert.equal(saved, "{\"format\":\"mathforge-project\"}");
});

test("offline shell includes local app assets but never project files", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /open-project/);
  assert.match(worker, /MATHFORGE_PWA_BASE/);
  assert.doesNotMatch(worker, /\.mathforge/);
  assert.doesNotMatch(worker, /cache\.put\(/);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync(path.join(root, icon.src));
    assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split("x")[0]));
    assert.equal(bytes.readUInt32BE(20), Number(icon.sizes.split("x")[1]));
  }
});

test("service worker serves the dedicated file route and cached app shell while offline", async () => {
  const handlers = {};
  const entries = new Map();
  const cache = {
    async addAll(urls) {
      for (const url of urls) entries.set(url, new Response(url.endsWith("/index.html")
        ? "<html><head><!-- MATHFORGE_PWA_BASE --></head><body>workspace</body></html>"
        : url.endsWith("/Equation.html") ? "<html>standalone equation tool</html>" : "cached asset"));
    },
    async match(request) {
      return entries.get(typeof request === "string" ? request : request.url) || null;
    }
  };
  const context = {
    URL,
    Response,
    Promise,
    caches: {
      async open() { return cache; },
      async keys() { return []; }
    },
    fetch: async () => { throw new Error("offline"); },
    self: {
      registration: { scope: "https://mathforge.test/app/" },
      location: { origin: "https://mathforge.test" },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener(type, callback) { handlers[type] = callback; }
    }
  };
  vm.runInNewContext(read("service-worker.js"), context);
  let installTask;
  handlers.install({ waitUntil(task) { installTask = task; } });
  await installTask;

  let routeResponse;
  handlers.fetch({
    request: { url: "https://mathforge.test/app/open-project", mode: "navigate", method: "GET" },
    respondWith(response) { routeResponse = response; }
  });
  const routeHtml = await (await routeResponse).text();
  assert.match(routeHtml, /<base href="https:\/\/mathforge\.test\/app\/">/);

  let offlineResponse;
  handlers.fetch({
    request: { url: "https://mathforge.test/app/Equation.html", mode: "navigate", method: "GET" },
    respondWith(response) { offlineResponse = response; }
  });
  assert.match(await (await offlineResponse).text(), /standalone equation tool/);
});
