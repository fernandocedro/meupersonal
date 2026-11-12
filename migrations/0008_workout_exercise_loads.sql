CREATE TABLE IF NOT EXISTS workout_exercise_loads (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  weight_kg REAL CHECK(weight_kg IS NULL OR weight_kg >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_loads_student
  ON workout_exercise_loads(student_id, workout_id);
