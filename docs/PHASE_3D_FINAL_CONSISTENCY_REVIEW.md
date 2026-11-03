# MathForge Phase 3D — Final Consistency Review

**Review date:** 2026-11-03  
**Scope:** Documentation/schema-proposal consistency and in-memory SQL validation only. No runtime, UI, dependency, platform-strategy, or Phase 3E work.

## Result summary

The corrected Phase 3D documents now agree on the hybrid storage direction and recoverable Trash lifecycle. Genuine gaps were corrected: the migration validation/order, canonical migration source, complete method contract, and recent-project behavior. A validation fixture now extracts and executes the exact migration SQL block from the adapter specification.

## Consistency findings and corrections

| Area | Review finding | Correction / verified contract |
|---|---|---|
| Project lifecycle | Trash, restore, and permanent deletion needed consistent recent-list behavior. | `deleteProject()` sets `trashed_at` and removes the recent row atomically; it does not remove content. `restoreProject()` clears Trash and does not add a recent row until a successful open. The recent-list query excludes trashed projects. `purgeProject()` requires explicit confirmation, removes reference rows, then permanently deletes the project and owned rows. |
| API details | The original method list did not uniformly state arguments, result values, errors, and transaction boundaries. | Added a per-method contract table to the adapter spec. `expectedRevision` is the project content CAS token for `saveProject`, `saveAs`, and `restoreVersion`; document content revision remains separate from `document_schema_version`. |
| Migration source | The schema proposal described migration steps while the adapter contained the executable SQL, leaving ambiguity about which was validated. | The adapter-spec v1→v2 SQL block is canonical; the SQL proposal labels its migration as an outline. The test extracts and executes the canonical block verbatim. |
| Migration ordering | `foreign_key_check` was mentioned but not actually run before migration ledger/version updates. | The canonical migration executes `PRAGMA foreign_key_check` before inserting the v2 ledger row or setting `user_version`; the harness inspects the returned rows and rejects any violation. The adapter text now states this ordering. |
| Asset integrity | Project-scoped assets and retained-version references needed explicit deletion/duplication semantics. | Assets are scoped by `(project_id, asset_id)` and cannot be shared across projects. Current-document and retained-version link FKs restrict asset deletion. Duplicate IDs/references are remapped; purge removes links before cascading owned rows. |

### API contract check

The adapter contract now documents arguments, success return shape, operation-specific errors, and transactional/read behavior for `initialize`, `createProject`, `openProject`, `saveProject`, `saveAs`, `listProjects`, `renameProject`, `duplicateProject`, `deleteProject`, `restoreProject`, `purgeProject`, `exportProject`, `importProject`, `listVersions`, `restoreVersion`, and `close`.

The following invariants agree across the adapter, schema, and architecture audit:

- `deleteProject()` is recoverable soft-delete; `restoreProject()` restores it; `purgeProject()` is irreversible.
- `projects.revision` is the project-level CAS token. `project_documents.revision` tracks document content; `document_schema_version` tracks JSON structure.
- Project, initial documents, initial snapshot, and version asset references are created atomically.
- A failed/stale write rolls back content and revision changes. Dirty state remains unsaved until commit succeeds.
- Trash preserves documents, snapshots, and assets. Purge removes reference links before project cascades. Retained version links prevent asset garbage collection.
- Recent rows are removed on Trash/purge and re-created only after a successful open following restoration.

### v1→v2 migration comparison

The validation fixture is not a hand-recreated approximation: it extracts the fenced migration SQL from [PHASE_3D_STORAGE_ADAPTER_SPEC.md](./PHASE_3D_STORAGE_ADAPTER_SPEC.md), executes its statements in order, and inspects `PRAGMA foreign_key_check` at the point represented by the SQL. It binds only the documented `:now` parameter.

The exact migration and assertions verify:

- Existing `document_json` text is unchanged.
- `document_version` maps to `document_schema_version`; document revision initializes to 1.
- Projects with existing documents initialize at project revision 1.
- Both `document_assets` and `project_version_assets` relationships survive their table rebuilds.
- Legacy `before-delete` reasons map explicitly to `manual`.
- The existing project-updated index remains, and all required rebuilt/new indexes exist.
- The foreign-key check occurs before the v2 migration ledger insert, `PRAGMA user_version = 2`, and commit.
- An injected failure immediately before commit—after the SQL has staged the schema, ledger row, and `user_version` update—followed by rollback restores the original v1 columns, `user_version`, ledger, reason, data, and asset relationship.

