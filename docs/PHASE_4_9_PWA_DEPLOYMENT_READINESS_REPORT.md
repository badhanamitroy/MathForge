# MathForge Phase 4.9 — PWA Deployment Readiness Report

**Date:** 2026-11-03  
**Scope:** Audit of Phase 4.8 PWA file handling and its production deployment prerequisites. No application redesign, project-format change, or large implementation was performed.

## Executive Summary

MathForge contains the PWA manifest, `.mathforge` file-handler declaration, service worker, `/open-project` app-shell route, early LaunchQueue consumer, and adapter to the existing Project Manager. The existing Project Manager remains the sole parser, validator, serializer, state-restoration, persistence, and dirty-state authority.

The code is **implementation-ready for deployment testing, but not production/Windows-verified**. No public hosting origin, hosting configuration, installed Chrome/Edge PWA, or Windows file association is configured or verified in this workspace. Clicking a `.mathforge` file on Windows will not launch MathForge until the PWA is served from a secure origin, installed, and registered with Windows as a handler. Opening a local source file or visiting a website does not create that association.

## Audit Findings

| Requirement | Finding | Evidence / limitation |
|---|---|---|
| Manifest validity and MIME type | The manifest is valid JSON and declares `.mathforge` as `application/json`, matching the Project Manager's exported Blob MIME type. | `manifest.webmanifest`; `PROJECT_MIME_TYPE` and `serializeProject()` in `assets/js/project-manager.js`. Export names are sanitized and end in `.mathforge`. |
| Handler action URL | `./open-project` is relative to the manifest scope. With the current `./` scope it resolves to the in-scope `/open-project` route, including when hosted below the domain root. | `manifest.webmanifest`; the service worker derives the same path from its registration scope. |
| `/open-project` workspace route | The service worker intercepts an in-scope navigation to the exact route and serves cached `index.html`, injecting the app-scope `<base>`. If the shell is not cached, it returns an explicit 503. | `service-worker.js`. A deployed host must serve the complete application tree and allow service-worker control; a server-side SPA fallback is a useful fallback where the route is reached without an active worker. |
| Early LaunchQueue registration | The adapter is loaded in the document head, registers `launchQueue.setConsumer()` synchronously when supported, and queues handles until the Project Manager is ready. | `index.html`, `assets/js/core/project-file-adapter.js`. |
| Incoming handle to Project Manager | The adapter reads the handle's file text and calls `MathForgeProjectManager.loadProjectText(...)`. The Project Manager parses/validates and applies the project. The adapter does not implement a second JSON parser or validator. | `assets/js/core/project-file-adapter.js`, `assets/js/project-manager.js`. File-picker imports use that same loader. |
| Multiple incoming files | Handles are processed serially. Invalid files are rejected without applying them; a subsequent file asks before replacing the current workspace, and cancellation stops the batch. | Existing Phase 4.8 Node tests and localhost browser simulation cover queueing/confirmation. No Windows multi-selection test was run. |
| Save original / Save As | Explicit Save checks or requests `readwrite` permission before creating a writable stream; denial leaves the project dirty. Save As uses `showSaveFilePicker()` when available and otherwise downloads a `.mathforge` file. Autosave writes only to IndexedDB recovery, not to the source file. | `assets/js/core/project-file-adapter.js`, `assets/js/project-manager.js`. Actual Windows permission prompts and file writes remain unverified. |
| Offline shell | The worker precaches a fixed list of 24 local application assets, including the workspace, engines, styles, icons, manifest, and standalone pages. It does not cache project files. Previously documented localhost simulation verified the shell and `/open-project` response. | `service-worker.js`, Phase 4.8 report. A successful secure-origin install and complete cache fill require connectivity; browser-level offline reopening and installed-Windows offline reopening are not proven by Node simulation. |
| Icons, scope, and start URL | Local PNG icons are 192×192 and 512×512. `start_url` is `./index.html`, `scope` is `./`, and the handler action is in that scope. | `manifest.webmanifest`; dimensions read from both icon files during this audit. |
| Deployment assumptions | No application code is hard-coded to localhost; worker URLs and scope are derived from the app location. `localhost` is only a development secure-context exception, not the public deployment origin. Production requires HTTPS hosting and a stable origin/path. | No domain, hosting account/configuration, deployment credentials, or public deployment URL is present/configured in this workspace. |

