// ============================================================
// Polla Mundial 2026 - Lógica principal
// Requiere: Firebase 9 compat, data.js, config.js
// ============================================================

// ---------- Estado global ----------
let currentUser = null;
let currentView = "dashboard";
let allPredictions = {}; // { uid: { matchId: {h,v}, champion, runner_up } }
let allScores = {};       // { uid: { total, name, uid } }
let realResults = {};     // { matchId: {h, v, status} }
let knockoutMatches = []; // Partidos eliminatorios del Firebase

// ---------- Init Firebase (compat) ----------
const firebaseConfigured = FIREBASE_CONFIG.apiKey !== "TU_API_KEY";
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

// Si Firebase no está configurado, mostrar pantalla de setup tras 1.5s
if (!firebaseConfigured) {
  setTimeout(() => {
    hideSplash();
    showSetupScreen();
  }, 1500);
}

// ---------- Auth ----------
auth.onAuthStateChanged(user => {
  if (!firebaseConfigured) return; // evitar conflicto con modo demo
  hideSplash();
  if (user) {
    currentUser = user;
    showApp();
    initApp();
  } else {
    showAuthPage();
  }
});

function hideSplash() {
  document.getElementById("splash").classList.add("hidden");
}
function showSetupScreen() {
  const el = document.getElementById("setup-page");
  el.style.display = "flex";
}
function showAuthPage() {
  document.getElementById("setup-page").style.display = "none";
  document.getElementById("auth-page").classList.add("active");
  document.getElementById("app").classList.remove("active");
}
function showApp() {
  document.getElementById("auth-page").classList.remove("active");
  document.getElementById("app").classList.add("active");
  document.getElementById("header-user-name").textContent =
    currentUser.displayName || currentUser.email.split("@")[0];
}

// ---- Registro / Login ----
let authMode = "login";
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.tab;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("register-extra").style.display =
      authMode === "register" ? "block" : "none";
    document.getElementById("btn-auth").textContent =
      authMode === "login" ? "Iniciar sesión" : "Crear cuenta";
    clearAuthError();
  });
});

document.getElementById("btn-auth").addEventListener("click", async () => {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const name = document.getElementById("auth-name").value.trim();
  const btn = document.getElementById("btn-auth");
  clearAuthError();

  if (!email || !password) return showAuthError("Completa todos los campos");
  if (authMode === "register" && !name) return showAuthError("Ingresa tu nombre");
  if (password.length < 6) return showAuthError("Contraseña mínimo 6 caracteres");

  btn.disabled = true;
  btn.textContent = "...";
  try {
    if (authMode === "login") {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      // Crear doc de usuario
      await db.collection("usuarios").doc(cred.user.uid).set({
        nombre: name, email, uid: cred.user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = authMode === "login" ? "Iniciar sesión" : "Crear cuenta";
    const msgs = {
      "auth/user-not-found": "Usuario no encontrado",
      "auth/wrong-password": "Contraseña incorrecta",
      "auth/email-already-in-use": "Este email ya está registrado",
      "auth/invalid-email": "Email inválido",
      "auth/weak-password": "Contraseña muy débil",
      "auth/invalid-credential": "Email o contraseña incorrectos",
    };
    showAuthError(msgs[e.code] || e.message);
  }
});

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg; el.classList.add("visible");
}
function clearAuthError() {
  document.getElementById("auth-error").classList.remove("visible");
}

document.getElementById("btn-logout").addEventListener("click", () => {
  auth.signOut();
});

// ---------- Navegación ----------
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    navigateTo(item.dataset.view);
  });
});

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.view === view));
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active", v.id === `view-${view}`));
  // Renderizar la vista activa
  if (view === "dashboard") renderDashboard();
  if (view === "grupos") renderGrupos();
  if (view === "eliminatoria") renderEliminatoria();
  if (view === "ranking") renderRanking();
  if (view === "admin" && isAdmin()) renderAdmin();
}

function isAdmin() {
  return POLLA_CONFIG.admins.includes(currentUser?.email);
}

