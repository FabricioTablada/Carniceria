# Arquitectura del Backend — Sistema POS Carnicería (Costa Rica)

> Documento de diseño arquitectónico. **No contiene lógica de negocio, controladores, rutas ni modelos escritos.** Describe estructura, responsabilidades y estrategia de crecimiento.

---

## 1. Contexto y fuerzas que dominan el diseño

Cinco restricciones confirmadas moldean toda la arquitectura:

1. **Offline-first.** El backend corre _on-premise_ en la sucursal. PostgreSQL local es la **fuente de verdad**. Debe operar sin Internet. (2026-08-03: `carniceria-pos-desktop` empaqueta esta topología completa como app de escritorio para Windows — ver su `README.md` — sin cambiar nada de lo decidido acá.)
2. **Preparado para multi-sucursal y sincronización.** Toda tabla transaccional lleva `sucursal_id`, `created_at`, `updated_at`, `deleted_at` (soft delete) y `sync_status` desde el día 1. PK = **UUID**.
3. **Power BI se conecta directo a PostgreSQL** (a vistas SQL), no a la aplicación.
4. **Solo software libre**, respetando el stack obligatorio: Node.js, Express, PostgreSQL, JWT, bcrypt, dotenv, Git.
5. **Arquitectura limpia, modular y mantenible.** Nada mezclado. Diseñar bien ahora para no rehacer después.

---

## 2. Estilo arquitectónico elegido: **Monolito Modular por Dominio + Capas Limpias**

Se combinan dos patrones que se complementan:

- **Modularidad vertical (por dominio):** el código se organiza en `src/modules/`, un módulo por contexto de negocio (productos, ventas, caja…). Cada módulo es autocontenido.
- **Capas limpias (horizontal) dentro de cada módulo:** cada módulo respeta el mismo flujo `routes → controller → service → repository`. La lógica de negocio (service) nunca conoce HTTP, y el acceso a datos (repository) nunca conoce reglas de negocio.

### ¿Por qué esta combinación y no otra?

| Alternativa                                                                 | Por qué se descarta                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todo por capas globales (`/controllers`, `/services`, `/models` en la raíz) | Al crecer a 15+ módulos, cada carpeta se vuelve un basurero de 40 archivos sin relación. Difícil de navegar y mantener.                                                                                                                 |
| Microservicios                                                              | Imposible/contraproducente en un equipo pequeño con requisito **offline en una sola máquina**. Añade complejidad de red que contradice el objetivo.                                                                                     |
| **Monolito modular (elegido)**                                              | Un solo despliegue (ideal para _on-premise_), pero con fronteras internas claras por dominio. Se despliega como una unidad, pero se desarrolla y crece como piezas independientes. Es el patrón profesional para este escenario exacto. |

**Beneficio clave para tu requisito #7 (crecimiento):** agregar un módulo nuevo = **crear una carpeta**, sin tocar los módulos existentes. El acoplamiento se mantiene bajo por diseño.

---

## 3. Árbol de carpetas completo

> **Nota (31 de julio de 2026):** el proyecto es TypeScript desde su origen — las
> extensiones `.js` de este árbol en versiones anteriores del documento eran
> incorrectas; todo el código real usa `.ts`. La lista de módulos también
> creció respecto a la versión original de este documento (Sprint 2): ver la
> nota al final del árbol y la tabla completa en §5.

```
carniceria-pos-backend/
│
├── src/
│   ├── config/                  # Configuración central de la aplicación
│   │   ├── env.ts               # Carga y VALIDA variables de entorno (dotenv)
│   │   ├── database.ts          # Parámetros de conexión a PostgreSQL
│   │   ├── jwt.ts               # Config de firma/expiración de tokens
│   │   ├── cors.ts              # Política CORS
│   │   ├── logger.ts            # Configuración del logger (pino)
│   │   ├── rateLimitPolicies.ts # Políticas de rate limiting por ruta
│   │   ├── productImages.ts     # Configuración de almacenamiento de imágenes de producto
│   │   └── index.ts             # Punto único de exportación de config
│   │
│   ├── database/                # Infraestructura de persistencia
│   │   ├── prisma.client.ts     # Instancia ÚNICA (singleton) de Prisma Client
│   │   ├── extensions/          # Client Extensions de Prisma
│   │   │   ├── softDelete.ext.ts   # Soft delete global (deleted_at)
│   │   │   ├── timestamps.ext.ts    # created_at / updated_at automáticos
│   │   │   └── syncStatus.ext.ts    # Marca sync_status en escrituras
│   │   └── index.ts
│   │
│   ├── shared/                  # Código transversal reutilizable (sin dominio)
│   │   ├── errors/              # Jerarquía de errores de la aplicación
│   │   │   ├── AppError.ts
│   │   │   ├── NotFoundError.ts
│   │   │   ├── ValidationError.ts
│   │   │   ├── UnauthorizedError.ts
│   │   │   ├── ForbiddenError.ts
│   │   │   ├── ConflictError.ts
│   │   │   └── index.ts
│   │   ├── utils/               # Utilidades puras y sin estado
│   │   │   ├── httpResponse.ts  # Formato estándar de respuesta API
│   │   │   ├── asyncHandler.ts  # Wrapper para capturar errores async
│   │   │   ├── pagination.ts    # Helper de paginación
│   │   │   ├── money.ts         # Manejo de CRC con Decimal (nunca float); incluye `roundMoney()` (§6.8)
│   │   │   ├── uuid.ts          # Generación/validación de UUID
│   │   │   ├── date.ts
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── roles.constants.ts
│   │   │   ├── auditActions.constants.ts
│   │   │   ├── httpStatus.constants.ts
│   │   │   └── index.ts
│   │   └── services/            # Servicios transversales compartidos
│   │       ├── audit.service.ts       # Registro central de auditoría (lo usan todos)
│   │       ├── inventoryMovement.service.ts  # Único punto que registra `InventoryMovement` (y, si aplica, ajusta `Batch`)
│   │       ├── promotionEngine/       # Motor puro de promociones (§5, fila `promotions`)
│   │       ├── pricingAnalysis/       # Coordinador de rentabilidad (§5, fila `promotions`)
│   │       └── costEngine/            # Motor de costo efectivo (Módulo de Costos)
│   │
│   ├── middlewares/             # Middlewares de Express (transversales)
│   │   ├── authenticate.middleware.ts  # Verifica JWT
│   │   ├── authorize.middleware.ts     # Control de acceso por rol (RBAC)
│   │   ├── validate.middleware.ts      # Ejecuta esquemas de validación (zod)
│   │   ├── audit.middleware.ts         # Captura eventos HTTP auditables
│   │   ├── errorHandler.middleware.ts  # Manejador global de errores
│   │   ├── notFound.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── index.ts
│   │
│   ├── modules/                # ← El corazón del sistema: un dominio por carpeta
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── categories/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── inventoryWaste/
│   │   ├── suppliers/
│   │   ├── purchases/
│   │   ├── sales/
│   │   ├── returns/
│   │   ├── batches/
│   │   ├── processing/          # Módulo de Despiece, plan v3 (Bloques 1-3 cerrados 08/08/2026)
│   │   ├── promotions/
│   │   ├── cash/
│   │   ├── cashRegister/
│   │   ├── taxes/
│   │   ├── settings/          # carpeta vacía, huérfana — reemplazada por `configuration/`, ver nota abajo
│   │   ├── configuration/
│   │   ├── documents/
│   │   ├── invoicing/
│   │   ├── integrations/
│   │   │   └── alegra/       # Facturacion Electronica real (Bloques 7.1-7.20, ver §6.9)
│   │   ├── notifications/
│   │   ├── sync/                # Cola de salida (outbox) + worker (Bloque 4, ver §6.4)
│   │   ├── audit/
│   │   ├── reports/
│   │   └── index.ts            # Registro central de módulos (agrega routers)
│   │
│   ├── jobs/                   # Tareas programadas (horario FIJO — node-cron)
│   │   ├── backup.job.ts       # Respaldo automático vía pg_dump
│   │   ├── scheduler.ts        # Registro de cron (node-cron)
│   │   └── index.ts
│   │
│   ├── app.ts                  # Construye la app Express (middlewares + rutas)
│   └── server.ts               # Arranca el servidor y los jobs
│
├── prisma/
│   ├── schema.prisma           # Definición del modelo de datos (fuente de verdad)
│   ├── migrations/             # Migraciones versionadas y reproducibles
│   ├── seed.ts                 # Fix 07/08/2026: bootstrap NO destructivo (sucursal, roles/permisos, admin, config) + catalogo base (categorias/impuestos) — SOLO instalacion fresca, ya no siembra proveedores/productos/inventario/promociones
│   ├── seed-demo.ts            # Fix 07/08/2026: dataset de demostracion (6 proveedores, 80 productos + inventario, 6 promociones), movido tal cual desde seed.ts — DESTRUCTIVO, exclusivamente manual (`npm run prisma:seed:demo`), nunca conectado al instalador
│   ├── seedShared.ts           # Fix 07/08/2026: seedCategories()/seedTaxes(), compartidas sin duplicar entre seed.ts y seed-demo.ts (ninguno de los dos puede importar al otro: ambos se auto-ejecutan al importarse)
│   ├── permissionsBootstrap.ts # Fix 05/08/2026: catalogo de permisos + matriz de roles (upsert puro), usado por seed.ts Y por seed-permissions.ts
│   ├── seed-permissions.ts     # Fix 05/08/2026: punto de entrada standalone, solo Permission/Role/RolePermission — seguro en CADA arranque
│   └── sql/
│       └── views/              # Vistas SQL para Power BI (reporting)
│
├── scripts/                    # Scripts operativos
│   └── db-init.sh
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── setup.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── AUDIT_REPORT.md
│   ├── BACKEND_QA.md
│   ├── DEPLOYMENT.md
│   └── LOAD_TESTING.md
│
├── logs/                       # Salida de logs (gitignored)
├── backups/                    # Respaldos generados (gitignored)
│
├── .env.example
├── .env                        # (gitignored)
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── package.json
└── README.md
```

