export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Rota de Login Corrigida com Logs de Depuração
      if (url.pathname === '/api/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
          return new Response(JSON.stringify({ error: 'Informe e-mail e senha.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const user = await env.DB.prepare(
          "SELECT id, name, email, role, password_hash FROM users WHERE LOWER(email) = LOWER(?) AND status = 'active'"
        ).bind(email.trim()).first();
        if (!user) {
          return new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!await verifyPassword(password, user.password_hash)) {
          return new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { password_hash, ...safeUser } = user;
        return new Response(JSON.stringify({ success: true, user: safeUser }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Rotas de manipulação de tabelas (/api/store/:table)
      if (parts[0] === 'api' && parts[1] === 'store') {
        const table = parts[2];
        const targetId = parts[3];
        const allowedTables = ['users', 'workouts', 'completions', 'workout-completions', 'workout-starts', 'messages', 'packages', 'payments'];

        if (!allowedTables.includes(table)) {
          return new Response(JSON.stringify({ error: 'Tabela inválida' }), { status: 400, headers: corsHeaders });
        }

        if (table === 'workout-starts' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT id, student_id, workout_id, started_at FROM workout_starts ORDER BY started_at'
          ).all();
          return new Response(JSON.stringify(results.map(row => ({
            id: row.id,
            userId: row.student_id,
            workoutId: row.workout_id,
            startedAt: row.started_at
          }))), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'workout-starts' && request.method === 'POST') {
          const item = await request.json();
          const studentId = String(item.studentId || item.userId || '').trim();
          const workoutId = String(item.workoutId || '').trim();
          const workout = await env.DB.prepare(
            'SELECT id FROM workouts WHERE id = ? AND student_id = ? AND active = 1'
          ).bind(workoutId, studentId).first();
          if (!studentId || !workoutId || !workout) {
            return new Response(JSON.stringify({ error: 'Treino não encontrado para este aluno.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          await env.DB.prepare(
            'INSERT INTO workout_starts (id, student_id, workout_id) VALUES (?, ?, ?) ON CONFLICT(student_id, workout_id) DO NOTHING'
          ).bind(crypto.randomUUID(), studentId, workoutId).run();
          const start = await env.DB.prepare(
            'SELECT id, student_id, workout_id, started_at FROM workout_starts WHERE student_id = ? AND workout_id = ?'
          ).bind(studentId, workoutId).first();
          return new Response(JSON.stringify({ success: true, start: {
            id: start.id,
            userId: start.student_id,
            workoutId: start.workout_id,
            startedAt: start.started_at
          } }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'completions' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT ec.student_id, ec.exercise_id, ec.completed_at, e.workout_id FROM exercise_completions ec JOIN exercises e ON e.id = ec.exercise_id'
          ).all();
          const items = results.map(row => ({
            id: `${row.student_id}:${row.exercise_id}`,
            userId: row.student_id,
            workoutId: row.workout_id,
            exerciseId: row.exercise_id,
            completedAt: row.completed_at
          }));
          return new Response(JSON.stringify(items), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'completions' && request.method === 'POST') {
          const item = await request.json();
          const studentId = String(item.userId || '').trim();
          const exerciseId = String(item.exerciseId || '').trim();
          if (!studentId || !exerciseId) {
            return new Response(JSON.stringify({ error: 'Aluno e exercício são obrigatórios.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const exercise = await env.DB.prepare(
            "SELECT e.id, e.workout_id FROM exercises e JOIN workouts w ON w.id = e.workout_id WHERE e.id = ? AND w.student_id = ? AND w.active = 1"
          ).bind(exerciseId, studentId).first();
          if (!exercise) {
            return new Response(JSON.stringify({ error: 'Exercício não encontrado.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          await env.DB.batch([
            env.DB.prepare(
              'INSERT INTO workout_starts (id, student_id, workout_id) VALUES (?, ?, ?) ON CONFLICT(student_id, workout_id) DO NOTHING'
            ).bind(crypto.randomUUID(), studentId, exercise.workout_id),
            env.DB.prepare(
              'INSERT INTO exercise_completions (id, student_id, exercise_id) VALUES (?, ?, ?) ON CONFLICT(student_id, exercise_id) DO NOTHING'
            ).bind(`${studentId}:${exerciseId}`, studentId, exerciseId)
          ]);
          const start = await env.DB.prepare(
            'SELECT started_at FROM workout_starts WHERE student_id = ? AND workout_id = ?'
          ).bind(studentId, exercise.workout_id).first();
          return new Response(JSON.stringify({ success: true, item: { ...item, id: `${studentId}:${exerciseId}`, workoutId: exercise.workout_id } }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (table === 'completions' && request.method === 'DELETE' && targetId) {
          const separator = targetId.indexOf(':');
          if (separator <= 0 || separator === targetId.length - 1) {
            return new Response(JSON.stringify({ error: 'Conclusão inválida.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const studentId = targetId.slice(0, separator);
          const exerciseId = targetId.slice(separator + 1);
          await env.DB.prepare(
            'DELETE FROM exercise_completions WHERE student_id = ? AND exercise_id = ?'
          ).bind(studentId, exerciseId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'workout-completions' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT wc.id, wc.student_id, wc.workout_id, wc.completed_at, ws.started_at FROM workout_completions wc LEFT JOIN workout_starts ws ON ws.student_id = wc.student_id AND ws.workout_id = wc.workout_id ORDER BY wc.completed_at'
          ).all();
          return new Response(JSON.stringify(results.map(row => ({
            id: row.id,
            userId: row.student_id,
            workoutId: row.workout_id,
            startedAt: row.started_at,
            completedAt: row.completed_at
          }))), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'workout-completions' && request.method === 'POST') {
          const item = await request.json();
          const studentId = String(item.studentId || item.userId || '').trim();
          const workoutId = String(item.workoutId || '').trim();
          if (!studentId || !workoutId) {
            return new Response(JSON.stringify({ error: 'Aluno e treino são obrigatórios.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const workout = await env.DB.prepare(
            'SELECT id FROM workouts WHERE id = ? AND student_id = ? AND active = 1'
          ).bind(workoutId, studentId).first();
          if (!workout) {
            return new Response(JSON.stringify({ error: 'Treino não encontrado para este aluno.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const total = await env.DB.prepare(
            'SELECT COUNT(*) AS count FROM exercises WHERE workout_id = ?'
          ).bind(workoutId).first();
          const completed = await env.DB.prepare(
            'SELECT COUNT(*) AS count FROM exercises e JOIN exercise_completions ec ON ec.exercise_id = e.id WHERE e.workout_id = ? AND ec.student_id = ?'
          ).bind(workoutId, studentId).first();
          if (!total.count || total.count !== completed.count) {
            return new Response(JSON.stringify({ error: 'Marque todos os exercícios antes de terminar o treino.' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const completionId = String(item.id || crypto.randomUUID());
          await env.DB.prepare(
            'INSERT INTO workout_completions (id, student_id, workout_id) VALUES (?, ?, ?) ON CONFLICT(student_id, workout_id) DO NOTHING'
          ).bind(completionId, studentId, workoutId).run();
          const completion = await env.DB.prepare(
            'SELECT id, student_id, workout_id, completed_at FROM workout_completions WHERE student_id = ? AND workout_id = ?'
          ).bind(studentId, workoutId).first();
          const start = await env.DB.prepare(
            'SELECT started_at FROM workout_starts WHERE student_id = ? AND workout_id = ?'
          ).bind(studentId, workoutId).first();
          return new Response(JSON.stringify({ success: true, completion: {
            id: completion.id,
            userId: completion.student_id,
            workoutId: completion.workout_id,
            startedAt: start?.started_at || null,
            completedAt: completion.completed_at
          } }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'workouts' && request.method === 'GET') {
          const { results: workouts } = await env.DB.prepare(
            'SELECT id, student_id, teacher_id, title, training_day, instructions, active, created_at FROM workouts ORDER BY created_at ASC, rowid ASC'
          ).all();
          const { results: exercises } = await env.DB.prepare(
            'SELECT id, workout_id, name, sets, reps, rest_seconds, video_url, sort_order FROM exercises ORDER BY sort_order'
          ).all();
          const exercisesByWorkout = new Map();
          for (const exercise of exercises) {
            const list = exercisesByWorkout.get(exercise.workout_id) || [];
            list.push({
              id: exercise.id,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              rest: exercise.rest_seconds ? `${exercise.rest_seconds} segundos` : '',
              video: exercise.video_url || ''
            });
            exercisesByWorkout.set(exercise.workout_id, list);
          }
          const items = workouts.map(workout => ({
            id: workout.id,
            userId: workout.student_id,
            teacherId: workout.teacher_id,
            title: workout.title,
            day: workout.training_day || '',
            notes: workout.instructions || '',
            active: workout.active,
            createdAt: workout.created_at,
            exercises: exercisesByWorkout.get(workout.id) || []
          }));
          return new Response(JSON.stringify(items), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (table === 'workouts' && request.method === 'POST') {
          const item = await request.json();
          const studentId = String(item.userId || item.studentId || '').trim();
          const teacherId = String(item.teacherId || '').trim();
          const title = String(item.title || '').trim();
          const exercises = Array.isArray(item.exercises) ? item.exercises : [];
          if (!studentId || !teacherId || !title || exercises.length === 0) {
            return new Response(JSON.stringify({ error: 'Aluno, professor, título e pelo menos um exercício são obrigatórios.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const student = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? AND role = 'student' AND status = 'active'"
          ).bind(studentId).first();
          const teacher = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? AND role IN ('teacher', 'admin') AND status = 'active'"
          ).bind(teacherId).first();
          if (!student || !teacher) {
            return new Response(JSON.stringify({ error: 'Aluno ou professor não encontrado ou inativo.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const workoutId = String(item.id || crypto.randomUUID());
          const normalizedExercises = exercises.map((exercise, index) => ({
            id: String(exercise.id || crypto.randomUUID()),
            name: String(exercise.name || '').trim(),
            sets: Number.parseInt(exercise.sets, 10) || null,
            reps: String(exercise.reps || '').trim() || null,
            restSeconds: Number.parseInt(exercise.rest, 10) || null,
            videoUrl: String(exercise.video || '').trim() || null,
            sortOrder: index
          }));
          if (normalizedExercises.some(exercise => !exercise.name)) {
            return new Response(JSON.stringify({ error: 'Todos os exercícios precisam ter um nome.' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const statements = [env.DB.prepare(
            'INSERT INTO workouts (id, student_id, teacher_id, title, training_day, instructions) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(workoutId, studentId, teacherId, title, String(item.day || '').trim() || null, String(item.notes || '').trim() || null)];
          for (const exercise of normalizedExercises) {
            statements.push(env.DB.prepare(
              'INSERT INTO exercises (id, workout_id, name, sets, reps, rest_seconds, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(exercise.id, workoutId, exercise.name, exercise.sets, exercise.reps, exercise.restSeconds, exercise.videoUrl, exercise.sortOrder));
          }
          await env.DB.batch(statements);
          return new Response(JSON.stringify({ success: true, item: { ...item, id: workoutId, userId: studentId, teacherId, title } }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // GET: Listar todos
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
          const parsed = results.map(row => {
            if (row.exercises && typeof row.exercises === 'string') {
              try { row.exercises = JSON.parse(row.exercises); } catch(e){}
            }
            return row;
          });
          return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // POST: Adicionar item
        if (request.method === 'POST') {
          const item = await request.json();
          if (table === 'workouts' && item.exercises) {
            item.exercises = JSON.stringify(item.exercises);
          }

          const keys = Object.keys(item).join(', ');
          const placeholders = Object.keys(item).map(() => '?').join(', ');
          const values = Object.values(item);

          await env.DB.prepare(`INSERT INTO ${table} (${keys}) VALUES (${placeholders})`).bind(...values).run();
          return new Response(JSON.stringify({ success: true, item }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // PUT: Atualizar item
        if (request.method === 'PUT' && targetId) {
          const patch = await request.json();
          if (table === 'workouts' && patch.exercises) {
            patch.exercises = JSON.stringify(patch.exercises);
          }

          const setClause = Object.keys(patch).map(k => `${k} = ?`).join(', ');
          const values = [...Object.values(patch), targetId];

          await env.DB.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).bind(...values).run();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // DELETE: Remover item
        if (request.method === 'DELETE' && targetId) {
          await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(targetId).run();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Servir assets estáticos (HTML/CSS)
      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('Erro no Worker:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

function fromHex(value) {
  if (typeof value !== 'string' || !/^(?:[\da-f]{2})+$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g), byte => Number.parseInt(byte, 16));
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algorithm, iterationText, saltText, hashText, ...extra] = stored.split('$');
  const iterations = Number(iterationText);
  const salt = fromHex(saltText);
  const expected = fromHex(hashText);
  if (algorithm !== 'pbkdf2' || extra.length || !Number.isInteger(iterations) || iterations < 1 || iterations > 1000000 || !salt || salt.length < 16 || !expected || expected.length !== 32) {
    return false;
  }

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  const actual = new Uint8Array(bits);
  return actual.every((byte, index) => byte === expected[index]);
}