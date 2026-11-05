# MathForge — Final Release Readiness Report

**Date:** 2026-11-05
**Project inspected:** `D:\MathForge`
**Preparation state:** Technical packaging checks completed. This report is not a release approval, Vibe96 submission, or deployment.

## Summary

Prepared buyer-facing product and setup documentation, a repository architecture guide, Netlify static deployment configuration, a Vibe96 listing pack, and a staged distributable archive. The original project source and generated `dist/` were not rebuilt or overwritten. No dependencies were changed, no repository files were removed, and no commit, push, deployment, or Git history modification was performed.

The full automated suite passed in the isolated staged project. Source-only non-destructive tests, JavaScript syntax checks, and source-to-`dist` runtime hash comparisons also passed. Browser/PWA visual acceptance and owner-controlled Vibe96 submission remain open.

## Initial repository state preserved

At the start of this preparation, `main` was tracking `origin/main` and the working tree already contained these modifications/untracked deliverables from earlier authorized work:

```text
 M assets/css/tools/coordinates-tool.css
 M assets/css/tools/equation-plotter-workspace.css
 M assets/js/tools/coordinates-tool.js
 M assets/js/tools/equation-plotter-engine.js
 M assets/js/tools/standalone-adapters.js
 M dist/assets/css/tools/coordinates-tool.css
 M dist/assets/js/tools/coordinates-tool.js
 M dist/assets/js/tools/equation-plotter-engine.js
 M dist/assets/js/tools/standalone-adapters.js
 M dist/service-worker.js
 M docs/PROJECT_CHANGELOG.md
 M docs/PROJECT_STATUS.md
 M service-worker.js
 M tests/equation-plotter.test.js
 M tests/phase-4-8-pwa.test.js
 M tests/project-manager-save.test.js
?? docs/COORDINATES_POINT_CONNECTIONS_REPORT.md
?? docs/EQUATION_POINT_DRAGGING_REPORT.md
?? docs/FINAL_PRE_RELEASE_DEEP_AUDIT.md
?? tests/coordinates-connections.test.js
```

These files were preserved. This phase additionally modified or added only the files listed below. The separate `D:\MathForge-github-import-20261103` clone was not used.

## Changes in this preparation

- Replaced the placeholder [README.md](../README.md) with product overview, local run instructions, tool descriptions, K/N explanation, project storage/export behavior, offline/PWA requirements, deployment instructions, testing guidance, and known limitations.
- Added [AGENTS.md](../AGENTS.md) with a concise architecture map, compatibility considerations, and safe build/test guidance.
- Added [netlify.toml](../netlify.toml), using the same curated `scripts/prepare-vercel.mjs` build and `dist` output as `vercel.json`; it also maps `/open-project` to the workspace and sets service-worker/manifest headers.
- Added `tests/netlify-deployment-config.test.js` and updated `tests/phase-5-0-vercel.test.js` to expect the current 34-item app shell and explicitly assert Equation stylesheet precaching.
- Added [VIBE96_SUBMISSION_PACK.md](./VIBE96_SUBMISSION_PACK.md) with listing copy, capabilities, technical profile, deployment options, and owner checklists. It deliberately leaves dashboard-dependent fields and claims for owner confirmation.
- Updated [PROJECT_STATUS.md](./PROJECT_STATUS.md), [PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md), and appended remediation status to the original [FINAL_PRE_RELEASE_DEEP_AUDIT.md](./FINAL_PRE_RELEASE_DEEP_AUDIT.md). Historical findings remain visible and are not marked resolved by implication.
- Created this report.

**Removal/dependency changes:** None.

## Verification and results

