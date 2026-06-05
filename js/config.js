// ============================================================
// CONFIGURACIÓN - Rellena con tus credenciales
// ============================================================

// 1. Firebase: https://console.firebase.google.com
//    Crea proyecto → Web App → copia la config aquí
const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// 2. football-data.org (opcional, para resultados automáticos)
//    Regístrate gratis en https://www.football-data.org/
//    IMPORTANTE: Configura en Firebase Functions o en un proxy
//    para no exponer la key en el cliente (ver README)
const FOOTBALL_API_KEY = "TU_FOOTBALL_DATA_KEY";
// ID del Mundial 2026 en football-data.org (confirmar cuando estén disponibles)
const FOOTBALL_COMPETITION_ID = "WC";

// Configuración de la polla
const POLLA_CONFIG = {
  nombre: "Polla Mundial 2026 🏆",
  subtitulo: "USA · Canadá · México",
  // Código de invitación (déjalo vacío para registro abierto)
  codigoInvitacion: "",
  // Permitir actualizar predicciones hasta que empiece cada partido
  permitirActualizaciones: true,
  // Admin emails (pueden actualizar resultados)
  admins: ["pablocrovetto87@gmail.com"],
};

// Variables globales (no usar ES modules para compatibilidad con scripts regulares)
