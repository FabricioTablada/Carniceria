# Base de datos — POS Carnicería

Diseño del modelo de datos (Sprint 2). Motor: **PostgreSQL** (local / on-premise,
fuente de verdad). ORM: **Prisma**. Esquema: [`prisma/schema.prisma`](../prisma/schema.prisma).
Reporting: vistas SQL en `prisma/sql/views` consumidas por **Power BI** (decisión #3).

> Este documento describe **únicamente el modelo de datos**; para lógica de
> negocio, endpoints y servicios ver `docs/API.md` y `docs/ARCHITECTURE.md`.
> (Nota histórica: la frase original de este documento — "Aún no se
> implementa autenticación" — describía el estado inicial del Sprint 2; hoy
> autenticación, autorización y el resto de los módulos de negocio están
> implementados, ver `docs/API.md`.)

---

## 1. Convenciones aplicadas (decisiones aprobadas)

Cada tabla transaccional incluye:

| Columna       | Tipo       | Propósito                                                                                       |
| ------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `id`          | UUID       | Llave primaria. UUID evita colisiones al consolidar varias sucursales en la nube (decisión #2). |
| `sucursal_id` | UUID       | Sucursal dueña del registro. **Solo donde corresponde** (ver §2).                               |
| `created_at`  | timestamp  | Fecha de creación.                                                                              |
| `updated_at`  | timestamp  | Última modificación (`@updatedAt`).                                                             |
| `deleted_at`  | timestamp? | Borrado lógico (soft delete). `NULL` = activo.                                                  |
| `sync_status` | enum       | `PENDING` / `SYNCED` / `FAILED` — flag rapido de lectura por fila; el motor real que decide *cuando/como* sincronizar es la tabla `sync_jobs` (Bloque 4, ver §7).                                |

Otras convenciones:

- **Nomenclatura:** `camelCase` en Prisma ↔ `snake_case` en PostgreSQL (vía
  `@map`/`@@map`). Las tablas y columnas siguen la convención de Postgres y
  quedan legibles desde Power BI.
- **Dinero:** `Decimal(14,2)` en colones (**nunca** punto flotante — decisión #6).
- **Cantidades / pesos:** `Decimal(12,3)`, para soportar kilogramos con precisión
  de gramos (decisión #4).
- **Tasas de impuesto:** `Decimal(5,2)` (porcentaje, p. ej. `13.00`).
- **JSON:** los campos `before`/`after`/`metadata` de auditoría usan `Json`
  (jsonb en Postgres).

---

## 2. Qué lleva `sucursal_id` y qué no (decisión clave)

El sistema separa **catálogo compartido** de **datos por sucursal**:

- **Catálogo (compartido, SIN `sucursal_id`):** `roles`, `permissions`,
  `categories`, `products`, `taxes`, `suppliers`. Un producto o un impuesto
  significan lo mismo en toda la organización. Al crecer a varias sucursales, el
  catálogo se mantiene único.
- **Existencias y transacciones (POR sucursal, CON `sucursal_id`):**
  `users`, `inventory`, `inventory_movements`, `purchases`, `sales`,
  `cash_registers`, `cash_sessions`, `cash_movements`, `configurations`,
  `audit_logs`.

Así, en multi-sucursal, **el mismo producto** tiene **existencia distinta** en
cada sucursal (fila propia en `inventory`), y las ventas/compras/caja quedan
atribuidas a su sucursal. Esto es exactamente lo que significa "`sucursal_id`
cuando corresponda".

`sucursales` no lleva `sucursal_id`: ella _es_ la sucursal.

---

## 3. Tablas por área

### 3.1 Organización y seguridad

**`sucursales`** — Raíz de la organización. Campos: `code` (único), `name`,
`legal_id` (cédula jurídica), `is_main`, `active`. Es padre de casi todo lo
transaccional. Inicialmente hay una fila; el modelo ya soporta varias.

**`roles`** — Rol del sistema (RBAC). Global. `name` único, `is_system` marca
los roles base no eliminables (ADMIN, MANAGER, CASHIER). Un usuario tiene un rol.

**`permissions`** — Permiso granular (p. ej. `products.create`, `sales.void`).
Global. Proviene de ARCHITECTURE.md §5 ("Roles y permisos. Base del RBAC").

**`role_permissions`** — Puente muchos-a-muchos entre `roles` y `permissions`.
Al ser una asociación pura, **no** usa borrado lógico: la relación se crea o se
elimina físicamente (`onDelete: Cascade`). Único por `(role_id, permission_id)`.

**`users`** — Usuario del sistema. Pertenece a una sucursal (`sucursal_id`) y a
un rol (`role_id`). `username` único, `email` único opcional, `full_name`,
`password_hash` (**bcrypt**, nunca texto plano), `active`, `last_login_at`,
`token_version` (Fase 19, hallazgo de seguridad #3: incrementarlo invalida
todos los refresh tokens ya emitidos — logout, cambio de rol/contraseña o
reactivación).

**`refresh_tokens`** (modelo `RefreshToken`, Fase 19) — rotación y revocación
de sesiones. Guarda únicamente el hash del refresh token (nunca el JWT
completo, mismo criterio que `password_hash`), `expires_at`, `revoked_at`
opcional. Permite responder "¿sigue vigente este token?" sin reconstruirlo.

### 3.2 Catálogo (compartido)

**`categories`** — Clasificación de productos. Soporta **jerarquía opcional**
(`parent_id` autorreferencia: categorías y subcategorías). Útil para agrupar
(p. ej. Res → Cortes finos).

**`taxes`** — Impuesto **configurable** (decisión #7). La tasa vive aquí, **no en
el código**: `rate` es porcentaje editable. `is_default` marca el impuesto por
defecto, `code` único. Referenciado por productos y por los detalles de
venta/compra.

**`products`** — Producto. Soporta las cuatro necesidades de la decisión #4:

- `unit_of_measure` (`KILOGRAM` | `UNIT`): venta por peso o por unidad.
- `sale_price` (Decimal): precio por kg o por unidad según la medida.
- `barcode` (único, opcional): código de barras.
- `is_variable_weight`: producto cuyo código de barras de balanza codifica el
  peso; el cliente POS lo interpreta y envía la cantidad.
  Además: `sku`, `cost` (costo de referencia), `track_inventory` (si controla
  existencias), `active`. Referencia a `category` y `tax`. El precio vive en el
  producto (catálogo compartido); un override de precio por sucursal se puede
  agregar en el futuro con una tabla nueva sin romper el modelo.
- `requires_batch` (Módulo de Lotes, LOTES-01/08, default `false`): único
  interruptor que activa el control por lotes para este producto — cuando es
  `true`, Compras genera automáticamente un `Batch` al recibir cada línea y
  Ventas consume por FEFO (ver §3.5-ter). Expuesto en el CRUD (`POST`/`PATCH
  /products`) desde LOTES-08. Productos sin este flag no participan del
  módulo, sin ninguna excepción.
- `alegra_product_id` (Bloque 7.6, opcional): ID del producto correspondiente
  en Alegra, resuelto y persistido **una sola vez** — ver §3.9. `null` = no
  vinculado todavía (comportamiento idéntico al de antes de esta columna).
- `cabys_code` (Bloque 7.12, opcional, 13 dígitos): código CABYS (Catálogo
  de Bienes y Servicios, catálogo oficial del Ministerio de Hacienda) —
  obligatorio para poder facturar el producto electrónicamente vía Alegra
  (enviado como `productKey`, §3.9); Alegra rechaza la emisión sin él. Se
  captura en el formulario de Productos, obligatorio en creación; `null` en
  productos creados antes de este bloque (sin backfill, sin valor
  inventado).

**`suppliers`** — Proveedor. Global (compra centralizada). `name`, `legal_id`
(cédula jurídica), contacto, `active`. Además de `purchases`, tiene una
relación inversa `promotions` (Commercial Pricing Engine, ver §3.5-bis) —
promociones que este proveedor origina/financia.

**`customers`** (modelo `Customer`, Bloques 8.1–8.2) — Cliente identificado,
global (ERP de una sola sucursal, sin lógica por sucursal — decisión
explícita del Bloque 8.1). `name`, `identification_type` (enum
`CustomerIdentificationType`: `CF`/`CJ`/`DIMEX`/`NITE`/`PE`, catálogo real de
Hacienda),  `identification_number`, `email`/`phone`/`address` (opcionales),
`active`. `@@unique([identification_type, identification_number])` — no solo
sobre el número, porque dos tipos de identificación distintos pueden
coincidir en el número (decisión explícita del Bloque 8.2, ajustada sobre la
propuesta original del Bloque 8.1). `alegra_contact_id` (Bloque 8.4,
opcional): ID del contacto correspondiente en Alegra, resuelto y persistido
**una sola vez**, mismo patrón exacto que `Product.alegra_product_id` (ver
§3.9). Borrado lógico estándar (`deleted_at`, `SyncStatus`) — un cliente
eliminado deja de aparecer en `/customers/lookup` (por lo tanto ya no puede
seleccionarse en ventas nuevas), pero una venta que ya lo referenciaba sigue
mostrando sus datos completos (`Sale.customer` vía `include`, que la
extensión de borrado lógico no filtra — ver `docs/ARCHITECTURE.md` §6.10;
comportamiento validado empíricamente y confirmado correcto/deseado para
integridad histórica, no es un bug). Mismo criterio para `active`: fuera de
la búsqueda de selección de clientes activos, sin efecto sobre ventas ya
creadas.

**Deuda técnica documentada, no implementada (Bloque 8.2):** una preferencia
de comprobante por cliente (`AUTO`/`FACTURA`/`TIQUETE`) fue evaluada y
descartada explícitamente por agregar alcance sin necesidad real — hoy el
tipo de comprobante se decide únicamente por si la venta tiene o no
`customer_id` (ver §3.5 y §3.9).

### 3.3 Inventario (por sucursal)

**`inventory`** — Existencia **actual** de un producto en una sucursal. Una fila
por `(product_id, sucursal_id)` (único). `quantity` (Decimal 12,3),
`reorder_point` opcional (para alertas de reposición). Es el "saldo"; sus
cambios los generan los movimientos.

**`inventory_movements`** — Registro **inmutable** de cada cambio de existencias.
`type` clasifica el movimiento (ver enum). `quantity` es **con signo**
(positivo = entra, negativo = sale). `balance_after` guarda el saldo resultante
para trazabilidad. `reference_type` + `reference_id` enlazan de forma flexible
con la venta/compra/ajuste que originó el movimiento (evita FKs rígidas hacia
varias tablas). Incluye el tipo `WASTE` para **mermas**, algo habitual en
carnicería. `batch_id` opcional (Módulo de Lotes, LOTES-01): cuando está
presente, el mismo incremento atómico que ajusta `Inventory.quantity` se
aplica también sobre `Batch.availableQuantity`, y cierra el lote (`DEPLETED`)
si llega a 0 — ver §3.5-ter.

**`inventory_wastes`** — Documento de negocio de una merma (independiente del
`InventoryMovementType.WASTE` de arriba, que es el asiento contable; esta
tabla es el documento con contexto de negocio). `reason` (enum `WasteReason`),
`notes`, `quantity` (Decimal 12,3), `unit_value`/`total_value` (**snapshot**
del `Product.cost` al momento de la merma, nunca recalculado después).
`source_return_item_id` opcional y único: una línea de devolución no
reingresada a stock corresponde, a lo sumo, a una merma. `batch_id` opcional
(Módulo de Lotes, LOTES-05): asocia la merma a un lote puntual cuando aplica
— permite mermar contra un lote `ACTIVE`, `EXPIRED` o `BLOCKED` (nunca
`DEPLETED`, que ya tiene saldo 0).

### 3.4 Compras

**`purchases`** — Encabezado de compra. `supplier_id`, `sucursal_id`, `user_id`
(quién registró), `document_number` (factura del proveedor), `status`
(`DRAFT`/`RECEIVED`/`CANCELLED`), `purchase_date`. Totales calculados y
almacenados (`subtotal`, `tax_total`, `total`) para preservar el histórico.

**`purchase_items`** — Detalle (línea). `quantity`, `unit_cost`, `tax_rate`
(**snapshot**), y los importes de línea. Hijo de `purchases` (`onDelete:
Cascade`). Referencia a `product` y a `tax` (opcional). `supplier_lot_code`,
`production_date` y `expiry_date` opcionales (Módulo de Lotes, LOTES-09,
trazabilidad de recepción): capturables por línea únicamente cuando el
producto de esa línea tiene `requires_batch`; se propagan tal cual al `Batch`
que crea Compras al recibir la línea (§3.5-ter) — la validación de orden de
fechas (`production_date ≤ received_at ≤ expiry_date`) es responsabilidad
exclusiva de `batches/service.ts`, no se duplica aquí.

### 3.5 Ventas

**`sales`** — Encabezado de venta (**raíz agregada**). `sucursal_id`, `user_id`
(cajero), `cash_session_id` (la sesión de caja abierta, para poder **cuadrar el
cierre**), `document_number` (consecutivo interno, único por sucursal),
`status`, `payment_method` (incluye **SINPE Móvil**), totales
(`subtotal`, `tax_total`, `discount_total`, `total`), `amount_paid`,
`change_given`.

**`sale_items`** — Detalle (línea). `quantity` (para productos por peso, es el
peso en kg), `unit_price` y `tax_rate` (**snapshot**), `discount`, e importes de
línea. Hijo de `sales` (`onDelete: Cascade`).

`sales` también lleva 5 columnas opcionales agregadas en el Bloque 7.7 con el
resultado de facturar esta venta en Alegra (ver §3.9): `alegra_invoice_id`,
`alegra_invoice_number`, `alegra_electronic_key` (Bloque 7.8: solo se
completa la primera vez que Alegra la devuelve, nunca se sobrescribe
después), `alegra_invoice_status` (Bloque 7.8: se resincroniza si cambia) y
`alegra_issued_at`. Los 5 en `null` = venta todavía no facturada en Alegra
(no distingue "nunca se intentó" de "se intentó y falló" — eso vive en los
logs, no en la venta, ver `docs/ARCHITECTURE.md` §6.9).

**`customer_id`** (Bloque 8.3, opcional, FK a `customers`) — cliente
identificado asociado a la venta; `null` = "Público General" (comportamiento
por defecto, idéntico al de antes de este bloque). Determina si la venta se
puede facturar electrónicamente al pedirlo bajo demanda (§3.9, Fix
07/08/2026): `null` → no se puede emitir ningún comprobante (Tiquete
Electrónico fue retirado), con valor → Factura Electrónica a nombre del
cliente real. Se valida que el `customer_id` exista al crear la venta
(`NotFoundError` si no); una corrección de venta (`POST /sales/:id/correct`)
preserva el `customer_id` de la venta original (Bloque 8.3, corregido dentro
del mismo bloque, no como deuda técnica).

### 3.5-bis Promociones (Motor de Promociones y Descuentos)

**`promotions`** — Catálogo de reglas de promoción. `scope_type`
(`PRODUCT`/`CATEGORY`/`COMBO`/`CART`) define QUÉ afecta la promoción;
`effect_type` (`PERCENTAGE`/`FIXED_AMOUNT`/`SPECIAL_PRICE`/`BUY_X_PAY_Y`) define
CÓMO calcula el beneficio — `effect_value` se usa para los primeros tres,
`buy_quantity`/`pay_quantity` únicamente para `BUY_X_PAY_Y` (2x1 = 2/1, 3x2 =
3/2). Condiciones opcionales: `min_quantity` (cantidad mínima del carrito/línea),
`start_date`/`end_date` (vigencia por fecha), `start_time`/`end_time` (franja
horaria del día, zona horaria `America/Costa_Rica`), `days_of_week` (array de
`DayOfWeek`, vacío = todos los días). Resolución entre promociones candidatas:
`priority` (mayor se evalúa primero), `stackable` (si puede combinarse con
otras sobre la misma línea) y `exclusive_group` (promociones del mismo grupo
nunca se combinan entre sí, sin importar `stackable`). `sucursal_id` opcional
(nulo = aplica a todas las sucursales).

**Commercial Pricing Engine (PROMO-03/04, aditivo — ninguno de los campos de
arriba cambió):** `supplier_id` opcional (FK a `suppliers`, `onDelete:
SetNull`) — proveedor que origina/financia la promoción. `commercial_origin`
(enum `PromotionOrigin`, default `INTERNAL`) — por qué existe la regla
(decisión propia del negocio vs. `SUPPLIER_MANDATED`, una condición impuesta
por el proveedor). `funding_type` (enum `PromotionFundingType`, default
`NONE`) — quién financia el descuento que recibe el cliente
(`SUPPLIER_SUBSIDY_PER_UNIT`/`SUPPLIER_SUBSIDY_PERCENTAGE`). `supplier_subsidy_value`
opcional — monto o porcentaje del subsidio, según `funding_type`. 5 reglas de
coherencia entre estos 4 campos, validadas en `promotions.service.ts`
(`assertCommercialCoherence()`), no en el esquema.

**`promotion_products`** / **`promotion_categories`** — Relación N:M entre una
promoción y los productos/categorías que afecta (según `scope_type`).
`promotion_products.required_quantity` solo se usa para `scope_type: COMBO`
(cuántas unidades de cada producto exige el combo). Ambas tablas tienen
`onDelete: Cascade` desde `promotions` — borrar una promoción borra sus filas
de relación, nunca al revés (no cascadea hacia `products`/`categories`).

**`sale_applied_promotions`** — Auditoría de CADA descuento realmente aplicado
a una venta (una fila por combinación promoción+línea; `sale_item_id` nulo =
descuento de carrito completo). `source` distingue `MANUAL` (el cajero lo
escribió en el POS, `applied_by_user_id` identifica a quién) de `AUTOMATIC`
(el motor de reglas lo aplicó solo, `applied_by_user_id` siempre nulo).
`promotion_name_snapshot` congela el nombre de la promoción en el momento en
que se aplicó (si el catálogo se edita después, el historial no cambia
retroactivamente — mismo criterio que `sale_items.tax_rate`). `promotion_id`
es una FK opcional hacia `promotions` (`onDelete: SetNull`) — trazabilidad
activa hacia la regla de catálogo que originó el descuento, sin reemplazar el
snapshot de nombre (si la promoción se borra en el futuro, esta columna queda
en `null` pero `promotion_name_snapshot` conserva el dato histórico).

**Commercial Pricing Engine (PROMO-10, snapshot histórico, aditivo):**
`commercial_origin`, `funding_type`, `supplier_subsidy_value` — copia exacta
de los mismos campos de `promotions` (arriba) en el momento EXACTO de la
venta, mismo criterio que `sale_items.tax_rate`/`expected_waste_percent_at_sale`.
`supplier_id` es un escalar plano **sin FK** (a diferencia de `promotion_id`
arriba) — deliberado: es un dato histórico que no debe reinterpretarse si el
proveedor cambia después. `supplier_contribution_amount` es el monto
REALMENTE aplicado por el proveedor en esta fila, distinto de
`supplier_subsidy_value` (el parámetro crudo de la regla) — mismo criterio
que `amount_applied` vs. `discount_value`. Estos 5 campos se calculan una
sola vez en `createSaleTransaction()` y nunca se vuelven a leer desde
`promotions` — verificado que editar la promoción después de la venta no
altera esta fila.

El **motor de reglas** que evalúa este catálogo (`src/shared/services/promotionEngine/`)
es código puro: no importa Prisma, no persiste nada, no conoce `Sale`/`SaleItem`.
La única pieza que conecta el motor con el dominio de Ventas es
`src/modules/promotions/promotionApplication.service.ts` — ver
`docs/ARCHITECTURE.md` sección 5 para el detalle de capas.

### 3.5-ter Lotes (Módulo de Lotes / Batch Management)

**`batches`** — Un lote de recepción de un producto con `requires_batch`.
`code` autogenerado (mismo mecanismo de `DocumentSequence` que
`sales.document_number`). `product_id`/`sucursal_id`, `purchase_item_id`
opcional y **único** (a lo sumo un lote por línea de compra; nullable para
permitir un "lote de reconciliación" si un producto ya tenía stock antes de
activar `requires_batch`, o un lote de reingreso creado por Devoluciones/
anulación de venta sin línea de compra de origen). `supplier_id` opcional,
**denormalizado** (snapshot, no derivado vía `purchase_item → purchase →
supplier`) — mismo criterio que `sale_items.unit_cost`, para no perder el
dato si la compra de origen se edita después. `supplier_lot_code`,
`received_at`, `production_date`/`expiry_date` opcionales. `initial_quantity`/
`available_quantity` (Decimal 12,3). `unit_cost` (Decimal 14,2).
`expected_waste_percent` opcional — snapshot de `purchase_items` al crear el
lote, nunca recalculado. `status` (enum `BatchStatus`). `closed_at`, `notes`.

**Invariante central del módulo:** `Σ batches.available_quantity (status ≠
DEPLETED) = inventory.quantity`, por producto/sucursal. No es "solo lotes
`ACTIVE`": un lote `EXPIRED` puede conservar saldo real sin consumir (sigue
siendo existencia física); solo `DEPLETED` implica saldo 0 por construcción.

**Política de transición de `status`:** `ACTIVE → DEPLETED` automático
cuando el saldo llega a 0 vía cualquier movimiento (nunca revierte una razón
más específica ya asignada). `ACTIVE → EXPIRED` automático, mediante un
barrido "lazy" (sin proceso en segundo plano) cada vez que se leen lotes para
una decisión que importa (listado, detalle, consumo FEFO, validación de una
merma). `BLOCKED` y cualquier reversión manual: exclusivamente vía `PATCH
/batches/:id`. Ningún estado terminal se revierte automáticamente por un
movimiento de inventario.

**Consumo en Ventas (FEFO):** al vender un producto con `requires_batch`, se
selecciona automáticamente de qué lote(s) descontar por vencimiento más
próximo primero (`received_at` como desempate FIFO), con reparto entre
múltiples lotes si uno solo no alcanza. Si el saldo de lotes `ACTIVE` no
alcanza (aunque `inventory.quantity` agregado sí alcance), la venta se
rechaza explícitamente.

### 3.5-quater Despiece (Módulo de Despiece, plan v3 — Bloques 1-3 ✅ cerrados 08/08/2026)

**`processing_operations`** — cabecera de una operación de despiece: transforma
un producto/lote de entrada (canal completo) en N productos de salida.
`code` autogenerado (`DESP-000001`, mismo mecanismo `DocumentSequence` que
`batches.code`/`sales.document_number`). `input_product_id`/`input_batch_id`
(nullable a nivel de columna; **obligatorio por regla de negocio** — no de
schema — cuando `products.requires_batch` es `true` para ese producto,
validado en `processing/service.ts`), `input_quantity` (Decimal 12,3),
`input_unit_cost` (Decimal 14,2, snapshot del costo real del lote o del costo
de referencia del producto). `status` (enum `ProcessingStatus`:
`DRAFT`/`COMPLETED`/`CANCELLED`), `completed_at`, `notes`.

**`processing_output_items`** — una línea de salida (corte/subproducto).
`output_product_id`, `quantity` (Decimal 12,3), `sale_price_snapshot`
(Decimal 14,2, congelado al agregar la línea — nunca se relee
`products.sale_price` después), `allocated_cost` (Decimal 14,2, nullable,
se calcula recién al completar), `output_batch_id` (**único**, nullable —
el lote nuevo creado para esta salida al completar).

**`processing_waste_items`** — una línea de merma real y editable durante el
`DRAFT` (corrección aprobada tras la revisión del Bloque 2: reemplazó a un
valor derivado implícito). `reason` (enum `WasteReason`, default
`PROCESSING_LOSS`), `quantity` (Decimal 12,3), `notes` opcional. Al
completarse la operación, cada línea genera exactamente una fila en
`inventory_wastes` (ver abajo) — este modelo es el borrador previo, nunca el
registro final de merma.

**Balance de peso — igualdad EXACTA** (no un residuo tolerado):
`input_quantity = Σ processing_output_items.quantity +
Σ processing_waste_items.quantity`, validada con `Prisma.Decimal` (nunca
`number` nativo, para evitar imprecisión de punto flotante) tanto durante la
edición del borrador como de forma definitiva al completar.

**Columnas aditivas en modelos existentes** (sin afectar ningún registro
previo a este módulo): `batches.parent_batch_id` (nullable, self-relation —
qué lote de entrada originó este lote de salida, poblado directamente por
`processing/repository.ts::linkOutputBatchParent` vía Prisma dentro de la
transacción de `complete()`, **sin** extender `batches`); y
`inventory_wastes.processing_operation_id` (nullable — vincula una merma a
la operación que la originó).

**`complete()` (transacción atómica única):** consume el stock del canal de
entrada completo (`InventoryMovementType.PROCESSING_OUT`) → crea un `Batch`
nuevo por cada línea de salida y acredita su stock
(`InventoryMovementType.PROCESSING_IN`, `skipBatchQuantitySync: true`, mismo
patrón que Compras/Devoluciones) → distribuye `input_quantity ×
input_unit_cost` entre las salidas por el **método de valor relativo de
venta** (`quantity × sale_price_snapshot` de cada línea; la última línea
absorbe el residuo de redondeo, mismo algoritmo que
`promotions/promotionApplication.service.ts::translateEngineResult`; una
línea individual con `sale_price_snapshot = 0` recibe `allocated_cost = 0`
sin bloquear — solo se bloquea si **todas** las salidas están en 0) →
materializa cada línea de merma como su propia `inventory_wastes` (documental,
**sin** volver a llamar `recordMovement`: el descuento ya ocurrió completo
con `PROCESSING_OUT`) → marca `COMPLETED`. `COMPLETED` es inmutable;
`CANCELLED` nunca toca inventario (nada se había descontado todavía).

Migraciones: `20260808175831_add_processing_module_despiece` (Bloque 1) y
`20260808183926_add_processing_waste_items` (Bloque 2, corrección de
mermas) — ambas 100% aditivas. Ver `ROADMAP.md` (repo
`carniceria-pos-front`), sección "MÓDULO DE DESPIECE", para el detalle
completo bloque por bloque, incluidas las correcciones de alcance
aprobadas.

### 3.6 Caja

**`cash_registers`** — La caja registradora (punto de cobro físico) de una
sucursal. Sobre ella se abren sesiones.

**`cash_sessions`** — Sesión de caja. Modela **apertura y cierre como un mismo
ciclo de vida** (dos eventos de una sesión, no dos tablas):

- Apertura: `opened_by_user_id`, `opened_at`, `opening_amount` (fondo inicial).
- Cierre: `closed_by_user_id`, `closed_at`, `closing_amount` (contado real),
  `expected_amount` (calculado) y `difference` (sobrante/faltante).
  `status` es `OPEN` o `CLOSED`. Las ventas apuntan a la sesión para el arqueo.

**`cash_movements`** — Ingresos/egresos **manuales** de efectivo durante una
sesión (retiros, gastos menores, aportes). `type` (`CASH_IN`/`CASH_OUT`),
`amount`, `reason`. No confundir con ventas. Hijo de `cash_sessions`.

### 3.7 Configuración y auditoría

**`configurations`** — Configuración por sucursal en formato **clave-valor**
(`key` único por sucursal, `value`, `type`, `description`). Flexible para datos
de la empresa, moneda (CRC) y parámetros operativos, sin migraciones nuevas por
cada parámetro.

**`audit_logs`** — Registro de auditoría (requisito #9). Es **inmutable y de solo
agregado**; por eso **no** lleva `updated_at` ni `deleted_at` (auditar y luego
poder editar o borrar el log sería un antipatrón). Conserva `sync_status` para
consolidarse en la nube. Guarda `action`, `entity`, `entity_id`, `user_id`
(opcional), `ip`, y `before`/`after`/`metadata` como JSON.

### 3.8 Documentos y comprobantes

**`document_sequences`** — Consecutivo por tipo de documento (`name` único,
`value` incremental). Único mecanismo de numeración del sistema, consumido
por `sales.document_number`, `batches.code`, etc. — ningún módulo reimplementa
su propia numeración.

**`invoices`** — Comprobante electrónico asociado a una venta (`status`:
`InvoiceStatus`). Alcance actual: solo Tiquete Electrónico generado
localmente (PDF/XML de `modules/invoicing`); los campos de firma digital/
envío directo a Hacienda quedan sin usar — **no** confundir con la
integración real de Facturación Electrónica del sistema, que es Alegra
(§3.9), un motor completamente separado que no toca esta tabla.

### 3.9 Integraciones — Alegra (Facturación Electrónica, Bloques 7.1–7.20 y 8.4–8.5)

**`alegra_config`** (modelo `AlegraConfig`) — Fila **única** ("singleton":
`id` siempre `"singleton"`, nunca se crea una segunda), la configuración de
la cuenta de Alegra usada por todo el ERP: `email`, `token` (blob cifrado
AES-256-GCM — `iv:authTag:cipher` en base64, **nunca texto plano**, ver
`docs/ARCHITECTURE.md` §6.9), `base_url` (por defecto
`https://api.alegra.com/api/v1`, editable solo para pruebas avanzadas),
`generic_client_id` y, agregados en el Bloque 7.19, `cash_account_id`/
`bank_account_id` — **las tres columnas quedaron sin ningún código que las
lea o escriba desde el Fix 07/08/2026** (`generic_client_id` desde que se
retiró Tiquete Electrónico/"Cliente General"; `cash_account_id`/
`bank_account_id` desde que se eliminó `payments` del payload de emisión,
ver `docs/ARCHITECTURE.md` §6.9). Siguen en el esquema — identificadas como
columnas muertas, no eliminadas todavía, requiere una migración de Prisma
pendiente.

No hay ninguna otra tabla nueva: la vinculación de productos vive en
`Product.alegra_product_id` (§3.2), el código CABYS por producto vive en
`Product.cabys_code` (Bloque 7.12, §3.2), la vinculación de clientes vive en
`Customer.alegra_contact_id` (Bloque 8.4, §3.2, mismo patrón "resolver una
vez, persistir para siempre") y el resultado de facturar cada venta vive en
las 5 columnas `alegra_*` de `Sale` (§3.5) — deliberadamente sin una tabla de
log/historial de intentos de facturación en este alcance (ningún bloque de
la serie 7.x/8.x la pidió).

**Cliente identificado obligatorio, sin "Cliente General" (Bloques 8.4–8.5,
Fix 07/08/2026 supera el comportamiento original):** al emitir
(`emitInvoice`), `Sale.customer_id` es obligatorio — si es `null`, la
función falla antes de tocar Alegra (`ConflictError`). Con cliente
identificado, se resuelve/crea el contacto real en Alegra
(`resolveCustomerAlegraId`, sin cambios, persistiendo en
`Customer.alegra_contact_id`) y se factura como **Factura Electrónica**
(única opción existente hoy — Tiquete Electrónico fue retirado como
decisión de negocio, `generic_client_id` quedó sin uso, ver arriba). El
reenvío por correo (`POST .../email`, §3.5) usa
automáticamente `Customer.email` cuando la venta tiene cliente asociado con
correo cargado — deja de pedirlo a mano solo en ese caso; sigue pidiéndolo
manualmente para "Público General" o un cliente sin correo cargado. La
descarga del XML (`GET .../invoice-xml`) tuvo un bug de autenticación
corregido en el Bloque 8.5 (la descarga del archivo prefirmado de S3 no debe
llevar las credenciales Basic Auth de Alegra) — ver
`docs/ARCHITECTURE.md` §6.9 para el detalle técnico; no afecta ninguna
columna ni tabla de este esquema.

---

## 4. Mapa de relaciones (resumen)

```
Sucursal 1─┬─* User            User *─1 Role ─* RolePermission *─1 Permission
           ├─* Inventory        User 1─* Sale, Purchase, InventoryMovement,
           ├─* InventoryMovement       CashMovement, AuditLog
           ├─* Purchase         User 1─* CashSession (openedBy / closedBy)
           ├─* Sale
           ├─* CashRegister ─* CashSession 1─┬─* Sale
           ├─* CashSession                   └─* CashMovement
           ├─* CashMovement
           ├─* Configuration
           └─* AuditLog

Category 1─* Product ─1 Tax          Category 1─* Category (jerarquía)
Product 1─┬─* Inventory              Supplier 1─* Purchase 1─* PurchaseItem
          ├─* InventoryMovement      Sale 1─* SaleItem
          ├─* SaleItem                       Supplier 1─* Batch
          ├─* PurchaseItem                   PurchaseItem 1─1 Batch (opcional, único)
          └─* Batch                          Batch 1─* InventoryMovement, InventoryWaste
                                    Tax 1─* SaleItem / PurchaseItem (snapshot)

Customer 1─* Sale (customer_id opcional — null = "Público General", Bloque 8.3)
```

---

## 5. Decisiones importantes justificadas

1. **UUID en todo.** Permite generar identificadores en cada sucursal sin
   coordinación central y consolidarlos en la nube sin colisiones (decisión #2).

2. **Catálogo compartido vs. datos por sucursal.** Productos, categorías,
   impuestos y proveedores no llevan `sucursal_id`; las existencias y
   transacciones sí. Es lo que hace viable el multi-sucursal real (mismo
   producto, stock por sucursal).

3. **Snapshots de precio y tasa** en `sale_items`/`purchase_items`. Se guarda el
   `unit_price`/`unit_cost` y el `tax_rate` vigentes al momento de la
   transacción. Si mañana cambia el precio o la ley del IVA, las ventas y
   compras pasadas conservan sus valores históricos correctos.

4. **Borrado lógico: filtrado en lectura, escritura explícita.** Las tablas
   llevan `deleted_at` y la extensión de Prisma excluye los borrados en las
   lecturas. El borrado se ejecuta como `update({ deletedAt })` desde el
   repositorio (una extensión `query` no puede convertir un `delete` en
   `update`). Las tablas puente (`role_permissions`) y la auditoría no usan
   borrado lógico.

5. **Auditoría inmutable.** `audit_logs` no tiene `updated_at` ni `deleted_at`
   a propósito: un log que se puede alterar no sirve como auditoría.

6. **Caja: una sesión con dos eventos.** Apertura y cierre son campos de
   `cash_sessions`, no dos tablas. Una sesión tiene una apertura y (a lo sumo)
   un cierre; separarlas duplicaría la relación sin aportar nada.

7. **Movimientos de inventario con signo + `balance_after`.** Simplifica el
   cálculo del saldo y deja auditoría del inventario paso a paso. `WASTE`
   contempla la merma típica de carnicería. `reference_type`/`reference_id`
   evitan múltiples FKs opcionales hacia ventas/compras/ajustes.

8. **RBAC con permisos.** Se incluyen `permissions` y `role_permissions` porque
   ARCHITECTURE.md §5 define el módulo de roles como "Roles y permisos". Si
   prefieres un esquema más simple (solo roles con nombre), se pueden retirar
   estas dos tablas.

9. **`SINPE_MOVIL` como método de pago.** Es un medio de cobro muy común en
   Costa Rica; conviene modelarlo desde el inicio.

10. **Precisión decimal explícita.** Dinero `Decimal(14,2)`; peso/cantidad
    `Decimal(12,3)` para gramos; tasa `Decimal(5,2)`.

---

## 6. Enums

| Enum                    | Valores                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SyncStatus`            | PENDING, SYNCED, FAILED                                                                                        |
| `UnitOfMeasure`         | KILOGRAM, UNIT                                                                                                 |
| `InventoryMovementType` | INITIAL, PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN, TRANSFER_IN, TRANSFER_OUT                                  |
| `PurchaseStatus`        | DRAFT, RECEIVED, CANCELLED                                                                                     |
| `SaleStatus`            | COMPLETED, CANCELLED, REFUNDED                                                                                 |
| `PaymentMethod`         | CASH, CARD, SINPE_MOVIL, TRANSFER, MIXED                                                                       |
| `CashSessionStatus`     | OPEN, CLOSED                                                                                                   |
| `CashMovementType`      | CASH_IN, CASH_OUT                                                                                              |
| `AuditAction`           | LOGIN, LOGOUT, CREATE, UPDATE, DELETE, PRICE_CHANGE, CASH_OPEN, CASH_CLOSE, PURCHASE, SALE\*, INVENTORY_MOVEMENT\*, SALE_VOID, SALE_CORRECTION, SALE_RETURN, INVENTORY_WASTE, LOGIN_FAILED, ACCESS_DENIED — \*`SALE`/`INVENTORY_MOVEMENT` son LEGACY (ya no se emiten desde el código actual, se conservan por registros históricos); `LOGIN_FAILED`/`ACCESS_DENIED` son eventos de seguridad negativos agregados en la Fase 19 (ver `docs/AUDIT_REPORT.md` sección 15) — antes el log solo registraba el "happy path". |
| `SaleDiscountType`      | NONE, PERCENTAGE, FIXED (descuento manual de carrito, distinto del motor de promociones) |
| `PromotionScopeType`    | PRODUCT, CATEGORY, COMBO, CART                                                                                 |
| `PromotionEffectType`   | PERCENTAGE, FIXED_AMOUNT, SPECIAL_PRICE, BUY_X_PAY_Y, FIXED_PRICE                                              |
| `PromotionSource`       | MANUAL, AUTOMATIC                                                                                              |
| `PromotionOrigin`       | INTERNAL, SUPPLIER_MANDATED                                                                                    |
| `PromotionFundingType`  | NONE, SUPPLIER_SUBSIDY_PER_UNIT, SUPPLIER_SUBSIDY_PERCENTAGE                                                   |
| `DayOfWeek`             | MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY                                                 |
| `BatchStatus`           | ACTIVE, DEPLETED, EXPIRED, BLOCKED                                                                             |
| `WasteReason`           | RETURNED_NOT_RESTOCKED, EXPIRED, DAMAGED, PRODUCTION_ERROR, CUTTING_ERROR, PACKAGING_ERROR, COLD_CHAIN_FAILURE, OTHER |
| `InvoiceStatus`         | PENDIENTE, ENVIADO, ACEPTADO, RECHAZADO, ERROR (comprobante electrónico, ver nota de `invoicing` en §3.7) |
| `CustomerIdentificationType` | CF, CJ, DIMEX, NITE, PE (catálogo real de identificación de Hacienda, Bloque 8.1, ver §3.2) |

---

## 7. Comportamiento transversal y pasos siguientes (Sprint 3)

- **Borrado lógico / filtrado:** `src/database/extensions/softDelete.ext.ts`.
- **Marca de sincronización:** `src/database/extensions/syncStatus.ext.ts`.

Cuando se implemente cada módulo, habrá que **registrar el nombre del modelo**
en `SOFT_DELETE_MODELS` (todos menos `role_permissions` y `audit_logs`).
`SYNCABLE_MODELS` (afecta solo el estampado automático de `sync_status` en
create/update, no la cola real de sincronización — ver más abajo) sigue
vacío a propósito: qué modelos necesitan sincronizarse hacia afuera es
todavía una decisión de producto pendiente, no técnica.

### 7.1 Sincronización real — cola de salida `sync_jobs` (Bloque 4)

El diseño real de sincronización (mencionado como "Fase 2" en versiones
anteriores de este documento) ya está implementado, como mecánica genérica
lista para conectarse a un destino real: `sync_jobs`, patrón *outbox*. Cada
operación que necesita sincronizarse encola una fila en la MISMA transacción
de Prisma que guarda el dato de negocio (ver `modules/sales/service.ts`,
`createSaleTransaction`, como ejemplo funcionando end-to-end con `Sale`) —
si la transacción hace rollback, el trabajo también; si el proceso se cae
justo después del commit, el trabajo ya quedó guardado, no se pierde.

Un worker permanente (`modules/sync/sync.worker.ts`, iniciado/detenido
desde `server.ts`, **no** un cron — ver razón en `jobs/scheduler.ts`)
procesa la cola: se despierta de inmediato cuando se encola un trabajo
nuevo, drena sin demora mientras haya progreso real, y aplica backoff
exponencial acotado cuando los intentos fallan (típicamente: sin
conectividad). El destino real de cada `jobType` es un handler del
dispatcher (`modules/sync/sync.handlers/`) — hoy solo existe
`CLOUD_PUSH`, con un handler *stub* (sin destino real todavía, la API de
nube no está definida) que prueba la mecánica completa de la cola sin
depender de ella. **Actualización (Bloques 7.11/7.17, 04/08/2026):** la
Facturación Electrónica real del sistema (Alegra, §3.9) **no** terminó
integrándose por esta cola — decisión explícita, mantenida a través de dos
diseños distintos ("sin cola de trabajos, sin reintento automático" en
ambos): primero (Bloque 7.11) la emisión se disparaba directo
(`void emitInvoice(saleId).catch(...)`) al confirmar la venta; después
(Bloque 7.17, que **removió** ese disparo automático) pasó a dispararse
bajo demanda, vía HTTP (`POST /integrations/alegra/sales/:saleId/emit`),
nunca desde la creación de la venta. Ninguno de los dos diseños pasó nunca
por `sync_jobs`. Si en el futuro se decide que sí debería pasar por acá,
sigue siendo viable como un `jobType`/handler nuevo sin tocar el motor de
la cola — la puerta que describía este párrafo sigue abierta, solo que no
fue el camino elegido para Alegra.

Campos de `sync_jobs`: `sucursalId` (denormalizado, permite filtrar/
monitorear por sucursal sin join), `jobType`, `entityType`/`entityId`
(genérico, sin FK), `payload` (snapshot opcional), `idempotencyKey`
(único — `${jobType}:${entityType}:${entityId}`, evita duplicados si el
mismo trabajo se encola dos veces), `status` (`PENDING`/`PROCESSING`/
`SYNCED`/`FAILED`), `attempts`, `lastError`.

Para aplicar este modelo a la base:

```bash
npx prisma validate      # valida el schema
npx prisma format        # formatea (opcional)
npm run prisma:migrate   # genera y aplica la migración inicial
```