This validates the documented migration SQL in an in-memory fixture, not a production database migration or backup/restore procedure.

### Trash and asset integrity

The executed checks confirm soft-delete retains project documents, versions, and assets; removes recent-list membership; and restoration preserves versions without marking the project recent. A stale recent row is also excluded by the documented active-recents query. Asset deletion is rejected while either current or version references exist; an unreferenced asset can be collected. The duplicate fixture uses new project/document/asset IDs and remapped current/version links. Purging the duplicate after removing reference links leaves no owned asset/version/recent rows and passes `foreign_key_check`.

## Validation evidence

- **Command:** `python docs\PHASE_3D_FINAL_CONSISTENCY_TEST.py`
- **Python:** 3.13.4
- **SQLite:** 3.49.1 (`sqlite3.sqlite_version`)
- **Database mode:** Python `sqlite3` in-memory databases (`:memory:`); fresh schema and separate v1 success/failure migration fixtures.
- **Result:** `PASS: 65 assertions` (65 passed, 0 failed).
- **Migration source:** Exact fenced v1→v2 SQL extracted from the adapter specification; no manually substituted migration statements.

Assertions cover:

1. Fresh schema execution, foreign keys enabled, valid project/document/asset and initial version inserts, invalid foreign keys/tool types, and atomic rollback of failed initial snapshot creation.
2. Successful revision-checked save with exactly one project row updated; an actual stale conditional `UPDATE projects SET revision = revision + 1 WHERE project_id = ? AND revision = ?` using expected revision 1 after the saved revision reached 2; `SELECT changes()` equals zero; rollback preserves project revision 2, document revision 2, and the saved JSON; injected failed document/asset writes also roll back content and revisions.
3. Asset reference restrictions and guarded unreferenced collection.
4. Trash/restore behavior, active recent filtering, duplicate ID/reference remapping, purge cascades, and empty foreign-key checks.
5. Migration ordering, successful version/ledger update, JSON and field mapping, project/document revision initialization, legacy reason mapping, both asset-link tables, rebuilt indexes, and foreign-key validity.
6. Injected pre-commit migration failure and rollback of schema, `user_version`, ledger, data, legacy reason, and asset relationship.

The exact executable assertions are in [PHASE_3D_FINAL_CONSISTENCY_TEST.py](./PHASE_3D_FINAL_CONSISTENCY_TEST.py). The earlier [PHASE_3D_CORRECTION_REPORT.md](./PHASE_3D_CORRECTION_REPORT.md) records its historical manual migration fixture; that earlier fixture was not extracted from the adapter block. This review's result supersedes it for exact migration-SQL evidence.

## Changed files

- [PHASE_3D_STORAGE_ADAPTER_SPEC.md](./PHASE_3D_STORAGE_ADAPTER_SPEC.md) — complete API contract, migration ordering/canonical source, Trash/recent and asset semantics.
- [PHASE_3D_SQL_SCHEMA_PROPOSAL.sql](./PHASE_3D_SQL_SCHEMA_PROPOSAL.sql) — recent-project query and explicit migration-outline reference.
- [PHASE_3D_CORRECTION_REPORT.md](./PHASE_3D_CORRECTION_REPORT.md) — evidence clarification.
- [PHASE_3D_FINAL_CONSISTENCY_TEST.py](./PHASE_3D_FINAL_CONSISTENCY_TEST.py) — reproducible documentation-only SQLite validation.
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) and [PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md) — review status and history.

The architecture audit required no correction. The platform compatibility matrix is unchanged; this review supplies no new browser or native runtime evidence.

## Remaining limitations

- In-memory SQLite does not validate production backup creation, filesystem durability, interrupted OS-level writes, or application restart.
- Native desktop SQLite, SQLite WASM, IndexedDB, OPFS, browser quotas/eviction, direct `file://` behavior, offline app startup, and browser/native database reopen remain untested.
- `.mathforge` file import/export and its on-disk corruption/compatibility paths remain untested.
- The report is a documentation review, not approval to implement Phase 3E or a claim that any platform adapter is supported.

CONDITIONALLY APPROVED
