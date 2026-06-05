// ============================================================
// Polla Mundial 2026 — Lógica principal (Supabase)
// ============================================================

// ---------- Estado global ----------
let currentUser = null;
let currentView = "dashboard";
let myPredictions = {};   // { matchId: {h, v} }
let allScores = {};        // { uid: { total, gruposTotal, eliminatoriaTotal, nombre } }
let realResults = {};      // { matchId: {h, v, status} }
let knockoutMatches = [];

// ---------- Init Supabase ----------
const supabaseConfigured =
  SUPABASE_URL !== "https://TU-PROYECTO.supabase.co" &&
  SUPABASE_ANON_KEY !== "TU_ANON_KEY";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Splash + detección de config ----------
document.addEventListener("DOMContentLoaded", async () => {
  if (!supabaseConfigured) {
    setTimeout(() => { hideSplash(); showSetupScreen(); }, 1200);
    return;
  }

  // Verificar sesión activa
  const { data: { session } } = await sb.auth.getSession();
  hideSplash();
  if (session) {
    currentUser = session.user;
    showApp();
    await initApp();
  } else {
    showAuthPage();
  }

  // Escuchar cambios de auth
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) {
      currentUser = session.user;
      showApp();
      await initApp();
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      location.reload();
    }
  });
});

// ---------- Pantallas ----------
function hideSplash() {
  document.getElementById("splash").classList.add("hidden");
}
function showSetupScreen() {
  document.getElementById("setup-page").style.display = "flex";
}
function showAuthPage() {
  document.getElementById("auth-page").classList.add("active");
}
function showApp() {
  document.getElementById("auth-page").classList.remove("active");
  document.getElementById("setup-page").style.display = "none";
  document.getElementById("app").classList.add("active");
  const name = currentUser.user_metadata?.nombre || currentUser.email.split("@")[0];
  document.getElementById("header-user-name").textContent = name;
}

// ---------- Auth ----------
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
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const nombre   = document.getElementById("auth-name").value.trim();
  const btn      = document.getElementById("btn-auth");
  clearAuthError();

  if (!email || !password) return showAuthError("Completa todos los campos");
  if (authMode === "register" && !nombre) return showAuthError("Ingresa tu nombre");
  if (password.length < 6) return showAuthError("Contraseña mínimo 6 caracteres");

  btn.disabled = true; btn.textContent = "...";
  try {
    if (authMode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { nombre } }
      });
      if (error) throw error;
      // Guardar en tabla usuarios
      await sb.from("usuarios").upsert({
        id: data.user.id, nombre, email
      });
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = authMode === "login" ? "Iniciar sesión" : "Crear cuenta";
    const msgs = {
      "Invalid login credentials": "Email o contraseña incorrectos",
      "User already registered": "Este email ya está registrado",
      "Password should be at least 6 characters": "Contraseña mínimo 6 caracteres",
      "Unable to validate email address: invalid format": "Email inválido",
    };
    showAuthError(msgs[e.message] || e.message);
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
  sb.auth.signOut();
});

// ---------- Navegación ----------
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => navigateTo(item.dataset.view));
});

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.view === view));
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "dashboard")   renderDashboard();
  if (view === "grupos")      renderGrupos();
  if (view === "eliminatoria") renderEliminatoria();
  if (view === "ranking")     renderRanking();
  if (view === "admin" && isAdmin()) renderAdmin();
}

function isAdmin() {
  return POLLA_CONFIG.admins.includes(currentUser?.email);
}

// ---------- Init ----------
async function initApp() {
  if (isAdmin()) document.getElementById("nav-admin").classList.remove("hidden");

  // Cargar predicciones propias
  await loadMyPredictions();

  // Cargar resultados reales
  await loadResults();

  // Cargar bracket eliminatorio
  await loadKnockout();

  // Suscripción realtime a resultados
  sb.channel("resultados-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "resultados" },
      async () => {
        await loadResults();
        await recalcAll();
        if (currentView === "dashboard") renderDashboard();
        if (currentView === "ranking")   renderRanking();
        if (currentView === "grupos")    renderGrupos();
      })
    .subscribe();

  // Suscripción realtime a eliminatoria
  sb.channel("eliminatoria-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "eliminatoria" },
      async () => {
        await loadKnockout();
        if (currentView === "eliminatoria") renderEliminatoria();
      })
    .subscribe();

  await recalcAll();
  navigateTo("dashboard");
}