// ---------- Inicializar app ----------
async function initApp() {
  // Mostrar o esconder pestaña admin
  if (isAdmin()) {
    document.getElementById("nav-admin").classList.remove("hidden");
  }
  // Suscribir a cambios de resultados en tiempo real
  db.collection("resultados").onSnapshot(snap => {
    snap.docs.forEach(d => {
      realResults[d.id] = d.data();
    });
    recalcularTodosLosScores();
    if (currentView === "dashboard") renderDashboard();
    if (currentView === "ranking") renderRanking();
    if (currentView === "grupos") renderGrupos();
  });

  // Cargar predicciones del usuario
  await loadMisPredictions();

  // Cargar datos de eliminatoria
  db.collection("eliminatoria").orderBy("orden").onSnapshot(snap => {
    knockoutMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentView === "eliminatoria") renderEliminatoria();
  });

  navigateTo("dashboard");
}

// ---------- Predicciones ----------
async function loadMisPredictions() {
  const doc = await db.collection("predicciones").doc(currentUser.uid).get();
  if (doc.exists) {
    allPredictions[currentUser.uid] = doc.data();
  } else {
    allPredictions[currentUser.uid] = {};
  }
}

async function guardarPrediccion(matchId, homeScore, awayScore) {
  const uid = currentUser.uid;
  if (!allPredictions[uid]) allPredictions[uid] = {};
  allPredictions[uid][matchId] = { h: homeScore, v: awayScore, ts: Date.now() };
  await db.collection("predicciones").doc(uid).set(
    { [matchId]: { h: homeScore, v: awayScore, ts: Date.now() } },
    { merge: true }
  );
  recalcularScore(uid);
}

async function guardarCampeon(campeonId, subcampeonId, terceroId) {
  const uid = currentUser.uid;
  if (!allPredictions[uid]) allPredictions[uid] = {};
  allPredictions[uid]["_campeon"] = campeonId;
  allPredictions[uid]["_subcampeon"] = subcampeonId;
  allPredictions[uid]["_tercero"] = terceroId;
  await db.collection("predicciones").doc(uid).set(
    { _campeon: campeonId, _subcampeon: subcampeonId, _tercero: terceroId },
    { merge: true }
  );
  recalcularScore(uid);
  showToast("✅ Predicciones guardadas", "success");
}

// ---------- Puntuación ----------
function calcularPuntosPartido(pred, real) {
  if (!pred || !real || real.h === undefined || real.h === null) return 0;
  const ph = Number(pred.h), pv = Number(pred.v);
  const rh = Number(real.h), rv = Number(real.v);
  if (isNaN(ph) || isNaN(pv)) return 0;

  const predResult = ph > pv ? "L" : ph < pv ? "V" : "E";
  const realResult = rh > rv ? "L" : rh < rv ? "V" : "E";

  if (ph === rh && pv === rv) return PUNTUACION.marcadorExacto; // incluye resultado correcto
  if (predResult === realResult) return PUNTUACION.resultadoCorrecto;
  return 0;
}

function calcularPuntosEliminatoria(pred, real, fase) {
  if (!pred || !real || real.h === undefined) return 0;
  const ph = Number(pred.h), pv = Number(pred.v);
  const rh = Number(real.h), rv = Number(real.v);
  const base = PUNTUACION.eliminatoria[fase] || 3;
  if (ph === rh && pv === rv) return base + PUNTUACION.eliminatoriaExacto;
  const predResult = ph > pv ? "L" : ph < pv ? "V" : "E";
  const realResult = rh > rv ? "L" : rh < rv ? "V" : "E";
  if (predResult === realResult) return base;
  return 0;
}