| Check | Result |
|---|---|
| Source JavaScript syntax (`assets/js`, service worker, build script, tests) | **32/32 passed** with `node --check` |
| Source non-destructive suite, serial run, excluding the Vercel test that rebuilds `dist/` | **81/81 passed** with `node --test --test-concurrency=1` |
| Complete test suite on disposable staged copy, including the Vercel preparation and local HTTP preview test | **85/85 passed** |
| Vercel preparation build in disposable staged copy | **Passed**; generated the staged `dist/` |
| Netlify configuration regression test | Passed as part of the 85-test staged run |
| Source/runtime versus existing generated `dist/` hashes | **37/37 matched**; read-only check only |
| Browser/PWA testing | **Not performed in this phase** |
| Vibe96 dashboard submission or deployment | **Not performed** |

During verification, the first source suite run exposed an intermittent existing IndexedDB mock failure. A serial rerun passed all 81 non-destructive tests. The staged full run also identified a stale Vercel test assertion expecting 33 precache entries although the current service worker correctly declares 34 after the Equation stylesheet addition. The regression test was updated to expect 34 and check that stylesheet explicitly; the final staged suite passed 85/85. Earlier sandboxed preview attempts could not bind loopback; the final full suite ran with permission outside that restriction and its HTTP preview checks passed.

The project preparation script deletes and recreates `dist/`; it was run only in the disposable staging copy. The source project's existing `dist/` was not touched by this phase. Existing service-worker, standalone HTML, graph engine, project format, and font files were retained.

`git diff --check` passed for the Phase 3 tracked documentation/config/test edits, and a whitespace scan of the newly added text files found no trailing whitespace. A whole-tree check still reports trailing whitespace in pre-existing dirty generated `dist` assets; these are line-ending/autocrlf artifacts in previously modified files and were left untouched to preserve the user's existing work. The matching source/`dist` hashes confirm their bytes remain synchronized.

## Staging and archive

- Staging project: `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-20261105-142515`
- Distributable archive: `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-20261105-142515-final.zip`
- Contents are the curated static application source, generated `dist/`, tests, selected technical documentation, repository instructions, and listing pack. `.git`, backups, temporary harnesses, and unrelated repository material are excluded. Selected documentation is sanitized in the staging copy so local machine paths are not carried into the archive.
- Archive inspection completed: **112 entries**; no `.git`, backups, scratch directories, or temporary files were found. The staged source and generated output matched for all **37 runtime files** before packaging.

## Security, privacy, licensing, and release notes

- A static text scan found no likely credential patterns in the inspected current text files. This does not substitute for a Git-history secret scan or independent security review. No secret values are included in this report.
- Runtime assets are local; no external runtime CDN or font request was found in the inspected workspace. Project data is stored in browser-local storage or user-managed files; no cloud sync is provided.
- The upstream Kalpurush project publishes an OFL 1.0 license, but this repository does not establish that the included binary is byte-for-byte from that upstream source or include its applicable license text. Confirm provenance and commercial redistribution terms and include the required license before submission. The bundled fonts were not removed.
- Netlify configuration is covered by a configuration test; this is not a live Netlify deployment test. Vercel configuration was not changed.
- PNG/SVG fidelity differs by generator; some existing Cartesian/statistical SVG exports are raster-backed. This is disclosed in the README and listing pack.
- Vibe96 pricing, listing field requirements, supported package format, legal/support links, certification requirements, and account workflow were not verified in its dashboard. The owner must confirm them before upload.

## Remaining release gates

1. Manually open the staged or hosted app and verify all five generators, responsive layouts, project workflows, exports, standalone pages, and PWA offline update/cold-start behavior on target browsers/Windows.
2. Confirm Kalpurush binary provenance and licensing, and add applicable notices to the release package.
3. Review Vibe96's current dashboard fields, package rules, commercial terms, support/privacy requirements, and listing preview. Replace or qualify any marketing claim that exceeds verified behavior.
4. Capture reviewed screenshots and a short demo video; avoid including personal project data or unverified offline claims.
5. After owner approval, upload through the Vibe96 dashboard and perform an authorized hosted smoke test. No upload or deployment was done here.

## Final disposition at initial staging