// ---------- Carga de datos ----------
async function loadMyPredictions() {
  const { data } = await sb.from("predicciones")
    .select("match_id, home_score, away_score")
    .eq("user_id", currentUser.id);
  myPredictions = {};
  (data || []).forEach(r => {
    myPredictions[r.match_id] = { h: r.home_score, v: r.away_score };
  });
}

async function loadResults() {
  const { data } = await sb.from("resultados").select("*");
  realResults = {};
  (data || []).forEach(r => {
    if (r.match_id.startsWith("_")) {
      // Resultados finales del torneo (_campeon, _subcampeon, _tercero)
      realResults[r.match_id] = r.value;
    } else {
      realResults[r.match_id] = { h: r.home_score, v: r.away_score, status: r.status };
    }
  });
}

async function loadKnockout() {
  const { data } = await sb.from("eliminatoria")
    .select("*").order("orden");
  knockoutMatches = data || [];
}

// ---------- Predicciones ----------
async function guardarPrediccion(matchId, h, v) {
  myPredictions[matchId] = { h, v };
  await sb.from("predicciones").upsert({
    user_id: currentUser.id,
    match_id: matchId,
    home_score: h,
    away_score: v,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,match_id" });
  recalcMine();
}

async function guardarCampeon(campeonId, subcampeonId, terceroId) {
  myPredictions["_campeon"]    = campeonId;
  myPredictions["_subcampeon"] = subcampeonId;
  myPredictions["_tercero"]    = terceroId;
  await sb.from("predicciones").upsert([
    { user_id: currentUser.id, match_id: "_campeon",    extra_value: campeonId },
    { user_id: currentUser.id, match_id: "_subcampeon", extra_value: subcampeonId },
    { user_id: currentUser.id, match_id: "_tercero",    extra_value: terceroId },
  ], { onConflict: "user_id,match_id" });
  recalcMine();
  showToast("✅ Pronóstico guardado", "success");
}

// ---------- Puntuación ----------
function calcPtsGrupo(pred, real) {
  if (!pred || real?.h == null) return 0;
  const [ph, pv, rh, rv] = [+pred.h, +pred.v, +real.h, +real.v];
  if (ph === rh && pv === rv) return PUNTUACION.marcadorExacto;
  const pr = ph > pv ? "L" : ph < pv ? "V" : "E";
  const rr = rh > rv ? "L" : rh < rv ? "V" : "E";
  return pr === rr ? PUNTUACION.resultadoCorrecto : 0;
}

function calcPtsElim(pred, real, fase) {
  if (!pred || real?.h == null) return 0;
  const [ph, pv, rh, rv] = [+pred.h, +pred.v, +real.h, +real.v];
  const base = PUNTUACION.eliminatoria[fase] || 3;
  if (ph === rh && pv === rv) return base + PUNTUACION.eliminatoriaExacto;
  const pr = ph > pv ? "L" : ph < pv ? "V" : "E";
  const rr = rh > rv ? "L" : rh < rv ? "V" : "E";
  return pr === rr ? base : 0;
}

function calcScore(preds) {
  let grupos = 0, eliminatoria = 0, bonus = 0;
  for (const p of PARTIDOS_GRUPOS) {
    grupos += calcPtsGrupo(preds[p.id], realResults[p.id]);
  }
  for (const m of knockoutMatches) {
    eliminatoria += calcPtsElim(preds[m.id], realResults[m.id], m.fase);
  }
  if (preds["_campeon"]    && realResults["_campeon"]    === preds["_campeon"])    bonus += PUNTUACION.campeon;
  if (preds["_subcampeon"] && realResults["_subcampeon"] === preds["_subcampeon"]) bonus += PUNTUACION.subcampeon;
  if (preds["_tercero"]    && realResults["_tercero"]    === preds["_tercero"])    bonus += PUNTUACION.tercero;
  return { grupos, eliminatoria, bonus, total: grupos + eliminatoria + bonus };
}

function recalcMine() {
  const s = calcScore(myPredictions);
  allScores[currentUser.id] = {
    ...s,
    nombre: currentUser.user_metadata?.nombre || currentUser.email.split("@")[0],
    uid: currentUser.id,
  };
  if (currentView === "dashboard") renderDashboard();
}

async function recalcAll() {
  // Carga todas las predicciones (para ranking)
  const { data: preds } = await sb.from("predicciones").select("user_id, match_id, home_score, away_score, extra_value");
  const { data: users } = await sb.from("usuarios").select("id, nombre, email");

  const byUser = {};
  (preds || []).forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    if (r.match_id.startsWith("_")) {
      byUser[r.user_id][r.match_id] = r.extra_value;
    } else {
      byUser[r.user_id][r.match_id] = { h: r.home_score, v: r.away_score };
    }
  });

  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u.nombre || u.email; });

  allScores = {};
  for (const [uid, prs] of Object.entries(byUser)) {
    const s = calcScore(prs);
    allScores[uid] = { ...s, nombre: userMap[uid] || "Usuario", uid };
  }

  // Asegurar que el usuario actual siempre aparezca
  if (currentUser && !allScores[currentUser.id]) {
    const s = calcScore(myPredictions);
    allScores[currentUser.id] = {
      ...s,
      nombre: currentUser.user_metadata?.nombre || currentUser.email.split("@")[0],
      uid: currentUser.id,
    };
  }
}

