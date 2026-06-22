// ============================================================
// Polla Mundial 2026 — Login solo con nombre (sin auth)
// ============================================================

let userName = null;
let currentView = "dashboard";
let myPredictions = {};
let allScores = {};
let realResults = {};
let matchDates = {};
let knockoutMatches = [];
let appInitialized = false;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("polla_user");
  setTimeout(() => {
    hideSplash();
    if (saved) { userName = saved; showApp(); initApp(); }
    else showLogin();
  }, 800);
});

function hideSplash() { document.getElementById("splash").classList.add("hidden"); }
function showLogin() { document.getElementById("login-page").style.display = "flex"; }
function showApp() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("app").classList.add("active");
  document.getElementById("header-user-name").textContent = userName;
}

// ---------- Login ----------
function doLogin() {
  const name = document.getElementById("login-name").value.trim();
  if (!name) {
    const e = document.getElementById("login-error");
    e.textContent = "Ingresa tu nombre"; e.classList.add("visible");
    return;
  }
  userName = name;
  localStorage.setItem("polla_user", name);
  // Registrar en tabla de usuarios (para que aparezca en ranking)
  sb.from("usuarios").upsert({ nombre: name }, { onConflict: "nombre" }).then(() => {});
  showApp();
  initApp();
}
document.getElementById("login-name").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
document.getElementById("btn-logout").addEventListener("click", () => { localStorage.removeItem("polla_user"); location.reload(); });

// ---------- Navegación ----------
document.querySelectorAll(".nav-item").forEach(item =>
  item.addEventListener("click", () => navigateTo(item.dataset.view)));

function navigateTo(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "dashboard") renderDashboard();
  if (view === "grupos") renderGrupos();
  if (view === "eliminatoria") renderEliminatoria();
  if (view === "resultados") renderResultados();
  if (view === "ranking") renderRanking();
  if (view === "admin" && isAdmin()) renderAdmin();
}
function isAdmin() { return POLLA_CONFIG.admins.includes(userName); }

// ---------- Init app ----------
async function initApp() {
  if (appInitialized) return;
  appInitialized = true;
  if (isAdmin()) document.getElementById("nav-admin").classList.remove("hidden");
  await loadMyPredictions();
  await loadResults();
  await loadKnockout();

  sb.channel("res-" + Date.now()).on("postgres_changes",
    { event: "*", schema: "public", table: "resultados" },
    async () => { await loadResults(); await recalcAll();
      if (currentView === "dashboard") renderDashboard();
      if (currentView === "resultados") renderResultados();
      if (currentView === "ranking") renderRanking();
      if (currentView === "grupos") renderGrupos(); }
  ).subscribe();

  await recalcAll();
  navigateTo("dashboard");

  if (FOOTBALL_API_KEY && FOOTBALL_API_KEY !== "TU_FOOTBALL_DATA_KEY") {
    fetchFromAPI(true);
    setInterval(() => fetchFromAPI(true), 5 * 60 * 1000);
  }
}

// ---------- Data ----------
async function loadMyPredictions() {
  const { data } = await sb.from("predicciones").select("match_id, home_score, away_score, extra_value").eq("user_id", userName);
  myPredictions = {};
  (data || []).forEach(r => {
    if (r.match_id.startsWith("_")) myPredictions[r.match_id] = r.extra_value;
    else myPredictions[r.match_id] = { h: r.home_score, v: r.away_score };
  });
}

async function loadResults() {
  const { data } = await sb.from("resultados").select("*");
  realResults = {};
  (data || []).forEach(r => {
    if (r.match_id.startsWith("_")) realResults[r.match_id] = r.value;
    else realResults[r.match_id] = { h: r.home_score, v: r.away_score, status: r.status };
  });
}

async function loadKnockout() {
  const { data } = await sb.from("eliminatoria").select("*").order("orden");
  knockoutMatches = data || [];
}

