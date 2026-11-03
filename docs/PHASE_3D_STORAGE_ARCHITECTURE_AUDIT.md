# MathForge Phase 3D — Local Project Storage Architecture Audit

**Date:** 2026-11-03  
**Status:** Audit complete; correction pass recorded in [PHASE_3D_CORRECTION_REPORT.md](./PHASE_3D_CORRECTION_REPORT.md)  
**Scope:** Existing-state audit and implementation blueprint only. No SQLite implementation, dependencies, or application behavior changes are included.

## Executive summary

MathForge is currently a static, offline-first web application. Its active workspace hosts the Coordinates Graph tool; Equation Plotter, Ogive, and Histogram/Polygon remain standalone pages. There is no project database, project serialization, project import, or browser/native storage integration. The workspace's initial document tab and tool-switch state are volatile JavaScript objects. Coordinates Graph is the only tool with a reusable `getState()` / `setState()` adapter; the legacy tools keep state in page controls and closures.

The approved hybrid direction is practical if its platform boundary stays explicit:

- Desktop: native SQLite in an application-owned user-data location; `.mathforge` project files are explicit portable copies.
- Browser served from a stable origin: SQLite WASM, with OPFS as the preferred file-backed option when the selected SQLite VFS and browser meet its requirements; use an IndexedDB-backed SQLite implementation only after it passes the same persistence and recovery tests.
- Direct `file://`: do not promise a persistent database. Keep the existing standalone pages functional and offer explicit portable project import/export only unless a future test matrix proves a durable backend for named browsers.
- All platforms: no account or cloud dependency. Browser persistence is origin-scoped and can be evicted; portable export remains essential.

Current code does not establish support for either native desktop packaging or browser SQLite persistence. The repository has no desktop-shell configuration, dependency manifest, or build/packaging configuration. This audit therefore recommends interfaces and test gates, not a platform-support claim.

## 1. Existing project structure and evidence

| Surface | Current role and storage/export observations |
|---|---|
| [index.html](../index.html) | Static workspace shell; has four tool entries, planned New/Open project controls, and disabled Save Project/SVG/PDF controls. The Save Project title mentions `.mathforge` as planned, but no implementation is wired. It loads classic scripts and does not request remote assets. |
| [workspace-core.js](../assets/js/workspace-core.js) | Keeps `activeTool`, one `activeDocument`, a fixed initial `openDocuments` tab, panel visibility, zoom, and status text in memory. Tool selection captures the outgoing adapter state and restores on mount rollback. There are no storage APIs or project serialization. |
| [coordinates-tool.js](../assets/js/tools/coordinates-tool.js) | Shared engine plus standalone bridge and workspace adapter. Implements `getState()` / `setState()` for Coordinates Graph and PNG data-URL export. Tool-switch state is volatile; no database or project-file import/export. |
| [common.js](../assets/js/common.js) | Shared math/DOM helpers, timestamp helper, and editable table-grid synchronization. No persistence layer. |
| [Coordinates_graph.html](../Coordinates_graph.html) | Standalone host for the shared Coordinates Graph engine. Exports a rendered PNG. |
| [Equation.html](../Equation.html) | Standalone inline-script plotter. Exports PNG; current UI state is page-local. |
| [Ogiveline.html](../Ogiveline.html) | Standalone inline-script ogive tool. Exports PNG and an SVG wrapper containing an embedded PNG image, not editable vector objects. |
| [Polygonal.html](../Polygonal.html) | Standalone inline-script histogram/frequency polygon tool. Exports PNG and an SVG wrapper containing an embedded PNG image, not editable vector objects. |
| `assets/css/` and `assets/img/` | Static CSS and logo; no project assets are currently imported by the tools. |
| `backups/` | Historical source backups, not an application backup or project recovery mechanism. |
| `docs/scratch/` | Existing ad hoc browser/regression harnesses and scripts; no configured test runner was found at repository root. |

Repository search found no use of `localStorage`, `sessionStorage`, IndexedDB, OPFS, `beforeunload`, `pagehide`, or a project import flow in the active app. Canvas PNG/SVG downloads are outputs, not editable project exports. The SVG paths in the two statistical tools embed a raster PNG.

