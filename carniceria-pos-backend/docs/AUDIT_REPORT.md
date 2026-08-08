# Informe de Auditoría Técnica — Backend

**Proyecto:** carniceria-pos-backend
**Fecha:** 19 de julio de 2026
**Estado de la auditoría:** FINALIZADA

---

## 1. Resumen ejecutivo

La auditoría cubrió seis dimensiones (Arquitectura, Prisma, Seguridad, Rendimiento, Consistencia, Producción) sobre un backend Node.js/TypeScript/Express/Prisma/PostgreSQL en Clean Architecture. Del informe original, **18 hallazgos** recibieron clasificación de severidad (Crítico/Alto/Medio/Bajo).

- **Hallazgos analizados:** 12.
- **Hallazgos oficialmente cerrados:** 12 — la totalidad de los hallazgos tratados durante esta fase quedó oficialmente cerrada.
- **6 hallazgos** del informe original no llegaron a ser tomados dentro del alcance de esta sesión (ver sección "Deuda técnica pendiente").
- **Adenda posterior (27 de julio de 2026):** un hallazgo adicional, ajeno a esta auditoría, quedó documentado en la sección 10 ("Adenda") — no altera el cierre ni las cifras anteriores, que describen exclusivamente el alcance original.
- **Adenda posterior (27–28 de julio de 2026):** implementación completa del Motor de Promociones y Descuentos (P.1–P.8), con un defecto de redondeo monetario preexistente encontrado y corregido durante su QA — documentado en la sección 11 ("Adenda"), tampoco altera el cierre ni las cifras de esta auditoría.
- **Adenda posterior (30 de julio de 2026):** modelo comercial de proveedor/financiamiento sobre el catálogo `Promotion`, coordinador de rentabilidad `PricingAnalysis` y snapshot histórico en `SaleAppliedPromotion` (Commercial Pricing Engine, PROMO-01 a PROMO-12) — documentado en la sección 12 ("Adenda"), tampoco altera el cierre ni las cifras de esta auditoría.
- **Adenda posterior (30–31 de julio de 2026):** Módulo de Lotes completo (LOTES-00 a LOTES-09) — trazabilidad por lote en Compras/Ventas/Mermas/Devoluciones, consumo FEFO, reportes, control por lotes expuesto en Productos y trazabilidad completa de recepción — documentado en la sección 13 ("Adenda"), tampoco altera el cierre ni las cifras de esta auditoría.
- **Adenda posterior (31 de julio de 2026):** nuevo efecto `FIXED_PRICE` (precio fijo por unidad) sobre el catálogo `Promotion` (PROMO-13) — documentado en la sección 14 ("Adenda"), tampoco altera el cierre ni las cifras de esta auditoría.
- **Adenda posterior (Fase 19, 31 de julio de 2026):** hardening de seguridad — migraciones reales de Prisma, `authorizePermission()` conectado a la mayoría de endpoints, rotación/revocación de refresh tokens, auditoría de eventos negativos y rate limiting por categoría — documentado en la sección 15 ("Adenda"). **Resuelve directamente los hallazgos 6.1 y 1.2**, antes listados como deuda técnica pendiente en la sección 7, y el riesgo "sin revocación de tokens" de la sección 6. También registra, como hallazgo nuevo sin investigar a fondo, una brecha real de 429/no-respuesta temporal bajo alto volumen intercalado de compras/ventas/devoluciones/anulaciones.

---

## 2. Hallazgos implementados (código modificado, QA validado, CLOSED)

> **Nota de proceso:** cada uno de los hallazgos de esta tabla siguió, sin excepción, el flujo completo aprobado para esta auditoría: **análisis técnico → aprobación → implementación acotada → revisión técnica de diffs → QA → commit → push**, antes de considerarse oficialmente `CLOSED`. Ningún cambio se instaló, se dio por válido ni se cerró sin pasar por la totalidad de esos pasos.

| Hallazgo | Descripción | Alcance real de la implementación |
|---|---|---|
| 2.3 | Faltaban índices en columnas de fecha (`Sale.saleDate`, `Purchase.purchaseDate`, `CashSession.openedAt`) | 3 líneas `@@index` en `schema.prisma` |
| 2.2 | `PATCH /inventory/:id` no generaba `InventoryMovement` | `inventory/service.ts` + `inventory/controller.ts` |
| 3.2 | `closeSession` aceptaba `closedByUserId` del body | `cash/validation.ts`, `types.ts`, `controller.ts`, `service.ts` |
| 2.1 | Borrado lógico sin ningún modelo activado (`SOFT_DELETE_MODELS` vacío) | Implementado inicialmente como piloto en `Supplier`. **Actualizado:** posteriormente extendido también a `Category`, `Tax`, `Promotion` y `Product` (verificado en `src/database/extensions/softDelete.ext.ts`) — ya no está limitado a un único modelo piloto, aunque sigue sin cubrir la totalidad de tablas transaccionales del esquema. |
| 3.1 | Faltaban `/auth/refresh` y `/auth/logout` | `auth/auth.validation.ts`, `.service.ts`, `.controller.ts`, `.routes.ts` — sin rotación de refresh token, sin revocación (confirmado y decidido explícitamente) |
| 6.6 | Sin CI/CD | `.github/workflows/ci.yml` nuevo — únicamente typecheck/lint/format/test, sin Docker/Postgres/migraciones/deploy |
| 3.3 | Sin redacción de datos sensibles en logs | `redact` de Pino en `config/logger.ts`, campos `authorization` y `cookie` |
| 2.4 | `groupBy` sin límite en dos reportes | Parcial, a propósito: solo `getSalesByCashier` (seguro). `getSalesByCategory` quedó explícitamente sin cambios — ver sección 4 |

---

## 3. Hallazgos reclasificados como falsos positivos

| Hallazgo | Por qué |
|---|---|
| 1.3 | `authorize(ADMIN, MANAGER)` repetido en Reports no es una inconsistencia de ese módulo — es el patrón uniforme de 14 módulos y 37 ocurrencias en todo el proyecto. Corregirlo solo en Reports habría creado una inconsistencia nueva. |
| 2.6 | La premisa (duplicación de `buildDateRange` en Sales/Purchases/Cash) era incorrecta: esos módulos no tienen filtro de fecha en sus endpoints propios en absoluto. La única implementación real ya está centralizada en `reports.repository.ts`, sin duplicación. |

---

## 4. Hallazgos cerrados por decisión de arquitectura (sin implementación)

| Hallazgo | Decisión |
|---|---|
| 4.2 | Dashboard sin cache — reclasificado de Medio a Bajo. Se decidió no implementar cache: el costo real de las 9 consultas es bajo (agregados ya indexados tras el hallazgo 2.3, acotados por sucursal) y el dominio de negocio (POS on-premise de una carnicería) no genera el volumen que justificaría la complejidad de un cache (invalidación, inconsistencia con el resto del módulo, que es enteramente sin estado). |
| `getSalesByCategory` (dentro de 2.4) | Se decidió explícitamente no aplicarle un límite: al ser un paso intermedio de un cálculo agregado por categoría, truncarlo generaría totales financieros incompletos sin ningún indicio del error — se priorizó exactitud sobre una optimización preventiva, por decisión explícita del cliente del proyecto. |
| 6.7 — permiso `products.delete` huérfano | CLOSED por decisión de arquitectura. La verificación de evidencia confirmó que el permiso fue incorporado deliberadamente al diseño del sistema (asignación diferenciada por rol, mismo patrón que `sales.void`), no es un descuido. La funcionalidad correspondiente (borrado de productos) queda planificada para una iniciativa futura; se decidió no implementarla en esta auditoría por su alcance y por el riesgo relacional de `Product` (el modelo con más relaciones del sistema), consistente con el mismo criterio de prudencia aplicado en el hallazgo 2.1. |

---

## 5. Estado final del backend

El backend queda con: transacciones e integridad de inventario reforzadas (2.2), índices de rendimiento en las columnas de fecha más consultadas (2.3), un patrón de borrado lógico completo y validado en al menos un módulo real (2.1/Suppliers, replicable), atribución de usuario consistente en el 100% de las acciones sensibles del proyecto (3.2, cerrando la última inconsistencia de ese tipo), flujo de autenticación completo con refresh (3.1), logs sin exposición de credenciales (3.3), y un pipeline de CI que verifica automáticamente cada cambio futuro (6.6) — algo que esta misma sesión de auditoría no tuvo disponible hasta ese punto.

---

## 6. Riesgos abiertos

