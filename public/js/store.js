const Store = (() => {
  const API_URL = "/api/store";

  // Retorna todos os registros de uma tabela no Cloudflare D1
  async function all(table) {
    try {
      const res = await fetch(`${API_URL}/${table}`);
      if (!res.ok) throw new Error("Erro ao buscar dados");
      return await res.json();
    } catch (err) {
      console.error(`Erro ao buscar ${table}:`, err);
      return [];
    }
  }

  // Adiciona um novo registro na tabela
  async function add(table, item) {
    try {
      const res = await fetch(`${API_URL}/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error("Erro ao adicionar");
      return await res.json();
    } catch (err) {
      console.error(`Erro ao adicionar em ${table}:`, err);
    }
  }

  // Atualiza um registro existente pelo ID
  async function update(table, id, patch) {
    try {
      const res = await fetch(`${API_URL}/${table}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return await res.json();
    } catch (err) {
      console.error(`Erro ao atualizar ${table}:${id}:`, err);
    }
  }

  // Remove um registro pelo ID
  async function remove(table, id) {
    try {
      const res = await fetch(`${API_URL}/${table}/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Erro ao remover");
      return await res.json();
    } catch (err) {
      console.error(`Erro ao remover de ${table}:${id}:`, err);
    }
  }

  return { all, add, update, remove };
})();