The workspace advertises direct `file://` offline execution in source comments and earlier phase reports. That is evidence for the existing static app only; it is **not evidence** that WebAssembly module loading or persistent browser database APIs work from `file://`.

## 2. Complete reconstructable project state

Persist a versioned document JSON per tool. Preserve user-authored text exactly where possible, including invalid/in-progress text, instead of treating rendered canvas pixels or parsed values as the sole source of truth. Persist only state required to reproduce the project; recompute canvases, hit areas, parsed tables, and other derivable values on open.

| Tool/document type | Project data to persist | Do not persist |
|---|---|---|
| `coordinates-graph` | Every point set's stable ID, name, raw `inputText`, parsed point values and raw coordinate tokens where needed to retain per-point style association, marker color/shape, point label offsets, per-set polygon and diagonal options, active set ID; global margin, grid/axis visibility and styling, label visibility/precision, fonts, tick dimensions and offsets, canvas background, zoom, and pan offset. The textarea is authoritative for point text, but retain current valid point/style state if input can be invalid while an earlier rendering remains visible. | Drag state, cursor/hover, hit boxes, label-box cache, transform cache, canvas context/backing pixels, device-pixel ratio, observers/listeners, render queues. |
| `equation-plotter` | Mode (`function`/`points`), function expression, point text, point/label visibility, x/y squares per unit, minor square size, major interval, decimal count, zoom, curve width, axis/tick/point-label fonts, logical canvas dimensions, and origin/pan. Include per-point label offsets in the new document format: currently they live only in a closure array and are lost on reload. | Hit boxes, current drag mode/index, hover/cursor, canvas context/pixels, render caches. |
| `ogive-curve` | Table data (`lower`, `upper`, cumulative frequency) preserving text while editing; show-dot/point-label toggles; zoom; minor square size, major interval, y-label step, curve width; canvas dimensions, origin/pan; x/y units per square; axis annotation text, show/arrows flags, offsets and font; axis/tick/point fonts. Dragging a curve point changes cumulative frequency and rewrites table data, so persist the resulting rows. | Editable table DOM (rebuild it from persisted data), generated curve points, row indexes, hit circles, pan/drag state, cursor, canvas pixels. |
| `histogram-polygon` | Table data (`lower`, `upper`, frequency); histogram/polygon/midpoint-dot/midpoint-label toggles; zoom; minor square size, major interval, y-label step, bar opacity; canvas dimensions, origin/pan; x/y units per square; axis annotation text, show/arrows flags, offsets and font; axis/tick/midpoint fonts. | Derived row midpoints, boundaries, graph-paper rendering, editable table DOM, pointer state, hit/render caches, canvas pixels. |

**Assets:** No current tool exposes an asset-import control or stores imported assets. Keep asset storage available for future tool formats (e.g. uploaded images) but do not add assets to current snapshots unless the state actually references them. Do not treat generated PNG/SVG exports as source assets.

**Temporary workspace UI:** `activeTool`, keyboard focus, active pointer/drag, hover state, status messages, canvas backing dimensions, and current panel-collapse state are not project document content. If desired, panel visibility and last-opened project/tool belong in local `workspace_settings` / `recent_projects`, separately from project snapshots. Do not persist focus or live pointer state.

## 3. Platform feasibility and boundaries

### A. Desktop edition

The existing repository is not a desktop application: there is no Electron, Tauri, .NET, Java, native shell, or packaging manifest. Native SQLite is straightforward only after the desktop runtime is selected; keep the storage contract platform-neutral and put native opening, transactions, backup, and file dialogs behind that runtime's host adapter.

Recommended database lifecycle:

1. Store the multi-project catalog database in the OS per-user application data directory, not beside the executable or in the install directory.
2. Keep portable `.mathforge` files as user-selected, single-project SQLite databases. Opening one should import/copy it into the catalog or open it in a clearly defined external-project mode; never silently confuse the catalog with an exported file.
3. Use SQLite transactions for document+metadata writes. Enable foreign keys for every connection. Use WAL only where supported and appropriate; checkpoint/close cleanly before copying a live database.
4. Create a verified backup before schema migration and before version restore. Use SQLite backup API or a quiesced/closed DB copy, not a naive copy of a live WAL database.
5. On first run, create the catalog and migration ledger atomically. On migration failure, keep the backup, report the error, and leave the previous database recoverable.