// ---------- Render: Dashboard ----------
function renderDashboard() {
  const me = allScores[currentUser.id] || { total: 0, grupos: 0, eliminatoria: 0, bonus: 0 };
  const sorted = Object.values(allScores).sort((a, b) => b.total - a.total);
  const pos = sorted.findIndex(s => s.uid === currentUser.id) + 1 || "–";
  const predichos = PARTIDOS_GRUPOS.filter(p => myPredictions[p.id] != null).length;

  document.getElementById("dash-pts").textContent       = me.total;
  document.getElementById("dash-rank").textContent      = `#${pos} de ${sorted.length || "–"}`;
  document.getElementById("dash-predichos").textContent = predichos;
  document.getElementById("dash-total").textContent     = PARTIDOS_GRUPOS.length;
  document.getElementById("dash-pts-grupos").textContent = me.grupos || 0;
  document.getElementById("dash-pts-elim").textContent  = (me.eliminatoria || 0) + (me.bonus || 0);

  renderCampeonBanner();

  const sin = PARTIDOS_GRUPOS.filter(p => !myPredictions[p.id]);
  const el = document.getElementById("dash-proximos");
  if (!sin.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>¡Todos los partidos predichos!</p></div>`;
  } else {
    el.innerHTML = sin.slice(0, 6).map(p => {
      const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
      return `<div class="partido-row" style="cursor:pointer" onclick="navigateTo('grupos')">
        <div class="partido-equipos">
          <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
          <span style="color:var(--gris);font-size:12px">G${p.grupo}</span>
          <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
        </div>
      </div>`;
    }).join("") + (sin.length > 6
      ? `<p class="text-muted text-center mt-8">+${sin.length - 6} más sin predecir</p>` : "");
  }
}

// ---------- Banner pronóstico Campeón ----------
function renderCampeonBanner() {
  const cont = document.getElementById("dash-campeon-banner");
  if (!cont) return;
  const campeonId = myPredictions["_campeon"];
  const cerrado = typeof CIERRE_CAMPEON !== "undefined" && new Date() > CIERRE_CAMPEON;

  if (campeonId) {
    const eq = getEquipo(campeonId);
    cont.innerHTML = `
    <div class="campeon-banner elegido">
      <span class="cb-tag">🏆 Tu campeón · ${PUNTUACION.campeon} pts</span>
      <h3>Tu pronóstico de campeón está confirmado</h3>
      <div class="cb-pick"><span class="flag">${eq.bandera}</span> ${eq.nombre}</div>
      ${!cerrado ? `<button class="btn-cb" onclick="navigateTo('eliminatoria')">Cambiar pronóstico</button>` : ""}
    </div>`;
  } else {
    cont.innerHTML = `
    <div class="campeon-banner">
      <span class="cb-tag">⚡ Hazlo antes del primer partido</span>
      <h3>¿Quién será el campeón del Mundial?</h3>
      <p>Es la apuesta más arriesgada: se hace al inicio sin saber nada.
         Por eso vale <span class="cb-pts">${PUNTUACION.campeon} puntos</span> si aciertas.</p>
      <button class="btn-cb" onclick="navigateTo('eliminatoria')">🏆 Elegir mi campeón</button>
    </div>`;
  }
}

// ---------- Render: Grupos ----------
function renderGrupos() {
  document.getElementById("grupos-container").innerHTML =
    Object.keys(GRUPOS).map(gid => {
      const grupo = GRUPOS[gid];
      const partidos = PARTIDOS_GRUPOS.filter(p => p.grupo === gid);
      const n = partidos.filter(p => myPredictions[p.id] != null).length;
      return `
      <div class="card">
        <div class="grupo-header" onclick="toggleGrupo('${gid}')">
          <div class="grupo-badge">${gid}</div>
          <span class="grupo-title">${grupo.nombre} — ${grupo.equipos.map(id => getEquipo(id).bandera).join(" ")}</span>
          <span class="grupo-progress">${n}/${partidos.length}</span>
          <span class="grupo-chevron" id="chevron-${gid}">▼</span>
        </div>
        <div class="grupo-content" id="grupo-content-${gid}">
          ${partidos.map(p => renderPartidoInput(p)).join("")}
        </div>
      </div>`;
    }).join("");
}

function renderPartidoInput(partido) {
  const loc = getEquipo(partido.local), vis = getEquipo(partido.visitante);
  const pred = myPredictions[partido.id];
  const real = realResults[partido.id];
  const cerrado = real?.status === "FINISHED";
  const pts = calcPtsGrupo(pred, real);
  return `
  <div class="partido-row ${pred ? "guardado" : ""} ${cerrado ? "cerrado" : ""}" id="prow-${partido.id}">
    <div class="partido-equipos">
      <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
      <div class="score-input-group">
        <input type="number" min="0" max="20" class="score-input"
          id="sh-${partido.id}" value="${pred != null ? pred.h : ""}" ${cerrado ? "disabled" : ""}
          oninput="onScoreInput('${partido.id}')">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input"
          id="sv-${partido.id}" value="${pred != null ? pred.v : ""}" ${cerrado ? "disabled" : ""}
          oninput="onScoreInput('${partido.id}')">
      </div>
      <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
    </div>
    ${!cerrado ? `<button class="btn-guardar-partido" id="btn-${partido.id}"
      onclick="guardarPartidoPred('${partido.id}')">
      ${pred != null ? "✅ Guardado — Actualizar" : "Guardar predicción"}
    </button>` : ""}
    ${real?.h != null ? `
    <div class="resultado-real">
      <span>Resultado real: <strong>${loc.bandera} ${real.h} – ${real.v} ${vis.bandera}</strong></span>
      <span class="pts-ganados ${pts === 0 ? "cero" : ""}">+${pts} pts</span>
    </div>` : ""}
  </div>`;
}

function onScoreInput(id) {
  const btn = document.getElementById(`btn-${id}`);
  if (btn) btn.textContent = "Guardar predicción";
}

async function guardarPartidoPred(matchId) {
  const h = document.getElementById(`sh-${matchId}`).value;
  const v = document.getElementById(`sv-${matchId}`).value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  const btn = document.getElementById(`btn-${matchId}`);
  btn.disabled = true; btn.textContent = "Guardando...";
  await guardarPrediccion(matchId, +h, +v);
  btn.disabled = false; btn.textContent = "✅ Guardado — Actualizar";
  document.getElementById(`prow-${matchId}`)?.classList.add("guardado");
  showToast("✅ Predicción guardada", "success");
}

function toggleGrupo(gid) {
  document.getElementById(`grupo-content-${gid}`)?.classList.toggle("open");
  document.getElementById(`chevron-${gid}`)?.classList.toggle("open");
}

// ---------- Render: Eliminatoria ----------
function renderEliminatoria() {
  const container = document.getElementById("eliminatoria-container");

  const campeonHtml = `
  <div class="card">
    <div class="card-title">🏆 Mi pronóstico final</div>
    ${renderCampeonSelector()}
  </div>`;

  if (!knockoutMatches.length) {
    container.innerHTML = campeonHtml + `
    <div class="empty-state" style="margin-top:16px">
      <div class="icon">🔜</div>
      <p>Los partidos eliminatorios se mostrarán aquí una vez que finalice la fase de grupos</p>
    </div>`;
    return;
  }

  const porFase = {};
  knockoutMatches.forEach(m => {
    if (!porFase[m.fase]) porFase[m.fase] = [];
    porFase[m.fase].push(m);
  });

  container.innerHTML = campeonHtml + FASES_ELIMINATORIAS
    .filter(f => porFase[f.id])
    .map(f => `
    <div class="bracket-round">
      <div class="bracket-round-title">${f.nombre}</div>
      ${porFase[f.id].map(m => renderElimMatch(m, f.id)).join("")}
    </div>`).join("");
}

function renderElimMatch(m, fase) {
  const loc = m.local_id ? getEquipo(m.local_id) : null;
  const vis = m.visitante_id ? getEquipo(m.visitante_id) : null;
  const pred = myPredictions[m.id];
  const real = realResults[m.id];
  const cerrado = real?.status === "FINISHED";
  const pts = calcPtsElim(pred, real, fase);
  return `
  <div class="bracket-match">
    <div class="bracket-team ${!loc ? "tbd" : ""}">
      <span>${loc ? loc.bandera : "🤔"}</span>
      <span>${loc ? loc.nombre : m.local_label || "Por definir"}</span>
      ${real ? `<span class="score">${real.h}</span>` : ""}
    </div>
    <div class="bracket-team ${!vis ? "tbd" : ""}">
      <span>${vis ? vis.bandera : "🤔"}</span>
      <span>${vis ? vis.nombre : m.visitante_label || "Por definir"}</span>
      ${real ? `<span class="score">${real.v}</span>` : ""}
    </div>
    ${loc && vis && !cerrado ? `
    <div style="padding:10px 14px;border-top:1px solid var(--gris-borde)">
      <div class="score-input-group" style="justify-content:center;gap:12px">
        <input type="number" min="0" max="20" class="score-input"
          id="eh-${m.id}" value="${pred ? pred.h : ""}">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input"
          id="ev-${m.id}" value="${pred ? pred.v : ""}">
      </div>
      <button class="btn-guardar-partido" style="margin-top:8px"
        onclick="guardarElimPred('${m.id}')">
        ${pred ? "✅ Guardado — Actualizar" : "Guardar predicción"}
      </button>
    </div>` : ""}
    ${pts > 0 ? `<div style="padding:6px 14px;background:#f0fdf4;font-size:13px;font-weight:700;color:var(--verde)">+${pts} puntos</div>` : ""}
  </div>`;
}

async function guardarElimPred(matchId) {
  const h = document.getElementById(`eh-${matchId}`)?.value;
  const v = document.getElementById(`ev-${matchId}`)?.value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  await guardarPrediccion(matchId, +h, +v);
  showToast("✅ Predicción guardada", "success");
  renderEliminatoria();
}

function renderCampeonSelector() {
  const opts = Object.entries(EQUIPOS)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
    .map(([id, eq]) => `<option value="${id}">${eq.bandera} ${eq.nombre}</option>`)
    .join("");
  const sel = (id, label, val) => `
  <div class="form-group">
    <label>${label}</label>
    <select class="champion-select" id="${id}">
      <option value="">— Selecciona —</option>${opts}
    </select>
  </div>`;
  // Set values after render
  setTimeout(() => {
    ["sel-campeon","sel-subcampeon","sel-tercero"].forEach((id, i) => {
      const keys = ["_campeon","_subcampeon","_tercero"];
      const el = document.getElementById(id);
      if (el && myPredictions[keys[i]]) el.value = myPredictions[keys[i]];
    });
  }, 0);
  return sel("sel-campeon",`🥇 Campeón (+${PUNTUACION.campeon} pts)`,"") +
         sel("sel-subcampeon",`🥈 Subcampeón (+${PUNTUACION.subcampeon} pts)`,"") +
         sel("sel-tercero",`🥉 Tercer lugar (+${PUNTUACION.tercero} pts)`,"") +
         `<button class="btn-primary" onclick="guardarCampeonPred()">Guardar pronóstico final</button>`;
}

function guardarCampeonPred() {
  const c = document.getElementById("sel-campeon").value;
  const s = document.getElementById("sel-subcampeon").value;
  const t = document.getElementById("sel-tercero").value;
  if (!c || !s) return showToast("Selecciona al menos campeón y subcampeón", "error");
  guardarCampeon(c, s, t);
}

// ---------- Render: Ranking ----------
async function renderRanking() {
  await recalcAll();
  const sorted = Object.values(allScores).sort((a, b) => b.total - a.total);
  const container = document.getElementById("ranking-container");
  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🏅</div><p>Aún no hay participantes</p></div>`;
    return;
  }
  container.innerHTML = `
  <table class="ranking-table">
    <thead><tr>
      <th>#</th><th>Participante</th>
      <th style="text-align:right">Total</th>
      <th style="text-align:right">Grupos</th>
      <th style="text-align:right">Elim.</th>
    </tr></thead>
    <tbody>
    ${sorted.map((s, i) => {
      const pos = i + 1;
      const yo = s.uid === currentUser.id;
      const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
      return `<tr class="${yo ? "yo" : ""}">
        <td><span class="rank-pos pos-${pos}">${medal}</span></td>
        <td><strong>${s.nombre}</strong>${yo ? ' <span class="badge badge-green">Tú</span>' : ""}</td>
        <td style="text-align:right"><span class="pts-badge">${s.total}</span></td>
        <td style="text-align:right;color:var(--gris)">${s.grupos || 0}</td>
        <td style="text-align:right;color:var(--gris)">${(s.eliminatoria || 0) + (s.bonus || 0)}</td>
      </tr>`;
    }).join("")}
    </tbody>
  </table>`;
}