**Technical preparation:** Complete for this phase.
**Automated checks:** Pass on the final staged run.
**Commercial release readiness:** Pending browser/manual acceptance, font license confirmation, and owner Vibe96 dashboard review/submission.

## Final submission sprint verification addendum — 2026-11-05

This addendum supersedes the earlier statements above that browser testing and screenshot capture had not been performed. It records the latest verification pass; later checks are authoritative where they differ from the initial staging results.

### Browser checks on the staged build

- Browser automation was already available; no dependency was installed. The staged `dist/` was served locally and exercised in Chrome.
- All five integrated generators were selected and their input/output states inspected. Equation, Coordinates, Ogive, Histogram, and Pie rendered in the shared workspace.
- All four standalone pages (`Coordinates_graph.html`, `Equation.html`, `Ogiveline.html`, `Polygonal.html`) loaded with a canvas and without a 404 state.
- Coordinates: plotted three points, explicitly closed a shape, enabled fill, and verified the filled triangle; entered/cancelled Connect Points mode. Clicking two point endpoints to create a connection remains unverified.
- Equation: `y = 2x + 3` and point A `(2,4)` rendered. Actual canvas point dragging remains unverified because the available browser automation surface did not expose canvas-position drag input.
- Pie: switched Pie/Donut and exercised independent output visibility combinations; category calculations remained visible in the selected sections.
- A version-1 `.mathforge` was saved through Save As, imported/opened, and its Pie categories restored. Local Save Project status reported success. PNG and SVG downloads were created and inspected; the SVG had an `<svg>` root and vector paths.
- At 390×844, the five-generator toolbar remained a single non-wrapping row with horizontal scrolling and the document stayed within the viewport width. The staged app was restored to a 1920×1080 viewport for captures.
- Installed-PWA update and cold-offline acceptance were not tested. No Vibe96 dashboard access, upload, or deployment occurred.

Five genuine browser captures (each decoded at exactly 1920×1080) are included in the final staged package:

1. `submission-screenshots/01-pie-chart-1920x1080.jpg`
2. `submission-screenshots/02-coordinates-shape-1920x1080.jpg`
3. `submission-screenshots/03-equation-plotter-1920x1080.jpg`
4. `submission-screenshots/04-ogive-1920x1080.jpg`
5. `submission-screenshots/05-histogram-1920x1080.jpg`

### Latest automated verification

| Check | Latest actual result |
|---|---|
| Source non-destructive suite | **80 passed / 1 failed of 81**. The failure repeated in isolation: `project and autosave recovery copy are committed together and can be reopened` (`tests/indexeddb-project-store.test.js`), where the fake IndexedDB test returned `undefined` before JSON parsing. No source fix was made during this verification-only sprint. |
| Full suite in staged copy | **84 passed / 1 failed of 85** on the latest run, the same IndexedDB test. A previous staged run passed 85/85; the latest repeat is reported as authoritative. Local HTTP preview and Vercel preparation coverage passed when run with loopback permission. |
| JavaScript syntax | **31/31 passed** using `node --check` for assets JavaScript, service worker, preparation script, and test JavaScript. |
| Source-to-`dist` runtime hashes | **37/37 matched**; comparison was read-only. |
| Source Vercel build | Not run because it replaces `dist/`. The preparation/build test ran only in the disposable staging copy. |

### Font, package, and commercial gates

The bundled font files were inspected. `assets/fonts/kalpurush.ttf` and `assets/bangla font/kalpurush.ttf` are identical in size (314,592 bytes) and SHA-256; `assets/bangla font/kalpurush ANSI.ttf` is a separate 113,300-byte binary. No local font license, provenance, or notice document was found. The exact binaries' source and commercial redistribution rights remain **NOT VERIFIED**; owner confirmation and applicable license documentation are required before commercial redistribution.

