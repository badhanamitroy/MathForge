# MathForge — Final Pre-Release Deep Audit

**Audit type:** Read-only inspection and reporting  
**Project audited:** `D:\MathForge`  
**Audit date:** 2026-11-05  
**Scope:** Source, generated output, tests, documentation, local assets, offline/PWA and deployment configuration. No cleanup or product fixes were performed.

## A. Executive summary

MathForge is a substantial, offline-oriented browser application with five integrated graph generators, local project persistence, standalone pages for the original four Cartesian/statistical tools, and a static Vercel preparation path. The codebase has native engines and tests for several recent features, including safe equation parsing, K/N scaling, pie calculations, IndexedDB lifecycle behavior, and the current Coordinates connections model.

**Release readiness: not yet evidenced for commercial release.** One concrete high-priority defect affects the stated offline workspace experience: `index.html` loads `assets/css/tools/equation-plotter-workspace.css`, but that stylesheet is absent from the service worker precache list. The Equation Plotter can therefore lose its workspace styling when offline unless the browser happens to retain a prior HTTP cache entry. The existing PWA tests verify listed cache assets, but do not appear to compare the list against every asset linked by the workspace HTML.

Other material release risks are incomplete browser acceptance evidence, weak user-facing documentation/branding metadata, shallow validation of imported project structure, conditional data exposure to a parent frame by the standalone bridge, and an unclear source-versus-generated-output Git policy. These are not all proven release blockers; the report distinguishes implementation findings from validation gaps and product recommendations.

No CRITICAL security vulnerability was confirmed during this static audit. I found no `eval()`/`new Function()` use in application JS, no external runtime CDN dependency, and no runtime network request in the inspected application paths. This is not a substitute for dynamic security testing or a dependency/supply-chain scan.

### Repository identity and working tree

- Audited the exact source project at `D:\MathForge`; did not use or copy files from `D:\MathForge-github-import-20261103`.
- Git repository is on branch `main`, with origin `https://github.com/badhanamitroy/MathForge.git`; latest observed commit was `4001456 Update MathForge`.
- The working tree was already dirty before this audit. The following entries were observed and are not changes from this audit:

  ```text
   M assets/css/tools/coordinates-tool.css
   M assets/js/tools/coordinates-tool.js
   M dist/assets/css/tools/coordinates-tool.css
   M dist/assets/js/tools/coordinates-tool.js
   M docs/PROJECT_CHANGELOG.md
   M docs/PROJECT_STATUS.md
  ?? docs/COORDINATES_POINT_CONNECTIONS_REPORT.md
  ?? tests/coordinates-connections.test.js
  ```

- No `package.json`, lockfile, `node_modules`, or conventional package/dependency manifest was found. The app is primarily static HTML/CSS/classic JavaScript and its tests use Node’s built-in test runner.
- During this audit, **the only project file created is this report**. No existing project file was edited, deleted, renamed, moved, reformatted, or automatically fixed.

## B. Full inventory and architecture map

### Top-level structure

| Path | Role | Assessment |
|---|---|---|
| `index.html` | Main integrated MathForge workspace and local script/style entry point | Essential runtime entry |
| `Coordinates_graph.html` | Standalone Coordinates Graph | Keep for direct/legacy access |
| `Equation.html` | Standalone Equation Plotter | Keep; the equation engine retains a standalone rendering path |
| `Ogiveline.html` | Standalone Ogive tool | Keep; used by adapter/legacy flow |
| `Polygonal.html` | Standalone Histogram/Polygonal tool | Keep; used by adapter/legacy flow |
| `assets/` | Runtime JS, CSS, images and fonts; approximately 30 files / 2.08 MiB | Essential runtime assets; some specific cleanup candidates below |
| `dist/` | Vercel-ready generated static output; approximately 37 files / 2.16 MiB | Generated duplicate, but 31 files are Git-tracked; policy should be clarified before changing it |
| `docs/` | Project reports, audits, screenshots, scratch scripts and proposed documentation | Useful history, mixed authoritative and experimental material |
| `tests/` | 11 Node test files | Useful automated regression suite; one test file triggers a build that rewrites `dist` |
| `scripts/prepare-vercel.mjs` | Deletes and recreates `dist`, then prepares static deploy output | Necessary build script; destructive to current generated directory and must be treated accordingly |
| `service-worker.js` | App-shell caching, offline fetch routing and cache versioning | Essential to advertised offline/PWA behavior |
| `manifest.webmanifest` | PWA metadata and install icons | Essential to install flow |
| `vercel.json` | Vercel routing/headers and static deployment configuration | Essential to current deployment path |
| `.gitignore` | Excludes local/generated paths and secrets patterns | Essential; currently conflicts with tracked `dist` files |
| `README.md` | 22-byte placeholder containing only `# Textbook-Graph-Suite` | Not adequate as buyer/user documentation |
| `README.mathforge-proposed.md` | Longer proposed run/deployment documentation | Useful draft, but it describes four generators and is stale relative to the fifth integrated generator |
| `backups/` | 41 ignored local backup files, approximately 1.15 MiB | Not runtime or deploy content; retain until rollback/retention policy is decided |

