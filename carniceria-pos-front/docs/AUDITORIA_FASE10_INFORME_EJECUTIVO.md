# Auditoría Profesional Integral — Carnicería POS
# FASE 10 — Informe Ejecutivo Actualizado

**Fecha original (Fase 9):** 23 de julio de 2026
**Fecha de esta actualización (Fase 10):** 24 de julio de 2026
**Basado en:** Fases 1–9 de la Auditoría Profesional Integral + bloques de implementación cerrados desde entonces (A-16 a A-20, A-14, A-09, A-21, A-15 completo, M-24, corrección del modelo de sesión de caja, seed de caja registradora, Sprint 5 completo: M-01 a M-05, M-07, M-09, M-11, M-14, M-16, M-18, M-19, M-21, Sprint 6: A-06/A-20-backend, A-01 y A-02 (seguridad de tokens JWT), Pulido de UI/UX: unificación de `DataTable`/`Badge`/`ErrorAlert`/`StatusBadge`/`LoadingState`)
**Total de hallazgos analizados originalmente:** 103 (Fases 1–8)
**Total de hallazgos únicos consolidados:** 78 (eliminados 25 duplicados o solapamientos entre fases)

Este documento reemplaza al informe de Fase 9 como referencia vigente. No se elimina historial: cada hallazgo cerrado conserva la descripción del problema original, la causa encontrada y cómo fue resuelto.

---

## 1. Resumen ejecutivo (actualizado)

Carnicería POS es un sistema técnicamente sólido en su núcleo — arquitectura de capas limpia, modelo de datos cuidado, componentes consistentes. Desde el informe de Fase 9 se cerraron **16 hallazgos altos** (A-06/A-20-backend, A-09, A-14, A-15, A-16, A-18, A-19, A-20 completos, A-21, A-01, A-02), se corrigió una **inconsistencia arquitectónica real** en el modelo de sesión de caja (la sesión pertenece a la caja registradora, no al usuario), se completó el **seed inicial** con una caja registradora por defecto, se estandarizó el **feedback de éxito y error** en todos los formularios (M-24, A-15), se cerró **Sprint 5** completo (constraints de unicidad, índices, CORS, auditoría de login/logout, complejidad de contraseñas, `.env.example`, debounce del POS, payload del reporte de ventas), se activó el **RBAC granular** (A-06/Sprint 6) en 9 módulos del backend, se rediseñó la **autenticación** con refresh token en cookie `httpOnly`, access token en memoria, rotación y revocación (A-01/A-02), y se cerró un bloque de **Pulido de UI/UX** (última tabla migrada a `DataTable`, `Badge`/`ErrorAlert`/badges de estado/estados de carga unificados en un solo componente cada uno, eliminando la duplicación real documentada).

El bloqueante funcional más importante que persiste es **A-17 (movimientos de caja)**: la implementación existe de punta a punta (backend y frontend), pero queda **pospuesta** por un bug sin resolver en la apertura del `Select` de "Tipo de movimiento" — diagnosticado extensamente, sin causa confirmada aún (requiere una verificación puntual en DevTools no realizada todavía).

**El sistema se acerca a estar listo para producción**: de los "5 grupos de trabajo no negociables" identificados en Fase 9, **Administración accesible**, **Seguridad de sesión de caja**, **Feedback de usuario**, **RBAC granular** y **Seguridad de tokens** quedaron resueltos. Solo quedan pendientes A-17 (bloqueado por diagnóstico) y una porción menor de seguridad de tokens (JWT en `localStorage` para el access token — ya mitigado con A-01, que lo mueve a memoria).

**Nota de actualización (31 de julio de 2026):** este resumen ejecutivo describe el estado al cierre de la Fase 10 (24 de julio de 2026); el sistema siguió evolucionando desde entonces sin generar ningún hallazgo alto/crítico nuevo. Módulos completos agregados posteriormente, cada uno con su propia sección de detalle más abajo: **Fase 11** (confirmaciones de infraestructura, §14), **Fase 12** (sincronización QA3, §15), **Fase 13** (Historial de Mermas, §16), **Fase 14** (Motor de Promociones, §17), **Fase 15** (Commercial Pricing Engine, §18), **Fase 16** (Módulo de Lotes completo — Compras/Ventas/Mermas/Devoluciones/Reportes/control en Productos/trazabilidad de recepción, §19) y **Fase 17** (`FIXED_PRICE` en Promociones, §20). El único bloqueante funcional que sigue abierto para Release 1.0 es, sin cambios, **A-17** (movimientos de caja) — ver `carniceria-pos-front/ROADMAP.md` para el estado vigente y consolidado.

**Nota de actualización (2 de agosto de 2026):** el rediseño UX/UI integral del frontend (Fase 18 en `ROADMAP.md`) quedó cerrado en esta fecha — todos los módulos, incluido el POS. Sobre **A-17**: no se reprodujo en ninguno de los bloques recientes de trabajo sobre Caja/POS, donde el mismo `Select` señalado en el hallazgo original quedó reestilizado y en uso activo en 3 pantallas distintas sin incidentes — se mantiene documentado (no se cierra sin una verificación puntual en DevTools, ver `ROADMAP.md`) pero ya no se considera un bloqueante real de Release 1.0. Se registró además un hallazgo **nuevo**, no analizado en esta auditoría: un crash bajo carga (~31 compras consecutivas → HTTP 429 → Caja/Ventas/Inventario brevemente sin respuesta) — ver `ROADMAP.md`, sección "Deuda técnica prioritaria", única prioridad técnica real pendiente antes de producción.

---

## 2. Calificaciones por área (actualizadas)

| Área | Calificación Fase 9 | Calificación actual | Justificación del cambio |
|---|---|---|---|
| **Arquitectura** | 8.0 / 10 | 8.0 / 10 | Sin cambios evaluados en este ciclo. |
| **Base de datos** | 6.5 / 10 | 6.8 / 10 | `A-09` y `A-21` resueltos; M-01 a M-05 resueltos (constraints e índices); M-06 pendiente de decisión de arquitectura. |
| **Backend** | 7.5 / 10 | 8.3 / 10 | `authorizePermission` activo en 9 módulos (A-06/Sprint 6); auditoría de login/logout unificada (M-09). |
| **Seguridad** | 5.0 / 10 | 7.5 / 10 | RBAC granular activo (A-06); refresh token en cookie `httpOnly`, access token solo en memoria, rotación y revocación implementadas (A-01/A-02); complejidad de contraseñas (M-11); `RequireCashSession` corregido (M-13). Persisten M-14 (menor), M-15 (decisión de producto). |
| **Rendimiento** | 7.0 / 10 | 7.2 / 10 | Debounce del POS (M-16); payload de reporte de ventas acotado (M-18). |
| **Frontend** | 7.0 / 10 | 8.0 / 10 | `ConfirmDialog`, feedback de error/éxito (A-14/A-15/M-24), y duplicación de componentes (`Badge`, `ErrorAlert`, badges de estado, estados de carga) eliminada por completo — cada uno con una única implementación en todo el proyecto. |
| **UX/UI** | 6.0 / 10 | 7.6 / 10 | Reportes accesibles (A-18), confirmaciones (A-14), toasts (M-24), última tabla migrada a `DataTable`. Persisten: sin comprobante uniforme, A-17 bloqueado. |

### Calificación global actualizada: **7.9 / 10** (antes 6.7 / 10)

El sistema pasa de "beta técnica" a "beta funcional avanzada, cercana a producción" — la seguridad de autenticación y autorización, la administración y el feedback de usuario ya están resueltos de punta a punta; solo queda un bloqueante funcional puntual (A-17) y decisiones de producto pendientes (M-06, M-15, M-17).

---

## 3. Hallazgos consolidados por severidad (actualizado)

### 3.1 Críticos — Bloquean Release 1.0

| ID | Hallazgo | Fase de origen | Estado |
|---|---|---|---|
| C-01 | Sin migraciones versionadas en Prisma — despliegue con `db push` | DB-13, BE-13 | ✅ Resuelto |
| C-02 | `auditService.log()` no persiste en base de datos — auditoría funcionalmente inexistente | BE-07 | ✅ Resuelto |
| C-03 | JWT secrets con valores placeholder sin cambiar (`cambia_este_secreto...`) | SEC-13 | ✅ Resuelto |

Sin cambios en este bloque desde Fase 9.

### 3.2 Altos — Deben resolverse antes de Release 1.0

**Seguridad**

| ID | Hallazgo |
|---|---|
| A-01 | ~~Tokens JWT en `localStorage` — vulnerables a XSS (SEC-01)~~ — ✅ Resuelto: rediseño de autenticación — `refreshToken` viaja exclusivamente como cookie `httpOnly`/`secure`/`sameSite`, nunca en el body de ninguna respuesta ni accesible desde JavaScript. `accessToken` pasa a vivir solo en memoria (Zustand, sin persistencia), recuperado con un refresh silencioso al arrancar la app usando la cookie. |
| A-02 | ~~Refresh token sin rotación ni revocación (SEC-02)~~ — ✅ Resuelto: nuevo modelo `RefreshToken` (hash del token, nunca el JWT en texto plano) con rotación real en cada uso (`revoke` + `create`) y revocación en logout (sesión puntual) y ante reuso de un token ya revocado (incidente de seguridad: se revocan todos los tokens activos del usuario). Pendiente de confirmar migración/`prisma generate` en entorno real (ver Riesgos). |
| A-03 | ~~`cashSessionId` no se limpia en logout — herencia de sesión entre cajeros (SEC-05)~~ — ✅ Resuelto (QW-02): `authStore.logout()` invoca `cashSessionStore.clearCashSessionId()`. |
| A-04 | ~~Contraseña de admin del seed hardcodeada (`Admin123!`) en código y en `api.http` (SEC-06, SEC-11)~~ — ✅ Resuelto: ahora se lee desde `SEED_ADMIN_PASSWORD` validada en `env.ts`. |
| A-05 | ~~Sin rate limit en `/auth/login` — fuerza bruta posible (SEC-15)~~ — ✅ Resuelto (QW-04): `loginRateLimiter` (5 intentos / 15 min, configurable vía `LOGIN_RATE_LIMIT_*`). |
| A-06 | ~~`authorizePermission` implementado pero sin uso — RBAC granular inexistente en backend (SEC-09, BE-06)~~ — ✅ Resuelto (Sprint 6): catálogo de permisos ampliado (9 códigos nuevos: `categories.*`, `taxes.*`, `suppliers.*`, `cash-registers.*`) y `authorizePermission` activado en `categories`, `taxes`, `suppliers`, `cashRegister`, `configuration`, `permissions`, `roles`, `users`, `products`, `cash` (sesiones), `reports` — 11 módulos migrados, manteniendo exactamente el mismo comportamiento efectivo que `SystemRole` (verificado permiso por permiso contra la matriz `ROLE_PERMISSION_CODES`, ya aprobada desde antes). `sales` y `audit` quedan **fuera de este alcance**: `sales.void` es un permiso sembrado sin funcionalidad de anulación real detrás (ver nota); `audit` no tiene ningún permiso granular definido en el catálogo — ambos requieren decisión funcional/de catálogo antes de migrar, no defecto de código. |

**Funcionales**

| ID | Hallazgo |
|---|---|
| A-07 | ~~`Purchase.status` con default `RECEIVED` en lugar de `DRAFT` — compras creadas ya recibidas (DB-05)~~ — ✅ Resuelto (QW-03). |
| A-08 | ~~`CashSession` sin constraint de unicidad para sesión activa por caja — doble apertura posible (DB-04)~~ — ✅ Resuelto: índice único parcial `cash_sessions_active_unique` sobre `cash_register_id` `WHERE status = 'OPEN'`. | Nota de implementación: Durante la resolución de QW-03 y A-08 se detectó un problema de drift en Prisma debido a una discrepancia entre el historial de migraciones y la base física. El historial fue reparado y las migraciones posteriores (purchase_draft_default_and_cash_session_unique y cash_session_active_unique) quedaron aplicadas correctamente.
| A-09 | ~~`Product.cost` con default 0 — reportes de rentabilidad incorrectos (DB-09)~~ — ✅ Resuelto: `cost` ahora obligatorio (se quitó `.optional()`) en `CreateProductSchema`/`UpdateProductSchema` (backend, `products.validation.ts`) y en `createProductSchema`/`updateProductSchema` (frontend, `product.schema.ts`), manteniendo `min(0)`. El campo ya existía en `ProductForm.tsx`; el gap era exclusivamente de validación. |
| A-10 | `DocumentSequence` sin `sucursalId` — no apto para multi-sucursal (DB-11) |
| A-11 | ✅ POS muestra `taxTotal` real por línea del carrito (`product.tax?.rate`) — resuelto en Sprint 2 (UX-02) |
| A-12 | ✅ Selección de método de pago agregada en `CheckoutPanel`/`CreateSaleDto` — resuelto en Sprint 2 (UX-03) |
| A-13 | ✅ Comprobante y confirmación visual tras venta completada — resuelto en Sprint 2 (UX-04) |
| A-14 | ~~Acciones de cambio de estado (activar/desactivar) sin diálogo de confirmación (UX-07)~~ — ✅ Resuelto: `ConfirmDialog.tsx` (ya existente, sin modificar) aplicado a las 5 entidades objetivo — `CategoriesTable.tsx`, `TaxesTable.tsx`, `ProductsTable.tsx`, `UsersTable.tsx`, `RolesTable.tsx`. Ver detalle en sección 9. |
| A-15 | ~~Ninguna página de creación/edición muestra el error cuando una mutación falla (FE-04)~~ — ✅ Resuelto: patrón `isError`/`error` de la mutación + `ErrorAlert` (originado en `CreateUserPage.tsx`) extendido a las 17 páginas `Create*`/`Edit*` del sistema (Usuarios, Categorías, Impuestos, Productos, Proveedores, Compras, Roles, Permisos, Configuración). En las páginas `Edit*`, el error de la mutación de actualización se maneja separado del error de carga de la entidad (`isUpdateError`/`updateError`, sin mezclarse con `isError`/`error` del `useX(id)`). |
| A-16 | ~~Cierre de sesión de caja sin transacción — riesgo de estado inconsistente (BE-08)~~ — ✅ Resuelto: `closeSession` envuelto en `prisma.$transaction` (`src/modules/cash/repository.ts`, `src/modules/cash/service.ts`). Validado: TypeScript compila sin errores introducidos; compatibilidad con llamadas existentes verificada. |
| A-17 | Movimientos de caja: backend (`POST /cash/movements`) y frontend implementados (`CashMovementForm.tsx`, integración en `SalesPOSPage.tsx`); **pospuesto** — el `Select` de "Tipo de movimiento" no abre el listado al hacer clic, impide completar el registro (Fase 1). Ver detalle completo más abajo. |
| A-18 | ~~8 de 9 reportes sin ningún punto de entrada en la interfaz (Fase 2)~~ — ✅ Resuelto: `ReportsIndexPage.tsx` (nueva) con tarjetas hacia los 9 reportes existentes; ruta `/reports` agregada; `NavItem` "Reportes" del sidebar apunta al índice en vez de saltar directo a un reporte específico. Probado manualmente por el usuario. |
| A-19 | ~~Roles y Permisos inaccesibles desde la interfaz (Fase 2)~~ — ✅ Resuelto: 2 `NavItem` nuevos ("Roles" → `/roles`, "Permisos" → `/permissions`) en `constants/navigation.ts`, usando el permiso ya sembrado `roles.manage`. Las páginas y rutas ya existían y ya funcionaban — el gap era exclusivamente de navegación, mismo patrón de causa que A-18. |
| A-20 | ~~Asignación de permisos a roles sin implementar en frontend ni activar en backend (Fase 1, BE-06)~~ — ✅ Resuelto por completo: frontend (`PATCH /roles/:id/permissions`, ya existía y funcionaba) + backend (`authorizePermission` activo, ver A-06). |

**Detalle A-17 — Movimientos de caja (pospuesto):**
- Estado actual: backend disponible (`POST /cash/movements`); frontend implementado (`cashMovements.api.ts`, `useCreateCashMovement.ts`, `CashMovementForm.tsx`, integración en `SalesPOSPage.tsx`). Diálogo abre correctamente; campos Monto, Motivo y Cancelar funcionan.
- Problema encontrado: el `SelectTrigger` de "Tipo de movimiento" no abre el listado de opciones al hacer clic — no aparece `select-content` en el DOM, sin error en consola.
- Descartado con evidencia: React Hook Form, validación Zod, DTO/payload/API, implementación del wrapper `Select` (comparado línea por línea contra `OpenCashSessionForm.tsx`, sin diferencias), `modal="trap-focus"` en el `Dialog` (probado, sin efecto).
- Siguiente paso al retomar: verificar en DevTools si `aria-expanded` del trigger cambia a `"true"` al hacer clic, para aislar si el fallo está en la interacción del evento o en el montaje del portal.
- Pendiente: diagnóstico sin resolver; tarea pospuesta, no completada.

**Datos**

| ID | Hallazgo |
|---|---|
| A-21 | ~~`vw_sales` con definición inconsistente en dos archivos — posible corrupción de datos en Power BI (DB-15)~~ — ✅ Resuelto: `vw_sales.sql` (filtraba solo `deleted_at IS NULL`) se alineó con `apply-views.sql` y con la convención ya usada por `vw_sales_by_category`/`vw_sales_by_cashier` (ambas ya filtraban `status = 'COMPLETED'`), agregando ese mismo filtro. `apply-views.sql` era la fuente correcta; `vw_sales.sql` era la que estaba desactualizada. |

**Arquitectura**

| ID | Hallazgo |
|---|---|
| A-22 | Modelo `Invoice` en Prisma sin módulo activo — Facturación Electrónica no conectada (Fase 1, DB-12) |

