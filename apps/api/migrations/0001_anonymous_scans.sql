CREATE TABLE scans (
  id TEXT PRIMARY KEY NOT NULL,
  access_code_hash TEXT NOT NULL UNIQUE,
  management_token_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_preview TEXT NOT NULL,
  provider TEXT NOT NULL,
  profile_id TEXT,
  model TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings_json TEXT NOT NULL CHECK (json_valid(findings_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX scans_expires_at_idx ON scans(expires_at);
CREATE INDEX scans_access_code_hash_idx ON scans(access_code_hash);

CREATE TABLE daily_usage (
  day TEXT PRIMARY KEY NOT NULL,
  shared_scan_count INTEGER NOT NULL DEFAULT 0 CHECK (shared_scan_count >= 0)
);
