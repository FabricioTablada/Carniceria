# BACKEND QA

## 1. Objetivo

Este documento define el procedimiento oficial para validar funcionalmente el backend del proyecto `carniceria-pos-backend`.

El objetivo es garantizar que todos los módulos principales del sistema funcionen correctamente después de una instalación nueva o una actualización importante.

---

## 2. Alcance

Este QA valida el flujo completo del sistema:

- Autenticación
- Impuestos
- Categorías
- Proveedores
- Productos
- Inventario
- Compras
- Ventas
- Caja
- Movimientos de Caja

No sustituye las pruebas unitarias ni las pruebas de integración.

---

## 3. Requisitos

Antes de iniciar el QA se debe contar con:

- PostgreSQL funcionando.
- Base de datos creada.
- Variables de entorno configuradas.
- Dependencias instaladas.
- Prisma sincronizado.
- Datos iniciales cargados mediante Seed.

---

## 4. Preparación del entorno

Ejecutar:

```bash
npx prisma db push
npx prisma generate
npm run prisma:seed
npm run dev
```

Una vez iniciado el servidor, continuar con los archivos `.http` de la
carpeta `qa/` (ejecutados en orden numérico, no un único archivo
`backend-qa.http`):

```
qa/01-backend-setup.http
qa/02-backend-flow.http
qa/03-reports-cash.http
qa/04-reports-low-stock.http
qa/05-reports-sales-by-category.http
qa/06-reports-sales-by-cashier.http
qa/07-inventory-adjustment.http
qa/08-close-session-security.http
qa/09-supplier-soft-delete.http
qa/10-auth-refresh-logout.http
```

---

## 5. Flujo Oficial de Validación

El orden de ejecución es obligatorio.

1. Login
2. Taxes
3. Categories
4. Suppliers
5. Products
6. Cash Register
7. Cash Session
8. Purchases
9. Sales
10. Cash Movements
11. Close Cash Session

---

## 6. Criterios de aprobación

El backend será considerado aprobado únicamente cuando:

- Todos los endpoints respondan correctamente.
- No existan errores HTTP inesperados.
- El inventario se actualice automáticamente.
- Los movimientos de inventario se registren correctamente.
- Los movimientos de caja se registren correctamente.
- La sesión de caja cierre correctamente.
- El cálculo del efectivo esperado sea correcto.
- El cálculo de la diferencia sea correcto.

---

## Estado actual

**Versión del Backend:** 1.0

**Estado del QA:** ✅ Aprobado — Release Candidate (05/08/2026), publicado en Desktop como versión 0.1.7

**Última actualización:** 28 de julio de 2026 — QA integral del Motor de Promociones y Descuentos (P.1–P.8) cerrado: 17 pruebas funcionales contra el sistema real (PRODUCT/CATEGORY/CART, prioridades, stackable, exclusive group, fechas, horarios, días de semana, promociones activas/inactivas, cotización vs. venta, detalle de venta, aislamiento e inventario de `POST /sales/quote`, stock insuficiente, regresión). 2 defectos encontrados y corregidos (redondeo monetario entre cotización y venta; detalle de venta inaccesible desde el Backoffice) — re-QA 17/17 en verde. Ver `docs/AUDIT_REPORT.md` sección 11 para el detalle técnico completo.

**Actualización posterior (30 de julio de 2026):** QA integral del Commercial Pricing Engine (PROMO-01 a PROMO-12) cerrado — escenarios positivos y negativos de las 5 reglas de coherencia comercial, compatibilidad confirmada contra las 38 promociones existentes en el catálogo (migración con defaults, sin backfill manual), acumulación de promociones con financiamiento distinto en la misma línea verificada matemáticamente correcta, sin regresión en el listado administrativo de Promociones. 4 hallazgos menores, 1 corregido de inmediato (PROMO-12: `fundingType` distinto de `NONE` ahora exige `supplierId`); los otros 3 quedan documentados como deuda no bloqueante. Ver `docs/AUDIT_REPORT.md` sección 12 para el detalle técnico completo.

