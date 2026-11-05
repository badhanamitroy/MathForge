"use strict";

var CACHE_NAME = "mathforge-shell-v9";
var APP_SCOPE = self.registration.scope;
var SHELL_URL = new URL("index.html", APP_SCOPE).href;
var OPEN_PROJECT_PATH = new URL("open-project", APP_SCOPE).pathname;
var APP_ASSETS = [
  "index.html",
  "manifest.webmanifest",
  "Coordinates_graph.html",
  "Equation.html",
  "Ogiveline.html",
  "Polygonal.html",
  "assets/css/common.css",
  "assets/css/workspace.css",
  "assets/css/tools/coordinates-tool.css",
  "assets/css/tools/pie-chart.css",
  "assets/css/tools/shared-graph-controls.css",
  "assets/js/common.js",
  "assets/js/core/graph-scale.js",
  "assets/js/core/equation-math.js",
  "assets/js/core/pie-chart-calculations.js",
  "assets/js/core/graph-typography.js",
  "assets/js/core/graph-design-settings.js",
  "assets/js/core/indexeddb-project-store.js",
  "assets/js/workspace-core.js",
  "assets/js/project-manager.js",
  "assets/js/core/project-file-adapter.js",
  "assets/js/tools/coordinates-tool.js",
  "assets/js/tools/standalone-control-templates.js",
  "assets/js/tools/equation-plotter-engine.js",
  "assets/js/tools/ogive-engine.js",
  "assets/js/tools/histogram-engine.js",
  "assets/js/tools/standalone-adapters.js",
  "assets/js/tools/pie-chart-engine.js",
  "assets/js/tools/standalone-bridge.js",
  "assets/img/MathForge Logo.png",
  "assets/img/pwa-192.png",
  "assets/img/pwa-512.png",
  "assets/fonts/kalpurush.ttf"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(APP_ASSETS.map(function (asset) {
      return new URL(asset, APP_SCOPE).href;
    }));
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf("mathforge-shell-") === 0 && key !== CACHE_NAME;
    }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === OPEN_PROJECT_PATH) {
    event.respondWith(caches.open(CACHE_NAME).then(async function (cache) {
      var shell = await cache.match(SHELL_URL);
      if (!shell) return new Response("MathForge is not cached yet. Open it online once to install offline resources.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
      var html = await shell.text();
      var baseTag = '<base href="' + APP_SCOPE + '">';
      html = html.replace("<!-- MATHFORGE_PWA_BASE -->", baseTag);
      return new Response(html, {
        status: shell.status,
        statusText: shell.statusText,
        headers: shell.headers
      });
    }));
    return;
  }

  event.respondWith(caches.open(CACHE_NAME).then(async function (cache) {
    var cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      try {
        return await fetch(request);
      } catch (error) {
        var shell = await cache.match(SHELL_URL);
        if (shell) return shell;
        throw error;
      }
    }
    return fetch(request);
  }));
});
