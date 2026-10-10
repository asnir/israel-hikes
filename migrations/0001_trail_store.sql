-- Trail storage only. Contact submissions and account credentials remain separate.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trails (
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 80),
 kind TEXT NOT NULL CHECK(kind IN ('walking','segment')),
 document TEXT NOT NULL CHECK(json_valid(document)),
 public_document TEXT NOT NULL CHECK(json_valid(public_document)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS long_trails (
 id TEXT PRIMARY KEY,
 document TEXT NOT NULL CHECK(json_valid(document)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS photos (
 id TEXT PRIMARY KEY,
 trail_id TEXT NOT NULL REFERENCES trails(id),
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 19),
 document TEXT NOT NULL CHECK(json_valid(document)),
 UNIQUE(trail_id, position)
);
CREATE TABLE IF NOT EXISTS public_snapshots (
 path TEXT PRIMARY KEY,
 body TEXT NOT NULL CHECK(json_valid(body)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_members (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('owner','editor')),
 status TEXT NOT NULL CHECK(status IN ('invited','active','revoked')),
 invited_by TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id INTEGER PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES admin_members(id),
 action TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 before_revision INTEGER,
 after_revision INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