**Actualización posterior (31 de julio de 2026):** QA integral del Módulo de Lotes (LOTES-07, Batch Management) cerrado — 13 puntos de control end-to-end contra la base de datos real cubriendo el ciclo completo Compras → Ventas → Mermas/Devoluciones → Reportes, verificando el invariante `Σ Batch.availableQuantity (status ≠ DEPLETED) = Inventory.quantity`. 2 defectos encontrados y corregidos: (1) crítico — anulación/corrección de venta no reingresaba stock a ningún lote para productos con `requiresBatch`, rompiendo el invariante; corregido creando un lote de reingreso, mismo criterio que Devoluciones; (2) menor — `PATCH /batches/:id` no barría vencimientos automáticos antes de operar. Re-verificado en verde tras ambas correcciones. Ver `docs/AUDIT_REPORT.md` sección 13 para el detalle técnico completo.

**Actualización posterior (31 de julio de 2026):** cobertura de pruebas agregada para `FIXED_PRICE` en Promociones (PROMO-13) — 4 pruebas unitarias nuevas en `promotionEngine.test.ts` (cantidad 1, peso variable 3.5 kg, `scopeType: CATEGORY` con productos de precio distinto, precio fijo ≥ precio de lista), suite completa en 25/25. Smoke test real: venta de 3.5 kg con precio fijo de ₡2.200/kg descontó exactamente ₡1.050 y cobró ₡7.700. 3 fallos preexistentes en otros archivos de prueba, confirmados no relacionados con este bloque (`git diff` verificó que esos archivos no fueron tocados). Ver `docs/AUDIT_REPORT.md` sección 14 para el detalle técnico completo.

**Actualización posterior (03 de agosto de 2026): QA de estabilidad bajo uso real — Niveles 2 y 3, ETAPA DE ESTABILIZACIÓN DEL BACKEND CERRADA.** A diferencia de las entradas anteriores (QA funcional por módulo), esta pasada valida el backend bajo **uso real e intensivo**, no solo corrección funcional puntual. Motivada por dos hallazgos de estabilidad detectados en pruebas reales (agotamiento del pool de conexiones de Prisma por doble conexión en `createSaleTransaction()`; recalibración del Rate Limiter por categoría — ambos corregidos, ver `docs/AUDIT_REPORT.md` sección 16), se construyó y ejecutó una suite oficial de QA de estabilidad, `load-tests/realistic-session/` (conservada permanentemente en el repositorio):

- **Nivel 2** (`cashier-realistic-session.mjs`, ~12 min, sesión realista de un cajero): 39 ventas, 634 consultas, 673 operaciones, **0 errores** de cualquier tipo. ✅ APROBADO.
- **Nivel 3** (`cashier-intensive-shift.mjs`, ~26 min, jornada intensiva — prueba definitiva): 184 ventas, 59 compras grandes (>₡8.000.000 cada una), 85 anulaciones, 59 correcciones, 41 devoluciones, 3942 operaciones totales, **0 errores** de cualquier tipo (0 4xx, 0 429, 0 5xx, 0 timeouts), memoria y pool de PostgreSQL estables, sin degradación progresiva. ✅ APROBADO.

Ambos niveles corrieron contra una base de datos aislada (`carniceria_pos_realuse`), nunca contra desarrollo/producción. Reportes JSON completos conservados en `load-tests/realistic-session/reports/`. Detalle técnico completo, métricas y conclusión en `docs/AUDIT_REPORT.md` sección 17 y `docs/LOAD_TESTING.md` sección 8. **Con ambos niveles aprobados, la etapa de estabilización del backend queda oficialmente cerrada.**

**Actualización posterior (04 de agosto de 2026):** Facturación Electrónica vía Alegra (Bloques 7.1–7.20) y Módulo de Clientes (Bloques 8.1–8.5) cerrados — ver `docs/AUDIT_REPORT.md` y `docs/ARCHITECTURE.md` §6.9/§6.10 para el detalle técnico completo. No agregan puntos nuevos a este procedimiento de QA funcional (que no cubre integraciones de terceros); su propia validación quedó documentada en `ROADMAP.md` del repositorio frontend.

