# MathForge — Final Submission Checklist

**Date:** 2026-11-05
**Project:** `D:\MathForge`
**Scope:** Release blocker verification and minimal IndexedDB mock-timing correction. No feature development, engine changes, source build, commit, push, deploy, or upload.

## Package and documentation

| Requirement | Status | Evidence / note |
|---|---|---|
| Staged ZIP exists and opens | **PASS** | Repackaged curated archive is inspected after inclusion of screenshots and current submission documentation; final entry count is recorded in the readiness report. SHA-256 is recorded in the adjacent `.sha256` sidecar because an archive cannot contain its own final checksum. |
| Archive includes source HTML/CSS/JS and all five generator runtime code | **PASS** | Includes the curated source root, `assets/`, standalone pages, and generated `dist/`. |
| Archive includes tests and technical documentation | **PASS** | Includes all current `tests/*.test.js`, selected implementation/audit reports, project status/changelog, this checklist, and Vibe96 pack. |
| Archive includes setup instructions | **PASS** | Root `README.md` and the Vibe96 pack describe hosted use and local localhost setup. |
| Archive includes required runtime assets | **PASS** | Includes the service worker, manifest/icons, stylesheets, JavaScript engines, and bundled font files. |
| README matches current five-generator app | **PASS** | Lists Coordinates, Equation, Ogive, Histogram, and Pie Chart; documents project storage, exports, offline constraints, build/test commands, and limitations. |
| AGENTS repository paths match current source layout | **PASS** | Verified against `assets/js/`, `assets/js/core/`, `assets/js/tools/`, `scripts/`, `tests/`, and `dist/`. |
| Vibe96 pack contains overview, features, stack, requirements, clean-machine steps, deployment, limitations, and local-data privacy | **PASS** | Present in `docs/VIBE96_SUBMISSION_PACK.md`. |
| Vibe96 pack states support/update position | **PASS** | It records that no support email, response SLA, update cadence, or long-term guarantee is currently published and asks the owner to set real listing commitments. |
| Vibe96 dashboard-specific requirements and listing review | **NOT VERIFIED** | Dashboard was not accessed; the owner must confirm current required fields, package format, terms, and buyer-facing preview. |

## Browser smoke tests

| Requirement | Status | Evidence / note |
|---|---|---|
| Browser automation already available; no dependency installed | **PASS** | Existing browser automation controlled a locally served staged build. |
| Switch among all five integrated generators | **PASS** | All five selection states and their input/output regions were inspected in the staged browser. |
| Equation graph render | **PASS** | The sample `y = 2x + 3` rendered on the shared canvas; point A `(2,4)` was visible in the 1920×1080 screenshot. |
| Equation point dragging | **PASS** | Real pointer drag moved Equation point A from `(0,0)` to `(3.66048,5.47242)`; an additional drag released outside the canvas and updated X to `9.70027` while Y remained `5.47242`. The input value and plotted position changed. |
| Coordinates independent points and explicit shape closure/fill | **PASS** | Three points were plotted, the closed-shape action was used explicitly, fill was enabled, and the resulting polygon appeared on canvas. |
| Coordinates manually create a connection by clicking two points | **PASS** | In a new set, plotted P `(-2,1)` and Q `(3,2)`, enabled Connect Points, clicked both actual canvas marker locations, and observed the “Line created” status and P–Q line. Selecting a pending start then cancelling returned to normal mode. Clear All Connections removed the line while preserving P and Q. |
| Ogive and Histogram rendering | **PASS** | Both staged tools showed their table inputs and graph output; 1920×1080 screenshots were captured. |
| Pie chart rendering and independent section visibility | **PASS** | Pie/Donut mode and output sections were toggled; hidden outputs reflowed and the table/drawing-step combinations remained available. |
| All four standalone HTML pages | **PASS** | `Coordinates_graph.html`, `Equation.html`, `Ogiveline.html`, and `Polygonal.html` each loaded with one canvas and no 404 state. |
| Save Project, Save As, and import/open of `.mathforge` | **PASS** | Local save status reported success; Save As produced a version-1 file; importing it restored Pie category values and state. |
| PNG and SVG exports | **PASS** | PNG and SVG downloads were produced. The imported Pie SVG has an `<svg>` root and vector paths; `.mathforge` remained version 1 with Pie state. |
| Desktop layout screenshot resolution and visual review | **PASS WITH ACTION** | Five genuine captures are exactly 1920×1080. Four show their graph examples. The Coordinates capture is an empty plane; it is accurately relabeled as a workspace view and is not approved as a marketing graph example. Owner must replace/approve it. |
| Narrow layout around 390×844 | **PASS** | At 390×844 CSS viewport, the five-tool row remained `nowrap` with horizontal overflow; document width stayed within the viewport (no page-level horizontal overflow). |
| PWA install/update/cold-offline browser workflow | **NOT VERIFIED** | Available browser automation had no offline/network override; the new staged server was not reachable from it. No offline simulation was substituted for a real installed-PWA cold-start. |

## Font licensing and commercial release