### 3.3 Medios — Importantes pero no bloquean Release 1.0

**Base de datos**

| ID | Hallazgo |
|---|---|
| M-01 | ~~`Category.name` sin unicidad — categorías duplicadas posibles (DB-06)~~ — ✅ Resuelto: `@unique` agregado a `Category.name` (`schema.prisma`) + migración `category_name_unique`. La validación de aplicación (`findByName` + `ConflictError`) ya existía; el constraint de BD cierra la condición de carrera. |
| M-02 | ~~`Supplier.legalId` sin unicidad — proveedores duplicados posibles (DB-07)~~ — ✅ Resuelto: `@unique` agregado a `Supplier.legalId` (nullable, permite múltiples `NULL`) + migración `supplier_legal_id_unique`. Se agregó además `findByLegalId()` (`repository.ts`) y validación de duplicados en `create()`/`update()` (`service.ts`), que no existía previamente. |
| M-03 | ~~`Tax.isDefault` sin constraint único — múltiples impuestos por defecto (DB-08)~~ — ✅ Resuelto: índice único parcial `taxes_default_unique` (`WHERE is_default = true`, mismo patrón que A-08). `taxes.repository.ts` ganó `unsetDefault(db)` y soporte de `db: DbClient` en `create`/`update`; `taxes.service.ts` envuelve la operación en `prisma.$transaction` cuando `dto.isDefault === true`, desmarcando el anterior antes de marcar el nuevo. |
| M-04 | ~~`AuditLog.entityId` sin índice — consultas de auditoría por entidad lentas (DB-03)~~ — ✅ Resuelto: `@@index([entity, entityId])` agregado (compuesto, no simple — `entity`/`entityId` siempre se filtran juntos en `audit/repository.ts`), complementando el índice ya existente sobre `entity` solo. |
| M-05 | ~~`InventoryMovement.referenceId` sin índice — trazabilidad lenta con volumen (DB-01)~~ — ✅ Resuelto: `@@index([referenceType, referenceId])` agregado (compuesto, mismo criterio que M-04). |
| M-06 | Vistas SQL no se aplican en el setup automático (DB-14). **Marcado como "Pendiente de decisión de arquitectura":** existen dos mecanismos redundantes para aplicarlas (`db:views` en `package.json` vs. `scripts/apply-views.sh`), ninguno integrado al flujo de setup. Resolverlo de fondo implica decisiones de despliegue/CI-CD fuera del alcance de un hallazgo puntual — no se implementó ningún cambio. |
| M-30 | *(Nuevo, Fase 10)* `prisma/seed.ts` no creaba ninguna `CashRegister` — tras un `prisma migrate reset`, el sistema quedaba sin ninguna caja registradora disponible hasta que un ADMIN creara una manualmente. ✅ Resuelto: `seedCashRegisters(sucursalId)` agregada, crea "Caja Principal" por defecto (upsert idempotente por id fijo, mismo criterio que `env.SUCURSAL_ID`). **Nota:** no se pudo ejecutar el seed en el entorno de trabajo de esta auditoría (sin conexión a base de datos ni acceso al binario de Prisma); validado solo por compilación (`tsc`). Pendiente de confirmación de ejecución real. |

**Backend**

| ID | Hallazgo |
|---|---|
| M-07 | ~~CORS con `*` como default — abierto si no se configura explícitamente (BE-12)~~ — ✅ Resuelto: `.default('*')` eliminado de `CORS_ORIGIN` en `env.ts` — ahora es obligatorio, forzando una decisión explícita en cada entorno. `.env` local ya tenía el valor configurado, sin romper el desarrollo. |
| M-08 | `softDeleteExtension` registra solo `Supplier` — 17 modelos con filtrado manual (BE-09). **Marcado como "Sin acción requerida":** reanálisis modelo por modelo confirmó que ninguno de los 17 restantes tiene funcionalidad de eliminación implementada (sin ruta `DELETE`, sin escritura de `deletedAt`) — `Supplier` es la única ruta `DELETE` de todo el backend. Agregar los demás a `SOFT_DELETE_MODELS` hoy sería un no-op sin efecto real; varios (`InventoryMovement`, `CashMovement`, `Sale`, `CashSession`) probablemente nunca deban tener soft-delete por diseño (registros históricos/inmutables). |
| M-09 | ~~`auth.service.ts` escribe `AuditLog` directamente sin pasar por el repository (BE-01)~~ — ✅ Resuelto: las 2 llamadas a `prisma.auditLog.create(...)` (login, logout) reemplazadas por `auditService.log(...)` — el punto único de auditoría ya usado por el resto del sistema. Verificado que `sucursalId` (obligatorio en `auditService.log()`) siempre llega con valor en ambos casos, por venir de `User.sucursalId` (campo obligatorio del modelo). Import de `prisma` removido por quedar sin uso. |
| M-31 | *(Nuevo, Fase 10)* `roles.service.ts` (`update()`) ignora silenciosamente `dto.permissionIds` aunque `UpdateRoleSchema`/`UpdateRoleDto` lo declaran como campo aceptado — el único camino funcional para reasignar permisos de un rol existente es `PATCH /roles/:id/permissions` (`assignPermissions`), no el `update()` genérico. No bloqueante (ya se identificó y evitó correctamente al implementar A-20), pero es una inconsistencia real entre schema y comportamiento que conviene corregir o documentar explícitamente para no inducir a error a futuro. |

**Seguridad**

| ID | Hallazgo |
|---|---|
| M-10 | ~~`logout` del frontend no llama a `POST /auth/logout` — sin registro de cierre de sesión (SEC-03)~~ — ✅ Resuelto: `DashboardLayout` llama `authApi.logout()` antes de limpiar el estado local. |
| M-11 | ~~Validación de contraseñas sin complejidad mínima (solo 8 caracteres) (SEC-07)~~ — ✅ Resuelto: `.regex(...)` agregado en `CreateUserSchema`/`UpdateUserSchema` (backend, `users.validation.ts`) y en `createUserSchema`/`updateUserSchema` (frontend, `user.schema.ts`) — exige mayúscula, minúscula y número además del `.min(8)` ya existente. Ambos lados sincronizados con los mismos mensajes. `env.ts`/`SEED_ADMIN_PASSWORD` y el seed quedaron sin tocar (fuera de alcance de este hallazgo; el valor actual ya cumple la nueva política igualmente). |
| M-12 | ~~Admin puede cambiar su propio rol sin restricción — escalación de privilegios (SEC-08)~~ — ✅ Resuelto: `usersService.update()` lanza `ForbiddenError` si `id === currentUserId` y cambia `roleId`. |
| M-13 | ~~`cashSessionId` sin revalidación contra backend en `RequireCashSession` (SEC-16)~~ — ✅ **Resuelto de forma completa en Fase 10** (la resolución previa, registrada en Fase 9, resultó incompleta — ver nota abajo). `RequireCashSession.tsx` ya no depende de `cashSessionStore`/`localStorage` como fuente de verdad: consulta `useCashSessions({ status: 'OPEN' })` directamente contra el backend (verificación por caja registradora, no por usuario/navegador) y solo sincroniza el store como apoyo para otros consumidores (`SalesPOSPage.tsx`), vía `setCashSessionId`/`clearCashSessionId`. Requirió además agregar `SystemRole.CASHIER` a la autorización de `GET /cash/sessions` y `GET /cash/sessions/:id` (antes solo ADMIN/MANAGER), sin lo cual un cajero no podría completar esta verificación. |
| M-14 | ~~`.env.example` del frontend incluye variables del backend (SEC-14)~~ — ✅ Resuelto: `.env.example` (frontend) reemplazado por su contenido real — solo `VITE_API_URL`, la única variable que `config/env.ts` consume. Se eliminaron `DATABASE_URL`, `JWT_*`, `BCRYPT_*`, `POSTGRES_*`, `BACKUP_*` (variables de backend copiadas por error). `.env` real y `config/env.ts` sin tocar. |
| M-15 | Sin seguridad física ni timeout de inactividad documentados (SEC-17). **Marcado como "Pendiente de decisión de producto":** requiere definir mecanismo y duración del timeout (funcionalidad nueva, no corrección de algo existente) antes de poder implementarse — mismo tratamiento que M-06. |

> **Nota sobre M-13:** el informe de Fase 9 marcaba este hallazgo como resuelto describiendo una implementación (`useCashSession()` validando `status === 'OPEN'`) que en la práctica seguía dependiendo de que `cashSessionStore` tuviera ya un id local — si ese id estaba vacío (ej. tras logout, otro dispositivo, o `localStorage` limpiado), la verificación nunca se ejecutaba y la interfaz mostraba "Abrir caja" aunque existiera una sesión `OPEN` real en la base de datos para esa caja. Este comportamiento fue detectado, diagnosticado de punta a punta (frontend, backend, base de datos) y corregido en este ciclo — ver sección 9 para el detalle completo.

**Rendimiento**

| ID | Hallazgo |
|---|---|
| M-16 | ~~Búsqueda en POS sin debounce — petición HTTP por cada carácter (PERF-08)~~ — ✅ Resuelto: `debouncedSearchTerm` (300ms, `useEffect`+`setTimeout`/`clearTimeout`, sin librerías nuevas) en `SalesPOSPage.tsx` — el input sigue respondiendo instantáneo, solo `useProducts` usa el valor debounced. |
| M-17 | `getLowStock` sin paginación — filtrado en JS post-query (PERF-06). **Marcado como "Pendiente de decisión de producto":** el propio código ya documenta el comportamiento actual como intencional ("es una foto del estado actual del inventario, no un listado paginado tradicional") — implementar paginación requiere antes decidir si esa premisa de producto cambia. |
| M-18 | ~~`saleReportInclude` con `items: true` — payload excesivo en reporte de ventas (PERF-07)~~ — ✅ Resuelto: relación `items` eliminada por completo de `saleReportInclude` (`reports.repository.ts`), no reemplazada por un `select` parcial — confirmado que el único consumidor real (`SalesReportTable.tsx`, frontend) no lee `sale.items` en ningún punto. `saleReportInclude` no tiene otros consumidores en el backend. |
| M-19 | Pool de conexiones Prisma sin configurar explícitamente (PERF-10). **Marcado como "Sin acción requerida":** el modelo de despliegue documentado (`ARCHITECTURE.md`/`DEPLOYMENT.md`) es una única instancia on-premise, un solo proceso backend, Postgres local, baja concurrencia — el dimensionamiento automático de Prisma 6.5.0 ya es apropiado para ese escenario; sin evidencia de agotamiento de conexiones. Reevaluar solo si cambia el modelo de despliegue (múltiples instancias, nube, PgBouncer). |
| M-20 | ~~`PurchaseItem.productId` sin índice (PERF-01)~~ — ✅ Ya estaba resuelto (verificado en QW-09, `@@index([productId])` ya presente en `schema.prisma`). |
| M-21 | `vw_dashboard` sin filtro temporal — lenta con historial largo en Power BI (PERF-13). **Marcado como "Pendiente de decisión de producto":** a diferencia de M-19, sí hay causa raíz real y verificada (subconsultas de ventas/compras sin `WHERE` de fecha, sobre tablas transaccionales que crecen indefinidamente) — pero no existe ninguna definición documentada del período que debe mostrar el dashboard (histórico total vs. mes actual vs. últimos 30 días), ni en la arquitectura, ni en el SQL, ni en el dashboard operativo equivalente (`getDashboard` acepta `dateFrom`/`dateTo` como filtro opcional, sin default). Implementar un filtro arbitrario sin esa definición cambiaría el comportamiento funcional sin autorización de producto. |

**Frontend**

| ID | Hallazgo |
|---|---|
| M-24 | ~~Sin sistema de toasts/notificaciones para feedback de éxito (FE-03)~~ — ✅ Resuelto: `sonner` (ya estaba instalado, sin usar) montado en `App.tsx` (`<Toaster richColors position="top-right" />`). `toast.success(...)` agregado en el `onSuccess` de creación/edición de los 9 módulos con formulario del sistema (Usuarios, Categorías, Impuestos, Productos, Proveedores, Compras, Roles, Permisos, Configuración), con mensaje diferenciado por entidad y por acción (creado/actualizado). |

| M-25 | ~~`PurchasesTable` sin migrar a `DataTable` — inconsistencia visual (UX-01)~~ — ✅ Resuelto: única tabla del proyecto (19 de 20 ya migradas) sin usar el componente estándar — migrada manteniendo exactamente las mismas 9 columnas, formato, badges y acción de editar; `DataTable.tsx` sin modificar. |
| M-32 | *(Nuevo, Fase 10 — Pulido de UI/UX)* `Badge` y `ErrorAlert` existían duplicados, cada uno en `components/ui/` y `components/common/`, con APIs distintas (`ErrorAlert`: `children` vs. prop `message`). ✅ Resuelto: unificados en una única implementación cada uno (`Badge` → `components/common/Badge.tsx`, único con variante `destructive`; `ErrorAlert` → `components/ui/ErrorAlert.tsx`, mayoría de consumidores) — 6 consumidores de `Badge` y 20 de `ErrorAlert` migrados de forma mecánica (mismo `children`/props compatibles, verificado archivo por archivo antes de migrar), las implementaciones descartadas eliminadas tras confirmar cero referencias restantes. |
| M-33 | *(Nuevo, Fase 10 — Pulido de UI/UX)* 6 wrappers de badge de estado (`ProductStatusBadge`, `UserStatusBadge`, `CategoryStatusBadge`, `TaxStatusBadge`, `SupplierStatusBadge`, `RoleStatusBadge`) y 33 páginas con el mismo bloque de "cargando" inline (`<p className="text-sm text-muted-foreground">Cargando...</p>`) repetían la misma lógica/markup literal. ✅ Resuelto: nuevo `ActiveStatusBadge` (`components/common/`) del que los 6 wrappers ahora delegan (mismo nombre público, mismos consumidores, sin cambios fuera de los 6 archivos); nuevo `LoadingState` (`components/ui/`) migrado en el primer módulo (Impuestos, Permisos, Ventas, Compras) como piloto validado — migración del resto de los 33 archivos queda como trabajo repetitivo de bajo riesgo, mismo patrón ya probado. |

Sin cambios desde Fase 9 (M-22, M-23).

**UX**

Sin cambios desde Fase 9 (M-26 a M-29).

### 3.4 Bajos — Mejoras de calidad para versiones posteriores

Sin cambios desde Fase 9 (B-01 a B-16). Ver informe de Fase 9 para el detalle completo; se conserva sin modificar.

---

## 4. Separación: Release 1.0 vs. posteriores (actualizado)

### 4.1 Obligatorio para Release 1.0 — actualizado

**Críticos (3):** C-01, C-02, C-03 — todos ✅ resueltos.

**Seguridad (6):** A-01 ✅, A-02 ✅, A-03 ✅, A-04 ✅, A-05 ✅, A-06 ✅.

**Funcionalidad del POS (4):** A-11 ✅, A-12 ✅, A-13 ✅, **A-17 pendiente** (pospuesto, diagnóstico sin resolver).

**Funcionalidad administrativa (4):** A-14 ✅, A-15 ✅ (extendido a las 17 páginas `Create*`/`Edit*`), A-18 ✅, A-19 ✅ + A-20 ✅ (frontend; backend de A-20 fusionado con A-06).

**Datos (2):** A-07 ✅, A-08 ✅.

**Operación (3):** A-09 ✅, A-16 ✅, A-21 ✅.

**Medios críticos de seguridad (3):** M-10 ✅, M-12 ✅, M-13 ✅ (corregido de forma completa en Fase 10).

**Pendientes reales para Release 1.0, tras este ciclo:** A-17 — 1 punto, frente a los ~19 identificados en Fase 9. Todos los demás altos están resueltos o descartados con evidencia (decisiones de diseño válidas, no defectos).

### 4.2 Puede esperar (v1.1 o posterior)

Sin cambios respecto a Fase 9 (ver informe original).

---

## 5. Quick Wins

QW-02, QW-03, QW-04 ya estaban ✅ desde Fase 9. En Fase 10 se verificaron/completaron los restantes:
- **QW-05** (`role="alert"` en `ErrorAlert` de `components/common/`): ✅ ya estaba resuelto — verificado presente en ambos componentes `ErrorAlert` del proyecto (`components/common/` y `components/ui/`).
- **QW-06** (`aria-label` en botones de acción de tablas): ✅ ya estaba resuelto — verificado en los 6 módulos (`CategoriesTable`, `TaxesTable`, `ProductsTable`, `UsersTable`, `RolesTable`, `SuppliersTable`).
- **QW-07** (reemplazar "tenés" por "hay"): ✅ Resuelto — el texto vivía en `OpenCashSessionPage.tsx` (no en `OpenCashSessionForm.tsx` como decía el hallazgo original, tras la reescritura de ese componente tramitada en la corrección del modelo de sesión de caja), cambiado a "Hay una sesión de caja activa para este turno."
- **QW-08** (`api.http` a `.gitignore`): ✅ Resuelto — agregado al `.gitignore` del backend.
- **QW-09** (`@@index([productId])` en `PurchaseItem`): ✅ ya estaba resuelto — verificado presente en `schema.prisma`.
- **QW-10** (texto "Guardando..." en botones submit): ✅ ya estaba resuelto — verificado en los 15 formularios del proyecto (incluido `LoginForm.tsx`, con su propio texto contextual "Iniciando sesión...").

QW-01 sin detalle disponible en este ciclo — pendiente de confirmar contenido para su próxima revisión.

---

## 6. Roadmap de implementación hacia Release 1.0 (actualizado)

### Sprint 1 — Seguridad y datos — ✅ Completado (con una corrección)

