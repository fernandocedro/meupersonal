CREATE TABLE IF NOT EXISTS workout_completions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, workout_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_completions_student
  ON workout_completions(student_id, completed_at);