### Runtime source inventory

**HTML (5 root pages):** `index.html` plus the four standalone pages listed above. Pie Chart is integrated in the workspace and does not have a separate standalone page.

**CSS (6 files):**

- `assets/css/common.css` — shared base and common application styles.
- `assets/css/workspace.css` — integrated workspace shell/layout.
- `assets/css/tools/coordinates-tool.css` — Coordinates-specific styles.
- `assets/css/tools/equation-plotter-workspace.css` — Equation workspace-specific styles; missing from the service worker precache.
- `assets/css/tools/pie-chart.css` — Pie Chart-specific styles.
- `assets/css/tools/shared-graph-controls.css` — shared Graph Designs controls.

**JavaScript (18 files):**

- `assets/js/workspace-core.js` — integrated workspace registration, tool switching, lifecycle, canvas sizing and shared control orchestration.
- `assets/js/common.js` — shared canvas/render utility functions used by legacy-style renderers.
- `assets/js/project-manager.js` — project orchestration, save/open, recent/workspace project UI and project-state coordination.
- `assets/js/core/project-file-adapter.js` — `.mathforge` file handling, browser file APIs and fallback paths.
- `assets/js/core/indexeddb-project-store.js` — IndexedDB connection, transaction and local project storage lifecycle.
- `assets/js/core/graph-scale.js` — shared K/N scaling and coordinate conversion helpers.
- `assets/js/core/graph-typography.js` — shared typography preferences and rendering helpers.
- `assets/js/core/graph-design-settings.js` — shared visual settings and controls.
- `assets/js/core/equation-math.js` — safe mathematical expression parsing/evaluation and equation plotting math.
- `assets/js/core/pie-chart-calculations.js` — pure Pie Chart data validation, percentages, angles and largest-remainder allocation.
- `assets/js/tools/coordinates-tool.js` — Coordinates Graph engine, point interaction, connections and closed shapes.
- `assets/js/tools/equation-plotter-engine.js` — standalone and workspace equation rendering paths.
- `assets/js/tools/ogive-engine.js` — Ogive data/calculation/rendering.
- `assets/js/tools/histogram-engine.js` — Histogram/Polygonal data/calculation/rendering.
- `assets/js/tools/pie-chart-engine.js` — integrated SVG Pie/Donut renderer and output sections.
- `assets/js/tools/standalone-adapters.js` — adapts existing standalone engines/controls to the shared workspace.
- `assets/js/tools/standalone-control-templates.js` — workspace control templates for adapter-backed tools.
- `assets/js/tools/standalone-bridge.js` — parent-frame messaging bridge for standalone pages.

**Images and fonts (6 files):** `assets/img/MathForge Logo.png`, `assets/img/pwa-192.png`, `assets/img/pwa-512.png`, `assets/fonts/kalpurush.ttf`, `assets/bangla font/kalpurush.ttf`, and `assets/bangla font/kalpurush ANSI.ttf`. The logo and PWA icons are referenced by the application/manifest. Runtime CSS references `assets/fonts/kalpurush.ttf`.

### Five-generator architecture

