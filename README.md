# MathForge

MathForge is an offline-first mathematical visualization workspace for creating, editing, saving, and exporting classroom graphs. It runs as a static web application and includes five integrated generators:

- **Coordinates** — plot and label points, connect selected points, and explicitly close and fill shapes.
- **Equation** — plot multiple supported equations and coordinate points on one graph.
- **Ogive** — create cumulative-frequency curves.
- **Histogram** — create histogram and polygonal representations.
- **Pie Chart** — create pie or donut charts with calculations and drawing instructions.

The workspace uses one shared graph canvas and a common Graph Designs panel. Each tool keeps its own input data when you switch tools.

## Requirements

- A current desktop browser. Recent Chrome or Edge is recommended for PWA installation, file handling, and save-picker support. Other modern browsers can run the application, but browser-specific capabilities vary.
- Windows 10 or 11 is the primary supported desktop environment.
- Node.js is needed only for the repository's tests and static build preparation. There is no dependency install step or package manager manifest.

## Run locally

For a local HTTP workspace, open PowerShell in the project directory and run:

```powershell
py -m http.server 8000
```

Then open <http://localhost:8000/>. Stop the server with `Ctrl+C`.

The standalone pages are `Coordinates_graph.html`, `Equation.html`, `Ogiveline.html`, and `Polygonal.html`. They retain their separate legacy entry points. Direct `file://` use may work for these pages and for the workspace's supported local functionality, but service workers, installation, file handlers, and some browser storage/file APIs require an eligible secure context such as HTTPS or localhost.

## Use the workspace

Choose a generator from the horizontal toolbar above the canvas. Its data controls appear in the left **Inputs** panel; shared visual preferences are in the right **Graph Designs** panel. For Equation, add equation rows, enter supported expressions, and use Plot/Update to render them. For Coordinates, add points first and use the separate connection controls when line segments or closed shapes are wanted.

The Cartesian graph scale uses independent X and Y K/N values. If K grid squares represent N mathematical units, one mathematical unit occupies `K / N` major grid intervals. Equivalently, the graph coordinate is calculated from grid displacement as `(grid squares / K) × N`. Zoom changes the view and does not rewrite K/N values.

Pie Chart is not Cartesian and does not use K/N scaling, axes, or graph paper. Its category calculations, table, and drawing steps are managed by the Pie Chart tool.

## Projects and data

- **Save Project** stores a recoverable local copy in the browser's IndexedDB-backed project storage.
- **Save As** downloads a portable `.mathforge` project; supported browsers may offer a native save picker.
- **Open Project / Open File** imports an existing project. Workspace Projects and Recent Projects are available through File navigation.
- Project rename and import/export use the existing project manager.

The current project container is version 1 JSON. Older version-1 projects remain supported, with defaults/migrations for optional newer tool state. Local project storage belongs to the browser profile and device: MathForge does not provide cloud sync or upload projects to a server. Keep portable `.mathforge` backups for transfer or recovery. Browser clearing/storage eviction can remove local recovery copies.

## Export

Export Tools produce PNG for the active graph. SVG is available for applicable tools. The Pie Chart uses native SVG output; its PNG is rasterized from the chart SVG. Equation's exported chart has a solid white background, and the other graph exports retain their existing renderer's white graph sheet. Some Cartesian/statistical SVG paths are raster-backed wrappers around the renderer output, so they should not be assumed to contain editable vector primitives.

## Offline and PWA use

Serve the app from HTTPS or localhost to use its service worker and installable PWA features. The first visit needs network access so the browser can retrieve the shell and populate its cache. Later use can work offline for cached application assets; project data remains in local browser storage or in user-managed files. File association, launch queues, save pickers, and installation depend on browser and operating-system support. A service worker cannot control a `file://` page.

After updating a hosted installation, reopen the app online and allow the new service worker to activate before testing offline behavior. When diagnosing stale UI, use the browser developer tools to clear or bypass HTTP cache, close old tabs, reload online, confirm the new worker is active, then go offline and reopen.

## Build and deployment

The project is dependency-free and static. Vercel uses `node scripts/prepare-vercel.mjs` as the build command and `dist` as the output directory, as configured in `vercel.json`. Netlify has equivalent settings in `netlify.toml`, including the `/open-project` rewrite and service-worker/manifest response headers. For platform-specific fields, follow the current [Vercel documentation](https://vercel.com/docs/deployments/configure-a-build) or [Netlify build configuration documentation](https://docs.netlify.com/build/configure-builds/overview/).

**Important:** `scripts/prepare-vercel.mjs` deletes and recreates `dist/` before copying the curated static application files. Run it only when replacing the generated output is intended. For a safe release build, copy the required source into a disposable staging directory and run the script there. `dist/` is generated output, not the authoritative source.

## Tests

Run the automated tests with Node's built-in test runner:

```powershell
node --test tests/*.test.js
```

The test suite includes a Vercel preparation test that runs the build script and therefore replaces `dist/` in the test copy. To preserve a working tree's generated output, use a disposable copy for the full suite. Individual focused tests can be run with `node --test tests/<test-file>.test.js`.

JavaScript syntax can be checked with `node --check <file>`. Browser acceptance, installed-PWA behavior, OS file association, and visual behavior at specific viewport sizes require manual browser/Windows verification and are not established by a passing Node test alone.

## Known limitations

- The Equation Plotter supports the expression categories documented in its implementation report; it is a numerical plotting tool, not a symbolic algebra system. Unsupported expressions must be treated as unsupported rather than assumed to render accurately.
- Graph export capabilities differ by generator; some SVG exports contain a raster rendering.
- PWA installation, offline cache activation, file association, file pickers, and persistence quotas vary across browsers and operating systems.
- Bengali graph text uses the locally bundled Noto Sans Bengali variable font from the official Google Fonts repository. Its source path, SHA-256, variable axes, OFL 1.1 license and attribution are documented in [`assets/fonts/README.md`](assets/fonts/README.md); no font CDN is used. Legacy Kalpurush files remain in the source tree but are not runtime dependencies and are excluded from generated `dist/` output.

See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md), [`docs/PROJECT_CHANGELOG.md`](docs/PROJECT_CHANGELOG.md), and [`docs/VIBE96_SUBMISSION_PACK.md`](docs/VIBE96_SUBMISSION_PACK.md) for current status and release preparation notes.