**Módulos agregados después de la versión original de este árbol (Sprint 2),
todos siguiendo el mismo patrón de capas de §4:** `permissions` (permisos
granulares, separado de `roles`), `inventoryWaste` (documento de negocio de
mermas, distinto del asiento `InventoryMovementType.WASTE`), `returns`
(devoluciones de venta), `batches` (Módulo de Lotes), `promotions` (Motor de
Promociones), `cashRegister` (CRUD de la caja registradora física, separado
de `cash` que modela la sesión de apertura/cierre), `configuration`
(parámetros por sucursal — reemplazó a `settings/`, que hoy es una carpeta
vacía y huérfana, sin ningún archivo; candidata a eliminarse físicamente en
una futura limpieza), `documents`
(numeración consecutiva y generación de PDF compartida entre Ventas/Compras/
Lotes, vía `DocumentSequence`), `invoicing` (generación de comprobantes/PDF
imprimibles — **no** es la integración de Facturación Electrónica real del
sistema, ver más abajo), `integrations/alegra` (**Facturación Electrónica
real, vía Alegra — Bloques 7.1–7.20, cerrado 04/08/2026, ver §6.9**),
`notifications` (avisos internos, ej. próximos vencimientos de lotes). Ver
§5 para el detalle de cada uno.

---

## 4. Anatomía de un módulo (patrón repetible)

**Todos** los módulos de `src/modules/` siguen la misma estructura interna. Ejemplo con `products/`:

```
products/
├── products.routes.ts       # SOLO define endpoints y encadena middlewares → controller
├── products.controller.ts   # Adaptador HTTP: lee req, llama al service, devuelve respuesta
├── products.service.ts      # Lógica de negocio pura (reglas, validaciones de dominio)
├── products.repository.ts   # Único punto que habla con Prisma para este dominio
├── products.validation.ts   # Esquemas de entrada (zod) para cada endpoint
└── index.ts                 # Expone el router del módulo
```

**Nota:** algunos módulos más recientes (`configuration`, `returns`, entre
otros) usan nombres de archivo genéricos (`controller.ts`, `service.ts`, sin
prefijo de dominio) en vez de `dominio.capa.ts` — inconsistencia de
nomenclatura menor, ya identificada como deuda técnica preexistente
(`docs/AUDIT_REPORT.md`, hallazgo 1.1, sección 7).

### Responsabilidad de cada capa

| Archivo           | Conoce HTTP | Conoce negocio | Conoce la BD | Responsabilidad única                                                                 |
| ----------------- | :---------: | :------------: | :----------: | ------------------------------------------------------------------------------------- |
| `*.routes.ts`     |      ✔      |       ✘        |      ✘       | Mapear URL + método + middlewares → método del controller.                            |
| `*.controller.ts` |      ✔      |       ✘        |      ✘       | Traducir `req/res` ↔ llamada al service. Sin reglas de negocio.                       |
| `*.service.ts`    |      ✘      |       ✔        |      ✘       | Reglas de negocio, orquestación, transacciones. **No sabe qué es Express ni Prisma.** |
| `*.repository.ts` |      ✘      |       ✘        |      ✔       | Acceso a datos vía Prisma. Único lugar con queries.                                   |
| `*.validation.ts` |      —      |       —        |      —       | Contrato de entrada: forma y tipos de los datos que llegan.                           |

**Regla de oro:** las dependencias apuntan hacia adentro. `routes → controller → service → repository → Prisma`. Nunca al revés. Un service jamás importa un controller; un repository jamás contiene una regla de negocio. Esto es lo que garantiza que "nada esté mezclado".

---

## 5. Los módulos y su mapeo a tus requisitos

Algunos módulos consolidan varios items de tu lista bajo un mismo **contexto de negocio** (patrón de _agregado_), porque son la misma unidad transaccional:

| Módulo       | Requisitos que cubre                   | Nota de diseño                                                                                              |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `auth`       | Login                                  | Separado de `users`: autenticación (emisión/validación de JWT, bcrypt) ≠ gestión de usuarios.               |
| `users`      | Usuarios                               | CRUD de usuarios y asignación de roles.                                                                     |
| `roles`      | Roles                                  | RBAC por rol. `authorize.middleware` es lo único que realmente autoriza hoy — ver `permissions` abajo.      |
| `permissions` | Permisos granulares                   | Módulo separado de `roles` (creció después de la versión original de este documento): CRUD de `Permission`/`RolePermission`. **Actualizado:** `authorizePermission()` quedó conectado a la mayoría de endpoints del proyecto (Fase 19) — cada `<módulo>/routes.ts` declara su propio permiso junto al middleware de autenticación, mismo patrón que la política de rate limiting por endpoint (ver §6.7). Un subconjunto de endpoints administrativos/sensibles (ej. `POST /inventory`, `PATCH /sales/:id`, `/audit`) sigue usando `authorize(<rol>)` por rol en vez de por permiso — mezcla deliberada, no deuda pendiente (antes cerraba `docs/AUDIT_REPORT.md` hallazgo 1.2; ver sección 15 de ese informe). |
| `categories` | Categorías                             | Clasificación de productos.                                                                                 |
| `products`   | Productos                              | Incluye unidad de medida (kg / unidad), precio por kg, código de barras, **peso variable de balanza** y `requiresBatch` (control por lotes, ver fila `batches`).     |
| `inventory`  | Inventario + Movimientos de Inventario | El movimiento es la operación; el stock es su consecuencia. Mismo agregado. La escritura de movimientos está centralizada en `shared/services/inventoryMovement.service.ts` (`recordMovement`/`recordMovements`), consumida también por Compras/Ventas/Mermas/Devoluciones — no solo por este módulo. |
| `inventoryWaste` | Mermas (documento de negocio)      | Módulo separado de `inventory`: `InventoryWaste` es el documento con contexto de negocio (motivo, notas, valorización) detrás del asiento `InventoryMovementType.WASTE`. Puede asociarse a un lote puntual (`batchId`, ver fila `batches`). |
| `suppliers`  | Proveedores                            | Además de `purchases`, tiene relación inversa con `promotions` (Commercial Pricing Engine) y con `batches` (trazabilidad de origen del lote).                                                             |
| `customers`  | Clientes (Bloques 8.1–8.5)             | Módulo convencional (`customers.controller/service/repository.ts`), mismo patrón exacto que `suppliers`. Global, sin `sucursal_id` (ERP de una sola sucursal, decisión explícita del Bloque 8.1). Consumido por `sales` (relación opcional `Sale.customerId`, "Público General" = `null`, ver fila `sales`) y por `integrations/alegra` (resolución/vinculación de contacto real para Factura Electrónica, ver §6.9/§6.10) — ninguno de los dos importa lógica de `customers` más allá de leer el registro por id, mismo criterio de acceso directo entre módulos que el resto de la tabla. |
| `purchases`  | Compras                                | Compra + detalle de compra (raíz agregada + líneas). Al recibirse (`status: RECEIVED`), genera automáticamente lotes para productos con `requiresBatch` (ver fila `batches`).                                                        |
| `sales`      | Ventas + Detalle de Venta              | Venta = raíz agregada; el detalle es hijo. Se guardan en una sola transacción. Consume `promotions` (vía adaptador) y `batches` (consumo FEFO) sin importarlos directamente en más de un punto (`sales/service.ts`). Desde el Bloque 8.3, `customerId` opcional (valida que el cliente exista al crear, `null` = "Público General"); una corrección de venta preserva el `customerId` original.                             |
| `returns`    | Devoluciones de venta                  | Módulo separado de `sales` (creció después de la versión original de este documento): reingreso a stock de una línea de venta devuelta, con creación de un lote de reingreso cuando el producto tiene `requiresBatch` y no es posible identificar el lote exacto de origen. |
| `batches`    | Módulo de Lotes / Batch Management (LOTES-00 a LOTES-09) | Módulo convencional (`batches.controller/service/repository.ts`) que añade trazabilidad por lote sobre el inventario existente, activada por producto vía `Product.requiresBatch` — sin ese flag, un producto se comporta exactamente como antes de este módulo. **Tres puntos de integración, cada uno consumiendo `batches` sin que `batches` conozca a sus consumidores:** `purchases/service.ts` (crea un lote por línea al recibir, propagando `supplierLotCode`/`productionDate`/`expiryDate`), `sales/service.ts` (selecciona lote(s) por FEFO al vender, con reparto entre varios lotes si es necesario) e `inventory`/`inventoryWaste`/`returns` (Mermas/Devoluciones consumen o reingresan contra un lote puntual). El mecanismo único que mantiene el invariante `Σ Batch.availableQuantity (status ≠ DEPLETED) = Inventory.quantity` vive en `shared/services/inventoryMovement.service.ts`: cuando un movimiento trae `batchId`, aplica el mismo incremento atómico también sobre el lote. |
| `processing` | Módulo de Despiece (plan v3, Bloques 1-3 ✅ cerrados 08/08/2026; Bloque 4 en adelante, pendiente) | Transforma un producto/lote de entrada (canal completo) en N productos de salida (cortes/subproductos, cada uno con su propio `Batch` nuevo enlazado por `Batch.parentBatchId`) más líneas de merma explícitas (`ProcessingWasteItem`). Módulo de primer nivel (`/processing`, no subordinado a `inventory` a diferencia de `batches`/`inventoryWaste`). El costo total del canal se distribuye entre las salidas por el método de valor relativo de venta (última línea absorbe el residuo de redondeo, mismo algoritmo que `promotions/promotionApplication.service.ts::translateEngineResult`); el balance `inputQuantity = Σsalidas + Σmermas` es una igualdad exacta validada con `Prisma.Decimal`. Reutiliza `recordMovement`/`reserveIfSufficient` (sin duplicar lógica de inventario) y `createBatchService`/`findByIdBatchService` de `batches` vía su barrel — `parentBatchId` se asigna directamente desde `processing/repository.ts::linkOutputBatchParent` (Prisma directo, dentro de la transacción de `complete()`), sin extender `batches/types.ts`. Ver `ROADMAP.md` (repo `carniceria-pos-front`), sección "MÓDULO DE DESPIECE", para el detalle completo bloque por bloque. |
| `promotions` | Motor de Promociones y Descuentos (Bloques P.1–P.7) + Commercial Pricing Engine (PROMO-01 a PROMO-12) + `FIXED_PRICE` (PROMO-13) | **Tres capas dentro del mismo módulo, dependencia en una sola dirección:** `shared/services/promotionEngine/` (motor puro — elegibilidad/condiciones/cálculo/prioridad, sin Prisma, sin conocer `Sales`) ← `promotions/promotionApplication.service.ts` (único adaptador hacia Ventas) ← `sales/service.ts` (nunca importa el motor directamente, solo el adaptador). El CRUD del catálogo (`promotions.controller/service/repository.ts`) es un módulo convencional aparte, sin lógica de aplicación. `promotions.service.ts` valida además la coherencia del modelo comercial (proveedor/origen/financiamiento, `assertCommercialCoherence()`) y, desde PROMO-13, que `FIXED_PRICE` (precio fijo POR UNIDAD, distinto de `SPECIAL_PRICE` que fija el precio TOTAL del conjunto) solo se use con `scopeType: PRODUCT`/`CATEGORY`. Un cuarto módulo, `shared/services/pricingAnalysis/` — **no un motor nuevo**, un coordinador puro que combina el resultado de `promotionEngine` y de `shared/services/costEngine/` (Módulo de Costos) sin modificar ninguno de los dos — calcula utilidad/margen/aporte del proveedor/rentabilidad final, consumido por `sales/service.ts` (`POST /sales/quote`) y por la vista previa administrativa del formulario de Promociones (frontend). |
| `cash`       | Caja + Apertura y cierre de caja       | Sesión de caja, movimientos y arqueo forman un mismo contexto.                                              |
| `cashRegister` | Caja registradora (punto de cobro físico) | Módulo separado de `cash` (creció después de la versión original de este documento): CRUD de `CashRegister`, sobre la que `cash` abre sesiones — mismo criterio de separación agregado/sub-recurso que `sales`/`returns`.                       |
| `taxes`      | (parte de Configuración)               | **Impuestos totalmente configurables.** Ninguna tasa está en el código; se resuelve en runtime desde la BD. |
| `configuration` | Configuración                       | Parámetros por sucursal en formato clave-valor. Reemplazó a `settings/` (ver nota de §3 — carpeta hoy vacía y huérfana). |
| `documents`  | Numeración y generación de documentos  | Módulo transversal nuevo (creció después de la versión original de este documento): `DocumentSequence` (consecutivos por tipo de documento, ej. `Sale.documentNumber`, `Batch.code`) y generación de PDF imprimibles, consumido por `sales`/`purchases`/`batches` sin que ninguno reimplemente su propia numeración. |
| `invoicing`  | Generación de comprobantes/PDF         | **No** es la integración de Facturación Electrónica real del sistema (esa es `integrations/alegra`, fila de abajo) — es utilidad de numeración/armado de PDF/XML de apoyo a `documents`, sin capa HTTP propia (sin `controller`/`routes`). |
| `integrations/alegra` | Facturación Electrónica (Bloques 7.1–7.20) | **Único motor real de facturación electrónica del ERP** (decisión explícita del Bloque 7.1: reemplaza la vía directa a Hacienda, nunca implementada — `invoicing`, fila de arriba, queda como utilidad de apoyo sin uso real). Factura a través de la API de Alegra, no firma/envía XML directo a Hacienda. Ver §6.9 para el detalle arquitectónico completo. |
| `notifications` | Notificaciones internas             | Módulo nuevo (creció después de la versión original de este documento), ej. avisos de lotes próximos a vencer (`batches`, reportes §19 del informe de auditoría del frontend). |
| `audit`      | Auditoría                              | **Lado de lectura** del registro. La escritura es transversal (ver §6).                                     |
| `reports`    | Reportes                               | Reportes rápidos servidos por la API (ej. cierre de caja, lotes, mermas, rentabilidad). El BI pesado va por vistas SQL → Power BI.       |

---

## 6. Cómo encajan los requisitos transversales

### 6.1 Auditoría (requisito #9)

La auditoría es transversal, no un módulo aislado:

- **Escritura:** `shared/services/audit.service.js` es invocado por los _services_ de cada módulo tras acciones importantes (crear/editar/eliminar, cambio de precios, apertura/cierre de caja, compras, ventas, movimientos de inventario). Para eventos HTTP como login/logout, `audit.middleware.js` los captura.
- **Lectura:** el módulo `audit/` expone la consulta del historial.
- Cada registro guarda: usuario, acción, entidad afectada, valor anterior/nuevo, `sucursal_id`, fecha e IP.
- _Ruta de crecimiento:_ si el volumen crece, se migra a un patrón de eventos de dominio (emisor/suscriptor) sin cambiar la interfaz `AuditService.log()`.

### 6.2 Respaldos automáticos (requisito #8)

Diseñados desde el día 1:

- `jobs/backup.job.js` invoca `pg_dump` directamente desde Node (sin bash — Parche 1.0.1) con timestamp hacia `BACKUP_DIR`, validando que el archivo generado exista y tenga tamaño mayor a 0 bytes antes de considerarlo exitoso.
- `jobs/scheduler.js` (node-cron) lo dispara automáticamente en horario configurable (`BACKUP_CRON`).
- El restore (`pg_restore`) se ejecuta desde `carniceria-pos-desktop` (Electron), que es quien orquesta detener el backend, restaurar y volver a levantarlo — ver `README.md` de ese repo, sección "Backup y Restore".
- Al ser _on-premise_, los respaldos son locales hoy y se replicarán a la nube en Fase 2 (mismo job, distinto destino).

### 6.3 Impuestos configurables (requisito #7)

El módulo `taxes` almacena las tasas en la base de datos. Los services de `sales` y `purchases` **resuelven el impuesto en tiempo de ejecución** consultando a `taxes`. **Cero tasas escritas en el código.** Si la legislación cambia, se edita un registro, no el código.

### 6.4 Offline-first y sincronización (decisiones #1 y #2)