The staged package contains the five-generator source and runtime assets, `dist/`, all test files, selected technical documentation, setup/deployment instructions, and the five screenshots. The final ZIP's SHA-256 is recorded in its adjacent `.sha256` sidecar. A ZIP cannot include its own final hash without changing that hash.

### Current disposition

**Not ready for Vibe96 upload.** The repeated IndexedDB mock test failure, unconfirmed Kalpurush provenance/license, unverified equation-point dragging and manual connection endpoint interaction, untested installed-PWA/cold-offline behavior, unreviewed screenshot marketing suitability, unset support/update commitments, and unchecked Vibe96 dashboard requirements remain open gates. Browser success for tested workflows does not establish Vibe96 acceptance, license clearance, or deployment success.

## Final release blocker resolution — 2026-11-05

This section supersedes the earlier IndexedDB failure and automated-check results above. It records the resolution run requested after the final submission sprint. No project engine, project-store implementation, project format, source `dist/`, or existing final ZIP was modified.

### Root cause and fix

The failing assertion was in `tests/indexeddb-project-store.test.js`, not in the production IndexedDB store. The fake database used a fixed transaction-completion timer (2 ms) while its `get` and `getAll` request callbacks ran on separate zero-delay timers. Under normal timer scheduling, a transaction could report `oncomplete` before the request's `onsuccess`; the test store promise then resolved with `undefined`. This violates native IndexedDB's request-before-transaction-complete ordering.

The test double now tracks pending requests, buffers readwrite changes and commits them atomically after request success, and fires transaction completion only after all queued requests finish. A regression assertion checks that both project and autosave request-success events precede the same readwrite transaction completion, then verifies both records can be read back. **Production `assets/js/core/indexeddb-project-store.js` did not change.**

### Verification after the fix

| Check | Result |
|---|---|
| Failing test file, isolated | **6/6 passed**; before the fix, the isolated file had 5/6 passing and the recovery-copy readback failed. |
| Complete source non-destructive suite | **81/81 passed**, serial. Excluded only the Vercel preparation test that deletes/recreates `dist/`. |
| Complete suite in disposable staging copy | **85/85 passed**, including local HTTP preview and Vercel preparation. The preparation operated only on the disposable copy. |
| JavaScript syntax | **31/31 passed**. |
| Source-to-`dist` runtime hashes | **37/37 matched** after staged verification; source `dist/` remained intact. |
| `git diff --check` | Plain command flags CR characters on existing dirty CRLF files. `git -c core.whitespace=cr-at-eol diff --check` passed; the edited test file has no actual trailing spaces. No unrelated line-ending normalization was done. |

Files changed for this resolution: `tests/indexeddb-project-store.test.js`, `docs/FINAL_SUBMISSION_CHECKLIST.md`, and `docs/FINAL_RELEASE_READINESS_REPORT.md`. No dependencies were installed and no deployment, upload, or Git history change occurred.

### Font provenance and remaining checks

The identical Unicode binaries (`assets/fonts/kalpurush.ttf` and `assets/bangla font/kalpurush.ttf`, SHA-256 `83613A03E53AAD8337F2BE9FB974409A23C1D99B3B4B494567BA9D156C492B01`) embed metadata identifying Kalpurush, AVRO Font Development Project, and Tanbin Islam Siyam, with a SIL OFL 1.0 declaration and URL. The separate `assets/bangla font/kalpurush ANSI.ttf` binary (SHA-256 `BFB06B2360A558424C61405A29C24B09C70487757204814C6DD04621A2A9EEBC`) identifies Kalpurush ANSI / PYRS / version 1.001 but contains no embedded license record. No separate local font license or provenance document was found. **Exact binary provenance and commercial redistribution rights remain unverified**, especially for the ANSI binary; owner confirmation is required. The font files were not changed.

Previously identified manual checks remain open: Equation canvas point dragging, actual Coordinates endpoint clicks to create a connection, PWA install/update/cold-offline workflow, screenshot approval for marketing use, support/update commitments, and Vibe96 dashboard requirements. No browser test was added in this blocker-resolution task.