function recalcularScore(uid) {
  const preds = allPredictions[uid] || {};
  let total = 0, gruposTotal = 0, eliminatoriaTotal = 0;

  // Fase de grupos
  for (const partido of PARTIDOS_GRUPOS) {
    const pred = preds[partido.id];
    const real = realResults[partido.id];
    const pts = calcularPuntosPartido(pred, real);
    gruposTotal += pts;
  }

  // Eliminatoria
  for (const partido of knockoutMatches) {
    const pred = preds[partido.id];
    const real = realResults[partido.id];
    if (pred && real && real.h !== undefined) {
      eliminatoriaTotal += calcularPuntosEliminatoria(pred, real, partido.fase);
    }
  }

  // Campeón
  if (preds["_campeon"] && realResults["_campeon"] === preds["_campeon"]) {
    total += PUNTUACION.campeon;
  }
  if (preds["_subcampeon"] && realResults["_subcampeon"] === preds["_subcampeon"]) {
    total += PUNTUACION.subcampeon;
  }
  if (preds["_tercero"] && realResults["_tercero"] === preds["_tercero"]) {
    total += PUNTUACION.tercero;
  }

  total += gruposTotal + eliminatoriaTotal;
  allScores[uid] = { total, gruposTotal, eliminatoriaTotal };
  return allScores[uid];
}

async function recalcularTodosLosScores() {
  // Cargar predicciones de todos los usuarios y recalcular
  const snap = await db.collection("predicciones").get();
  snap.docs.forEach(doc => {
    allPredictions[doc.id] = doc.data();
    recalcularScore(doc.id);
  });

  // Cargar nombres de usuarios
  const usersSnap = await db.collection("usuarios").get();
  usersSnap.docs.forEach(doc => {
    const d = doc.data();
    if (allScores[doc.id]) {
      allScores[doc.id].nombre = d.nombre || d.email;
      allScores[doc.id].uid = doc.id;
    }
  });
}

