CREATE TABLE IF NOT EXISTS operative_incomplete_checks (
  shift_key TEXT NOT NULL,
  state_id INTEGER NOT NULL,
  shift_id INTEGER,
  truck_id INTEGER,
  questionary_id INTEGER,
  report_date TEXT NOT NULL,
  location_name TEXT NOT NULL,
  unit_number TEXT NOT NULL,
  in_service_status TEXT NOT NULL,
  questionnaire_name TEXT NOT NULL,
  check_status TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (shift_key,state_id)
);

CREATE INDEX IF NOT EXISTS idx_operative_incomplete_checks_shift
ON operative_incomplete_checks(shift_key);

CREATE TABLE IF NOT EXISTS operative_incomplete_check_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  shift_key TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  sheets_exported INTEGER NOT NULL DEFAULT 0,
  sheets_row_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_operative_incomplete_check_runs_started
ON operative_incomplete_check_runs(started_at DESC);
