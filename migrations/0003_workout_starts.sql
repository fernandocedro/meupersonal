CREATE TABLE IF NOT EXISTS workout_starts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, workout_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_starts_student
  ON workout_starts(student_id, started_at);