| Generator | Workspace engine/path | Important integration notes |
|---|---|---|
| Coordinates Graph | `coordinates-tool.js` | Native workspace renderer; point IDs and separate connection/closed-shape state are present. Coordinates owns important interaction/transform behavior. |
| Equation Plotter | `equation-plotter-engine.js` + `core/equation-math.js` | Native multi-equation workspace engine with safe expression parser, plus an older standalone path required by `Equation.html`. Supports explicit and implicit plotting and inequality shading within implemented parser/renderer scope. |
| Ogive | `ogive-engine.js` through `standalone-adapters.js` | Legacy standalone controls are adapted to shared workspace canvas; math/render path remains graph-specific. |
| Histogram/Polygonal | `histogram-engine.js` through `standalone-adapters.js` | Legacy standalone controls are adapted; data calculations and renderer remain graph-specific. |
| Pie Chart | `pie-chart-engine.js` + `core/pie-chart-calculations.js` | Native SVG chart, separate from Cartesian axes/K/N transformation; educational table/drawing-step visibility and Pie-specific typography are integrated. |

`workspace-core.js` and `index.html` provide the selection/registration shell. The four old standalone pages and adapter/template infrastructure are compatibility paths, not safe deletion candidates. The shared workspace centralizes shell/canvas and common preferences, but not every graph engine uses identical drawing internals; that reflects Cartesian versus statistical versus SVG chart needs.

### Project persistence and exports

- Project data uses the existing `.mathforge` JSON format (version 1) and stores graph-specific state plus shared graph design settings. Pie data/preferences are optional fields for backward compatibility.
- IndexedDB operations live in `core/indexeddb-project-store.js`; the lifecycle includes connection reuse/recovery and serialized saves. `project-manager.js` handles user actions and recent/workspace navigation.
- Exports are implemented per rendering path. Cartesian canvas tools share central canvas export logic; Equation has explicit white export handling; Pie serializes/rasterizes its SVG. SVG quality/semantics are therefore not fully uniform across generators.
- `Save As` and import/export rely on browser file APIs when available and fallback behavior through `project-file-adapter.js`. The app’s local/file workflow is not identical across `file://`, localhost, and installed HTTPS PWA contexts.

### Deployment, test and documentation inventory

- `tests/` contains tests for Coordinates connections, equation math/plotter, graph scale, IndexedDB, PWA assets, Pie calculations, project save, shared designs, layout recovery, and Vercel prep.
- `tests/phase-5-0-vercel.test.js` invokes the Vercel preparation script from its setup; that script removes/recreates `dist`. It is not a non-mutating check.
- `docs/` contains 103 files observed in the audit, including 42 Markdown documents, historical phase reports, screenshots, SQL/Python proposals, and a `docs/scratch/` area with one-off JS and HTML harnesses. This report does not treat historical reports or scratch assets as safely removable without confirming their evidentiary/rollback value.
- Vercel configuration targets static generated output; no package manifest is present. The project should document the exact Vibe96 build command/output mapping separately rather than assuming it matches Vercel.

## C. Findings classified by severity

### CRITICAL

No confirmed critical exploit, exposed credential, or proven unrecoverable data-loss defect was found in this static audit. Dynamic testing, browser matrix testing, and a supply-chain scan were not performed, so this is not a security certification.

### HIGH

1. **Equation Plotter stylesheet omitted from the offline app-shell cache.** `index.html:25` loads `assets/css/tools/equation-plotter-workspace.css`. The service worker’s `APP_ASSETS` list in `service-worker.js` does not include it. Static evidence indicates the active service-worker cache cannot serve this stylesheet offline after a cold cache, so the equation workspace can be unstyled while other shell files are available. This conflicts with the offline-first release claim. Add a cache-manifest completeness check and perform a cold offline browser test before release.
2. **Offline-cache test has a completeness blind spot.** The PWA test checks the declared cache list rather than proving every HTML-linked runtime asset is precached. It did not catch the missing Equation stylesheet. This weakens confidence in future asset additions.

### MEDIUM