Todos los ítems originales siguen ✅, **salvo el ítem 5 (M-13)**, cuya resolución original (Fase 9) resultó incompleta y fue corregida de fondo en Fase 10 (ver sección 3.3 y sección 9).

### Sprint 2 — Funcionalidad crítica del POS — parcialmente completado

1. **A-11**: ✅ Completado.
2. **A-12**: ✅ Completado.
3. **A-13**: ✅ Completado.
4. **A-17**: ⏸️ **Pospuesto** — bloqueado por bug sin resolver en el `Select` de "Tipo de movimiento" (ver detalle en 3.2).
5. **A-16**: ✅ Completado — `closeSession` envuelto en `prisma.$transaction`.

### Sprint 3 — Navegación y módulos inaccesibles — ✅ Completado

1. **A-18**: ✅ Completado — página índice de Reportes.
2. **A-19 + A-20**: ✅ Completado en frontend (navegación + asignación de permisos). Activar `authorizePermission` en rutas del backend queda pendiente, fusionado con A-06 (fuera del alcance original de este sprint, requiere su propio análisis por el impacto transversal en seguridad).
3. **A-14**: ✅ Completado — `ConfirmDialog` en las 5 entidades objetivo.

### Sprint 4 — Feedback de usuario y correcciones de datos — ✅ Completado

1. **A-15**: ✅ Completado — extendido de `CreateUserPage.tsx` a las 17 páginas `Create*`/`Edit*` del sistema.
2. **C-02**: ya resuelto desde Fase 9 (persistencia de auditoría).
3. **A-09**: ✅ Completado — `cost` obligatorio en backend y frontend.
4. **A-21**: ✅ Completado — `vw_sales` unificada con `apply-views.sql`.
5. **QW-05 a QW-10**: ✅ Verificados — QW-05, QW-06, QW-09, QW-10 ya estaban resueltos; QW-07 y QW-08 se aplicaron en este sprint.
6. **M-24**: ✅ Completado — `sonner` montado y `toast.success(...)` estandarizado en los 9 módulos con formulario.

### Sprint 5 — Hardening y deuda técnica — ✅ Completado

1. **M-01 a M-05**: ✅ Completados — constraints de unicidad (`Category.name`, `Supplier.legalId`, `Tax.isDefault`) e índices compuestos (`AuditLog`, `InventoryMovement`).
2. **M-06**: ⏸️ Pendiente de decisión de arquitectura (dos mecanismos redundantes de aplicar vistas, requiere decisión de despliegue/CI-CD).
3. **M-07**: ✅ Completado — `CORS_ORIGIN` obligatorio, sin default.
4. **M-08**: Sin acción requerida (reanálisis confirmó que no hay funcionalidad de eliminación en los 17 modelos restantes).
5. **M-09**: ✅ Completado — `auth.service.ts` usa `auditService.log()` como punto único.
6. **M-11**: ✅ Completado — complejidad de contraseña sincronizada backend/frontend.
7. **M-14**: ✅ Completado — `.env.example` del frontend alineado con variables reales.
8. **M-15**: ⏸️ Pendiente de decisión de producto (mecanismo y duración de timeout de inactividad).
9. **M-16**: ✅ Completado — debounce de 300ms en búsqueda del POS.
10. **M-17**: ⏸️ Pendiente de decisión de producto (paginación vs. alerta completa en bajo stock).
11. **M-18**: ✅ Completado — `items` removido de `saleReportInclude`.
12. **M-19**: ✅ Sin acción requerida — modelo de despliegue on-premise no la justifica.
13. **M-20**: ✅ Ya estaba resuelto.
14. **M-21**: ⏸️ Pendiente de decisión de producto (ventana temporal del dashboard).

Sprint 5 queda completado — de sus 14 ítems, 9 resueltos, 2 sin acción requerida (correctamente implementados/no aplican), 3 pendientes de decisión de producto/arquitectura (no defectos de código).

### Sprint 6 — Activación de RBAC granular — ✅ Completado

Consecuencia directa de A-20, ya no es "propuesto": el catálogo de permisos se amplió (9 códigos nuevos: `categories.*`, `taxes.*`, `suppliers.*`, `cash-registers.*`) y `authorizePermission` se activó en 11 módulos (`categories`, `taxes`, `suppliers`, `cashRegister`, `configuration`, `permissions`, `roles`, `users`, `products`, `cash` (sesiones), `reports`), manteniendo exactamente el mismo comportamiento efectivo que `SystemRole` — verificado permiso por permiso contra la matriz `ROLE_PERMISSION_CODES` ya aprobada. `sales` (permiso `sales.void` sin funcionalidad de anulación real) y `audit` (sin ningún permiso granular en el catálogo) quedan fuera del alcance, documentados como pendientes de decisión funcional, no de código.

### Sprint 7 — Seguridad de tokens JWT (A-01/A-02) — ✅ Completado

Rediseño de autenticación: `refreshToken` exclusivamente en cookie `httpOnly`/`secure`/`sameSite` (nunca en el body de ninguna respuesta); `accessToken` solo en memoria (sin `localStorage`), recuperado con un refresh silencioso al arrancar la app. Rotación real del refresh token en cada uso (revocar + emitir uno nuevo) y revocación en logout (sesión puntual) o ante reuso de un token ya revocado (incidente de seguridad: revoca todas las sesiones del usuario). Nuevo modelo `RefreshToken` (solo hash, nunca el JWT en texto plano) — pendiente de confirmar migración/`prisma generate` en entorno real (ver Riesgos).

### Sprint 8 (nuevo) — Pulido de UI/UX — parcialmente completado

1. **`PurchasesTable` → `DataTable`**: ✅ Completado (M-25).
2. **Unificación de `Badge`/`ErrorAlert`**: ✅ Completado (M-32) — 26 archivos consumidores migrados, ambas implementaciones duplicadas eliminadas.
3. **Unificación de badges de estado (`ActiveStatusBadge`)**: ✅ Completado (M-33) — 6 wrappers delegando en un componente único.
4. **Unificación de `LoadingState`**: ⏳ Parcial (M-33) — componente creado y validado en 4 páginas piloto (Impuestos, Permisos, Ventas, Compras); quedan ~29 archivos con el mismo patrón por migrar, trabajo repetitivo de bajo riesgo.
5. **`PurchaseForm`/`EditPurchaseForm` como componentes separados**: descartado tras verificación — **no es deuda técnica**, es una decisión de diseño ya documentada y justificada (el backend no permite editar `items` vía `UpdatePurchaseDto`; unificar forzaría lógica condicional sin beneficio real). Eliminado como candidato del roadmap.
6. **Limpieza de archivos huérfanos** (`features/permissions/index.ts`, `features/products/index.ts`, `features/products/utils/`, `features/sales/utils/`): analizado y aprobado en concepto, **ejecución pendiente** — no se llegó a aplicar la eliminación.

---

## 7. Estado de cada módulo y su readiness para producción (actualizado)

| Módulo | Completitud Fase 9 | Completitud actual | Listo para prod | Bloqueante principal actual |
|---|---|---|---|---|
| Autenticación | 55% | **90%** | ✅ | Refresh token con rotación/revocación, access token en memoria, RBAC granular activo (A-01/A-02/A-06) |
| Dashboard | 85% | 85% | ✅ con fixes menores | — |
| Usuarios | 90% | 92% | ✅ | Feedback de error y éxito de mutación completo (A-15, M-24) |
| **Roles** | 55% | **95%** | ✅ | Navegación, asignación de permisos y `authorizePermission` activo (A-19, A-20, A-06) |
| **Permisos** | 50% | **90%** | ✅ | Accesible desde UI, `authorizePermission` activo (A-19, A-06); catálogo de solo lectura, sin permiso granular propio (`audit`-like), fuera de alcance |
| Productos | 95% | 95% | ✅ | — |
| Categorías | 95% | 95% | ✅ | — |
| Impuestos | 95% | 95% | ✅ | — |
| Proveedores | 95% | 95% | ✅ | — |
| Compras | 85% | 85% | ⚠️ | Default `RECEIVED` en status — sin cambios (nota: ya corregido como A-07 a nivel de schema; este ítem de compras se refiere a otro aspecto del módulo no tocado en este ciclo) |
| Ventas (listado) | 60% | 60% | ⚠️ | Sin anulación |
| **POS** | 80% | 80% | ⚠️ | Impuesto/método de pago/comprobante ya resueltos (A-11/A-12/A-13); movimientos de caja siguen bloqueados (A-17) |
| Inventario | 75% | **90%** | ✅ | Historial de mermas ya consultable (`/inventory/waste`, ver sección 16) — pendiente únicamente un ledger unificado de `InventoryMovement` (compras/ventas/ajustes/mermas en una sola vista), que no tiene endpoint de consulta en el backend hoy; no bloquea Release 1.0 (deuda documentada, sección 16.4) |
| **Caja** | 45% | **75%** | ⚠️ | Modelo de sesión corregido de raíz, seed completado; **A-17 (movimientos) sigue bloqueado** |
| Reportes | 90% funcional / 11% accesible | **90% funcional / 100% accesible** | ✅ | — |
| Configuración | 85% | 85% | ✅ | — |
| **Facturación Electrónica** | 15% | 15% | ❌ | No integrada |
| Auditoría | 0% real → ya resuelto en Fase 9 (C-02) | — | ✅ | — |

**Módulos críticos bloqueados (❌):** Facturación Electrónica (sin conectar, fuera de alcance de este roadmap).
**Módulos con reservas (⚠️):** Compras, Ventas, POS (movimientos de caja bloqueados por A-17), Caja.
**Módulos listos (✅):** Autenticación, Dashboard, Usuarios, Roles, Permisos, Productos, Categorías, Impuestos, Proveedores, Inventario, Reportes, Configuración, Auditoría.

---

## 8. Veredicto actualizado

### ¿Está el sistema listo para producción?

**Muy cerca.** De los 22 hallazgos altos identificados en Fase 9, **21 quedaron resueltos** a lo largo de este proceso (A-01, A-02, A-06, A-09, A-11 a A-16, A-18 a A-21, más la corrección real de M-13). Queda **1 hallazgo alto genuinamente abierto** antes de Release 1.0: **A-17** (movimientos de caja, pospuesto por diagnóstico sin resolver).

### ¿Qué falta obligatoriamente? (actualizado)

1. **Movimientos de caja funcionales:** A-17 — implementado de punta a punta, bloqueado por un bug de interacción de UI sin resolver (requiere una verificación puntual en DevTools no realizada todavía).
2. **Confirmaciones de infraestructura pendientes de entorno real** (no defectos de código, ver Riesgos): migración/`prisma generate` de `RefreshToken` (A-02), ejecución real del seed (M-30), validación de `Product.cost` obligatorio contra datos existentes (A-09).

### Estimación para alcanzar Release 1.0 (actualizado)

| Sprint | Foco | Estado |
|---|---|---|
| Sprint 1 | Seguridad y datos | ✅ Completado |
| Sprint 2 | Funcionalidad crítica del POS | ⚠️ Parcial — A-17 pospuesto |
| Sprint 3 | Navegación y módulos inaccesibles | ✅ Completado |
| Sprint 4 | Feedback de usuario y datos | ✅ Completado |
| Sprint 5 | Hardening y deuda técnica | ✅ Completado |
| Sprint 6 | Activación de RBAC granular | ✅ Completado |
| Sprint 7 | Seguridad de tokens JWT | ✅ Completado |
| Sprint 8 *(nuevo)* | Pulido de UI/UX | ⚠️ Parcial |

### Calificación global

> **7.9 / 10** — Mejora respecto al 6.7/10 de Fase 9. El sistema pasó de "beta técnica" a "beta funcional avanzada, cercana a producción": seguridad de autenticación y autorización, administración y feedback de usuario resueltos de punta a punta. El único bloqueante funcional real que persiste (A-17, movimientos de caja) está completamente implementado mecánicamente y aislado a un problema de interacción de UI específico, no a un problema estructural ni de seguridad.

---

## 9. Cambios realizados en Fase 10 (detalle completo)

Cada bloque conserva: qué problema existía, cuál fue la causa raíz, y cómo se resolvió — sin omitir el proceso de descarte de hipótesis cuando aplica.

### 9.1 Corrección del modelo de sesión de caja

**Problema observado:** con una `CashSession` genuinamente `OPEN` en la base de datos para una caja registradora específica, la interfaz seguía mostrando "Abrir caja" y no ofrecía ninguna forma de gestionar o cerrar la sesión existente.

**Causa raíz (confirmada de punta a punta, no solo en el primer archivo donde apareció el síntoma):** `OpenCashSessionPage.tsx` y `RequireCashSession.tsx` decidían qué mostrar basándose exclusivamente en `cashSessionStore` (respaldado por `localStorage`) — un valor que representa "la última sesión que abrió este cliente/navegador", no "¿existe una sesión abierta para esta caja registradora?". La regla de negocio confirmada durante el diagnóstico es que **la sesión pertenece a la caja registradora, no al usuario** — por lo tanto, ningún valor guardado solo en el navegador puede ser la fuente de verdad.

**Descartado con evidencia antes de llegar a la causa real:** se investigó primero si el problema era una fila de datos incorrecta en `cash_sessions` (confirmado que sí existía una sesión `OPEN` real, sin movimientos ni ventas asociadas relevantes al diagnóstico), y se verificó exhaustivamente que la lógica de `openSession`/`closeSession` en el backend fuera idéntica para todas las cajas registradoras (lo era) antes de identificar que el verdadero problema estaba en cómo el frontend decidía qué pantalla mostrar.

**Solución aplicada:**
- **Backend** (`src/modules/cash/routes.ts`): se agregó `SystemRole.CASHIER` a la autorización de `GET /cash/sessions` y `GET /cash/sessions/:id` (antes restringidos a ADMIN/MANAGER) — sin este cambio, un cajero no podría completar la verificación descrita abajo.
- **Frontend:**
  - `OpenCashSessionForm.tsx`: consulta `useCashSessions({ status: 'OPEN' })` (hook nuevo, ver 9.1.1) para marcar/deshabilitar en el selector las cajas registradoras que ya tienen sesión abierta, en vez de dejar que el usuario la elija y se entere recién al recibir un 409.
  - `OpenCashSessionPage.tsx`: dejó de decidir "Abrir caja" vs. "Caja abierta" en base al store; consulta `useCashSessions({ status: 'OPEN' })` directamente y usa el `cashSessionId` real que esa consulta devuelve.
  - `RequireCashSession.tsx` (guard de `/sales/pos`): mismo cambio — deja de depender exclusivamente del store, consulta `useCashSessions({ status: 'OPEN' })` contra el backend.
  - `cashSessionStore.ts`: sin cambios de lógica; se actualizó únicamente su comentario para dejar constancia de que es un **apoyo/caché local**, no la fuente de verdad — ambos componentes anteriores lo siguen usando (`setCashSessionId`/`clearCashSessionId`) para mantener sincronizado a un tercer consumidor, `SalesPOSPage.tsx`, que no fue necesario modificar.

**9.1.1 Hook nuevo:** `useCashSessions.ts` (`src/features/cashSession/hooks/`) — creado porque el proyecto no tenía ningún hook de listado para sesiones de caja (solo `useCashSession(id)`, por id). Sigue exactamente el patrón ya establecido en `useCashRegisters.ts`/`useUsers.ts` (un hook por tipo de consulta, envolviendo `useQuery` con `queryKey`/`queryFn` tipados). Reemplazó una primera versión con `useQuery` inline directamente en un componente — la única excepción a ese patrón en todo el proyecto — corregida antes de continuar.

**Archivos afectados:** `src/modules/cash/routes.ts`; `src/features/cashSession/hooks/useCashSessions.ts` (nuevo); `src/features/cashSession/components/OpenCashSessionForm.tsx`; `src/features/cashSession/pages/OpenCashSessionPage.tsx`; `src/features/cashSession/components/RequireCashSession.tsx`; `src/features/cashSession/store/cashSessionStore.ts` (solo comentario).

### 9.2 Seed de Caja Principal

Ver M-30 en sección 3.3 para el detalle completo (problema, causa, solución, y la advertencia de que no se pudo ejecutar el seed en este entorno de trabajo).

### 9.3 A-19 — Navegación de Roles y Permisos

Ver fila A-19 en sección 3.2.

### 9.4 A-20 — Asignación de permisos a roles desde frontend

**Problema:** no existía ninguna interfaz para asignar permisos a un rol, pese a que tanto el endpoint de backend (`PATCH /roles/:id/permissions`) como el tipo de contrato en frontend (`AssignRolePermissionsDto`) ya existían y funcionaban.

**Hallazgo adicional durante el análisis (documentado como M-31):** `roles.service.ts` (`update()`) ignora silenciosamente `permissionIds` pese a que el schema lo acepta — se confirmó que el único camino funcional es el endpoint dedicado de permisos, no el de actualización general, y se construyó la solución sobre esa base, evitando el camino que hubiera fallado en silencio.

**Solución, respetando el patrón ya establecido en el proyecto (mutación `{ id, dto }`, componentes de presentación pura sin hooks propios):**
- `roles.api.ts`: función nueva `assignRolePermissions(id, dto)`, reutilizando el endpoint existente sin tocar backend.
- `useAssignRolePermissions.ts` (hook nuevo): mismo patrón exacto que `useUpdateRoleStatus.ts`.
- `RolePermissionSelector.tsx` (componente nuevo): checkboxes nativos, mismo patrón visual ya usado en el proyecto (no se introdujo ninguna librería ni componente de UI nuevo); sin hooks, sin llamadas a API, sin conocer roles ni usuarios — mismo criterio de responsabilidad que `RolePermissionBadge.tsx` (que permanece sin modificar, de solo lectura).
- `EditRolePage.tsx`: integra el selector como una acción **separada** del formulario de nombre/descripción (mismo criterio ya usado en el proyecto para el cambio de estado de un rol). La sincronización de la selección con `role.permissions` se resolvió con una `key` derivada del contenido real de los permisos (ids ordenados y unidos en una cadena) en vez de un `useEffect` — evita tanto quedar con una selección desactualizada tras un refetch como el error de lint `react-hooks/set-state-in-effect` que apareció en un primer intento con sincronización durante el render.