The exact native binding, desktop user-data path, update/install behavior, and packaging lifecycle are unresolved because no desktop shell is present. No native SQLite runtime support is claimed by this audit.

### B. Browser edition

SQLite WASM is a feasible offline-local database engine, but persistent storage is a separate choice. SQLite's official WASM persistence documentation describes OPFS and a key/value VFS using local/session storage; it warns that the latter is small (typically around 5 MB), main-thread-only in the documented mode, and unsuitable for project databases. Do not use it as the durable fallback.

Recommended selection order:

1. Feature-detect the chosen SQLite WASM build and its OPFS VFS in the actual worker context. Use OPFS only if initialization, multi-transaction writes, reopen, recovery, export, and backup tests pass. SQLite's documentation notes worker requirements, COOP/COEP considerations for some OPFS modes, and Safari version caveats.
2. If OPFS is unavailable, use an explicitly selected and tested SQLite-WASM/IndexedDB persistence adapter. IndexedDB itself is a broadly available transactional browser storage API, but the browser API does not provide SQLite semantics automatically; the VFS/adapter is an implementation dependency that must be selected and tested.
3. Request persistent origin storage (`navigator.storage.persist()`) where available, expose the result to the user, and still communicate that browser storage may be cleared, quota-limited, or unavailable in private modes.
4. If neither durable adapter initializes, fail with a visible storage-unavailable error and offer portable `.mathforge` import/export. Never silently fall back to in-memory storage and report a successful save.

A browser database is scoped to the site origin/profile. Different hostnames, schemes, ports, browser profiles, and private sessions do not share projects. Offline-first describes operation without a remote service after the app assets are installed/available; it does not mean browser storage cannot be evicted. No account or cloud service is required.

### C. Direct `file://` mode

Do not treat `file://` as a localhost origin. The current static app can load local classic scripts and run without a server; that historical behavior does not prove that `WebAssembly.instantiateStreaming`, worker startup, OPFS, IndexedDB, or SQLite WASM VFS will work for all supported browsers when opened as a file URL. Browser handling of file origins and persistent storage is implementation-dependent, and the repository has no test evidence for database operation in this mode.

For `file://`, the safe defined capability is explicit file import/export initiated by the user, using browser-supported file selection/download flows. A file picker API may itself require a secure context/user activation and must not be assumed available. When unsupported, use ordinary `<input type=file>` plus download links. State the actual behavior in UI and keep export available before attempting destructive actions.

Until target-browser tests prove otherwise, persistent in-app database storage, autosave across reloads, project catalogue/recent list, OPFS, and IndexedDB persistence are unsupported in direct `file://` mode. Existing standalone tools remain available as-is; this audit does not change them.

## 4. Recommended shared storage contract

Define an asynchronous adapter whose operations return Promises on both platforms. Use the same logical document/snapshot format above the native and WASM drivers. See [PHASE_3D_STORAGE_ADAPTER_SPEC.md](./PHASE_3D_STORAGE_ADAPTER_SPEC.md) for signatures, errors, transaction boundaries, and save semantics.

The application should own UUID generation, schema/document validation, dirty tracking, and user-facing errors. Platform adapters own connection/worker lifetime, SQL transactions, VFS selection, native location resolution, and atomic project-file I/O. Tool adapters should export/import validated plain JSON document state; they should not access SQL directly.

## 5. Schema and portable file

The corrected schema proposal is version 2 in [PHASE_3D_SQL_SCHEMA_PROPOSAL.sql](./PHASE_3D_SQL_SCHEMA_PROPOSAL.sql). It uses relational project/document metadata and versioned JSON snapshots for tool-specific state. `projects.revision` is the project content compare-and-swap token; `project_documents.revision` tracks document content edits; `document_schema_version` independently tracks the JSON contract version. A failed/stale save rolls back both content and revision changes.