// ---------- Render: Admin ----------
function renderAdmin() {
  const container = document.getElementById("admin-container");
  const pendientes = PARTIDOS_GRUPOS.filter(p =>
    !realResults[p.id] || realResults[p.id]?.status !== "FINISHED");

  container.innerHTML = `
  <div class="card mb-16">
    <div class="card-title">📡 Actualizar desde API</div>
    <p class="text-muted" style="margin-bottom:12px">Obtiene resultados de football-data.org</p>
    <button class="btn-primary" onclick="fetchFromAPI()">🔄 Obtener resultados</button>
    <p id="api-status" class="text-muted mt-8"></p>
  </div>
  <div class="card mb-16">
    <div class="card-title">✏️ Resultados manuales</div>
    ${pendientes.length === 0
      ? '<p class="text-muted">Todos los partidos tienen resultado ✅</p>'
      : pendientes.map(p => {
          const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
          const r = realResults[p.id];
          return `<div class="admin-match">
            <h4>${loc.bandera} ${loc.nombre} vs ${vis.nombre} ${vis.bandera}
              <span class="badge badge-gray" style="margin-left:6px">G${p.grupo}</span></h4>
            <div class="admin-score-row">
              <input type="number" min="0" max="20" id="ar-h-${p.id}" placeholder="0" value="${r?.h ?? ""}">
              <span style="font-weight:700">–</span>
              <input type="number" min="0" max="20" id="ar-v-${p.id}" placeholder="0" value="${r?.v ?? ""}">
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
  const opts = Object.entries(EQUIPOS)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
    .map(([id, eq]) => `<option value="${id}">${eq.bandera} ${eq.nombre}</option>`)
    .join("");
  return ["_campeon","_subcampeon","_tercero"].map((key, i) => {
    const labels = ["🥇 Campeón","🥈 Subcampeón","🥉 Tercer lugar"];
    return `<div class="form-group">
      <label>${labels[i]}</label>
      <select class="champion-select" id="admin-${key}">
        <option value="">— No definido —</option>${opts}
      </select>
    </div>`;
  }).join("") +
  `<button class="btn-primary" onclick="guardarCampeonReal()">Guardar resultado final</button>`;
}