1. **Parent-frame message bridge uses wildcard target origin.** `assets/js/tools/standalone-bridge.js` posts state/control payloads with target origin `"*"`. It exits when the page is top-level; no current integrated-app parent consumer was found. If a standalone page is embedded by an external site, a parent can receive graph/project input state. This is a conditional privacy/data-exposure risk, not evidence of a current remote exploit. Confirm embedding requirements and constrain or disable messaging for untrusted origins if appropriate.
2. **Imported project structure is only shallowly validated at the project boundary.** Project import checks broad shape/type/IDs but does not appear to impose comprehensive size/depth/value bounds before all graph-specific restoration. Since files are user-selected and local, this is primarily a robustness/availability and malformed-file handling concern. Add bounded validation and regression fixtures before commercial distribution; do not change schema unnecessarily.
3. **Generated output has mixed source-control policy.** `.gitignore` ignores `/dist`, yet 31 files under `dist` are tracked. This creates unclear authority: generated outputs can drift from source and normal build operations can alter tracked files. Current audited source/dist copies matched by SHA-256 for all 30 asset files and 7 root output files checked, but the Git policy remains inconsistent.
4. **Ogive and Histogram have thinner direct math/render test coverage than Coordinates, Equation and Pie.** Shared scaling tests do not establish the correctness of all statistical calculations, malformed input behavior, exports, or UI interactions.
5. **Browser acceptance is absent from this audit.** There is no current evidence here for actual browser operation of all five generators, direct file URLs, installed PWA, offline startup, file association, save/open/export, assistive technology, and responsive layouts. Prior documentation reports are historical and are not treated as current verification.
6. **Standalone bridge appears unused by the present workspace, but embedding intent is unknown.** It early-returns in top-level browsing and no in-project parent frame consumer was found. Removing it could break a future or externally hosted embedding integration.
7. **README materials are stale and fragmented.** `README.md` is a placeholder, while the proposed README documents four generators, not the current five, and is not the conventional root guide. Buyers/users need one current source of setup, offline/install, save/recovery, import/export and troubleshooting instructions.

### LOW

1. **Potentially unused private helper:** `niceStepForLabels()` in `assets/js/tools/coordinates-tool.js:356` has a definition but no other application/test reference in repository text search. It appears dead, but confirm no reflective/global usage before removal.
2. **Duplicate bundled font file:** `assets/bangla font/kalpurush.ttf` has the same SHA-256 as `assets/fonts/kalpurush.ttf`; the latter is the runtime CSS path. The former has no discovered runtime/build reference. Verify intended packaging/licensing before removing.
3. **Unreferenced ANSI font variant:** `assets/bangla font/kalpurush ANSI.ttf` is distinct but no runtime or build reference was found. It may be an archival/compatibility asset; confirm licensing and intended standalone use before considering removal.
4. **Scratch harness accumulation:** `docs/scratch/` contains numerous one-off scripts and standalone HTML test harnesses. They are outside deployment/test discovery but may preserve past debugging evidence. Archive or classify before removal.
5. **Large logo asset:** `assets/img/MathForge Logo.png` is used and should not be removed. At about 805 KB it may be worth optimizing for initial load; retain a source-quality original.
6. **Accessibility/product polish:** Canvas interactions have no equivalent keyboard-oriented point editing/graph description established by this audit; Pie SVG slices do expose focus/labels. No complete help/onboarding/about/version/legal/contact experience was found. Verify with browser and assistive technology before release.
7. **Export semantics vary by generator.** The workspace export UI presents a common concept, while SVG generation differs between canvas snapshot wrappers, Equation vector paths and Pie SVG. Document supported fidelity and test the actual resulting files per generator.

### SAFE TO REMOVE (candidates only; no removal performed)

“Safe to remove” here means the evidence suggests a narrowly scoped cleanup candidate. It is not authorization to delete. Review the candidate table and retain an archive/rollback path where indicated.

| Candidate | Evidence | Conditions before removal |
|---|---|---|
| `assets/bangla font/kalpurush.ttf` | Byte-identical to runtime `assets/fonts/kalpurush.ttf`; no discovered references to this duplicate path | Confirm no external packaging process or user workflow expects this directory |
| `niceStepForLabels()` at `assets/js/tools/coordinates-tool.js:356` | Repository search finds declaration without any call sites | Confirm no dynamic/reflection use and add/retain relevant graph tests |
| Individual obsolete files in `docs/scratch/` | Not referenced by app/build/tests; one-off harnesses | Decide whether historical test evidence must be retained or archived |

No standalone page, adapter, engine, project store, service worker, or generated deployment file is classified as safe to remove.

### KEEP