Asset rows are retained while referenced by current documents or retained snapshots. Trash is a recoverable soft delete: `trashed_at` hides the project from normal lists without removing documents, versions, or assets. Restore clears that marker. Permanent purge is a separate, explicit irreversible operation and removes link rows before project cascades so asset foreign keys do not block deletion. There is no automatic Trash expiration in this proposal.

Fresh-database bootstrap and upgrades are distinct: the migration runner owns `PRAGMA user_version`, applies only ordered pending migrations transactionally, records the migration ledger, verifies a pre-migration backup, and refuses automatic downgrade of newer databases. The corrected schema file documents a concrete v1-to-v2 migration.

A `.mathforge` file is a SQLite database containing one project and its documents, retained versions, and referenced assets. It is not a renamed app catalog database and should not rely on external sidecar files. Export from a transactionally consistent snapshot / SQLite backup API; import into a temporary DB, run integrity/schema/content checks, then commit/copy it into the app's local catalog. Reject malformed, unsupported-major, truncated, or over-limit files with an actionable error. Preserve unknown document fields when the schema/version policy permits forward-safe reading; never silently rewrite an unsupported project.

See the compatibility matrix for the explicit difference between project-file import/export and browser-native persistence.

## 6. Autosave, recovery, and failure policy

Recommended starting values (tune with the actual tools and test evidence):

- Track a monotonically increasing project content revision and per-document content revision, separate from document JSON schema version. `saveProject` compares `expectedRevision` inside the same immediate write transaction as document persistence; stale revisions return `REVISION_CONFLICT`, and failed writes leave all revision counters unchanged. Mark dirty on every user change, including text input, table edits, drag, point styling, zoom/pan, and view-option changes that affect reconstruction.
- Debounce autosave for **600 ms** after the last change; also cap the delay at **5 seconds** during continuous edits. Serialize one writer per project; coalesce pending writes to the newest revision.
- Save JSON and `updated_at` in one DB transaction. A save is clean only after the transaction commits and the persisted revision matches the current revision.
- UI states: `Saving…`, `Saved <time>`, `Unsaved changes`, and a persistent actionable `Save failed` state. On failure retain dirty data in memory, expose retry/manual export, and never display a success-shaped fallback.
- Snapshot versions on initial project creation, explicit manual save, before restore/replace, and periodically while dirty (recommended 5-minute minimum interval). Do not create a recovery version for soft delete: the project and its versions remain in Trash. Do not create a recovery version on every keystroke.
- Retain the newest **25** automatic/manual versions per project plus the most recent **7 daily** checkpoints; never prune the active backup needed for an in-progress restore. Make retention configurable only if real product requirements justify it.
- Before restore, create a recoverable pre-restore snapshot and then atomically replace document records and their asset references. A failed restore leaves the original project untouched.
- At startup, detect a prior unclean session marker, run SQLite integrity checks at a suitable recovery boundary, compare current autosaved revision with the latest retained version, and offer restore/recovery choices without overwriting newer recovered data. Trash recovery is a separate action that clears `trashed_at`; permanent purge is not recoverable.
- On storage quota, permission, VFS, or I/O errors, keep the document dirty, report exact failure class/message, and offer retry, export, or choose another supported location. Do not clear data or silently switch persistence engines.

`beforeunload` is only a best-effort last warning, not a save mechanism. Autosave must commit during normal editing and lifecycle events such as visibility changes; shutdown handlers should flush if possible but not be a prerequisite for durability.

## 7. Prioritized implementation sequence

