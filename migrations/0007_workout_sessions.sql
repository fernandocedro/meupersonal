CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_student_started
  ON workout_sessions(student_id, started_at);

INSERT INTO workout_sessions (id, student_id, workout_id, started_at, completed_at)
SELECT 'legacy-completed-' || wc.id, wc.student_id, wc.workout_id, ws.started_at, wc.completed_at
FROM workout_completions wc
LEFT JOIN workout_starts ws
  ON ws.student_id = wc.student_id AND ws.workout_id = wc.workout_id;

INSERT INTO workout_sessions (id, student_id, workout_id, started_at, completed_at)
SELECT 'legacy-active-' || ws.id, ws.student_id, ws.workout_id, ws.started_at, NULL
FROM workout_starts ws
LEFT JOIN workout_completions wc
  ON wc.student_id = ws.student_id AND wc.workout_id = ws.workout_id
WHERE wc.id IS NULL;
