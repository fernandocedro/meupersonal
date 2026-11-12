CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  address TEXT,
  phone TEXT,
  height_cm REAL,
  weight_kg REAL,
  photo TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
