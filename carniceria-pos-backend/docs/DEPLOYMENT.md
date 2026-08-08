# DEPLOYMENT.md — Procedimiento de despliegue

Este documento describe cómo instalar y poner en marcha el sistema completo
(backend + frontend + base de datos) en un entorno de producción, siguiendo
la arquitectura ya decidida y documentada en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 0. Modelo de despliegue

Este sistema se despliega como **una sola instancia on-premise, en la
máquina de la sucursal**, no como servicios separados ni en la nube. Esto
no es una decisión de este documento: ya está establecido en
`ARCHITECTURE.md` (requisito #1, *offline-first*, y la elección de
"Monolito modular" frente a microservicios). Concretamente, una instalación
consta de:

- El **backend** (Node.js + Express), corriendo como un único proceso.
- **PostgreSQL**, local, como fuente de verdad — el sistema debe poder
  operar sin conexión a Internet.
- El **frontend**, compilado a archivos estáticos y servido de forma
  independiente del proceso del backend.

Este documento no asume Docker: hoy el proyecto no tiene ningún
`Dockerfile` ni `docker-compose.yml`, y `ARCHITECTURE.md` no lo exige. Los
pasos de abajo son los mismos, se contenericen o no en el futuro.

**Camino alternativo, ya disponible (2026-08-03):** para una instalación real
en la máquina de la sucursal, `carniceria-pos-desktop` (repositorio separado,
no reimplementa nada de este backend ni del frontend) empaqueta los tres
componentes de arriba en un instalador Windows (`electron-builder`/NSIS) que
no requiere que el operador conozca Node/PostgreSQL ni ejecute ninguno de los
pasos manuales de este documento — PostgreSQL queda administrado como proceso
propio de la app de escritorio (`initdb`/`pg_ctl` automáticos). En cada
arranque corren solas las migraciones de esquema (`migrate deploy`) y el
bootstrap de `Permission`/`Role`/`RolePermission` (`prisma/seed-permissions.ts`,
fix 05/08/2026, idempotente); el bootstrap del sistema + catálogo base
(`prisma/seed.ts`) corre una única vez, solo en la instalación fresca — ver
`docs/ARCHITECTURE.md` §6.7 y el `README.md` de `carniceria-pos-desktop`,
sección "QA.APP.6", para el detalle completo de por qué se separaron.
**Fix 07/08/2026:** `prisma/seed.ts` dejó de incluir el dataset de
demostración (proveedores/productos/inventario/promociones) — ya no es
destructivo, y una instalación fresca real queda limpia, lista para
producción, sin datos de prueba. Ese dataset se movió, sin cambios de
contenido, a `prisma/seed-demo.ts` (`npm run prisma:seed:demo`),
exclusivamente manual, nunca invocado por el instalador — ver
`docs/ARCHITECTURE.md` §6.9 y el `ROADMAP.md` del repositorio frontend,
sección "LIMPIEZA DE DATOS DEMO — NUEVO ESQUEMA DE SEEDS". El catálogo
CABYS oficial se carga aparte, vía `prisma/import-cabys-bootstrap.ts`
(ya existente, sin cambios), en cada arranque del Desktop. Este
documento sigue siendo la referencia correcta para un despliegue manual/de
desarrollo, o para entender
qué hace el instalador por debajo.

## 1. Prerrequisitos

- **Node.js** `>= 20.0.0` (declarado en `package.json` → `engines.node` del
  backend).
- **PostgreSQL**, instalado y corriendo en la misma máquina (u otra
  alcanzable por red local — el backend no asume que esté en `localhost`,
  solo que sea alcanzable).
