# MathForge Phase 3D — Platform Compatibility Matrix

**Evidence checked:** 2026-11-03  
**Project test status:** No native SQLite, SQLite WASM, IndexedDB, or OPFS test was run for this audit. Matrix entries distinguish documented API feasibility from verified MathForge support.

| Platform/runtime | Candidate persistence | Evidence and constraints | Current MathForge claim / decision |
|---|---|---|---|
| Desktop host (not present in repo) | Native SQLite catalog in OS user-data directory; portable SQLite `.mathforge` files | Requires selecting a desktop shell, native binding, OS paths, packaging/update lifecycle, and backup API. No desktop config or manifest was found. | **Not implemented / not tested.** Architecture approved, implementation and support unclaimed until the runtime and OS matrix pass. |
| Browser, stable HTTP(S) origin | SQLite WASM worker + OPFS VFS (preferred where supported) | SQLite's WASM persistence docs describe OPFS-backed VFS and worker-thread requirements; OPFS VFS may depend on cross-origin isolation headers / SharedArrayBuffer. The same docs list Chromium-derived browsers, Firefox 111+, Safari 16.4+ as known API baselines, with a specific warning that Safari versions below 17 are incompatible with the current OPFS VFS (alternatives may apply). Those are upstream documentation notes, not MathForge certification. | **Candidate only.** Must test the exact selected SQLite build/VFS, target browser versions, deployment headers, offline restart, quota failure, worker, locking, backup, and recovery before claiming support. |
| Browser, stable HTTP(S) origin without working OPFS | SQLite WASM + a tested IndexedDB-backed SQLite VFS/adapter | MDN documents IndexedDB as asynchronous, transactional, same-origin storage for significant structured data/blobs. IndexedDB alone does not provide SQLite semantics; a VFS/adapter must bridge it. SQLite's documented local/session storage VFS is not an adequate replacement: typically small (around 5 MB), limited to one database per storage object, and unsuitable for project databases. | **Fallback candidate, not selected or tested.** Select an adapter and verify transactional commit, database image durability, crash behavior, and multi-tab locking. Do not silently downgrade to memory or localStorage. |
| Browser private/guest mode or denied/quota-limited storage | Same backends, but capability can be reduced | SQLite docs warn storage capabilities/quotas may be reduced or persistence unavailable in private/guest browsing. MDN explains browser origin storage is best-effort by default and may be evicted; `navigator.storage.persist()` can request persistence but approval is browser-dependent. | Show an explicit storage warning/failure. Keep user-directed `.mathforge` export/import available. No guaranteed persistence claim. |
| Direct `file://` | User-directed `.mathforge` file import/export only, until proven otherwise | SQLite WASM OPFS requires a worker and API/VFS support; browser `file:` origin behavior is not equivalent to serving from HTTP(S). IndexedDB and OPFS availability/durability under file URLs is not established by this repository or by a MathForge test. File picker support may also be restricted. | **Persistent in-app DB unsupported by this audit.** Preserve existing static offline tools; use ordinary file input/download fallback where available. Do not claim autosave, project catalogue, recent projects, OPFS, or IndexedDB persistence under file URLs. |

## Browser decision rules

1. Detect the actual loaded WASM/VFS capability in the context in which the DB runs; do not infer support from a browser name alone.
2. Prefer OPFS when the SQLite VFS initializes and its complete MathForge test suite passes. Respect worker, SharedArrayBuffer/COOP/COEP, storage lock, and browser-version requirements.
3. Try the approved IndexedDB-backed SQLite adapter only if OPFS is unavailable. The adapter is a dependency decision and must be recorded before implementation.
4. If both are unavailable or fail, report a durable-storage error and allow portable file operations. Never show “Saved” for an in-memory-only database.
5. Request persistent storage where available, but still provide export/backup because the request may be denied and user/browser actions can remove data.
6. Treat `file://` as a separate test target. Do not reuse localhost results as evidence for file URLs.

## Evidence sources

- [SQLite WASM persistence documentation](https://sqlite.org/wasm/doc/trunk/persistence.md) — OPFS, key/value VFS, worker requirements, known browser/API notes, Safari caveat, and COOP/COEP behavior. Upstream documentation can change; re-check the selected release at implementation time.
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — asynchronous structured storage, transactions, and same-origin policy.
- [MDN StorageManager.getDirectory()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory) — OPFS root handle and security/private-mode exceptions.
- [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — per-origin storage, best-effort/persistent behavior, and persistence requests.

## Certification gate

Publish a supported-platform statement only after recording browser/OS/runtime versions and passing the matrix tests in [PHASE_3D_STORAGE_ARCHITECTURE_AUDIT.md](./PHASE_3D_STORAGE_ARCHITECTURE_AUDIT.md): new install, save/reopen offline, clean/unclean shutdown, quota and permission failure, schema upgrade, project-file import/export, corruption handling, and multi-tab behavior. None of those tests was executed for Phase 3D.