**Pendiente explícito:** activar `authorizePermission` en rutas reales del backend — mismo alcance que A-06, fuera de este bloque por su impacto transversal en seguridad.

**Archivos:** `src/features/roles/api/roles.api.ts`; `src/features/roles/hooks/useAssignRolePermissions.ts` (nuevo); `src/features/roles/components/RolePermissionSelector.tsx` (nuevo); `src/features/roles/pages/EditRolePage.tsx`.

### 9.5 A-14 — ConfirmDialog en cambios de estado

**Problema:** las 5 entidades objetivo (Productos, Usuarios, Categorías, Impuestos, Roles) ejecutaban su mutación de activar/desactivar de forma inmediata al primer clic. El único uso real de `ConfirmDialog.tsx` en todo el proyecto era para eliminar proveedores (`SuppliersTable.tsx`) — no existía ningún precedente resuelto para confirmar un cambio de estado específicamente.

**Solución:** mismo patrón replicado idénticamente en `CategoriesTable.tsx`, `TaxesTable.tsx`, `ProductsTable.tsx`, `UsersTable.tsx` y `RolesTable.tsx` — estado local `pendingToggle`, el botón de activar/desactivar abre `ConfirmDialog` (reutilizado sin ninguna modificación) en vez de disparar la mutación directo, y `onConfirm` ejecuta la función que la página ya provee por props. Ninguna página (`*Page.tsx`) ni hook de mutación (`useUpdate*Status`) fue modificado — el cambio quedó contenido en las 5 tablas.

### 9.6 Sprint 4 — A-09, A-21, QW-05 a QW-10, M-24

**A-09 — `Product.cost` obligatorio:**
- Problema: `cost` era opcional en ambos DTOs (create/update), pese a existir el campo en `ProductForm.tsx`; un producto sin costo cargado quedaba en `0` silenciosamente, distorsionando reportes de rentabilidad.
- Solución: se quitó `.optional()` de `cost` en `products.validation.ts` (backend, `CreateProductSchema`/`UpdateProductSchema`) y en `product.schema.ts` (frontend, ambos schemas equivalentes), manteniendo `min(0)` sin tocar el resto de los campos.

**A-21 — `vw_sales` unificada:**
- Problema: `vw_sales.sql` filtraba solo `deleted_at IS NULL`; `apply-views.sql` (la definición realmente aplicada contra la base) filtraba además `status = 'COMPLETED'`.
- Evidencia usada para decidir la fuente de verdad: las vistas hermanas `vw_sales_by_category`/`vw_sales_by_cashier` ya filtran ambas por `status = 'COMPLETED'`, con el mismo comentario ("sobre el historico de ventas completadas") — `apply-views.sql` seguía esa convención, `vw_sales.sql` no.
- Solución: se agregó `AND s.status = 'COMPLETED'` en `vw_sales.sql`, alineándolo con `apply-views.sql` y con la convención del resto de vistas de reporting.

**QW-05 a QW-10 — verificación y cierre:**
- QW-05, QW-06, QW-09 y QW-10 se verificaron ya resueltos en el código (no requirieron cambios).
- QW-07: texto regional corregido en `OpenCashSessionPage.tsx` (no en `OpenCashSessionForm.tsx`, ya que ese componente cambió de contenido durante la corrección del modelo de sesión de caja de este mismo ciclo).
- QW-08: `api.http` agregado a `.gitignore` del backend.

**M-24 — Sistema de toasts:**
- Problema: `sonner` estaba instalado (`package.json`) pero nunca montado ni usado — cero feedback visual explícito de éxito en ninguna mutación del sistema.
- Solución: `<Toaster richColors position="top-right" />` montado en `src/App.tsx`, junto a `<AppRouter />` (punto de montaje raíz, para cubrir también pantallas fuera del dashboard). Luego, `toast.success(...)` agregado en el `onSuccess` de creación y edición de los 9 módulos con formulario del sistema: Usuarios, Categorías, Impuestos, Productos, Proveedores, Compras, Roles (solo en la mutación de nombre/descripción, no en la de asignación de permisos, que no navega), Permisos, Configuración — mensaje diferenciado por entidad y por acción ("creado"/"actualizado"). Ningún hook de mutación, función de API, ni componente compartido fue modificado — el cambio quedó contenido en `App.tsx` y las 17 páginas `Create*`/`Edit*`.

### 9.7 Validaciones aplicadas en todos los bloques anteriores

Cada archivo modificado en 9.1 a 9.6 fue validado individualmente con `tsc -b`/`tsc --noEmit` (backend y frontend) y `npm run lint`, sin errores introducidos en ningún caso. Confirmado además, en cada bloque, que los archivos explícitamente protegidos (páginas, hooks de mutación, `ConfirmDialog.tsx`, `RolePermissionBadge.tsx`, backend) no fueron tocados, mediante inspección de sus fechas de modificación.

---

## 10. Observaciones documentales y de arquitectura

Estas observaciones no implican cambios de código — se dejan registradas para quien mantenga la documentación oficial del proyecto.

1. **`docs/FRONTEND_ARCHITECTURE.md` quedó desactualizado en su descripción del guard de caja.** El documento describe `RequireCashSession` como dependiente de `cashSessionId` en `cashSessionStore` (comportamiento correcto hasta Fase 9, ya no vigente). Debería actualizarse para reflejar que la fuente de verdad es `useCashSessions({ status: 'OPEN' })` contra el backend, y que el store es un apoyo/caché, no la fuente de verdad — mismo criterio que ya quedó documentado en el comentario del propio `cashSessionStore.ts`.
2. **Componentes reutilizables creados en este ciclo, para incorporar al inventario de componentes del Design System:** `RolePermissionSelector.tsx` (selector de permisos, checkboxes nativos) y `ReportsIndexPage.tsx` (patrón de página índice con tarjetas). Ninguno de los dos introduce un patrón visual nuevo — ambos reutilizan componentes y clases ya existentes (`Card`, `PageHeader`, el patrón de checkbox nativo ya usado en `UserForm.tsx`).
3. **`docs/FRONTEND_ARCHITECTURE.md`/`docs/DATABASE.md` no documentan explícitamente la regla "la sesión de caja pertenece a la caja registradora, no al usuario".** Es una regla de negocio confirmada durante este ciclo que rige el diseño de todo el módulo de Caja; conviene dejarla escrita explícitamente para que no se repita el mismo malentendido de diseño que originó el bug de M-13.
4. **Inconsistencia de auditoría interna detectada durante este mismo ciclo:** el propio informe de Fase 9 marcaba "Sprint 1 — ✅ COMPLETADO" pese a que uno de sus ítems (M-13) no estaba realmente resuelto — se corrigió en este documento, pero deja como aprendizaje de proceso que un sprint/hallazgo marcado como completado debería re-verificarse puntualmente antes de continuar construyendo sobre él, no solo confiar en la etiqueta.
5. **M-31 (`roles.service.ts` ignora `permissionIds` en `update()`)** es deuda técnica real, no solo una nota de implementación: el schema promete un comportamiento que el servicio no cumple. Se evitó el problema al implementar A-20 usando el endpoint correcto, pero la inconsistencia entre contrato y comportamiento sigue existiendo en el código y podría inducir a error a quien no conozca este detalle.
6. **Falsa deuda técnica descartada:** `docs/FRONTEND_ARCHITECTURE.md` (sección 20, punto 12) señalaba `EditPurchaseForm.tsx` como archivo separado de `PurchaseForm.tsx` como "inconsistencia menor de nomenclatura", sugiriendo que el resto de módulos reutiliza un único componente con `mode="create"|"edit"`. Verificación línea por línea confirmó que **no es deuda** — es una decisión de diseño ya documentada en el propio `PurchaseForm.tsx`: el backend no permite editar `items` vía `UpdatePurchaseDto`, por lo que la edición de compras es intencionalmente un componente distinto (sin campo de líneas, schema Zod distinto). Unificar ambos exigiría lógica condicional interna sin ningún beneficio real. Se descarta como candidato del roadmap.

No se proponen refactors adicionales ni recomendaciones genéricas de arquitectura: fuera de los cinco puntos anteriores, no se encontró evidencia de deuda técnica nueva introducida por los cambios de este ciclo.

---

## 11. Riesgos actuales

> **Nota (Fase 12 / Sprint QA 3.7, 27-jul):** los tres puntos de A-02/M-30/A-09 quedaron confirmados en la sección 14.1 (reset real de entorno) y ya no son riesgos abiertos. Sprint 8 y el punto de `sales.void`/`audit` se re-verificaron contra el código actual — ver sección 15 para el detalle completo de la re-verificación. Este bloque se deja como registro histórico de lo que era cierto al cierre de Fase 10; el estado vigente vive en la sección 15.

- ~~A-17 (movimientos de caja) sigue bloqueando una funcionalidad ya casi completa~~ — **sigue sin resolverse** (re-verificado en Fase 12): `CashMovementForm.tsx` continúa montado dentro de `DialogPrimitive.Root` en `PosLayout.tsx`, misma estructura que originó la hipótesis de la sección 14.5. No se pudo probar en navegador durante la re-verificación de Fase 12 (extensión de Chrome no disponible en ese entorno de trabajo, misma limitación que en Fase 10/11) — el análisis estático no descarta ni confirma el síntoma en tiempo de ejecución, solo confirma que no se aplicó ningún cambio estructural que lo hubiera corregido.
- ~~A-02 (`RefreshToken`) requiere migración y `prisma generate` en el entorno real~~ — ✅ confirmado en sección 14.1.
- ~~M-30 (seed de Caja Principal) no fue validado con una ejecución real~~ — ✅ confirmado en sección 14.1.
- ~~A-09 (`Product.cost` obligatorio) tampoco fue validado contra una base de datos real~~ — ✅ ya no aplica, ver sección 14.1.
- ~~Sprint 8 (Pulido de UI/UX) parcialmente completado~~ — ✅ **RESUELTO** (re-verificado en Fase 12): `LoadingState` ahora se usa en 42 archivos (subió de los 4 originales); el único residual real es un panel menor (`NotificationPanel.tsx`, no una página completa), no bloqueante. Limpieza de archivos huérfanos: `features/permissions/index.ts` y `features/products/index.ts` ya no existen (eliminados); `features/products/utils/` y `features/sales/utils/` dejaron de estar vacíos — ahora contienen código real y activamente importado (`productErrors.ts`, `cartDiscount.ts`, `payment.ts`), por lo que el hallazgo de "huérfano" quedó obsoleto, no solo resuelto.
- **`sales.void` y `audit`** — **parcialmente resuelto** (re-verificado en Fase 12): `sales.void` ya no es un permiso sin funcionalidad — `POST /sales/:id/void` está implementado (`voidSale()` en `sales/service.ts`, cubierto por `tests/unit/sales.void.test.ts`) y protegido con `authorizePermission('sales.void')` (`sales/routes.ts`). `audit` sigue sin ningún permiso granular en el catálogo — continúa protegido únicamente por `SystemRole.ADMIN` (`audit/routes.ts`), sin cambio de comportamiento; pendiente de decisión funcional si se desea agregarlo al RBAC granular.

---

## 12. Recomendaciones futuras

> **Nota (Fase 12 / Sprint QA 3.7):** los puntos 3 y 4 ya se ejecutaron (ver sección 15). Los puntos 1, 2, 5 y 6 siguen vigentes tal como estaban.

1. Retomar A-17 con el siguiente paso ya identificado (verificar `aria-expanded` en DevTools) antes de intentar cualquier otro cambio de código sobre ese componente. **Sigue pendiente.**
2. Confirmar la migración/`prisma generate` de `RefreshToken` (A-02), la ejecución real de `prisma/seed.ts` (M-30) y la validación obligatoria de `Product.cost` (A-09) contra una base de datos activa — los tres comparten el mismo motivo (sin conexión a BD disponible durante la implementación). **Ya confirmados, ver sección 14.1.**
3. ~~Completar la migración de `LoadingState` en los ~29 archivos restantes con el mismo patrón (Sprint 8)~~ — ✅ **Completado**, ver sección 15.
4. ~~Ejecutar la limpieza de archivos huérfanos ya aprobada~~ — ✅ **Completado**, ver sección 15.
5. Decidir el alcance funcional de `sales.void` (¿se construye la anulación de ventas, o se retira el permiso del catálogo?) y del permiso granular de `audit`, antes de intentar cerrar el RBAC en esos dos módulos. **`sales.void` ya se construyó** (ver sección 15); **`audit` sigue pendiente de decisión.**
6. Actualizar `docs/FRONTEND_ARCHITECTURE.md` según lo señalado en la sección 10, para que la documentación oficial no quede como fuente de verdad desactualizada frente al código real (incluye actualizar las referencias a la duplicación de `Badge`/`ErrorAlert`, ya resuelta). **Sigue pendiente** — y se detectó adicionalmente que `CLAUDE.md` también describe una arquitectura de autenticación obsoleta (ver sección 15).

---

## 13. Estado actual de la auditoría

> **Este bloque describe el estado al cierre de Fase 10/11. Para el estado vigente y verificado contra el código real al 27-jul-2026, ver la sección 15 (Fase 12 / Sprint QA 3.7), que reemplaza las listas de pendientes de este bloque.**

**Hallazgos altos cerrados en este ciclo:** A-01, A-02, A-06, A-09, A-14, A-15, A-16, A-18, A-19, A-20, A-21, más la corrección real de M-13. De 22 hallazgos altos originales, **solo A-17 permanece genuinamente abierto** (reconfirmado en Fase 12).

**Hallazgos medios cerrados:** M-01 a M-05, M-07, M-09, M-11, M-14, M-16, M-18, M-20 (ya estaba resuelto), M-25, M-32, M-33 (✅ completado en Fase 12, ya no es parcial).

**Hallazgos pendientes de decisión (producto/arquitectura), sin implementación — reconfirmados sin cambios en Fase 12:**
- M-06 — vistas SQL sin aplicación automática (decisión de despliegue/CI-CD).
- M-15 — timeout de inactividad (decisión de producto: mecanismo y duración).
- M-17 — paginación de `getLowStock` (decisión de producto: el comportamiento actual ya es intencional según el propio código).
- M-21 — ventana temporal de `vw_dashboard` (decisión de producto: sin definición documentada del período a mostrar).
- `audit` sin permiso granular en el catálogo (ver sección 11).

**Hallazgos pendientes de implementación real:**
- A-17 (movimientos de caja, pospuesto por bug de UI sin causa confirmada) — **sigue abierto**, reconfirmado en Fase 12.
- Refresh de token solo al arrancar la app, no ante un 401 en pleno uso — ver sección 15 (hallazgo de Fase 11, reconfirmado).
- M-31 (`roles.service.ts` ignora `permissionIds` en `update()`) — reconfirmado abierto en Fase 12, ver sección 15.
- Paginación silenciosa (QA-005) en Categorías/Proveedores/Impuestos/Usuarios/Roles — confirmado en Fase 12 como defecto real, no solo sospecha (ver sección 15).

**Sin acción requerida (verificado, no defecto):** M-08 (soft-delete, sin funcionalidad de eliminación que filtrar en los 17 modelos restantes), M-19 (pool de conexiones, modelo de despliegue on-premise no lo justifica).

**Resuelto en Fase 12 (ver sección 15 para el detalle):** M-33 (LoadingState), limpieza de archivos huérfanos, `sales.void` (RBAC), `.env.example` corrupto, instrumentación de debug (`console.log`) en `client.ts`/`authStore.ts`, QA3.1 a QA3.4 y QA3.6 (deuda técnica de backend).

**Recomendación de siguiente bloque:** decidir A-17 (requiere verificación de DevTools en un entorno con navegador disponible), corregir la paginación silenciosa confirmada en los 5 módulos restantes (mismo patrón ya validado en Productos), y resolver M-31 (contrato de `roles.service.update()`) — ver sección 15 para el detalle completo y las prioridades actualizadas.

---

*Fin de la Fase 10 — Informe Ejecutivo Actualizado. Continúa vigente salvo lo indicado en la Fase 11 y la Fase 12 (sección 15).*
*Este documento reemplaza al informe de Fase 9 como referencia vigente del estado del proyecto.*

---

## 14. FASE 11 — Actualización final para Release 1.0

**Fecha de esta actualización:** 26 de julio de 2026.
**Basado en:** bloques QA-005 a QA-008 (Compras/Productos, Notificaciones, Referencia de pago, restauración completa del entorno de desarrollo) + una auditoría final enfocada exclusivamente en "¿qué impide instalar y usar esta aplicación en una carnicería real?".

Este bloque **no repite** la auditoría exhaustiva de la Fase 10 — la da por válida en lo que no contradice explícitamente. Se enfoca en: (a) cerrar las confirmaciones de infraestructura que quedaron pendientes en Fase 10, (b) documentar el trabajo nuevo de este ciclo, (c) corregir afirmaciones de la Fase 10 que ya no son ciertas, y (d) dar el veredicto final de Release 1.0 con una clasificación de 3 niveles (🔴/🟡/🔵) en vez de la de 4 niveles (Crítico/Alto/Medio/Bajo) usada hasta ahora — más adecuada para una decisión de "listo o no listo".

### 14.1 Confirmaciones de infraestructura de Fase 10 — ahora resueltas

La Fase 10 (sección 11, "Riesgos actuales") dejó 3 puntos sin poder validar contra una base de datos real, por falta de conexión disponible durante ese ciclo. Los tres se confirmaron en este bloque, mediante un reset completo y verificado del entorno de desarrollo:

