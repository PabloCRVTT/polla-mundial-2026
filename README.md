# ⚽ Polla Mundial 2026 — My Family

Aplicación web para predecir resultados del **Mundial de Fútbol 2026** (USA · Canadá · México).  
Registro con email + contraseña, predicciones por partido, ranking automático en tiempo real.

## ✨ Funcionalidades

- 🔐 **Registro/Login** con email y contraseña (Firebase Auth)
- 🗂️ **Fase de grupos** — predice el marcador de los 72 partidos (12 grupos × 6 partidos)
- ⚡ **Eliminatoria** — bracket que se completa a medida que avanza el torneo
- 🏆 **Pronóstico de campeón** — elige campeón, subcampeón y tercer puesto
- 🏅 **Ranking en tiempo real** — se actualiza al cargar resultados
- 📡 **Resultados automáticos** — integración con football-data.org
- ⚙️ **Panel de admin** — tu email puede cargar resultados manualmente o desde la API

## 📊 Sistema de puntuación

| Predicción | Puntos |
|---|---|
| Resultado correcto (G/E/P) | +2 pts |
| Marcador exacto | +5 pts |
| Partido eliminatorio (resultado) | +3–10 pts (escala por ronda) |
| Marcador exacto eliminatoria | +3 pts bonus |
| Campeón correcto | +15 pts |
| Subcampeón correcto | +8 pts |
| Tercer puesto correcto | +4 pts |

## 🚀 Configuración paso a paso

### 1. Firebase (backend)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. **Crear proyecto** → nombre: `polla-mundial-2026`
3. Desactiva Google Analytics (no es necesario)
4. En el menú lateral → **Build → Authentication → Get started**
   - Activa **Email/Password**
5. En el menú lateral → **Build → Firestore Database → Create database**
   - Elige **Production mode** (región: `us-central1` o la más cercana)
   - En **Rules**, pega estas reglas de seguridad:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios: solo el propio usuario puede leer/escribir su doc
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Predicciones: solo el propio usuario puede escribir, todos pueden leer
    match /predicciones/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    // Resultados: solo admins pueden escribir, todos pueden leer
    match /resultados/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        request.auth.token.email in ['pablocrovetto87@gmail.com'];
    }
    // Eliminatoria: solo admins pueden escribir
    match /eliminatoria/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        request.auth.token.email in ['pablocrovetto87@gmail.com'];
    }
  }
}
```

6. En **Project settings** (ícono ⚙️) → **General** → sección **Your apps** → añade una **Web app** (`</>`)
7. Copia la `firebaseConfig` y pégala en `js/config.js`:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "polla-mundial-2026.firebaseapp.com",
  projectId: "polla-mundial-2026",
  storageBucket: "polla-mundial-2026.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 2. API de resultados (opcional pero recomendado)

1. Regístrate gratis en [football-data.org](https://www.football-data.org/)
2. Obtén tu API key gratuita (100 requests/día)
3. Agrégala en `js/config.js`:

```javascript
const FOOTBALL_API_KEY = "tu_key_aqui";
```

> ⚠️ **Nota de seguridad**: La API key quedará expuesta en el código cliente.  
> Para uso familiar/interno con pocos usuarios esto es aceptable.  
> Para producción pública, crea una Firebase Cloud Function que haga de proxy.

### 3. Actualizar grupos del sorteo

El archivo `js/data.js` tiene grupos *estimados*. **Actualiza con los grupos oficiales**:

1. Consulta [fifa.com](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/2026) para los grupos reales
2. Edita el objeto `GRUPOS` en `js/data.js`
3. Asegúrate de que todos los IDs de equipo existan en el objeto `EQUIPOS`

### 4. Despliegue en GitHub Pages

```bash
# 1. Crea un repositorio en GitHub (ej: polla-mundial-2026)

# 2. Inicializa y sube el código
git init
git add .
git commit -m "Initial: Polla Mundial 2026"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/polla-mundial-2026.git
git push -u origin main

# 3. Activa GitHub Pages
# Ve a: Settings → Pages → Source: "Deploy from branch" → Branch: main → / (root)
# Tu app estará en: https://TU_USUARIO.github.io/polla-mundial-2026
```

> ⚠️ **Dominio y Firebase Auth**: En Firebase Console → Authentication → Settings → **Authorized domains**, agrega `tu-usuario.github.io`

## 🏗️ Estructura del proyecto

```
polla-mundial-2026/
├── index.html          # SPA principal
├── css/
│   └── style.css       # Estilos (mobile-first)
├── js/
│   ├── config.js       # 🔧 EDITAR: Firebase + API keys
│   ├── data.js         # 🔧 EDITAR: grupos y equipos del sorteo
│   └── app.js          # Lógica completa de la aplicación
└── README.md
```

## 📱 Uso

1. **Comparte la URL** de GitHub Pages con tu familia
2. Cada miembro se **registra** con email y contraseña
3. Entra a **"Grupos"** y predice los 72 partidos de la fase de grupos
4. Predice también el **campeón, subcampeón y tercer puesto**
5. Tú (admin) **cargas los resultados** desde el panel Admin (manual o via API)
6. El **ranking** se actualiza automáticamente

## 🔧 Administración

Solo los emails listados en `POLLA_CONFIG.admins` (en `config.js`) ven la pestaña ⚙️ Admin.

Desde ahí puedes:
- **Ingresar resultados manualmente** partido por partido
- **Obtener resultados desde API** (football-data.org) con un clic
- **Definir campeón/subcampeón/tercer puesto** al final del torneo
- **Crear partidos eliminatorios** (próximamente: desde Firestore Console)

### Agregar partidos eliminatorios (desde Firestore Console)

Una vez que empiece la eliminatoria, agrega documentos en la colección `eliminatoria`:

```json
{
  "id": "r32_1",
  "fase": "r32",
  "orden": 1,
  "localId": "arg",
  "visitanteId": "bra",
  "localLabel": "1° Grupo A",
  "visitanteLabel": "2° Grupo B"
}
```

## ⚡ Tecnologías

- **Frontend**: HTML + CSS + Vanilla JS (sin frameworks, funciona en cualquier hosting estático)
- **Backend**: Firebase (Firestore + Authentication) — plan gratuito Spark
- **Resultados**: football-data.org API (gratuito)
- **Hosting**: GitHub Pages (gratuito)

---

Made with ❤️ para la familia. ¡Que empiece el Mundial! 🏆