- El monolito y PostgreSQL viven en la máquina de la sucursal → funciona sin Internet.
- La columna `sync_status` marca cada fila como pendiente/sincronizada (flag rápido de lectura).
- **Bloque 4 (2026-08-03): mecánica de sincronización real implementada** — tabla `sync_jobs` (patrón outbox, ver `docs/DATABASE.md` §7.1) + un worker permanente (`modules/sync/sync.worker.ts`, no un cron: se despierta de inmediato al encolar un trabajo o al recuperar conectividad, en vez de esperar un intervalo fijo) + un dispatcher de handlers por `jobType` (`modules/sync/sync.handlers/`). El handler real de `CLOUD_PUSH` sigue siendo un *stub* — la API de nube destino ("Fase 2") todavía no está definida — pero la cola, el worker, los reintentos y la recuperación tras reinicio ya están probados end-to-end (ejemplo funcionando: `Sale`, en `modules/sales/service.ts`). Los UUID evitan colisiones entre sucursales al consolidar; `sync_jobs.sucursalId` (denormalizado) permite filtrar/monitorear la cola por sucursal sin coordinación entre ellas — cada sucursal corre su propia instancia on-premise con su propia cola independiente.
- **Mejora futura documentada, NO implementada — "Centro de sincronización":** panel operativo (probablemente un módulo nuevo, `modules/sync` ya expone lo necesario para construir sus endpoints) sobre la misma tabla `sync_jobs`, sin requerir ningún cambio al motor de la cola descrito arriba. Alcance previsto: dashboard con conteo de jobs por estado (`PENDING`/`PROCESSING`/`SYNCED`/`FAILED`), reintento manual de un job puntual, "reintentar todos los fallidos" en lote, historial de sincronización, filtros por `jobType` (Cloud, Hacienda, etc. — el dispatcher ya está preparado para múltiples tipos) y una vista de estado por sucursal (ya soportada por `sync_jobs.sucursalId`, pensada desde este mismo bloque para cuando haya más de una sucursal real). Sin Bloque/Sprint agendado todavía.

**Decisión formal de operación offline.** Todas las operaciones críticas del
negocio —ventas, caja, inventario, productos, clientes, compras y el resto
de los procesos transaccionales— deben funcionar **completamente sin
conexión a Internet**. Esto no es una propiedad emergente del diseño: es un
requisito explícito. El frontend, el backend y PostgreSQL se ejecutan
**localmente, dentro de la sucursal** (ver `DEPLOYMENT.md`), sin ninguna
dependencia de un servicio externo para operar.

Internet queda reservado exclusivamente como **servicio complementario**,
para funciones no críticas: actualizaciones de la aplicación, respaldos
externos, acceso remoto, o la sincronización entre sucursales que
`modules/sync/sync.worker.ts` procesa en segundo plano (ver arriba).
Ninguna de estas funciones condiciona la continuidad operativa del
negocio: si el servicio de Internet cae, la sucursal sigue vendiendo,
cobrando, y administrando su inventario sin interrupción — el worker
simplemente reintenta con backoff hasta que vuelva.

**Power BI no forma parte del flujo operativo del POS** (ver 6.6): consume
la información directamente desde PostgreSQL, en la propia máquina de la
sucursal, con fines exclusivos de análisis y reporting. No participa de
ninguna operación transaccional ni puede afectar la disponibilidad del
sistema — es, en los términos de esta decisión, otro consumidor secundario
de la base de datos local, no un servicio del que el POS dependa.

### 6.5 UUID, soft delete y timestamps (decisión #2)

Se aplican de forma **global y transparente** mediante los _Client Extensions_ de Prisma en `database/extensions/`. Ningún service tiene que recordar filtrar borrados ni poner fechas: el comportamiento es automático para todas las tablas transaccionales.

### 6.6 Power BI (decisión #3)

- Las vistas de reporting se definen en `prisma/sql/views/` y se aplican como migraciones SQL.
- **Power BI se conecta directo a PostgreSQL y lee esas vistas.** La aplicación no interviene en el BI pesado.
- El módulo `reports` cubre solo los reportes operativos que el POS necesita al instante.

### 6.7 Seguridad (requisitos de seguridad)

- `authenticate.middleware` (JWT) protege toda ruta que lo requiera.
- `authorize.middleware` aplica RBAC por rol; `authorizePermission()` (mismo
  archivo) aplica autorización por permiso granular y hoy está conectado a la
  mayoría de endpoints — ver fila `permissions` en §5.
- **Bootstrap de `Permission`/`Role`/`RolePermission`, separado del seed
  completo (fix 05/08/2026, causa raíz demostrada contra una instalación
  real de `carniceria-pos-desktop`).** `prisma/permissionsBootstrap.ts`
  (`seedPermissionsAndRoles()`) contiene el catálogo de permisos y la
  matriz rol→permisos, 100% `upsert` — nunca borra nada, nunca toca
  `Sucursal`/`CashRegister`/`User`/`Configuration` ni el catálogo de
  negocio. `prisma/seed.ts` (instalación fresca) lo invoca como su paso 1,
  sin cambios en su comportamiento; `prisma/seed-permissions.ts` es un
  punto de entrada standalone nuevo que invoca **únicamente** esa misma
  función — pensado para correr en **cada arranque** de una instalación ya
  existente (ver `carniceria-pos-desktop/README.md`, sección "QA.APP.6",
  para el mecanismo completo de por qué hacía falta: las migraciones de
  esquema se aplican en cada arranque, pero antes de este fix los datos de
  `Permission`/`Role`/`RolePermission` quedaban congelados en el `initdb`
  original de cada instalación — cualquier permiso agregado al catálogo
  después de ese momento, como `customers.*` del Módulo de Clientes, nunca
  llegaba a una instalación ya existente en ninguna actualización
  posterior).
- Contraseñas siempre con **bcrypt** (nunca texto plano), gestionadas en `auth`.
- `RefreshToken` (modelo dedicado, hash del token — nunca el JWT completo) con
  rotación y revocación: `tokenVersion` en `User` invalida todos los refresh
  tokens emitidos si cambia (logout, cambio de rol/contraseña, reactivación) —
  ya no es la limitación "sin revocación" que documentaba una versión anterior
  de este informe (ver `docs/AUDIT_REPORT.md` sección 15).
- `AuditAction` incluye eventos de seguridad negativos (`LOGIN_FAILED`,
  `ACCESS_DENIED`), no solo el "happy path" de acciones exitosas.
