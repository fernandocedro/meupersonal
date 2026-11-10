const $ = (s) => document.querySelector(s);
let currentUser = null;
let currentPage = "dashboard";

const navAdmin = [["dashboard","Visão geral"],["students","Alunos"],["workouts","Treinos"],["messages","Mensagens"],["packages","Pacotes"]];
const navStudent = [["dashboard","Meu painel"],["workouts","Meus treinos"],["messages","Mensagens"],["profile","Meu cadastro"]];

const id = () => "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = name => (name||"MP").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function userById(uid) {
  const users = await Store.all("users");
  return users.find(u => u.id === uid);
}

// Evento de Login via API do Worker
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      $("#login-error").textContent = data.error || "E-mail ou senha inválidos.";
      return;
    }

    currentUser = data.user;
    sessionStorage.setItem("mp-user", currentUser.id);
    showApp();
  } catch (err) {
    $("#login-error").textContent = "Erro de conexão com o servidor.";
  }
});

$("#logout-button").addEventListener("click", () => {
  currentUser = null;
  sessionStorage.removeItem("mp-user");
  $("#app-view").classList.add("hidden");
  $("#login-view").classList.remove("hidden");
});

async function showApp() {
  if (!currentUser) return;
  $("#login-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#side-name").textContent = currentUser.name;
  $("#topbar-name").textContent = currentUser.name;
  $("#side-role").textContent = currentUser.role === "admin" ? "Administrador" : "Aluno";
  
  const avatarHtml = currentUser.photo ? `<img src="${currentUser.photo}">` : initials(currentUser.name);
  $("#side-avatar").innerHTML = avatarHtml;
  $("#top-avatar").innerHTML = avatarHtml;

  renderNav();
  await navigate("dashboard");
}

function renderNav() {
  const nav = currentUser.role === "admin" ? navAdmin : navStudent;
  $("#navigation").innerHTML = nav.map(([key, label]) => 
    `<button class="nav-btn ${currentPage === key ? "active" : ""}" data-page="${key}">${label}</button>`
  ).join("");
  $("#navigation").querySelectorAll("button").forEach(b => b.onclick = () => navigate(b.dataset.page));
}

async function navigate(page) {
  currentPage = page;
  renderNav();
  const titles = {
    dashboard: currentUser.role === "admin" ? "Visão geral" : "Meu painel",
    students: "Alunos",
    workouts: currentUser.role === "admin" ? "Gestão de treinos" : "Meus treinos",
    messages: "Mensagens",
    packages: "Pacotes",
    profile: "Meu cadastro"
  };
  $("#page-title").textContent = titles[page] || "Meu personal";
  $("#page-eyebrow").textContent = currentUser.role === "admin" ? "ADMINISTRAÇÃO" : "ÁREA DO ALUNO";
  
  const pages = {
    dashboard: dashboardPage,
    students: studentsPage,
    workouts: workoutsPage,
    messages: messagesPage,
    packages: packagesPage,
    profile: profilePage
  };
  
  await (pages[page] || dashboardPage)();
}

async function dashboardPage() {
  if (currentUser.role === "admin") {
    await adminDashboard();
  } else {
    await studentDashboard();
  }
}

async function adminDashboard() {
  const users = await Store.all("users");
  const students = users.filter(u => u.role === "student");
  const workouts = await Store.all("workouts");
  const done = await Store.all("completions");

  $("#page-content").innerHTML = `
    <div class="grid">
      <div class="stat"><span>Alunos cadastrados</span><strong>${students.length}</strong><em>Base de alunos</em></div>
      <div class="stat"><span>Fichas de treino</span><strong>${workouts.length}</strong><em>Treinos cadastrados</em></div>
      <div class="stat"><span>Exercícios concluídos</span><strong>${done.length}</strong><em>Registros de execução</em></div>
      <div class="stat"><span>Alunos ativos</span><strong>${students.filter(u => u.status === "Ativo").length}</strong><em>Acesso liberado</em></div>
    </div>
    <div class="section-head"><h2>Alunos recentes</h2><button class="btn primary" id="quick-add">+ Novo aluno</button></div>
    <div class="panel table-wrap">${studentTable(students.slice(-5).reverse())}</div>
  `;
  $("#quick-add").onclick = () => navigate("students");
}

