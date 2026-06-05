# ⚽ Polla Mundial 2026 — My Family

App web para predecir resultados del **Mundial de Fútbol 2026** (USA · Canadá · México).  
Login con email + contraseña, predicciones por partido, ranking automático en tiempo real.  
**Stack: HTML/CSS/JS puro + Supabase (gratis) + GitHub Pages (gratis)**

---

## ✨ Funcionalidades

- 🔐 **Registro/Login** — solo email y contraseña, sin cuentas externas
- 🗂️ **Fase de grupos** — predice el marcador de los 72 partidos (12 grupos)
- ⚡ **Eliminatoria** — bracket dinámico que se completa a medida que avanza el torneo
- 🏆 **Pronóstico final** — elige campeón, subcampeón y tercer puesto
- 🏅 **Ranking en tiempo real** — actualización automática vía Supabase Realtime
- 📡 **Resultados automáticos** — integración opcional con football-data.org
- ⚙️ **Panel admin** — carga resultados manual o desde API (solo tu email)

---

## 📊 Sistema de puntuación

| Predicción | Puntos |
|---|---|
| Resultado correcto (G/E/P) | +2 pts |
| Marcador exacto grupos | +5 pts |
| Partido eliminatorio correcto | +3 pts (R32) → +10 pts (Final) |
| Marcador exacto eliminatoria | +3 pts bonus |
| Campeón correcto | +15 pts |
| Subcampeón correcto | +8 pts |
| Tercer puesto correcto | +4 pts |

---

## 🚀 Setup paso a paso

### 1. Crear proyecto en Supabase (5 min)