### Existing project format

The format remains `mathforge-project`, version `1`, with `format`, `version`, `id`, `name`, `updatedAt`, `activeTool`, and `toolStates`. The Project Manager validates the format/version, a nonblank project name up to 80 characters, supported active-tool IDs, and supported tool-state keys. This phase does not change the schema.

## Browser Compatibility

- The file-open integration depends on an installed desktop PWA browser implementing the File Handling API (`window.launchQueue.setConsumer`). The Save/Save As file-handle path additionally depends on File System Access APIs.
- The app feature-detects those APIs. The normal File → Open File picker and download Save As fallback remain available where these APIs are unavailable.
- Chrome and Edge are the intended Windows Chromium-based install targets for this workflow. This audit did not establish a minimum browser version or test a real installed PWA in either browser; availability and OS registration must be checked on the actual deployed browser versions.
- The manifest declaration or browser simulation alone does **not** prove Windows Explorer association.

## HTTPS Hosting and Installation Requirements

1. Choose and configure a stable public origin, for example `https://<your-domain>/<optional-app-path>/`. A domain/hosting account and any DNS/TLS configuration are user/organization prerequisites; none is configured by this change.
2. Deploy the application root intact: `index.html`, `manifest.webmanifest`, `service-worker.js`, all referenced `assets/`, and the standalone HTML pages. Preserve relative paths. Serve the manifest with a JSON-compatible manifest content type and allow the service worker to register at the app's scope.
3. Confirm the deployed start URL loads over HTTPS. Confirm the service worker installs and its cache fill completes without missing assets. Open/reload the app once after activation so the page is controlled by the worker.
4. In current Windows Chrome and Edge, install MathForge as a PWA from the deployed origin. If the app was installed before the file-handler declaration was deployed, update/reinstall it if the browser does not refresh its registered handlers.
5. In each browser, inspect the installed app's file-handling setting if exposed. In Windows Settings, set `.mathforge` to MathForge under **Default apps → Choose defaults by file type** (wording varies by Windows version). If MathForge is not offered, the PWA has not registered as a Windows handler; do not select an unrelated editor as a substitute.
6. Export a small `.mathforge` file from the deployed app. In File Explorer, double-click it and confirm the installed MathForge PWA opens the project, restores its project name, active tool, and tool state. Repeat separately for Chrome and Edge if both are supported targets.
7. Test a file opened from Explorer with edits: Save must request/grant permission before writing the original; Save As must create another `.mathforge` file. Test denial and confirm the original is not written and the project remains dirty.
8. After a successful cache fill, disable the network and test launching the installed PWA and opening a previously exported project again. Record browser version, Windows version, deployment URL/path, outcomes, and any prompts.
9. Keep direct `file://` testing for the existing standalone pages separate. `file://` is not the PWA installation origin and cannot register a Windows PWA file association.

## Verification Performed for This Audit

- `node --test tests\phase-4-8-pwa.test.js` — **8/8 passed**.
- `node --check` — passed for all 11 JavaScript files under `assets/js`, `service-worker.js`, and the Phase 4.8 test file.
- Read the Phase 4.8 implementation and report. The previously documented localhost browser simulations covered the in-scope route, 24 cached assets, single/multiple project loads, Save/Save As simulation, and existing tool/import regressions. Those prior simulations are not a production deployment test.
- Actual installation in Windows Chrome/Edge, Windows `.mathforge` association, Explorer double-click, real file-handle permission prompts, and installed-PWA offline reopening were **not run**.

## Remaining Work / Release Gates

1. User/organization selects a production domain and hosting provider, configures DNS and HTTPS, and deploys the complete app at its final stable path.
2. Validate the hosted manifest, service-worker scope/activation, successful 24-asset cache fill, and `/open-project` route on that origin.
3. Install or update MathForge as a PWA in Windows Chrome and Edge and confirm each registers `.mathforge` with Windows.
4. Perform actual Explorer double-click, project restoration, Save permission grant/denial, Save As, and offline-reopen tests; report results separately per browser.
5. Update project status with actual deployment/test evidence only after these actions are completed.

**Current readiness:** Phase 4.8 implementation and automated checks pass. Production deployment and Windows file association are **pending**. No `.exe`, domain, hosting account, credentials, or Windows verification is supplied or claimed.
