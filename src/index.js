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
        console.log('Tentativa de login para:', email);

        // Usamos .all() em vez de .first() para garantir compatibilidade com o D1 local
        const { results } = await env.DB.prepare(
          'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
        ).bind(email).all();

        const user = results && results[0] ? results[0] : null;
        console.log('Usuário encontrado no banco:', user);

        if (!user) {
          console.log('Erro: Usuário não encontrado.');
          return new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verifica se a senha confere (com or para password_hash ou password)
        const storedPassword = user.password_hash || user.password;
        if (storedPassword !== password) {
          console.log('Erro: Senha incorreta.');
          return new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Login bem-sucedido para:', user.name);
        return new Response(JSON.stringify({ success: true, user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Rotas de manipulação de tabelas (/api/store/:table)
      if (parts[0] === 'api' && parts[1] === 'store') {
        const table = parts[2];
        const targetId = parts[3];
        const allowedTables = ['users', 'workouts', 'completions', 'messages', 'packages', 'payments'];

        if (!allowedTables.includes(table)) {
          return new Response(JSON.stringify({ error: 'Tabela inválida' }), { status: 400, headers: corsHeaders });
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