- `Coordinates_graph.html`, `Equation.html`, `Ogiveline.html`, `Polygonal.html` and their engines/adapters/templates: preserve direct standalone compatibility.
- `workspace-core.js`, `common.js`, all five tool engines, graph-scale/typography/design modules, equation parser and Pie calculation module: active architecture.
- `project-manager.js`, project file adapter and IndexedDB store: project workflows and data reliability.
- `service-worker.js`, `manifest.webmanifest`, PWA icons, `vercel.json` and `scripts/prepare-vercel.mjs`: core offline/deployment infrastructure, subject to the cache and destructive-build findings.
- Existing `.mathforge` version 1 compatibility behavior and graph-specific state fields.
- `backups/` until a retention/rollback decision is made; these are local and ignored, not deployment payload.
- `dist/` as the generated deployment output path unless the deployment architecture is deliberately changed. Resolve whether it should be tracked; do not delete it casually.

## D. Cleanup candidate table

| Exact path / section | What it does | Why it appears unnecessary or confusing | Evidence of non-use | What might break if removed | Recommended action |
|---|---|---|---|---|---|
| `assets/bangla font/kalpurush.ttf` | Contains a Kalpurush font copy | Duplicate of the runtime font at another path | SHA-256 identical to `assets/fonts/kalpurush.ttf`; no discovered code/build reference to this path | External packaging, manual download, or undocumented tooling may expect it | Confirm external usage/licensing, then consider removing only the duplicate |
| `assets/bangla font/kalpurush ANSI.ttf` | ANSI-encoded Kalpurush font variant | No current application need discovered | Distinct hash; no code/CSS/build reference found | Could be intended for a legacy or user-supplied workflow | Keep until owner confirms no compatibility need and licensing is documented |
| `assets/js/tools/coordinates-tool.js` — `niceStepForLabels()` | Computes a candidate label step | Appears unused private helper | Search found declaration only, no call sites | A dynamic consumer may rely on a global/private exposure, though not apparent | Verify function scope/use, then remove only in an authorized cleanup phase |
| `docs/scratch/` | Historical one-off JS scripts and HTML harnesses | Not part of runtime, build or test discovery; adds clutter | Not loaded by app or test runner | May lose debugging evidence, reproducibility, or context for prior fixes | Inventory each file, archive relevant evidence, then prune approved leftovers |
| `assets/js/tools/standalone-bridge.js` | Parent-frame communication for standalone tools | No current in-repo embedding consumer; top-level path returns early | No consumer/iframe found in `index.html` or root standalone pages during search | Breaks external/partner embedding that is not represented in repo | Do not remove until embedding intent is explicitly settled; review wildcard origin behavior |
| `README.md` and `README.mathforge-proposed.md` | User/developer instructions | One is placeholder and one is a stale proposal with four-generator description | Content mismatch with current implementation; proposed file name suggests not canonical | Deleting either may discard only available setup/deployment information | Consolidate/update into one canonical current README; retain history if useful |
| `dist/` tracked files | Generated deploy copy | Duplicates source and is inconsistently ignored/tracked | 31 generated files tracked; current checked hashes match source; build script regenerates it | Vercel deployment may depend on it; deletion or untracking changes release/build flow | Decide one-source-of-truth policy first; do not remove output path without deployment change |
| `backups/` phase snapshots | Local rollback copies | Outside app and ignored; apparent duplication | No runtime/build references | Removing may eliminate only rollback copies for uncommitted/local work | Keep until retention policy and verified source-control backup are agreed |

## E. Functional, security, performance and product observations

### Functional coverage and regression confidence

- Automated tests cover current Coordinates connections, equation parsing/plotting, K/N transforms, IndexedDB storage, PWA asset declarations, Pie calculations, project save, shared Graph Designs and workspace layout.
- The existing test set does not by itself prove browser rendering, full project round trips for every generator, every file picker fallback, all exports, every aspect ratio/viewport, or full offline operation.
- Ogive and Histogram engines have less direct calculation coverage than other recently developed modules. Add representative boundary, invalid-input, cumulative-frequency/class-interval and export tests before release.
- The Equation Plotter has explicit/inferred parser scope and contour sampling; unsupported input should remain clearly rejected. Do not market it as unrestricted symbolic algebra.
- Coordinates closed-shape support is limited to the implemented data model (including one closed shape per set as observed); test this product constraint and explain it if multiple independent shapes are not supported.
- Pie calculation math is separated from DOM rendering, and largest-remainder allocation provides a 360° whole-degree total. Renderer appearance and export fidelity still need browser evidence.

