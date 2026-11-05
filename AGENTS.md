# MathForge Repository Guide

This is a static, dependency-free JavaScript application. Keep changes small and preserve standalone pages, offline behavior, version-1 `.mathforge` compatibility, and generated `dist/` synchronization.

## Architecture map

- `index.html` — integrated workspace markup and runtime entry points.
- `assets/js/workspace-core.js` — integrated workspace, tool registry/selection, shared canvas lifecycle, common UI wiring.
- `assets/js/core/graph-scale.js` — shared Cartesian K/N coordinate math. Preserve its established scale model.
- `assets/js/project-manager.js` and `assets/js/core/indexeddb-project-store.js` — version-1 project serialization, import/export, local storage, and recovery. Do not introduce duplicate project or database managers.
- `assets/js/tools/coordinates-tool.js` — shared Coordinates renderer and point/connection/closed-shape interactions.
- `assets/js/tools/equation-plotter-engine.js` — safe expression parsing/rendering and integrated Equation Plotter, also used through the standalone adapter.
- `assets/js/tools/ogive-engine.js` and `assets/js/tools/histogram-engine.js` — statistical tools.
- `assets/js/tools/pie-chart-engine.js` and related Pie modules — non-Cartesian calculation and SVG rendering.
- `assets/js/tools/standalone-adapters.js` — bridges legacy standalone tools into shared infrastructure; preserve standalone page compatibility.
- `assets/css/` — workspace shell, shared graph designs, and tool-specific styles.
- `service-worker.js` — versioned static app-shell precache. Update the cache version when changing cached runtime resources and keep the asset-reference tests accurate.
- `scripts/prepare-vercel.mjs` — copies the curated static source set into `dist/`. It removes and recreates `dist/`.
- `tests/` — Node built-in test suite, including the build test that mutates `dist/` in the project root.
- `dist/` — generated deployment output; never treat it as source of truth.

## Safe development and verification

There is no `package.json` or dependency installation step. Run tests with Node's built-in runner. The full suite contains a preparation test that deletes and recreates `dist/`; run it in a disposable copy unless replacing the current generated output is explicitly intended. After source changes, compare source/runtime files with their `dist/` copies using hashes or prepare the build in staging.

Before removing a file or entry point, inspect static and dynamic references, the tool registry, standalone adapters, the service worker precache, build script, tests, and compatibility documentation. Do not remove bundled fonts before licensing and usage are established.

Keep browser-only claims distinct from automated test results. Changes to persistence, exports, pointer interactions, service-worker behavior, or responsive layout should include explicit browser acceptance instructions if browser verification is not performed.
