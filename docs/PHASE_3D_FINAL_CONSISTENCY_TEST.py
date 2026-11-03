"""Documentation-only SQLite contract and exact migration fixture for Phase 3D."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "PHASE_3D_SQL_SCHEMA_PROPOSAL.sql"
ADAPTER_PATH = ROOT / "PHASE_3D_STORAGE_ADAPTER_SPEC.md"
MIGRATION_KEY = "phase3d-v2-revision-trash"
NOW = "2026-11-03T12:00:00.000Z"
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    if not condition:
        raise AssertionError(message)
    checks += 1


def expect_integrity_error(connection: sqlite3.Connection, sql: str, values=()) -> None:
    try:
        connection.execute(sql, values)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected IntegrityError for: {sql}")


def foreign_key_check(connection: sqlite3.Connection) -> None:
    rows = connection.execute("PRAGMA foreign_key_check").fetchall()
    check(not rows, f"foreign_key_check returned rows: {rows!r}")


def execute_migration(
    connection: sqlite3.Connection, *, fail_before_commit: bool = False
) -> None:
    text = ADAPTER_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"### Concrete v1 → v2 migration.*?```sql\s*(.*?)\s*```",
        text,
        flags=re.DOTALL,
    )
    check(match is not None, "canonical migration SQL block found")
    statements: list[str] = []
    pending = ""
    for line in match.group(1).splitlines():
        if line.lstrip().startswith("--"):
            continue
        pending += line + "\n"
        if sqlite3.complete_statement(pending):
            if pending.strip():
                statements.append(pending.strip())
            pending = ""
    check(not pending.strip(), "canonical migration block has no incomplete SQL")
    check(statements[0].upper() == "BEGIN IMMEDIATE;", "migration begins transactionally")
    normalized = [statement.upper() for statement in statements]
    fk_position = normalized.index("PRAGMA FOREIGN_KEY_CHECK;")
    ledger_position = next(
        index for index, statement in enumerate(normalized) if "INSERT INTO SCHEMA_MIGRATIONS" in statement
    )
    version_position = normalized.index("PRAGMA USER_VERSION = 2;")
    commit_position = normalized.index("COMMIT;")
    check(fk_position < ledger_position < version_position < commit_position,
          "validation precedes ledger/version update and commit")
    saw_fk_check = False
    try:
        for statement in statements:
            if fail_before_commit and statement.upper() == "COMMIT;":
                raise sqlite3.OperationalError("injected failure before migration commit")
            if statement.upper() == "PRAGMA FOREIGN_KEY_CHECK;":
                rows = connection.execute(statement).fetchall()
                check(not rows, f"migration foreign_key_check returned rows: {rows!r}")
                saw_fk_check = True
            elif ":now" in statement:
                connection.execute(statement, {"now": NOW})
            else:
                connection.execute(statement)
    except Exception:
        if connection.in_transaction:
            connection.rollback()
        raise
    check(saw_fk_check, "migration executes and inspects PRAGMA foreign_key_check")


def make_v1_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", isolation_level=None)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            migration_key TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL
        );
        INSERT INTO schema_migrations VALUES (1, 'phase3d-v1', '2026-01-01T00:00:00Z');
        PRAGMA user_version = 1;
        CREATE TABLE projects (
            project_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            format_version INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX idx_projects_updated ON projects(updated_at DESC);
        CREATE TABLE project_documents (
            document_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            tool_type TEXT NOT NULL,
            title TEXT NOT NULL,
            document_json TEXT NOT NULL,
            document_version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (project_id, document_id),
            FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX idx_project_documents_project_updated
            ON project_documents(project_id, updated_at DESC);
        CREATE INDEX idx_project_documents_tool ON project_documents(project_id, tool_type);
        CREATE TABLE project_assets (
            asset_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            media_type TEXT NOT NULL,
            byte_length INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            asset_data BLOB NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (project_id, asset_id),
            FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE TABLE document_assets (
            project_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'embedded',
            PRIMARY KEY (document_id, asset_id),
            FOREIGN KEY (project_id, document_id)
                REFERENCES project_documents(project_id, document_id) ON DELETE CASCADE,
            FOREIGN KEY (project_id, asset_id)
                REFERENCES project_assets(project_id, asset_id) ON DELETE RESTRICT
        );
        CREATE INDEX idx_document_assets_asset ON document_assets(project_id, asset_id);
        CREATE TABLE project_versions (
            project_id TEXT NOT NULL,
            version_no INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            reason TEXT NOT NULL CHECK (
                reason IN ('manual', 'autosave-checkpoint', 'before-delete', 'recovery')
            ),
            snapshot_json TEXT NOT NULL,
            snapshot_sha256 TEXT NOT NULL,
            PRIMARY KEY (project_id, version_no),
            FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX idx_project_versions_created
            ON project_versions(project_id, created_at DESC);
        CREATE TABLE project_version_assets (
            project_id TEXT NOT NULL,
            version_no INTEGER NOT NULL,
            asset_id TEXT NOT NULL,
            PRIMARY KEY (project_id, version_no, asset_id),
            FOREIGN KEY (project_id, version_no)
                REFERENCES project_versions(project_id, version_no) ON DELETE CASCADE,
            FOREIGN KEY (project_id, asset_id)
                REFERENCES project_assets(project_id, asset_id) ON DELETE RESTRICT
        );
        CREATE INDEX idx_project_version_assets_asset
            ON project_version_assets(project_id, asset_id);
        """
    )
    connection.execute(
        "INSERT INTO projects VALUES (?, ?, ?, ?, 1)",
        ("legacy", "Legacy", NOW, NOW),
    )
    connection.execute(
        "INSERT INTO project_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "legacy-doc",
            "legacy",
            "coordinates-graph",
            "Graph",
            '{"label":"Δ","input":"1,2"}',
            7,
            NOW,
            NOW,
        ),
    )
    connection.execute(
        "INSERT INTO project_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("legacy-asset", "legacy", "plot.png", "image/png", 3, "abc", b"png", NOW),
    )
    connection.execute(
        "INSERT INTO document_assets VALUES ('legacy', 'legacy-doc', 'legacy-asset', 'embedded')"
    )
    connection.execute(
        "INSERT INTO project_versions VALUES (?, 1, ?, 'before-delete', ?, ?)",
        ("legacy", NOW, '{"assetIds":["legacy-asset"]}', "snapshot-hash"),
    )
    connection.execute(
        "INSERT INTO project_version_assets VALUES ('legacy', 1, 'legacy-asset')"
    )
    return connection