### Security and privacy

- **Expression evaluation:** repository search found no `eval()` or `new Function()` in app scripts; equation input uses the local parser module.
- **Network dependencies:** no external runtime CDN or remote font dependency was found. Keep the service worker and offline asset list aligned as files change.
- **HTML injection:** dynamic user content appears to use escaping or `textContent` in the reviewed paths, but there are several `innerHTML` template/render sites. Continue to validate labels, equation text, category names and imported state at the boundary; static inspection alone cannot establish DOM safety in every path.
- **Imported files:** user-selected `.mathforge` data is local, but malformed or very large JSON can still consume memory/CPU. Add size/depth constraints and user-friendly parse errors.
- **Secrets:** no credential value was printed or identified in the inspected project files. `.gitignore` includes secret-file patterns. This does not inspect Git history for previously committed secrets.
- **Frame messaging:** standalone bridge’s wildcard target origin is a conditional concern if pages are embedded. Treat graph/project state as user data.

### Performance and reliability

- The logo PNG is the notable large initial asset (~805 KB); optimize if visual fidelity can be maintained.
- Multiple engines and compatibility adapters create repeated render/control logic. The differences are partly justified by Canvas/SVG and Cartesian/statistical rendering models; a broad rewrite would carry high regression risk. Target only duplicated helpers proven identical and add tests before consolidation.
- Equation contouring and inequalities are numerical and potentially expensive for dense expressions; retain sampling limits and profile worst-case expressions in browser.
- IndexedDB save serialization and connection recovery are implemented, but storage quota, private browsing, browser eviction and interrupted downloads need user-facing recovery paths and browser acceptance evidence.
- The Vercel preparation script clears and reconstructs `dist`; invoke it only when the operator accepts that output regeneration and after preserving relevant local state.

### Commercial product quality

Before a paid release, the product should have one accurate user guide, concise first-run guidance, a clear app/version/about identity, supported browser/OS information, export instructions, project backup/recovery guidance, privacy/data-storage explanation, and licensing/support/contact information. Confirm icon/title/metadata and copy use MathForge consistently. The current documentation is extensive for development history but fragmented for end users.

## F. Build and test results

### Passed in this audit

- **Automated tests:** 10 non-mutating test files run: 74 tests passed, 0 failed. Included Coordinates, equation math/plotter, graph scale, IndexedDB, PWA declarations, Pie math, project save, Graph Designs, and workspace layout.
- **JavaScript syntax:** `node --check` passed for 31 files across `assets/js`, `scripts`, `service-worker.js` and `tests`.
- **Source/dist consistency:** read-only SHA-256 comparison found all 30 checked asset files and all 7 checked root deployment files matched their source counterparts at the time of audit.
- **Repository inspection:** verified working tree before/after report creation; existing unrelated dirty files listed above were preserved.

### Not run or not verified

- **Vercel build preparation and `tests/phase-5-0-vercel.test.js`: not run.** The preparation script invokes `rmSync(dist, { recursive: true, force: true })` and recreates generated files. Running it would modify/delete project files, prohibited by this read-only phase. The associated test invokes that script from setup, so it was also excluded. This means the full 78-test suite/build path was not executed; 74 tests are the safe subset result.
- **Browser interaction and visual tests: not run.** No claim is made about actual browser operation, offline mode, responsiveness, accessibility, Save/Open round-trips, or export appearance.
- **Vibe96 deployment: not run.** No deployment or external platform configuration change was made.
- **Supply-chain/dependency scan:** not run; there is no package manifest, and no dependency was installed.

## G. Release blockers and recommended gates

Only the first item is a confirmed code/configuration issue from this audit. The remaining items are required release evidence if those product claims are part of the Vibe96 listing.