async function guardarPrediccion(matchId, h, v) {
  myPredictions[matchId] = { h, v };
  await sb.from("predicciones").upsert({
    user_id: userName, match_id: matchId, home_score: h, away_score: v,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,match_id" });
}

async function guardarCampeon(c, s, t) {
  myPredictions["_campeon"] = c;
  myPredictions["_subcampeon"] = s;
  myPredictions["_tercero"] = t;
  await sb.from("predicciones").upsert([
    { user_id: userName, match_id: "_campeon", extra_value: c },
    { user_id: userName, match_id: "_subcampeon", extra_value: s },
    { user_id: userName, match_id: "_tercero", extra_value: t },
  ], { onConflict: "user_id,match_id" });
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
  for (const p of PARTIDOS_GRUPOS) grupos += calcPtsGrupo(preds[p.id], realResults[p.id]);
  for (const m of knockoutMatches) eliminatoria += calcPtsElim(preds[m.id], realResults[m.id], m.fase);
  if (preds["_campeon"] && realResults["_campeon"] === preds["_campeon"]) bonus += PUNTUACION.campeon;
  if (preds["_subcampeon"] && realResults["_subcampeon"] === preds["_subcampeon"]) bonus += PUNTUACION.subcampeon;
  if (preds["_tercero"] && realResults["_tercero"] === preds["_tercero"]) bonus += PUNTUACION.tercero;
  return { grupos, eliminatoria, bonus, total: grupos + eliminatoria + bonus };
}

async function recalcAll() {
  // Cargar TODOS los usuarios registrados + predicciones
  const [{ data: preds }, { data: users }] = await Promise.all([
    sb.from("predicciones").select("user_id, match_id, home_score, away_score, extra_value"),
    sb.from("usuarios").select("nombre"),
  ]);
  const byUser = {};
  (preds || []).forEach(r => {
    (byUser[r.user_id] ??= {})[r.match_id] = r.match_id.startsWith("_") ? r.extra_value : { h: r.home_score, v: r.away_score };
  });
  allScores = {};
  // Incluir TODOS los usuarios registrados (incluso sin predicciones)
  (users || []).forEach(u => {
    const p = byUser[u.nombre] || {};
    allScores[u.nombre] = { ...calcScore(p), nombre: u.nombre, uid: u.nombre };
  });
  // Incluir también usuarios que tienen predicciones pero no están en la tabla (por si acaso)
  for (const [uid, p] of Object.entries(byUser)) {
    if (!allScores[uid]) allScores[uid] = { ...calcScore(p), nombre: uid, uid };
  }
  if (userName && !allScores[userName]) {
    allScores[userName] = { ...calcScore(myPredictions), nombre: userName, uid: userName };
  }
}

// ---------- Dashboard ----------
function renderDashboard() {
  const me = allScores[userName] || { total: 0, grupos: 0, eliminatoria: 0, bonus: 0 };
  const sorted = Object.values(allScores).sort((a, b) => b.total - a.total);
  const pos = sorted.findIndex(s => s.uid === userName) + 1 || "–";
  const predichos = PARTIDOS_GRUPOS.filter(p => myPredictions[p.id] != null).length;

  document.getElementById("dash-pts").textContent = me.total;
  document.getElementById("dash-rank").textContent = `#${pos} de ${sorted.length || "–"}`;
  document.getElementById("dash-predichos").textContent = predichos;
  document.getElementById("dash-total").textContent = PARTIDOS_GRUPOS.length;
  document.getElementById("dash-pts-grupos").textContent = me.grupos || 0;
  document.getElementById("dash-pts-elim").textContent = (me.eliminatoria || 0) + (me.bonus || 0);

  renderCampeonBanner();

  const sin = PARTIDOS_GRUPOS.filter(p => !myPredictions[p.id]);
  const el = document.getElementById("dash-proximos");
  if (!sin.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>¡Todos predichos!</p></div>`;
  } else {
    el.innerHTML = sin.slice(0, 6).map(p => {
      const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
      return `<div class="partido-row" style="cursor:pointer" onclick="navigateTo('grupos')">
        <div class="partido-equipos">
          <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
          <span style="color:var(--gris);font-size:12px">G${p.grupo}</span>
          <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
        </div></div>`;
    }).join("") + (sin.length > 6 ? `<p class="text-muted text-center mt-8">+${sin.length-6} más</p>` : "");
  }
}

// ---------- Campeón Banner ----------
function renderCampeonBanner() {
  const cont = document.getElementById("dash-campeon-banner");
  if (!cont) return;
  const campeonId = myPredictions["_campeon"];
  if (campeonId) {
    const eq = getEquipo(campeonId);
    cont.innerHTML = `<div class="campeon-banner elegido">
      <span class="cb-tag">🏆 Tu campeón · ${PUNTUACION.campeon} pts</span>
      <h3>Tu pronóstico de campeón está confirmado</h3>
      <div class="cb-pick"><span class="flag">${eq.bandera}</span> ${eq.nombre}</div>
      <p style="margin-top:10px">🔒 Este pronóstico es definitivo y no se puede cambiar.</p>
    </div>`;
  } else {
    cont.innerHTML = `<div class="campeon-banner">
      <span class="cb-tag">⚡ Hazlo antes del primer partido</span>
      <h3>¿Quién será el campeón del Mundial?</h3>
      <p>Es la apuesta más arriesgada. Vale <span class="cb-pts">${PUNTUACION.campeon} puntos</span> si aciertas.
         <strong>Una vez elegido no se puede cambiar.</strong></p>
      <button class="btn-cb" onclick="navigateTo('eliminatoria')">🏆 Elegir mi campeón</button>
    </div>`;
  }
}

// ---------- Grupos ----------
function renderGrupos() {
  document.getElementById("grupos-container").innerHTML = Object.keys(GRUPOS).map(gid => {
    const grupo = GRUPOS[gid];
    const partidos = PARTIDOS_GRUPOS.filter(p => p.grupo === gid);
    const n = partidos.filter(p => myPredictions[p.id] != null).length;
    return `<div class="card">
      <div class="grupo-header" onclick="toggleGrupo('${gid}')">
        <div class="grupo-badge">${gid}</div>
        <span class="grupo-title">${grupo.nombre} — ${grupo.equipos.map(id => getEquipo(id).bandera).join(" ")}</span>
        <span class="grupo-progress">${n}/${partidos.length}</span>
        <span class="grupo-chevron" id="chevron-${gid}">▼</span>
      </div>
      <div class="grupo-content" id="grupo-content-${gid}">
        ${partidos.map(p => renderPartido(p)).join("")}
      </div>
    </div>`;
  }).join("");
}

function renderPartido(p) {
  const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
  const pred = myPredictions[p.id], real = realResults[p.id];
  const cerrado = real?.status === "FINISHED";
  const pts = calcPtsGrupo(pred, real);
  return `<div class="partido-row ${pred ? "guardado" : ""} ${cerrado ? "cerrado" : ""}" id="prow-${p.id}">
    <div class="partido-equipos">
      <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
      <div class="score-input-group">
        <input type="number" min="0" max="20" class="score-input" id="sh-${p.id}" value="${pred?.h ?? ""}" ${cerrado?"disabled":""}>
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input" id="sv-${p.id}" value="${pred?.v ?? ""}" ${cerrado?"disabled":""}>
      </div>
      <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
    </div>
    ${!cerrado ? `<button class="btn-guardar-partido" id="btn-${p.id}" onclick="guardarPartidoPred('${p.id}')">
      ${pred ? "✅ Guardado — Actualizar" : "Guardar predicción"}</button>` : ""}
    ${real?.h != null ? `<div class="resultado-real">
      <span>Real: <strong>${loc.bandera} ${real.h} – ${real.v} ${vis.bandera}</strong></span>
      <span class="pts-ganados ${pts===0?"cero":""}">+${pts} pts</span>
    </div>` : ""}
  </div>`;
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
  showToast("✅ Guardado", "success");
}

function toggleGrupo(gid) {
  document.getElementById(`grupo-content-${gid}`)?.classList.toggle("open");
  document.getElementById(`chevron-${gid}`)?.classList.toggle("open");
}

// ---------- Eliminatoria ----------
function renderEliminatoria() {
  const cont = document.getElementById("eliminatoria-container");
  const bloqueado = !!myPredictions["_campeon"];

  let campeonHtml;
  if (bloqueado) {
    const fila = (key, label) => {
      const eq = getEquipo(myPredictions[key]);
      return `<div class="form-group"><label>${label}</label><div class="champion-locked">${eq.bandera} ${eq.nombre}</div></div>`;
    };
    campeonHtml = `<div class="locked-note">🔒 Tu pronóstico es definitivo.</div>
      ${fila("_campeon",`🥇 Campeón (+${PUNTUACION.campeon} pts)`)}
      ${fila("_subcampeon",`🥈 Subcampeón (+${PUNTUACION.subcampeon} pts)`)}
      ${myPredictions["_tercero"] ? fila("_tercero",`🥉 Tercer lugar (+${PUNTUACION.tercero} pts)`) : ""}`;
  } else {
    const opts = Object.entries(EQUIPOS).sort((a,b) => a[1].nombre.localeCompare(b[1].nombre))
      .map(([id,eq]) => `<option value="${id}">${eq.bandera} ${eq.nombre}</option>`).join("");
    const sel = (id,label) => `<div class="form-group"><label>${label}</label>
      <select class="champion-select" id="${id}"><option value="">— Selecciona —</option>${opts}</select></div>`;
    campeonHtml = `<div class="warn-note">⚠️ Una vez que guardes, tu pronóstico quedará bloqueado y <strong>no podrás cambiarlo</strong>.</div>
      ${sel("sel-campeon",`🥇 Campeón (+${PUNTUACION.campeon} pts)`)}
      ${sel("sel-subcampeon",`🥈 Subcampeón (+${PUNTUACION.subcampeon} pts)`)}
      ${sel("sel-tercero",`🥉 Tercer lugar (+${PUNTUACION.tercero} pts)`)}
      <button class="btn-primary" onclick="guardarCampeonPred()">Guardar pronóstico (definitivo)</button>`;
  }

  cont.innerHTML = `<div class="card"><div class="card-title">🏆 Mi pronóstico final</div>${campeonHtml}</div>`;

  if (knockoutMatches.length) {
    const porFase = {};
    knockoutMatches.forEach(m => { (porFase[m.fase] ??= []).push(m); });
    cont.innerHTML += FASES_ELIMINATORIAS.filter(f => porFase[f.id]).map(f => `
      <div class="bracket-round"><div class="bracket-round-title">${f.nombre}</div>
      ${porFase[f.id].map(m => renderElimMatch(m, f.id)).join("")}</div>`).join("");
  } else {
    cont.innerHTML += `<div class="empty-state" style="margin-top:16px"><div class="icon">🔜</div><p>Los partidos eliminatorios aparecerán aquí cuando finalice la fase de grupos</p></div>`;
  }
}

function renderElimMatch(m, fase) {
  const loc = m.local_id ? getEquipo(m.local_id) : null;
  const vis = m.visitante_id ? getEquipo(m.visitante_id) : null;
  const pred = myPredictions[m.id], real = realResults[m.id];
  const cerrado = real?.status === "FINISHED";
  const pts = calcPtsElim(pred, real, fase);
  return `<div class="bracket-match">
    <div class="bracket-team ${!loc?"tbd":""}"><span>${loc?loc.bandera:"🤔"}</span><span>${loc?loc.nombre:m.local_label||"Por definir"}</span>${real?`<span class="score">${real.h}</span>`:""}</div>
    <div class="bracket-team ${!vis?"tbd":""}"><span>${vis?vis.bandera:"🤔"}</span><span>${vis?vis.nombre:m.visitante_label||"Por definir"}</span>${real?`<span class="score">${real.v}</span>`:""}</div>
    ${loc && vis && !cerrado ? `<div style="padding:10px 14px;border-top:1px solid var(--gris-borde)">
      <div class="score-input-group" style="justify-content:center;gap:12px">
        <input type="number" min="0" max="20" class="score-input" id="eh-${m.id}" value="${pred?pred.h:""}">
        <span class="score-sep">–</span>
        <input type="number" min="0" max="20" class="score-input" id="ev-${m.id}" value="${pred?pred.v:""}">
      </div>
      <button class="btn-guardar-partido" style="margin-top:8px" onclick="guardarElimPred('${m.id}')">
        ${pred?"✅ Guardado — Actualizar":"Guardar predicción"}</button>
    </div>` : ""}
    ${pts > 0 ? `<div style="padding:6px 14px;background:#f0fdf4;font-size:13px;font-weight:700;color:var(--verde)">+${pts} puntos</div>` : ""}
  </div>`;
}

async function guardarElimPred(matchId) {
  const h = document.getElementById(`eh-${matchId}`)?.value;
  const v = document.getElementById(`ev-${matchId}`)?.value;
  if (h === "" || v === "") return showToast("Ingresa ambos marcadores", "error");
  await guardarPrediccion(matchId, +h, +v);
  showToast("✅ Guardado", "success"); renderEliminatoria();
}

function guardarCampeonPred() {
  if (myPredictions["_campeon"]) return showToast("🔒 Ya está bloqueado", "error");
  const c = document.getElementById("sel-campeon").value;
  const s = document.getElementById("sel-subcampeon").value;
  const t = document.getElementById("sel-tercero").value;
  if (!c || !s) return showToast("Selecciona al menos campeón y subcampeón", "error");
  const eq = getEquipo(c);
  if (!confirm(`Eliges a ${eq.bandera} ${eq.nombre} como campeón.\n\n⚠️ DEFINITIVO: no se podrá cambiar.\n\n¿Confirmas?`)) return;
  guardarCampeon(c, s, t);
}

// ---------- Resultados ----------
function renderResultados() {
  const cont = document.getElementById("resultados-container");
  const finalizados = PARTIDOS_GRUPOS.filter(p => realResults[p.id]?.status === "FINISHED");
  const enCurso = PARTIDOS_GRUPOS.filter(p => realResults[p.id] && realResults[p.id].status !== "FINISHED");
  const proximos = PARTIDOS_GRUPOS.filter(p => !realResults[p.id]);

  let html = "";

  if (enCurso.length) {
    html += `<div class="card"><div class="card-title">🔴 En juego</div>`;
    html += enCurso.map(p => resultadoRow(p)).join("");
    html += `</div>`;
  }

  if (finalizados.length) {
    const porFecha = {};
    finalizados.forEach(p => {
      const grupo = p.grupo;
      (porFecha[grupo] ??= []).push(p);
    });
    Object.keys(GRUPOS).forEach(gid => {
      const partidos = porFecha[gid];
      if (!partidos?.length) return;
      const grupo = GRUPOS[gid];
      html += `<div class="card"><div class="card-title">Grupo ${gid} — ${grupo.equipos.map(id => getEquipo(id).bandera).join(" ")}</div>`;
      html += partidos.map(p => resultadoRow(p)).join("");
      html += `</div>`;
    });
  }

  if (!finalizados.length && !enCurso.length) {
    html = `<div class="empty-state"><div class="icon">📺</div><p>Aún no hay resultados — el primer partido es hoy.</p></div>`;
  }

  if (proximos.length) {
    proximos.sort((a, b) => (matchDates[a.id] || "Z").localeCompare(matchDates[b.id] || "Z"));
    html += `<div class="card"><div class="card-title">📅 Próximos partidos (${proximos.length})</div>`;
    html += proximos.slice(0, 12).map(p => {
      const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
      const d = matchDates[p.id] ? new Date(matchDates[p.id]) : null;
      const fecha = d ? `${d.toLocaleDateString("es-CL",{day:"numeric",month:"short"})} ${d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}` : `G${p.grupo}`;
      return `<div class="partido-row"><div class="partido-equipos">
        <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
        <span style="color:var(--gris);font-size:11px">${fecha}</span>
        <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
      </div></div>`;
    }).join("");
    if (proximos.length > 12) html += `<p class="text-muted" style="text-align:center;margin-top:8px">+${proximos.length - 12} partidos más</p>`;
    html += `</div>`;
  }

  cont.innerHTML = html;
}

function resultadoRow(p) {
  const loc = getEquipo(p.local), vis = getEquipo(p.visitante);
  const r = realResults[p.id];
  const finished = r?.status === "FINISHED";
  return `<div class="partido-row cerrado" style="padding:10px 0;border-bottom:1px solid var(--gris-borde)">
    <div class="partido-equipos">
      <span class="equipo-nombre">${loc.bandera} ${loc.nombre}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:20px;font-weight:800">${r?.h ?? "–"}</span>
        <span style="color:var(--gris)">–</span>
        <span style="font-size:20px;font-weight:800">${r?.v ?? "–"}</span>
      </div>
      <span class="equipo-nombre visitante">${vis.nombre} ${vis.bandera}</span>
    </div>
    <div style="text-align:center;margin-top:4px">
      <span style="font-size:11px;color:var(--gris)">${finished ? "✅ Final" : "🔴 En juego"} · Grupo ${p.grupo}</span>
    </div>
  </div>`;
}

// ---------- Ranking ----------
async function renderRanking() {
  await recalcAll();
  const sorted = Object.values(allScores).sort((a,b) => b.total - a.total);
  const cont = document.getElementById("ranking-container");
  if (!sorted.length) { cont.innerHTML = `<div class="empty-state"><div class="icon">🏅</div><p>Aún no hay participantes</p></div>`; return; }
  cont.innerHTML = `<div class="ranking-scroll"><table class="ranking-table">
    <thead><tr><th>#</th><th>Participante</th><th style="text-align:right">Total</th><th style="text-align:right">Grupos</th><th style="text-align:right">Elim.</th></tr></thead>
    <tbody>${sorted.map((s,i) => {
      const pos = i+1, yo = s.uid === userName;
      const medal = pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":pos;
      return `<tr class="${yo?"yo":""}">
        <td><span class="rank-pos pos-${pos}">${medal}</span></td>
        <td><strong>${s.nombre}</strong>${yo?' <span class="badge badge-green">Tú</span>':""}</td>
        <td style="text-align:right"><span class="pts-badge">${s.total}</span></td>
        <td style="text-align:right;color:var(--gris)">${s.grupos||0}</td>
        <td style="text-align:right;color:var(--gris)">${(s.eliminatoria||0)+(s.bonus||0)}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

// ---------- Admin ----------
function renderAdmin() {
  const pendientes = PARTIDOS_GRUPOS.filter(p => !realResults[p.id] || realResults[p.id]?.status !== "FINISHED");
  document.getElementById("admin-container").innerHTML = `
  <div class="card mb-16">
    <div class="card-title">📡 API de resultados</div>
    <button class="btn-primary" onclick="fetchFromAPI()">🔄 Obtener resultados</button>
    <p id="api-status" class="text-muted mt-8"></p>
  </div>
  <div class="card">
    <div class="card-title">✏️ Resultados manuales</div>
    ${!pendientes.length ? '<p class="text-muted">Todos los partidos tienen resultado ✅</p>' :
      pendientes.map(p => {
        const loc = getEquipo(p.local), vis = getEquipo(p.visitante); const r = realResults[p.id];
        return `<div class="admin-match"><h4>${loc.bandera} ${loc.nombre} vs ${vis.nombre} ${vis.bandera} <span class="badge badge-gray">G${p.grupo}</span></h4>
          <div class="admin-score-row">
            <input type="number" min="0" max="20" id="ar-h-${p.id}" value="${r?.h != null ? r.h : ""}" placeholder="0">
            <span style="font-weight:700">–</span>
            <input type="number" min="0" max="20" id="ar-v-${p.id}" value="${r?.v != null ? r.v : ""}" placeholder="0">
            <button class="btn-admin" onclick="guardarResultadoAdmin('${p.id}')">Guardar</button>
          </div></div>`;
      }).join("")}
  </div>`;
}

async function guardarResultadoAdmin(matchId) {
  const h = +document.getElementById(`ar-h-${matchId}`).value;
  const v = +document.getElementById(`ar-v-${matchId}`).value;
  if (isNaN(h) || isNaN(v)) return showToast("Ingresa ambos marcadores", "error");
  await sb.from("resultados").upsert({ match_id: matchId, home_score: h, away_score: v, status: "FINISHED" }, { onConflict: "match_id" });
  realResults[matchId] = { h, v, status: "FINISHED" };
  await recalcAll();
  showToast("✅ Resultado guardado", "success"); renderAdmin();
}

const ESPN_TLA = { CUW: "cur", URU: "uru" };
function espnToId(abbr) {
  if (!abbr) return null;
  const mapped = ESPN_TLA[abbr] || abbr.toLowerCase();
  return EQUIPOS[mapped] ? mapped : null;
}

async function fetchFromAPI(silent) {
  const st = document.getElementById("api-status");
  if (st && !silent) st.textContent = "Consultando ESPN...";
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { events = [] } = await res.json();
    let n = 0;
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      if (!home || !away) continue;
      const locId = espnToId(home.team?.abbreviation);
      const visId = espnToId(away.team?.abbreviation);
      if (!locId || !visId) continue;
      const match = findMatch(locId, visId);
      if (!match) continue;
      if (ev.date) matchDates[match.id] = ev.date;
      const state = comp.status?.type?.state;
      if (state === "pre") continue;
      const hRaw = parseInt(home.score), vRaw = parseInt(away.score);
      if (isNaN(hRaw)) continue;
      const h = match.swapped ? vRaw : hRaw;
      const v = match.swapped ? hRaw : vRaw;
      const apiStatus = state === "post" ? "FINISHED" : "LIVE";
      if (realResults[match.id]?.status === apiStatus && realResults[match.id]?.h === h && realResults[match.id]?.v === v) continue;
      await sb.from("resultados").upsert({ match_id: match.id, home_score: h, away_score: v, status: apiStatus }, { onConflict: "match_id" });
      n++;
    }
    if (n > 0) { await loadResults(); await recalcAll(); }
    if (currentView === "resultados") renderResultados();
    if (st && !silent) st.textContent = `✅ ${n} resultado(s) actualizados`;
    return n;
  } catch (e) { if (st && !silent) st.textContent = `❌ ${e.message}`; return 0; }
}

function findMatch(l, v) {
  const m = PARTIDOS_GRUPOS.find(m => (m.local === l && m.visitante === v) || (m.local === v && m.visitante === l));
  if (!m) return null;
  return { id: m.id, swapped: m.local !== l };
}
function findMatchId(l, v) { return findMatch(l, v)?.id || null; }

// ---------- Utils ----------
function getEquipo(id) { return EQUIPOS[id] || { nombre: id, bandera: "🏴", grupo: "?" }; }

function showToast(m, type = "") {
  const t = document.getElementById("toast");
  t.textContent = m; t.className = `toast ${type} show`;
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 3000);
}

window.doLogin = doLogin;
window.navigateTo = navigateTo;
window.toggleGrupo = toggleGrupo;
window.guardarPartidoPred = guardarPartidoPred;
window.guardarElimPred = guardarElimPred;
window.guardarCampeonPred = guardarCampeonPred;
window.guardarResultadoAdmin = guardarResultadoAdmin;
window.fetchFromAPI = fetchFromAPI;
