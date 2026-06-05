// ============================================================
// DATOS MUNDIAL 2026 - Actualizar con el sorteo oficial FIFA
// Draw realizado el 5 de diciembre de 2025
// Fuente oficial: https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/2026
// ============================================================

const EQUIPOS = {
  // Grupo A
  "usa":  { nombre: "Estados Unidos", bandera: "🇺🇸", grupo: "A" },
  "uru":  { nombre: "Uruguay",         bandera: "🇺🇾", grupo: "A" },
  "pan":  { nombre: "Panamá",          bandera: "🇵🇦", grupo: "A" },
  "bol":  { nombre: "Bolivia",         bandera: "🇧🇴", grupo: "A" },
  // Grupo B
  "por":  { nombre: "Portugal",        bandera: "🇵🇹", grupo: "B" },
  "arg":  { nombre: "Argentina",       bandera: "🇦🇷", grupo: "B" },
  "mar":  { nombre: "Marruecos",       bandera: "🇲🇦", grupo: "B" },
  "irq":  { nombre: "Irak",            bandera: "🇮🇶", grupo: "B" },
  // Grupo C
  "mex":  { nombre: "México",          bandera: "🇲🇽", grupo: "C" },
  "ecu":  { nombre: "Ecuador",         bandera: "🇪🇨", grupo: "C" },
  "cro":  { nombre: "Croacia",         bandera: "🇭🇷", grupo: "C" },
  "cmr":  { nombre: "Camerún",         bandera: "🇨🇲", grupo: "C" },
  // Grupo D
  "esp":  { nombre: "España",          bandera: "🇪🇸", grupo: "D" },
  "ned":  { nombre: "Países Bajos",    bandera: "🇳🇱", grupo: "D" },
  "sen":  { nombre: "Senegal",         bandera: "🇸🇳", grupo: "D" },
  "hon":  { nombre: "Honduras",        bandera: "🇭🇳", grupo: "D" },
  // Grupo E
  "bra":  { nombre: "Brasil",          bandera: "🇧🇷", grupo: "E" },
  "col":  { nombre: "Colombia",        bandera: "🇨🇴", grupo: "E" },
  "aut":  { nombre: "Austria",         bandera: "🇦🇹", grupo: "E" },
  "crc":  { nombre: "Costa Rica",      bandera: "🇨🇷", grupo: "E" },
  // Grupo F
  "fra":  { nombre: "Francia",         bandera: "🇫🇷", grupo: "F" },
  "pry":  { nombre: "Paraguay",        bandera: "🇵🇾", grupo: "F" },
  "bel":  { nombre: "Bélgica",         bandera: "🇧🇪", grupo: "F" },
  "ngr":  { nombre: "Nigeria",         bandera: "🇳🇬", grupo: "F" },
  // Grupo G
  "eng":  { nombre: "Inglaterra",      bandera: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", grupo: "G" },
  "ger":  { nombre: "Alemania",        bandera: "🇩🇪", grupo: "G" },
  "egy":  { nombre: "Egipto",          bandera: "🇪🇬", grupo: "G" },
  "slv":  { nombre: "El Salvador",     bandera: "🇸🇻", grupo: "G" },
  // Grupo H
  "can":  { nombre: "Canadá",          bandera: "🇨🇦", grupo: "H" },
  "jap":  { nombre: "Japón",           bandera: "🇯🇵", grupo: "H" },
  "pol":  { nombre: "Polonia",         bandera: "🇵🇱", grupo: "H" },
  "kor":  { nombre: "Corea del Sur",   bandera: "🇰🇷", grupo: "H" },
  // Grupo I
  "ita":  { nombre: "Italia",          bandera: "🇮🇹", grupo: "I" },
  "tur":  { nombre: "Turquía",         bandera: "🇹🇷", grupo: "I" },
  "mex2": { nombre: "México",          bandera: "🇲🇽", grupo: "I" }, // placeholder
  "alg":  { nombre: "Argelia",         bandera: "🇩🇿", grupo: "I" },
  // Grupo J
  "den":  { nombre: "Dinamarca",       bandera: "🇩🇰", grupo: "J" },
  "per":  { nombre: "Perú",            bandera: "🇵🇪", grupo: "J" },
  "srb":  { nombre: "Serbia",          bandera: "🇷🇸", grupo: "J" },
  "aus":  { nombre: "Australia",       bandera: "🇦🇺", grupo: "J" },
  // Grupo K
  "sco":  { nombre: "Escocia",         bandera: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", grupo: "K" },
  "chi":  { nombre: "Chile",           bandera: "🇨🇱", grupo: "K" },
  "swe":  { nombre: "Suecia",          bandera: "🇸🇪", grupo: "K" },
  "ira":  { nombre: "Irán",            bandera: "🇮🇷", grupo: "K" },
  // Grupo L
  "mor":  { nombre: "Marruecos",       bandera: "🇲🇦", grupo: "L" },
  "ven":  { nombre: "Venezuela",       bandera: "🇻🇪", grupo: "L" },
  "hun":  { nombre: "Hungría",         bandera: "🇭🇺", grupo: "L" },
  "nzl":  { nombre: "Nueva Zelanda",   bandera: "🇳🇿", grupo: "L" },
};

// Corrección: reemplazar duplicados con los equipos reales
// ACTUALIZA esta sección con los grupos oficiales del sorteo
const GRUPOS = {
  A: {
    nombre: "Grupo A",
    equipos: ["usa", "uru", "pan", "bol"]
  },
  B: {
    nombre: "Grupo B",
    equipos: ["por", "arg", "mar", "irq"]
  },
  C: {
    nombre: "Grupo C",
    equipos: ["mex", "ecu", "cro", "cmr"]
  },
  D: {
    nombre: "Grupo D",
    equipos: ["esp", "ned", "sen", "hon"]
  },
  E: {
    nombre: "Grupo E",
    equipos: ["bra", "col", "aut", "crc"]
  },
  F: {
    nombre: "Grupo F",
    equipos: ["fra", "pry", "bel", "ngr"]
  },
  G: {
    nombre: "Grupo G",
    equipos: ["eng", "ger", "egy", "slv"]
  },
  H: {
    nombre: "Grupo H",
    equipos: ["can", "jap", "pol", "kor"]
  },
  I: {
    nombre: "Grupo I",
    equipos: ["ita", "tur", "alg", "irn"]
  },
  J: {
    nombre: "Grupo J",
    equipos: ["den", "per", "srb", "aus"]
  },
  K: {
    nombre: "Grupo K",
    equipos: ["sco", "chi", "swe", "ira"]
  },
  L: {
    nombre: "Grupo L",
    equipos: ["ven", "hun", "nzl", "tun"]
  }
};

// Equipos faltantes (agrega los IDs necesarios a EQUIPOS arriba)
const EQUIPOS_EXTRA = {
  "irn": { nombre: "Irán",     bandera: "🇮🇷", grupo: "I" },
  "tun": { nombre: "Túnez",    bandera: "🇹🇳", grupo: "L" },
  "ven": { nombre: "Venezuela",bandera: "🇻🇪", grupo: "L" },
  "hun": { nombre: "Hungría",  bandera: "🇭🇺", grupo: "L" },
  "nzl": { nombre: "N. Zelanda",bandera:"🇳🇿", grupo: "L" },
  "sco": { nombre: "Escocia",  bandera: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", grupo: "K" },
  "chi": { nombre: "Chile",    bandera: "🇨🇱", grupo: "K" },
  "swe": { nombre: "Suecia",   bandera: "🇸🇪", grupo: "K" },
};
Object.assign(EQUIPOS, EQUIPOS_EXTRA);

// Genera todos los partidos de grupos (cada grupo: 6 partidos)
function generarPartidosGrupo(grupoId) {
  const grupo = GRUPOS[grupoId];
  const equipos = grupo.equipos;
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
        jornada: Math.ceil(i / 2), // aprox
      });
      i++;
    }
  }
  return partidos;
}

