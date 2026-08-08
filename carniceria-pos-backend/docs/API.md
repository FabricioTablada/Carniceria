# API - POS Carniceria

Documentacion de endpoints. Listado verificado contra `src/modules/*/*.routes.ts` /
`src/modules/index.ts` (agosto 2026) — todos los modulos listados abajo estan
**implementados**, no pendientes.

Prefijo base: definido por `API_PREFIX` (por defecto `/api/v1`).

Autenticacion: JWT (`Authorization: Bearer <token>`) via `authenticate` middleware,
salvo donde se indique lo contrario. La autorizacion es mixta: la mayoria de
endpoints usa permisos granulares (`authorizePermission('<recurso>.<accion>')`,
`src/constants/permissions.ts`); un subconjunto (ver notas por modulo) todavia
usa `authorize(<rol>)` por rol en vez de por permiso. Rate limiting por
categoria (`auth`/`salesQuote`/`transactional`/`reports`/`administrative`, ver
`src/config/rateLimitPolicies.ts`) aplicado por endpoint — cada categoria
tiene su propio `windowMs`/`max` calibrado a su volumen real (investigacion
03/08/2026, ver `docs/AUDIT_REPORT.md` seccion 16.2); `POST /sales/quote`
tiene categoria propia (`salesQuote`), separada de `POST /sales`
(`transactional`).

## Salud

- `GET /health` - Estado del servicio (sin autenticacion).

## `/auth`

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/verify-password` — **Bloque 7.24 (05/08/2026).** Requiere
  `authenticate` (a diferencia de `/login`) — verifica la contrasena del
  usuario YA autenticado, para la pantalla de bloqueo por inactividad del
  frontend. Nunca emite ni rota tokens, no toca la cookie de refresco.
  Cuerpo: `{ password: string }`. `204` si coincide; `401` si no (registra
  `AuditAction.LOGIN_FAILED`, mismo criterio que un intento de login
  fallido, sin accion de auditoria nueva). Deliberadamente NO reutiliza
  `login()`/`loginRateLimiter` — ver justificacion completa en
  `docs/ARCHITECTURE.md` §6.7.

## `/users`

- `POST /users`
- `GET /users`
- `GET /users/me`
- `GET /users/lookup`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/status`

## `/roles`

- `POST /roles`
- `GET /roles`
- `GET /roles/:id`
- `PATCH /roles/:id`
- `PATCH /roles/:id/status`
- `PATCH /roles/:id/permissions`

## `/permissions`

- `POST /permissions`
- `GET /permissions`
- `GET /permissions/:id`
- `PATCH /permissions/:id`

## `/categories`

- `POST /categories`
- `GET /categories`
- `GET /categories/lookup`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `PATCH /categories/:id/status`
- `DELETE /categories/:id`

## `/products`

- `POST /products`
- `GET /products`
- `GET /products/lookup`
- `GET /products/:id`
- `PATCH /products/:id`
- `PATCH /products/:id/status`
- `DELETE /products/:id`
- `POST /products/:id/image`
- `DELETE /products/:id/image`

## `/taxes`

- `POST /taxes`
- `GET /taxes`
- `GET /taxes/lookup`
- `GET /taxes/:id`
- `PATCH /taxes/:id`
- `PATCH /taxes/:id/status`
- `DELETE /taxes/:id`

## `/promotions`

Catalogo de reglas de promocion (Motor de Promociones + Commercial Pricing
Engine + `FIXED_PRICE`). La aplicacion real de promociones a una venta ocurre
dentro de `POST /sales` y `POST /sales/quote`, no aqui.

- `POST /promotions`
- `GET /promotions`
- `GET /promotions/:id`
- `PATCH /promotions/:id`
- `PATCH /promotions/:id/status`
- `DELETE /promotions/:id`

## `/suppliers`

- `POST /suppliers`
- `GET /suppliers`
- `GET /suppliers/lookup`
- `GET /suppliers/:id`
- `PATCH /suppliers/:id`
- `PATCH /suppliers/:id/status`
- `DELETE /suppliers/:id`

## `/customers`

Clientes identificados (Bloques 8.1–8.2). Mismo patrón de CRUD que
`/suppliers`. Global — el ERP opera con una sola sucursal (Bloque 8.1).

- `POST /customers`
- `GET /customers`
- `GET /customers/lookup`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `PATCH /customers/:id/status`
- `DELETE /customers/:id`

## `/inventory`

