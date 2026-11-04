# IndexedDB Save Reliability Report

**Date:** 2026-11-05

## Root cause

`project-manager.js` kept a single resolved `dbPromise` for the lifetime of the page. It never observed `IDBDatabase.versionchange` or `close`, so a browser-closed connection remained cached and later calls attempted `db.transaction(...)` on that stale connection. This produced the footer error, “The database connection is closing.”

Two related reliability issues were addressed: project and autosave recovery records were written in separate transactions, and concurrent autosave/manual-save/file-write operations could overlap. The notice helper also copied the same error to both footer and status bar.

## Changes

- Added `assets/js/core/indexeddb-project-store.js`, a shared connection manager. It reuses a live connection, invalidates it on `versionchange` and `close`, safely reopens it, reports open/blocked failures, and retries at most once when a transaction cannot start because the connection closed. Transaction aborts/errors are surfaced without blind retries.
- Changed `assets/js/project-manager.js` to use the shared store; project and autosave recovery records now commit in one read/write transaction. Manual/autosave operations are queued; the newest workspace snapshot is captured when its queued save begins. Hide/page-exit lifecycle handlers flush pending local changes. Save status is kept in the footer and distinguishes `Saving...`, local save success/failure, and download outcomes.
- Changed `assets/js/core/project-file-adapter.js` to queue writes to the associated file handle.
- Changed `index.html` and `service-worker.js` to load and cache the storage module; the shell cache name was advanced to `mathforge-shell-v7`.
- Added/updated `tests/indexeddb-project-store.test.js`, `tests/project-manager-save.test.js`, `tests/phase-4-8-pwa.test.js`, and `tests/phase-5-0-vercel.test.js`. Project Manager tests cover queued saves after graph switching, K/N edits and rename, plus download/import/re-save with data intact.
- Updated the project status and changelog.

The `.mathforge` serialization remains `mathforge-project` version 1. Older files without optional shared graph-design settings remain supported by the existing loader.

## Verification performed

- `node --check` passed for the changed storage, Project Manager, adapter, service worker, and test files.
- `node --test tests/*.test.js` — **39/39 passed** on the final run. Coverage includes first initialization and reuse, atomic project/recovery save and reopen, rapid queued saves, version change/close/reopen recovery, one bounded retry, blocked initialization, adapter write serialization, saves after graph switching/K/N edits/rename, and Save File As download followed by import/re-save with data intact.
- `node scripts/prepare-vercel.mjs` completed successfully.
- SHA-256 comparisons matched source and `dist/` for `index.html`, `service-worker.js`, `assets/js/project-manager.js`, `assets/js/core/project-file-adapter.js`, and `assets/js/core/indexeddb-project-store.js`.

The first sandboxed full-suite run could not access the Vercel test server on localhost (`EACCES`). The suite was rerun with localhost permission. One intermediate parallel run also exposed a timing failure in the fake IndexedDB test harness; that test passed in isolation and the final full run passed 39/39.

## Not performed / remaining manual checks

The actual local `D:\MathForge\index.html` was opened in Chrome and inspected. It displayed the expected MathForge workspace and reported that it recovered the most recent project from browser storage. The UI automation layer then rejected the requested Save click because it detected concurrent user input; no save, navigation, or other browser-side state change was performed. Therefore real-browser save completion, IndexedDB close/reopen events, page navigation flush, native Save File As picker, and interactive workspace save flows remain unverified. The automated Save File As test covers the browser-download fallback and reopens the resulting version-1 project through the Project Manager loader.

Suggested manual check: open the workspace in a browser, save a project locally, close/reopen the tab and confirm recovery; then rapidly make changes and save, rename and save, switch graph types and change K/N scales before saving; open an existing `.mathforge` file and save again; finally use Save File As (including the download fallback where supported), reopen that file, and check the project state. Confirm the footer reports success only after successful writes and shows a single failure message when storage is unavailable.