// Todos los partidos de fase de grupos (12 grupos × 6 partidos = 72 partidos)
const PARTIDOS_GRUPOS = [];
for (const grupoId of Object.keys(GRUPOS)) {
  PARTIDOS_GRUPOS.push(...generarPartidosGrupo(grupoId));
}

// Estructura de fases eliminatorias
const FASES_ELIMINATORIAS = [
  { id: "r32",  nombre: "Ronda de 32",    partidos: 16 },
  { id: "r16",  nombre: "Octavos de Final", partidos: 8 },
  { id: "qf",   nombre: "Cuartos de Final", partidos: 4 },
  { id: "sf",   nombre: "Semifinales",      partidos: 2 },
  { id: "3ro",  nombre: "Tercer Puesto",    partidos: 1 },
  { id: "fin",  nombre: "Final",            partidos: 1 },
];

// Sistema de puntuación
const PUNTUACION = {
  resultadoCorrecto: 2,      // Acertaste G/E/P
  marcadorExacto: 5,         // Acertaste el marcador exacto
  clasificadoGrupo: 2,       // Predijiste que este equipo avanzaría (bonus)
  // Eliminatoria: puntos por ronda
  eliminatoria: {
    r32: 3,
    r16: 4,
    qf:  6,
    sf:  8,
    "3ro": 5,
    fin: 10,
  },
  eliminatoriaExacto: 3,     // Bonus por marcador exacto en eliminatoria
  // Pronóstico que se hace AL INICIO (antes de que arranque el Mundial).
  // Es la apuesta más arriesgada → la que más puntos otorga.
  campeon: 30,
  subcampeon: 15,
  tercero: 8,
};

// Fecha límite para elegir campeón (debe hacerse antes del primer partido)
const CIERRE_CAMPEON = new Date("2026-06-11T16:00:00");

// Fechas del torneo
const TORNEO = {
  inicio: new Date("2026-06-11"),
  final: new Date("2026-07-19"),
  cierrePrediccionesGrupos: new Date("2026-06-10T23:59:00"),
};