- `POST /inventory` (autorizacion por rol: `ADMIN`, no por permiso)
- `GET /inventory`
- `GET /inventory/:id`
- `PATCH /inventory/:id`

### `/inventory/waste` (modulo `inventoryWaste`, montado bajo `/inventory`)

Documento de negocio de mermas, distinto del asiento `InventoryMovementType.WASTE`.

- `POST /inventory/waste`
- `GET /inventory/waste`
- `GET /inventory/waste/:id`
- `DELETE /inventory/waste/:id`

### `/inventory/batches` (modulo `batches`, montado bajo `/inventory`)

Modulo de Lotes (trazabilidad, consumo FEFO). El alta de lotes es automatica
(Compras al recibir una linea con `requiresBatch`), no tiene `POST` propio.

- `GET /inventory/batches`
- `GET /inventory/batches/:id`
- `PATCH /inventory/batches/:id`

## `/purchases`

- `POST /purchases`
- `GET /purchases`
- `GET /purchases/:id`
- `PATCH /purchases/:id`

## `/processing` (módulo de Despiece, plan v3 — Bloques 1-3 ✅ cerrados 08/08/2026)

Primer nivel (no montado bajo `/inventory`, a diferencia de `batches`/`inventoryWaste`).
Transforma un producto/lote de entrada (canal) en N productos de salida
(cortes/subproductos) más líneas de merma explícitas. Ver `ROADMAP.md` (repo
`carniceria-pos-front`), sección "MÓDULO DE DESPIECE", para el detalle
completo.

- `POST /processing` — crea una operación en `DRAFT`.
- `GET /processing`
- `GET /processing/:id`
- `PATCH /processing/:id` — solo mientras sigue `DRAFT` (edita `notes`).
- `POST /processing/:id/complete` — transacción atómica, permiso separado (`processing.complete`).
- `POST /processing/:id/cancel` — solo mientras sigue `DRAFT`; nunca toca inventario.
- `POST /processing/:id/output-items` — agrega una línea de salida (corte/subproducto).
- `PATCH /processing/:id/output-items/:itemId`
- `DELETE /processing/:id/output-items/:itemId`
- `POST /processing/:id/waste-items` — agrega una línea de merma (cantidad + motivo + notas).
- `PATCH /processing/:id/waste-items/:itemId`
- `DELETE /processing/:id/waste-items/:itemId`

Permisos: `processing.view` (lecturas), `processing.create` (todo el ciclo
de vida del `DRAFT`, incluidas las líneas), `processing.complete` (solo
`POST /:id/complete`).

## `/sales`

- `POST /sales` — acepta `customerId` opcional (Bloque 8.3, FK a
  `/customers`, `null`/ausente = "Público General"); valida que el cliente
  exista si se envía. Determina el tipo de comprobante que emitirá
  `/integrations/alegra` (ver esa sección).
- `POST /sales/quote` — cotizacion sin persistir; misma logica de calculo
  (`computeSaleQuoteCalculation()`, renombrada 03/08/2026 al separarla de la
  transaccion de venta, ver `docs/AUDIT_REPORT.md` seccion 16.1) que
  `POST /sales`, incluye promociones y analisis de rentabilidad por linea.
  Categoria de rate limiting propia (`salesQuote`), no `transactional`.
- `GET /sales`
- `GET /sales/:id`
- `PATCH /sales/:id` (autorizacion por rol: `ADMIN`, no por permiso)
- `POST /sales/:id/void`
- `POST /sales/:id/correct`

## `/documents`

Numeracion y generacion de PDF (consecutivos compartidos con Ventas/Compras/Lotes).

- `POST /documents/pdf`
- `GET /documents/definitions/:type`

## `/returns`

Devoluciones de venta.

- `POST /returns`
- `GET /returns`
- `GET /returns/:id`

## `/cash-registers`

CRUD de la caja registradora fisica.

- `POST /cash-registers`
- `GET /cash-registers`
- `GET /cash-registers/:id`
- `PATCH /cash-registers/:id`
- `PATCH /cash-registers/:id/status`

## `/cash`

Sesion de caja (apertura/cierre) y movimientos manuales.

- `POST /cash/sessions`
- `GET /cash/sessions`
- `GET /cash/sessions/:id`
- `PATCH /cash/sessions/:id`
- `PATCH /cash/sessions/:id/close`
- `POST /cash/movements`
- `GET /cash/movements`
- `GET /cash/movements/:id`

## `/reports`