- **Git**, para obtener el código (stack obligatorio según
  `ARCHITECTURE.md`, requisito #4).
- Acceso a una terminal con `bash` (los scripts de `scripts/` lo requieren).

## 2. Obtener el código

```bash
git clone <url-del-repositorio-backend> carniceria-pos-backend
git clone <url-del-repositorio-frontend> carniceria-pos-front
```

Se instalan como dos proyectos independientes (dos repositorios separados),
tal como ya están organizados hoy.

## 3. Configuración de variables de entorno

Cada proyecto tiene su propia plantilla, ya versionada:

### Backend

```bash
cd carniceria-pos-backend
cp .env.example .env
```

Editar `.env` y completar, como mínimo:

- `POSTGRES_PASSWORD` / la contraseña embebida en `DATABASE_URL` — con la
  contraseña real de la base de datos de este entorno.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — con secretos largos y aleatorios
  propios de este entorno (nunca reutilizar los de desarrollo).
- `SUCURSAL_ID` — el UUID real de la sucursal donde corre esta instancia.
- `CORS_ORIGIN` — la URL desde donde se va a servir el frontend en este
  entorno (en desarrollo es `http://localhost:5173`; en producción, la URL
  real donde quede publicado el build). **Nunca `*` con `NODE_ENV=production`**
  — `config/env.ts` rechaza el arranque si se combinan (riesgo real de que
  cualquier sitio pueda robar la sesión vía `/auth/refresh`, ver
  `docs/ARCHITECTURE.md` §6.7).
- `INTEGRATIONS_ENCRYPTION_KEY` — clave hex de 32 bytes (64 caracteres,
  ej. `openssl rand -hex 32`) para cifrar en reposo las credenciales de
  Facturación Electrónica (Alegra, ver §6.9 de `docs/ARCHITECTURE.md`).
  Requerida sin default — el backend no arranca sin ella, aunque la
  integración con Alegra ni siquiera esté configurada todavía. **Guardarla
  con cuidado y no perderla ni rotarla sin plan:** las credenciales de
  Alegra ya cifradas con la clave anterior quedan irrecuperables si se
  pierde o se cambia sin volver a cargarlas.
- `NODE_ENV=production` — ver nota de `CORS_ORIGIN` arriba; controla además
  el detalle de errores expuesto al cliente, el rate limit real de login, y
  el nivel de logging de Prisma (ver `docs/ARCHITECTURE.md` §6.7). Un
  despliegue manual real siempre debe usar `production`, nunca dejar el
  default de desarrollo.

El resto de las variables (`PORT`, `RATE_LIMIT_*`, `BACKUP_*`, etc.) tienen
valores razonables por defecto en `.env.example` y normalmente no necesitan
cambiar. Desde el 03/08/2026, `RATE_LIMIT_*` ya no es un único par
compartido: cada categoría de tráfico (`auth`/`salesQuote`/`transactional`/
`reports`/`administrative`) tiene su propia variable de ventana/máximo, con
default ya calibrado a su volumen real de uso (ver `docs/AUDIT_REPORT.md`
sección 16.2 y `docs/ARCHITECTURE.md` §6.7) — solo ajustar manualmente si el
volumen real de un entorno específico difiere sustancialmente del esperado.

### Frontend

```bash
cd carniceria-pos-front
cp .env.example .env
```

Editar `.env` y ajustar:

- `VITE_API_URL` — apuntando a la URL real donde va a quedar accesible el
  backend en este entorno (por ejemplo, `http://<ip-de-la-maquina>:3000/api/v1`
  si el backend corre en la misma red local).

## 4. Inicialización de la base de datos

```bash
cd carniceria-pos-backend

# Crear la base de datos si todavia no existe
bash scripts/db-init.sh

# Instalar dependencias
npm install

# Generar el cliente de Prisma
npm run prisma:generate

# Aplicar el historial de migraciones a la base de datos
npx prisma migrate deploy

# Sembrar los datos iniciales (sucursal, roles, usuario administrador, configuracion base)
npm run prisma:seed
```

**Nota sobre migraciones (actualizado):** el hallazgo 6.1 de la auditoría
("sin migraciones de Prisma, todo vía `db push`") quedó **resuelto** — el
proyecto ya tiene un historial real de migraciones versionadas en
`prisma/migrations/` (decenas de migraciones aditivas desde julio de 2026).
En producción se aplica con `npx prisma migrate deploy` (o
`npm run prisma:deploy`), no con `prisma db push`. `prisma db push` sigue
siendo válido únicamente para iteración rápida en un entorno de desarrollo
local sin necesidad de generar una migración.

Después de sembrar los datos, opcionalmente se pueden aplicar las vistas
SQL usadas para reporting externo (Power BI, ver `ARCHITECTURE.md` sección
6.6):

```bash
bash scripts/apply-views.sh
```

## 5. Build y arranque del backend

```bash
cd carniceria-pos-backend
npm run build   # tsc + tsc-alias -> genera dist/
npm run start   # node dist/server.js
```

Para desarrollo (sin build, con recarga automática):

```bash
npm run dev
```

## 6. Build y publicación del frontend

```bash
cd carniceria-pos-front
npm install
npm run build   # tsc -b + vite build -> genera dist/
npm run serve   # npx serve -s dist -l 4173 -> publica dist/ en el puerto 4173
```

`npm run serve` publica el contenido de `dist/` con `serve` (paquete npm,
descargado bajo demanda vía `npx`, sin instalación permanente), en modo
*single-page application* (`-s`) — necesario porque el frontend usa
enrutamiento del lado del cliente (`react-router-dom`), así que cualquier
ruta que no exista como archivo devuelve `index.html`. El puerto por
defecto es `4173`, el mismo que ya usa `vite preview`, para no colisionar
con el `PORT` del backend.

Para verificar el build localmente antes de publicarlo (equivalente, pero
pensado para desarrollo, no para dejarlo corriendo en producción):

```bash
npm run preview
```

## 7. Respaldos

Parche 1.0.1: el respaldo automático corre desde Node (`jobs/backup.job.ts`,
`pg_dump` invocado directamente, sin bash) según `BACKUP_CRON`, leyendo
`DATABASE_URL`/`BACKUP_DIR`/`BACKUP_RETENTION_DAYS`/`POSTGRES_BIN_DIR` del
`.env` del backend — no requiere ninguna acción manual. La retención se
aplica automáticamente en cada corrida.

El restore no vive en este backend: en la instalación de escritorio real
(`carniceria-pos-desktop`), se ejecuta desde Electron, que además genera un
respaldo de seguridad del estado actual antes de restaurar y bloquea el uso
del ERP mientras dura la operación — ver el `README.md` de ese repo,
sección "Backup y Restore". Un despliegue sin Electron (fuera del alcance
actual del proyecto) tendría que implementar su propio disparador de
`pg_restore` equivalente; no existe hoy un script de restore standalone en
este repositorio.

## 8. Resumen del orden de arranque

1. PostgreSQL corriendo.
2. `.env` configurado en ambos proyectos (backend y frontend).
3. Base de datos inicializada (`db-init.sh` + `prisma migrate deploy` + `prisma:seed`).
4. Backend construido y arrancado (`npm run build` + `npm run start`).
5. Frontend construido y publicado (`npm run build` + `npm run serve`).