def test_fresh_schema() -> None:
    connection = sqlite3.connect(":memory:", isolation_level=None)
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    check(connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1, "foreign keys enabled")
    connection.execute(
        "INSERT INTO projects(project_id, title, created_at, updated_at, revision) "
        "VALUES ('p1', 'Project', ?, ?, 1)",
        (NOW, NOW),
    )
    connection.execute(
        "INSERT INTO project_documents(document_id, project_id, tool_type, title, "
        "document_json, document_schema_version, revision, created_at, updated_at) "
        "VALUES ('d1', 'p1', 'coordinates-graph', 'Graph', '{}', 1, 1, ?, ?)",
        (NOW, NOW),
    )
    connection.execute(
        "INSERT INTO project_assets VALUES ('a1', 'p1', 'asset.png', 'image/png', 3, "
        "'hash', X'706E67', ?)",
        (NOW,),
    )
    connection.execute("INSERT INTO document_assets VALUES ('p1', 'd1', 'a1', 'embedded')")
    connection.execute(
        "INSERT INTO project_versions VALUES ('p1', 1, 1, ?, 'initial', ?, 'hash')",
        (NOW, '{"assetIds":["a1"]}'),
    )
    connection.execute("INSERT INTO project_version_assets VALUES ('p1', 1, 'a1')")
    check(connection.execute("SELECT reason FROM project_versions").fetchone()[0] == "initial",
          "initial version accepted")
    expect_integrity_error(
        connection,
        "INSERT INTO project_documents(document_id, project_id, tool_type, title, "
        "document_json, created_at, updated_at) VALUES ('bad', 'missing', 'coordinates-graph', "
        "'Bad', '{}', ?, ?)",
        (NOW, NOW),
    )
    check(True, "invalid foreign-key insert rejected")
    expect_integrity_error(
        connection,
        "INSERT INTO project_documents(document_id, project_id, tool_type, title, "
        "document_json, created_at, updated_at) VALUES ('bad-tool', 'p1', 'unknown', "
        "'Bad', '{}', ?, ?)",
        (NOW, NOW),
    )
    check(True, "invalid tool type rejected")
    expect_integrity_error(
        connection,
        "INSERT INTO recent_projects VALUES ('missing-project', ?)",
        (NOW,),
    )
    check(True, "invalid recent-project FK rejected")
    foreign_key_check(connection)

    # A failed initial snapshot must roll back the project and document inserts.
    connection.execute("BEGIN")
    try:
        connection.execute(
            "INSERT INTO projects(project_id, title, created_at, updated_at) "
            "VALUES ('atomic-fail', 'Atomic', ?, ?)",
            (NOW, NOW),
        )
        connection.execute(
            "INSERT INTO project_documents(document_id, project_id, tool_type, title, "
            "document_json, created_at, updated_at) VALUES ('atomic-doc', 'atomic-fail', "
            "'coordinates-graph', 'Graph', '{}', ?, ?)",
            (NOW, NOW),
        )
        connection.execute(
            "INSERT INTO project_versions VALUES ('atomic-fail', 1, 0, ?, "
            "'invalid-initial-reason', '{}', 'hash')",
            (NOW,),
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("invalid initial version was unexpectedly accepted")
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(
        connection.execute("SELECT 1 FROM projects WHERE project_id='atomic-fail'").fetchone()
        is None,
        "failed initial version rolls back project and documents",
    )

    # Successful CAS write, followed by stale and injected-failure rollback.
    connection.execute("BEGIN IMMEDIATE")
    try:
        current = connection.execute("SELECT revision FROM projects WHERE project_id='p1'").fetchone()[0]
        check(current == 1, "CAS starts with expected project revision")
        connection.execute(
            "UPDATE project_documents SET document_json='{\"saved\":true}', revision=revision+1 "
            "WHERE project_id='p1' AND document_id='d1'"
        )
        connection.execute(
            "UPDATE projects SET revision=revision+1 WHERE project_id=? AND revision=?",
            ("p1", 1),
        )
        check(connection.execute("SELECT changes()").fetchone()[0] == 1,
              "successful CAS project update affects exactly one row")
        connection.commit()
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(connection.execute("SELECT revision FROM projects WHERE project_id='p1'").fetchone()[0] == 2,
          "successful save advances project revision")
    check(connection.execute("SELECT revision FROM project_documents WHERE document_id='d1'").fetchone()[0] == 2,
          "successful save advances document revision")
    saved_json = connection.execute(
        "SELECT document_json FROM project_documents WHERE document_id='d1'"
    ).fetchone()[0]

    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute(
            "UPDATE projects SET revision = revision + 1 WHERE project_id = ? AND revision = ?",
            ("p1", 1),
        )
        stale_changes = connection.execute("SELECT changes()").fetchone()[0]
        check(stale_changes == 0, "stale CAS update affects zero rows")
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(connection.execute("SELECT revision FROM projects WHERE project_id='p1'").fetchone()[0] == 2,
          "stale CAS rollback preserves project revision")
    check(connection.execute("SELECT revision FROM project_documents WHERE document_id='d1'").fetchone()[0] == 2,
          "stale CAS rollback preserves document revision")
    check(connection.execute("SELECT document_json FROM project_documents WHERE document_id='d1'").fetchone()[0]
          == saved_json, "stale CAS causes no partial document content write")

    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute(
            "UPDATE project_documents SET document_json='{\"partial\":true}', revision=revision+1 "
            "WHERE document_id='d1'"
        )
        connection.execute(
            "UPDATE projects SET revision=revision+1 WHERE project_id='p1' AND revision=2"
        )
        connection.execute(
            "INSERT INTO document_assets VALUES ('p1', 'd1', 'missing-asset', 'embedded')"
        )
    except sqlite3.IntegrityError:
        connection.rollback()
    else:
        raise AssertionError("injected document/asset write failure was unexpectedly accepted")
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(
        connection.execute("SELECT document_json FROM project_documents WHERE document_id='d1'").fetchone()[0]
        == saved_json,
        "failed write rolls back document content",
    )
    check(connection.execute("SELECT revision FROM projects WHERE project_id='p1'").fetchone()[0] == 2,
          "failed write leaves project revision unchanged")
    check(connection.execute("SELECT revision FROM project_documents WHERE document_id='d1'").fetchone()[0] == 2,
          "failed write leaves document revision unchanged")

    expect_integrity_error(connection, "DELETE FROM project_assets WHERE asset_id='a1'")
    check(True, "asset referenced by current and retained version cannot be deleted")
    connection.execute(
        "INSERT INTO project_assets VALUES ('free', 'p1', 'unused.bin', 'application/octet-stream', "
        "0, 'empty', X'', ?)",
        (NOW,),
    )
    connection.execute("DELETE FROM project_assets WHERE project_id='p1' AND asset_id='free'")
    check(connection.execute("SELECT changes()").fetchone()[0] == 1, "unreferenced asset GC permitted")

    connection.execute("INSERT INTO recent_projects VALUES ('p1', ?)", (NOW,))
    connection.execute("BEGIN IMMEDIATE")
    try:
        connection.execute("UPDATE projects SET trashed_at=?, updated_at=? WHERE project_id='p1'", (NOW, NOW))
        connection.execute("DELETE FROM recent_projects WHERE project_id='p1'")
        connection.commit()
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(connection.execute("SELECT COUNT(*) FROM project_documents WHERE project_id='p1'").fetchone()[0] == 1,
          "soft-delete preserves documents")
    check(connection.execute("SELECT COUNT(*) FROM project_versions WHERE project_id='p1'").fetchone()[0] == 1,
          "soft-delete preserves versions")
    check(connection.execute("SELECT COUNT(*) FROM project_assets WHERE project_id='p1'").fetchone()[0] == 1,
          "soft-delete preserves assets")
    check(connection.execute("SELECT COUNT(*) FROM recent_projects WHERE project_id='p1'").fetchone()[0] == 0,
          "soft-delete removes recent row")
    connection.execute("INSERT INTO recent_projects VALUES ('p1', ?)", (NOW,))
    visible_recents = connection.execute(
        "SELECT p.project_id FROM recent_projects r JOIN projects p USING (project_id) "
        "WHERE p.trashed_at IS NULL"
    ).fetchall()
    check(("p1",) not in visible_recents, "recent-project query hides stale trashed rows")
    connection.execute("DELETE FROM recent_projects WHERE project_id='p1'")
    connection.execute("UPDATE projects SET trashed_at=NULL, updated_at=? WHERE project_id='p1'", (NOW,))
    check(connection.execute("SELECT COUNT(*) FROM project_versions WHERE project_id='p1'").fetchone()[0] == 1,
          "restore preserves versions")
    check(connection.execute("SELECT COUNT(*) FROM recent_projects WHERE project_id='p1'").fetchone()[0] == 0,
          "restore does not mark project recent")
    connection.execute("INSERT INTO recent_projects VALUES ('p1', ?)", (NOW,))
    check(connection.execute("SELECT COUNT(*) FROM recent_projects WHERE project_id='p1'").fetchone()[0] == 1,
          "opening restored project can recreate recent row")

    # Duplicate to a new project with remapped document/asset/version references.
    connection.execute("BEGIN")
    try:
        connection.execute(
            "INSERT INTO projects(project_id, title, created_at, updated_at, revision) "
            "SELECT 'p2', title || ' copy', created_at, updated_at, revision FROM projects WHERE project_id='p1'"
        )
        connection.execute(
            "INSERT INTO project_assets SELECT 'a2', 'p2', filename, media_type, byte_length, "
            "sha256, asset_data, created_at FROM project_assets WHERE project_id='p1' AND asset_id='a1'"
        )
        connection.execute(
            "INSERT INTO project_documents SELECT 'd2', 'p2', tool_type, title, document_json, "
            "document_schema_version, revision, created_at, updated_at FROM project_documents "
            "WHERE project_id='p1' AND document_id='d1'"
        )
        connection.execute("INSERT INTO document_assets VALUES ('p2', 'd2', 'a2', 'embedded')")
        connection.execute(
            "INSERT INTO project_versions SELECT 'p2', version_no, project_revision, created_at, "
            "'initial', snapshot_json, snapshot_sha256 FROM project_versions WHERE project_id='p1'"
        )
        connection.execute("INSERT INTO project_version_assets VALUES ('p2', 1, 'a2')")
        connection.commit()
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(connection.execute("SELECT project_id FROM project_assets WHERE asset_id='a2'").fetchone()[0] == "p2",
          "duplicate remaps asset project reference")
    check(connection.execute("SELECT project_id FROM project_documents WHERE document_id='d2'").fetchone()[0] == "p2",
          "duplicate allocates new document ID")
    check(connection.execute("SELECT asset_id FROM document_assets WHERE document_id='d2'").fetchone()[0] == "a2",
          "duplicate remaps current asset link")
    check(connection.execute("SELECT asset_id FROM project_version_assets WHERE project_id='p2'").fetchone()[0] == "a2",
          "duplicate remaps version asset link")
    foreign_key_check(connection)

    connection.execute("BEGIN")
    try:
        connection.execute("DELETE FROM project_version_assets WHERE project_id='p2'")
        connection.execute("DELETE FROM document_assets WHERE project_id='p2'")
        connection.execute("DELETE FROM projects WHERE project_id='p2'")
        connection.commit()
    finally:
        if connection.in_transaction:
            connection.rollback()
    check(connection.execute("SELECT COUNT(*) FROM project_assets WHERE project_id='p2'").fetchone()[0] == 0,
          "purge cascades owned asset rows")
    check(connection.execute("SELECT COUNT(*) FROM project_versions WHERE project_id='p2'").fetchone()[0] == 0,
          "purge cascades version rows")
    check(connection.execute("SELECT COUNT(*) FROM recent_projects WHERE project_id='p2'").fetchone()[0] == 0,
          "purge leaves no recent row")
    foreign_key_check(connection)
    connection.close()


def test_migration() -> None:
    connection = make_v1_database()
    original_json = connection.execute(
        "SELECT document_json FROM project_documents WHERE document_id='legacy-doc'"
    ).fetchone()[0]
    execute_migration(connection)
    check(connection.execute("PRAGMA user_version").fetchone()[0] == 2, "migration updates user_version")
    check(
        connection.execute(
            "SELECT migration_key FROM schema_migrations WHERE version=2"
        ).fetchone()[0] == MIGRATION_KEY,
        "migration ledger records v2 key",
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(project_documents)")}
    check("document_schema_version" in columns and "revision" in columns,
          "document schema/content revision columns present")
    check("document_version" not in columns, "ambiguous legacy document_version removed")
    migrated = connection.execute(
        "SELECT document_json, document_schema_version, revision FROM project_documents "
        "WHERE document_id='legacy-doc'"
    ).fetchone()
    check(migrated == (original_json, 7, 1), "JSON preserved and schema version mapped, revision initialized")
    check(connection.execute("SELECT revision FROM projects WHERE project_id='legacy'").fetchone()[0] == 1,
          "project content revision initialized")
    check(
        connection.execute("SELECT reason FROM project_versions WHERE project_id='legacy'").fetchone()[0]
        == "manual",
        "legacy before-delete reason normalized to manual",
    )
    check(
        connection.execute("SELECT asset_id FROM document_assets WHERE document_id='legacy-doc'").fetchone()[0]
        == "legacy-asset",
        "document asset relationship survives rebuild",
    )
    check(
        connection.execute("SELECT asset_id FROM project_version_assets WHERE project_id='legacy'").fetchone()[0]
        == "legacy-asset",
        "version asset relationship survives rebuild",
    )
    indexes = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        )
    }
    expected_indexes = {
        "idx_projects_updated",
        "idx_projects_trash",
        "idx_project_documents_project_updated",
        "idx_project_documents_tool",
        "idx_document_assets_asset",
        "idx_project_versions_created",
        "idx_project_version_assets_asset",
    }
    check(expected_indexes <= indexes, "all retained/rebuilt indexes exist")
    foreign_key_check(connection)
    connection.close()

    failed = make_v1_database()
    try:
        execute_migration(failed, fail_before_commit=True)
    except sqlite3.OperationalError:
        if failed.in_transaction:
            failed.rollback()
    else:
        raise AssertionError("injected ledger failure did not fail migration")
    failed_columns = {row[1] for row in failed.execute("PRAGMA table_info(project_documents)")}
    check(failed.execute("PRAGMA user_version").fetchone()[0] == 1,
          "failed migration restores original user_version")
    check("document_version" in failed_columns and "revision" not in failed_columns,
          "failed migration restores original document schema")
    check(
        failed.execute("SELECT COUNT(*) FROM schema_migrations WHERE version=2").fetchone()[0] == 0,
        "failed migration leaves ledger unchanged",
    )
    check(
        failed.execute("SELECT reason FROM project_versions WHERE project_id='legacy'").fetchone()[0]
        == "before-delete",
        "failed migration preserves legacy version data",
    )
    check(
        failed.execute("SELECT asset_id FROM document_assets WHERE document_id='legacy-doc'").fetchone()[0]
        == "legacy-asset",
        "failed migration restores document asset relationship",
    )
    foreign_key_check(failed)
    failed.close()


def main() -> None:
    test_fresh_schema()
    test_migration()
    print(f"PASS: {checks} assertions")


if __name__ == "__main__":
    main()