Reportes operativos rapidos servidos por la API (el BI pesado va por vistas
SQL → Power BI, ver `prisma/sql/views/`).

- `GET /reports/dashboard`
- `GET /reports/sales`
- `GET /reports/sales/summary`
- `GET /reports/purchases`
- `GET /reports/purchases/summary`
- `GET /reports/inventory`
- `GET /reports/inventory/summary`
- `GET /reports/profit`
- `GET /reports/profit/summary`
- `GET /reports/cash`
- `GET /reports/cash/summary`
- `GET /reports/cash/:id`
- `GET /reports/top-products`
- `GET /reports/low-stock`
- `GET /reports/sales-by-category`
- `GET /reports/sales-by-cashier`
- `GET /reports/sales-by-cashier/summary`
- `GET /reports/sales-by-date`
- `GET /reports/waste`
- `GET /reports/batches`
- `GET /reports/batches/:id`

## `/notifications`

Avisos internos (p. ej. lotes proximos a vencer).

- `GET /notifications`

## `/configuration`

Parametros por sucursal (clave-valor).

- `POST /configuration`
- `GET /configuration`
- `GET /configuration/:id`
- `PATCH /configuration/:id`

## `/audit`

Lado de lectura del registro de auditoria (autorizacion por rol: `ADMIN`).

- `GET /audit`
- `GET /audit/:id`

## `/integrations/alegra`

Facturacion Electronica via Alegra (Bloques 7.1-7.20, ver `docs/ARCHITECTURE.md`
§6.9). Unico modulo del backend que se comunica con un servicio de terceros;
toda esa comunicacion queda dentro de `modules/integrations/alegra`, nunca en
`sales` ni en ningun otro modulo.

- `POST /integrations/alegra/test-connection` — prueba credenciales (correo +
  token) recibidas en el cuerpo, sin persistirlas. Permiso `settings.manage`.
- `GET /integrations/alegra/config` — estado de la configuracion guardada
  (`configured`, correo, URL base, token enmascarado). Nunca llama a Alegra —
  lee unicamente la base de datos local. Permiso `settings.manage`.
- `POST /integrations/alegra/config` — guarda (crea o actualiza) la
  configuracion persistente; el token es opcional (vacio conserva el ya
  guardado, cifrado en la base de datos, ver `docs/DATABASE.md` §3.9). Permiso
  `settings.manage`.
- `POST /integrations/alegra/sales/:saleId/emit` — Bloque 7.17, `documentType`
  eliminado y sin body desde el Fix 07/08/2026 (ver abajo). Dispara
  `emitInvoice(saleId)` BAJO PEDIDO (ya no automatico al confirmar una
  venta), con CABYS por linea (ver `docs/ARCHITECTURE.md` §6.9). **Fix
  07/08/2026 (decision de negocio):** el ERP ya no soporta Tiquete
  Electronico — toda emision es **Factura Electronica**, a nombre del
  cliente real asociado (Bloque 8.4 — resuelve/crea el contacto en Alegra la
  primera vez, `Customer.alegraContactId` persiste el vinculo). Una venta
  sin `Sale.customerId` ya no puede emitir nada — falla con `409 CONFLICT`
  ANTES de cualquier llamada a Alegra (mismo codigo que el guard de
  re-emision, ver abajo). `numberTemplate.id` se resuelve dinamicamente en
  cada llamada contra `GET /number-templates`, filtrando `documentType`/
  `isElectronic`/`status`/`isDefault` los cuatro a la vez — cero IDs
  hardcodeados. **Fix 07/08/2026:** el payload ya NO incluye `payments` (el
  plan de la cuenta, "Solo Facturacion Pro", no incluye el modulo de Bancos
  — enviarlo causaba `402`/codigo `907` de Alegra); la factura queda "Por
  cobrar" en Alegra, consecuencia aceptada. Falla con
  `409 CONFLICT` si `Sale.alegraInvoiceId` ya existe (guard agregado durante
  QA.16A/QA.APP.1 tras un incidente real de reemision duplicada — la
  verificacion corre ANTES de cualquier llamada a Alegra), `422` (CABYS
  faltante o invalido, Alegra no configurado, venta sin items, o ninguna/
  multiples numeraciones electronicas vigentes) o `502`
  (rechazo real de Alegra) segun el caso. **Fix 05/08/2026 (Bloque 7.22):**
  si la llamada a Alegra vence por timeout (`ECONNABORTED`), reconcilia
  automaticamente contra `GET /invoices` (mismos datos ya resueltos, ver
  `docs/ARCHITECTURE.md` §6.9) antes de responder — si encuentra que Alegra
  ya creo la factura del otro lado, este mismo endpoint devuelve `200` con
  el resultado normal, sin que el usuario vea el timeout; si no encuentra
  nada, devuelve el timeout de siempre (`502`), ya verificado. Un reintento
  posterior sobre la misma venta reconcilia de nuevo ANTES de construir un
  `POST /invoices` nuevo — nunca puede duplicar una factura real sin antes
  intentar confirmar contra Alegra. **Fix 05/08/2026 (Bloque 7.23):** esa
  reconciliacion inmediata (misma peticion del timeout) YA NO limpia
  `Sale.alegraEmissionUncertainAt` cuando no encuentra nada (falso negativo
  real, evidenciado con `VTA-000053` — Alegra certifico esa factura despues
  de esa misma reconciliacion) — la marca solo se limpia en la
  reconciliacion proactiva de un reintento posterior, cuando "no encontrado"
  ya es una confirmacion valida. Permiso `sales.view`.