- ~~**Sin revocación de tokens**~~ — **RESUELTO** (ver sección 15): el modelo `RefreshToken` (hash del token, rotación) más `User.tokenVersion` permiten revocar todos los refresh tokens de un usuario (logout, cambio de rol/contraseña/reactivación). Ya no es una limitación abierta.
- ~~**`authorizePermission()` sigue sin usarse en ningún endpoint**~~ — **RESUELTO** (hallazgo 1.2, ver sección 15): conectado a la mayoría de endpoints del proyecto. Un subconjunto de rutas administrativas/sensibles sigue usando `authorize(<rol>)` por rol, de forma deliberada.
- ~~**Condición de carrera conocida en `recordMovement()`**~~ — **ACLARADO Y RESUELTO (07/08/2026, ver sección 18).** Revisando esto de nuevo durante la auditoría de riesgos críticos: el incremento propio de `recordMovement()`/`recordMovements()` (`Inventory.quantity: { increment: delta }`) YA era atómico (Postgres serializa ese `UPDATE` sobre la misma fila, sin *lost update* real) — la imprecisión de esta entrada original estaba en el diagnóstico, no en el síntoma. El riesgo real vivía un paso antes: 3 de 4 llamadores que necesitan "verificar que hay suficiente ANTES de descontar" (Devoluciones, Cancelación de compras `RECEIVED`, Mermas) lo hacían con una lectura simple sin bloqueo de fila, a diferencia de Ventas (`reserveIfSufficient`, atómico desde el hallazgo de rendimiento #2 de esta misma auditoría). Los tres se corrigieron con el mismo patrón atómico ya usado en Ventas — ver sección 18 para el detalle completo.

---

## 7. Deuda técnica pendiente (solo lo que realmente quedó sin resolver)

| Hallazgo | Severidad original | Motivo de no resolución |
|---|---|---|
| ~~6.1 — sin migraciones de Prisma (todo vía `db push`)~~ | Crítico | **RESUELTO** (ver sección 15) — el proyecto ya tiene un historial real de migraciones versionadas en `prisma/migrations/`, aplicadas con `prisma migrate deploy` en despliegue (ver `docs/DEPLOYMENT.md`). |
| 6.2 — casi sin tests automatizados (solo `tests/unit/money.test.ts`) | Crítico | Alcance grande, no es un cambio atómico; nunca se llegó a esta posición en el orden aprobado. Parcialmente mitigado: suites nuevas se agregaron junto con Promociones/Lotes (`promotionEngine.test.ts`, 25 pruebas), pero no hay cobertura sistemática del resto del backend. |
| ~~1.2 — `authorizePermission()` sin uso en ningún endpoint~~ | Alto | **RESUELTO** (ver sección 15) — conectado a la mayoría de endpoints (Fase 19). |
| 1.1 — convención de nombres de archivo inconsistente entre módulos | Bajo | Estaba en el orden aprobado (posición 6) pero no se llegó a esa posición |
| 5.2 — documentación despareja entre módulos antiguos y recientes | Bajo | Estaba en el orden aprobado (posición 7) pero no se llegó a esa posición |
| ~~Condición de carrera en `recordMovement()`~~ | No clasificado formalmente en el informe original | **RESUELTO (07/08/2026, ver sección 18)** — ver aclaración en sección 6: el riesgo real estaba en 3 llamadores (Devoluciones/Compras/Mermas) sin bloqueo de fila antes de descontar, no en el incremento atómico de `recordMovement()` en sí. |
| ~~Hallazgo 2 (07/08/2026) — descuento acumulado de promociones `stackable` no acotado en `SaleAppliedPromotion.amountApplied`~~ | Alto | **RESUELTO (07/08/2026, ver sección 18, punto 2)** — corregido con prorrateo en `translateEngineResult`, sin tocar el motor ni `adjustedLineSubtotal`. |
| Hallazgo 3 (07/08/2026) — Motor de Promociones redondea con `number`/`Math.round`, no con `Prisma.Decimal` | Medio | Reanalizado el 07/08/2026 (ver sección 18, punto 3) — sin caso reproducible encontrado; se mantiene documentado como riesgo teórico, no implementado; reabrir requiere evaluar el desacople deliberado del motor respecto de `@prisma/client` |
| `recordMovements()` (Fase 15, Bloque B) asume que `createManyAndReturn` devuelve las filas en el mismo orden que el `data` insertado, para emparejar cada `InventoryMovement` creado con su `balanceAfter` calculado en memoria | Bajo (hoy sin impacto: ningún llamador consume `movementId`) | Aceptado deliberadamente al optimizar round-trips de `createSale`/`createPurchase`/`createReturn`: Postgres no garantiza ese orden por contrato para `INSERT ... VALUES (...) RETURNING`, aunque lo respeta en la práctica para una sola sentencia. Pendiente: si algún flujo futuro llega a depender del `movementId`/`balanceAfter` devuelto por línea, reemplazar el emparejamiento por posición por una correlación explícita (ej. incluir un identificador de línea propio en cada fila insertada y usarlo para reconstruir la correspondencia, en vez de asumir el orden de retorno de la base de datos) |

---

## 8. Recomendaciones para la siguiente fase

1. **Resolver 6.1 primero, en un entorno real** (fuera del sandbox de esta auditoría) — es el bloqueante más crítico que queda, y varios de los hallazgos futuros (incluyendo 6.2) se benefician de partir de un historial de migraciones real en vez de `db push`.
2. **Decidir explícitamente el destino de `authorizePermission()`** (1.2): conectarlo a las rutas que lo necesiten, o retirar la infraestructura de permisos granulares si el proyecto se queda con autorización por rol únicamente — hoy es ambigüedad de diseño sin resolver, no solo código muerto.
3. **Abrir la condición de carrera de `recordMovement()` como su propio hallazgo**, dado que afecta tres módulos a la vez (Sales, Purchases, Inventory) y quedó fuera del alcance original de la auditoría.
4. **Cerrar formalmente 6.7** con la decisión sobre la Opción C antes de dar la auditoría por completamente terminada.
5. Una suite de tests real (6.2) debería preceder a cualquier expansión funcional grande del proyecto (por ejemplo, extender Soft Delete a `Product`, que quedó identificado como el trabajo de mayor riesgo relacional pendiente).

---

## 9. Conclusión final

Al cierre de esta fase, el backend de `carniceria-pos-backend` queda **significativamente más robusto, consistente y mantenible** que al inicio de la auditoría — con mejoras concretas y verificadas en integridad de datos, seguridad de autenticación y autorización, trazabilidad de auditoría, rendimiento de consultas y automatización de verificación continua — **preservando en todo momento la arquitectura existente** (Clean Architecture, Repository Pattern, separación por capas) sin introducir dependencias, patrones ni infraestructura ajenos al diseño original del proyecto. La deuda técnica que queda pendiente está identificada, priorizada y documentada con evidencia, no es deuda oculta.

---

## 10. Adenda — Deuda técnica detectada fuera de esta auditoría (Sprint Impuestos y Descuentos en Ventas)

**Fecha:** 27 de julio de 2026
**Origen:** Análisis de extremo a extremo del manejo de impuestos y descuentos en Ventas (Detalle de Venta + Reportes), fuera del alcance e independiente de los hallazgos numerados de la auditoría original (secciones 1-9 de este informe). Se documenta aquí porque esta sección es el registro de deuda técnica ya establecido del proyecto.

| Hallazgo | Severidad | Motivo de no resolución |
|---|---|---|
| Nombre del impuesto (`Tax.name`) resuelto por join en vivo en `SaleItem`, sin snapshot histórico | Bajo/Medio (integridad de auditoría, no afecta montos) | El bloque de trabajo en curso (Bloque B, Reporte de Ventas) está acotado explícitamente a mejoras de presentación, sin tocar backend, contratos ni esquema; esta corrección requiere migración de base de datos y fue diferida a una decisión de negocio explícita |

**Problema.** `SaleItem.taxRate` se guarda correctamente como snapshot (`Decimal(5,2)`) en el momento de la venta — nunca cambia si el impuesto se edita después, y todos los montos calculados (`lineTax`, `taxTotal`) dependen de ese snapshot, no del registro actual de `Tax`. Sin embargo, el **nombre** del impuesto que se muestra en cualquier pantalla (`SaleItem.tax`, resuelto vía `include: { tax: true }` en `sales/service.ts`) es un JOIN EN VIVO contra la tabla `Tax` actual — no un snapshot. `taxes.service.ts` (`update`) permite editar el `name` de un impuesto existente en cualquier momento, sin restricción por tener ventas históricas asociadas.

**Impacto sobre auditoría.** Si el nombre de un impuesto cambia en el futuro (ej. se renombra "IVA 13%"), todas las ventas históricas que usaron ese impuesto mostrarán retroactivamente el nombre nuevo en el Detalle de Venta y en cualquier reporte con desglose por línea, aunque el cálculo original (`taxRate`, `lineTax`, `taxTotal`) permanezca exacto. El monto siempre es correcto; la etiqueta mostrada puede dejar de coincidir con lo que el cliente vio en el comprobante entregado al momento de la venta — una inconsistencia relevante para una revisión contable o una auditoría fiscal que compare el sistema contra comprobantes físicos históricos.

**Motivo por el cual no se implementa ahora.** Corregirlo requiere una migración de esquema (nueva columna snapshot) y tocar el flujo de creación de venta (`sales/service.ts`, `computeItems`) — cambio de mayor alcance que las mejoras de presentación aprobadas para este bloque, y ya había quedado identificado como fuera de alcance en el análisis previo (bloque de "cambios de modelo de datos", no aprobado todavía).

**Propuesta de solución futura.** Agregar `SaleItem.taxName: String?` al schema, poblado en `computeItems()` junto con `taxRate`, a partir de `Tax.name` en el momento de la venta — mismo patrón ya usado para el snapshot de `taxRate`. `toSaleItemResponse()` debería preferir este snapshot sobre el join en vivo cuando exista (con fallback al join para ventas anteriores a la migración, que no tendrían el dato snapshot). Requiere: migración Prisma, ajuste de `computeItems()` y `toSaleItemResponse()` (`sales/service.ts`), y actualización de los tipos `SaleItemResponse`/`SaleItem` (backend y frontend) — explícitamente fuera del alcance de este sprint.

---

## 11. Adenda — Motor de Promociones y Descuentos (P.1–P.8): cierre completo

**Fecha:** 27–28 de julio de 2026
**Origen:** implementación completa del Motor de Promociones y Descuentos, ajena a los hallazgos numerados de la auditoría original — se documenta aquí siguiendo el mismo criterio que la sección 10 (registro de trabajo relevante de backend, no solo hallazgos de auditoría).

**Alcance implementado (bloques P.1 a P.7, todos con análisis → aprobación → implementación → revisión → aprobación):**

- `SaleAppliedPromotion` (tabla de auditoría) + `Promotion`/`PromotionProduct`/`PromotionCategory` (catálogo, con CRUD completo y permisos `promotions.view/create/update`).
- `PromotionEngine` puro (`src/shared/services/promotionEngine/`) — elegibilidad, condiciones (fecha/hora/día de semana, zona horaria `America/Costa_Rica`), cálculo de beneficio (`PERCENTAGE`/`FIXED_AMOUNT`/`SPECIAL_PRICE`/`BUY_X_PAY_Y`), orquestador de prioridad/exclusividad/acumulación. Nunca importa Prisma ni conoce el dominio de Ventas. 21 pruebas unitarias.
- `PromotionApplicationService` — único adaptador entre el motor y `sales/service.ts`. 6 pruebas unitarias.
- Integración real en `createSaleTransaction()` (las promociones automáticas se aplican de verdad en cada venta) y `POST /sales/quote` (cotización sin persistir, reutilizando el mismo núcleo de cálculo — `computeSaleQuoteCalculation()`, renombrada 03/08/2026 al separarla de la transacción de venta, ver sección 16.1 — que la venta real, garantía arquitectónica de que "misma cotización = misma venta").

**Defecto real encontrado y corregido durante el QA integral (17 pruebas funcionales contra el sistema real):** `POST /sales/quote` podía devolver `discountTotal`/`total` con más de 2 decimales en escenarios de descuento porcentual sobre un subtotal ya ajustado por promociones automáticas, mientras `POST /sales` mostraba el valor redondeado — porque ninguna operación de `shared/utils/money.ts` redondeaba explícitamente; el "redondeo" real dependía, hasta ahora, del efecto secundario de Postgres al truncar una columna `Decimal(_,2)` al persistir. Es decir: **el bug era preexistente desde el Bloque P.1** (afectaba también a `createSaleTransaction()`), pero permaneció invisible mientras el único consumidor era `POST /sales` (que siempre pasaba por la base de datos); quedó expuesto recién cuando `POST /sales/quote` (Bloque P.7) devolvió un cálculo puramente en memoria, sin ese enmascaramiento.

**Corrección — estrategia oficial de redondeo monetario (única fuente de verdad, con una implementación por tipo de dato del dominio, no duplicación accidental):**

- **`roundMoney()`** (nueva, `shared/utils/money.ts`) — 2 decimales, mitad hacia arriba (`Prisma.Decimal.ROUND_HALF_UP`). Aplicada explícitamente en `computeItems()` (subtotal/impuesto de cada línea) y `computeCartDiscountAmount()` (descuento manual de carrito) de `sales/service.ts` — los dos puntos donde una multiplicación/división podía introducir más de 2 decimales.
- **`roundCurrency()`** (`shared/services/promotionEngine/calculation.ts`, sin cambios) — misma regla matemática, ya existente desde el Bloque P.4, del lado `number` del motor (deliberadamente desacoplado de `Prisma.Decimal`).

Re-verificado con el mismo carrito que expuso el defecto: cotización y venta persistida vuelven a coincidir byte a byte.

**Estado final:** Motor de Promociones **APTO PARA PRODUCCIÓN** (17/17 pruebas de QA en verde tras la corrección). Detalle completo, incluida la integración visual del POS (frontend) y la base de datos oficial de pruebas, en `carniceria-pos-front/docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` (sección 17) y `carniceria-pos-front/ROADMAP.md`.

---

## 12. Adenda — Commercial Pricing Engine (PROMO-01 a PROMO-12): modelo comercial, rentabilidad y snapshot histórico

**Fecha:** 30 de julio de 2026
**Origen:** evolución del catálogo `Promotion` (sección 11) para representar promociones impuestas o financiadas por un proveedor, mismo criterio que la sección 11: registro de trabajo relevante de backend, ajeno a los hallazgos numerados de la auditoría original.

**Alcance implementado (bloques PROMO-01 a PROMO-12, todos con análisis → aprobación → implementación → revisión → aprobación):**

- **Modelo comercial de `Promotion`** (migración aditiva `20260730165709_add_promotion_commercial_fields`): `supplierId` (nullable, FK a `Supplier`, `onDelete: SetNull`), `commercialOrigin` (enum `PromotionOrigin`: `INTERNAL` default / `SUPPLIER_MANDATED`), `fundingType` (enum `PromotionFundingType`: `NONE` default / `SUPPLIER_SUBSIDY_PER_UNIT` / `SUPPLIER_SUBSIDY_PERCENTAGE`), `supplierSubsidyValue` (nullable). Todas las promociones existentes migraron con los valores por defecto — verificado en vivo, sin backfill manual.
- **`assertCommercialCoherence()`** (`src/modules/promotions/promotions.service.ts`) — 5 reglas de coherencia (la quinta, `fundingType ≠ NONE` exige `supplierId`, agregada en PROMO-12 tras un hallazgo de la QA de PROMO-11), espejadas en `CreatePromotionSchema` de ambos repos. Corre en creación y en edición (sobre el estado fusionado con la promoción existente).
- **`shared/services/pricingAnalysis/`** (nuevo módulo, **no es un motor nuevo**): coordinador puro que combina `CostEngine.getEffectiveCost()` y `PromotionEngine.evaluatePromotions()` sin modificar ninguno de los dos. `analyzePromotionProfitability()` (simulación para la vista previa administrativa) y `calculateLineProfitability()` (integración real, reutiliza el resultado ya calculado del motor de promociones — "no recalcular promociones").
- **Integración real en Ventas:** `computeSaleQuoteCalculation()` (núcleo compartido de `POST /sales` y `POST /sales/quote`, sección 11; renombrada 03/08/2026, ver sección 16.1) calcula ahora, por línea, costo efectivo/utilidad/margen/aporte del proveedor/rentabilidad final. Expuesto únicamente en `SaleQuoteItemResponse.profitabilityAnalysis` (`POST /sales/quote`) — deliberadamente no agregado a la venta persistida (`SaleResponse`), ni a Reportes ni al Dashboard.
- **Snapshot histórico inmutable** (migración aditiva `20260730174450_add_sale_applied_promotion_commercial_snapshot`): `SaleAppliedPromotion` gana `commercialOrigin`, `fundingType`, `supplierId` (snapshot plano, sin relación activa — a propósito), `supplierSubsidyValue` y `supplierContributionAmount` (monto realmente aplicado, distinto del parámetro crudo de la regla). Mismo criterio de snapshot que `SaleItem.expectedWastePercentAtSale`. Verificado en vivo: se creó una venta con una promoción financiada, se editó la promoción después, y la fila histórica no cambió.

**QA integral (PROMO-11):** escenarios positivos y negativos de las reglas de coherencia, compatibilidad confirmada contra las 38 promociones existentes en el catálogo, y un caso no probado en bloques anteriores (múltiples promociones acumuladas en una misma línea con financiamiento distinto cada una) verificado matemáticamente correcto. 4 hallazgos menores, 1 corregido de inmediato (PROMO-12); los otros 3 (datos de prueba sin limpiar, un caso límite de `scopeType: CART` + `SUPPLIER_SUBSIDY_PER_UNIT`, y el límite preexistente de 100 productos en el selector) quedan documentados como deuda no bloqueante en `carniceria-pos-front/ROADMAP.md`.

**Estado final:** Commercial Pricing Engine **APTO PARA PRODUCCIÓN**. `PromotionEngine` y `CostEngine` permanecen exactamente como se documentaron en la sección 11 y en el Módulo de Costos, respectivamente — ninguno de los dos fue modificado. Detalle completo en `carniceria-pos-front/docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` (sección 18) y `carniceria-pos-front/ROADMAP.md`.

**Deuda técnica NO generada por este bloque:** `BUY_X_PAY_Y` y `COMBO` (`PromotionEffectType`/`PromotionScopeType`) están completamente implementados y probados en el motor desde el Bloque P.4 — no tienen todavía UI de administración dedicada (campos de `buyQuantity`/`payQuantity`/combos multi-producto en el formulario de promociones del frontend) ni datos de ejemplo en el seed de negocio actual (exclusión deliberada, ver `ROADMAP.md`, "Próximos desarrollos propuestos"). No es código incompleto — es una decisión de alcance de UI/datos, no del motor.

---

## 13. Adenda — Módulo de Lotes (Batch Management, LOTES-00 a LOTES-09): trazabilidad completa, FEFO y cierre integral

**Fecha:** 30–31 de julio de 2026
**Origen:** módulo nuevo completo de trazabilidad por lote, ajeno a los hallazgos numerados de la auditoría original — se documenta aquí siguiendo el mismo criterio que las secciones 10-12 (registro de trabajo relevante de backend, no solo hallazgos de auditoría).

**Alcance implementado (bloques LOTES-00 a LOTES-09, todos con análisis → aprobación → implementación → revisión → aprobación):**

- **Corrección de un bug real preexistente (LOTES-00, prerrequisito):** `create()` de Compras registraba movimientos de inventario sin importar el `status` de la compra (incluso en `DRAFT`), acreditando inventario dos veces cuando la compra pasaba después a `RECEIVED`. Corregido antes de construir el Módulo de Lotes sobre esa base.
- **Modelo `Batch`** (migración aditiva `20260731050336_add_batch_module`): código autogenerado vía `DocumentSequence` (mismo mecanismo que `Sale.documentNumber`), `productId`/`sucursalId`/`purchaseItemId` (único)/`supplierId`, `supplierLotCode`, `receivedAt`/`productionDate`/`expiryDate`, `initialQuantity`/`availableQuantity`, `unitCost`, `expectedWastePercent`, `status` (enum `BatchStatus`: `ACTIVE`/`DEPLETED`/`EXPIRED`/`BLOCKED`), `closedAt`, `notes`. `Product.requiresBatch` (default `false`) es el único interruptor que activa el módulo para un producto — 100% aditivo, sin backfill, sin afectar ningún producto existente.
- **Integración con Compras:** al recibir una compra (`status: RECEIVED`), cada línea de un producto con `requiresBatch` genera automáticamente un lote (`createBatchesForReceivedPurchase`), idempotente por `purchaseItemId`.
- **Integración con Ventas (consumo FEFO):** selección automática de lote(s) por vencimiento más próximo primero (`receivedAt` como desempate FIFO), con reparto entre múltiples lotes si es necesario; rechazo explícito de la venta si el saldo de lotes `ACTIVE` no alcanza, aunque el agregado de `Inventory.quantity` sí alcance.
- **Integración con Mermas y Devoluciones**, y política oficial de transición de estados (`ACTIVE → DEPLETED` automático al agotarse; `ACTIVE → EXPIRED` automático vía barrido "lazy" en cada lectura relevante; `BLOCKED` y reversiones solo manuales vía `PATCH /batches/:id`).
- **Reportes:** `GET /reports/batches` (foto agregada por estado + próximos a vencer) y `GET /reports/batches/:id` (trazabilidad completa de un lote: resumen + todos sus movimientos en orden cronológico).
- **Frontend administrativo completo** (`features/batches/`) y control por lotes expuesto en el CRUD de Productos (`requiresBatch` aceptado por `POST`/`PATCH /products`, switch en el formulario).
- **Trazabilidad completa de recepción (LOTES-09):** `PurchaseItem` gana `supplierLotCode`/`productionDate`/`expiryDate` (migración aditiva `20260731063449_add_purchase_item_batch_traceability`), capturables por línea en el formulario de Compras y propagados al `Batch` creado.

**Invariante central del módulo:** `Σ Batch.availableQuantity (lotes con estado ≠ DEPLETED) = Inventory.quantity` (fórmula corregida durante el propio QA integral: no es "solo lotes `ACTIVE`" — un lote `EXPIRED` puede seguir teniendo saldo real sin consumir, que sigue siendo existencia física; solo `DEPLETED` implica saldo 0 por construcción).

**Defectos reales encontrados y corregidos durante el QA integral (LOTES-07, 13 puntos de control end-to-end contra la base de datos real):**

1. **[Crítico] Anulación/corrección de venta rompía el invariante** — `voidSaleTransaction()` (mecanismo preexistente de Ventas, anterior al Módulo de Lotes) reversaba `Inventory.quantity` sin considerar lotes; para un producto con `requiresBatch`, anular una venta incrementaba el agregado sin acreditar ningún lote. Corregido con la misma solución ya aprobada para Devoluciones: se crea un lote de reingreso nuevo (sin `purchaseItemId`/`supplierId`, identificado por texto en `notes`) cuando no es posible identificar el lote exacto de origen.
2. **[Menor]** `PATCH /batches/:id` no barría vencimientos antes de operar — corregido reutilizando la misma función de lectura que ya aplica esa política en el resto del módulo.

**Riesgo residual, no corregido (sistémico, preexistente, no introducido por este módulo):** bajo escritura concurrente sobre el mismo producto/lote, el incremento atómico evita el *lost update* pero no impide sobreventa si dos transacciones leen "saldo suficiente" antes de que la otra confirme — mismo perfil de riesgo que la condición de carrera ya documentada en `recordMovement()` (sección 6/7 de este informe). No bloquea Release 1.0.

**Estado final:** Módulo de Lotes **APTO PARA PRODUCCIÓN**. Detalle completo, incluida la trazabilidad visual del frontend, en `carniceria-pos-front/docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` (sección 19) y `carniceria-pos-front/ROADMAP.md`.

---

## 14. Adenda — `FIXED_PRICE` en Promociones (PROMO-13): precio fijo por unidad

**Fecha:** 31 de julio de 2026
**Origen:** evolución del `PromotionEngine` (secciones 11/12) para representar un precio fijo **por unidad**, distinto del efecto `SPECIAL_PRICE` ya existente (precio fijo **total** del conjunto de líneas afectadas) — mismo criterio que las secciones 10-13: registro de trabajo relevante de backend, ajeno a los hallazgos numerados de la auditoría original.

**Alcance implementado (análisis previo aprobado explícitamente antes de codear, luego implementación → revisión → aprobación):**

- Nuevo valor de enum `PromotionEffectType.FIXED_PRICE` (migración aditiva, sin backfill).
- Nuevo caso en el dispatch table de `shared/services/promotionEngine/calculation.ts`: `Σ cantidad × (precio_actual − precio_fijo)` por línea afectada — a diferencia de `SPECIAL_PRICE` (`total − precio_fijo`), escala correctamente con la cantidad/peso real de cada línea (crítico para productos de peso variable). El resto del motor (elegibilidad, condiciones, orquestación de prioridad/exclusividad/acumulación) es agnóstico al `effectType` y no requirió cambios.
- **Restricción de alcance (decisión aprobada explícitamente):** `FIXED_PRICE` solo válido con `scopeType: PRODUCT`/`CATEGORY` — rechazado para `CART`/`COMBO`. Validado en `CreatePromotionSchema` (creación) y en `assertCommercialCoherence()`/validación de servicio (sobre el estado fusionado, cubre ediciones parciales).
- **Precio fijo ≥ precio de venta actual (decisión aprobada explícitamente):** no bloquea la creación/edición de la promoción — advertencia visual no bloqueante únicamente en el frontend, sin validación dura en el backend.
- 4 pruebas unitarias nuevas en `promotionEngine.test.ts` (cantidad 1, peso variable 3.5 kg, `CATEGORY` con productos de precio distinto, precio fijo ≥ precio de lista).

**Verificación:** 25/25 en `promotionEngine.test.ts` (21 previas + 4 nuevas); 3 fallos preexistentes en otros archivos de prueba, confirmados no relacionados (`git diff` confirma que esos archivos no fueron tocados por este bloque). Smoke test real: una venta de 3.5 kg con precio fijo de ₡2.200/kg descontó exactamente ₡1.050 y cobró ₡7.700 — confirma que el motor multiplica por la cantidad real en vez de colapsar el total, a diferencia de `SPECIAL_PRICE`.

**Estado final:** `FIXED_PRICE` **APTO PARA PRODUCCIÓN**. `PromotionEngine`, `CostEngine` y `PricingAnalysis` permanecen exactamente como se documentaron en las secciones 11/12 — ninguno fue modificado. Cambio 100% aditivo. Detalle completo en `carniceria-pos-front/docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` (sección 20) y `carniceria-pos-front/ROADMAP.md`.

---

## 15. Adenda — Fase 19 (hallazgos de seguridad 31/07/2026): migraciones reales, permisos granulares conectados, revocación de tokens y rate limiting por categoría

**Fecha:** 31 de julio de 2026 (posterior a las secciones 11-14, verificado en código durante esta revisión de documentación)
**Origen:** hardening de seguridad ajeno a los hallazgos numerados de la auditoría original — se documenta aquí siguiendo el mismo criterio que las secciones 10-14. Resuelve directamente dos ítems que este informe tenía abiertos como deuda técnica: **hallazgo 6.1** (sin migraciones de Prisma) y **hallazgo 1.2** (`authorizePermission()` sin uso), además de cerrar el riesgo "sin revocación de tokens" de la sección 6.

Verificado en código (comentarios propios del código referencian "Hallazgo de seguridad #N, auditoría 31/07/2026" y "Fase 19, Bloque 19.3/19.4"):

- **Migraciones reales** (`prisma/migrations/`): historial de ~28 migraciones versionadas desde julio de 2026 (`0_initial` en adelante). `docs/DEPLOYMENT.md` actualizado para reflejar `prisma migrate deploy` como el flujo real, no `prisma db push`. Cierra hallazgo 6.1.
- **`authorizePermission()` conectado**: verificado con grep sobre `src/modules/*/routes.ts` — usado en 29 archivos de rutas (prácticamente todos los módulos con capa HTTP). Un subconjunto de endpoints (ej. `POST /inventory`, `PATCH /sales/:id`, `POST /cash`, `/audit`) sigue usando `authorize(<rol>)` por rol en vez de por permiso — mezcla deliberada según los comentarios del código, no un olvido. Cierra hallazgo 1.2.
- **Rotación y revocación de refresh tokens**: nuevo modelo `RefreshToken` (hash del token, nunca el JWT completo; `revokedAt`) + `User.tokenVersion` — un cambio de `tokenVersion` (logout, cambio de rol/contraseña/reactivación) invalida todos los refresh tokens emitidos previamente, tratado como incidente de seguridad (`refreshTokenRepository.revokeAllByUserId`). Cierra el riesgo "sin revocación de tokens" de la sección 6.
- **Auditoría de eventos negativos**: `AuditAction` gana `LOGIN_FAILED`/`ACCESS_DENIED` — antes el log de auditoría solo registraba acciones exitosas, sin rastro de intentos fallidos de login o accesos denegados.
- **Rate limiting por categoría** (`config/rateLimitPolicies.ts`, `middlewares/rateLimit.middleware.ts`): reemplaza el limiter único global por cuatro categorías independientes (`auth`, `transactional`, `reports`, `administrative`), cada una con su propio contador, declaradas por endpoint en cada `<módulo>/routes.ts`. Hoy las cuatro categorías comparten el mismo valor numérico (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` de `.env`, default 300 req/15min) — el bloque separó la arquitectura, no calibró los números por categoría todavía (queda como trabajo futuro, ver ítem siguiente).

**No verificado en profundidad** (fuera del alcance de esta revisión de documentación, solo de código de `docs/`): si existe un informe de auditoría dedicado a la Fase 19 con la lista completa de hallazgos de seguridad #1 a #10 referenciados en los comentarios del código. Si ese informe existe en otro lugar, debería enlazarse aquí; si no existe como documento propio, esta sección 15 es su único registro en `docs/`.

### Deuda nueva, no resuelta por este bloque: 429 (Too Many Requests) y falta de respuesta temporal bajo alto volumen intercalado — **RESUELTO, ver sección 16**

**Origen:** observado en una prueba manual real (no automatizada con k6/`load-tests/`, ver `docs/LOAD_TESTING.md`) — aproximadamente 31 compras consecutivas de alto volumen (~₡1.500.000 procesados en total), intercaladas con ventas, devoluciones y anulaciones. El sistema devolvió errores HTTP 429 y los módulos de Caja, Ventas e Inventario dejaron de responder temporalmente (~1 minuto) antes de recuperarse por sí solos, sin reinicio manual.

**Estado (03/08/2026):** investigado a fondo y **resuelto** en dos bloques separados — ver sección 16 para el detalle completo de ambas investigaciones (causa raíz, evidencia empírica y corrección implementada). Resumen de los dos candidatos que se listaban aquí como "sin confirmar":

1. **Rate limiting** — **confirmado como causa contribuyente real** (no la única): las categorías compartían el mismo `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`, y en particular `POST /sales/quote` agotaba el cupo de `transactional` junto con las ventas reales. Corregido con recalibración por categoría (sección 16.2).
2. **Tormenta de invalidación de React Query** — revisada en profundidad (`reportQueryKeys.ts`, `DashboardPage.tsx`): descartada como defecto — el sistema de invalidación granular ya estaba correctamente acotado desde un bloque previo aprobado (invalida únicamente las queries realmente afectadas por cada evento de dominio, no un prefijo global). El volumen de requests que se observaba era tráfico legítimo y esperado, no una fuga — absorbido por la recalibración del punto 1.

Una causa adicional, no listada originalmente en esta sección porque todavía no se había identificado en esta fecha, resultó ser la más severa de las dos: agotamiento del pool de conexiones de Prisma por doble conexión simultánea en `createSaleTransaction()` (sección 16.1) — confirmada con evidencia empírica de `pg_stat_activity`/`pg_locks`, no solo inferencia.

---

## 16. Adenda — Dos hallazgos de estabilidad bajo carga real (03/08/2026): agotamiento del pool de Prisma y recalibración del Rate Limiter

**Origen de ambos:** a diferencia del resto de esta auditoría (revisión de código/documentación), estos dos hallazgos fueron descubiertos durante **uso real e intensivo del sistema** (no un escenario automatizado de `load-tests/`) — el primero durante ~31 compras consecutivas de alto volumen intercaladas con ventas/devoluciones/anulaciones (sección 15, "Deuda nueva"); el segundo, en una sesión posterior, durante ~60 ventas reales navegando repetidamente entre POS y Dashboard para verificar KPIs después de cada venta, con la diferencia de que en este segundo caso el sistema **no se recuperó solo** (el primer episodio sí se autorrecuperó en ~1 minuto). Ambos quedan **investigados con evidencia empírica y corregidos antes de la versión 1.0**.

### 16.1 Agotamiento del pool de conexiones de Prisma (doble conexión por venta)

**Investigación (solo lectura, sin cambios de código):** se reprodujo el escenario de forma controlada contra una base de datos de pruebas aislada (`carniceria_pos_loadtest`, nunca contra desarrollo/producción), instrumentando `pg_stat_activity`/`pg_locks` y monitoreo de CPU durante ráfagas de ventas concurrentes.

**Causa raíz confirmada:** `computeSaleQuote()` (nombre previo a la corrección) se invocaba dentro de la transacción de la venta (`tx`), pero sus llamadas internas a `salesRepository.findProductsByIds`/`findTaxesByIds` estaban *hardcodeadas* al cliente Prisma singleton, sin recibir `db` como parámetro — es decir, **cada venta en curso mantenía dos conexiones del pool ocupadas simultáneamente**: la de su propia transacción (`tx`) y una segunda para leer catálogo/promociones, mientras la primera seguía abierta. Bajo ventas concurrentes, esto duplicaba la presión real sobre el pool respecto de lo que la configuración (`connection_limit=20`) esperaba soportar.

**Hipótesis original descartada con evidencia:** el sospechoso inicial (contención sobre la fila global de `DocumentSequence`) se descartó — cero muestras de `pg_stat_activity`/`pg_locks` (de más de 500 tomadas en 4 ráfagas de carga) mostraron actividad sobre `document_sequences`. El HTTP 429 observado en el episodio original también se descartó como causa: nunca se disparó durante la reproducción (el volumen de requests se mantuvo muy por debajo del umbral de rate limiting vigente en ese momento) — era, como sospechaba el usuario, una consecuencia visible del problema, no su origen.

**Corrección implementada** (`src/modules/sales/service.ts`, `src/modules/sales/repository.ts`): se separó el cálculo de la cotización (`computeSaleQuoteCalculation()`, ya no recibe `db` — sus lecturas de catálogo siempre iban al singleton de todos modos, moverlo fuera de la transacción no cambia qué conexión las sirve) de la validación de stock (`assertSufficientStock`, que sí necesita `tx` y se ejecuta ahora como primer paso dentro de la transacción). `createSaleWithGeneratedDocumentNumber()` precalcula la cotización **antes** de abrir la transacción y antes del ciclo de reintentos, reduciendo al mínimo necesario el tiempo real que cada venta mantiene una conexión de escritura abierta. Optimización relacionada aplicada en el mismo bloque: inserción de `SaleAppliedPromotion` en lote (`createAppliedPromotions`, `createMany`) en vez de un `INSERT` por promoción aplicada.

**Verificación empírica antes/después:** 35/35 y 80/80 ventas concurrentes completadas exitosamente tras la corrección, contra hasta 34/35 fallos (errores 5xx bajo timeout de transacción) antes de aplicarla, en la misma base de datos de pruebas aislada.

**Regla de negocio explícitamente NO tocada:** mismos cálculos, mismo resultado funcional, mismo orden relativo entre `assertSufficientStock`/`assertNoBelowCostSale`, ninguna API pública ni ruta modificada.

### 16.2 Recalibración de categorías del Rate Limiter (`salesQuote` separada de `transactional`)

**Investigación (solo lectura):** localizado el rate limiter (`express-rate-limit`, `MemoryStore`, `keyGenerator` por IP) y confirmado que su mecanismo de reset por ventana es correcto (código de la librería revisado directamente) — descartada la hipótesis de una fuga/contador que nunca resetea. La causa real: `POST /sales/quote` (simulación del carrito, se llama en cada edición — no una vez por venta) compartía cupo con `POST /sales` bajo la categoría `transactional`, agotándolo mucho antes de completar un turno real de ~60 ventas. La categoría `reports` (Dashboard + notificaciones + listados GET) también estaba subdimensionada frente al patrón real de invalidación de React Query (revisado y confirmado como correctamente acotado, no defectuoso — ver sección 15).

**Corrección implementada:** nueva categoría `salesQuote` (`config/rateLimitPolicies.ts`, `middlewares/rateLimit.middleware.ts`), aplicada únicamente a `POST /sales/quote` (`modules/sales/routes.ts`). Las 5 categorías (`auth`/`salesQuote`/`transactional`/`reports`/`administrative`) dejaron de compartir `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`: cada una lee ahora su propio par de variables de entorno (`config/env.ts`), calibradas a su volumen real:

| Categoría | Ventana | Máximo | Motivo |
|---|---|---|---|
| `salesQuote` | 1 min | 120 | Simulación sin persistir, llamada por cada edición del carrito |
| `transactional` | 5 min | 150 | Escrituras reales de negocio (venta, compra, caja, devolución, ajuste de inventario) |
| `reports` | 5 min | 900 | Lecturas de alto volumen (Dashboard ~12 queries/montaje, notificaciones cada 60s, listados GET) |
| `administrative` | 15 min | 200 | CRUD esporádico (usuarios, roles, permisos, catálogos de configuración, auditoría) |
| `auth` | 15 min | 300 | Sin cambios — no implicada en la investigación (refresh/logout, bajo volumen) |

Sin cambios de middleware de autenticación/autorización, sin cambios de rutas, sin subir límites como parche genérico — cada valor está justificado por el patrón de tráfico real documentado en esta sección.

**Nota metodológica:** ambos hallazgos (16.1 y 16.2) fueron descubiertos y validados mediante **uso real e intensivo del ERP**, no únicamente mediante los escenarios automatizados de `load-tests/` (`docs/LOAD_TESTING.md`) — el paso natural siguiente, correr `stress-to-429.js`/`mixed-soak.js`/`sales-load.js` contra el sistema ya corregido, queda documentado como validación adicional posible (concurrencia/volumen), pero **ya no es un requisito pendiente**: la sección 17 (más abajo) documenta la suite de validación de uso real que efectivamente se ejecutó y aprobó, cerrando formalmente la etapa de estabilización.

---

## 17. Adenda — Validación final de estabilidad bajo uso real (Niveles 2 y 3, 03/08/2026): cierre oficial de la etapa de estabilización del backend

**Origen:** tras corregir los dos hallazgos de la sección 16 (pool de Prisma, Rate Limiter), se ejecutó una suite de pruebas de **uso real** (no automatizada con k6, no de concurrencia ni volumen artificial) para confirmar empíricamente que ambas correcciones sostienen el backend bajo un patrón de tráfico genuino, antes de dar la etapa de estabilización por cerrada y continuar con la siguiente gran etapa del proyecto (Electron, ver `ROADMAP.md`).

**Infraestructura:** `load-tests/realistic-session/` (nuevo directorio, conservado permanentemente como parte del proceso oficial de QA del backend) — `cashier-realistic-session.mjs` (Nivel 2), `cashier-intensive-shift.mjs` (Nivel 3), y helpers compartidos en `lib/common.mjs`/`lib/monitor.mjs` (cliente HTTP mínimo con fetch nativo, login/bootstrap/refresh de token, PRNG determinístico, monitoreo de memoria del proceso y del pool de PostgreSQL). Ambos niveles corrieron contra una base de datos aislada (`carniceria_pos_realuse`), nunca contra desarrollo/producción, con el backend compilado (`npm run build`, no `tsx watch`).

### Nivel 2 — sesión realista de un cajero (~12 min) — ✅ APROBADO

Secuencia aleatoria (no un patrón fijo) de búsqueda de productos, armado/edición de carrito, cotización, confirmación de venta, historial de ventas, Dashboard, Reportes, movimientos de caja, vuelta al POS. **Resultado: 39 ventas, 634 consultas, 673 operaciones totales, cero errores de cualquier tipo** (4xx/429/5xx/timeouts). Reporte JSON: `load-tests/realistic-session/reports/cashier-realistic-session_2026-08-03T14-40-46-531Z.json`.

### Nivel 3 — jornada intensiva de un cajero (~26 min) — ✅ APROBADO (prueba definitiva)

Mismo criterio de aleatoriedad, agregando anulaciones, correcciones, devoluciones y compras grandes (**>₡8.000.000 cada una**, para estresar Inventario/Lotes/FEFO/Costos/Promociones/Kardex de verdad — naciendo `RECEIVED` directamente). Después de cada compra/anulación/corrección/devolución se fuerza una consulta de Dashboard+Inventario+Reportes, obligando al backend a recalcular continuamente.

| | Mínimo exigido | Resultado real |
|---|---|---|
| Ventas | 100 | 184 |
| Anulaciones | 40 | 85 |
| Correcciones | 20 | 59 |
| Devoluciones | 20 | 41 |
| Compras (>₡8M c/u) | 30 | 59 |

**Métricas** (3942 operaciones, 3514 consultas): promedio general 17.8ms (p95 31.9ms, p99 50.3ms); por tipo — venta 25.3/35.2/43.8ms, compra 43.6/55.8/82.5ms, anulación 28.2/36.2/50.9ms, corrección 50.1/74.6/81.4ms, devolución 35.6/47.0/50.0ms (prom/p95/p99). Memoria del proceso backend estable (131.7MB→183.4MB). Pool de PostgreSQL: máximo 11 conexiones simultáneas (`connection_limit=20` nunca en riesgo). Degradación progresiva: +2.7%, no relevante. **Errores: cero** — 0 4xx, 0 429, 0 5xx, 0 timeouts, 0 excepciones. Reporte JSON: `load-tests/realistic-session/reports/cashier-intensive-shift_2026-08-03T15-42-10-243Z.json`.

**Hallazgo del proceso de prueba (no del backend):** la primera corrida del Nivel 3 cruzó los 15 minutos de vida del `accessToken` JWT sin refrescarlo, produciendo 401 en cascada y una ráfaga de 429 derivada — artefacto del cliente de prueba. Corregido agregando refresco periódico (`POST /auth/refresh` cada 8 min) al script; el resultado de arriba corresponde a la corrida ya corregida.

### Conclusión técnica final

**El backend queda validado para uso intensivo real de un único cajero.** Combinando esta validación con las correcciones de la sección 16, **la etapa de estabilización del backend queda oficialmente CERRADA (03/08/2026)**. La siguiente gran etapa del proyecto es Electron (aplicación de escritorio), sistema de instalación, sistema de actualizaciones, funcionamiento offline/sincronización y Release 1.0 — ver `ROADMAP.md` para el detalle.

---

## 18. Adenda — Auditoría de riesgos críticos antes de V1 (07/08/2026): condición de carrera en inventario, protección del costo promedio, y cierre de caja atómico

**Origen:** con la V1 cerca, se pidió una auditoría de enfoque exclusivamente crítico (matemática financiera, integridad de datos, atomicidad, condiciones de carrera) sobre Ventas/Compras/Devoluciones/Mermas/Caja/Promociones/Reportes — nunca cosmética, nunca ideas de V2. El método de pago "Mixto" fue **excluido explícitamente del alcance** por decisión del usuario (no forma parte de la V1); cualquier hallazgo relacionado se descartó sin implementar.

**5 hallazgos reales, 4 corregidos (el hallazgo 2 se cerró después, el mismo día, en un bloque dedicado — ver nota al final del punto 2):**

1. **(🟠 Alto, RESUELTO) Condición de carrera en verificación de stock** — Devoluciones (`returns/service.ts`), Cancelación de compra `RECEIVED` (`purchases/service.ts`) y Mermas (`inventoryWaste/service.ts`) verificaban stock/cantidad-ya-devuelta con una lectura simple (`SELECT`/`groupBy`) seguida de una decisión en memoria, sin bloqueo de fila — a diferencia de Ventas (`assertSufficientStock`/`reserveIfSufficient`, atómico desde el "Hallazgo de rendimiento #2" de esta misma auditoría, ver `inventory/repository.ts`). Bajo READ COMMITTED (Postgres), dos operaciones concurrentes sobre el mismo producto/línea podían leer ambas "hay suficiente" antes de que cualquiera confirmara. **Corregido** replicando el mismo patrón atómico: `reserveIfSufficient()` reutilizado tal cual en Compras/Mermas; nueva `returnsRepository.lockSaleItemsForUpdate()` (mismo principio — `UPDATE` no-op que toma el bloqueo de fila — aplicado sobre `SaleItem`, el invariante correcto para Devoluciones) antes de leer cuánto se devolvió previamente. Sin SQL crudo (el proyecto lo evita deliberadamente, ver comentario de `reserveIfSufficient`), sin cambio de schema, sin cambio de reglas de negocio. Validado contra la aplicación Desktop real: devolución real + reintento sobre la misma línea correctamente rechazado; merma real + intento de exceso correctamente rechazado con stock real actualizado; cancelación de compra `RECEIVED` real con inventario revertido exactamente (104→54 kg).

2. **(🟠 Alto, ✅ RESUELTO el mismo día, en un bloque dedicado posterior) Descuento acumulado de promociones `stackable` no acotado en `SaleAppliedPromotion.amountApplied`** (`modules/promotions/promotionApplication.service.ts::translateEngineResult`) — el precio final de una línea SÍ está protegido (`adjustedLineSubtotal = Math.max(0, ...)`, nunca negativo), pero si dos o más promociones acumulables superan el 100% del valor de una línea, el monto persistido como `amountApplied` de cada promoción no se recortaba para coincidir con el descuento real aplicado. Afectaba `calculateLineProfitability()`/`computeSupplierContributionPerUnit()` (`pricingAnalysis.ts`), el Reporte de Utilidad y el ticket. **Corregido** (análisis dedicado con caso reproducible confirmado, luego implementación): dentro de `translateEngineResult`, cuando la suma de `amountApplied` de una línea supera su subtotal real, se prorratean los montos ya calculados (proporcional a su peso, la última entrada absorbe el residuo de redondeo) para que la suma coincida exactamente con el subtotal. Cambio localizado únicamente en esa función — sin tocar el motor de promociones, las reglas `stackable`/no-`stackable`, `adjustedLineSubtotal`, el monto pagado por el cliente, Alegra, Facturación Electrónica, el schema ni la base de datos. Validado con `tsc -b`/`eslint`/`npm run build` limpios y contra datos reales (dev y aplicación Desktop real, con promociones temporales creadas y eliminadas): caso 60%+50% sobre ₡1.000 → `amountApplied` total ₡1.000 exacto (antes ₡1.100), `adjustedLineSubtotal` sin cambios; casos normales (stackable sin exceder, una sola promoción, no-stackable) dan resultados idénticos a antes del fix. Ver `ROADMAP.md` del frontend, sección "HALLAZGO 1 — PROMOCIONES ACUMULABLES", para el mismo detalle desde esa perspectiva (ese análisis dedicado lo llamó "Hallazgo 1" por ser el primero de dos hallazgos financieros reanalizados ese día — mismo ítem que este punto 2).

3. **(🟡 Medio, reanalizado el mismo día — sigue pendiente, sin caso reproducible) Dos motores de redondeo monetario con precisión distinta** — `shared/utils/money.ts` usa `Prisma.Decimal` (regla crítica documentada en ese mismo archivo); `shared/services/promotionEngine/calculation.ts` y `modules/promotions/promotionApplication.service.ts` usan `number` nativo + `Math.round(v*100)/100`, con el riesgo clásico de precisión IEEE754 (ej. `1.005`) que la regla de `Decimal` existe precisamente para evitar. Riesgo bajo (discrepancias de un centavo en casos puntuales), pero es una inconsistencia real entre dos módulos que calculan "lo mismo" con garantías distintas. **Reanalizado en detalle el mismo día que el punto 2:** se probó un ejemplo con moneda real (₡1.005 con descuento de 33,33%) y dio el mismo resultado con `number`+`Math.round` que con `Prisma.Decimal` — **sin caso reproducible encontrado en este sistema**. No implementado — 🟡 se mantiene documentado como riesgo teórico; reabrir el desacople deliberado del motor respecto de `@prisma/client` requeriría un incidente real que lo justifique, no solo un análisis de código.

4. **(🟠 Alto, RESUELTO) División por cero en costo promedio ponderado** (`purchases/service.ts::updateProductCostsFromPurchase`) — la fórmula divide por `(stockActual + cantidadComprada)`; si el hallazgo 1 (arriba) permitiera que `stockActual` fuera negativo, existía una combinación real (no solo teórica) donde esa suma da exactamente 0, y `Prisma.Decimal` lanza una excepción cruda no controlada. **Corregido** con una red de seguridad defensiva: antes de dividir, se verifica que el inventario no sea negativo, que la cantidad comprada sea mayor a 0, y que el denominador sea mayor a 0 — si falla, `ValidationError` claro. Cero cambio en la fórmula ni en su resultado para datos válidos (validado contra la app real: costo resultante idéntico al calculado a mano, ₡4.647,06).

5. **(🟡 Medio, RESUELTO) Cierre de sesión de caja sin escritura condicional** (`cash/service.ts::closeSession`) — la lectura de `existing.status !== 'OPEN'` no impedía que dos cierres casi simultáneos para la misma sesión pasaran ambos esa validación antes de que cualquiera confirmara. **Corregido** con nueva `cashRepository.closeSessionIfOpen()` (`UPDATE ... WHERE status: 'OPEN'` en una sola sentencia, mismo principio atómico que `reserveIfSufficient`) — si `count === 0`, se lanza el mismo `ConflictError` de siempre, sin sobrescribir el cierre ya realizado. `updateSession()` (compartida con la edición genérica de `notes`) queda intacta. Validado contra la app real disparando dos cierres simultáneos reales: uno completó el cierre (200), el otro fue rechazado con el mismo error funcional de siempre (409) — estado final consistente.

**Validación en los tres bloques implementados:** `tsc -b`/`tsc --noEmit`, `eslint` y `npm run build` limpios, sin warnings nuevos; validación funcional adicional contra la aplicación `carniceria-pos-desktop` real (deploy temporal reversible de los `.js` compilados afectados, backup previo, reversión verificada) — nunca solo contra `localhost`/Chrome para el cierre de cada bloque.

**Pendiente real, no implementado:** el instalador `CarniceriaPOS-Setup-1.0.9.exe` (`carniceria-pos-desktop`) se generó localmente ANTES de esta auditoría — no contiene los hallazgos 1/4/5 ya corregidos aquí, ni el hallazgo 2 (cerrado después, el mismo día, en un bloque dedicado posterior). El instalador `1.0.10` generado después sí incluye 1/4/5, pero es igualmente anterior al cierre del hallazgo 2. Publicar un instalador que también lo incluya, o regenerar con esta corrección, es una decisión pendiente del usuario. Ver `ROADMAP.md`, sección "AUDITORÍA DE RIESGOS CRÍTICOS ANTES DE V1", para el mismo detalle desde la perspectiva del frontend/versión.

## 19. Validación fiscal CABYS ↔ Impuesto — ✅ COMPLETADA (07/08/2026)

**Origen:** el único riesgo fiscal real (no de integridad/atomicidad, a diferencia de la sección 18) que quedaba documentado como deuda técnica crítica pendiente para el cierre formal de la V1 — el ERP permitía guardar cualquier combinación CABYS/impuesto sin verificar coherencia tributaria, con riesgo de rechazo de comprobantes electrónicos ante Hacienda al facturar vía Alegra.

**Implementado en tres bloques secuenciales, cada uno analizado y aprobado antes de escribir código:**

1. **Extensión de la importación oficial de CABYS.** `CabysCode.taxIndicator` (nuevo, `String?`, migración `20260807155805_add_cabys_tax_indicator`) captura la columna "Impuesto" del archivo real del BCCR — verificada con evidencia directa (descarga real del `.xlsx`, 20.507 filas de datos): mezcla números decimales (`0.01`/`0.02`/`0.04`/`0.13`) y texto (`"Exento"`/`"1%"`/`"13%"`/`"na"`) para el mismo concepto. `prisma/import-cabys.ts` la captura como columna **opcional** (`resolveOptionalTaxColumnIndex`) — el formato CSV simple, sin esa columna, sigue funcionando exactamente igual.
2. **Validación al crear y editar productos.** Nuevo `modules/products/cabysTaxCoherence.ts`: `interpretOfficialTaxRate()` normaliza los 8 valores reales a puntos porcentuales (decimales y `%` al mismo valor, `"Exento"`→0%, `"na"`/vacío/código no importado→`null`, sin inventar equivalencias no observadas en el catálogo real); `assertCabysTaxCoherence()` solo lanza `ValidationError` (422, con el código CABYS, el impuesto elegido y el oficial) cuando SÍ hay información oficial y no coincide — nunca bloquea por falta de dato. Integrado en `products.service.ts::create()`/`update()` vía `validateCabysTaxCoherenceOnSave()`, comparando siempre la combinación CABYS/impuesto **efectiva** (nueva si se edita, existente si no se toca). Sin cambios en Facturación Electrónica, Alegra, Ventas, Compras ni Reportes.
3. **Indicador visual preventivo (frontend, con una extensión mínima de backend autorizada aparte).** `GET /cabys/lookup` expone `taxIndicator` (`cabys.repository.ts`/`cabys.types.ts`) — cambio aditivo, de solo lectura, sin tocar el filtro/orden/paginación existentes ni ningún otro consumidor del endpoint.

**Validado:** `tsc -b`/`eslint`/`npm run build` limpios en los tres bloques. Los 8 casos de negocio (correcto en 13%/1%/Exento, incorrecto, `"na"`, código inexistente, edición modificando solo el impuesto, edición sin tocar CABYS ni impuesto) probados contra la API real dentro de la aplicación Desktop instalada — incluyendo, para el bloque 1, la carga **real y permanente** del catálogo oficial en la base de esa instalación (20.506 códigos, 20.506 con `taxIndicator` poblado, misma distribución que el archivo del BCCR). El resultado final fue además confirmado visualmente por el usuario en la interfaz gráfica real de Productos (creación y edición) antes de aprobar el cierre del bloque — no solo por API.

**Estado:** el instalador `1.0.10` ya generado (sección 18) es anterior a este bloque y no lo incluye — pendiente de un nuevo build para empaquetarse formalmente. Ver `ROADMAP.md` del repositorio frontend, sección "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO", para el mismo detalle desde la perspectiva del frontend/versión.

## 20. Investigación real 402/código 907 de Alegra + eliminación de Tiquete Electrónico, y limpieza de datos demo (07/08/2026)

**Parte A — Facturación Electrónica.** Toda emisión (Tiquete o Factura) era rechazada por Alegra con `HTTP 402`/código `907` ("Esta acción no se puede realizar en tu plan actual"). Causa real, confirmada directamente por soporte de Alegra: el plan de la cuenta ("Solo Facturación Pro") no incluye el módulo de Bancos, y `payments[].account.id` en `POST /invoices` exige una cuenta de ese módulo. **Corregido** eliminando el campo `payments` por completo del payload, junto con `resolveAlegraAccountId()` y sus constantes de apoyo (`PAYMENT_METHOD_TO_ACCOUNT_KIND`/`AlegraPaymentAccountKind`), borrados, no dejados inertes — consecuencia aceptada: la factura queda "Por cobrar" en Alegra, no "Pagada". Un segundo hallazgo real surgió después: la cuenta tenía dos plantillas de Factura Electrónica simultáneas en `GET /number-templates` (`documentType: 'invoice'`, `isElectronic: true`), una vieja inactiva y la vigente activa/principal, indistinguibles con el filtro anterior — corregido exigiendo `documentType`/`isElectronic`/`status`/`isDefault` los cuatro a la vez en `resolveElectronicNumberTemplateId()`, confirmado contra el JSON real de la cuenta. En el mismo bloque, **se retiró Tiquete Electrónico como decisión de negocio** (no una limitación técnica): `emitInvoice()` perdió su parámetro `documentType`, toda emisión es Factura Electrónica, y una venta sin cliente identificado ya no puede emitir ningún comprobante (`ConflictError` antes de cualquier llamada a Alegra). Una investigación previa había comparado el código actual línea por línea contra un backup real de cuando la emisión "sí funcionaba" — sin encontrar ninguna regresión: la causa real siempre fue de configuración de cuenta, nunca de este repositorio. **Nota de precisión, no asumir más de lo verificado:** cada fix se validó con evidencia real por separado (el fix de `payments` fue confirmado en vivo por el usuario; el filtro de 4 campos fue validado contra el JSON real de la cuenta) — no hay, dentro de esta investigación, una emisión real única que confirme ambos fixes ya combinados; queda como la validación final real pendiente.

**Parte B — Limpieza de datos demo.** Toda instalación nueva real ejecutaba `prisma/seed.ts` completo, que sembraba un dataset de demostración (6 proveedores, 80 productos + inventario alto, 6 promociones) de forma **destructiva** (`resetCatalogData()` borraba Ventas/Compras/Cajas existentes en cada corrida) — ninguna instalación nueva arrancaba realmente limpia. **Corregido** separando `seed.ts` (recortado a bootstrap no-destructivo + catálogo base: categorías/impuestos) del nuevo `seed-demo.ts` (dataset de demostración completo, movido sin cambiar contenido ni lógica, exclusivamente manual vía `npm run prisma:seed:demo`, nunca invocado por el instalador). La base de datos de desarrollo se reconstruyó desde cero (`prisma migrate reset --force`, con el consentimiento explícito del usuario capturado según el propio guardrail de seguridad de Prisma para acciones destructivas invocadas por un agente de IA) y se verificó con evidencia real de API: `configurations`/`roles`/`permissions`/`users`/`categories`/`taxes`/`cabys` poblados correctamente, `products`/`suppliers`/`promotions`/`inventory`/`purchases`/`sales`/`cashMovements`/etc. en cero, creación manual real de categoría/impuesto/producto de prueba confirmada y luego revertida (vía `DELETE` real de la API, no SQL manual).

**Validación en ambas partes:** `tsc -b`/`tsc --noEmit`, `eslint` y `npm run build` limpios en los tres repositorios (backend, frontend, `carniceria-pos-desktop`), sin warnings nuevos más allá de los ya documentados como baseline preexistente. `carniceria-pos-desktop` no requirió ningún cambio propio — ya invocaba `seed.ts` en cada instalación fresca, que ahora es no-destructivo por definición. Ver `ROADMAP.md` del repositorio frontend, secciones "FACTURACIÓN ELECTRÓNICA — INVESTIGACIÓN 402/907 Y ELIMINACIÓN DE TIQUETE ELECTRÓNICO" y "LIMPIEZA DE DATOS DEMO — NUEVO ESQUEMA DE SEEDS", para el detalle completo bloque por bloque de ambas partes.

**Pendiente real, no implementado:** confirmar con una emisión real, end-to-end, el código final combinado de Alegra (ver nota de precisión arriba); eliminar el código muerto identificado (`resolveGenericClient`/`findGenericClient`/`createGenericClient`/`ALEGRA_GENERIC_CLIENT_NAME`/`AlegraGenericClientResult`, y las columnas `AlegraConfig.genericClientId`/`cashAccountId`/`bankAccountId`); el repositorio backend no tiene commits desde el 26/07/2026 — todo este trabajo, y buena parte del resto del ERP, existe únicamente en el working tree.