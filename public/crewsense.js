CREATE TABLE IF NOT EXISTS operative_assignment_state (
  apparatus_number TEXT PRIMARY KEY,
  operative_unit_number TEXT,
  call_sign TEXT NOT NULL,
  created_at TEXT,
  shift_id INTEGER,
  service_status TEXT,
  last_seen_at TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (apparatus_number) REFERENCES vehicles(apparatus_number)
);

CREATE TABLE IF NOT EXISTS operative_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  mode TEXT NOT NULL DEFAULT 'preview',
  status TEXT NOT NULL,
  endpoint TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  difference_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_operative_assignment_seen
  ON operative_assignment_state(last_seen_at);

