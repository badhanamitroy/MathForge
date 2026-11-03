# MathForge Phase 4.8 — PWA File Association Report

**Date:** 2026-11-03  
**Result:** PWA integration implemented; real Windows association verification remains open

## Existing Project Manager Audit

The existing manager remains the single authority for project serialization, validation, application to the workspace, persistence, recent projects, and dirty state.

### Existing project file format

`captureProject()` serializes this version-1 JSON object:

```json
{
  "format": "mathforge-project",
  "version": 1,
  "id": "project-id",
  "name": "Project name",
  "updatedAt": "ISO-8601 timestamp",
  "activeTool": "coordinates-graph | equation-plotter | ogive-curve | histogram-polygon | null",
  "toolStates": {
    "coordinates-graph": {},
    "equation-plotter": {},
    "ogive-curve": {},
    "histogram-polygon": {}
  }
}
```

`toolStates` values are the existing per-tool state objects or `null`. The manager validates the exact format identifier and version, a nonblank project name of at most 80 characters, `activeTool` as `null` or one of the four registered tool IDs, and that every tool-state key is supported with an object or `null` value. The existing validator does not impose separate type constraints on `id` or `updatedAt`; this phase did not change that validation contract.

- **Format identifier:** `mathforge-project`
- **Schema version:** `1` (unchanged)
- **Export MIME type:** `application/json`
- **Extension:** `.mathforge`
- **Filename:** sanitized project name plus `.mathforge`; invalid filename characters are replaced with hyphens.
- **Payload:** pretty-printed JSON; no wrapper or new format was added.
- **IndexedDB:** database `MathForgeProjects`, version `1`, object store `projects`. Saves write the project record and the `mathforge-autosave` recovery record.

### Existing manager and import behavior before Phase 4.8

The public Project Manager API was `newProject`, `openFile`, `openFolder`, `save`, `saveAs`, `exportGraph`, `undo`, `redo`, `rename`, and `isDirty`.

The import function was private and accepted project **text**. It called `JSON.parse`, validated the object, and then applied the state. The file-picker path read a `File` through `FileReader` before passing text to the importer; there was no public `File` or parsed-object import API.

Application flow is `validateProject` → `applyProject`: the manager resets the existing workspace tools, restores their saved tool states, selects the saved active tool, restores the project name, and updates the dirty baseline. The new public `loadProjectText(text, source, handle)` is the single import path used by the browser file input and PWA adapter. The adapter reads the incoming file and passes its text to the manager; it contains no project JSON parser or schema validator.

Before Phase 4.8, Save As always initiated a browser download. It now uses `showSaveFilePicker()` when present and falls back to the same download approach otherwise.

## Implementation

### PWA shell and file handler

- [`manifest.webmanifest`](../manifest.webmanifest) declares a standalone installable app, relative scope/start URL, local 192×192 and 512×512 PNG icons, and a `.mathforge` handler with MIME `application/json`.
- [`service-worker.js`](../service-worker.js) precaches the workspace shell, required local CSS/JavaScript/images, manifest, and standalone HTML pages. It intercepts the in-scope `/open-project` navigation and serves the cached `index.html` shell with the correct app-scope `<base>` URL.
- [`index.html`](../index.html) links the manifest and loads the file adapter in the document head, before the Project Manager.
- [`assets/js/core/project-file-adapter.js`](../assets/js/core/project-file-adapter.js) detects `launchQueue.setConsumer`, registers the consumer early, queues multiple incoming file handles in order, reads `.mathforge` files, enforces extension/MIME/size limits, retains the accepted current-session handle, and checks/requests write permission before writing. When one OS launch supplies multiple files, each later file requires confirmation before replacing the current workspace view; canceling stops the remaining batch.
- [`assets/img/pwa-192.png`](../assets/img/pwa-192.png) and [`assets/img/pwa-512.png`](../assets/img/pwa-512.png) are local app icons.
- [`assets/js/project-manager.js`](../assets/js/project-manager.js) exposes `loadProjectText` and readiness/error hooks while continuing to own parse/validation, state restoration, IndexedDB, recovery, recent projects, and dirty tracking.

Invalid or unsupported PWA files are rejected before the current project is applied. The existing Open File picker still accepts `.mathforge` and JSON files and calls the same manager loader. A canceled unsaved-change prompt leaves the current project and associated handle in place.

### Save, Save As, and recovery

- **Save with a PWA-associated file:** the manager serializes the current version-1 project and asks the adapter to write to the original handle. The adapter checks `readwrite` permission and requests it if necessary. A denied permission prevents file creation/writing, reports an error, and leaves the project dirty.
- **Save without an associated handle:** preserves the existing IndexedDB save behavior.
- **Save As:** calls `showSaveFilePicker()` with `application/json` / `.mathforge` when available. Otherwise, it starts the existing `.mathforge` download fallback.
- **Autosave/recovery:** remains in IndexedDB and does not write to the original file handle. With an associated file, the notice identifies recovery as local and states that the project file was not changed.
- The file handle is retained for the current page session only. A later PWA launch with the file reestablishes it; browser recovery does not silently reacquire or overwrite the original file.

### Offline behavior and standalone pages

Service-worker registration is attempted only on a secure context and is skipped for direct `file://` launches. The service worker precaches a fixed local asset list and does not cache project contents or make project-file upload requests. The installed PWA can use its previously cached shell and assets when offline after successful installation/caching; first installation and the first complete cache fill require an available secure origin (HTTPS, or localhost for development).