- `helmet`, `express-rate-limit` (política por categoría de tráfico —
  `auth`/`salesQuote`/`transactional`/`reports`/`administrative`, ver
  `config/rateLimitPolicies.ts` — declarada por endpoint en cada
  `<módulo>/routes.ts`, no en un único limiter global) y validación con `zod`
  en el borde.

  **Investigación 429 recurrente (03/08/2026, ver `docs/AUDIT_REPORT.md`
  sección 16):** hasta esta fecha las 4 categorías compartían exactamente el
  mismo `windowMs`/`max` (heredado de `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`)
  pese a tener patrones de tráfico completamente distintos — en particular,
  `POST /sales/quote` (cotización del carrito, se llama varias veces por
  cada venta finalizada) competía por el mismo cupo que `POST /sales` (la
  venta real) bajo `transactional`, agotándolo mucho antes de completar un
  turno normal de ~60 ventas. Se agregó una 5ª categoría, `salesQuote`
  (propia de `POST /sales/quote`), y cada una de las 5 pasó a tener su
  propio par de variables de entorno independientes
  (`RATE_LIMIT_QUOTE_*`/`RATE_LIMIT_TRANSACTIONAL_*`/`RATE_LIMIT_REPORTS_*`/
  `RATE_LIMIT_ADMINISTRATIVE_*`, ver `config/env.ts`), calibradas al volumen
  real de cada grupo de endpoints en vez de compartir un único valor
  genérico. Detalle completo de la investigación y la implementación en
  `docs/AUDIT_REPORT.md` sección 16.

  **Cierre de la etapa de estabilización (03/08/2026, ver `docs/AUDIT_REPORT.md`
  sección 17):** esta recalibración, junto con la corrección del agotamiento
  del pool de Prisma (sección 16.1), fue validada bajo dos niveles de prueba
  de uso real (`load-tests/realistic-session/`, ver `docs/LOAD_TESTING.md`
  sección 8) — una sesión realista de cajero (~12 min, 39 ventas, 0 errores)
  y una jornada intensiva (~26 min, 184 ventas, 59 compras >₡8M cada una, 85
  anulaciones, 59 correcciones, 41 devoluciones, 0 errores de cualquier
  tipo). Con ambos niveles aprobados, **la etapa de estabilización del
  backend queda oficialmente cerrada** — la siguiente gran etapa del
  proyecto es Electron (ver `ROADMAP.md`).

  **Cookie httpOnly del refresh token — `sameSite: 'none'`/`secure: true`
  incondicional (fix QA.APP.1, 05/08/2026, ver
  `carniceria-pos-desktop/README.md` sección "QA.APP.1–QA.APP.4"):**
  `refreshTokenCookieOptions` (`config/env.ts`) usaba antes
  `sameSite: 'lax'`/`secure: isProduction` — funcionaba en localhost/web
  (frontend y backend comparten "site") pero nunca dentro de la app de
  escritorio Electron, cuyo renderer vive en el esquema propio `app://bundle`
  — un sitio distinto de verdad al del backend (`http://127.0.0.1:*`), y
  `SameSite=Lax` nunca viaja en una petición cross-site que no sea una
  navegación de nivel superior. La sesión se perdía siempre que el access
  token expiraba dentro de Electron, y en cada reinicio de esa app. El nuevo
  valor (`secure: true` incondicional, ya no atado a `isProduction`) sigue
  funcionando sobre loopback sin TLS real gracias a que Chromium trata
  `localhost`/`127.0.0.1` como origen confiable — validado en vivo, sin
  regresión en el flujo web/localhost (`SameSite=None` es estrictamente más
  permisivo que `Lax`, nunca más restrictivo).

  **`NODE_ENV`/`isProduction` acoplado sin querer a dos cosas distintas —
  hallazgo de la misma auditoría (fix QA.APP.2, 05/08/2026):** antes de este
  fix, `carniceria-pos-desktop` forzaba `NODE_ENV=development` en **toda**
  instalación empaquetada real (motivo original: la cookie de arriba
  necesitaba eso para funcionar sobre HTTP plano) — efecto colateral no
  buscado: cada instalación real corría permanentemente con el rate limit de
  login relajado (`LOGIN_RATE_LIMIT_MAX_DEV = 1000` en vez de las 5 tentativas
  reales, `middlewares/rateLimit.middleware.ts`), el detalle de errores no
  controlados expuesto al cliente (`isProduction ? undefined : String(error)`,
  `middlewares/errorHandler.middleware.ts`), y logging de cada query de
  Prisma (`config/database.ts`). Con la cookie ya resuelta arriba, dejó de
  hacer falta forzar `development` — corregido enteramente del lado de
  Electron (`NODE_ENV` condicionado a si la instalación está empaquetada),
  **sin ningún cambio en este backend**. Validando ese fix se encontró,
  además, que `INTEGRATIONS_ENCRYPTION_KEY` (requerida sin default desde la
  integración con Alegra, §6.9) nunca se inyectaba a una instalación
  empaquetada — **ninguna instalación real podía arrancar el backend en
  absoluto**, hallazgo también corregido enteramente en `carniceria-pos-desktop`
  (`app-secrets.ts` ahora la genera y persiste igual que el resto de los
  secretos). Ninguno de los dos hallazgos de este párrafo requirió ni motivó
  ningún cambio de código en este repositorio.

  **`POST /auth/verify-password` — Bloque 7.24 (05/08/2026), seguridad de
  sesión del escritorio.** Síntoma real reportado: al reiniciar la app de
  escritorio, la sesión se restaura sola (refresh silencioso vía la cookie
  httpOnly de arriba, que sobrevive al cierre del proceso) y entra directo al
  POS, incluida una `CashSession` real que sigue abierta en el backend — sin
  pedir contraseña. El diseño aprobado corrige esto enteramente del lado del
  frontend/Electron (el backend no puede ni debe distinguir "reinicio de la
  app" de "recarga en caliente", ver `ROADMAP.md` Bloque 7.24) **excepto** por
  una pieza real de backend: la pantalla de bloqueo automático por inactividad
  necesita verificar la contraseña del usuario ya autenticado, sin generar
  ningún efecto secundario de un login real. Se investigó explícitamente si
  reutilizar `login()` alcanzaba — **no**: `login()` está detrás de
  `loginRateLimiter` (5 intentos/15min, sin `keyGenerator` propio → por IP), y
  en esta arquitectura on-premise todo el tráfico llega desde el mismo
  loopback, así que ese cupo lo comparte el terminal **entero**, no cada
  usuario — un puñado de intentos fallidos al desbloquear dejaría a
  cualquiera (incluido el admin) sin poder iniciar sesión en esa máquina por
  15 minutos; además `login()` emite y persiste un refresh token nuevo sin
  revocar el anterior, y registra `AuditAction.LOGIN`, indistinguible de un
  inicio de sesión real. `verifyPassword()` (`auth.service.ts`) reutiliza
  `authRepository.findById` (ya existente, sin duplicar lógica) y
  `bcrypt.compare` (mismo criterio que `login()`, sin extraer una función
  compartida nueva — es la única otra llamada real en todo el módulo), detrás
  de `authenticate` (no es superficie anónima) y `authRateLimiter` (mismo cupo
  generoso que `/refresh`/`/logout`, 300/15min). Nunca emite ni rota tokens,
  nunca toca la cookie de refresco. Un intento fallido reutiliza
  `AuditAction.LOGIN_FAILED` ya existente (sin migrar el enum); uno exitoso no
  se audita (no es un evento de autenticación nuevo). Sin cambios de esquema,
  sin migración.

### 6.8 Dinero (decisión #6)

CRC se maneja con el tipo `Decimal` de PostgreSQL/Prisma y el helper `shared/utils/money.js`. **Nunca** con punto flotante.

**Redondeo (actualizado, cierre del Motor de Promociones):** `shared/utils/money.ts` expone `roundMoney()` — 2 decimales, mitad hacia arriba — como única fuente de verdad de redondeo monetario del lado `Prisma.Decimal` del dominio. Hasta el cierre del Bloque P.7, ninguna operación de ese archivo redondeaba explícitamente: el "redondeo" dependía del efecto secundario de Postgres al truncar una columna `Decimal(_,2)` al persistir, lo que quedó expuesto como un defecto real (`docs/AUDIT_REPORT.md`, sección 11) el día que `POST /sales/quote` empezó a devolver cálculos sin pasar por la base de datos. El motor de promociones (`shared/services/promotionEngine/calculation.ts`), que trabaja deliberadamente con `number` en vez de `Prisma.Decimal`, mantiene su propia `roundCurrency()` — misma regla matemática, implementación separada porque son tipos de dato distintos, no duplicación accidental.

### 6.9 Integración con Alegra — Facturación Electrónica (Bloques 7.1–7.20, cerrado 04/08/2026; extendida en Bloques 8.4–8.5; Tiquete Electrónico retirado y `payments`/`numberTemplate` corregidos el 07/08/2026, ver esos párrafos abajo)

El ERP emite comprobantes electrónicos reales, aceptados por Hacienda, a
través de la API de [Alegra](https://developer.alegra.com/) (Costa Rica,
v4.4) — **no** firma ni
envía XML directo a Hacienda (esa vía nunca se implementó; `invoicing/`
queda como utilidad de apoyo sin uso real, ver §5). Toda la lógica vive en
`src/modules/integrations/alegra/`, el único módulo del backend que se
comunica con un servicio de terceros — ningún otro módulo instancia HTTP
hacia afuera, y `integrations/alegra` nunca conoce Prisma de otro dominio
más allá de leer/escribir directamente `AlegraConfig`, `Sale` y `Product`
(mismo criterio de acceso directo entre módulos ya usado por `categories`/
`promotions`/`purchases`/`reports`/`sales`/`taxes` sobre `Product`, ver §5).

**Un único cliente HTTP** (`alegra.client.ts`, `createAlegraClient()`):
Basic Auth (correo + token), timeout de 10s, y el único lugar que traduce
errores de Axios a la jerarquía de `shared/errors/` (`ExternalServiceError`,
nuevo en el Bloque 7.3, 502; `UnauthorizedError` para 401/403 de Alegra).
Toda operación de negocio del módulo construye su cliente a través de
`buildClientFromConfig()` (`alegra.service.ts`) — nunca instancia Axios por
su cuenta.

**Configuración persistente y cifrada** (Bloque 7.4): correo, token y URL
base se guardan en una única fila (`AlegraConfig`, patrón "singleton" — ver
`docs/DATABASE.md` §3.9), configurable desde Configuración → Facturación
Electrónica → Alegra en el frontend. El token **nunca se guarda en texto
plano**: se cifra con AES-256-GCM (`alegra.crypto.ts`, `env.INTEGRATIONS_ENCRYPTION_KEY`,
64 caracteres hex — primer secreto reversible de este backend; los dos
precedentes existentes, `User.passwordHash`/`RefreshToken.tokenHash`, son
hash de una vía, solo para verificar, no reutilizables aquí porque el token
debe poder recuperarse en texto plano para autenticar cada llamada saliente).
Guardar sin token conserva el ya guardado — el formulario nunca vuelve a
mostrarlo, solo un valor enmascarado (`maskSecret()`).

**Resolución automática y permanente de cliente y productos** (Bloques 7.5
y 7.6, mismo patrón para ambos): la primera vez que se necesita, se busca
por el criterio más estable disponible (contacto "Cliente General" por
nombre exacto; producto por `sku`/`reference`, con `name` como respaldo si
no tiene SKU) y, si no existe, se crea — el ID resultante se persiste
(`AlegraConfig.genericClientId` / `Product.alegraProductId`) **antes** de
devolverlo. Cualquier llamada posterior lee ese ID directo, sin volver a
tocar la red — es el mecanismo que garantiza "nunca duplicados" sin
necesidad de ninguna cola ni job de reconciliación.

**Emisión BAJO DEMANDA, ya NO automática al confirmar una venta** (Bloque
7.17, corrige el diseño original del Bloque 7.11): `sales/service.ts` ya no
dispara nada — el flujo del POS es venta → guardar local → imprimir ticket
→ fin, sin ninguna llamada a Alegra en ese camino. La emisión se dispara
únicamente cuando el usuario la pide explícitamente, desde Ventas →
Documentos ("Emitir comprobante electrónico"), vía
`POST /integrations/alegra/sales/:saleId/emit` → `emitInvoice(saleId)`
(`@/modules/integrations/alegra`, misma función de siempre, sin cambios de
lógica) — es el único punto de contacto entre `sales` y Alegra; todo lo
demás (resolver cliente/productos, armar el payload, interpretar errores)
sigue exclusivamente dentro de `integrations/alegra`. Si la emisión falla
(red, autenticación, validación de Alegra, CABYS faltante), el error se
devuelve directo al usuario que la pidió (ya no hay "fire and forget": al
ser una acción explícita bajo demanda, hay un usuario esperando la
respuesta HTTP) — `Sale.alegraInvoiceId` queda en `null`, lista para
reintentar desde el mismo botón. **Deliberadamente sin cola de trabajos ni
reintento automático** — a diferencia del mecanismo de sincronización de
`sync_jobs` (§6.4), que si se decide usar para esto en el futuro
necesitaría un `jobType`/handler nuevo sin tocar el motor de la cola.

**Solo Factura Electrónica — Tiquete Electrónico retirado por completo
(Fix 07/08/2026, decisión de negocio, supera Bloques 7.13/7.14/8.4):**
`emitInvoice(saleId)` ya no recibe ni infiere ningún `documentType` — toda
emisión es Factura Electrónica. Una venta sin cliente identificado
(`Sale.customerId === null`, "Público General") **no puede emitir ningún
comprobante electrónico**: el guard `if (!sale.customerId) throw
ConflictError(...)` corta la función antes de resolver nada ni de llamar a
Alegra, porque Factura Electrónica exige identificación real por regla de
Hacienda. `resolveGenericClient()`/`findGenericClient()`/
`createGenericClient()`/`ALEGRA_GENERIC_CLIENT_NAME` quedaron **sin ningún
llamador real** tras este cambio — identificados como código muerto,
todavía no eliminados (ver deuda técnica más abajo). Con cliente asociado,
se resuelve su contacto real vía `resolveCustomerAlegraId(customerId)`
(Bloque 8.4, sin cambios: mismo patrón "resolver una vez, persistir para
siempre", busca por `identificationNumber` con filtrado exacto, crea si no
existe, persiste en `Customer.alegraContactId`). El módulo `customers`
sigue sin conocer Alegra en ningún momento.

**`numberTemplate.id` se resuelve dinámicamente en cada emisión — cero IDs
hardcodeados (Fix 07/08/2026):** los `id` de plantilla estaban hardcodeados
como constantes desde los Bloques 7.13/8.4; una investigación real de un
`402`/código `907` de Alegra ("Esta acción no se puede realizar en tu plan
actual") encontró que esos IDs quedaban desactualizados sin que nada lo
detectara. `resolveElectronicNumberTemplateId(client)` reemplaza las
constantes: llama `GET /number-templates` en cada emisión (sin cache, sin
persistencia — mismo criterio que `resolveAlegraTaxId`) y exige, los cuatro
a la vez, `documentType === 'invoice'`, `isElectronic === true`, `status ===
'active'` e `isDefault === true`. Confirmado con evidencia real: la cuenta
tenía dos plantillas de Factura Electrónica simultáneas (`isElectronic:
true`), una vieja inactiva y la vigente activa/principal — `status`/
`isDefault` son los dos campos que las distinguen; `documentType`/
`isElectronic` solos no alcanzaban. Si no hay ninguna coincidencia, o hay
más de una, `emitInvoice` falla con un `ValidationError` claro **antes** de
construir el `POST /invoices` — nunca asume ni toma la primera en silencio.
Ver §6.10 para el detalle completo de la integración con el módulo de
Clientes.

**Código CABYS obligatorio por producto** (Bloque 7.12): Hacienda exige un
código CABYS (`Product.cabysCode`, 13 dígitos, catálogo oficial del
Ministerio de Hacienda) por línea de factura — sin él, Alegra rechaza la
emisión (`POST /items`, código `1093`). Capturado en el formulario de
Productos, obligatorio en creación; productos existentes antes de este
bloque quedan con `cabysCode: null` hasta que se edite manualmente (sin
backfill ni valor inventado — nunca se envía un código CABYS por defecto).

**`payments` eliminado del payload de `POST /invoices` (Fix 07/08/2026,
supera Bloques 7.18/7.19):** la cuenta real de este ERP está en el plan
"Solo Facturación Pro" de Alegra, que **no incluye el módulo de Bancos** —
confirmado directamente por soporte de Alegra. Enviar `payments[].account.id`
(que exige una cuenta de ese módulo) causaba el rechazo `402`/código `907`
("Esta acción no se puede realizar en tu plan actual") en el `100%` de los
intentos de emisión, sin importar que el resto del payload fuera válido.
Se eliminó el campo `payments` por completo del `POST /invoices`, junto con
todo el código que existía únicamente para construirlo:
`resolveAlegraAccountId()`, `PAYMENT_METHOD_TO_ACCOUNT_KIND`,
`AlegraPaymentAccountKind` — los tres borrados, no dejados inertes.
**Consecuencia aceptada, no un bug:** la factura queda "Por cobrar" en
Alegra en vez de pagada automáticamente; no hay forma de evitarlo con el
plan actual de la cuenta. `AlegraConfig.cashAccountId`/`bankAccountId`
(columnas de base de datos, Bloque 7.19) quedaron sin ningún código que las
lea o escriba — identificadas como muertas, no eliminadas todavía (ver
`docs/DATABASE.md` §3.9 y deuda técnica).

**Consulta de estado, descarga de PDF/XML y reenvío por correo** (Bloques
7.8–7.10 y 7.20, expuestos por HTTP en `/integrations/alegra`, ver
`docs/API.md`): `checkInvoiceStatus` relee `GET /invoices/{id}` y actualiza
`alegraInvoiceStatus`/`alegraElectronicKey`/`alegraIssuedAt` solo cuando
cambian — nunca sobrescribe con `null` si Alegra no devuelve un campo, y la
clave electrónica, una vez completada, no se vuelve a tocar (necesario
porque el timbrado es asíncrono: la respuesta de `POST /invoices` puede
volver antes de que Hacienda termine de validar). El PDF y el XML
(`GET .../invoice-pdf` / `.../invoice-xml`) **nunca se cachean ni se
persisten** — cada solicitud del frontend vuelve a pedírselos a Alegra
(`GET /invoices/{id}?fields=pdf|xml`, que devuelve una URL, no el binario
directo) a través del mismo cliente autenticado; el frontend solo conoce el
`saleId`, nunca la URL ni las credenciales de Alegra. Ambas descargas
comparten exactamente el mismo repositorio, validación, manejo de errores y
permiso (`sales.view`) — una sola función interna (`downloadInvoiceFile`)
parametrizada por `fields`/extensión, sin lógica duplicada entre las dos.
El reenvío por correo (`POST .../email` → `POST /invoices/{id}/email` de
Alegra) opera sobre el comprobante **ya existente**, identificado por
`Sale.alegraInvoiceId` — no lo recrea ni lo vuelve a timbrar, no hay
ninguna comunicación nueva con Hacienda en ese paso (confirmado contra la
documentación oficial del endpoint); el correo del destinatario nunca se
persiste en esta llamada (el body sigue siendo `{ emails: string[] }`, sin
guardar nada nuevo). Desde el Bloque 8.4, cuando la venta tiene un cliente
asociado con correo cargado (`Customer.email`), el frontend lo usa
automáticamente y ya no lo pide a mano (ver §6.10) — el backend no cambió:
sigue siendo el mismo endpoint, el mismo body, la misma ausencia de
persistencia; el correo real vive únicamente en `Customer.email` (módulo de
Clientes), nunca duplicado en `integrations/alegra`.

**Descarga de archivos (PDF/XML): bug de autenticación corregido (Bloque
8.5).** `downloadInvoiceFile` reutilizaba el cliente HTTP autenticado de
Alegra (`createAlegraClient()`, con Basic Auth) para descargar la URL de
archivo que Alegra devuelve — funciona para el PDF, pero la URL del XML es
típicamente una URL **prefirmada de S3**, con su propia autenticación en la
query string; Axios adjunta la config `auth` a *cualquier* request de esa
instancia, sin importar el host de destino, así que S3 recibía un
`Authorization` adicional no deseado y lo rechazaba (`400`, "Only one auth
mechanism allowed"). Corregido usando un `axios.get()` sin credenciales
para ese paso específico — la URL que devuelve Alegra ya es
autosuficiente. Único cambio: la llamada de descarga en sí; `emitInvoice`,
`checkInvoiceStatus`, `sendInvoiceEmail`, resolución de cliente/CABYS/pagos
no se tocaron. `alegra.client.ts` documenta esta excepción explícita a la
regla de "todo pasa por `createAlegraClient()`" de arriba (ver comentario
del archivo).

**Campos agregados** (ver `docs/DATABASE.md` §3.9/§3.2 para el detalle
completo): `AlegraConfig` (tabla nueva, incluye `cashAccountId`/
`bankAccountId` desde el Bloque 7.19), `Product.alegraProductId`,
`Product.cabysCode` (Bloque 7.12), `Sale.alegraInvoiceId`/
`alegraInvoiceNumber`/`alegraElectronicKey`/`alegraInvoiceStatus`/
`alegraIssuedAt`, `Customer.alegraContactId` (Bloque 8.4) — todos nullable,
aditivos, sin backfill.

**Deuda técnica pendiente:**
- El desempate por nombre entre cuentas del mismo `type` (Bloque 7.19,
  ej. "Caja general" vs. "Caja chica") es un heurístico de texto
  (`chica`/`secundari`), no una configuración explícita — funciona en la
  cuenta real probada, pero una empresa con nomenclatura distinta podría
  necesitar el mecanismo de configuración manual que el Bloque 7.19 dejó
  como alternativa no implementada (los IDs, una vez resueltos, se pueden
  corregir a mano directamente en `AlegraConfig` mientras no exista UI).
- Sin cola de reintentos: una emisión fallida requiere que el usuario
  vuelva a presionar el botón manualmente — no hay reintento automático ni
  notificación proactiva de fallo. La reconciliación del Bloque 7.21 (ver
  abajo) no es una cola de reintentos — solo evita una doble emisión real
  cuando el resultado de un intento anterior quedó sin confirmar.
- `productos` creados antes del Bloque 7.12 no tienen `cabysCode` — no se
  pueden facturar hasta que se edite el producto y se cargue el código
  real (nunca inventado, ver arriba).

**Hallazgos reales posteriores al cierre (05/08/2026, validación real contra una instalación Electron actualizada varias veces):**

- **CABYS con formato válido pero inexistente en el catálogo real de Alegra (Bloque 7.21).** Un producto de prueba tenía `cabysCode` con 13 dígitos numéricos (pasa la validación de formato de `products.validation.ts`) pero ese valor no corresponde a ningún código real del catálogo que usa Alegra — confirmado descargando y comparando contra el catálogo oficial que la propia documentación de Alegra referencia (`developer.alegra.com/reference/post_items`, campo `productKey`). Alegra lo rechazó con `400`, código `1036` ("La clave de producto debe ser un valor válido del catálogo"), traducido por `resolveProductAlegraId` a `502 EXTERNAL_SERVICE_ERROR`. Caso distinto del `422` ya documentado arriba para CABYS *faltante* (`null`): acá el CABYS está *presente pero es inválido* — sin cambio de código, se corrige editando el producto con un código real. Refuerza la deuda ya registrada de validación CABYS↔catálogo real (ver `ROADMAP.md` del frontend, ítem 1.5).
- **Reconciliación de una emisión con resultado incierto por timeout (Bloque 7.22).** `ALEGRA_REQUEST_TIMEOUT_MS` (`alegra.client.ts`, 10s) puede vencer antes de que la respuesta real de Alegra llegue — confirmado con evidencia real: una emisión real tardó 14.5s. Como el timbrado es asíncrono (ver arriba), Alegra puede haber creado igual la factura del otro lado sin que el ERP se entere — antes de este bloque, la venta quedaba indefinidamente en "Pendiente" (`Sale.alegraInvoiceId` nunca se completaba), con riesgo real de doble emisión si el usuario reintentaba "Emitir". Corregido con: (1) `Sale.alegraEmissionUncertainAt` (campo nuevo, nullable, aditivo) marca ese estado; (2) `reconcileEmission()`/`findExistingInvoiceForSale()` (`alegra.service.ts`) reconcilian contra Alegra vía `GET /invoices`, filtrado por `date`/`client_id` (únicos filtros reales que el endpoint soporta — confirmado contra `developer.alegra.com/reference/get_invoices`; Alegra no expone idempotencia ni una referencia externa propia) y comparando `total` del lado del ERP; (3) `emitInvoice()` reconcilia tanto reactivamente (justo después de un timeout nuevo, en la misma petición) como proactivamente (antes de permitir un nuevo `POST /invoices`, si la venta ya venía marcada incierta de un intento previo) — nunca puede crear una segunda factura sin antes intentar confirmar contra Alegra. Se evaluó explícitamente usar webhooks (Alegra expone `invoices.emissionFinished`) como mecanismo más robusto, pero se descartó por incompatible con la arquitectura on-premise/offline-first de este backend (exigiría una URL pública alcanzable por Alegra, ver la decisión formal de §6.4).
- **`checkInvoiceStatus()` (Bloque 7.8) dejó de ser código huérfano.** Expuesta por primera vez vía `GET /integrations/alegra/sales/:saleId/status` (mismo permiso `sales.view` que el resto de las acciones sobre una venta puntual de este módulo) — sin ningún cambio de lógica interna, solo la ruta HTTP que faltaba.
- **Falso negativo real en la reconciliación del Bloque 7.22, corregido en el Bloque 7.23.** Validado con evidencia real contra una venta real (`VTA-000053`, 05/08/2026): la reconciliación *inmediata* (dentro de la misma petición que acaba de recibir el timeout) corría apenas ~2s después del aborto del cliente — sin margen real para que la certificación asíncrona de Alegra terminara del otro lado (confirmado: esa factura terminó de certificarse, con número/clave/PDF/correo reales, varios segundos *después* de esa reconciliación) — y al no encontrar nada todavía, `reconcileEmission()` limpiaba `alegraEmissionUncertainAt` igual, tratando "todavía no aparece" como si fuera "nunca existió". Resultado real observado: `Sale.alegraInvoiceId` y `Sale.alegraEmissionUncertainAt` ambos `null` de forma permanente, sin ningún mecanismo — automático o manual — para volver a reconciliar; un reintento de emisión sobre esa venta habría creado una segunda factura electrónica real duplicada. Corregido con el cambio mínimo posible: `reconcileEmission()` recibe un parámetro `clearIfNotFound` — `false` en la reconciliación inmediata (la marca queda intacta si no encuentra nada, para que una petición *posterior* la reintente con más margen real de tiempo), `true` en la reconciliación proactiva al inicio de `emitInvoice()` (una petición nueva, separada en el tiempo real de aquella que dejó la venta incierta — ahí sí "no encontrado" es una confirmación válida). **Validado de extremo a extremo el 05/08/2026 contra la aplicación de escritorio instalada real** (no localhost, no entorno de desarrollo): se desplegó el build corregido en `resources/backend/dist` de la instalación real (con backup reversible del `dist` previo) y se emitió una única factura electrónica real autorizada (`VTA-000050`, elegida por no haber llegado nunca a `POST /invoices` en sus intentos previos — sin riesgo de duplicado). Resultado real, sin timeout (Alegra respondió en 5.2s): `alegraInvoiceId: "19"`, `alegraInvoiceNumber: "001000010413"`, `alegraElectronicKey` real de 50 dígitos, `alegraInvoiceStatus: "closed"`, `alegraEmissionUncertainAt` permanece `null` (nunca se tocó, confirmando cero regresión en el flujo normal); la UI pasó de "Emitir comprobante electrónico" a las acciones reales (PDF/XML/Reenviar), y se confirmaron también en el log real `GET /status` (200), `POST /email` (200, reenvío real) y `GET /invoice-xml` (200, 9453 bytes reales) — sin ningún error. El escenario de timeout en sí (necesario para ejercitar `clearIfNotFound: false` en vivo) no se forzó artificialmente por decisión explícita del usuario (riesgo real sobre la cuenta fiscal) — queda respaldado por la traza completa ya recolectada de `VTA-000053` más la revisión de código, sin necesidad de una segunda factura de prueba. Se revisó el resto del módulo (`resolveGenericClient`/`resolveCustomerAlegraId`/`resolveProductAlegraId`/`resolveAlegraAccountId`) en busca del mismo patrón — ninguno lo repite: esas funciones no persisten ningún estado "incierto", y ante un timeout en su propia creación, la búsqueda por coincidencia exacta que ya hacen en cada llamada las vuelve a encontrar solas en el siguiente intento (no son documentos fiscales, no hay riesgo de duplicado real). Mejora de bajo riesgo identificada pero **no implementada** (reportada, no autorizada): no existe hoy ningún mecanismo — job programado ni indicador visual distinto — que resuelva o señale una venta que quede indefinidamente con `alegraEmissionUncertainAt` activo si el usuario nunca vuelve a intentar la emisión.

### 6.10 Módulo de Clientes e integración con Ventas / Facturación Electrónica (Bloques 8.1–8.5, cerrado 04/08/2026)

Módulo convencional (`src/modules/customers/`), mismo patrón exacto que
`suppliers` (§5): `controller`/`service`/`repository`/`validation`/`types`,
CRUD completo, borrado lógico estándar. Decisión de alcance del Bloque 8.1:
**ERP de una sola sucursal**, así que `Customer` es global, sin lógica por
sucursal — deliberadamente más simple que el resto del catálogo compartido
que sí modela un futuro multi-sucursal (ver `docs/DATABASE.md` §2).
Identificación validada contra el catálogo real de
Hacienda (`CF`/`CJ`/`DIMEX`/`NITE`/`PE`), con unicidad sobre
`(identificationType, identificationNumber)` — no solo el número, porque dos
tipos distintos de identificación pueden coincidir en el número (ajuste
explícito del Bloque 8.2 sobre la propuesta original de 8.1).

**Integración con Ventas (Bloque 8.3):** `Sale.customerId` es una FK
opcional; `sales/service.ts` valida que el cliente exista al crear la venta
(`NotFoundError` si no) y una corrección de venta (`POST /sales/:id/correct`)
preserva el `customerId` de la venta original — bug encontrado y corregido
dentro del mismo Bloque 8.3, no arrastrado como deuda técnica. El POS
(frontend) selecciona el cliente antes de cobrar, por defecto "Público
General" (`customerId: null`); el resto del ERP (historial, detalle de
venta, corrección, impresión del comprobante interno, pestaña Documentos)
lee `Sale.customer` (incluido vía `saleWithRelationsInclude`,
`sales/repository.ts`) sin lógica adicional por módulo.

**Integración con Facturación Electrónica (Bloque 8.4, decisión de
`documentType` superada 07/08/2026 — ver §6.9):** `emitInvoice`
(`integrations/alegra`) exige `Sale.customerId` para poder emitir en
absoluto (solo Factura Electrónica existe hoy) — ver el detalle completo en
§6.9 (`resolveCustomerAlegraId`, reenvío por correo automático con
`Customer.email`, sin cambios). `integrations/alegra` es el único módulo
que conoce a la vez `Customer` y la API de Alegra; `customers` en sí mismo
no tiene ninguna dependencia hacia Alegra — mismo criterio de dirección
única de dependencia que el resto de los adaptadores de esta tabla (§5,
fila `promotions`).

**Ediciones puntuales al POS (Bloque 8.5):** el rediseño del POS
(`SalesPOSPage.tsx`, decisiones "cerradas" documentadas en `CLAUDE.md` del
frontend) no se reabrió — el módulo de Clientes se integró de forma aditiva
sobre esas decisiones ya aprobadas (selector de cliente en el header,
diálogo de búsqueda propio). El único bug real encontrado en la ronda de QA
de este bloque fue que "ventas suspendidas" (función puramente de UI, sin
persistencia en backend) no conservaba el cliente seleccionado al reanudar
— corregido en el frontend, sin ningún cambio de backend.

**Casos límite verificados (Bloque 8.5, sin cambios de backend porque ya se
comportaban correctamente):** cliente eliminado (soft delete) — deja de
aparecer en `/customers/lookup` (no se puede seleccionar en ventas nuevas),
pero una venta que ya lo referenciaba sigue mostrando sus datos completos,
porque la extensión de borrado lógico (`softDelete.ext.ts`) solo filtra
llamadas de nivel superior (`findFirst`/`findMany`/`count`/`aggregate`), no
relaciones anidadas por `include` — comportamiento correcto y deseado para
integridad histórica, validado empíricamente con datos de prueba reales
(crear cliente → crear venta → eliminar cliente → confirmar que la venta
sigue mostrando el cliente en detalle y listado). Cliente inactivo
(`active: false`): mismo mecanismo — filtra solo en `lookup`, sin efecto
sobre ventas ya creadas.

**Deuda técnica documentada, no implementada (Bloque 8.2):** preferencia de
comprobante por cliente (`AUTO`/`FACTURA`/`TIQUETE`) — evaluada y descartada
por agregar alcance sin necesidad real; hoy el tipo de comprobante depende
únicamente de si la venta tiene `customerId` o no.

---

## 7. Cómo crece el proyecto al agregar un módulo nuevo

Este es el pago de haber diseñado modular. Agregar funcionalidad **no modifica lo existente**.

### Caso real: Facturación Electrónica vía Alegra (Bloques 7.1–7.20, cerrado 04/08/2026)

Esta sección documentaba, como ejemplo **hipotético**, cómo se agregaría
Facturación Electrónica de Hacienda el día que se implementara. Ya se
implementó — como integración con **Alegra** (no como firma/envío directo a
Hacienda, decisión explícita del Bloque 7.1) — y el proceso real coincidió
en lo esencial con lo que este documento anticipaba, con algunas
diferencias:

1. Se creó `src/modules/integrations/alegra/` (no `src/modules/invoicing/`,
   que ya existía con otro propósito — generación local de PDF/XML sin envío
   real, ver fila `invoicing` en §5) con el patrón estándar
   (`alegra.routes.ts`, `alegra.controller.ts`, `alegra.service.ts`,
   `alegra.repository.ts`, `alegra.validation.ts`, `index.ts`), más dos
   archivos propios del módulo sin equivalente en el patrón estándar:
   `alegra.client.ts` (único punto de comunicación HTTP con Alegra) y
   `alegra.crypto.ts` (cifrado del token en reposo).
2. Se registró el router en `src/modules/index.ts` — una línea, tal como
   anticipaba este documento.
3. Se añadió la tabla nueva (`AlegraConfig`, con `cashAccountId`/
   `bankAccountId` agregados después, Bloque 7.19) y dos columnas a modelos
   existentes (`Sale.alegraInvoiceId`/etc., `Product.alegraProductId`,
   `Product.cabysCode` agregado después, Bloque 7.12) a `schema.prisma`,
   con sus migraciones — ver `docs/DATABASE.md` §3.9.

**El diseño original (Bloque 7.11) agregaba un único cambio mínimo en
`sales/service.ts`** (una llamada de una línea, sin `await`, al confirmar
una venta): la única desviación real respecto a "cero cambios en cualquier
otro módulo" en ese momento, y deliberada — el punto de disparo automático
tenía que vivir en `sales` por definición. **El Bloque 7.17 revirtió esa
decisión** tras validar el flujo real de negocio (el POS no debe depender
de un servicio externo para completar una venta): se **removió** el
disparo de `sales/service.ts` por completo, restaurando el "cero cambios en
`sales`" original — la emisión pasó a ser una acción explícita, expuesta
por HTTP desde `integrations/alegra` (`POST .../emit`), disparada desde el
frontend (Ventas → Documentos), nunca desde el flujo de creación de la
venta. `sales/index.ts` (`capabilities` del `DocumentDefinition`
`SALE_RECEIPT`, Bloque 13.10) sí necesitó tocarse — pero solo para pasar
flags ya preexistentes de `false` a `true` (`electronicInvoice`/`xml`/
`email`), el mecanismo para eso ya estaba diseñado desde antes. Ver §6.9
para el detalle arquitectónico completo de la integración.

### Regla general para cualquier módulo nuevo

```
1. Copiar la plantilla de módulo → renombrar.
2. Definir su validación (contrato de entrada).
3. Escribir su service (reglas) y repository (datos).
4. Registrar su router en modules/index.js.
5. Migrar el esquema si necesita tablas nuevas.
```

El sistema escala por **adición**, no por **modificación**. Ese es el objetivo de mantenibilidad que buscabas.

---

## 8. Archivos raíz clave

| Archivo                | Responsabilidad                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`           | Construye la instancia de Express: registra middlewares globales, monta el router de módulos y el manejador de errores. No arranca el servidor.                 |
| `src/server.ts`        | Levanta el servidor HTTP e inicia el scheduler de jobs. Único punto de entrada del proceso.                                                                     |
| `.env.example`         | Plantilla documentada de variables (sin secretos reales). El `.env` real va en `.gitignore`.                                                                    |
| `prisma/schema.prisma` | Fuente de verdad del modelo de datos. Toda tabla transaccional incluye las columnas confirmadas (UUID, `sucursal_id`, timestamps, `deleted_at`, `sync_status`). |
| `prisma/seed.ts`       | Siembra inicial completa: roles/permisos, usuario administrador, configuración, catálogo de negocio — SOLO instalación fresca (paso 2 destructivo).             |
| `prisma/seed-permissions.ts` | Fix 05/08/2026: sincroniza SOLO `Permission`/`Role`/`RolePermission` (`permissionsBootstrap.ts`) — seguro en cada arranque, ver §6.7.                      |

---

## 9. Convenciones

- **Nomenclatura de archivos:** `dominio.capa.js` (ej. `sales.service.js`). Predecible y navegable.
- **Un barrel `index.js` por carpeta** para importaciones limpias.
- **Dirección de dependencias:** siempre hacia adentro (HTTP → negocio → datos). Nunca al revés.
- **Prisma solo en repositories.** Ningún service o controller importa Prisma directamente.
- **Errores tipados.** Los services lanzan errores de `shared/errors/`; el `errorHandler.middleware` los traduce a respuestas HTTP.
- **`git`** con `.gitignore` cubriendo `.env`, `logs/`, `backups/`, `node_modules/`.

---

## 10. Resumen de decisiones técnicas

| Aspecto        | Decisión                                     |
| -------------- | -------------------------------------------- |
| Estilo         | Monolito modular por dominio + capas limpias |
| Acceso a datos | Prisma (ORM) para transaccional              |
| Reporting/BI   | Vistas SQL nativas → Power BI directo        |
| Validación     | zod                                          |
| Logging        | pino                                         |
| Seguridad HTTP | helmet + express-rate-limit                  |
| Respaldos      | pg_dump vía node-cron                        |
| Auditoría      | Servicio transversal + módulo de lectura     |
| Dinero         | Decimal (nunca float)                        |
| Todo el stack  | Software libre                               |