| Requirement | Status | Evidence / note |
|---|---|---|
| Inspect bundled font files and source metadata | **PASS** | `assets/fonts/kalpurush.ttf` and duplicate `assets/bangla font/kalpurush.ttf` both hash to `83613A03E53AAD8337F2BE9FB974409A23C1D99B3B4B494567BA9D156C492B01`; that exactly matches upstream `release/Kalpurush0.258ship.ttf` (314,592 bytes). Font metadata names Kalpurush, AVRO Font Development Project, Tanbin Islam Siyam, and OFL 1.0. Upstream README says OFL 1.0; current upstream `LICENSE` says OFL 1.1. ANSI (`BFB06B2360A558424C61405A29C24B09C70487757204814C6DD04621A2A9EEBC`) has no license record and no runtime/build/app references; excluded from candidate only, retained in source. |
| Include font license text and required notice in candidate | **PASS WITH REVIEW** | Candidate contains official archived SIL OFL 1.0 text, Kalpurush attribution, source path, and hash. The upstream version conflict is documented; this inclusion is not a legal determination. |
| Confirm commercial redistribution rights | **NOT VERIFIED** | The exact Unicode release is attributable to upstream, but the binary/README OFL 1.0 declaration conflicts with the current upstream repository LICENSE (OFL 1.1). ANSI is excluded. Owner/legal confirmation is required before commercial redistribution. |
| Vibe96 commercial upload readiness | **NOT READY** | Font version clearance, PWA cold-offline acceptance, public demo, screenshot approval, Seller Agreement review/signature, dashboard/audit, price, and support/update commitments remain open. |

## Automated checks

| Check | Status | Result |
|---|---|---|
| IndexedDB project-store test, isolated | **PASS** | Before fix: 5/6 passed; readback returned `undefined` because the fake transaction's fixed timer could fire before fake request callbacks. After fix: 6/6 passed; explicit event-order assertion confirms both writes' request-success events precede the shared readwrite transaction completion. |
| Source non-destructive automated suite | **PASS** | Latest run: 81/81 passed serially. The Vercel preparation test that replaces `dist/` was excluded from the source workspace run. |
| Full staged automated suite | **PASS** | Latest run in a disposable copy: 85/85 passed, including localhost preview and staged Vercel preparation coverage. |
| JavaScript syntax checks | **PASS** | Final RC verification: 32/32 passed (`assets/js`, service worker, preparation script, and tests). |
| Source/generated `dist/` parity | **PASS** | 37/37 SHA-256 comparisons matched after staged build; source `dist/` was not modified. |
| `git diff --check` | **PASS WITH CRLF SETTING** | Plain invocation reports carriage-return line endings in pre-existing dirty files as trailing whitespace. `git -c core.whitespace=cr-at-eol diff --check` passed; the changed IndexedDB test file also has no actual trailing whitespace. |

## Screenshot files

All five screenshots are genuine browser captures from the staged local build at exactly 1920×1080:

- `submission-screenshots/01-pie-chart-1920x1080.jpg`
- `submission-screenshots/02-coordinates-workspace-1920x1080.jpg` (empty plane; not approved as a graph example)
- `submission-screenshots/03-equation-plotter-1920x1080.jpg`
- `submission-screenshots/04-ogive-1920x1080.jpg`
- `submission-screenshots/05-histogram-1920x1080.jpg`

See the readiness report and adjacent archive `.sha256` sidecar for absolute archive paths, SHA-256, verification caveats, and the final upload recommendation.

## IndexedDB blocker resolution

Root cause was a timing-inaccurate fake IndexedDB in `tests/indexeddb-project-store.test.js`: it fired transaction completion after a fixed delay without waiting for queued request events. The read promise could resolve before the fake `get` request's `onsuccess`, yielding `undefined`. The fake now queues request events, buffers writes until transaction completion, commits them together, and fires completion only after all requests succeed. Regression assertions check request/transaction order and reopen both persisted records. Production `assets/js/core/indexeddb-project-store.js` was not changed.

**Current disposition: READY FOR OWNER REVIEW.** The technical IndexedDB blocker and required automated checks pass. This is not commercial clearance or authorization to upload; Kalpurush redistribution rights remain unverified.

The existing final ZIP was preserved. The separately verified blocker-resolution package is `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-20261105-blocker-resolved.zip`. SHA-256: `2b86b011f40757951a34165c550f4fa8b52f8f036123aa12fe59a9baa1badf75` (also in the adjacent `.sha256` sidecar).

## Noto Sans Bengali replacement addendum — 2026-11-05

This addendum supersedes the older checklist rows that described Kalpurush as the current runtime font. The original Kalpurush binaries remain in the source tree; they are not referenced by runtime styling and are excluded from the current generated `dist/`. Do not interpret this as changing historical archive contents: existing ZIPs were left untouched and need rebuilding before release.