1. **Fix and verify offline Equation Plotter styling.** Add the omitted local CSS asset to the app-shell precache (or otherwise prove reliable offline serving), and add a test comparing linked local assets with the precache. Then install/update the PWA, clear ordinary HTTP cache, go offline, open Equation Plotter and verify layout/styles.
2. **Run a browser acceptance pass on the actual release build.** Exercise all five tools, save/open/rename/recent, import/export, PNG/SVG outputs, and standalone pages; inspect target desktop and mobile widths.
3. **Prove project data recovery and storage failure UX.** Include at least one round trip per generator, an older v1 project, rapid saves, and a browser with IndexedDB unavailable/quota constrained if supported.
4. **Confirm Vibe96 build/output assumptions.** Verify the platform’s actual build command, root, generated directory, rewrite/headers, HTTPS and service-worker scope against the intended listing. Do not assume Vercel configuration maps directly.
5. **Complete user-facing release materials.** Replace the placeholder README with a current guide, and publish accurate offline/install, file handling, privacy/storage, compatibility, troubleshooting and support information.

## H. Suggested cleanup sequence (after report review and authorization)

1. Address the offline cache omission and add cache-completeness coverage; re-test a cold offline startup.
2. Agree on the authority for `assets/` versus tracked `dist/`, then make synchronization deterministic and document the build’s destructive output behavior.
3. Consolidate user/developer documentation and align generator count, platform instructions and app metadata.
4. Add missing Ogive/Histogram math and full project/export regression coverage; establish browser acceptance results.
5. Review local import bounds, error handling, wildcard frame messaging and storage failure UX.
6. Remove only owner-approved low-risk items: duplicate font, confirmed dead helper, obsolete scratch harnesses. Preserve rollback evidence and standalone compatibility.
7. Optimize the used logo asset and address accessibility/onboarding polish.

## I. Final release checklist

### Technical

- [ ] Resolve Equation stylesheet offline precache gap and test cold offline mode.
- [ ] Add app-shell manifest completeness check.
- [ ] Settle tracked/generated `dist` policy and prove source/output parity after the approved build.
- [ ] Confirm Vibe96 root, build command, output directory, HTTPS, headers and service worker scope.
- [ ] Review imported project size/depth validation and storage quota/recovery UX.
- [ ] Verify no secrets in current files and inspect Git history with an approved secret scanner if needed.

### Functional

- [ ] Browser-test Coordinates, Equation, Ogive, Histogram/Polygonal and Pie Chart.
- [ ] Test New/Open/Save/Save As/import/rename/recent/workspace projects and older v1 projects.
- [ ] Test independent graph state when switching among all five generators.
- [ ] Test K/N scales, zoom/pan, aspect ratios, graph interactions and point connections/shapes.
- [ ] Test Equation explicit/implicit/inequality/discontinuity cases and unsupported-expression errors.
- [ ] Test Ogive/Histogram numerical edge cases and chart labels.
- [ ] Test Pie percentages, angle allocation, display options, visibility, keyboard focus and legend interaction.
- [ ] Inspect PNG/SVG outputs for every generator; verify Equation’s white export background and Pie chart fidelity.
- [ ] Test standalone pages opened directly and all supported Save/Open paths.
- [ ] Test PWA install, update, offline cold start, reconnect and recovery on target browser/OS.

### UX, accessibility and documentation

- [ ] Replace placeholder README and reconcile proposed draft.
- [ ] Provide first-run help, examples, empty states and understandable validation/storage errors.
- [ ] Verify keyboard access, screen-reader names, focus order, contrast and canvas alternatives.
- [ ] Verify responsive layouts on supported desktop/tablet/mobile viewports.
- [ ] Provide app version/about, privacy/storage disclosure, supported platform details and support contact.
- [ ] Review all screenshots and marketing claims against current five-generator functionality and limitations.

### Video and Vibe96 preparation

- [ ] Prepare a short product video showing real current UI, supported workflows and export; avoid claiming unverified offline behavior.
- [ ] Confirm Vibe96 listing requirements, package/build/output configuration, domain/SSL, icon/preview assets and support/legal links.
- [ ] Deploy only after authorization; then smoke-test production URL, installability, deep links, downloads, cache update and offline behavior.

## Audit boundary

The original Phase 1 audit was read-only and created only this report. The subsequent, explicitly authorized Phase 2A remediation is recorded below; it changed only the scoped service worker, PWA regression test, corresponding `dist` worker, and requested status/changelog/report documentation. No cleanup, dependency changes, destructive build, commit, push, or deployment was performed.

## Remediation status — Phase 2A

**Status recorded:** 2026-11-05. The original audit finding and its evidence above are preserved as the historical finding; this section records the authorized remediation.

