-- MathForge Phase 3D storage proposal, corrected schema version 2.
-- Audit/documentation artifact only; not wired into the application.
-- Execute as a fresh-database bootstrap only. Existing databases must use the
-- transactional migration runner documented in PHASE_3D_STORAGE_ADAPTER_SPEC.md.
-- The runner, not this bootstrap script, owns PRAGMA user_version updates.
-- Store UTC ISO-8601 timestamps in TEXT. Generate opaque IDs in application code.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version       INTEGER PRIMARY KEY,
    migration_key TEXT NOT NULL UNIQUE,
    applied_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    project_id     TEXT PRIMARY KEY,
    title          TEXT NOT NULL CHECK (length(trim(title)) > 0),
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    format_version INTEGER NOT NULL DEFAULT 1 CHECK (format_version > 0),
    revision       INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    trashed_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_updated
    ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_trash
    ON projects(trashed_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_documents (
    document_id            TEXT PRIMARY KEY,
    project_id             TEXT NOT NULL,
    tool_type              TEXT NOT NULL CHECK (
        tool_type IN ('coordinates-graph', 'equation-plotter',
                      'ogive-curve', 'histogram-polygon')
    ),
    title                  TEXT NOT NULL,
    document_json          TEXT NOT NULL,
    document_schema_version INTEGER NOT NULL DEFAULT 1
        CHECK (document_schema_version > 0),
    revision               INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    UNIQUE (project_id, document_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_updated
    ON project_documents(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_documents_tool
    ON project_documents(project_id, tool_type);

CREATE TABLE IF NOT EXISTS project_assets (
    asset_id    TEXT NOT NULL,
    project_id  TEXT NOT NULL,
    filename    TEXT NOT NULL,
    media_type  TEXT NOT NULL,
    byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
    sha256      TEXT NOT NULL,
    asset_data  BLOB NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (project_id, asset_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_assets_hash
    ON project_assets(project_id, sha256);

CREATE TABLE IF NOT EXISTS document_assets (
    project_id  TEXT NOT NULL,
    document_id TEXT NOT NULL,
    asset_id    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'embedded',
    PRIMARY KEY (document_id, asset_id),
    FOREIGN KEY (project_id, document_id)
        REFERENCES project_documents(project_id, document_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, asset_id)
        REFERENCES project_assets(project_id, asset_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_document_assets_asset
    ON document_assets(project_id, asset_id);

CREATE TABLE IF NOT EXISTS project_versions (
    project_id      TEXT NOT NULL,
    version_no      INTEGER NOT NULL CHECK (version_no > 0),
    project_revision INTEGER NOT NULL CHECK (project_revision >= 0),
    created_at      TEXT NOT NULL,
    reason          TEXT NOT NULL CHECK (
        reason IN ('initial', 'manual', 'autosave-checkpoint',
                   'before-restore', 'recovery')
    ),
    snapshot_json   TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    PRIMARY KEY (project_id, version_no),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_versions_created
    ON project_versions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_version_assets (
    project_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    asset_id   TEXT NOT NULL,
    PRIMARY KEY (project_id, version_no, asset_id),
    FOREIGN KEY (project_id, version_no)
        REFERENCES project_versions(project_id, version_no) ON DELETE CASCADE,
    FOREIGN KEY (project_id, asset_id)
        REFERENCES project_assets(project_id, asset_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_project_version_assets_asset
    ON project_version_assets(project_id, asset_id);

CREATE TABLE IF NOT EXISTS workspace_settings (
    setting_key  TEXT PRIMARY KEY,
    setting_json TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_projects (
    project_id TEXT PRIMARY KEY,
    opened_at  TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recent_projects_opened
    ON recent_projects(opened_at DESC);

CREATE TABLE IF NOT EXISTS design_presets (
    preset_id   TEXT PRIMARY KEY,
    name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
    tool_type   TEXT NOT NULL CHECK (
        tool_type IN ('coordinates-graph', 'equation-plotter',
                      'ogive-curve', 'histogram-polygon')
    ),
    preset_json TEXT NOT NULL,
    is_builtin  INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_design_presets_tool_name
    ON design_presets(tool_type, name);

-- Active list excludes trashed projects. Trash remains recoverable until an
-- explicit permanent purge; soft deletion never removes documents or versions.
-- SELECT project_id, title, revision, updated_at
-- FROM projects WHERE trashed_at IS NULL ORDER BY updated_at DESC;
--
-- Trash listing:
-- SELECT project_id, title, revision, trashed_at
-- FROM projects WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC;
--
-- Recent projects omit Trash even if a stale recent row exists. deleteProject
-- removes the row transactionally; restoreProject does not recreate it until
-- the project is opened successfully.
-- SELECT p.project_id, p.title, r.opened_at
-- FROM recent_projects r JOIN projects p USING (project_id)
-- WHERE p.trashed_at IS NULL
-- ORDER BY r.opened_at DESC;
--
-- Restore from trash:
-- UPDATE projects SET trashed_at = NULL, updated_at = :now
-- WHERE project_id = :project_id AND trashed_at IS NOT NULL;
--
-- Example: list project versions.
-- SELECT version_no, project_revision, created_at, reason, snapshot_sha256
-- FROM project_versions WHERE project_id = :project_id ORDER BY version_no DESC;
--
-- Example: collect only assets not referenced by current documents or retained
-- versions. Run in a write transaction after retention has removed old versions.
-- DELETE FROM project_assets AS a
-- WHERE a.project_id = :project_id
--   AND NOT EXISTS (
--       SELECT 1 FROM document_assets da
--       WHERE da.project_id = a.project_id AND da.asset_id = a.asset_id
--   )
--   AND NOT EXISTS (
--       SELECT 1 FROM project_version_assets va
--       WHERE va.project_id = a.project_id AND va.asset_id = a.asset_id
--   );

-- Safe compare-and-swap content save (pseudo-code around the shown SQL):
-- BEGIN IMMEDIATE;
-- 1) Read projects.revision inside this transaction and compare with
--    :expected_revision. If absent or different, ROLLBACK and return
--    REVISION_CONFLICT before writing.
-- 2) Persist every validated document. For a changed existing document:
-- UPDATE project_documents
-- SET document_json = :document_json,
--     document_schema_version = :document_schema_version,
--     revision = revision + 1,
--     updated_at = :now
-- WHERE project_id = :project_id
--   AND document_id = :document_id
--   AND document_schema_version <= :document_schema_version;
-- Require exactly one affected row, or insert a new document with revision 1.
-- If any document/asset operation fails, ROLLBACK; no project revision changes.
-- 3) After all document writes succeed, perform the project CAS:
-- UPDATE projects
-- SET revision = revision + 1, updated_at = :now
-- WHERE project_id = :project_id
--   AND revision = :expected_revision
--   AND trashed_at IS NULL;
-- Require exactly one affected row. Otherwise ROLLBACK and return
-- REVISION_CONFLICT (all preceding document changes roll back too).
-- 4) If a checkpoint is due, insert it using the new revision and link every
--    referenced asset in project_version_assets in this same transaction.
-- COMMIT;
--
-- A successful content save increments project revision once; each changed
-- document increments its own content revision once. A no-op save may return
-- the unchanged revision after verifying expected_revision. A stale revision
-- never writes. Any failure/rollback leaves all revisions unchanged.
--
-- Project creation is one transaction: insert project at revision 0; insert all
-- validated documents at document revision 1; set project revision to 1 if it
-- has documents (otherwise 0); insert version 1 with reason='initial' and the
-- exact committed snapshot/revision; insert its asset links; COMMIT.

-- Schema/migration runner contract (not executable bootstrap SQL):
-- Read PRAGMA user_version. Refuse to run if it exceeds the application's
-- maximum supported version. Apply each pending migration in its own
-- transaction; update schema_migrations and PRAGMA user_version only after
-- migration statements succeed, then commit. On any failure roll back the
-- complete migration and retain the verified pre-migration backup.
-- For a new empty database, create this schema in one transaction, insert the
-- current schema_migrations row, set PRAGMA user_version = 2, then commit.
--
-- Concrete v1 -> v2 migration:
-- The canonical, executable SQL and transaction/validation ordering are in
-- PHASE_3D_STORAGE_ADAPTER_SPEC.md. This section is a step outline only; the
-- final consistency fixture executes that exact adapter-spec SQL block.
-- Before migration, create and verify a SQLite backup. Then BEGIN IMMEDIATE;
-- ALTER TABLE projects ADD COLUMN revision INTEGER NOT NULL DEFAULT 0
--   CHECK (revision >= 0);
-- ALTER TABLE projects ADD COLUMN trashed_at TEXT;
-- UPDATE projects SET revision = CASE WHEN EXISTS (
--   SELECT 1 FROM project_documents d WHERE d.project_id = projects.project_id
-- ) THEN 1 ELSE 0 END;
-- Rebuild project_documents and document_assets together to remove the
-- ambiguous v1 document_version field while preserving asset links. Copy the
-- v1 document_version into document_schema_version and initialize revision=1.
-- Rebuild project_versions with the v2 CHECK constraint and project_revision;
-- preserve project_version_assets rows while rebuilding. Map legacy
-- 'before-delete' reasons to 'manual' (retained historical snapshot; old
-- deletion semantics were not actually recoverable). Add reason='initial'.
-- Recreate indexes for rebuilt tables (retain the existing projects-updated
-- index), then run PRAGMA foreign_key_check and inspect its returned rows.
-- Only after it is empty, record the migration and set user_version.
-- INSERT INTO schema_migrations(version, migration_key, applied_at)
-- VALUES (2, 'phase3d-v2-revision-trash', :now);
-- PRAGMA user_version = 2;
-- COMMIT;
-- On failure ROLLBACK and reopen/verify the pre-migration backup.