async function studentDashboard() {
  const workoutsAll = await Store.all("workouts");
  const workouts = workoutsAll.filter(w => w.userId === currentUser.id);
  const done = await Store.all("completions");
  const mine = done.filter(c => c.userId === currentUser.id);
  const exercises = workouts.reduce((n, w) => n + (w.exercises ? w.exercises.length : 0), 0);
  const completed = mine.length;

  $("#page-content").innerHTML = `
    <div class="grid">
      <div class="stat"><span>Fichas disponíveis</span><strong>${workouts.length}</strong><em>Seu programa</em></div>
      <div class="stat"><span>Exercícios concluídos</span><strong>${completed}</strong><em>Registrados</em></div>
      <div class="stat"><span>Exercícios no programa</span><strong>${exercises}</strong><em>Nas fichas atuais</em></div>
      <div class="stat"><span>Seu peso</span><strong>${esc(currentUser.weight || "—")} <small>kg</small></strong><em>Último cadastro</em></div>
    </div>
    <div class="section-head"><h2>Seus treinos</h2><button class="btn secondary" id="see-workouts">Ver todos</button></div>
    ${workouts.length ? `<div class="workout-list">${workouts.map(w => workoutSummary(w, mine)).join("")}</div>` : `<div class="empty">Seu personal ainda não cadastrou um treino para você.</div>`}
  `;
  $("#see-workouts").onclick = () => navigate("workouts");
}

function studentTable(list) {
  if (!list.length) return `<div class="empty">Nenhum aluno cadastrado.</div>`;
  return `<table><thead><tr><th>Aluno</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="pill ${u.status !== "Ativo" ? "pending" : ""}">${esc(u.status)}</span></td><td><div class="actions"><button class="btn secondary" data-edit-user="${u.id}">Editar</button><button class="btn secondary" data-user-workout="${u.id}">Criar treino</button></div></td></tr>`).join("")}</tbody></table>`;
}

async function studentsPage() {
  const users = await Store.all("users");
  const students = users.filter(u => u.role === "student");

  $("#page-content").innerHTML = `
    <div class="section-head"><h2>Gerenciar alunos</h2><button class="btn primary" id="new-student">+ Cadastrar aluno</button></div>
    <div class="panel table-wrap" id="student-table">${studentTable(students)}</div>
    <div class="panel hidden" id="student-form-panel">
      <h2 id="student-form-title">Novo aluno</h2>
      <form id="student-form">
        <input type="hidden" id="student-id">
        <div class="form-grid">
          <label>Nome completo<input id="s-name" required></label>
          <label>E-mail<input id="s-email" type="email" required></label>
          <label>Senha inicial<input id="s-password" type="text" placeholder="Mínimo 6 caracteres"></label>
          <label>Telefone<input id="s-phone"></label>
          <label>Endereço<input id="s-address"></label>
          <label>Altura (m)<input id="s-height" placeholder="1,72"></label>
          <label>Peso (kg)<input id="s-weight" type="number" step=".1"></label>
          <label>Status<select id="s-status"><option>Ativo</option><option>Pendente</option><option>Bloqueado</option></select></label>
          <label class="wide">Foto de perfil<input id="s-photo" type="file" accept="image/*"></label>
        </div>
        <div class="form-actions">
          <button class="btn primary">Salvar aluno</button>
          <button class="btn ghost" type="button" id="cancel-student">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  $("#new-student").onclick = () => openStudentForm();
  $("#cancel-student").onclick = () => $("#student-form-panel").classList.add("hidden");
  $("#student-form").onsubmit = saveStudent;
  bindStudentActions();
}