- `GET /integrations/alegra/sales/:saleId/status` — **Fix 05/08/2026.**
  Expone `checkInvoiceStatus()` (Bloque 7.8, implementada desde entonces
  pero sin ninguna ruta HTTP hasta este fix — ya no es codigo huerfano).
  Relee `GET /invoices/{id}` en Alegra y actualiza
  `alegraInvoiceStatus`/`alegraElectronicKey`/`alegraIssuedAt` solo si
  cambiaron, sin logica nueva respecto a la implementacion original del
  Bloque 7.8. Permiso `sales.view`.
- `GET /integrations/alegra/sales/:saleId/invoice-pdf` — descarga el PDF de la
  factura ya emitida de esa venta, siempre pedido a Alegra en el momento
  (nunca cacheado). Responde el binario directo (`Content-Type: application/pdf`),
  no el sobre `success(...)` de siempre. Permiso `sales.view`.
- `GET /integrations/alegra/sales/:saleId/invoice-xml` — mismo patron exacto
  que el PDF, XML timbrado de la factura. Permiso `sales.view`. Bug de
  autenticacion contra URLs prefirmadas de S3 corregido en el Bloque 8.5
  (ver `docs/ARCHITECTURE.md` §6.9) — el endpoint y su contrato HTTP no
  cambiaron, solo la implementacion interna de la descarga.
- `POST /integrations/alegra/sales/:saleId/email` — Bloque 7.20. Reenvia por
  correo el comprobante YA emitido (`Sale.alegraInvoiceId`), via
  `POST /invoices/{id}/email` de Alegra — no recrea ni vuelve a timbrar el
  comprobante, ninguna comunicacion nueva con Hacienda. Cuerpo:
  `{ emails: string[] }` (validado como correo valido, al menos uno). El
  correo del destinatario nunca se persiste en esta llamada. Desde el
  Bloque 8.4, el frontend precompleta automaticamente el correo del cliente
  asociado a la venta (`Customer.email`) cuando existe — sin cambio en este
  endpoint, sigue recibiendo el mismo cuerpo de siempre. Permiso
  `sales.view`.

**Nota:** la resolucion de cliente/producto/cuenta de pago genericos
(`resolveGenericClient`/`resolveProductAlegraId`/`resolveAlegraAccountId`) y
la reconciliacion de una emision incierta (`reconcileEmission`/
`findExistingInvoiceForSale`, Bloque 7.22) **no tienen endpoint HTTP
propio** — son infraestructura interna del modulo, consumida solo desde
`emitInvoice`/las rutas de arriba. (`checkInvoiceStatus` SI tiene ruta
propia desde el fix 05/08/2026, ver arriba — ya no aplica esta nota para
esa funcion.)

## Modulos sin capa HTTP propia

- `invoicing` — utilidad de numeracion/armado de PDF/XML consumida por
  `documents`, sin `controller`/`routes` propio. **No** es la integracion de
  Facturacion Electronica real del sistema — esa es `integrations/alegra`
  (arriba), que factura a traves de Alegra en vez de firmar/enviar XML
  directo a Hacienda (decision explicita del Bloque 7.1, ver
  `docs/ARCHITECTURE.md` §6.9).
- `settings` — carpeta vacia y huerfana, reemplazada por `configuration`
  (ver `docs/ARCHITECTURE.md`).