async function guardarResultadoAdmin(matchId) {
  const h = +document.getElementById(`ar-h-${matchId}`).value;
  const v = +document.getElementById(`ar-v-${matchId}`).value;
  if (isNaN(h) || isNaN(v)) return showToast("Ingresa ambos marcadores", "error");
  await sb.from("resultados").upsert({
    match_id: matchId, home_score: h, away_score: v,
    status: "FINISHED", updated_at: new Date().toISOString()
  }, { onConflict: "match_id" });
  realResults[matchId] = { h, v, status: "FINISHED" };
  await recalcAll();
  showToast("✅ Resultado guardado", "success");
  renderAdmin();
}

async function guardarCampeonReal() {
  const vals = [
    ["_campeon",    document.getElementById("admin-__campeon")?.value    || document.getElementById("admin-_campeon")?.value],
    ["_subcampeon", document.getElementById("admin-__subcampeon")?.value || document.getElementById("admin-_subcampeon")?.value],
    ["_tercero",    document.getElementById("admin-__tercero")?.value    || document.getElementById("admin-_tercero")?.value],
  ].filter(([, v]) => v);
  for (const [key, val] of vals) {
    await sb.from("resultados").upsert({ match_id: key, value: val, status: "FINISHED" }, { onConflict: "match_id" });
    realResults[key] = val;
  }
  await recalcAll();
  showToast("✅ Campeón guardado", "success");
}