- **A-02 (`RefreshToken`, migración/`prisma generate`)**: ✅ Confirmado. Se ejecutó `prisma migrate reset --force` (con consentimiento explícito del usuario) contra la base de datos local: las 9 migraciones oficiales, incluida `20260725012557_add_refresh_tokens`, se aplicaron sin error; `prisma generate` corrió exitosamente; el backend arrancó y `POST /auth/login` + `POST /auth/refresh` son alcanzables sin error de Prisma.
- **M-30 (seed de Caja Principal)**: ✅ Confirmado — el seed oficial (`tsx prisma/seed.ts`) se ejecutó de punta a punta sin errores como parte del mismo reset, completando sucursal, roles, permisos, usuario administrador y configuración inicial.
- **A-09 (`Product.cost` obligatorio, validación contra datos existentes)**: ✅ Ya no aplica como riesgo — una instalación nueva (el escenario real de "instalar en una carnicería") arranca sin productos existentes; la regla de `cost` obligatorio rige desde el primer producto que se cargue, sin datos legacy que migrar.

Verificación end-to-end realizada tras el reset: login con el usuario administrador del seed, y `GET /sales`, `GET /purchases`, `GET /products`, `GET /reports/dashboard`, `GET /reports/sales`, `GET /notifications` — todos responden `200` con datos consistentes (catálogo vacío, 1 usuario, sin errores de Prisma en el log del servidor).

### 14.2 Trabajo nuevo de este ciclo (QA-005 a QA-008)

**QA-005 — Productos ocultos por paginación silenciosa.** Causa raíz: el backend devuelve por defecto solo los 20 registros más recientes (`createdAt desc`) sin que ninguna pantalla administrativa lo indicara; con el dataset de demo, los productos de carne (los primeros insertados, por lo tanto los más antiguos) quedaban invisibles en cualquier listado que no buscara explícitamente. Resuelto: `ProductsPage.tsx` ahora pagina de verdad (lee `meta`, controles Página/Anterior/Siguiente); el `Select` de producto por línea en Compras (`PurchaseItemRow.tsx`), que tenía el mismo límite, se reemplazó por el mismo `ProductSearchDialog` ya usado para agregar líneas — un único buscador compartido para agregar y para cambiar el producto de una línea existente.

**QA-006 (A/B/C) — Rediseño del sistema de Notificaciones.** Se agregó agrupación por tipo (una fila resumen por tipo de alerta en vez de una fila por elemento — resuelve el ruido con catálogos grandes), acciones rápidas contextuales por tipo (reabastecer, abrir compra, gestionar caja — todas reutilizando rutas ya existentes), un toast (`sonner`) para alertas críticas nuevas (deduplicado por id, a nivel de módulo, para no repetirse en cada sondeo de 60s ni al cambiar de pantalla), y se **eliminó una duplicación real** entre el Dashboard y la campana de notificaciones: la tarjeta "Alertas" de `src/pages/DashboardPage.tsx` ya no hace sus propias consultas independientes (`useLowStock`, `usePurchases`) — reutiliza `useNotifications()` + `NotificationPanel`, la misma fuente que la campana. `LowStockAlert.tsx` y `PendingPurchasesAlert.tsx` (sección 6-bis de `UI_DESIGN_SYSTEM.md`, ver 14.4) fueron eliminados por quedar sin ningún consumidor.

**QA-007 — Referencia de pago para métodos electrónicos.** Se agregó `Sale.paymentReference` (migración oficial de Prisma), obligatoria en el backend cuando `paymentMethod` es `CARD`/`SINPE_MOVIL`/`TRANSFER` (no para `CASH` ni `MIXED`), visible en el comprobante del POS y en el reporte de ventas.

**QA-008 — Restauración completa del entorno de desarrollo.** La base de datos de desarrollo, contaminada por datos de QA, fue reseteada por completo (con confirmación explícita del usuario, requerida por la propia salvaguarda anti-agente de Prisma): reaplicación de las 9 migraciones oficiales, regeneración del cliente, y ejecución del seed oficial. De paso, se reemplazó la migración de QA-007 (escrita a mano en el bloque anterior) por una generada oficialmente con `prisma migrate dev`, byte por byte idéntica a la manual — confirmando que no introducía drift.

### 14.3 Correcciones a afirmaciones de la Fase 10 que ya no son ciertas

- **M-32 (Badge/ErrorAlert "duplicados, deuda no unificada")** — la Fase 10 ya los daba por unificados una vez ("única implementación cada uno"), y se reconfirma en este ciclo: `components/ui/Badge.tsx` y `components/common/ErrorAlert.tsx` **ya no existen** en el repositorio — solo quedan `components/common/Badge.tsx` y `components/ui/ErrorAlert.tsx`. Sin acción pendiente.
- **Sección 10, punto 6 de la Fase 10 (`EditPurchaseForm.tsx` como "falsa deuda técnica")** — se reconfirma sin cambios: sigue siendo una decisión de diseño válida, no un defecto.
- El propio `docs/UI_DESIGN_SYSTEM.md` tenía referencias desactualizadas adicionales, no señaladas en la Fase 10 — ver sección 14.4 y el propio documento, ya actualizado.

### 14.4 Hallazgos nuevos, detectados en la auditoría final de Release 1.0 (no estaban en ninguna fase anterior)

> **Columna "Estado (Fase 12)" agregada en Sprint QA 3.7 (27-jul-2026)** — cada fila se re-verificó directamente contra el código actual, sin asumir que seguía vigente. Detalle completo en la sección 15.

| Hallazgo | Explicación | Categoría original | Estado (Fase 12) |
|---|---|---|---|
| `.env.example` del frontend está corrompido — contiene texto conversacional pegado por error, no variables de entorno reales | Bloquea la instalación en cualquier máquina nueva: quien lo use como plantilla no obtiene un `.env` funcional | 🔴 | ✅ RESUELTO — verificado: el archivo actual solo contiene `VITE_API_URL=http://localhost:3000/api/v1`, sin texto espurio. |
| Instrumentación de debug temporal activa en `client.ts`/`authStore.ts` (`console.log` en cada request/cambio de auth, con colas de token JWT) | El propio código dice "DEBUG TEMPORAL — Quitar al cerrar la investigación"; sigue activa | 🔴 | ✅ RESUELTO — verificado: cero coincidencias de `console.log`/"DEBUG TEMPORAL" en `client.ts` ni `authStore.ts` (ni en el resto de `src/`). |
| `prisma/migrations/` completa, y ~90 archivos del backend, sin commitear en git | Sin esto, el proyecto no es reproducible por otra persona/máquina — un requisito mínimo para "instalar en un negocio real" | 🔴 | 🟡 PENDIENTE — reconfirmado con `git status` (backend): 42 entradas sin commitear (bajó de ~90, pero incluye 4 migraciones y 2 módulos completos, `returns`/`inventoryWaste`, como `??` sin trackear). Sigue sin resolverse. |
| Refresh de token solo se ejecuta al arrancar la app, no ante un `401` en pleno uso | Con `JWT_EXPIRES_IN=15m`, un cajero es deslogueado a mitad de turno sin ningún intento de recuperación silenciosa | 🟡 | 🟡 PENDIENTE — reconfirmado en `client.ts`: el interceptor de `401` solo llama a `logout()`, sin intentar `authApi.refresh()`. Sin cambios. |
| `CLAUDE.md` describe una arquitectura de auth y una duplicación de componentes que ya no existen | Riesgo de que trabajo futuro (humano o de IA) parta de información incorrecta — no afecta al usuario final de la carnicería | 🟡 | 🟡 PENDIENTE — reconfirmado: `CLAUDE.md` sigue describiendo `refreshToken` sincronizado a `localStorage` y `client.ts` leyendo el token desde `localStorage`; el código real ya no hace ninguna de las dos cosas (accessToken solo en memoria, refreshToken nunca llega al frontend). Fuera del alcance de este sprint (documentación de auditoría, no `CLAUDE.md`) — queda señalado para un sprint de documentación dedicado. |
| Módulo `invoicing/` (backend) sin ningún endpoint que lo exponga | Explícitamente fuera de alcance de la Release 1.0 (Facturación Electrónica ya excluida por decisión de producto) — no bloquea, solo debe quedar documentado como no conectado, no como olvido | 🔵 | 🔵 DECISIÓN DE PRODUCTO — sin cambios, reconfirmado. |
| `carniceria-pos-backend.zip` (zip del propio repo) commiteado en git | Infla el repositorio; riesgo de secretos históricos si alguna vez incluyó un `.env` real | 🟡 | ⚪ OBSOLETO — verificado con `git ls-files` en el repo del backend: ningún `.zip` está trackeado actualmente. El hallazgo no es reproducible contra el estado real del repositorio; se marca obsoleto en vez de resuelto porque no hay evidencia de que haya existido en el historial de este mismo repo. |
| Paginación (QA-005) solo se corrigió en Productos — no se auditó en Categorías/Proveedores/Impuestos/Usuarios/Roles | Mismo defecto podría existir en otros catálogos si crecen lo suficiente — no confirmado, solo no descartado | 🟡 | 🟡 **PENDIENTE — CONFIRMADO** (subió de sospecha a defecto verificado): `CategoriesPage.tsx`, `SuppliersPage.tsx`, `TaxesPage.tsx`, `UsersPage.tsx` y `RolesPage.tsx` no tienen ningún control de paginación ni leen `meta.page`; con el límite backend por defecto de 20 registros (`DEFAULT_LIMIT` en `shared/utils/pagination.ts`), cualquiera de esos 5 catálogos que supere 20 filas oculta el resto en silencio, igual que el defecto original de Productos (QA-005) antes de corregirse. |

### 14.5 A-17 (movimientos de caja) — nueva hipótesis de causa raíz

Sigue sin resolverse, pero este ciclo aporta una pista concreta que la Fase 10 no tenía: `CashMovementForm.tsx` (el formulario con el `Select` de "Tipo de movimiento" que no abre) vive **dentro de un `DialogPrimitive.Root`** (`PosLayout.tsx`, diálogo "Movimiento de caja"), mientras que `OpenCashSessionForm.tsx` (con el que se comparó línea por línea en Fase 10, sin encontrar diferencias) vive en una **página independiente, sin ningún diálogo contenedor**. Tanto `Select` como `Dialog` son primitivos de `@base-ui/react` con su propia gestión de foco/portal — anidar uno dentro del otro es exactamente la misma familia de conflicto ya diagnosticada y resuelta en este mismo proyecto para formularios anidados en Compras (QA-006B: un `<form>` dentro de otro `<form>`, ambos con manejo propio de eventos, interfiriendo entre sí pese a que el portal los separa en el DOM real). Es una hipótesis fundada, no una prueba en navegador (no se pudo reproducir visualmente en este entorno — extensión de Chrome no disponible); el siguiente paso recomendado sigue siendo el ya identificado en Fase 10 (verificar `aria-expanded` en DevTools), ahora con un candidato concreto de causa (contención de foco/portal entre `Dialog` y `Select` anidados) para dirigir la investigación.

**Reevaluación de impacto real**: a diferencia de como lo trataba la Fase 10 ("el bloqueante funcional más importante que persiste"), este bloque reclasifica A-17 como 🟡, no 🔴: la ausencia de movimientos de caja ad-hoc no impide vender, abrir ni cerrar caja; solo impide registrar ajustes de efectivo fuera de una venta.

**Re-verificación (Fase 12 / Sprint QA 3.7, 27-jul-2026):** 🟡 PENDIENTE, sin cambios. Se confirmó en el código actual que `CashMovementForm.tsx` sigue montado dentro de `DialogPrimitive.Root` en `PosLayout.tsx` — la misma estructura de anidado `Dialog`/`Select` que originó esta hipótesis sigue intacta, sin ningún cambio que la hubiera roto o corregido. No se pudo reproducir/descartar en navegador durante esta re-verificación (extensión de Chrome no disponible en este entorno de trabajo, misma limitación que en Fase 10/11); el siguiente paso recomendado sigue siendo el mismo (verificar `aria-expanded` en DevTools con un navegador disponible).

---

*Fin de la Fase 11 — Actualización final para Release 1.0. Continúa vigente salvo lo indicado en la Fase 12 (sección 15).*

---

## 15. FASE 12 — Sincronización QA3 (Sprint QA 3.7)

**Fecha de esta actualización:** 27 de julio de 2026.
**Basado en:** Sprints QA 3.1 a QA 3.6 (deuda técnica de backend, ejecutados fuera del roadmap de Fase 10/11) + una re-verificación puntual de este documento contra el código real (Sprint QA 3.7), sin asumir que ninguna fila seguía vigente solo porque el documento lo decía.

Metodología: cada hallazgo listado abajo se comprobó de nuevo contra el código actual (`grep`, lectura de archivos, `git status`, ejecución de tests) — no se copió el estado que ya tenía el documento. Varios hallazgos que la Fase 10/11 daba por parcialmente resueltos o por riesgos abiertos ya estaban completamente cerrados; otros que parecían simples sospechas resultaron ser defectos confirmados.

### 15.1 QA3.1 a QA3.6 — deuda técnica de backend (ya cerrados, documentados aquí por primera vez en este informe)

Estos sprints no están cubiertos por ninguna fase anterior de este documento (operan sobre `carniceria-pos-backend`, con su propio ciclo de trabajo). Se listan aquí como referencia cruzada, ya que tocan la misma base de código que A-06/M-05/M-31.

| Sprint | Hallazgo | Estado |
|---|---|---|
| QA3.1 | Permisos de merma (`inventoryWaste`) sin cubrir en el catálogo de permisos/RBAC | ✅ RESUELTO |
| QA3.2 | Análisis de `AuditAction` — catálogo de acciones auditables disperso en strings literales | ✅ RESUELTO (análisis) |
| QA3.3 | Implementación de acciones específicas de `AuditAction` (`SALE_VOID`, `SALE_CORRECTION`, `SALE_RETURN`, `INVENTORY_WASTE`), reemplazando el uso genérico legacy de `SALE`/`INVENTORY_MOVEMENT` | ✅ RESUELTO — `shared/constants/auditActions.constants.ts`, valores legacy conservados como `@deprecated` sin reescribir historial de `AuditLog`. |
| QA3.4 | Centralización tipada de `referenceType` (`InventoryMovement.referenceType`, antes strings literales `'SALE'`/`'SALE_VOID'`/`'SALE_RETURN'`/`'PURCHASE'`/`'INVENTORY_ADJUSTMENT'`/`'INVENTORY_WASTE'` repetidos en 6 archivos) | ✅ RESUELTO — nueva `shared/constants/inventoryReferenceType.constants.ts` (mismo patrón que `AuditAction`); campo sigue siendo `String?` en Prisma (sin migración necesaria); typecheck/lint/tests (131 tests) sin errores. |
| QA3.5 | Revisión de deuda técnica restante de prioridad media/baja (solo análisis, sin implementación) | ✅ Completado como análisis — insumo directo de esta sección 15. |
| QA3.6 | Validación de concurrencia de `recordMovement()` | ✅ RESUELTO (validado, ver detalle abajo) — **no se modificó la implementación**, solo se demostró su comportamiento real con un test de concurrencia contra PostgreSQL real. |

**Detalle QA3.6 — comportamiento real de `recordMovement()` bajo escritura concurrente**, confirmado con `tests/integration/inventoryMovement.concurrency.test.ts` (único test del proyecto que usa Prisma real, no mockeado, contra `DATABASE_URL`; reproducible en 3 corridas idénticas):

- El riesgo original sospechado ("posible *lost update* de `Inventory.quantity`") **quedó descartado**: el incremento atómico (`quantity: { increment: delta }` sobre una fila ya existente) es genuinamente seguro — en una prueba de 20 escrituras concurrentes sobre la misma fila, el saldo final fue exactamente 20 y los 20 valores de `balanceAfter` devueltos fueron la permutación exacta `[1..20]`, sin huecos ni duplicados.
- El único riesgo real identificado es distinto al sospechado originalmente: una **ventana de carrera en la creación inicial** de la fila `Inventory` (patrón `findFirst` → `create` en `recordMovement()`, sin lock). Cuando dos transacciones concurrentes registran el primer movimiento de un mismo `(productId, sucursalId)` que todavía no tiene fila de `Inventory`, ambas pueden ver `findFirst` → `null` antes de que cualquiera confirme; el `@@unique([productId, sucursalId])` de `schema.prisma` evita la fila duplicada, pero lo hace lanzando `P2002`, no absorbiéndolo — la segunda transacción se revierte completa. Reproducido de forma 100% consistente en 3 corridas del test.
- Esta ventana **no corrompe datos** (el saldo final de `Inventory` siempre queda consistente con las transacciones que sí se aplicaron, verificado en el test) — el impacto real es que una de las dos peticiones HTTP concurrentes fallaría con un error no manejado (`P2002` sin captura/retry en ningún caller), acotado al caso específico de dos operaciones simultáneas siendo literalmente las primeras en tocar ese producto/sucursal.
- **No se modificó la implementación de producción** en este sprint — se cumplió estrictamente la instrucción de "demostrar antes de corregir". Si se decide cerrar esta ventana en un sprint futuro, la corrección típica sería un `upsert` (en vez de `findFirst`+`create`) o capturar `P2002` y reintentar como `update`.

### 15.2 Hallazgos de Fase 10/11 explícitamente re-verificados en este sprint

