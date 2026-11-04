# MathForge Phase 5.0 — Vercel Deployment Preparation

**Date:** 2026-11-03  
**Status:** Prepared and locally validated. No Vercel deployment or production hosting changes were made.

## Summary

MathForge is a static HTML/CSS/JavaScript application. This phase adds a dependency-free build step that stages only runtime files into `dist/` and a minimal Vercel configuration for that output. It preserves the existing PWA, service worker, standalone pages, project manager, and version-1 `.mathforge` format.

The Vercel configuration rewrites only `/open-project` to `/index.html`, so static files and standalone HTML routes are not broadly rewritten. The service worker and manifest receive explicit MIME and revalidation headers. No `.exe`, backend, database, external runtime asset, secret, or production deployment was added.

## Vercel Configuration

[`vercel.json`](../vercel.json) specifies:

- Build command: `node scripts/prepare-vercel.mjs`.
- Output directory: `dist`.
- One route rewrite: `/open-project` → `/index.html`.
- `service-worker.js`: JavaScript MIME type and `Cache-Control: no-cache, no-store, must-revalidate`; it is not immutable-cached.
- `manifest.webmanifest`: manifest JSON MIME type and revalidation.

[`scripts/prepare-vercel.mjs`](../scripts/prepare-vercel.mjs) uses only Node.js built-in filesystem/path modules. It stages the workspace entry page, manifest, service worker, four standalone pages, and the complete local `assets/` tree. It does not publish `backups/`, `docs/`, or `tests/`. Vercel's `dist` output is generated during each build and needs no package installation.

At the root deployment path, `/` resolves to `dist/index.html`. The `/open-project` rewrite returns the same application shell while preserving that URL. Relative app references resolve from the root, and the existing service worker continues to handle the route when the page is controlled. Static assets and standalone pages retain their direct URLs.

## Existing PWA and Project Behavior

- The manifest keeps `scope: "./"`, `start_url: "./index.html"`, local 192×192 and 512×512 icons, and the `.mathforge` file handler action `./open-project`.
- The handler MIME type remains `application/json`, matching existing version-1 project exports.
- The adapter registers `launchQueue.setConsumer()` before loading the existing Project Manager. Both OS-launched files and File → Open File use the same manager validation/import path.
- The service worker precache list contains 24 local shell assets and excludes project files. Previously cached app resources remain available offline after successful installation/cache fill; first deployment and initial caching require connectivity.
- Existing stand-alone pages and graph engines are copied unchanged. There are no mandatory remote runtime resources or Windows absolute paths in the deployed app paths.

## Tests and Validation

Command:

```powershell
node --test tests\phase-4-8-pwa.test.js tests\phase-5-0-vercel.test.js
```

**Result: 12/12 passed.**

The Phase 4.8 suite passed all 8 existing PWA/import/permission/offline-simulation checks. The new Phase 5.0 suite passed 4 deployment checks covering:

- Vercel config build/output settings, exact-only route rewrite, and omission of docs/backups/tests from `dist`.
- A local static preview matching the configured rewrite and headers: `/`, `/open-project`, local JS/CSS references, and a standalone page.
- Manifest JSON/handler/scope/start URL, accessible icons, all 24 service-worker precache resources, MIME types, and non-immutable worker caching.
- Local application references in the generated workspace HTML, absence of external HTML/CSS resources, and absence of Windows absolute paths in CSS.

Syntax checks passed for all 11 JavaScript files under `assets/js`, `service-worker.js`, both test files, and `scripts/prepare-vercel.mjs`.

The local preview is a Node static-server simulation driven by the Vercel configuration; it is **not** `vercel dev`, a Vercel deployment, or a Windows PWA test. The Vercel CLI was not available in the environment.

## Files Changed

- `vercel.json` — Minimal Vercel static build, output, route, and response-header configuration.
- `.gitignore` — Excludes generated Vercel metadata and `dist/` output.
- `scripts/prepare-vercel.mjs` — Curated static build output staging script.
- `tests/phase-5-0-vercel.test.js` — Local Vercel-configured static preview and deployment checks.
- `docs/PHASE_5_0_VERCEL_DEPLOYMENT_PREPARATION.md` — This report.
- `docs/PROJECT_STATUS.md` — Phase 5.0 status and validation.
- `docs/PROJECT_CHANGELOG.md` — Phase 5.0 changelog entry.

No existing application entry point, graph engine, project manager, manifest, or project schema was changed.

## Deploying Through Vercel

Deployment is a user action; the project has not been connected to a Vercel account or repository by this phase.

1. Commit/push the MathForge project to a Git provider supported by Vercel, or create a Vercel project and upload/connect the repository using the organization's normal process.
2. In Vercel, create a project from that repository and set the **Root Directory** to the directory containing `vercel.json` (the MathForge project root).
3. Use the **Other** framework preset. Keep the configured build command `node scripts/prepare-vercel.mjs` and output directory `dist`; do not set a second catch-all rewrite or replace the headers. No dependency-install step is required.
4. Deploy a Preview first. Verify `/`, `/open-project`, `/manifest.webmanifest`, `/service-worker.js`, both icon URLs, each standalone page, and the assets referenced in the service-worker precache list. Inspect response MIME/cache headers and the service worker's successful installation.
5. After review, promote/deploy to Production using the Vercel dashboard or the team's approved deployment workflow. Vercel provides an HTTPS deployment URL. A custom domain, if desired, must be added by the account owner and its DNS records configured before installing the final PWA.
6. Install MathForge from the final HTTPS origin in Windows Chrome and Edge separately. Reinstall/update if the browser does not refresh the manifest's file-handler declaration.

There are no Vercel credentials, account, repository connection, production domain, or deployment action in this change.

## Remaining Manual Windows Tests

Do not treat successful local tests or a Vercel Preview as proof of Windows integration. After production deployment:

1. Confirm MathForge appears as a `.mathforge` handler in the installed Chrome PWA and separately in the installed Edge PWA.
2. Export a real `.mathforge` file, double-click it in File Explorer, and verify the corresponding PWA opens it with the correct project name, active tool, and tool state.
3. Test Save with granted and denied write permissions; denial must leave the original unchanged and the project dirty. Test Save As creates a separate `.mathforge` file.
4. After the shell cache completes, go offline and verify the installed PWA opens and imports a previously exported project.
5. Record Windows/browser versions and results. These tests were **not run** in Phase 5.0; Windows file association and offline reopening remain unverified.

## Deployment Requirements / Limitations

- Vercel account and repository access, plus user approval to deploy.
- A stable Vercel HTTPS URL; custom domain and DNS are optional but user-managed.
- A modern Node.js build environment on Vercel to run the dependency-free staging script.
- Initial online visit and successful service-worker cache fill before offline use.
- Browser support for PWA file handling and File System Access APIs for OS-launched files and writing back to the original. File → Open File and download Save As remain the fallbacks.
- Actual Windows Chrome/Edge install, `.mathforge` association, Explorer double-click, permission dialogs, and installed-PWA offline reopening remain release gates.