// ---------- Render: Dashboard ----------
function renderDashboard() {
  const uid = currentUser.uid;
  const mis = allPredictions[uid] || {};
  const score = recalcularScore(uid) || { total: 0, gruposTotal: 0, eliminatoriaTotal: 0 };

  // Ranking posición
  const ranking = Object.values(allScores).sort((a, b) => b.total - a.total);
  const pos = ranking.findIndex(s => s.uid === uid) + 1 || "–";

  // Partidos predichos
  const predichos = PARTIDOS_GRUPOS.filter(p => mis[p.id] !== undefined).length;
  const total = PARTIDOS_GRUPOS.length;

  document.getElementById("dash-pts").textContent = score.total;
  document.getElementById("dash-rank").textContent = `#${pos} de ${ranking.length || "–"}`;
  document.getElementById("dash-predichos").textContent = predichos;
  document.getElementById("dash-total").textContent = total;
  document.getElementById("dash-pts-grupos").textContent = score.gruposTotal;
  document.getElementById("dash-pts-elim").textContent = score.eliminatoriaTotal;

  // Próximos partidos a predecir
  const sinPredecir = PARTIDOS_GRUPOS.filter(p => !mis[p.id]);
  const proxEl = document.getElementById("dash-proximos");
  if (sinPredecir.length === 0) {
    proxEl.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>¡Tienes todos los partidos predichos!</p></div>`;
  } else {
    proxEl.innerHTML = sinPredecir.slice(0, 5).map(p => {
      const el = getEquipo(p.local), ev = getEquipo(p.visitante);
      return `<div class="partido-row" style="cursor:pointer" onclick="navigateTo('grupos')">
        <div class="partido-equipos">
          <span class="equipo-nombre">${el.bandera} ${el.nombre}</span>
          <span style="color:var(--gris);font-size:12px">Grupo ${p.grupo}</span>
          <span class="equipo-nombre visitante">${ev.nombre} ${ev.bandera}</span>
        </div>
      </div>`;
    }).join("") + (sinPredecir.length > 5
      ? `<p class="text-muted text-center mt-8">+${sinPredecir.length - 5} más sin predecir</p>` : "");
  }
}

// ---------- Render: Grupos ----------
function renderGrupos() {
  const container = document.getElementById("grupos-container");
  const mis = allPredictions[currentUser.uid] || {};

  container.innerHTML = Object.keys(GRUPOS).map(grupoId => {
    const grupo = GRUPOS[grupoId];
    const partidos = PARTIDOS_GRUPOS.filter(p => p.grupo === grupoId);
    const predichos = partidos.filter(p => mis[p.id] !== undefined).length;

    return `
    <div class="card" id="grupo-card-${grupoId}">
      <div class="grupo-header" onclick="toggleGrupo('${grupoId}')">
        <div class="grupo-badge">${grupoId}</div>
        <span class="grupo-title">${grupo.nombre} — ${grupo.equipos.map(id => getEquipo(id).bandera).join(" ")}</span>
        <span class="grupo-progress">${predichos}/${partidos.length}</span>
        <span class="grupo-chevron" id="chevron-${grupoId}">▼</span>
      </div>
      <div class="grupo-content" id="grupo-content-${grupoId}">
        ${partidos.map(p => renderPartidoInput(p, mis[p.id], realResults[p.id])).join("")}
      </div>
    </div>`;
  }).join("");
}

function renderPartidoInput(partido, pred, real) {
  const el = getEquipo(partido.local), ev = getEquipo(partido.visitante);
  const cerrado = real && real.status === "FINISHED";
  const pts = calcularPuntosPartido(pred, real);

  return `
  <div class="partido-row ${pred ? "guardado" : ""} ${cerrado ? "cerrado" : ""}" id="partido-${partido.id}">
    <div class="partido-equipos">
      <span class="equipo-nombre">${el.bandera} ${el.nombre}</span>
      <div class="score-input-group">
        <input type="number" min="0" max="20" class="score-input"
          id="score-h-${partido.id}" value="${pred ? pred.h : ""}"
          ${cerrado ? "disabled" : ""}
          oninput="onScoreInput('${partido.id}')">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input"
          id="score-v-${partido.id}" value="${pred ? pred.v : ""}"
          ${cerrado ? "disabled" : ""}
          oninput="onScoreInput('${partido.id}')">
      </div>
      <span class="equipo-nombre visitante">${ev.nombre} ${ev.bandera}</span>
    </div>
    ${!cerrado ? `<button class="btn-guardar-partido" id="btn-${partido.id}"
      onclick="guardarPartidoPred('${partido.id}')"
      ${pred ? "" : ""}>
      ${pred ? "✅ Guardado — Actualizar" : "Guardar predicción"}
    </button>` : ""}
    ${real && real.h !== undefined ? `
    <div class="resultado-real">
      <span>Resultado real: <strong>${el.bandera} ${real.h} – ${real.v} ${ev.bandera}</strong></span>
      <span class="pts-ganados ${pts === 0 ? "cero" : ""}">+${pts} pts</span>
    </div>` : ""}
  </div>`;
}

function onScoreInput(matchId) {
  const btn = document.getElementById(`btn-${matchId}`);
  if (btn) btn.textContent = "Guardar predicción";
}

async function guardarPartidoPred(matchId) {
  const h = document.getElementById(`score-h-${matchId}`).value;
  const v = document.getElementById(`score-v-${matchId}`).value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  const btn = document.getElementById(`btn-${matchId}`);
  btn.disabled = true; btn.textContent = "Guardando...";
  await guardarPrediccion(matchId, Number(h), Number(v));
  btn.disabled = false; btn.textContent = "✅ Guardado — Actualizar";
  document.getElementById(`partido-${matchId}`).classList.add("guardado");
  showToast("✅ Predicción guardada", "success");
}

function toggleGrupo(grupoId) {
  const content = document.getElementById(`grupo-content-${grupoId}`);
  const chevron = document.getElementById(`chevron-${grupoId}`);
  content.classList.toggle("open");
  chevron.classList.toggle("open");
}

// ---------- Render: Eliminatoria ----------
function renderEliminatoria() {
  const container = document.getElementById("eliminatoria-container");
  const mis = allPredictions[currentUser.uid] || {};

  if (knockoutMatches.length === 0) {
    container.innerHTML = `
    <div class="empty-state">
      <div class="icon">🔜</div>
      <p>Los partidos eliminatorios aparecerán aquí una vez que finalice la fase de grupos</p>
    </div>
    <div class="card">
      <div class="card-title">🏆 Mi Campeón</div>
      ${renderCampeonSelector(mis)}
    </div>`;
    return;
  }

  const porFase = {};
  for (const m of knockoutMatches) {
    if (!porFase[m.fase]) porFase[m.fase] = [];
    porFase[m.fase].push(m);
  }

  container.innerHTML = `
  <div class="card">
    <div class="card-title">🏆 Mi Campeón</div>
    ${renderCampeonSelector(mis)}
  </div>
  ` + FASES_ELIMINATORIAS
    .filter(f => porFase[f.id])
    .map(f => `
    <div class="bracket-round">
      <div class="bracket-round-title">${f.nombre}</div>
      ${porFase[f.id].map(m => renderEliminatoriaMatch(m, mis[m.id], realResults[m.id], f.id)).join("")}
    </div>`).join("");
}

function renderEliminatoriaMatch(partido, pred, real, fase) {
  const el = partido.localId ? getEquipo(partido.localId) : null;
  const ev = partido.visitanteId ? getEquipo(partido.visitanteId) : null;
  const cerrado = real && real.status === "FINISHED";
  const pts = pred && real ? calcularPuntosEliminatoria(pred, real, fase) : 0;

  return `
  <div class="bracket-match" id="elim-${partido.id}">
    <div class="bracket-team ${!el ? "tbd" : ""}">
      <span>${el ? el.bandera : "🤔"}</span>
      <span>${el ? el.nombre : partido.localLabel || "Por definir"}</span>
      ${real ? `<span class="score">${real.h}</span>` : ""}
    </div>
    <div class="bracket-team ${!ev ? "tbd" : ""}">
      <span>${ev ? ev.bandera : "🤔"}</span>
      <span>${ev ? ev.nombre : partido.visitanteLabel || "Por definir"}</span>
      ${real ? `<span class="score">${real.v}</span>` : ""}
    </div>
    ${el && ev && !cerrado ? `
    <div style="padding:10px 14px; border-top:1px solid var(--gris-borde);">
      <div class="score-input-group" style="justify-content:center;gap:12px">
        <input type="number" min="0" max="20" class="score-input"
          id="escore-h-${partido.id}" value="${pred ? pred.h : ""}">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input"
          id="escore-v-${partido.id}" value="${pred ? pred.v : ""}">
      </div>
      <button class="btn-guardar-partido" style="margin-top:8px"
        onclick="guardarElimPartido('${partido.id}')">
        ${pred ? "✅ Guardado — Actualizar" : "Guardar predicción"}
      </button>
    </div>` : ""}
    ${pts > 0 ? `<div style="padding:6px 14px;background:#f0fdf4;font-size:13px;font-weight:700;color:var(--verde)">+${pts} puntos</div>` : ""}
  </div>`;
}

async function guardarElimPartido(matchId) {
  const h = document.getElementById(`escore-h-${matchId}`)?.value;
  const v = document.getElementById(`escore-v-${matchId}`)?.value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  await guardarPrediccion(matchId, Number(h), Number(v));
  showToast("✅ Predicción guardada", "success");
  renderEliminatoria();
}

function renderCampeonSelector(mis) {
  const todosEquipos = Object.entries(EQUIPOS)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));

  const select = (id, label, val) => `
  <div class="form-group">
    <label>${label}</label>
    <select class="champion-select" id="${id}">
      <option value="">— Selecciona —</option>
      ${todosEquipos.map(([eid, eq]) =>
        `<option value="${eid}" ${val === eid ? "selected" : ""}>${eq.bandera} ${eq.nombre}</option>`
      ).join("")}
    </select>
  </div>`;

  return `
  ${select("sel-campeon", "🥇 Campeón (+15 pts)", mis["_campeon"])}
  ${select("sel-subcampeon", "🥈 Subcampeón (+8 pts)", mis["_subcampeon"])}
  ${select("sel-tercero", "🥉 Tercer lugar (+4 pts)", mis["_tercero"])}
  <button class="btn-primary" onclick="guardarCampeonPrediction()">Guardar mi pronóstico</button>`;
}

function guardarCampeonPrediction() {
  const c = document.getElementById("sel-campeon").value;
  const s = document.getElementById("sel-subcampeon").value;
  const t = document.getElementById("sel-tercero").value;
  if (!c || !s) return showToast("Selecciona al menos campeón y subcampeón", "error");
  guardarCampeon(c, s, t);
}

// ---------- Render: Ranking ----------
async function renderRanking() {
  await recalcularTodosLosScores();
  const container = document.getElementById("ranking-container");
  const sorted = Object.values(allScores).sort((a, b) => b.total - a.total);

  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🏅</div><p>Aún no hay participantes</p></div>`;
    return;
  }

  container.innerHTML = `
  <table class="ranking-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Participante</th>
        <th style="text-align:right">Pts</th>
        <th style="text-align:right">Grupos</th>
        <th style="text-align:right">Elim.</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map((s, i) => {
        const pos = i + 1;
        const esYo = s.uid === currentUser.uid;
        const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
        return `
        <tr class="${esYo ? "yo" : ""}">
          <td><span class="rank-pos pos-${pos}">${medal}</span></td>
          <td>
            <strong>${s.nombre || "Usuario"}</strong>
            ${esYo ? ' <span class="badge badge-green">Tú</span>' : ""}
          </td>
          <td style="text-align:right"><span class="pts-badge">${s.total}</span></td>
          <td style="text-align:right;color:var(--gris)">${s.gruposTotal || 0}</td>
          <td style="text-align:right;color:var(--gris)">${s.eliminatoriaTotal || 0}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>`;
}

// ---------- Render: Admin ----------
function renderAdmin() {
  const container = document.getElementById("admin-container");
  const pendientes = PARTIDOS_GRUPOS.filter(p =>
    !realResults[p.id] || realResults[p.id].status !== "FINISHED"
  );

  container.innerHTML = `
  <div class="card mb-16">
    <div class="card-title">📡 Actualizar resultados desde API</div>
    <p class="text-muted" style="margin-bottom:12px">Obtiene resultados de football-data.org automáticamente</p>
    <button class="btn-primary" onclick="fetchResultsFromAPI()">🔄 Obtener resultados</button>
    <p id="api-status" class="text-muted mt-8"></p>
  </div>

  <div class="card">
    <div class="card-title">✏️ Ingresar resultados manualmente</div>
    ${pendientes.length === 0
      ? '<p class="text-muted">Todos los partidos tienen resultado ✅</p>'
      : pendientes.map(p => {
          const el = getEquipo(p.local), ev = getEquipo(p.visitante);
          const real = realResults[p.id];
          return `
          <div class="admin-match">
            <h4>${el.bandera} ${el.nombre} vs ${ev.nombre} ${ev.bandera}
              <span class="badge badge-gray" style="margin-left:8px">G${p.grupo}</span></h4>
            <div class="admin-score-row">
              <input type="number" min="0" max="20" id="ar-h-${p.id}" placeholder="0"
                value="${real?.h ?? ""}">
              <span style="font-weight:700">–</span>
              <input type="number" min="0" max="20" id="ar-v-${p.id}" placeholder="0"
                value="${real?.v ?? ""}">
              <button class="btn-admin" onclick="guardarResultadoAdmin('${p.id}')">Guardar</button>
            </div>
          </div>`;
        }).join("")}
  </div>

  <div class="card">
    <div class="card-title">🏆 Resultado final del torneo</div>
    ${renderAdminCampeon()}
  </div>`;
}

function renderAdminCampeon() {
  const todosEquipos = Object.entries(EQUIPOS)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const sel = (id, label) => `
  <div class="form-group">
    <label>${label}</label>
    <select class="champion-select" id="${id}">
      <option value="">— No definido —</option>
      ${todosEquipos.map(([eid, eq]) =>
        `<option value="${eid}" ${realResults[id] === eid ? "selected" : ""}>${eq.bandera} ${eq.nombre}</option>`
      ).join("")}
    </select>
  </div>`;
  return `
  ${sel("admin-campeon", "🥇 Campeón")}
  ${sel("admin-subcampeon", "🥈 Subcampeón")}
  ${sel("admin-tercero", "🥉 Tercer lugar")}
  <button class="btn-primary" onclick="guardarCampeonReal()">Guardar resultado final</button>`;
}

async function guardarResultadoAdmin(matchId) {
  const h = document.getElementById(`ar-h-${matchId}`).value;
  const v = document.getElementById(`ar-v-${matchId}`).value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  await db.collection("resultados").doc(matchId).set({
    h: Number(h), v: Number(v), status: "FINISHED",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  realResults[matchId] = { h: Number(h), v: Number(v), status: "FINISHED" };
  showToast("✅ Resultado guardado", "success");
  renderAdmin();
}

async function guardarCampeonReal() {
  const c = document.getElementById("admin-campeon").value;
  const s = document.getElementById("admin-subcampeon").value;
  const t = document.getElementById("admin-tercero").value;
  if (c) await db.collection("resultados").doc("_campeon").set({ value: c });
  if (s) await db.collection("resultados").doc("_subcampeon").set({ value: s });
  if (t) await db.collection("resultados").doc("_tercero").set({ value: t });
  if (c) realResults["_campeon"] = c;
  if (s) realResults["_subcampeon"] = s;
  if (t) realResults["_tercero"] = t;
  showToast("✅ Campeón guardado", "success");
}

// ---------- API de resultados ----------
async function fetchResultsFromAPI() {
  const statusEl = document.getElementById("api-status");
  statusEl.textContent = "Consultando football-data.org...";

  try {
    // Llamada a través de un proxy/Firebase Function para no exponer la key
    // En desarrollo puedes llamar directamente, en producción usa una Cloud Function
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${FOOTBALL_COMPETITION_ID}/matches?status=FINISHED`,
      { headers: { "X-Auth-Token": FOOTBALL_API_KEY } }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const partidos = data.matches || [];

    let actualizados = 0;
    for (const m of partidos) {
      // Intentar mapear por nombres de equipo al ID de nuestro sistema
      const localId = findEquipoByName(m.homeTeam?.name || m.homeTeam?.shortName);
      const visitanteId = findEquipoByName(m.awayTeam?.name || m.awayTeam?.shortName);
      if (!localId || !visitanteId) continue;

      const matchId = findMatchId(localId, visitanteId);
      if (!matchId) continue;

      if (m.status === "FINISHED" && m.score?.fullTime) {
        const h = m.score.fullTime.home, v = m.score.fullTime.away;
        await db.collection("resultados").doc(matchId).set({
          h, v, status: "FINISHED", apiId: m.id,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        realResults[matchId] = { h, v, status: "FINISHED" };
        actualizados++;
      }
    }

    statusEl.textContent = `✅ ${actualizados} resultado(s) actualizados`;
    recalcularTodosLosScores();
    renderAdmin();
  } catch (e) {
    statusEl.textContent = `❌ Error: ${e.message}. Verifica tu API key en config.js`;
  }
}

function findEquipoByName(name) {
  if (!name) return null;
  const norm = name.toLowerCase();
  for (const [id, eq] of Object.entries(EQUIPOS)) {
    if (eq.nombre.toLowerCase().includes(norm) || norm.includes(eq.nombre.toLowerCase())) {
      return id;
    }
  }
  return null;
}

function findMatchId(localId, visitanteId) {
  const p = PARTIDOS_GRUPOS.find(m =>
    (m.local === localId && m.visitante === visitanteId) ||
    (m.local === visitanteId && m.visitante === localId)
  );
  return p?.id || null;
}

// ---------- Utils ----------
function getEquipo(id) {
  return EQUIPOS[id] || { nombre: id, bandera: "🏴", grupo: "?" };
}

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// Exponer funciones al HTML (necesarias por onclick inline)
window.toggleGrupo = toggleGrupo;
window.guardarPartidoPred = guardarPartidoPred;
window.guardarElimPartido = guardarElimPartido;
window.guardarCampeonPrediction = guardarCampeonPrediction;
window.guardarResultadoAdmin = guardarResultadoAdmin;
window.guardarCampeonReal = guardarCampeonReal;
window.fetchResultsFromAPI = fetchResultsFromAPI;
window.navigateTo = navigateTo;