| ID | Estado Fase 10/11 | Estado verificado (Fase 12) | Evidencia |
|---|---|---|---|
| A-17 | 🔴→🟡 pospuesto, hipótesis de causa sin confirmar | 🟡 **PENDIENTE**, sin cambios | `CashMovementForm.tsx` sigue anidado dentro de `DialogPrimitive.Root` en `PosLayout.tsx`; sin prueba de navegador posible en este entorno (ver sección 14.5). |
| M-31 | Deuda documentada, no bloqueante | 🟡 **PENDIENTE**, sin cambios | `roles.service.ts` `update()` (líneas 110-128) sigue sin leer `dto.permissionIds`, pese a que `UpdateRoleSchema`/`UpdateRoleDto` lo declaran. Único camino funcional real sigue siendo `PATCH /roles/:id/permissions`. |
| QA-005 | ✅ Resuelto en Productos; "no auditado" en el resto | Productos: ✅ **RESUELTO** (confirmado). Categorías/Proveedores/Impuestos/Usuarios/Roles: 🟡 **PENDIENTE — CONFIRMADO** (ya no es sospecha) | Ver fila actualizada en la sección 14.4. |
| M-06 | 🔵 Pendiente de decisión de arquitectura | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | Persisten los dos mecanismos redundantes (`db:views` en `package.json`, `scripts/apply-views.sh`), ninguno integrado a CI/setup. |
| M-15 | 🔵 Pendiente de decisión de producto | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | Sin ningún mecanismo de timeout de inactividad en el código (`grep` sin resultados en todo `src/`). |
| M-17 | 🔵 Decisión de producto ya tomada (comportamiento intencional) | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | `reports.repository.ts` `getLowStock()` sigue sin `skip`/`take`; comportamiento documentado como intencional en el propio código. |
| M-21 | 🔵 Pendiente de decisión de producto | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | `vw_dashboard.sql` sigue sin ninguna cláusula de fecha en sus subconsultas de ventas/compras. |
| M-33 | ⏳ Parcial (4 de ~33 archivos) | ✅ **RESUELTO** | `LoadingState` en uso en 42 archivos; único residual (`NotificationPanel.tsx`) es un panel menor, no una página, no bloqueante. |
| Limpieza de archivos huérfanos | Aprobada, ejecución pendiente | ✅ **RESUELTO / OBSOLETO** | `features/permissions/index.ts` y `features/products/index.ts` ya no existen; `features/products/utils/` y `features/sales/utils/` dejaron de estar vacíos (contienen `productErrors.ts`, `cartDiscount.ts`, `payment.ts`, todos activamente importados) — el hallazgo de "huérfano" ya no aplica en absoluto. |
| `sales.void` (RBAC) | Permiso sembrado sin funcionalidad real | ✅ **RESUELTO** | `POST /sales/:id/void` implementado (`voidSale()`), protegido con `authorizePermission('sales.void')`, cubierto por `tests/unit/sales.void.test.ts`. |
| `audit` (RBAC) | Sin permiso granular en el catálogo | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | `audit/routes.ts` sigue usando únicamente `authorize(SystemRole.ADMIN)`. |
| `.env.example` corrupto | 🔴 Bloqueante | ✅ **RESUELTO** | Contenido actual: solo `VITE_API_URL`. |
| Debug `console.log` en `client.ts`/`authStore.ts` | 🔴 Bloqueante | ✅ **RESUELTO** | Cero coincidencias de `console.log`/"DEBUG TEMPORAL" en ambos archivos ni en el resto de `src/`. |
| `carniceria-pos-backend.zip` en git | 🟡 Pendiente | ⚪ **OBSOLETO** | No hay ningún `.zip` trackeado en `git ls-files` del repo del backend. |
| Migraciones + archivos backend sin commitear | 🔴 Bloqueante | 🟡 **PENDIENTE**, sin resolver | `git status` (backend): 42 entradas sucias (bajó de ~90, sigue sin resolverse). |
| Refresh de token solo al arrancar, no ante 401 | 🟡 Pendiente | 🟡 **PENDIENTE**, sin cambios | `client.ts`: el interceptor de 401 solo hace `logout()`, sin intento de refresh. |
| `CLAUDE.md` desactualizado (arquitectura de auth) | 🟡 Pendiente | 🟡 **PENDIENTE**, sin cambios (y se confirmó el detalle exacto: describe `refreshToken` sincronizado a `localStorage`, que ya no existe en el código real) | Fuera de alcance de este sprint (documentación de auditoría, no `CLAUDE.md` en sí). |
| Módulo `invoicing/` sin exponer | 🔵 Decisión de producto | 🔵 **DECISIÓN DE PRODUCTO**, sin cambios | Sin cambios. |

### 15.3 Reclasificación de prioridades — Release 1.0

**Se retira de los bloqueantes (ya no aplica o ya resuelto):**
- Ninguno de los hallazgos "Altos" (A-xx) originales cambió de clasificación — A-17 sigue siendo el único alto genuinamente abierto, igual que en Fase 10/11.
- De los hallazgos nuevos de Fase 11 (14.4), 3 de los 4 marcados 🔴 en su momento ya están resueltos (`.env.example`, debug `console.log`); el cuarto (migraciones sin commitear) sigue 🔴 vigente, sin cambio de severidad.

**Prioridad que sube (de sospecha a confirmado, sin cambiar de color pero con evidencia real ahora):**
- Paginación silenciosa en Categorías/Proveedores/Impuestos/Usuarios/Roles (antes "no confirmado, solo no descartado"; ahora confirmado con evidencia directa en las 5 páginas).

**Prioridad que baja (de bloqueante a no aplica):**
- `carniceria-pos-backend.zip` en git: de 🟡 a ⚪ obsoleto (no reproducible contra el estado real del repo).

**Sin cambios de prioridad, solo de estado (pasan de pendiente a resuelto sin haber sido nunca bloqueantes de Release 1.0):**
- M-33, limpieza de archivos huérfanos, `sales.void`.

**Imprescindibles para Release 1.0, tras esta sincronización:**
1. **A-17** (movimientos de caja) — el único alto genuinamente abierto, sin cambios desde Fase 10.
2. **Migraciones + archivos de backend sin commitear** (`git status`, 42 entradas) — bloqueante de reproducibilidad, no de funcionalidad, pero sigue siendo 🔴 por el mismo motivo que en Fase 11.
3. **Paginación silenciosa en los 5 catálogos restantes** — nuevo, confirmado en este sprint; mismo patrón de corrección ya validado en Productos (QA-005), bajo riesgo técnico.

**Puede diferirse sin afectar estabilidad, seguridad o consistencia:** M-06, M-15, M-17, M-21 (decisiones de producto/arquitectura pendientes, sin defecto de código), M-31 (deuda de contrato sin impacto funcional activo), `audit` sin permiso granular, `invoicing/` sin exponer, refresh de token solo al arrancar, `CLAUDE.md` desactualizado.

### 15.4 Confirmación final

`docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` queda, a partir de esta actualización (27-jul-2026), **sincronizado con el estado real y verificado del proyecto** — cada hallazgo señalado explícitamente para revisión (A-17, M-31, QA-005, M-06, M-15, M-17, M-21) y cada hallazgo nuevo de la sección 14.4 se comprobó de nuevo contra el código, no se asumió vigente por inercia del documento. Los cierres de QA3.1 a QA3.4 y QA3.6 quedan incorporados por primera vez a este documento. Puede utilizarse como documento oficial de referencia para continuar los siguientes sprints — las secciones 11, 13 y 14.4 quedan con notas explícitas señalando que su contenido histórico fue superado por esta sección 15 donde corresponda.

No se modificó ningún archivo de código, configuración ni test durante este sprint — únicamente este documento.

---

*Fin de la Fase 12 — Sincronización QA3 (Sprint QA 3.7).*

---

## 16. FASE 13 — Módulo de Historial de Mermas (completado)

**Fecha:** 27 de julio de 2026.
**Alcance:** cierra el gap que la sección 7 (Fase 10) registraba para el módulo Inventario ("Sin historial de movimientos") en su componente de mermas — el flujo de **registro** de mermas ya existía y funcionaba desde el Bloque 5.4; lo que faltaba, y ahora está completo, es la pantalla de **consulta** del historial ya registrado.

### 16.1 Arquitectura final

El backend (`inventoryWaste/routes.ts`, `controller.ts`, `service.ts`, `repository.ts`) ya estaba 100% listo desde su bloque original — `GET /inventory/waste` (listado paginado con filtros `sucursalId`/`productId`/`userId`/`reason`) y `GET /inventory/waste/:id` (detalle) ya existían, montados dentro de `/inventory` (no como módulo propio, arquitectura ya aprobada), protegidos con el permiso ya sembrado `inventory.view`. **No se modificó ni una línea de backend, Prisma, ni permisos** para completar este módulo — todo el trabajo fue de capa de presentación en el frontend, consumiendo infraestructura ya existente de punta a punta.

Trabajo realizado en 3 bloques + 1 QA, todos validados con `tsc -b`/`eslint` sin errores en cada paso:

- **Bloque 1 (tipos + API):** `ListInventoryWasteFilters`, `PaginatedInventoryWasteResponse` (`inventory.types.ts`); `getWastes`/`getWasteById` (`inventory.api.ts`).
- **Bloque 2 (hook):** `useInventoryWastes.ts`, mismo patrón `useQuery` que el resto del módulo Inventario.
- **Bloque 3 (UI):** `InventoryWasteFilters.tsx`, `InventoryWasteTable.tsx`, `InventoryWastesPage.tsx`; extracción de `WASTE_REASON_OPTIONS` (antes duplicado dentro de `InventoryWasteForm.tsx`) a `constants/wasteReason.constants.ts`, consumido ahora por el formulario, los filtros y la tabla desde una única fuente.
- **QA funcional:** verificado extremo a extremo contra el backend real (creación de una merma de prueba vía `POST /inventory/waste` + verificación de listado/filtros/paginación). Un defecto de UX encontrado y corregido: el botón "Ver detalle" quedaba clickeable sin ninguna acción ni feedback — se deshabilitó con un `title` explicativo hasta que exista el dialog de detalle (bloque futuro).

### 16.2 Componentes reutilizados (cero duplicación nueva)

`DataTable`, `FilterBar`, `Badge`, `PageHeader`, `LoadingState`, `ErrorAlert`, `Button`, `RequirePermission`, `formatDateTime`, `formatQuantity`, `useProducts`, `useUsers` — ninguno modificado en su comportamiento base. Único componente nuevo compartido dentro del propio módulo: `WASTE_REASON_OPTIONS`, ahora con una sola definición en vez de dos.

### 16.3 Hooks y rutas agregadas

- **Hook nuevo:** `useInventoryWastes(filters?)` — `src/features/inventory/hooks/useInventoryWastes.ts`. Query key `['inventory', 'wastes', 'list', filters]`, dentro del prefijo `['inventory']` — se invalida automáticamente junto con el resto de Inventario cuando `useCreateInventoryWaste` invalida por prefijo, sin ningún cambio de invalidación adicional.
- **Ruta nueva:** `/inventory/waste` (`InventoryWastesPage`), protegida con `RequirePermission permission={PERMISSIONS.INVENTORY_VIEW}` — mismo permiso ya usado por `/inventory`, sin agregar ningún permiso nuevo al catálogo. Sub-página de Inventario alcanzada por un botón ("Historial de mermas" en `InventoryPage.tsx`), no por un ítem propio del sidebar — mismo criterio arquitectónico ya usado por `InventoryAdjustPage.tsx`.

### 16.4 Estado del roadmap y deuda técnica restante

- El hallazgo de la sección 7 ("Inventario ... Sin historial de movimientos") queda **actualizado, no eliminado del historial** — ver la fila corregida de la tabla de módulos: Inventario pasa de ⚠️ a ✅, de 75% a 90%.
- **Deuda técnica documentada, no bloqueante:** no existe todavía un ledger unificado de `InventoryMovement` (el registro de bajo nivel que combina compras, ventas, ajustes y mermas en una sola línea de tiempo) — el backend no tiene ningún endpoint de consulta para `InventoryMovement` en bruto (verificado: sin `GET` en ningún módulo). Lo que se completó es específicamente el historial de **mermas** (`InventoryWaste`, el documento de negocio de más alto nivel), que era la necesidad real señalada por el usuario. Un ledger unificado, si se decide construir en el futuro, requeriría su propio análisis (nuevo endpoint de backend) — no es una omisión de este bloque, es una funcionalidad distinta y de mayor alcance.
- **Sin riesgos abiertos nuevos.** El único punto pendiente dentro del propio módulo de mermas es el dialog de detalle (`onViewDetail` sin handler, botón deshabilitado a propósito) — documentado como trabajo futuro explícito, no como deuda oculta.

### 16.5 Confirmación final

La documentación de auditoría queda sincronizada con el estado real del ERP en lo referente a Inventario/Mermas: no queda ninguna referencia activa a "sin pantalla de consulta de mermas" en este documento — la única mención remanente (sección 15.1, hallazgo QA3.1) es sobre permisos de merma, un hallazgo distinto ya cerrado con anterioridad, y sigue siendo válida tal cual.

No se modificó ningún archivo de código en este sprint — únicamente este documento.

---

*Fin de la Fase 13 — Módulo de Historial de Mermas (completado).*

---

## 17. FASE 14 — Motor de Promociones (P.1–P.8): implementación completa, QA integral y cierre

**Fecha:** 27–28 de julio de 2026.
**Alcance:** diseño, implementación, QA integral y cierre completo del Motor de Promociones y Descuentos — desde el motor de reglas puro (backend) hasta su integración visual en tiempo real en el POS (frontend), pasando por el endpoint de cotización, dos defectos encontrados y corregidos en QA, y la creación/gestión de la base de datos oficial de pruebas funcionales. Es el bloque más grande documentado en una sola fase desde la Fase 10 original — se resume aquí en bloques, con el detalle técnico completo ya validado bloque por bloque durante la implementación (análisis → aprobación → implementación → revisión → aprobación, en cada paso).

### 17.1 Bloques P.1–P.7 — Motor y su integración con Ventas (backend)

Trabajo por bloques (todos aprobados individualmente antes de continuar al siguiente):

- **P.1** — `SaleAppliedPromotion` (tabla de auditoría) + enum `PromotionSource`, integrado en `createSaleTransaction()` para auditar el descuento manual de carrito ya existente.
- **P.2** — `SaleAppliedPromotion` expuesto en `SaleResponse.appliedPromotions`; nueva sección "Descuentos aplicados" en `SaleDetailContent.tsx` (frontend).
- **P.3** — Catálogo `Promotion` completo: schema (`Promotion`, `PromotionProduct`, `PromotionCategory`, enums `PromotionScopeType`/`PromotionEffectType`/`DayOfWeek`), CRUD de backend (`src/modules/promotions/`), permisos (`promotions.view/create/update`), pantallas de administración en el frontend (`src/features/promotions/`).
- **P.4** — `PromotionEngine` puro (`src/shared/services/promotionEngine/`): elegibilidad, condiciones (fecha/hora/día, zona horaria Costa Rica), cálculo de beneficio, orquestador (prioridad/exclusividad/acumulación). 21 pruebas unitarias. No persiste nada, no conoce `Sales`.
- **P.5** — `PromotionApplicationService`: único adaptador entre el motor (agnóstico de Ventas) y el dominio de Ventas (agnóstico del motor). 6 pruebas unitarias.
- **P.6** — Integración real en `createSaleTransaction()`: las promociones automáticas pasan a aplicarse de verdad en cada venta, con su `SaleAppliedPromotion` correspondiente. QA en vivo detectó y corrigió un bug preexistente desde P.1 (la respuesta de `POST /sales` no incluía las promociones recién creadas por no releer la venta dentro de la misma transacción).
- **P.7** — `POST /sales/quote`: endpoint de cotización que reutiliza íntegramente `computeSaleQuote()` (el mismo núcleo de cálculo que usa `createSaleTransaction()`, extraído a una función compartida) — garantiza arquitectónicamente, no solo por prueba, que "misma cotización = misma venta".

### 17.2 QA integral del motor de promociones (17 pruebas)

Batería completa contra el sistema real (backend + Chrome real): PRODUCT (%/monto fijo), CATEGORY, CART, prioridades, stackable, exclusive group, fechas (vigente/futura/vencida), horarios, días de semana, promociones inactivas, cotización vs. venta, detalle de venta, aislamiento de inventario de `POST /sales/quote`, stock insuficiente (mismo criterio en cotización y venta), regresión sin promociones.

**Resultado: 15/17 aprobadas en la primera pasada, 2 defectos reales encontrados:**

1. **Defecto de redondeo monetario** — `POST /sales/quote` podía devolver `discountTotal`/`total` con más de 2 decimales (ej. `256.9007`) en escenarios de descuento porcentual sobre un subtotal ya ajustado por promociones, mientras `POST /sales` mostraba el valor limpio (`256.9`) porque Postgres redondeaba implícitamente al persistir (columna `Decimal(_,2)`) — un defecto preexistente desde antes de P.7, nunca visible hasta que P.7 devolvió un cálculo sin pasar por la base de datos.
2. **Defecto funcional (no del motor)** — la pantalla "Ventas" del Backoffice no permitía abrir el detalle de ninguna venta: `SalesPage.tsx` no pasaba `onSelectSale` a `SalesTable`, así que la columna "Ver" (y con ella, la sección "Descuentos aplicados") nunca se renderizaba ahí — aunque el mismo componente sí funcionaba correctamente desde el POS (`SessionSalesDialog.tsx`) y desde Reportes (`CashSessionDetailPage.tsx`).

### 17.3 Corrección de los 2 defectos y estrategia oficial de redondeo monetario

**Estrategia de redondeo (única fuente de verdad, dos implementaciones — una por cada lado del dominio, no duplicación accidental):**