- **Fixed in source:** `service-worker.js` now precaches `assets/css/tools/equation-plotter-workspace.css`; the shell cache version is `mathforge-shell-v10` so existing clients install the updated shell. Existing install, activate, and fetch strategies remain in place.
- **Regression coverage added:** `tests/phase-4-8-pwa.test.js` resolves local runtime asset references from the workspace and four standalone HTML files, follows local CSS `url()` and `@import` references, includes manifest icons, verifies every declared cache path exists, and reports any referenced local runtime asset absent from `APP_ASSETS`. PWA tests pass 10/10, and the full non-destructive test set passes 75/75. Syntax checks passed for 31 source, script, worker and test files. The check does not indiscriminately precache the repository: data/blob/external URLs and non-runtime files are excluded. Generator engine files are statically included by the workspace and checked as explicit cache entries; no dynamic `fetch()`/module-import asset loader was found in the inspected app paths.
- **Generated output:** `dist/service-worker.js` was synchronized directly from the source worker without running the destructive Vercel preparation script. Their SHA-256 hashes match: `DD5450E03735BBE5FBB4FAFF5A8E970B5B442633979916E601AE549851086B67`. A read-only parity check of all 37 runtime source files with corresponding `dist` copies passed.
- **Browser verification:** Not performed. The fix is automatically tested at the service-worker installation/cache-list level, but a cold offline browser session has not yet confirmed the Equation Plotter’s full styling or all five tools’ behavior offline.
- **Remaining findings:** Other findings in this audit are unchanged and remain open, including the standalone bridge’s conditional wildcard-origin concern, shallow project import validation, mixed `dist` tracking policy, product documentation gaps, thinner Ogive/Histogram coverage, accessibility/product polish, and the remaining browser/Vibe96 release acceptance gates. No unrelated cleanup was performed.

### Phase 2A manual offline verification

1. Serve the updated source/build over the intended HTTPS origin, then open MathForge while online. In the browser’s Application/Storage panel, unregister the older MathForge service worker and remove its old `mathforge-shell-v9` cache, or use a clean browser profile. Reload online and wait for the v10 service worker to install and activate; if installed as a PWA, close and reopen it after the update.
2. Open DevTools Network and enable **Disable cache** while DevTools remains open. Confirm the active service worker reports `mathforge-shell-v10` through Application → Cache Storage and that the cache contains `assets/css/tools/equation-plotter-workspace.css`.
3. With DevTools open, switch Network to **Offline** (or disconnect the machine after the cache is populated). Navigate/reload the workspace. Open Equation Plotter and verify its input panel, equation rows, graph toolbar, canvas and Graph Designs controls are styled and laid out normally. Check Network/Application for a cached response rather than an ordinary HTTP cache response.
4. Still offline, switch through Coordinates, Equation, Ogive, Histogram, and Pie Chart. Confirm each tool’s controls and graph output load without failed local asset requests. Then return online and reload once to confirm normal service-worker recovery.

These steps are instructions for pending manual verification, not a claim that browser testing passed.

## Remediation status — Phase 3 commercial release preparation

**Status recorded:** 2026-11-05. The original Phase 1 findings above remain intact; this additive section tracks the authorized preparation work and does not mark the full audit findings closed.

- **Documentation:** The root README was replaced with setup, feature, project, offline, export, build, and limitation guidance. A root `AGENTS.md` records repository architecture and safe verification practices. `docs/VIBE96_SUBMISSION_PACK.md` contains listing copy and an owner checklist without inventing pricing, customers, certifications, or a public demo URL.
- **Deployment configuration:** Added a Netlify static-site configuration using the existing curated Vercel preparation script and output, with the project-open route and service-worker/manifest headers. Vercel configuration remains unchanged. A targeted automated configuration test was added.
- **Files and historical work:** Existing Phase 2A/2B changes, standalone pages, fonts, and generated output were retained. No dependency changes, deletions, source build, Git history changes, or deployment were performed. Build/test outcomes and the isolated package path are captured in `docs/FINAL_RELEASE_READINESS_REPORT.md`.
- **Still open:** Existing audit findings remain open unless individually addressed by their approved remediation reports. Commercial release gates still include owner confirmation of font binary provenance/licensing, browser/PWA acceptance, Vibe96 dashboard requirements and listing preview, and outstanding functional/accessibility checks. This phase is preparation, not a release approval.
