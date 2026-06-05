// ============================================================
// DATOS MUNDIAL 2026 — Grupos oficiales del sorteo FIFA
// Sorteo: 5 de diciembre de 2025, Washington D.C.
// Fuente: https://www.fifa.com / Wikipedia
// ============================================================

const EQUIPOS = {
  // Grupo A
  "mex": { nombre: "México",          bandera: "🇲🇽", grupo: "A" },
  "rsa": { nombre: "Sudáfrica",       bandera: "🇿🇦", grupo: "A" },
  "kor": { nombre: "Corea del Sur",   bandera: "🇰🇷", grupo: "A" },
  "cze": { nombre: "Chequia",         bandera: "🇨🇿", grupo: "A" },
  // Grupo B
  "can": { nombre: "Canadá",          bandera: "🇨🇦", grupo: "B" },
  "bih": { nombre: "Bosnia",          bandera: "🇧🇦", grupo: "B" },
  "qat": { nombre: "Qatar",           bandera: "🇶🇦", grupo: "B" },
  "sui": { nombre: "Suiza",           bandera: "🇨🇭", grupo: "B" },
  // Grupo C
  "bra": { nombre: "Brasil",          bandera: "🇧🇷", grupo: "C" },
  "mar": { nombre: "Marruecos",       bandera: "🇲🇦", grupo: "C" },
  "hai": { nombre: "Haití",           bandera: "🇭🇹", grupo: "C" },
  "sco": { nombre: "Escocia",         bandera: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", grupo: "C" },
  // Grupo D
  "usa": { nombre: "Estados Unidos",  bandera: "🇺🇸", grupo: "D" },
  "par": { nombre: "Paraguay",        bandera: "🇵🇾", grupo: "D" },
  "aus": { nombre: "Australia",       bandera: "🇦🇺", grupo: "D" },
  "tur": { nombre: "Turquía",         bandera: "🇹🇷", grupo: "D" },
  // Grupo E
  "ger": { nombre: "Alemania",        bandera: "🇩🇪", grupo: "E" },
  "cur": { nombre: "Curazao",         bandera: "🇨🇼", grupo: "E" },
  "civ": { nombre: "Costa de Marfil", bandera: "🇨🇮", grupo: "E" },
  "ecu": { nombre: "Ecuador",         bandera: "🇪🇨", grupo: "E" },
  // Grupo F
  "ned": { nombre: "Países Bajos",    bandera: "🇳🇱", grupo: "F" },
  "jpn": { nombre: "Japón",           bandera: "🇯🇵", grupo: "F" },
  "swe": { nombre: "Suecia",          bandera: "🇸🇪", grupo: "F" },
  "tun": { nombre: "Túnez",           bandera: "🇹🇳", grupo: "F" },
  // Grupo G
  "bel": { nombre: "Bélgica",         bandera: "🇧🇪", grupo: "G" },
  "egy": { nombre: "Egipto",          bandera: "🇪🇬", grupo: "G" },
  "irn": { nombre: "Irán",            bandera: "🇮🇷", grupo: "G" },
  "nzl": { nombre: "Nueva Zelanda",   bandera: "🇳🇿", grupo: "G" },
  // Grupo H
  "esp": { nombre: "España",          bandera: "🇪🇸", grupo: "H" },
  "cpv": { nombre: "Cabo Verde",      bandera: "🇨🇻", grupo: "H" },
  "ksa": { nombre: "Arabia Saudita",  bandera: "🇸🇦", grupo: "H" },
  "uru": { nombre: "Uruguay",         bandera: "🇺🇾", grupo: "H" },
  // Grupo I
  "fra": { nombre: "Francia",         bandera: "🇫🇷", grupo: "I" },
  "sen": { nombre: "Senegal",         bandera: "🇸🇳", grupo: "I" },
  "irq": { nombre: "Irak",            bandera: "🇮🇶", grupo: "I" },
  "nor": { nombre: "Noruega",         bandera: "🇳🇴", grupo: "I" },
  // Grupo J
  "arg": { nombre: "Argentina",       bandera: "🇦🇷", grupo: "J" },
  "alg": { nombre: "Argelia",         bandera: "🇩🇿", grupo: "J" },
  "aut": { nombre: "Austria",         bandera: "🇦🇹", grupo: "J" },
  "jor": { nombre: "Jordania",        bandera: "🇯🇴", grupo: "J" },
  // Grupo K
  "por": { nombre: "Portugal",        bandera: "🇵🇹", grupo: "K" },
  "cod": { nombre: "RD Congo",        bandera: "🇨🇩", grupo: "K" },
  "uzb": { nombre: "Uzbekistán",      bandera: "🇺🇿", grupo: "K" },
  "col": { nombre: "Colombia",        bandera: "🇨🇴", grupo: "K" },
  // Grupo L
  "eng": { nombre: "Inglaterra",      bandera: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", grupo: "L" },
  "cro": { nombre: "Croacia",         bandera: "🇭🇷", grupo: "L" },
  "gha": { nombre: "Ghana",           bandera: "🇬🇭", grupo: "L" },
  "pan": { nombre: "Panamá",          bandera: "🇵🇦", grupo: "L" },
};

const GRUPOS = {
  A: { nombre: "Grupo A", equipos: ["mex", "rsa", "kor", "cze"] },
  B: { nombre: "Grupo B", equipos: ["can", "bih", "qat", "sui"] },
  C: { nombre: "Grupo C", equipos: ["bra", "mar", "hai", "sco"] },
  D: { nombre: "Grupo D", equipos: ["usa", "par", "aus", "tur"] },
  E: { nombre: "Grupo E", equipos: ["ger", "cur", "civ", "ecu"] },
  F: { nombre: "Grupo F", equipos: ["ned", "jpn", "swe", "tun"] },
  G: { nombre: "Grupo G", equipos: ["bel", "egy", "irn", "nzl"] },
  H: { nombre: "Grupo H", equipos: ["esp", "cpv", "ksa", "uru"] },
  I: { nombre: "Grupo I", equipos: ["fra", "sen", "irq", "nor"] },
  J: { nombre: "Grupo J", equipos: ["arg", "alg", "aut", "jor"] },
  K: { nombre: "Grupo K", equipos: ["por", "cod", "uzb", "col"] },
  L: { nombre: "Grupo L", equipos: ["eng", "cro", "gha", "pan"] },
};

// Genera partidos de grupo (cada grupo: 6 partidos)
function generarPartidosGrupo(grupoId) {
  const equipos = GRUPOS[grupoId].equipos;
  const partidos = [];
  let i = 1;
  for (let a = 0; a < equipos.length - 1; a++) {
    for (let b = a + 1; b < equipos.length; b++) {
      partidos.push({
        id: `G${grupoId}${i}`,
        grupo: grupoId,
        local: equipos[a],
        visitante: equipos[b],
        fase: "grupos",
      });
      i++;
    }
  }
  return partidos;
}

// 12 grupos × 6 partidos = 72 partidos
const PARTIDOS_GRUPOS = [];
for (const grupoId of Object.keys(GRUPOS)) {
  PARTIDOS_GRUPOS.push(...generarPartidosGrupo(grupoId));
}

// Fases eliminatorias
const FASES_ELIMINATORIAS = [
  { id: "r32",  nombre: "Ronda de 32",      partidos: 16 },
  { id: "r16",  nombre: "Octavos de Final",  partidos: 8 },
  { id: "qf",   nombre: "Cuartos de Final",  partidos: 4 },
  { id: "sf",   nombre: "Semifinales",       partidos: 2 },
  { id: "3ro",  nombre: "Tercer Puesto",     partidos: 1 },
  { id: "fin",  nombre: "Final",             partidos: 1 },
];

// Sistema de puntuación
const PUNTUACION = {
  resultadoCorrecto: 2,
  marcadorExacto: 5,
  eliminatoria: { r32: 3, r16: 4, qf: 6, sf: 8, "3ro": 5, fin: 10 },
  eliminatoriaExacto: 3,
  campeon: 30,
  subcampeon: 15,
  tercero: 8,
};

const CIERRE_CAMPEON = new Date("2026-06-11T16:00:00");

const TORNEO = {
  inicio: new Date("2026-06-11"),
  final: new Date("2026-07-19"),
};