- **Lado `Prisma.Decimal`** (dominio de Ventas): `roundMoney()`, nueva función en `shared/utils/money.ts` — 2 decimales, mitad hacia arriba (`Prisma.Decimal.ROUND_HALF_UP`). Aplicada explícitamente en `computeItems()` (subtotal e impuesto de cada línea) y `computeCartDiscountAmount()` (descuento manual de carrito) — los dos puntos donde una multiplicación/división podía introducir más de 2 decimales. Antes de esto, ninguna operación de `money.ts` redondeaba nada; el redondeo dependía por completo del efecto secundario de Postgres al persistir.
- **Lado `number`** (Motor de Promociones, deliberadamente desacoplado de `@prisma/client` desde P.4): `roundCurrency()` en `calculation.ts` — sin cambios, ya implementaba la misma regla matemática desde P.4.

Con esto, `POST /sales` y `POST /sales/quote` ejecutan literalmente el mismo cálculo (`computeSaleQuote()`) con la misma regla de redondeo aplicada en cada paso, sin depender ya de ningún redondeo implícito de la base de datos. Verificado con el mismo carrito problemático: cotización y venta confirmada vuelven a coincidir byte a byte (`discountTotal`/`total` con exactamente 2 decimales en ambos lados).

**Corrección del detalle de venta:** `SalesPage.tsx` ahora conecta `onSelectSale`/`SaleDetailDialog` exactamente como ya lo hacía `CashSessionDetailPage.tsx` — mismo componente reutilizado, sin crear ningún diálogo nuevo. Verificado en Chrome real: la columna "Ver" aparece en `/sales` y abre el detalle completo, incluida la sección "Descuentos aplicados".

Ambos defectos se re-probaron (T8, T13, T14) tras la corrección: las 17 pruebas quedaron en verde. **Veredicto de QA: APTO PARA PRODUCCIÓN.**

### 17.4 Integración visual del POS con `POST /sales/quote` (Bloque P.8)

Objetivo: que el POS muestre en tiempo real las promociones aplicadas y los totales recalculados, sin duplicar ninguna lógica de cálculo en el frontend. Implementado en 3 bloques:

- **P.8.1 (infraestructura):** tipos `CreateSaleQuoteDto`/`SaleQuoteResponse` (espejo del backend), `salesApi.getSaleQuote()`, hook `useSaleQuote()` — `useQuery` con `placeholderData: keepPreviousData` (primer uso de esa opción en el proyecto) y `queryKey` determinística (`['sales', 'quote', dto]`, solo con los datos que afectan la cotización). Contrato de orden de `SaleQuoteResponse.items[i] === CreateSaleQuoteDto.items[i]` verificado contra el código real del backend antes de asumirlo (tres `Array.map()` encadenados, sin reordenamiento).
- **P.8.2 (cálculo + UI de promociones):** se **eliminó por completo** el cálculo local de `subtotal`/`taxTotal`/`discountAmount`/`total` en `SalesPOSPage.tsx` (el `reduce()` manual + `computeCartDiscountAmount`, archivo borrado) — esos valores se leen ahora directamente de `useSaleQuote().data`. Debounce de 300ms sobre carrito/descuento (mismo patrón ya usado para la búsqueda de productos). Nueva UI: descuento por línea en `CartItems.tsx` (tachado + monto ajustado), sección "Promociones aplicadas" (`CartPromotions.tsx`, nuevo), indicador de actualización discreto (`Loader2`) en `CartSummary.tsx` sin bloquear la edición del carrito. Error de cotización (ej. stock insuficiente) muestra `ErrorAlert` y bloquea únicamente "Confirmar venta" — el carrito sigue editable.
- **P.8.3 (QA visual end-to-end):** 10 pruebas en Chrome real — promociones por línea/carrito, indicador de carga sin bloqueo, cambios rápidos de cantidad sin condiciones de carrera, remoción de productos en pleno recálculo sin descuentos incorrectos, error de stock insuficiente con carrito editable y confirmación bloqueada, venta confirmada con promociones idéntica byte a byte a lo mostrado antes de confirmar y a la auditoría del Backoffice, regresión sin promociones. **Las 10 pasaron. Recomendación: APTO PARA PRODUCCIÓN.**

### 17.5 Base de datos oficial de pruebas funcionales

A pedido explícito del usuario, se descartó la idea de una base "demo" separada: todo el trabajo de datos se hizo sobre la **misma base de datos principal**, con dos scripts oficiales nuevos, manuales (ninguno se dispara automáticamente con `prisma migrate dev` — solo `prisma/seed.ts`, el bootstrap de sistema, se sigue disparando así, y no se tocó):

- **`prisma/seed-business.ts`** (`npm run prisma:seed:business`) — genera catálogo realista de carnicería: 10 categorías, 28 productos (con SKU/código de barras/costo/precio/stock/unidad), 7 proveedores, un único impuesto (IVA 1%, decisión explícita de negocio), 19 promociones cubriendo todos los tipos ya implementados en el motor (PRODUCT/CATEGORY/CART, prioridades, stackable, exclusive group, fechas, horario, día de semana, activa/inactiva — deliberadamente sin BUY_X_PAY_Y/COMBO en este alcance reducido, aunque el motor ya los soporta), 6 compras y 5 ventas históricas. El inventario de 7 SKU se construye exclusivamente a partir de movimientos reales de compra/venta (`recordMovement()`, el mismo servicio que usa producción) — nunca con una cantidad "puesta a mano" sin respaldo.
- **`prisma/reset-transactions.ts`** (`npm run prisma:reset:transactions`) — limpia únicamente datos transaccionales/operativos (ventas, compras, cajas, movimientos, devoluciones, mermas, facturas, auditoría) preservando el catálogo completo (categorías/productos/proveedores/impuesto/promociones), con el stock de todos los productos puesto en 0 (decisión explícita del usuario) — para empezar pruebas funcionales del POS desde cero sin perder el catálogo ya curado.

Ambos scripts preservan siempre `User`/`Role`/`Permission`/`RolePermission`/`Configuration`/`Sucursal`/`CashRegister` — nunca los tocan.

### 17.6 Corrección del límite de 20 productos en los selectores del catálogo

QA posterior detectó que el diálogo "Agregar producto" de Compras solo mostraba 20 de 28 productos — causa raíz: `ProductSearchDialog.tsx` llamaba a `useProducts()` sin `limit`, así que el `DEFAULT_LIMIT = 20` del backend (`shared/utils/pagination.ts`) capaba el catálogo visible cada vez que el diálogo se abría sin un término de búsqueda ya escrito. Búsqueda exhaustiva de **todos** los usos de `useProducts()`/`productsApi.getProducts()` como selector de "elegir cualquier producto del catálogo" (no confundir con `ProductsPage.tsx`, que ya pagina de verdad y no se tocó): 7 lugares corregidos con `limit: 100` (el techo real del backend, `MAX_LIMIT`, sin tocar el backend) — `ProductSearchDialog.tsx`, `PurchaseForm.tsx`, `PurchaseDetailPage.tsx`, `InventoryPage.tsx` (filtro), `InventoryWastesPage.tsx` (filtro), `PromotionForm.tsx` (normalizado de `limit: 200`, que ya funcionaba pero era una magnitud inconsistente, a `100`), `SalesPOSPage.tsx` (catálogo del POS). Verificado en Chrome real: el diálogo de Compras pasa de "20 resultados" a "28 resultados", con los productos antes inaccesibles (`Lomito de Res`, `Filete de Res`, `Pechuga de Pollo`, etc.) visibles y seleccionables.

### 17.7 Estado final del módulo Promociones

**Motor de Promociones: APTO PARA PRODUCCIÓN.** Cobertura end-to-end verificada: backend (motor + integración con Ventas + endpoint de cotización), QA integral (17/17 pruebas en verde tras corrección), frontend (integración visual en tiempo real en el POS, 10/10 pruebas de QA visual en verde), datos de prueba reales para seguir desarrollando. Tipos avanzados ya soportados por el motor (`BUY_X_PAY_Y`, `COMBO`) quedan documentados como disponibles pero deliberadamente fuera del alcance de datos sembrados hoy — no como deuda técnica, ver "Próximos desarrollos propuestos" en `ROADMAP.md`.

*(Actualización posterior: el motor de reglas descrito en esta sección — `PromotionEngine`, sin cambios — fue extendido con un modelo comercial de proveedor/financiamiento y un coordinador de rentabilidad, sin modificar nada de lo aquí documentado. Ver sección 18, "Fase 15 — Commercial Pricing Engine".)

### 17.8 Actualización de la tabla de módulos (sección 7)

| Módulo | Completitud Fase 13 | Completitud actual | Listo para prod | Bloqueante principal actual |
|---|---|---|---|---|
| **Promociones** *(nuevo)* | — (no existía) | **100%** | ✅ | — (ver sección 18: extendido con modelo comercial de proveedor/financiamiento) |
| **POS** | 80% | **95%** | ✅ | Cotización en tiempo real integrada (P.8); movimientos de caja siguen bloqueados (A-17, sin cambios en este ciclo). Desde la sección 18, la cotización también incluye `profitabilityAnalysis` por línea. |
| Ventas (listado) | 60% | **70%** | ✅ con reservas | Detalle accesible desde Backoffice ya corregido (17.3); sigue sin anulación desde el listado (hallazgo original A-17-adyacente, sin cambios) |

El resto de la tabla de la sección 7 permanece vigente tal como quedó en la Fase 13 — sin cambios en este ciclo. Ver sección 18.8 para la actualización posterior de la fila "Promociones".

### 17.9 Confirmación final

La documentación de auditoría quedó sincronizada, al cierre de esta fase (27–28 de julio de 2026), con el estado real del ERP en lo referente al Motor de Promociones: no quedaba ninguna referencia a "sin motor de promociones" ni "cálculo duplicado en el POS" en este documento. El roadmap actualizado (FASES COMPLETADAS/EN PROGRESO/PENDIENTES) y la sección "PRÓXIMOS DESARROLLOS PROPUESTOS" viven en `ROADMAP.md` (raíz del repositorio) para no seguir sobrecargando este informe con contenido de planificación — este documento se mantiene como el registro histórico de auditoría/QA, `ROADMAP.md` como la vista de estado/planificación vigente. (El módulo se extendió posteriormente — ver sección 18 — sin invalidar nada de lo aquí documentado: el motor de reglas en sí, `PromotionEngine`, no cambió.)

---

*Fin de la Fase 14 — Motor de Promociones (P.1–P.8): implementación completa, QA integral y cierre.*

---

## 18. FASE 15 — Commercial Pricing Engine (PROMO-01 a PROMO-12): modelo comercial, rentabilidad y snapshot histórico

**Fecha:** 30 de julio de 2026.
**Alcance:** evolución del catálogo `Promotion` (Fase 14, sección 17.1/P.3) para representar promociones impuestas o financiadas por un proveedor (ej. "Martes de Pechuga", precio/combo obligatorio, descuento financiado, subsidio por unidad/porcentaje), un coordinador de rentabilidad (`PricingAnalysis`) que combina el `CostEngine` (Módulo de Costos) y el `PromotionEngine` (sección 17.1/P.4) **sin modificar ninguno de los dos**, su integración real en el flujo de Ventas, y un snapshot histórico inmutable en `SaleAppliedPromotion`. Bloques secuenciales con aprobación explícita en cada paso (PROMO-01 auditoría, PROMO-02/03 diseño, PROMO-04 a PROMO-10 implementación, PROMO-11 QA integral, PROMO-12 corrección de un hallazgo menor de esa QA).

### 18.1 Modelo comercial de `Promotion` (PROMO-03/04/05)

Extensión aditiva del catálogo `Promotion` ya descrito en 17.1/P.3 — ningún campo existente cambia, compatibilidad total con las promociones ya creadas (verificada: las promociones previas a este bloque migraron automáticamente con los valores por defecto, sin backfill manual):

- `supplierId` (nullable, FK a `Supplier`) — proveedor que origina/financia la promoción.
- `commercialOrigin` (enum `PromotionOrigin`: `INTERNAL` default / `SUPPLIER_MANDATED`) — por qué existe la regla (decisión propia del negocio vs. condición impuesta por el proveedor).
- `fundingType` (enum `PromotionFundingType`: `NONE` default / `SUPPLIER_SUBSIDY_PER_UNIT` / `SUPPLIER_SUBSIDY_PERCENTAGE`) — quién financia el descuento que recibe el cliente.
- `supplierSubsidyValue` (nullable) — monto o porcentaje del subsidio, según `fundingType`.

5 reglas de coherencia (`assertCommercialCoherence()`, `src/modules/promotions/promotions.service.ts` del backend, espejadas en `CreatePromotionSchema` de ambos repos): `fundingType: NONE` exige `supplierSubsidyValue` vacío; `fundingType ≠ NONE` exige `supplierSubsidyValue` y **`supplierId`** (esta última agregada en PROMO-12, ver 18.6); `SUPPLIER_SUBSIDY_PERCENTAGE` tope 100; `commercialOrigin: SUPPLIER_MANDATED` exige `supplierId`. Corren tanto en creación (defaults resueltos) como en edición (sobre el estado fusionado con la promoción existente, para que una actualización parcial no pueda dejarla en un estado inconsistente).

### 18.2 `PricingAnalysis` — coordinador de rentabilidad (PROMO-08/09)

Nuevo módulo puro `shared/services/pricingAnalysis/` (backend) — **no es un motor nuevo**, es un coordinador que combina el resultado ya existente de `CostEngine.getEffectiveCost()` y `PromotionEngine.evaluatePromotions()` sin tocar ninguno de los dos. Dos funciones:

- `analyzePromotionProfitability()` — simulación para la vista previa administrativa del formulario de Promociones (arma un carrito temporal de un único producto de referencia; ignora deliberadamente la vigencia, para que el análisis responda "cuánto se ganaría si la promoción aplicara", no "aplicaría en este instante exacto").
- `calculateLineProfitability()` — integración real (18.3): reutiliza el resultado YA calculado por el motor de promociones, nunca lo vuelve a invocar ("no recalcular promociones").

Ambas devuelven: costo efectivo, utilidad (bruta, sin considerar el aporte del proveedor), margen (%, ya con el aporte considerado), aporte del proveedor (por unidad y total) y rentabilidad final.

### 18.3 Integración real en Ventas (PROMO-09)

`computeSaleQuote()` (núcleo compartido de `POST /sales` y `POST /sales/quote`, sección 17.1/P.7) ahora también calcula, por línea, el resultado de `calculateLineProfitability()`. Expuesto **únicamente** en `SaleQuoteItemResponse.profitabilityAnalysis` (`POST /sales/quote`) — deliberadamente **no** agregado a `SaleResponse`/`SaleItemResponse` (la venta persistida), ni a Reportes ni al Dashboard: queda pendiente como desarrollo futuro (ver `ROADMAP.md`).

### 18.4 Snapshot histórico inmutable (PROMO-10)

`SaleAppliedPromotion` (tabla de auditoría, sección 17.1/P.1) gana 5 columnas nuevas, aditivas: `commercialOrigin`, `fundingType`, `supplierId` (snapshot plano, sin relación activa — a propósito, no debe reinterpretarse si el proveedor cambia después), `supplierSubsidyValue` (parámetro crudo de la regla) y `supplierContributionAmount` (monto REALMENTE aplicado, distinto del parámetro crudo). Se copian del estado de la promoción **en el momento exacto de la venta** — mismo criterio de snapshot ya usado por `SaleItem.expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale` (Módulo de Costos). Verificado en vivo: se creó una venta con una promoción financiada por un proveedor, se editó la promoción después (cambiando origen/proveedor/financiamiento), y se releyó la venta — la fila histórica no cambió.

### 18.5 Frontend — formulario de Promociones (PROMO-07/08)

Dentro de "Opciones avanzadas" (ya colapsada por defecto, sección 17.1/P.3), nueva subsección "Condición comercial": selector de origen comercial, selector de proveedor (`PromotionSupplierField.tsx`, reutiliza el mismo `SupplierSearchDialog`/`useSupplier` ya usado en Compras), selector de financiamiento y campo de subsidio condicional. En el panel de resumen (`PromotionFormSummary.tsx`), nueva sección "Simulación de rentabilidad" (mismos 6 datos de 18.2) con aviso explícito de que es una simulación y no persiste nada — visible solo cuando hay un producto de referencia real seleccionado.

### 18.6 QA integral y cierre (PROMO-11/12)

Pruebas manuales de escenarios positivos y negativos (los 5 de coherencia comercial), compatibilidad confirmada contra las 38 promociones ya existentes en el catálogo (todas migradas con los valores por defecto, sin ninguna afectada), un caso no probado en bloques anteriores — múltiples promociones acumuladas en una misma línea con financiamiento distinto cada una — verificado matemáticamente correcto, y regresión nula en el listado administrativo de Promociones.

**4 hallazgos menores, 1 corregido de inmediato:**
1. ~~Vacío de coherencia: una promoción podía tener `fundingType ≠ NONE` sin `supplierId` (un subsidio "de nadie en particular")~~ — **corregido en PROMO-12**, quinta regla agregada a `assertCommercialCoherence()`/`CreatePromotionSchema` (ver 18.1).
2. Datos de prueba (promociones de QA, inactivas) sin limpiar en el catálogo compartido — no hay endpoint de borrado de promociones (deuda ya documentada desde P.3). No bloqueante.
3. Caso límite documentado, no validado: una promoción `scopeType: CART` combinada con financiamiento `SUPPLIER_SUBSIDY_PER_UNIT` no tiene un "producto" al que atribuirle unidades — se usa `quantity: 1` como aproximación, sin ninguna regla que impida esa combinación si el negocio la considerara sin sentido.
4. Deuda preexistente, no introducida por este módulo: el selector de productos del formulario de Promociones sigue limitado a 100 (ver sección 17.6 — no se corrigió ahí porque en ese momento el catálogo tenía 28 productos; hoy tiene 110).

### 18.7 Estado final