function bindStudentActions() {
  document.querySelectorAll("[data-edit-user]").forEach(b => b.onclick = () => openStudentForm(b.dataset.editUser));
  document.querySelectorAll("[data-user-workout]").forEach(b => b.onclick = () => openWorkoutForm(b.dataset.userWorkout));
}

async function openStudentForm(uid) {
  const u = uid ? await userById(uid) : null;
  $("#student-form-panel").classList.remove("hidden");
  $("#student-form-title").textContent = u ? "Editar aluno" : "Novo aluno";
  $("#student-id").value = u?.id || "";
  $("#s-name").value = u?.name || "";
  $("#s-email").value = u?.email || "";
  $("#s-email").disabled = !!u;
  $("#s-password").value = "";
  $("#s-phone").value = u?.phone || "";
  $("#s-address").value = u?.address || "";
  $("#s-height").value = u?.height || "";
  $("#s-weight").value = u?.weight || "";
  $("#s-status").value = u?.status || "Ativo";
  $("#student-form-panel").scrollIntoView({ behavior: "smooth" });
}

async function saveStudent(e) {
  e.preventDefault();
  const uid = $("#student-id").value;
  const users = await Store.all("users");
  const old = users.find(u => u.id === uid);
  const email = $("#s-email").value.trim();

  if (users.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== uid)) {
    toast("Este e-mail já está cadastrado.");
    return;
  }

  let photo = old?.photo || "";
  const file = $("#s-photo").files[0];
  if (file) photo = await fileToData(file);

  const patch = {
    name: $("#s-name").value.trim(),
    email,
    phone: $("#s-phone").value,
    address: $("#s-address").value,
    height: $("#s-height").value,
    weight: $("#s-weight").value,
    status: $("#s-status").value,
    photo
  };

  if (uid) {
    if ($("#s-password").value) patch.password = $("#s-password").value;
    await Store.update("users", uid, patch);
  } else {
    if ($("#s-password").value.length < 6) {
      toast("Defina uma senha com pelo menos 6 caracteres.");
      return;
    }
    await Store.add("users", { id: id(), ...patch, password: $("#s-password").value, role: "student" });
  }

  $("#student-form-panel").classList.add("hidden");
  toast("Aluno salvo com sucesso.");
  await studentsPage();
}

