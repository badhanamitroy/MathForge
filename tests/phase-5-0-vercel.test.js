"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { after, before, test } = require("node:test");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
let server;
let baseUrl;

function contentType(filePath) {
  const extension = path.extname(filePath);
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  }[extension] || "application/octet-stream";
}

before(async () => {
  const build = spawnSync(process.execPath, ["scripts/prepare-vercel.mjs"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const rewrite = config.rewrites.find((item) => item.source === requestUrl.pathname);
    const requestPath = rewrite ? rewrite.destination : requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.resolve(outputDirectory, "." + decodeURIComponent(requestPath));
    if (!filePath.startsWith(outputDirectory + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.setHeader("Content-Type", contentType(filePath));
    const headerRule = config.headers.find((item) => item.source === requestUrl.pathname);
    if (headerRule) {
      for (const header of headerRule.headers) response.setHeader(header.key, header.value);
    }
    response.writeHead(200);
    fs.createReadStream(filePath).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("Vercel config uses a curated static output and only rewrites the file-handler route", () => {
  assert.equal(config.buildCommand, "node scripts/prepare-vercel.mjs");
  assert.equal(config.outputDirectory, "dist");
  assert.deepEqual(config.rewrites, [{ source: "/open-project", destination: "/index.html" }]);
  assert.ok(!config.rewrites.some((item) => item.source === "/(.*)" || item.source === "/:path*"));
  assert.ok(!fs.existsSync(path.join(outputDirectory, "docs")));
  assert.ok(!fs.existsSync(path.join(outputDirectory, "backups")));
  assert.ok(!fs.existsSync(path.join(outputDirectory, "tests")));
});

test("local static preview serves root and /open-project as the workspace without rewriting assets", async () => {
  for (const pathname of ["/", "/open-project"]) {
    const response = await fetch(baseUrl + pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(await response.text(), /MathForge — Mathematical Workspace/);
  }

  const asset = await fetch(baseUrl + "/assets/js/core/project-file-adapter.js");
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /^application\/javascript/);
  assert.match(await asset.text(), /launchQueue\.setConsumer/);

  const standalone = await fetch(baseUrl + "/Equation.html");
  assert.equal(standalone.status, 200);
  assert.match(await standalone.text(), /Equation Plotter/);
});

test("manifest, worker headers, icons, and all precache resources are deployable", async () => {
  const manifestResponse = await fetch(baseUrl + "/manifest.webmanifest");
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type"), /^application\/manifest\+json/);
  assert.match(manifestResponse.headers.get("cache-control"), /no-cache/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.file_handlers[0].accept["application/json"][0], ".mathforge");
  assert.equal(new URL(manifest.file_handlers[0].action, baseUrl + "/").pathname, "/open-project");
  assert.equal(new URL(manifest.scope, baseUrl + "/").pathname, "/");
  assert.equal(new URL(manifest.start_url, baseUrl + "/").pathname, "/index.html");

  for (const icon of manifest.icons) {
    const response = await fetch(new URL(icon.src, baseUrl + "/"));
    assert.equal(response.status, 200, icon.src);
    assert.match(response.headers.get("content-type"), /^image\/png/);
  }

  const workerResponse = await fetch(baseUrl + "/service-worker.js");
  assert.equal(workerResponse.status, 200);
  assert.match(workerResponse.headers.get("content-type"), /^application\/javascript/);
  assert.match(workerResponse.headers.get("cache-control"), /no-store/);
  assert.doesNotMatch(workerResponse.headers.get("cache-control"), /immutable/);
  const worker = await workerResponse.text();
  const assetList = worker.match(/var APP_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(assetList, "service-worker precache list is present");
  const precachePaths = Array.from(assetList[1].matchAll(/"([^"]+)"/g), (match) => match[1]);
  assert.equal(precachePaths.length, 28);
  assert.ok(precachePaths.includes("assets/js/core/graph-scale.js"));
  assert.ok(precachePaths.includes("assets/js/core/graph-typography.js"));
  assert.ok(precachePaths.includes("assets/js/core/graph-design-settings.js"));
  assert.ok(precachePaths.includes("assets/fonts/kalpurush.ttf"));
  for (const assetPath of precachePaths) {
    const response = await fetch(new URL(assetPath, baseUrl + "/"));
    assert.equal(response.status, 200, assetPath);
  }
  assert.ok(!precachePaths.some((assetPath) => /\.mathforge$/i.test(assetPath)));
});

test("workspace entry references its local application assets", async () => {
  const response = await fetch(baseUrl + "/index.html");
  const html = await response.text();
  const references = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1]);
  const remoteReferences = references.filter((reference) => /^https?:/i.test(reference));
  assert.deepEqual(remoteReferences, []);
  const localReferences = references.filter((reference) => !/^(?:[a-z]+:|#|data:)/i.test(reference));

  for (const reference of localReferences) {
    const assetResponse = await fetch(new URL(reference, baseUrl + "/"));
    assert.equal(assetResponse.status, 200, reference);
  }

  const cssFiles = fs.readdirSync(path.join(outputDirectory, "assets", "css"), { recursive: true })
    .filter((file) => file.endsWith(".css"));
  for (const cssFile of cssFiles) {
    const stylesheet = fs.readFileSync(path.join(outputDirectory, "assets", "css", cssFile), "utf8");
    assert.doesNotMatch(stylesheet, /@import\s+url\(\s*["']?https?:/i, cssFile);
    assert.doesNotMatch(stylesheet, /url\(\s*["']?https?:/i, cssFile);
    assert.doesNotMatch(stylesheet, /[A-Za-z]:\\(?:Users|MathForge)\\/i, cssFile);
  }
});