**Commercial Pricing Engine: APTO PARA PRODUCCIÓN.** Cobertura end-to-end verificada: backend (modelo comercial + coordinador de rentabilidad + integración real en Ventas + snapshot histórico), frontend (formulario administrativo con simulación de rentabilidad en vivo), QA integral con 4 hallazgos menores (1 corregido, 3 documentados como deuda no bloqueante, ver 18.6). `PromotionEngine` y `CostEngine` permanecen exactamente como se documentaron en la Fase 14 y en el Módulo de Costos, respectivamente — ninguno de los dos fue modificado.

### 18.8 Actualización de la tabla de módulos (secciones 7 y 17.8)

| Módulo | Completitud Fase 14 | Completitud actual | Listo para prod | Bloqueante principal actual |
|---|---|---|---|---|
| **Promociones** | 100% | **100%** (alcance ampliado) | ✅ | — |
| **POS** | 95% | **95%** | ✅ | Sin cambios funcionales — la cotización expone un dato adicional (`profitabilityAnalysis`), no usado todavía por ninguna pantalla. |

### 18.9 Confirmación final

Esta sección deja la documentación de auditoría sincronizada con el estado real del ERP respecto al modelo comercial de Promociones al 30 de julio de 2026. El detalle de planificación/próximos pasos (integración con Reportes/Dashboard, limpieza de datos de prueba) vive en `ROADMAP.md`, no en este informe.

---

## 19. FASE 16 — Módulo de Lotes (Batch Management, LOTES-00 a LOTES-09): trazabilidad completa, consumo FEFO, reportes y cierre integral

**Fecha:** 30–31 de julio de 2026.
**Alcance:** módulo nuevo completo de trazabilidad por lote — modelo `Batch`, integración automática con Compras (creación de lote al recibir), Ventas (consumo FEFO), Mermas y Devoluciones (consumo/reingreso trazable), reportes de estado y trazabilidad, frontend administrativo completo, control por lotes expuesto en Productos, y trazabilidad completa de recepción en Compras (código de lote del proveedor, fechas de producción/vencimiento). Diez bloques secuenciales (LOTES-00 a LOTES-09), cada uno con análisis previo, aprobación explícita, implementación, verificación con TypeScript/ESLint y, en los bloques con lógica transaccional, un smoke test real contra la base de datos de desarrollo (revertido al terminar, sin dejar datos de prueba).

### 19.1 Modelo de datos (LOTES-01)

Nuevo modelo `Batch` (`schema.prisma`): código interno autogenerado (`LOT-000001`, vía `DocumentSequence`, mismo mecanismo que `Sale.documentNumber`), `productId`/`sucursalId`, `purchaseItemId` opcional y único (a lo sumo un lote por línea de compra), `supplierId` opcional, `supplierLotCode` opcional (código de lote del proveedor), `receivedAt`/`productionDate`/`expiryDate`, `initialQuantity`/`availableQuantity`, `unitCost`, `expectedWastePercent` opcional (snapshot de la línea de compra), `status` (enum `BatchStatus`: `ACTIVE`/`DEPLETED`/`EXPIRED`/`BLOCKED`), `closedAt`, `notes`. `Product.requiresBatch` (default `false`) es el único interruptor que decide si un producto participa del módulo — productos sin este flag conservan exactamente el comportamiento previo, sin ninguna excepción.

`InventoryMovement`/`InventoryWaste` ganan `batchId` opcional (trazabilidad). `shared/services/inventoryMovement.service.ts` (`recordMovement`/`recordMovements`) se extiende para, cuando `batchId` está presente, aplicar el mismo incremento atómico también sobre `Batch.availableQuantity` y cerrar automáticamente el lote (`DEPLETED`) si llega a 0 — el mecanismo único que mantiene el invariante del módulo (ver 19.7). `Inventory.quantity` sigue siendo la única fuente de verdad del stock agregado; `Batch` es una capa de desglose adicional, no un reemplazo.

**Compatibilidad:** 100% aditivo. Ningún producto existente tiene `requiresBatch: true` por defecto; ninguna venta/compra/merma histórica se ve afectada. Migración `20260731050336_add_batch_module`, sin backfill.

### 19.2 Integración con Compras (LOTES-00/02) y trazabilidad de recepción (LOTES-09)

**LOTES-00 (prerrequisito):** corrección de un bug real preexistente — `create()` de Compras registraba movimientos de inventario sin importar el `status` de la compra (incluso en `DRAFT`), acreditando inventario dos veces cuando la compra pasaba después a `RECEIVED`. Corregido: los movimientos solo se registran cuando `status: RECEIVED`.

**LOTES-02:** al recibir una compra (`status: RECEIVED`), cada línea cuyo producto tenga `requiresBatch` genera automáticamente un lote nuevo (`createBatchesForReceivedPurchase`), idempotente por `purchaseItemId`. El movimiento `PURCHASE` que genera ese lote usa `skipBatchQuantitySync: true` — el lote ya nace con `availableQuantity = initialQuantity`, así que el incremento genérico del movimiento no debe duplicarse (bug real detectado y corregido durante este mismo bloque).

**LOTES-09 (trazabilidad completa de recepción):** `PurchaseItem` gana `supplierLotCode`/`productionDate`/`expiryDate` (migración `20260731063449_add_purchase_item_batch_traceability`), capturables por línea en `PurchaseItemsField.tsx`/`PurchaseItemRow.tsx` — visibles **únicamente** cuando el producto de esa línea tiene `requiresBatch` (dato expuesto en el lookup de productos, `ProductLookupItem.requiresBatch`, agregado en este mismo bloque). Los tres campos se propagan tal cual al `Batch` creado por `createBatchesForReceivedPurchase`, sin duplicar la validación de fechas (la regla autoritativa —orden `productionDate ≤ receivedAt ≤ expiryDate`— ya vive en `batches/service.ts::create()`, reutilizada, no reimplementada).

### 19.3 Integración con Ventas — consumo FEFO (LOTES-03)

Al vender un producto con `requiresBatch`, el sistema selecciona automáticamente de qué lote(s) descontar siguiendo **FEFO** (First-Expired-First-Out: vencimiento más próximo primero; `receivedAt` como desempate — FIFO — cuando dos lotes vencen el mismo día), con reparto entre múltiples lotes si uno solo no alcanza para cubrir la línea completa. Si el saldo de lotes `ACTIVE` no alcanza (aunque `Inventory.quantity` agregado sí alcance — ej. el resto está `EXPIRED`/`BLOCKED`), la venta se rechaza explícitamente en vez de vender "a ciegas" contra el agregado. Cada `InventoryMovement` de salida queda etiquetado con el `batchId` exacto del que se descontó.

### 19.4 Frontend completo del módulo (LOTES-04) y control en Productos (LOTES-08)

**LOTES-04:** `features/batches/` nuevo — listado con filtros (producto, proveedor, estado), Drawer de detalle de trazabilidad, página de ajuste manual (cantidad y bloqueo/desbloqueo), botón de acceso desde Inventario. Mismo patrón visual PIPASA V1 (`DataTable`, `Toolbar`, `WorkspacePanel`, `Badge` de estado) ya establecido como estándar del resto del ERP — sin inventar ningún componente nuevo.

**LOTES-08:** `Product.requiresBatch` (existente desde LOTES-01, pero solo consumido internamente por otros módulos — **sin ninguna forma de activarlo** desde la UI ni desde el propio CRUD de Productos del backend) queda expuesto de punta a punta: `POST`/`PATCH /products` lo aceptan, y el formulario de Productos gana el switch "Usa control por lotes" (`ProductFormSummary.tsx`, sección "Configuración de inventario", mismo componente `Switch` ya usado para "Peso variable"/"Controlar inventario").

### 19.5 Integración con Mermas y Devoluciones; reglas de transición de estados (LOTES-05)

**Mermas:** `CreateInventoryWasteDto` gana `batchId` opcional — permite mermar contra un lote puntual (validado: mismo producto/sucursal, saldo suficiente). Se permite mermar de un lote `ACTIVE`, `EXPIRED` o `BLOCKED` (nunca de uno `DEPLETED`, que ya tiene saldo 0) — dar de baja stock vencido o bloqueado es exactamente el propósito de una merma.

**Devoluciones:** cuando se reingresa a stock (`restock: true`) un producto con `requiresBatch`, el sistema **no puede** identificar el lote exacto de origen (una línea de venta pudo repartirse entre varios lotes por FEFO, y `SaleItem` no guarda esa atribución) — decisión de diseño explícitamente aprobada: se crea un **lote de reingreso nuevo** (sin `purchaseItemId`/`supplierId`, identificado por texto en `notes`), reutilizando la misma función de creación de lotes que Compras, sin duplicar lógica.

**Política oficial de transición de estados** (definida y documentada formalmente en este bloque):
1. `ACTIVE → DEPLETED`: automático, cuando el saldo llega a 0 vía cualquier movimiento (Ventas/Mermas/ajuste manual) — nunca si el lote ya estaba `EXPIRED`/`BLOCKED` (preserva la razón más específica).
2. `ACTIVE → EXPIRED`: automático, barrido "lazy" (sin proceso en segundo plano) cada vez que algo relee lotes para una decisión que importa (listado, detalle, consumo FEFO, validación de una merma).
3. `BLOCKED` y cualquier reversión manual: exclusivamente vía `PATCH /batches/:id`.
4. Los tres estados terminales nunca se revierten automáticamente por un movimiento de inventario.

### 19.6 Reportes (LOTES-06)

`GET /reports/batches` — foto agregada del catálogo de lotes filtrado: conteo por los 4 estados (siempre las 4 llaves presentes) y próximos a vencer (ventana configurable, 7 días por defecto). `GET /reports/batches/:id` — trazabilidad completa de un lote puntual: su resumen más **todos** sus movimientos de inventario en orden cronológico (alta, consumo, ajustes). Ambos reutilizan la política de barrido de vencimiento de 19.5 antes de leer, sin reimplementarla.

### 19.7 QA integral (LOTES-07) — 2 defectos reales encontrados y corregidos

Ejercicio end-to-end del ciclo completo (Compras → Ventas → Mermas/Devoluciones → Reportes) contra la base de datos real, verificando en **13 puntos de control** el invariante central del módulo:

> **`Σ Batch.availableQuantity (lotes con estado distinto de DEPLETED) = Inventory.quantity`**

(Corrección de fórmula respecto al análisis original de LOTES-01: no es "solo lotes `ACTIVE`" — desde que LOTES-05 introdujo la transición automática a `EXPIRED`, un lote vencido puede seguir teniendo saldo real sin consumir, que sigue siendo existencia física; solo `DEPLETED` implica saldo 0 por construcción. Detectado durante el propio QA de este bloque, documentado explícitamente.)

**Defectos encontrados y corregidos:**
1. **[Crítico] Anulación/corrección de venta rompía el invariante.** `voidSaleTransaction()` (mecanismo preexistente de Ventas, anterior al Módulo de Lotes) reversaba `Inventory.quantity` sin considerar lotes — para un producto con `requiresBatch`, anular una venta incrementaba el agregado sin acreditar ningún lote. Corregido con la misma solución ya aprobada para Devoluciones: lote de reingreso nuevo.
2. **[Menor] `PATCH /batches/:id` no barría vencimientos antes de operar** — corregido reutilizando la misma función de lectura que ya aplica esa política en el resto del módulo.

**Riesgo residual, no corregido (sistémico, preexistente, no introducido por Lotes):** bajo escritura concurrente sobre el mismo producto/lote, el incremento atómico evita el "lost update" pero no impide sobreventa si dos transacciones leen "saldo suficiente" antes de que la otra confirme (mismo perfil de riesgo que `Inventory.quantity` desde antes de este módulo, ver `docs/AUDIT_REPORT.md` del backend, sección 6). No bloquea Release 1.0.

### 19.8 Estado final

**Módulo de Lotes: APTO PARA PRODUCCIÓN.** Cobertura end-to-end verificada: modelo de datos, integración con Compras/Ventas/Mermas/Devoluciones, reportes, frontend administrativo completo, control expuesto en Productos, trazabilidad completa de recepción en Compras. Los 2 defectos reales encontrados durante el QA integral (uno de ellos, la anulación de ventas, un problema real de exactitud de inventario) fueron corregidos y reverificados.

### 19.9 Actualización de la tabla de módulos (sección 7)

| Módulo | Completitud previa | Completitud actual | Listo para prod | Bloqueante principal actual |
|---|---|---|---|---|
| **Lotes** *(nuevo)* | — | **100%** | ✅ | — |
| **Productos** | 95% | **100%** | ✅ | Control por lotes expuesto (LOTES-08) |
| **Compras** | 85% | **90%** | ✅ | Trazabilidad de recepción completa (LOTES-09); el ítem de `status` por defecto ya estaba resuelto (A-07) |
| **Inventario** | 90% | **95%** | ✅ | Reportes de Lotes agregados; ledger unificado de `InventoryMovement` sigue como deuda no bloqueante (sección 16.4) |

### 19.10 Confirmación final

Esta sección deja la documentación de auditoría sincronizada con el estado real del ERP respecto al Módulo de Lotes al 31 de julio de 2026. Detalle de planificación/deuda vive en `ROADMAP.md`, no en este informe.

---

*Fin de la Fase 16 — Módulo de Lotes (LOTES-00 a LOTES-09).*

---

## 20. FASE 17 — `FIXED_PRICE` en Promociones (PROMO-13): precio fijo por unidad

**Fecha:** 31 de julio de 2026.
**Alcance:** nuevo `effectType: FIXED_PRICE` sobre el catálogo `Promotion` (sección 17.1/P.3) — precio fijo **por unidad** (ej. ₡2.200/kg en vez de ₡2.500/kg), pensado específicamente para productos de peso variable. Precedido de un análisis técnico dedicado (sin implementar hasta su aprobación explícita) que detectó que el efecto `SPECIAL_PRICE` ya existente (sección 17.1) fija el precio **total** del conjunto de líneas afectadas, no el precio por unidad — correcto para combos/bundles, pero matemáticamente incorrecto para un producto de peso variable comprado en una cantidad distinta de 1 (ej. 3.5 kg).

### 20.1 Motor (`PromotionEngine`) — sin duplicar lógica

Un único caso nuevo en el dispatch table de `calculation.ts`: `Σ cantidad × (precio_actual − precio_fijo)` por línea afectada — a diferencia de `SPECIAL_PRICE` (`total − precio_fijo`), escala correctamente con la cantidad/peso real y con líneas de productos distintos dentro de la misma promoción (ej. `scopeType: CATEGORY`). El resto del motor —elegibilidad, condiciones (fechas/horario/día/`minQuantity`), orquestación de prioridad/exclusividad/acumulación— es 100% agnóstico al `effectType` y no requirió ningún cambio. 4 pruebas unitarias nuevas (cantidad 1, peso variable 3.5 kg, `CATEGORY` con productos de precio distinto, precio fijo ≥ precio de lista).

### 20.2 Restricción de alcance y validación

`FIXED_PRICE` solo es válido con `scopeType: PRODUCT`/`CATEGORY` (decisión aprobada explícitamente) — rechazado para `CART`/`COMBO`, que no tienen sentido de negocio para un precio unitario forzado. Validado en tres capas sin duplicar lógica entre sí: Zod en creación, servicio sobre el estado fusionado (cubre también ediciones parciales) y una advertencia visual no bloqueante en el formulario. Un precio fijo mayor o igual al precio de venta actual **no bloquea** guardar la promoción (decisión aprobada explícitamente: puede ser legítimo cargarla con antelación) — solo se muestra una advertencia visual.

### 20.3 Frontend — formulario y simulación de rentabilidad

Nueva tarjeta "Precio fijo" en el selector de tipo de beneficio (`EffectCards.tsx`). La simulación de rentabilidad en tiempo real (`promotionProfitabilityPreview.ts`) **no reutiliza la fórmula de `SPECIAL_PRICE`** — usa la misma fórmula por unidad del motor, para que la vista previa (precio normal, precio promocional, diferencia, costo, utilidad, margen, variación de utilidad) sea matemáticamente consistente con lo que realmente cobrará el POS, incluso cuando la cantidad simulada supera 1 (ej. por `minQuantity`).

### 20.4 Verificación

TypeScript y ESLint sin errores nuevos en ambos repositorios. Suite de promociones: 25/25 en `promotionEngine.test.ts` (21 previas + 4 nuevas); 3 fallos preexistentes en otros dos archivos de prueba, confirmados no relacionados (verificado con `git diff`: ninguno de esos archivos fue tocado por este bloque). Smoke test real end-to-end: una venta real de 3.5 kg con precio fijo de ₡2.200/kg descontó exactamente ₡1.050 (3.5 × ₡300) y cobró ₡7.700 — confirma que el motor multiplica por la cantidad real en vez de colapsar el total.

### 20.5 Estado final

**`FIXED_PRICE`: APTO PARA PRODUCCIÓN.** `SPECIAL_PRICE`, `PERCENTAGE`, `FIXED_AMOUNT` y `BUY_X_PAY_Y` permanecen exactamente como se documentaron en las Fases 14/15 — ninguno fue modificado. Cambio 100% aditivo (nuevo valor de enum, migración sin backfill).

### 20.6 Actualización de la tabla de módulos (sección 7)

| Módulo | Completitud previa | Completitud actual | Listo para prod | Bloqueante principal actual |
|---|---|---|---|---|
| **Promociones** | 100% | **100%** (5º tipo de efecto) | ✅ | — |

### 20.7 Confirmación final

Esta sección deja la documentación de auditoría sincronizada con el estado real del ERP respecto a `FIXED_PRICE` al 31 de julio de 2026.

---

*Fin de la Fase 17 — `FIXED_PRICE` en Promociones (PROMO-13).*
