# Sistema POS Carnicería — Backend

Backend del sistema POS profesional para carnicería (Costa Rica).
Arquitectura: **monolito modular por dominio + capas limpias** (ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).

> **Estado actual (07/08/2026 — Release Candidate):** todos los módulos de negocio están implementados y en
> producción — autenticación (con refresh/rotación de tokens), usuarios,
> roles/permisos granulares, categorías, productos, inventario, mermas,
> proveedores, **clientes** (Bloques 8.1–8.5, ver abajo), compras, ventas,
> devoluciones, caja, Motor de Promociones y Commercial Pricing Engine,
> Módulo de Lotes (FEFO), documentos, reportes, auditoría y **Facturación
> Electrónica vía Alegra** (Bloques 7.1–7.20, extendida en Bloques 8.4–8.5,
> ver abajo). Ver `docs/API.md` para el listado de endpoints y
> `docs/AUDIT_REPORT.md` para el historial de auditoría técnica y la deuda
> pendiente. **La etapa de estabilización del backend quedó oficialmente
> cerrada el 03/08/2026** — dos hallazgos de estabilidad bajo carga real
> (agotamiento del pool de Prisma, recalibración del Rate Limiter) fueron
> corregidos y validados con dos niveles de prueba de uso real (ver
> `docs/AUDIT_REPORT.md` sección 17 y `docs/LOAD_TESTING.md` sección 8).
> **La revisión integral de QA por módulos (QA.1–QA.16B, repositorio
> frontend) quedó cerrada el 05/08/2026** — encontró y corrigió varios bugs
> reales de este backend (timezone de Costa Rica en filtros de fecha de
> Promociones/Reportes/Dashboard, guards de autorización faltantes en
> Usuarios/Roles/Permisos, desincronización de lotes en mermas, reemisión
> duplicada de Alegra) — ver `ROADMAP.md` del repositorio frontend, sección
> "QA INTEGRAL POR MÓDULOS", para la tabla completa. **La auditoría de
> producción de la aplicación de escritorio Electron (QA.APP.1–QA.APP.4,
> repositorio `carniceria-pos-desktop`) también cerró el 05/08/2026** y
> tocó este backend en un punto real: la cookie httpOnly del refresh token
> (`config/env.ts`) pasó de `sameSite: 'lax'`/`secure: isProduction` a
> `sameSite: 'none'`/`secure: true` incondicional — la sesión se perdía
> siempre dentro de la app de escritorio (origen `app://bundle`, distinto
> del backend) porque `Lax` nunca viaja en una petición cross-site; el
> nuevo valor funciona igual en localhost/web (ya era compatible) y no
> requiere TLS local gracias a que Chromium trata `localhost`/`127.0.0.1`
> como origen confiable. Ver `carniceria-pos-desktop/README.md`, sección
> "QA.APP.1–QA.APP.4", para el detalle completo de los cuatro bugs
> encontrados en esa auditoría (dos de ellos exclusivamente de Electron, sin
> tocar este repositorio). El rediseño de UI/UX del frontend
> (`carniceria-pos-front`) también está cerrado — ver su propio
> `ROADMAP.md` para el estado vigente completo del proyecto.
>
> **Facturación Electrónica — integración con Alegra (Bloques 7.1–7.20,
> cerrado 04/08/2026):** el ERP emite comprobantes electrónicos reales,
> aceptados por Hacienda, a través de la API de
> [Alegra](https://developer.alegra.com/) (Costa Rica, v4.4), **no**
> mediante firma/envío directo a Hacienda — esa vía (`modules/invoicing`,
> generación local de XML/PDF) queda como utilidad de apoyo a `documents`,
> sin usarse para envíos reales; Alegra es, por decisión explícita del
> Bloque 7.1, el único motor de facturación electrónica del sistema. Toda la
> integración vive en `src/modules/integrations/alegra/` — credenciales
> cifradas en reposo (AES-256-GCM), cliente/producto genérico resueltos y
> vinculados automáticamente la primera vez (nunca se duplican ni se
> vuelven a buscar después). **La emisión es BAJO DEMANDA** (Bloque 7.17,
> corrigió el diseño original de Bloque 7.11): el POS nunca emite
> automáticamente al confirmar una venta — el flujo es venta → guardado
> local → ticket impreso → fin; recién cuando el usuario lo pide
> explícitamente desde Ventas → Documentos ("Emitir Factura Electrónica")
> se llama a Alegra; exige un código CABYS por producto,
> capturado en el formulario de Productos (Bloque 7.12). Consulta de
> estado, descarga de PDF/XML y reenvío por correo (Bloque 7.20) quedan
> disponibles bajo demanda una vez emitido, nunca cacheados ni
> re-timbrados. Ver `docs/ARCHITECTURE.md` §6.9, `docs/DATABASE.md` §3.9/
> §3.2 y `docs/API.md` (sección `/integrations/alegra`) para el detalle
> técnico completo.
>
> **Fix 07/08/2026 — investigación real de un `402`/código `907` de Alegra
> + eliminación de Tiquete Electrónico (decisión de negocio):** el ERP ya
> no soporta Tiquete Electrónico — toda emisión es **Factura Electrónica**,
> siempre, y una venta sin cliente identificado ya no puede emitir ningún
> comprobante (antes emitía Tiquete a "Cliente General"). Dos causas reales
> encontradas y corregidas: (1) el plan de la cuenta ("Solo Facturación
> Pro") no incluye el módulo de Bancos — enviar `payments[].account.id` en
> `POST /invoices` causaba el `402`/`907` en todo intento; se eliminó el
> campo `payments` por completo (la factura queda "Por cobrar" en Alegra,
> consecuencia aceptada), junto con `resolveAlegraAccountId()` y sus
> constantes de apoyo (borradas, no dejadas inertes). (2) la cuenta real
> tenía dos plantillas de Factura Electrónica simultáneas en
> `GET /number-templates` — `resolveElectronicNumberTemplateId()` ahora
> filtra `documentType`/`isElectronic`/`status`/`isDefault` los cuatro a la
> vez (antes solo los dos primeros), sin ningún ID hardcodeado en ningún
> punto del proyecto (verificado). **Nota de precisión:** cada fix se
> validó con evidencia real por separado; no hay, dentro de la sesión que
> hizo este trabajo, una emisión real única que confirme ambos fixes ya
> combinados — sigue pendiente como la validación final real, ver
> `ROADMAP.md` (repositorio frontend), sección "FACTURACIÓN ELECTRÓNICA —
> INVESTIGACIÓN 402/907 Y ELIMINACIÓN DE TIQUETE ELECTRÓNICO".
>
> **Fix 07/08/2026 — `prisma/seed.ts` dejó de sembrar datos de
> demostración:** una instalación nueva real ejecutaba, hasta hoy,
> `prisma/seed.ts` completo — mezclaba el bootstrap real del sistema con un
> dataset de demostración (6 proveedores, 80 productos + inventario alto, 6
> promociones) sembrado de forma DESTRUCTIVA (`resetCatalogData()` borraba
> Ventas/Compras/Cajas existentes en cada corrida). `prisma/seed.ts` quedó
> recortado a solo el bootstrap no-destructivo + catálogo base (categorías/
> impuestos); el dataset de demostración se movió, sin cambiar su contenido
> ni su lógica, a `prisma/seed-demo.ts` (nuevo, exclusivamente manual,
> `npm run prisma:seed:demo`). La base de desarrollo se reconstruyó desde
> cero (`prisma migrate reset --force`) y se verificó con evidencia real de
> API: solo bootstrap + catálogo base + CABYS real, cero datos operativos.
> Ver `docs/ARCHITECTURE.md` (árbol de `prisma/`) y `ROADMAP.md`
> (repositorio frontend), sección "LIMPIEZA DE DATOS DEMO — NUEVO ESQUEMA
> DE SEEDS", para el detalle completo.
>
> **Módulo de Clientes e integración con Ventas/Facturación Electrónica
> (Bloques 8.1–8.5, cerrado 04/08/2026):** módulo convencional
> (`src/modules/customers/`), global (el ERP opera con una sola sucursal),
> con identificación validada contra el catálogo real de Hacienda
> (CF/CJ/DIMEX/NITE/PE). Integrado en Ventas (`Sale.customerId` opcional,
> `null` = "Público General") y en el POS (selector de cliente en el
> header, por defecto "Público General"). Al facturar bajo demanda (Fix
> 07/08/2026: Tiquete Electrónico retirado, ver arriba), una venta sin
> cliente **ya no puede emitir ningún comprobante**; una venta con cliente
> asociado emite una **Factura Electrónica** a nombre del cliente real,
> resolviendo/creando su contacto en Alegra una sola vez (mismo patrón que
> productos). El reenvío
> por correo usa automáticamente el correo del cliente cuando existe, sin
> pedirlo a mano. Bloque 8.5 corrigió además un bug real de autenticación en
> la descarga del XML (URL prefirmada de S3 recibiendo credenciales de
> Alegra que no le correspondían). Ver `docs/ARCHITECTURE.md` §6.10,
> `docs/DATABASE.md` §3.2/§3.5 y `docs/API.md` (sección `/customers`) para
> el detalle técnico completo.
>
> **Hallazgos reales de una instalación Electron ya actualizada varias veces
> (05/08/2026, corregidos con evidencia real, publicados en la versión
> 0.1.7):** (1) el catálogo de `Permission`/`Role`/`RolePermission` solo se
> sembraba una vez, en `initdb` — cualquier permiso agregado después (ej.
> `customers.*`) nunca llegaba a una instalación ya existente en ninguna
> actualización posterior, causando un `403` real en `/customers/lookup` y
> ocultando el módulo del menú; corregido separando ese bootstrap
> (`prisma/permissionsBootstrap.ts`/`seed-permissions.ts`, 100% idempotente)
> de `prisma/seed.ts` para que corra en cada arranque de una instalación
> existente, sin tocar `Sucursal`/`CashRegister`/`User`/`Configuration` ni
> el catálogo de negocio — ver `docs/ARCHITECTURE.md` §6.7 y
> `carniceria-pos-desktop/README.md` sección "QA.APP.6". (2) un CABYS con
> formato válido pero inexistente en el catálogo real de Alegra causaba un
> `502` real al emitir; (3) un timeout real del cliente HTTP de Alegra
> (10s, respuesta real de 14.5s) podía dejar una venta indefinidamente
> "Pendiente" con riesgo real de doble emisión — corregido con
> reconciliación automática contra `GET /invoices` (Bloque 7.22) — ver
> `docs/ARCHITECTURE.md` §6.9 para el detalle técnico completo de (2) y (3).
>
> **Validación fiscal CABYS ↔ Impuesto — ✅ COMPLETADA (07/08/2026)**, cerrando
> el único riesgo fiscal real que quedaba pendiente para la V1: el catálogo
> `CabysCode` ahora almacena `taxIndicator` (nuevo, migración
> `20260807155805_add_cabys_tax_indicator`), poblado desde la columna
> "Impuesto" del archivo oficial del BCCR (capturado como columna opcional
> en `prisma/import-cabys.ts`, sin afectar el formato CSV simple); nuevo
> `modules/products/cabysTaxCoherence.ts` valida la coherencia CABYS↔impuesto
> al crear y editar productos (`products.service.ts`), lanzando
> `ValidationError` (422, con el código CABYS, el impuesto elegido y el
> oficial) solo cuando el catálogo SÍ tiene información y no coincide —
> nunca bloquea por falta de dato. `GET /cabys/lookup` expone además
> `taxIndicator` (cambio aditivo, solo lectura) para el indicador visual
> preventivo del formulario de Productos (frontend). El catálogo real de la
> instalación Desktop fue cargado con `taxIndicator` real y permanente
> (20.506 códigos). Ver `ROADMAP.md` del repositorio frontend, sección
> "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO", y `docs/AUDIT_REPORT.md` de este
> repositorio, sección 18, para el detalle técnico completo.
>
> **Hallazgo 1 (Promociones acumulables, `amountApplied`) — ✅ CERRADO
> (07/08/2026).** Dos o más promociones `stackable` sobre una misma línea
> podían sumar más del 100% de su subtotal — el precio cobrado ya estaba
> protegido (`adjustedLineSubtotal`), pero el `amountApplied` persistido por
> promoción no se recortaba, inflando el Reporte de Utilidad, el ticket y el
> aporte de proveedor. **Corregido, localizado únicamente en
> `modules/promotions/promotionApplication.service.ts::translateEngineResult`**:
> cuando la suma de `amountApplied` de una línea supera su subtotal real, se
> prorratean los montos ya calculados para que la suma coincida exactamente.
> Sin cambios en el motor de promociones, las reglas stackable/no-stackable,
> `adjustedLineSubtotal`, el monto pagado por el cliente, Alegra, Facturación
> Electrónica, el schema ni la base de datos. El hallazgo relacionado de
> precisión monetaria (`Decimal` vs `number` en el motor de promociones) fue
> reanalizado el mismo día — sin caso reproducible encontrado, se mantiene
> documentado como riesgo teórico. Ver `docs/AUDIT_REPORT.md`, sección 18
> (punto 2), para el detalle técnico completo.
>
> **Módulo de Despiece (plan v3, 08/08/2026) — en curso, independiente del
> Release Candidate de arriba:** nuevo módulo (`modules/processing/`) para
> recibir un animal/canal completo y despiezarlo en N cortes/subproductos
> con trazabilidad de peso/costo/merma. **Bloques 1 (Schema/Migración), 2
> (Backend Core) y 3 (API + Permisos) ✅ completados y aprobados; Bloque 4
> (Inventario + Trazabilidad + Auditoría) es el próximo, sin empezar.** 12
> endpoints bajo `/processing`, 3 permisos nuevos
> (`processing.view`/`processing.create`/`processing.complete`), dos
> migraciones aditivas. Ver `docs/ARCHITECTURE.md`/`docs/DATABASE.md`/`docs/API.md`
> (actualizados) y, para el detalle bloque por bloque, `ROADMAP.md` del
> repositorio `carniceria-pos-front`, sección "MÓDULO DE DESPIECE".

## Stack

- **Node.js** + **Express** (TypeScript)
- **PostgreSQL** (local / on-premise) + **Prisma** (ORM)
- **JWT** + **bcrypt** (seguridad)
- **Zod** (validación), **pino** (logging), **helmet** + **express-rate-limit** (seguridad HTTP)
- **node-cron** (respaldos automáticos), **Vitest** (pruebas)
- **Axios** (Bloque 7.3, único cliente HTTP saliente del backend — hoy solo usado por `modules/integrations/alegra`)
- Todo el stack es software libre.

## Requisitos previos

- Node.js >= 20
- PostgreSQL >= 14 corriendo localmente
- `pg_dump` / `pg_restore` / `psql` en el PATH (para respaldos y vistas)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
#    Editar .env con tus credenciales de PostgreSQL y secretos JWT.

# 3. Crear la base de datos (opcional si ya existe)
npm run db:init   # o: bash scripts/db-init.sh

# 4. Generar el cliente de Prisma
npm run prisma:generate

# 5. Aplicar migraciones
npm run prisma:migrate

# 6. Levantar en desarrollo
npm run dev
```

Verificar salud del servicio: `GET http://localhost:3000/health`.

## Scripts

| Comando                     | Descripción                                   |
| --------------------------- | --------------------------------------------- |
| `npm run dev`               | Servidor en desarrollo (recarga en caliente). |
| `npm run build`             | Compila TypeScript a `dist/`.                 |
| `npm start`                 | Ejecuta la versión compilada.                 |
| `npm run typecheck`         | Verifica tipos sin compilar.                  |
| `npm run lint` / `lint:fix` | Linting.                                      |
| `npm run format`            | Formatea con Prettier.                        |
| `npm test`                  | Ejecuta las pruebas (Vitest).                 |
| `npm run prisma:migrate`    | Migraciones de desarrollo.                    |
| `npm run prisma:seed`       | Bootstrap del sistema + catálogo base (categorías/impuestos) — no destructivo, para instalación nueva. |
| `npm run prisma:seed:demo`  | Fix 07/08/2026 (nuevo): dataset de demostración (proveedores/80 productos/inventario/promociones) — DESTRUCTIVO, exclusivamente manual, para desarrollo/QA. |
| `npm run backup`            | Respaldo manual de la base.                   |
| `npm run db:views`          | Aplica las vistas SQL de Power BI.            |

## Estructura

```
src/
├── config/        Configuración central (env validado, db, jwt, cors, logger)
├── database/      Cliente Prisma + extensiones (soft delete, timestamps, sync)
├── shared/        Errores, utilidades, constantes, tipos y servicios transversales
├── middlewares/   Autenticación, autorización, validación, auditoría, errores
├── modules/       Un módulo por dominio (auth, users, products, sales, ...)
├── jobs/          Tareas programadas (respaldo; sincronización preparada Fase 2)
├── app.ts         Construcción de la app Express
└── server.ts      Arranque y apagado ordenado
```

La estructura completa y las responsabilidades están en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentación

- [`docs/API.md`](docs/API.md) — endpoints por módulo.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura y convenciones.
- [`docs/DATABASE.md`](docs/DATABASE.md) — modelo de datos.
- [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md) — auditoría técnica y deuda pendiente.
- [`docs/BACKEND_QA.md`](docs/BACKEND_QA.md) — procedimiento de QA funcional.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — despliegue on-premise.
- [`docs/LOAD_TESTING.md`](docs/LOAD_TESTING.md) — plan de pruebas de carga.