| Requirement | Status | Evidence / note |
|---|---|---|
| Use official Google Fonts Noto Sans Bengali locally | **PASS** | `assets/fonts/NotoSansBengali-VF.ttf`; variable axes `wght` 100–900 and `wdth` 62.5–100; official source, commit and SHA-256 documented in `assets/fonts/README.md`. |
| Include OFL and attribution with application assets | **PASS** | Verbatim OFL 1.1 text is bundled at `assets/fonts/OFL-NotoSansBengali.txt`; attribution metadata is documented beside it. |
| Remove Kalpurush from current release output without deleting source copies | **PASS** | Current `dist/` excludes the three legacy font files; source/archive backups remain. Build script exclusion is tested. |
| Replace runtime font references and preserve old project compatibility | **PASS** | Shared CSS, graph typography/renderers, Pie SVG export and selector use Noto; saved `Kalpurush` family setting migrates to Noto; version-1 format is unchanged. |
| Automated font/PWA/export checks | **PASS** | Focused tests: **38/38**; complete source non-destructive suite: **87/87**; full disposable-stage suite: **91/91**. |
| JavaScript syntax and generated output parity | **PASS** | Syntax: **33/33**; `dist/` comparison: **37/37 files**, zero missing/extra/hash differences. |
| Browser Bengali rendering smoke check | **PASS, LIMITED** | Local browser showed Bengali Pie chart title, labels, numerals, legend, table and drawing steps using Noto after values were entered. All five generator selection states were switched and observed. |
| Cold-offline loading, all viewport sizes, browser PNG/SVG download | **NOT VERIFIED** | Automated local precache/export checks are not a substitute for actual offline browser and download acceptance. |
| Current existing ZIP contains Noto font and notices | **FAIL / REBUILD REQUIRED** | Existing ZIPs were preserved unchanged and predate this font replacement. Rebuild a new archive from current source when authorized. |
| Commercial upload readiness | **NOT READY** | Cold-offline/browser export checks and owner-controlled listing, seller, demo, screenshot and support commitments remain open. |

## Commercial release candidate sprint — 2026-11-05

This latest section supersedes the owner-review disposition above. The exact Unicode font hash matches the official upstream release and the candidate includes the OFL 1.0 text/notice, but upstream's current LICENSE is OFL 1.1. Owner/legal confirmation is still required. The ANSI font is unreferenced by the application, standalone pages, build scripts, service worker, and tests; it is omitted only from this candidate package and remains untouched in the source tree.

Equation dragging and Coordinates endpoint connection/cancel/clear were exercised with real browser pointer coordinates on the existing localhost preview. The new RC server could not be reached by browser automation. PWA install/cache/cold-offline is therefore **NOT VERIFIED**. The Coordinates screenshot is blank, relabeled as a workspace capture, and not approved as a graph marketing example.

### Vibe96 seller checklist

| Owner action | Status |
|---|---|
| Live public HTTPS demo URL | **NOT PROVIDED** |
| Five owner-approved screenshots | **NOT COMPLETE**; Coordinates sample is blank and requires replacement/approval. |
| Final description, stack, requirements, and price | Technical copy drafted; owner must approve copy and set price. |
| Seller Agreement version and owner signature | **NOT REVIEWED OR SIGNED** |
| Confirm 12-month defect/security updates and 30-day buyer support with two-business-day response | **OWNER CONFIRMATION REQUIRED**; these are not current MathForge commitments. |
| Current dashboard fields and audit submission | **NOT VERIFIED** |
| Demo uptime responsibility | **OWNER CONFIRMATION REQUIRED** |

**Final status: NOT READY — BLOCKERS REMAIN.** No commercial upload or deployment is authorized or performed. The separate RC archive was created after the staged technical checks passed; its path and SHA-256 are recorded in the final readiness report and adjacent sidecar.

## Final RC verification addendum — 2026-11-05

The separate candidate at `MathForge-Vibe96-RC-20261105` was rebuilt and its complete staged test suite passed **85/85**. The source non-destructive suite passed **81/81**; it excludes `phase-5-0-vercel.test.js`, which prepares/replaces `dist/`. An initial unprivileged broad source invocation produced 82 passes and 3 localhost `EACCES` failures in that Vercel test; the staged complete suite subsequently passed with localhost access. JavaScript syntax passed **32/32**, source-to-`dist` SHA-256 comparison passed **37/37**, and CRLF-aware `git diff --check` passed. The source `dist/` was not run through the preparation script.

The RC contains `LICENSES/OFL-1.0.txt` as the version declared by the hash-matched binary and upstream README, plus a verbatim copy of the current upstream OFL 1.1 `LICENSE` for transparent review. The conflict is unresolved; commercial redistribution rights are **NOT VERIFIED**. Cold-offline PWA behavior, the public demo, owner-approved screenshots, seller agreement, listing price, dashboard requirements, support/update obligations, and demo uptime responsibility also remain unresolved.

The candidate archive is `C:\Users\Dell\.codex\visualizations\2026\11\04\01a1a5eb-ac96-7c13-885a-374dcf97b325\MathForge-Vibe96-RC-20261105-commercial.zip`; SHA-256: `a81afac221ca015bd22f7793ae25db1fa04fd2b9a46125f9cc2a0347b46f8455` (also in its adjacent `.sha256` sidecar). The archived report points to the sidecar because including an archive's own hash inside that archive would change the hash.

**Final status: NOT READY — BLOCKERS REMAIN.** The package is a technical release candidate for owner review only, not a commercial upload recommendation.
