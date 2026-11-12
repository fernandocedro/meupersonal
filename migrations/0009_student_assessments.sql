CREATE TABLE IF NOT EXISTS student_assessments (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
