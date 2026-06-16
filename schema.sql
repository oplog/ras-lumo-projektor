-- D1 schema for the Lumo layout library.
-- Apply: npx wrangler d1 execute tarqan-lumo-projeksiyon-db --remote --file=schema.sql
-- (add --local instead of --remote for the dev copy)

CREATE TABLE IF NOT EXISTS entries (
  id         TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'pod' CHECK (mode IN ('pod', 'rebin')),
  xml        TEXT NOT NULL,
  saved_at   INTEGER NOT NULL
);

-- One file per (station, name): enforces the upsert-by-name rule at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_group_file ON entries (group_name, file_name);
CREATE INDEX IF NOT EXISTS idx_entries_group ON entries (group_name);

-- Stations that exist but hold no files yet.
CREATE TABLE IF NOT EXISTS empty_groups (
  name TEXT PRIMARY KEY
);

-- Append-only audit trail. Every create/update/delete writes a row here so the
-- full history of the library is recoverable.
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  action     TEXT NOT NULL,          -- 'create' | 'update' | 'delete' | 'clear'
  entry_id   TEXT,
  group_name TEXT,
  file_name  TEXT,
  mode       TEXT,
  detail     TEXT                     -- free-form JSON (what changed)
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);