### Current disposition and package

**READY FOR OWNER REVIEW** means the technical blocker and automated checks are resolved; it is not commercial release clearance. Do not upload until the font redistribution rights and other owner-controlled release gates are resolved.

The pre-existing final ZIP was left unchanged. The separate package created after all required technical checks passed is:

- `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-20261105-blocker-resolved.zip`
- SHA-256: `2b86b011f40757951a34165c550f4fa8b52f8f036123aa12fe59a9baa1badf75` (also recorded in adjacent `MathForge-Vibe96-20261105-blocker-resolved.zip.sha256`)
- Staged build/test copy: `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-blocker-verification-20261105`

The exact checksum is recorded in this source report and sidecar. The archived report refers to the sidecar because embedding an archive's own final checksum would change that checksum.

## Commercial release candidate sprint — 2026-11-05

This addendum supersedes earlier release-gate status where this sprint produced newer evidence. The original blocker-resolved ZIP was preserved (SHA-256 `2b86b011f40757951a34165c550f4fa8b52f8f036123aa12fe59a9baa1badf75`). A new staging directory was created separately; the source `dist/` was not built or replaced.

### Kalpurush evidence and license notice

The bundled Unicode file `assets/fonts/kalpurush.ttf` is 314,592 bytes and SHA-256 `83613A03E53AAD8337F2BE9FB974409A23C1D99B3B4B494567BA9D156C492B01`. The duplicate at `assets/bangla font/kalpurush.ttf` has the same hash. I downloaded the official upstream release artifact `release/Kalpurush0.258ship.ttf` from [`potasiyam/Kalpurush`](https://github.com/potasiyam/Kalpurush/tree/master/release); its size and SHA-256 exactly match the bundled Unicode binary. The binary metadata names Kalpurush, AVRO Font Development Project, and Tanbin Islam Siyam, and declares SIL OFL 1.0. The upstream [README](https://github.com/potasiyam/Kalpurush/blob/master/README) also declares OFL 1.0 and identifies Tanbin Islam Siyam. The official historical [SIL OFL 1.0 text](https://scripts.sil.org/cms/scripts/page.php?id=ofl10_web&site_id=nrsi) is included verbatim as `LICENSES/OFL-1.0.txt` in the new candidate, together with `THIRD_PARTY_NOTICES.md` and required attribution.

There is a material version mismatch: the repository's current upstream [`LICENSE`](https://github.com/potasiyam/Kalpurush/blob/master/LICENSE) says copyright (c) 2022, Tanbin Islam Siyam, Reserved Font Name Kalpurush, and OFL 1.1; the matching binary and upstream README say OFL 1.0. I documented both declarations and did not treat them as interchangeable. Owner/legal confirmation is still required, so this report does not assert commercial license clearance.

`assets/bangla font/kalpurush ANSI.ttf` (SHA-256 `BFB06B2360A558424C61405A29C24B09C70487757204814C6DD04621A2A9EEBC`) was searched across integrated and standalone HTML/CSS/JS, build scripts, tests, and service-worker precache. It has no application references and no embedded license record. It is excluded from the RC package only; the source file is preserved. The duplicate Unicode font remains in the package.

### Browser acceptance and screenshot review

- Equation Plotter rendered `y = 2x + 3`. A real pointer drag moved point A from `(0,0)` to `(3.66048,5.47242)` and the controls reflected the new values. A subsequent drag ended outside the canvas and changed X to `9.70027` while Y stayed `5.47242`; the point remained editable. These interactions were performed in the pre-existing staged local HTTP preview (`127.0.0.1:8765`). The newly created RC server on port 8766 could not be reached by the browser, so these are not direct interactions with the newly copied RC directory.
- Coordinates: created test set points P `(-2,1)` and Q `(3,2)`, enabled Connect Points, and clicked their actual rendered marker locations. The UI reported “Line created,” and the P–Q segment appeared. Selecting a start point then cancelling exited connection mode; Clear All Connections removed the segment while keeping P and Q. The same existing staged preview caveat applies.
- PWA installation, cache confirmation, and true cold-offline relaunch are **NOT VERIFIED**. The available automation exposes no offline/network override, and the new RC preview port was inaccessible; no normal online load is presented as offline evidence.
- All five previous 1920×1080 genuine captures were visually inspected. Pie, Equation, Ogive, and Histogram show representative test data. The Coordinates image shows an empty plane despite its old `shape` filename. The candidate renames it `02-coordinates-workspace-1920x1080.jpg`; it is not owner-approved as a graph marketing example. No personal project details were observed in these captures.

### Seller and release package gates

No public HTTPS demo URL was supplied or published. Owner obligations remain: approve/replace the blank Coordinates screenshot; finalize the listing copy and price; review current dashboard fields and audit submission; review and sign the applicable Seller Agreement; explicitly confirm capacity for 12-month defect/security updates and 30-day buyer support with a two-business-day response; and accept responsibility for demo uptime. None of these actions was performed here.

The new RC is based on a separate copy, includes source, current generated `dist/`, tests, setup/deployment and technical documentation, five screenshot files, and the Unicode-font notice/license. It excludes `.git`, backups, scratch files, and the unreferenced ANSI binary. The existing source font files and prior ZIP remain intact. Before packaging, the candidate will be checked for absolute local paths, secrets, archive entry integrity, and source/test presence.

### Latest automated checks

| Check | Result |
|---|---|
| IndexedDB regression test isolated | **6/6 passed** after the test-double timing fix. |
| Source non-destructive suite | **81/81 passed**, serial; the source-mutating Vercel preparation test was excluded. |
| Full staged suite | **85/85 passed** in a disposable copy including preview/build coverage. The commercial RC will be rerun after packaging changes. |
| JavaScript syntax | **31/31 passed**. |
| Source-to-`dist` hashes | **37/37 matched**; source `dist/` remains untouched. |
| CRLF-aware `git diff --check` | Passed with `core.whitespace=cr-at-eol`; plain diff-check emits CRLF-related whitespace reports on pre-existing dirty worktree files, which were not normalized. |

### Final disposition

**NOT READY — BLOCKERS REMAIN.** Required owner/legal confirmation of the OFL 1.0/1.1 discrepancy, PWA cold-offline acceptance, a live HTTPS demo, an approved fifth screenshot, dashboard/Seller Agreement completion, price, support/update commitments, and uptime responsibility are unresolved. No upload, account creation, agreement signature, deployment, commit, or push occurred. A separate RC archive and SHA-256 sidecar were emitted after the final staged test/build and archive checks passed; exact details are in the final verification section below.

### Final RC verification and archive — 2026-11-05

The RC staging copy was rebuilt using `node scripts/prepare-vercel.mjs`; the destructive preparation ran only inside the separate RC directory. The complete suite in that staged copy passed **85/85**. The source non-destructive suite passed **81/81**. A first unprivileged broad source-suite attempt reported 82/85 because three localhost tests failed with `connect EACCES`; the complete staged run, including those HTTP tests and the build test, passed. JavaScript syntax passed **32/32**, source-to-source-`dist` SHA-256 comparison passed **37/37**, and `git -c core.whitespace=cr-at-eol diff --check` passed. No source `dist/` build occurred.

The new archive is `MathForge-Vibe96-RC-20261105-commercial.zip`, with final SHA-256 recorded below and in the adjacent `.sha256` sidecar. The prior blocker-resolved archive remains unchanged at SHA-256 `2b86b011f40757951a34165c550f4fa8b52f8f036123aa12fe59a9baa1badf75`.

**Final status: NOT READY — BLOCKERS REMAIN.** The candidate is for owner review only. The staged license directory contains the matched binary's declared OFL 1.0 text and a verbatim copy of the current upstream OFL 1.1 license; the discrepancy is documented, not resolved. Owner/legal clearance is still required. Browser tests were performed against the existing `127.0.0.1:8765` staged preview, not the fresh RC copy; PWA install/update/cold-offline remains **NOT VERIFIED**. The Coordinates screenshot is an empty workspace capture, not an approved marketing graph image. No public demo or Vibe96 dashboard/seller approval was supplied.

Archive: `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-RC-20261105-commercial.zip`  
SHA-256: `a81afac221ca015bd22f7793ae25db1fa04fd2b9a46125f9cc2a0347b46f8455` (also recorded in the adjacent `.sha256` sidecar). The archived report refers to the sidecar because including the archive's own final hash would change the hash.

## Noto Sans Bengali replacement verification — 2026-11-05

This addendum supersedes the earlier Kalpurush distribution concern for the current source tree. Runtime Bengali typography now uses a local Noto Sans Bengali variable font from the official Google Fonts repository. The bundled font is `assets/fonts/NotoSansBengali-VF.ttf`, SHA-256 `DCD42978094E584A849C84A51450EEAC40C8826057D566EA6D4B9627A403A05A`; the unmodified SIL OFL 1.1 notice is `assets/fonts/OFL-NotoSansBengali.txt`. Provenance and attribution are in `assets/fonts/README.md`. This is a record of the upstream font terms, not legal advice.

The source keeps all original Kalpurush files as archival data. They are not runtime dependencies; the curated build excludes the three legacy Kalpurush copies from generated `dist/`. The service worker now precaches Noto Sans Bengali under cache `mathforge-shell-v11`. Old `.mathforge` settings using the Kalpurush family are migrated to Noto Sans Bengali without changing the version-1 project format.

| Verification | Actual result |
|---|---|
| Focused font, typography, PWA, Pie export, and graph-design tests | **38/38 passed** |
| Source non-destructive automated suite | **87/87 passed**; destructive build test excluded from source workspace |
| Complete suite in disposable staging copy | **91/91 passed**, including Vercel preparation/preview checks |
| JavaScript syntax checks | **33/33 passed** |
| CRLF-aware `git diff --check` | **Passed** |
| Source `dist/` vs disposable generated `dist/` | **37 files each; 0 missing, 0 extra, 0 SHA-256 mismatches** |
| Browser smoke check | **Performed on localhost `dist/`**: switched among all five integrated generator selections; observed Bengali Pie title, labels, values, legend, calculations and drawing steps after entering values; Bengali text rendered in the local browser view |
| Cold-offline PWA launch and offline font retrieval | **NOT VERIFIED**; service-worker precache and local URL are covered by automated checks, but no cold-offline browser test was performed |
| Browser PNG/SVG download workflow and all-generator visual/export acceptance | **NOT VERIFIED in this pass**; automated export tests passed, including Pie SVG font embedding, and the full suite passed |

The Vercel preparation script was accidentally invoked once from the source project during this task, which regenerated `D:\MathForge\dist`. Its prior contents were restored from the existing local staging snapshot, then only the intended Noto runtime output changes were applied. The final read-only comparison against a fresh disposable build is exact for all 37 generated runtime files. No source assets, backup files, or ZIP archives were deleted or overwritten.

Existing release ZIPs were preserved and are stale: they still contain the old runtime font packaging and do not include the Noto font/license documentation. Rebuild a separate release archive from the current source only when authorized. The existing Kalpurush ambiguity is no longer a runtime-distribution issue for the current `dist`, because the old binaries are omitted there; they remain in source/backups as requested and are not deleted.

**Current commercial status: NOT READY.** Noto font packaging and automated technical checks are complete, but cold-offline acceptance, browser export acceptance, and earlier owner-controlled Vibe96/demo/support/legal release gates remain outstanding.
