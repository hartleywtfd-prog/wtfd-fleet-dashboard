-- Version 35: stable turnout gear snapshot storage
CREATE TABLE IF NOT EXISTS turnout_gear_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  signature TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  source_counts TEXT,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