function fileToData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function workoutsPage() {
  const admin = currentUser.role === "admin";
  const workoutsAll = await Store.all("workouts");
  const workouts = admin ? workoutsAll : workoutsAll.filter(w => w.userId === currentUser.id);
  const users = await Store.all("users");

  $("#page-content").innerHTML = `
    <div class="section-head">
      <h2>${admin ? "Fichas cadastradas" : "Seus exercícios"}</h2>
      ${admin ? '<button class="btn primary" id="new-workout">+ Criar treino</button>' : ""}
    </div>
    <div class="workout-list">
      ${workouts.length ? workouts.map(w => admin ? adminWorkoutCard(w, users) : studentWorkoutCard(w)).join("") : `<div class="empty">${admin ? "Nenhuma ficha cadastrada." : "Nenhum treino disponível no momento."}</div>`}
    </div>
    <div class="panel hidden" id="workout-form-panel">
      <h2 id="workout-form-title">Criar ficha</h2>
      <form id="workout-form">
        <input type="hidden" id="workout-id">
        <div class="form-grid">
          <label>Aluno<select id="w-user" required>${users.filter(u => u.role === "student").map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label>
          <label>Nome da ficha<input id="w-title" placeholder="Treino A — Peito e tríceps" required></label>
          <label>Dia da semana<input id="w-day" placeholder="Segunda-feira"></label>
          <label class="wide">Orientações<textarea id="w-notes"></textarea></label>
        </div>
        <div class="section-head"><h2>Exercícios</h2><button type="button" class="btn secondary" id="add-exercise">+ Adicionar exercício</button></div>
        <div id="exercise-fields"></div>
        <div class="form-actions">
          <button class="btn primary">Salvar ficha</button>
          <button type="button" class="btn ghost" id="cancel-workout">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  if (admin) {
    $("#new-workout").onclick = () => openWorkoutForm();
    $("#cancel-workout").onclick = () => $("#workout-form-panel").classList.add("hidden");
    $("#add-exercise").onclick = () => addExerciseField();
    $("#workout-form").onsubmit = saveWorkout;

    document.querySelectorAll("[data-edit-workout]").forEach(b => b.onclick = () => openWorkoutForm(null, b.dataset.editWorkout));
    document.querySelectorAll("[data-delete-workout]").forEach(b => b.onclick = async () => {
      if (confirm("Excluir esta ficha?")) {
        await Store.remove("workouts", b.dataset.deleteWorkout);
        await workoutsPage();
      }
    });
  } else {
    document.querySelectorAll("[data-complete]").forEach(c => c.onchange = () => toggleCompletion(c.dataset.workout, c.dataset.exercise, c.checked));
    document.querySelectorAll("[data-video]").forEach(b => b.onclick = () => window.open(b.dataset.video, "_blank", "noopener"));
  }
}

function adminWorkoutCard(w, users) {
  const u = users.find(x => x.id === w.userId);
  return `
    <div class="panel">
      <div class="section-head">
        <div>
          <h2>${esc(w.title)}</h2>
          <small>${esc(u?.name || "Aluno removido")} · ${esc(w.day || "Dia não definido")}</small>
        </div>
        <div class="actions">
          <button class="btn secondary" data-edit-workout="${w.id}">Editar</button>
          <button class="btn danger" data-delete-workout="${w.id}">Excluir</button>
        </div>
      </div>
      <p class="muted">${w.exercises?.length || 0} exercício(s) · ${esc(w.notes || "Sem orientações")}</p>
    </div>
  `;
}

async function studentWorkoutCard(w) {
  const completions = await Store.all("completions");
  const done = completions.filter(c => c.userId === currentUser.id && c.workoutId === w.id);
  const exercises = w.exercises || [];

  return `
    <div class="panel">
      <h2>${esc(w.title)}</h2>
      <small>${esc(w.day || "")}</small>
      <div class="progress"><span style="width:${exercises.length ? (done.filter(c => exercises.some(e => e.id === c.exerciseId)).length / exercises.length) * 100 : 0}%"></span></div>
      <div class="workout-list">
        ${exercises.map(e => {
          const checked = done.some(c => c.exerciseId === e.id);
          return `
            <div class="exercise-card">
              <div class="exercise-thumb">↗</div>
              <div class="exercise-info">
                <h3>${esc(e.name)}</h3>
                <p>${esc(e.sets)} séries × ${esc(e.reps)} repetições · descanso ${esc(e.rest || "—")}</p>
              </div>
              <button class="btn secondary" data-video="${esc(e.video)}">Vídeo</button>
              <input class="check" type="checkbox" aria-label="Marcar ${esc(e.name)} como concluído" data-complete data-workout="${w.id}" data-exercise="${e.id}" ${checked ? "checked" : ""}>
            </div>
          `;
        }).join("")}
      </div>
      ${w.notes ? `<p class="muted">${esc(w.notes)}</p>` : ""}
    </div>
  `;
}

function workoutSummary(w, mine) {
  const completed = mine.filter(c => c.workoutId === w.id).length;
  const total = w.exercises?.length || 0;
  return `
    <div class="panel">
      <h2>${esc(w.title)}</h2>
      <p class="muted">${esc(w.day || "")}</p>
      <span class="pill">${completed}/${total} exercícios concluídos</span>
    </div>
  `;
}

function addExerciseField(e = {}) {
  const wrap = document.createElement("div");
  wrap.className = "panel exercise-input";
  wrap.innerHTML = `
    <div class="form-grid">
      <label class="wide">Nome do exercício<input class="ex-name" value="${esc(e.name || "")}" required></label>
      <label>Séries<input class="ex-sets" value="${esc(e.sets || "3")}" required></label>
      <label>Repetições<input class="ex-reps" value="${esc(e.reps || "12")}" required></label>
      <label>Descanso<input class="ex-rest" value="${esc(e.rest || "60 segundos")}"></label>
      <label>Link do YouTube<input class="ex-video" type="url" value="${esc(e.video || "")}" placeholder="https://youtube.com/..."></label>
    </div>
    <button type="button" class="btn danger remove-ex" style="margin-top:10px">Remover exercício</button>
  `;
  wrap.querySelector(".remove-ex").onclick = () => wrap.remove();
  $("#exercise-fields").append(wrap);
}

async function openWorkoutForm(uid = null, wid = null) {
  const workouts = await Store.all("workouts");
  const w = workouts.find(x => x.id === wid);
  const users = await Store.all("users");

  $("#workout-form-panel").classList.remove("hidden");
  $("#workout-form-title").textContent = w ? "Editar ficha" : "Criar ficha";
  $("#workout-id").value = w?.id || "";
  $("#w-user").value = w?.userId || uid || users.find(u => u.role === "student")?.id || "";
  $("#w-title").value = w?.title || "";
  $("#w-day").value = w?.day || "";
  $("#w-notes").value = w?.notes || "";
  $("#exercise-fields").innerHTML = "";
  
  (w?.exercises || [{}]).forEach(addExerciseField);
  $("#workout-form-panel").scrollIntoView({ behavior: "smooth" });
}

async function saveWorkout(e) {
  e.preventDefault();
  const fields = [...document.querySelectorAll(".exercise-input")];
  if (!fields.length) {
    toast("Adicione pelo menos um exercício.");
    return;
  }
  
  const exercises = fields.map(f => ({
    id: f.dataset.exerciseId || id(),
    name: f.querySelector(".ex-name").value,
    sets: f.querySelector(".ex-sets").value,
    reps: f.querySelector(".ex-reps").value,
    rest: f.querySelector(".ex-rest").value,
    video: f.querySelector(".ex-video").value
  }));

  const wid = $("#workout-id").value;
  const obj = {
    userId: $("#w-user").value,
    title: $("#w-title").value,
    day: $("#w-day").value,
    notes: $("#w-notes").value,
    exercises
  };

  if (wid) {
    await Store.update("workouts", wid, obj);
  } else {
    await Store.add("workouts", { id: id(), ...obj });
  }

  toast("Treino salvo.");
  await workoutsPage();
}

async function toggleCompletion(wid, eid, checked) {
  const completions = await Store.all("completions");
  const existing = completions.find(c => c.userId === currentUser.id && c.workoutId === wid && c.exerciseId === eid);

  if (checked && !existing) {
    await Store.add("completions", {
      id: id(),
      userId: currentUser.id,
      workoutId: wid,
      exerciseId: eid,
      completedAt: new Date().toISOString()
    });
  } else if (!checked && existing) {
    await Store.remove("completions", existing.id);
  }

  toast(checked ? "Exercício concluído!" : "Conclusão desmarcada.");
  await workoutsPage();
}

async function messagesPage() {
  const isAdmin = currentUser.role === "admin";
  const users = await Store.all("users");
  const students = users.filter(u => u.role === "student");
  const selected = isAdmin ? ($("#message-student")?.value || students[0]?.id) : currentUser.id;
  
  const messages = await Store.all("messages");
  const msgs = messages.filter(m => isAdmin ? m.userId === selected : m.userId === currentUser.id);

  $("#page-content").innerHTML = `
    <div class="panel">
      <h2>Conversas</h2>
      ${isAdmin ? `<label>Aluno<select id="message-student">${students.map(u => `<option value="${u.id}" ${u.id === selected ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>` : "<p class='muted'>Converse diretamente com seu personal.</p>"}
      <div class="message-list" id="message-list" style="margin-top:18px">
        ${msgs.length ? msgs.map(m => `<div class="message-card ${m.senderId === currentUser.id ? "mine" : ""}"><div class="meta"><strong>${esc(users.find(u => u.id === m.senderId)?.name || "Usuário")}</strong><span>${new Date(m.createdAt).toLocaleString("pt-BR")}</span></div><p>${esc(m.text)}</p></div>`).join("") : `<div class="empty">Nenhuma mensagem por aqui ainda.</div>`}
      </div>
      <form class="message-compose" id="message-form">
        <textarea id="message-text" placeholder="Digite sua mensagem..." required></textarea>
        <button class="btn primary">Enviar</button>
      </form>
    </div>
  `;

  $("#message-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#message-text").value.trim();
    if (!text) return;

    await Store.add("messages", {
      id: id(),
      userId: selected,
      senderId: currentUser.id,
      text,
      createdAt: new Date().toISOString()
    });
    await messagesPage();
  };

  if (isAdmin) $("#message-student").onchange = messagesPage;
}

async function packagesPage() {
  const packages = await Store.all("packages");

  $("#page-content").innerHTML = `
    <div class="section-head"><h2>Pacotes de treinamento</h2><button class="btn primary" id="add-package">+ Novo pacote</button></div>
    <div class="grid">${packages.map(p => `<div class="panel"><h2>${esc(p.name)}</h2><strong style="font:800 1.7rem Manrope">R$ ${Number(p.price).toFixed(2).replace(".", ",")}</strong><p class="muted">${p.days} dias de acesso</p></div>`).join("")}</div>
    <div class="panel">
      <h2>Criar pacote</h2>
      <form id="package-form" class="form-grid">
        <label>Nome<input id="p-name" required></label>
        <label>Preço (R$)<input id="p-price" type="number" min="0" step=".01" required></label>
        <label>Duração em dias<input id="p-days" type="number" min="1" value="30" required></label>
        <div class="wide"><button class="btn primary">Salvar pacote</button></div>
      </form>
    </div>
  `;

  $("#package-form").onsubmit = async (e) => {
    e.preventDefault();
    await Store.add("packages", {
      id: id(),
      name: $("#p-name").value,
      price: Number($("#p-price").value),
      days: Number($("#p-days").value)
    });
    await packagesPage();
    toast("Pacote cadastrado.");
  };
}

async function profilePage() {
  $("#page-content").innerHTML = `
    <div class="panel">
      <h2>Meu cadastro</h2>
      <form id="profile-form">
        <div class="form-grid">
          <label>Nome completo<input id="profile-name" value="${esc(currentUser.name)}" required></label>
          <label>E-mail<input value="${esc(currentUser.email)}" disabled></label>
          <label>Endereço<input id="profile-address" value="${esc(currentUser.address || "")}"></label>
          <label>Altura (m)<input id="profile-height" value="${esc(currentUser.height || "")}"></label>
          <label>Peso (kg)<input id="profile-weight" type="number" step=".1" value="${esc(currentUser.weight || "")}"></label>
          <label class="wide">Foto de perfil<input id="profile-photo" type="file" accept="image/*"></label>
        </div>
        <div class="form-actions"><button class="btn primary">Salvar alterações</button></div>
      </form>
    </div>
  `;

  $("#profile-form").onsubmit = async (e) => {
    e.preventDefault();
    const patch = {
      name: $("#profile-name").value,
      address: $("#profile-address").value,
      height: $("#profile-height").value,
      weight: $("#profile-weight").value
    };

    const f = $("#profile-photo").files[0];
    if (f) patch.photo = await fileToData(f);

    await Store.update("users", currentUser.id, patch);
    currentUser = await userById(currentUser.id);
    await showApp();
    await navigate("profile");
    toast("Cadastro atualizado.");
  };
}

// Inicialização da Sessão ao abrir a página
const saved = sessionStorage.getItem("mp-user");
if (saved) {
  userById(saved).then(u => {
    if (u) {
      currentUser = u;
      showApp();
    }
  });
}