// ---------- API football-data.org ----------
async function fetchFromAPI() {
  const statusEl = document.getElementById("api-status");
  statusEl.textContent = "Consultando API...";
  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${FOOTBALL_COMPETITION_ID}/matches?status=FINISHED`,
      { headers: { "X-Auth-Token": FOOTBALL_API_KEY } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} — verifica tu API key`);
    const { matches = [] } = await res.json();
    let n = 0;
    for (const m of matches) {
      const locId = findEquipoByName(m.homeTeam?.name);
      const visId = findEquipoByName(m.awayTeam?.name);
      if (!locId || !visId) continue;
      const matchId = findMatchId(locId, visId);
      if (!matchId) continue;
      const h = m.score?.fullTime?.home, v = m.score?.fullTime?.away;
      if (h == null) continue;
      await sb.from("resultados").upsert({
        match_id: matchId, home_score: h, away_score: v,
        status: "FINISHED", updated_at: new Date().toISOString()
      }, { onConflict: "match_id" });
      realResults[matchId] = { h, v, status: "FINISHED" };
      n++;
    }
    statusEl.textContent = `✅ ${n} resultado(s) actualizados`;
    await recalcAll();
    renderAdmin();
  } catch (e) {
    statusEl.textContent = `❌ ${e.message}`;
  }
}

function findEquipoByName(name = "") {
  const n = name.toLowerCase();
  for (const [id, eq] of Object.entries(EQUIPOS)) {
    if (eq.nombre.toLowerCase().includes(n) || n.includes(eq.nombre.toLowerCase())) return id;
  }
  return null;
}
function findMatchId(locId, visId) {
  return PARTIDOS_GRUPOS.find(m =>
    (m.local === locId && m.visitante === visId) ||
    (m.local === visId  && m.visitante === locId)
  )?.id || null;
}

// ---------- Helpers ----------
function getEquipo(id) {
  return EQUIPOS[id] || { nombre: id, bandera: "🏴", grupo: "?" };
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3000);
}

// Exponer al HTML
window.toggleGrupo = toggleGrupo;
window.guardarPartidoPred = guardarPartidoPred;
window.guardarElimPred = guardarElimPred;
window.guardarCampeonPred = guardarCampeonPred;
window.guardarResultadoAdmin = guardarResultadoAdmin;
window.guardarCampeonReal = guardarCampeonReal;
window.fetchFromAPI = fetchFromAPI;
window.navigateTo = navigateTo;