1. Ve a **[supabase.com](https://supabase.com)** → **Start your project** → crea cuenta gratis
2. **New project** → nombre: `polla-mundial-2026` → elige una región → crea contraseña fuerte
3. Espera ~2 min a que el proyecto se inicialice
4. Ve a **Project Settings → API** y copia:
   - **Project URL** → ej: `https://abcxyz.supabase.co`
   - **anon public key** → string largo que empieza con `eyJ...`
5. Pega ambos valores en `js/config.js`:

```javascript
const SUPABASE_URL = "https://abcxyz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### 2. Crear las tablas (SQL Editor)

En Supabase → **SQL Editor** → **New query** → pega y ejecuta:

```sql
-- Tabla de usuarios (perfil público)
create table usuarios (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Tabla de predicciones
create table predicciones (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  match_id text not null,
  home_score integer,
  away_score integer,
  extra_value text,   -- para campeón/subcampeón/tercero
  updated_at timestamptz default now(),
  unique(user_id, match_id)
);

-- Tabla de resultados reales
create table resultados (
  match_id text primary key,
  home_score integer,
  away_score integer,
  value text,         -- para resultados especiales (_campeon, etc.)
  status text default 'SCHEDULED',
  updated_at timestamptz default now()
);

-- Tabla de partidos eliminatorios (el admin los carga conforme avanzan)
create table eliminatoria (
  id text primary key,
  fase text not null,     -- r32, r16, qf, sf, 3ro, fin
  orden integer not null,
  local_id text,          -- ID del equipo (de data.js)
  visitante_id text,
  local_label text,       -- ej: "1° Grupo A" (si aún no se sabe)
  visitante_label text,
  created_at timestamptz default now()
);

-- Habilitar Realtime en estas tablas
alter publication supabase_realtime add table resultados;
alter publication supabase_realtime add table eliminatoria;
```

### 3. Configurar permisos (Row Level Security)

En **SQL Editor** → nuevo query → ejecuta:

```sql
-- Activar RLS
alter table usuarios enable row level security;
alter table predicciones enable row level security;
alter table resultados enable row level security;
alter table eliminatoria enable row level security;

-- Usuarios: cada uno lee/escribe solo el suyo
create policy "usuarios_own" on usuarios
  for all using (auth.uid() = id);

-- Predicciones: cada uno escribe las suyas, todos leen
create policy "predicciones_read" on predicciones
  for select using (auth.role() = 'authenticated');
create policy "predicciones_own_write" on predicciones
  for insert with check (auth.uid() = user_id);
create policy "predicciones_own_update" on predicciones
  for update using (auth.uid() = user_id);

-- Resultados: todos leen, solo admins escriben (via service role o SQL Editor)
create policy "resultados_read" on resultados
  for select using (auth.role() = 'authenticated');

-- Eliminatoria: todos leen
create policy "eliminatoria_read" on eliminatoria
  for select using (auth.role() = 'authenticated');
```

> **Nota:** Para que el admin pueda escribir resultados desde la app, la forma más simple es desde el **SQL Editor** de Supabase directamente, o puedes dar permisos de escritura al email de admin con una policy adicional usando `auth.jwt() ->> 'email'`.

### 4. Configurar autenticación

En Supabase → **Authentication → Settings**:
- Deja **Email confirmations** en **OFF** para uso interno (más simple)
- En **URL Configuration**: agrega `https://TU_USUARIO.github.io` a los **Redirect URLs**

### 5. Actualizar los grupos del torneo

Los grupos en `js/data.js` son una estimación. **Antes de lanzar**, verifica los grupos reales en [fifa.com](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/2026) y edita el objeto `GRUPOS` en ese archivo.

### 6. Subir a GitHub Pages

```bash
# 1. Crea un repo nuevo en github.com/new → nombre: polla-mundial-2026 → Public

# 2. Desde la carpeta del proyecto:
git init
git add .
git commit -m "Polla Mundial 2026"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/polla-mundial-2026.git
git push -u origin main

# 3. Activa GitHub Pages:
# Repo → Settings → Pages → Source: "Deploy from branch"
# Branch: main → / (root) → Save

# Tu app estará en:
# https://TU_USUARIO.github.io/polla-mundial-2026
```

---

## 📂 Estructura del proyecto

```
polla-mundial-2026/
├── index.html          # SPA completa (una sola página)
├── css/
│   └── style.css       # Estilos, mobile-first
├── js/
│   ├── config.js       # 🔧 EDITAR: Supabase URL + anon key
│   ├── data.js         # 🔧 EDITAR: grupos y equipos del Mundial
│   └── app.js          # Toda la lógica de la app
└── README.md
```

---

## ⚙️ Cómo cargar resultados (Admin)

Tú (el email en `POLLA_CONFIG.admins`) verás la pestaña **⚙️ Admin** al iniciar sesión.

**Opción A — Desde la app** (manual):
- Ingresas el marcador de cada partido y haces clic en "Guardar"

**Opción B — API automática** (football-data.org):
1. Regístrate en [football-data.org](https://www.football-data.org/) (gratis)
2. Agrega tu key en `js/config.js` → `FOOTBALL_API_KEY`
3. En el panel Admin → "🔄 Obtener resultados"

**Opción C — SQL Editor de Supabase** (más directo):
```sql
insert into resultados (match_id, home_score, away_score, status)
values ('GA1', 2, 1, 'FINISHED')
on conflict (match_id) do update
  set home_score = 2, away_score = 1, status = 'FINISHED';
```

### Agregar partidos eliminatorios

Una vez que termina la fase de grupos, agrega los partidos desde SQL Editor:

```sql
insert into eliminatoria (id, fase, orden, local_id, visitante_id, local_label, visitante_label)
values
  ('r32_1', 'r32', 1, 'arg', 'uru', '1° Grupo B', '2° Grupo A'),
  ('r32_2', 'r32', 2, 'bra', 'col', '1° Grupo E', '2° Grupo F');
  -- etc...
```

---

## ⚡ Tecnologías

| Capa | Tecnología | Costo |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla | Gratis |
| Base de datos | Supabase (PostgreSQL) | Gratis (hasta 500MB) |
| Autenticación | Supabase Auth | Gratis (hasta 50k MAU) |
| Realtime | Supabase Realtime | Gratis |
| Hosting | GitHub Pages | Gratis |
| Resultados | football-data.org API | Gratis (100 req/día) |

---

Made with ❤️ para la familia. ¡Que empiece el Mundial! 🏆