**Actualización posterior (05 de agosto de 2026): QA integral por módulos (QA.1–QA.16B) y auditoría de producción de Electron (QA.APP.1–QA.APP.4) — AMBOS CERRADOS.** QA.1–QA.16B revisó cada módulo del ERP (backend + frontend) exhaustivamente, encontrando y corrigiendo varios bugs reales de este backend — timezone de Costa Rica en filtros de fecha (Promociones/Reportes/Dashboard), guards de autorización faltantes (auto-desactivación de usuarios, renombrado de rol/permiso de sistema), desincronización de lotes en mermas sin `batchId`, y protección contra reemisión duplicada de Alegra (`409 CONFLICT`, ver `docs/API.md`). QA.16B (regresión final) no encontró ningún hallazgo nuevo. QA.APP.1/QA.APP.2 (auditoría de la app de escritorio Electron, repositorio `carniceria-pos-desktop`) tocaron este backend en dos puntos reales: la cookie httpOnly del refresh token (`sameSite: 'none'`/`secure: true` incondicional) y ningún otro cambio de código aquí — ver `docs/ARCHITECTURE.md` §6.7 para el detalle completo de ambos. **Veredicto conjunto: el backend está listo para producción — Release Candidate**, sin ningún hallazgo crítico pendiente. Detalle bug por bug en `ROADMAP.md` del repositorio frontend, secciones "QA INTEGRAL POR MÓDULOS" y "AUDITORÍA DE ELECTRON PARA PRODUCCIÓN".

**Actualización posterior (05 de agosto de 2026, validación real de una instalación Electron 0.1.6 ya actualizada varias veces — publicado como versión 0.1.7):** tres hallazgos reales, encontrados y corregidos con evidencia real (logs del backend empaquetado, consultas directas contra la base real de una instalación existente, comparación contra el catálogo oficial de Alegra), ninguno reproducido antes por no existir todavía una instalación real que hubiera pasado por una actualización de módulo tras su primer arranque:

1. **`403` real en `/customers/lookup` y módulo "Clientes" ausente del menú** — causa raíz: el catálogo de `Permission`/`Role`/`RolePermission` solo se sembraba una vez (`initdb` de la instalación); un permiso agregado después (`customers.*`) nunca llegaba a una instalación ya existente en ninguna actualización posterior. Corregido separando ese bootstrap (100% idempotente) del seed completo, para que corra en cada arranque — ver `docs/ARCHITECTURE.md` §6.7 y `carniceria-pos-desktop/README.md` sección "QA.APP.6". Validado contra la base real de la instalación afectada: permisos sincronizados, cero cambios en `Sucursal`/`User`/`Configuration`/catálogo de negocio (conteos idénticos antes/después).
2. **CABYS con formato válido pero inexistente en el catálogo real de Alegra** — un producto con `cabysCode` de 13 dígitos (formato correcto) pero no perteneciente al catálogo oficial de Alegra causaba un `502` real al emitir. Sin corrección de código — se corrige editando el producto con un CABYS real.
3. **Timeout real de Alegra (Bloque 7.22) dejaba una venta indefinidamente "Pendiente" con riesgo real de doble emisión** — una emisión real tardó 14.5s contra un límite de cliente de 10s. Corregido con reconciliación automática (`GET /invoices`, campo nuevo `Sale.alegraEmissionUncertainAt`) antes de informar el fallo y antes de permitir un reintento manual.
4. **Falso negativo real en la reconciliación del punto 3, encontrado sobre la propia venta real usada para validarlo (`VTA-000053`) y corregido el mismo día (Bloque 7.23).** La reconciliación *inmediata* (misma petición del timeout) corría con demasiado poco margen real de tiempo frente a la certificación asíncrona de Alegra, y al no encontrar la factura todavía, limpiaba igual la marca de incertidumbre — dejando la venta sin `alegraInvoiceId` y sin ningún camino de reconciliación futura, con riesgo real de doble emisión en un reintento. Corregido distinguiendo la reconciliación inmediata (nunca limpia la marca si no encuentra nada) de la proactiva en una petición posterior (sí la limpia, ahí ya es una confirmación válida). **Validado de extremo a extremo el mismo día contra la aplicación de escritorio instalada real** (no localhost): una única factura electrónica real autorizada (`VTA-000050`) se emitió correctamente sin timeout (5.2s), persistiendo `alegraInvoiceId`/`alegraInvoiceNumber`/clave electrónica/`alegraInvoiceStatus: "closed"`, con `GET /status`, `POST /email` (reenvío real) y `GET /invoice-xml` también confirmados en 200 contra logs reales — cero regresión en el flujo normal.

Ver `docs/ARCHITECTURE.md` §6.9 y `docs/API.md` para el detalle técnico completo de los cuatro.
