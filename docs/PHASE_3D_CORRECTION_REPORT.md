# MathForge Phase 3D — Audit Correction Report

**Date:** 2026-11-03  
**Status:** Correction pass complete; awaiting review  
**Scope:** Documentation/schema-proposal correction only. No application runtime, SQLite integration, dependency, UI, or Phase 3E change.

## Summary

Corrected the Phase 3D proposal inconsistencies around content revisions, schema versions, initial snapshots, migration execution, recoverable Trash, and asset references. The platform conclusions did not change; the compatibility matrix was reviewed and remains unchanged. The corrected DDL and a v1-to-v2 migration fixture were executed against Python's in-memory SQLite.

## Original issues and exact corrections

| Original issue | Correction |
|---|---|
| Adapter accepted `expectedRevision`, but `projects` had no revision column or same-transaction CAS semantics. | Added `projects.revision` and `project_documents.revision`. Specified `BEGIN IMMEDIATE`, in-transaction compare, final conditional project update, required affected-row checks, `REVISION_CONFLICT`, and rollback of all document/project revisions on any failed write. |
| `document_version` did not distinguish document structure from content edits. | Replaced the v2 field with `document_schema_version` and document `revision`. Defined their meanings and migration mapping separately from project `format_version` and project content revision. |
| `createProject()` required an initial version, but the schema reason CHECK omitted `initial`. | Added the `initial` reason. Project row, initial documents, initial project revision, version 1 snapshot, and version asset references are one transaction. |
| `user_version` and `schema_migrations` were present without a migration runner, backup, rollback, or newer-schema policy. | Defined ordered migration discovery, verified pre-migration backup, one transaction per migration, ledger and `user_version` updates after successful validation, rollback on failure, and refusal to downgrade newer databases. Added a concrete v1→v2 migration that rebuilds documents/versions and preserves asset links. |
| `before-delete` version reason conflicted with project FK cascades deleting all versions. | Applied the requested Trash/soft-delete behavior: `deleteProject()` sets `trashed_at`; `restoreProject()` clears it; content and history remain. Removed `before-delete`; no auto-expiry is proposed. Added separately confirmed irreversible `purgeProject()` and documented ordered link cleanup before FK cascades. |
| Version and current asset references could be lost or block deletion/GC. | Kept `ON DELETE RESTRICT` from reference tables to assets; documented guarded GC, complete version asset links, ID/reference remapping on duplicate/import, and explicit purge order. Trash does not remove assets. |

## Files changed

- [PHASE_3D_SQL_SCHEMA_PROPOSAL.sql](./PHASE_3D_SQL_SCHEMA_PROPOSAL.sql) — schema v2, indexes/FKs, CAS save outline, Trash, asset GC, bootstrap/migration notes.
- [PHASE_3D_STORAGE_ADAPTER_SPEC.md](./PHASE_3D_STORAGE_ADAPTER_SPEC.md) — corrected API/data fields, CAS behavior, Trash/restore/purge, migration runner/example, asset/import/export invariants.
- [PHASE_3D_STORAGE_ARCHITECTURE_AUDIT.md](./PHASE_3D_STORAGE_ARCHITECTURE_AUDIT.md) — revision tracking, migration, Trash, and recovery-policy corrections.
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — correction-pass status.
- [PROJECT_CHANGELOG.md](./PROJECT_CHANGELOG.md) — correction entry and test summary.
- [PHASE_3D_CORRECTION_REPORT.md](./PHASE_3D_CORRECTION_REPORT.md) — this report.

[PHASE_3D_PLATFORM_COMPATIBILITY_MATRIX.md](./PHASE_3D_PLATFORM_COMPATIBILITY_MATRIX.md) was reviewed but not changed: the corrections do not alter its browser/native/file-URL compatibility conclusions.

## SQL validation commands and environment

**Environment:** Python 3.13.4; SQLite 3.49.1.  
**Execution:** PowerShell here-string piped to `python -`; all database connections used `sqlite3.connect(':memory:')`. The DDL was read from `docs\PHASE_3D_SQL_SCHEMA_PROPOSAL.sql` and executed with `Connection.executescript(...)`. A second in-memory database was created using the prior v1 table definitions; the documented v1→v2 migration statements were applied inside `BEGIN IMMEDIATE` and committed only after `PRAGMA foreign_key_check`.

The final harness printed:

```text
PASS schema creation, FK enabled, valid project/document/asset, initial version
PASS invalid foreign-key and tool-type inserts rejected
PASS CAS save increments content revisions after document persistence
PASS stale expectedRevision rejected without writing
PASS failed write rolls back document state and all revisions
PASS retained-version asset restriction and safe unreferenced-asset GC
PASS soft delete/restore preserves project documents, version, assets
PASS duplicate fixture has remapped current/version asset relationships
PASS explicit purge order and FK cascades leave no orphans
PASS v1->v2 migration fixture: user_version, ledger, field mapping, reason migration, asset links, FK check
PASS injected migration failure rolls back DDL and leaves schema version unchanged
PASS all final foreign_key_check results are empty
```

**Evidence qualification from the subsequent final review:** this historical correction-pass harness manually recreated/applied migration steps; it did not extract and execute the adapter specification's fenced migration block verbatim. The exact-SQL migration result is documented separately in [PHASE_3D_FINAL_CONSISTENCY_REVIEW.md](./PHASE_3D_FINAL_CONSISTENCY_REVIEW.md) and can be reproduced with [PHASE_3D_FINAL_CONSISTENCY_TEST.py](./PHASE_3D_FINAL_CONSISTENCY_TEST.py).

Additional validation printed:

```text
PASS JSON serialization/deserialization preserves Unicode, raw input, future tool fields
PASS project + document + invalid initial version transaction rolled back atomically
```

The asset test verified referenced assets cannot be deleted while current or retained-version links exist; guarded GC removed only the unreferenced fixture asset. The migration fixture verified `document_version=7` maps to `document_schema_version=7`, existing content revision initializes to 1, `before-delete` maps to `manual`, the obsolete column is removed, and both asset-link tables survive.

Two preliminary harness attempts stopped because Python's sqlite3 fixture connection still had an implicit transaction open. The harness was corrected to commit/rollback fixture setup explicitly; the final runs above completed. No schema change was needed for that harness issue.

## Test evidence and limits

- Corrected schema executes successfully in SQLite 3.49.1.
- Positive and negative constraint cases, project/document/version creation, CAS success/stale/failure, asset reference integrity, Trash restore, duplicate references, purge cascades, and v1→v2 migration were exercised.
- A deliberately failed migration rolled back its DDL and left `user_version` unchanged.
- `PRAGMA foreign_key_check` returned no rows after fresh-schema, migrated-schema, and purge checks.
- These are in-memory SQLite schema/contract tests only. No native desktop adapter, SQLite WASM VFS, browser persistence, filesystem `.mathforge` export/import, app restart, or UI integration was implemented or tested.

## Remaining limitations

- The database proposal remains documentation, not application code. Migration backup creation/verification and adapter behavior still require implementation and platform testing.
- The project revision contract assumes one serialized writer per project; multi-tab/native concurrency behavior needs runtime-specific implementation tests.
- Trash has no automatic expiry. Purge is explicitly irreversible; no deleted project can be recovered after purge.
- The compatibility matrix remains unverified for MathForge. In particular, persistent DB storage under direct `file://` remains unsupported; portable project-file flows require separate platform tests.
- Phase 3D remains awaiting review/approval. Phase 3E has not started.