Standalone tool HTML pages and their local scripts were not changed by the PWA adapter and remain directly usable through `file://`.

## Verification

### A. Automated tests

Command: `node --test tests\phase-4-8-pwa.test.js`

**Result: 8/8 passed.** The Node tests cover manifest parsing, handler MIME/extension/scope, project format/version and shared-import wiring, early LaunchQueue registration and queued delivery, explicit replacement confirmation and stopping a batch after cancellation, unsupported file rejection, permission-gated writes, local icon dimensions, exclusion of `.mathforge` project files from the service-worker cache, and simulated offline shell/route responses.

`node --check` also passed for all JavaScript files under `assets/js` and `service-worker.js`.

These are automated unit/static and service-worker simulations; they do not prove browser or Windows OS integration.

### B. Browser simulation

Used the available Chromium browser on direct `file://` pages and on `http://127.0.0.1` (localhost secure-context exception).

- Confirmed `application/manifest+json` response, declared handler, activated service worker (`mathforge-shell-v4`), and 24 cached local assets. The `/open-project` route loaded the shared workspace shell with the correct base URL.
- Simulated LaunchQueue delivery with a file-handle object. The existing Project Manager loaded the file and restored project name, Equation Plotter selection, and `x^3` input; the adapter retained that handle.
- Simulated a two-file launch using valid projects. The second file prompted before replacing the first; cancel kept the first source handle, and confirming a later batch opened its second file. Automated coverage also verified that canceling stops the remaining batch.
- Denied write permission: no writable stream was created, the file remained unchanged, a recovery copy was stored locally, and the project remained dirty. Granted permission: the original simulated handle received version-1 project JSON and the project became clean.
- Stubbed `showSaveFilePicker()`: verified the `.mathforge` suggested name, `application/json` accept type, serialized project, and associated new handle. Stubbed picker absence: captured a nonempty `application/json` download named `Download Fallback.mathforge` with `mathforge-project` version `1`.
- Exercised the existing file-input fallback with a valid `File`; it restored the same workspace state through the same loader and cleared the unrelated prior file handle. Invalid JSON was rejected without changing project name/tool. Canceling an unsaved-change prompt preserved the current state and source handle.
- Exercised IndexedDB recovery after reload; Undo and Redo restored the actual Equation Plotter expression and active tool. A destructive New Project action displayed the unsaved-changes dialog and cancel preserved the project.
- Rechecked all four workspace tools. Exactly one canvas was mounted for each active tool; captured nonempty PNG output for Coordinates (29,470 bytes), Equation (76,730), Ogive (48,214), and Histogram (40,552). The SVG output was 108,391 bytes with an SVG root.
- Reopened all four standalone pages via `file://`; each rendered one canvas. No page/console errors or external HTTP(S) resource requests were observed.
- Service-worker offline behavior was exercised with a Node worker/cache simulation. The browser test host did not complete a reliable browser-level offline toggle, so actual offline reopening was not tested in the browser.

### C. Actual Windows integration

**Not run.** No installed Chrome/Edge PWA was registered with Windows, no `.mathforge` default-app/OS association was configured, no exported file was double-clicked in Windows Explorer, and no offline reopen was performed in an installed Windows PWA. Browser simulations above are not evidence that Windows double-click association works.

## Browser support and installation

The file-open path requires an installed browser PWA implementing the File Handling API (`window.launchQueue.setConsumer`) and File System Access write APIs for saving back to the source file. Support is feature-detected; browsers without these APIs retain the existing Open File and download fallbacks. Browser/version and OS association behavior must be confirmed on each supported Windows Chrome/Edge installation; universal browser support is not claimed.

1. Serve the MathForge directory from HTTPS. `http://localhost` is suitable for local development; `file://` is not an installable PWA origin.
2. Visit `index.html` in a supported desktop browser while online. Allow the service worker to install and finish caching the shell.
3. Install MathForge using the browser's install-app action.
4. Confirm the browser exposes the `.mathforge` file handler and, if prompted by Windows, choose MathForge as the app for `.mathforge` files.
5. Export a small test project and open it from the installed PWA. Verify Save, Save As, and offline reopening on the actual target Windows/browser configuration.

## Changed Files

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `assets/js/core/project-file-adapter.js`
- `assets/js/project-manager.js`
- `assets/img/pwa-192.png`
- `assets/img/pwa-512.png`
- `tests/phase-4-8-pwa.test.js`
- `docs/PROJECT_STATUS.md`
- `docs/PROJECT_CHANGELOG.md`
- `docs/PHASE_4_8_PWA_FILE_ASSOCIATION_REPORT.md`

A pre-edit backup is available at `backups/phase_4_8_prechange_20261103-121425/`.

## Remaining Work / Release Gates

1. Install from the intended HTTPS origin in Windows Chrome and Edge.
2. Confirm the OS association and double-click an actual exported `.mathforge` file from Explorer.
3. Verify file Save permission prompts and Save As using real browser file handles/downloads.
4. Disable network after the first successful cache fill and verify reopening the installed PWA and project file.
5. Confirm the app's hosting origin and browser versions are in the supported deployment matrix.

No `.exe`, new project schema, second manager, SQLite integration, cloud storage, or graph-engine rewrite was introduced.
