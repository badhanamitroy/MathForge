# MathForge

The local project README was titled **Textbook-Graph-Suite**; remote `main`'s README contains no substantive text. This proposal preserves the historical name: MathForge is the current name of the project, formerly known by that repository name.

MathForge is an offline-first mathematical workspace for creating graphs and statistics visualizations. The static application combines four tools in a shared workspace:

- Coordinates Graph
- Equation Plotter
- Ogive Line
- Histogram / Frequency Polygon

## Run locally

No package installation or build step is required for ordinary local use. From the project root, serve the files over localhost:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/` in a browser. `localhost` is treated as a secure context by modern browsers, so it can also be used to exercise service-worker caching during development. For a basic static preview, the Vercel staging build can be generated with:

```powershell
node scripts/prepare-vercel.mjs
```

The generated `dist/` folder is disposable build output and is not source-controlled.

The four standalone tool pages (`Coordinates_graph.html`, `Equation.html`, `Ogiveline.html`, and `Polygonal.html`) continue to work directly from `file://` and when served over HTTP. PWA install and OS file association are not available from `file://`.

## Projects and persistence

The workspace saves recovery data in browser IndexedDB and imports/exports portable `.mathforge` files. The portable project format is JSON (`mathforge-project`, version 1) and contains the project name, active tool, and tool-specific state.

Use **File → Open File** to import an existing project. In supported installed desktop PWAs, the manifest also declares `.mathforge` as a file type; Windows can open a project with MathForge only after the PWA is installed from its deployed HTTPS origin and selected as the `.mathforge` default app. File association is browser/OS-specific and must be verified on the target Windows installation.

Save to a file opened by the installed PWA requires the browser to grant write permission. If the File System Access APIs are unavailable or permission is denied, use Save As/download instead. Recovery/autosave does not silently overwrite the original project file.

## Offline/PWA behavior

The manifest and service worker provide a static app-shell cache. The first successful app visit/install and cache fill require a secure origin and network access. Previously cached application assets can then be used offline; project files are not uploaded or cached by the service worker.

## Deploy to Vercel

The repository includes `vercel.json` and a dependency-free static staging script. Connect this repository to a Vercel project and set the project root to the directory containing `vercel.json`. Use the **Other** framework preset; the configured build command stages the static site to `dist/`, which is the configured output directory. The configuration rewrites only `/open-project` to the workspace shell and sets revalidation headers for the service worker and manifest.

Deploy a Preview and verify `/`, `/open-project`, the manifest, service worker, icons, standalone pages, and cached assets before promoting to Production. Vercel provides an HTTPS URL; adding a custom domain and configuring its DNS are separate owner-managed steps. Deployment and Windows PWA file-association testing must be performed by the repository owner.

## Tests

With Node.js installed, run the focused PWA and Vercel preview tests:

```powershell
node --test tests\phase-4-8-pwa.test.js tests\phase-5-0-vercel.test.js
```

The tests cover project-handler wiring, permission gating, worker/cache simulations, and a local static preview driven by the Vercel configuration. They do not prove a production Vercel deployment or Windows Explorer integration.

## Project documentation

See `docs/PROJECT_STATUS.md` for current status and the phase reports under `docs/` for implementation details, verification evidence, limitations, and release gates.
