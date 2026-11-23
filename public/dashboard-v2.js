CREATE TABLE IF NOT EXISTS vehicles (
  apparatus_number TEXT PRIMARY KEY,
  raw_name TEXT NOT NULL,
  primary_assignment TEXT NOT NULL,
  current_assignment TEXT,
  vehicle_type TEXT NOT NULL,
  home_station TEXT NOT NULL,
  fleet_active INTEGER NOT NULL DEFAULT 1,
  dashboard_visible INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facilities (
  facility_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_feet REAL NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_state (
  apparatus_number TEXT PRIMARY KEY,
  samsara_vehicle_id TEXT,
  samsara_name TEXT,
  latitude REAL,
  longitude REAL,
  gps_time TEXT,
  speed_mph REAL NOT NULL DEFAULT 0,
  facility TEXT NOT NULL DEFAULT 'Unknown',
  current_location TEXT NOT NULL DEFAULT 'Unknown',
  gps_status TEXT NOT NULL DEFAULT 'No GPS',
  map_link TEXT,
  emergency_lights INTEGER NOT NULL DEFAULT 0,
  left_turn_signal INTEGER NOT NULL DEFAULT 0,
  right_turn_signal INTEGER NOT NULL DEFAULT 0,
  parked INTEGER NOT NULL DEFAULT 0,
  last_sync TEXT NOT NULL,
  FOREIGN KEY (apparatus_number) REFERENCES vehicles(apparatus_number)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  unmatched_json TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_state_last_sync
  ON vehicle_state(last_sync);