| Priority | Work item | Exit criterion |
|---|---|---|
| **P0 — Review/gates** | Approve the storage contract, desktop shell, browser serving model, supported browser matrix, `.mathforge` compatibility policy, and backup/retention defaults. | No unresolved product choice is hidden inside an adapter. |
| **P1 — State contract** | Define per-tool JSON schemas and add capture/restore methods for all four tools, including Equation label offsets and validation of preserved raw input. | Round-trip fixtures reconstruct tool inputs, styles, and view. |
| **P2 — Native foundation** | Select desktop host and SQLite driver; implement migrations, catalog location, transactions, backup, and lifecycle. | Migration/reopen/crash tests pass on declared desktop OSes. |
| **P3 — Portable format** | Implement single-project `.mathforge` export/import, validation, atomic copy/replace, assets, and forward-version errors. | Cross-platform file round-trip and corruption/version tests pass. |
| **P4 — Browser persistence** | Select SQLite WASM build and worker/VFS. Implement OPFS path and tested IndexedDB fallback or explicitly narrow support. | Browser matrix passes actual save/reopen, offline, quota, private mode, and recovery tests. |
| **P5 — Project UX/autosave** | Wire create/open/list/save/save-as/rename/duplicate/delete, status, recent projects, autosave, versions, and restore. | End-to-end user flows and failure messaging meet the adapter spec. |
| **P6 — Release hardening** | Add packaging, migration/backup restore drills, performance/size limits, accessibility, and published support statements. | No support claims exceed tested evidence. |

This sequence is an audit recommendation only; it does not authorize or start the next implementation phase.

## 8. Technical risks, dependencies, and test strategy

### Risks and dependencies

- **State capture gaps:** Legacy tools have no adapter contract; Equation label offsets are closure-only. Raw text plus derived state needs explicit policy for invalid input.
- **Runtime not selected:** Native SQLite binding, application-data location, and packaging cannot be finalized until a desktop shell/host is chosen.
- **Browser storage variability:** OPFS worker/VFS requirements, browser versions, response headers, quota/eviction, private mode, and IndexedDB adapter behavior can vary.
- **Direct-file compatibility:** A static page working offline does not certify local database APIs; never overstate `file://` support.
- **Atomicity/backup:** Copying a live WAL database or replacing project rows outside a transaction risks data loss. Version restore and asset garbage collection need transaction ownership.
- **Portable file validation:** SQLite files can be corrupt, oversized, maliciously crafted, or use a newer schema; validate size, integrity, schema, JSON, asset references, and supported tool IDs before import.
- **Code-as-data:** Equation function expressions are currently evaluated by page code. A storage layer must preserve behavior and must not execute imported content during validation; rendering/evaluation policy remains a separate security review.
- **Build/deployment constraints:** SQLite WASM assets/worker need local packaging, offline loading, version pinning, and possibly COOP/COEP headers. No current build pipeline exists to verify those conditions.
- **No current imported assets:** Any asset API increases file-size, backup, and quota concerns; use explicit size limits and hash validation before enabling uploads.

### Required tests before support claims

1. **Document round trips:** Capture → serialize → validate → restore → compare every tool's input, option, style, point offset, and viewport values; include invalid/incomplete text and Unicode labels.
2. **CRUD/transactions:** Create/open/save/save-as/list/rename/duplicate/delete, concurrent save coalescing, rollback on injected write errors, and referential integrity.
3. **Autosave/recovery:** Debounce timing, continuous-input max-wait, process/page termination after commit boundaries, unclean marker, recovery choice, version creation/retention, restore with pre-restore backup.
4. **Portable `.mathforge`:** Export/import round trip, assets, same/different schema versions, empty/corrupt/truncated/oversized DB, missing/mismatched asset hash, invalid JSON, and no partial import.
5. **Platform matrix:** Exact browser+OS+version tests for OPFS/IndexedDB selection, worker initialization, private mode, denied persistence, quota, offline reopen, storage eviction simulation, and multi-tab contention. Test `file://` separately; pass only if durable DB behavior is actually demonstrated.
6. **Desktop:** Each declared OS, fresh install, upgrade migration, interrupted migration, backup/restore, permissions, read-only/full disk, close/reopen, and database move/recovery.
7. **Regressions:** Existing standalone pages and workspace tool switching, canvas rendering/interactions, exports, offline operation, accessibility, and zero unexpected console errors.

## Audit record

Inspected the five HTML pages, shared workspace/common scripts, Coordinates Graph shared engine, styles/assets tree, project status/changelog, Phase 3 integration report, and repository file/configuration inventory. Existing automated phase reports are historical evidence for their stated assertions only; no SQLite/browser persistence test was run as part of this audit. Browser-source references and their limits are recorded in [PHASE_3D_PLATFORM_COMPATIBILITY_MATRIX.md](./PHASE_3D_PLATFORM_COMPATIBILITY_MATRIX.md).
