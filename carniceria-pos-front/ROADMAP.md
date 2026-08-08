# ROADMAP — Carnicería POS

**Última actualización:** 7 de agosto de 2026 — **QA.1–QA.16B (ERP) y QA.APP.1–QA.APP.6 (Electron) cerrados, Bloques 7.21/7.22 de Facturación Electrónica cerrados. QA FINAL 1.0 (Bloques 1-6 por módulo + Bloque Final End-to-End) también cerrado — ver sección dedicada "QA FINAL 1.0". Estado: Release Candidate. Versión real publicada más reciente: 1.0.8 (feed de actualizaciones); versión 1.0.10 ya generada localmente (instalador `.exe`, incluye los Bloques 1-3 de la "AUDITORÍA DE RIESGOS CRÍTICOS ANTES DE V1", ver sección "VERSIÓN 1.0.10") pero todavía NO publicada. El pago mixto quedó explícitamente fuera de alcance para la V1 (decisión del usuario), no como "no bloqueante" sino como excluido. **La "Validación fiscal CABYS ↔ Impuesto" — el único riesgo fiscal real que quedaba pendiente para el cierre formal de la V1 — quedó COMPLETADA y validada contra la aplicación Desktop real (ver sección dedicada "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO" más abajo); el instalador 1.0.10 ya generado es ANTERIOR a este bloque y todavía no lo incluye — hace falta un nuevo build para empaquetarlo, no generado en este cierre de documentación.**

**Resumen de esta actualización:** con QA.16B (validación final y regresión completa del ERP, ver sección dedicada) confirmando que ninguna corrección de la fase de QA rompió otra funcionalidad y que el ERP está listo para producción salvo la deuda técnica ya documentada, se auditó por separado la aplicación de escritorio Electron (`carniceria-pos-desktop`) — QA.APP.1 a QA.APP.4, ver sección dedicada "AUDITORÍA DE ELECTRON PARA PRODUCCIÓN" más abajo. Se encontraron y corrigieron **cuatro bugs reales**, dos de ellos críticos: (1) la sesión se perdía tras inactividad únicamente dentro de Electron (cookie de refresh con `SameSite=Lax`, incompatible con el origen `app://bundle`); (2) el backend empaquetado corría permanentemente en postura de desarrollo (rate limit relajado, errores expuestos, sin logs de producción) — y validando ese fix se encontró que **ninguna instalación empaquetada podía arrancar el backend en absoluto** por una variable de entorno faltante (`INTEGRATIONS_ENCRYPTION_KEY`); (3) una fuga de listeners en el actualizador automático; (4) un downgrade automático sin guard — encontrado durante un incidente real ocurrido en la propia validación (una instalación real quedó temporalmente en una versión anterior, sin pérdida de datos). **Un quinto bug real (QA.APP.5)** se encontró después, ya usando la 0.1.4 real recién publicada: se había empaquetado con un frontend desactualizado por horas (faltaba, entre otras cosas, el Módulo de Clientes) — causa raíz en `prepare-package-resources.js`, que solo copiaba los `dist/` existentes sin reconstruirlos. **Un sexto bug real (QA.APP.6)** se encontró después, usando una instalación real ya actualizada varias veces (0.1.4→0.1.5→0.1.6): `GET /customers/lookup` devolvía `403` y "Clientes" no aparecía en el menú — causa raíz demostrada con evidencia real contra la base de esa instalación: el catálogo de `Permission`/`Role`/`RolePermission` solo se sembraba una vez, en el `initdb` original de esa instalación (fechado antes de que existiera el Módulo de Clientes); ningún permiso agregado después llegaba a esa base en ninguna actualización posterior. Corregido separando ese bootstrap (100% idempotente) del seed completo, para que corra en cada arranque normal, sin tocar `Sucursal`/`User`/`Configuration`/catálogo de negocio. Los seis corregidos y revalidados contra un `.exe`/instalación real empaquetada, o contra la base de datos real de la instalación afectada; QA.APP.5 además se revalidó publicando una versión real (0.1.5) al bucket de producción, y QA.APP.6 se validó corriendo el bootstrap nuevo contra la base real de la instalación reportada. En la misma pasada de validación real se encontraron y corrigieron dos hallazgos más de Facturación Electrónica, **Bloques 7.21/7.22** (ver sección dedicada más abajo): un CABYS con formato válido pero inexistente en el catálogo real de Alegra, y un timeout real del cliente HTTP (10s contra una respuesta real de 14.5s) que podía dejar una venta "Pendiente" con riesgo de doble emisión — corregido con reconciliación automática contra Alegra. Todos revalidados y publicados juntos en la versión real **0.1.7**. Detalle técnico completo de cada uno en el `README.md` de `carniceria-pos-desktop`, secciones "QA.APP.1–QA.APP.4", "QA.APP.5" y "QA.APP.6", y en `docs/ARCHITECTURE.md` §6.9/§6.7 del backend.

Para el historial completo de bloques anteriores a esta fecha (QA.1–QA.16A del ERP por módulo, Bloques 7.x de Facturación Electrónica, Bloques 8.x de Clientes, Bloques 1–6.2 de Electron) — ver las secciones dedicadas de este documento, cada una ya cerrada y fechada; no se repiten acá para evitar duplicar lo que ya está documentado más abajo.
**Fuente:** consolidado a partir de `docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md` (secciones 6 y 14-20, "Roadmap de implementación hacia Release 1.0") y `docs/UI_DESIGN_SYSTEM.md`, del repositorio frontend, más `docs/AUDIT_REPORT.md`, `docs/DATABASE.md`/`docs/ARCHITECTURE.md` y `docs/API.md` del repositorio backend (`carniceria-pos-backend`), y verificación directa contra el código real de ambos repos en esta pasada.

Este documento es la vista de **estado y planificación vigente** del proyecto. El detalle técnico completo de cada fase de negocio vive en la auditoría (`docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md`), este documento no lo repite.

Este archivo tiene **dos ejes de trabajo distintos**, que no deben confundirse:

1. **Rediseño UX/UI del ERP (frontend)** — módulo por módulo, en sprints tipo "Bloque" aprobados uno a uno por el usuario. Ver sección inmediatamente debajo. **Con esta actualización, este eje queda cerrado**: los 14 módulos del ERP + el POS ya pasaron por su rediseño y fueron aprobados.
2. **Roadmap de funcionalidad de negocio (backend + integración)** — Fases 1 a 17, ya auditadas y cerradas (motor de promociones, lotes, pricing comercial, etc.). Ver "FASES COMPLETADAS" más abajo. Que una fase de negocio esté "✅ Completada" **no implica** que ese módulo ya pasó por el rediseño UX/UI — son dos cosas distintas (aunque a esta fecha, ambos ejes ya convergen: todo módulo con fase de negocio completa también tiene su UI rediseñada).

---

## VERSIÓN 1.0.5 — EN CURSO (06/08/2026)

**La versión 1.0.4 queda cerrada** (declarada cerrada por el usuario al iniciar este bloque). Se inicia oficialmente la **versión 1.0.5**, bajo la misma metodología de mantenimiento y evolución ya establecida en la 1.0.3 (ver sección debajo): una incidencia/funcionalidad por bloque, análisis → aprobación → implementación → validación.

**Prioridad 1 de la versión 1.0.5:** permitir asignar un cliente a una venta que originalmente fue realizada como "Cliente General", siempre que todavía no tenga Factura Electrónica emitida. Ver "Bloque 1" de esta versión, más abajo, para el análisis técnico completo.

### Bloque 1 — Asignar cliente a una venta ya creada (antes de emitir su factura) — ✅ CERRADO (06/08/2026)

**Funcionalidad:** permitir asignar/cambiar el cliente de una venta creada como "Cliente General" (`customerId: null`), reutilizando el `PATCH /sales/:id` existente — sin endpoints nuevos, sin cambios de arquitectura.

**Estrategia implementada (Alternativa A, la de menor riesgo):**
- `customerId` opcional agregado a `UpdateSaleSchema`/`UpdateSaleDto` (backend, `sales/validation.ts`/`sales/types.ts`) y al `UpdateSaleDto` del frontend.
- 4 guardas en `sales/service.ts::update()`, dentro de la misma transacción ya existente desde el Bloque 1 de la 1.0.3 — cualquiera que falle responde `409 CONFLICT` con mensaje claro: (1) `alegraInvoiceId` no debe existir, (2) `alegraEmissionUncertainAt` no debe existir (emisión pendiente de confirmar con Alegra — riesgo real de que ya exista un comprobante certificado con el cliente anterior), (3) la venta no debe estar `CANCELLED`, (4) el cliente destino debe existir (reutiliza `salesRepository.findCustomerById`, ya usado por `create()`).
- **Campo nuevo expuesto en `SaleResponse`:** `alegraEmissionUncertainAt` — no estaba disponible en el frontend; se agregó de solo lectura, mismo criterio que los 3 campos de Alegra que ya se exponían, necesario para que el botón "Asignar cliente" se oculte correctamente en ese estado.
- **Frontend:** botón discreto (ícono `UserCog`) junto al campo "Cliente" en `SaleDetailContent.tsx`, visible solo cuando `canManage && !hasElectronicDocument && !sale.alegraEmissionUncertainAt`. Reutiliza `CustomerSearchDialog.tsx` (sin cambios) y `useUpdateSale` (ya existía, sin ningún disparador de UI hasta este bloque).

**Validación funcional con evidencia real** (backend real, sin ninguna llamada real a Alegra — restricción explícita del usuario respetada):
- Escenario 1: venta creada como Cliente General → asignación real de un cliente existente vía `PATCH /sales/:id` → confirmado con una relectura independiente (`GET /sales/:id`) que `customerId` quedó persistido correctamente. La confirmación de que la Factura Electrónica usará este cliente se sostiene en evidencia de código ya verificada en un bloque anterior (`emitInvoice` lee `sale.customerId` en vivo, al momento de emitir) — no se emitió ningún documento real.
- Escenario 2: venta con `alegraInvoiceId` simulado directamente en la base de datos (sin tocar Alegra) → intento de reasignación → `409 CONFLICT` con el mensaje esperado.
- Escenario 3: venta anulada (`POST /sales/:id/void`, endpoint real) → intento de reasignación → `409 CONFLICT` con el mensaje esperado.
- Verificación adicional: emisión incierta simulada → `409`; cliente inexistente → `409`.

Validado con `tsc -b`/`tsc --noEmit`, `eslint` y `npm run build` en ambos repos — limpios, sin warnings nuevos. Sin cambios en devoluciones, anulaciones (más allá de la guarda que las respeta), reportes, dashboard, ni en la emisión/lógica de Alegra.

### Bloque A (Seguridad y Administración) — Protección contra quedar sin ningún ADMIN activo — ✅ CERRADO (06/08/2026)

**Origen:** primer hallazgo de la auditoría funcional completa de la 1.0.5 (Reportes/Dashboard/Administración) — un usuario con rol MANAGER (que por defecto tiene los mismos códigos de escritura que ADMIN sobre usuarios) podía degradar o desactivar, uno por uno, a todos los ADMIN del sistema, sin ninguna advertencia, dejando el ERP sin nadie capaz de volver a asignar ese rol.

**Causa raíz:** `users.service.ts::update()` y `::changeStatus()` solo tenían autoprotección (nadie puede tocarse a sí mismo) y jerarquía de asignación (solo un ADMIN puede *asignar* el rol ADMIN) — ninguna de las dos protegía el conteo global de ADMIN activos. Confirmado que no existe un tercer camino (`remove()`/`DELETE`): el módulo `users` no tiene ninguna ruta de eliminación, "eliminar" un usuario es, en la práctica, desactivarlo vía `changeStatus()`.

**Implementado (alcance acotado a `users.service.ts` y `users.repository.ts`, sin tocar schema/roles/permissions/auth/frontend):**
- `users.repository.ts::countOtherActiveUsersByRoleName(roleName, excludeUserId)` — función genérica nueva (no hardcodea "ADMIN").
- Guarda en `update()`: si se cambia el rol de un usuario que hoy es ADMIN activo, y no queda ningún otro ADMIN activo, rechaza con `ForbiddenError`.
- Guarda en `changeStatus()`: mismo criterio, al desactivar al último ADMIN activo.

**Validación funcional con evidencia real** (backend real, con usuarios de prueba creados y luego desactivados, sistema restaurado a su estado original al finalizar):
- Varios ADMIN activos → degradar uno a CASHIER → `200`, permitido.
- Varios ADMIN activos → desactivar uno → `200`, permitido.
- Único ADMIN activo → otra cuenta (MANAGER) intenta degradarlo → `403 FORBIDDEN`, mensaje claro, admin real sin cambios.
- Único ADMIN activo → la misma cuenta intenta desactivarlo → `403 FORBIDDEN`, admin real confirmado intacto (activo, rol ADMIN) tras el intento.
- Operaciones sobre un usuario no-ADMIN (desactivar/reactivar/renombrar) → sin cambios de comportamiento, `200` en los tres casos.

Validado con `tsc --noEmit`, `eslint` y `npm run build` — limpios, sin warnings nuevos. Sin cambios en Roles, Permisos, Autenticación ni frontend.

---

## VERSIÓN 1.1 — EN CURSO (06/08/2026)

**Cierre de la 1.0.5:** la asignación de cliente antes de emitir Factura Electrónica (Bloque 1) y la protección contra quedar sin ningún ADMIN activo (Bloque A) quedan cerradas. La recuperación de contraseña queda **pausada** hasta definir el proveedor de correo (arquitectura `EmailProvider` ya aprobada, implementación concreta — Brevo/Resend/SendGrid/Smtp — todavía no). El resto de hallazgos de Seguridad y Administración de la auditoría funcional completa quedan **pospuestos para una versión posterior**.

**Prioridad 1 de la versión 1.1:** asistente inteligente para asignar códigos CABYS al crear o editar productos. Primer bloque: la infraestructura de datos (catálogo oficial + proceso de importación) — el buscador/asistente en `ProductForm.tsx` es un bloque posterior, todavía no iniciado.

### Bloque 1 — Catálogo CABYS: tabla propia + script de importación (backend, sin UI todavía) — ✅ CERRADO (06/08/2026)

**Arquitectura aprobada:** archivo oficial de Hacienda → proceso de importación → tabla indexada del ERP. El archivo oficial **nunca** forma parte del código fuente (no se versiona en el repositorio) — es únicamente el insumo transitorio de un script de terminal reutilizable, mismo patrón que `seed-permissions.ts`/`reset-password.ts` (no expuesto por HTTP).

**Implementado (`carniceria-pos-backend`, sin cambios en `carniceria-pos-front` en este bloque):**
- **Tabla nueva `CabysCode`** (`prisma/schema.prisma`, migración `20260806182432_add_cabys_codes_table`): `code` (`CHAR(13)`, clave primaria — único a nivel de base de datos), `description`, `active` (default `true`), timestamps. Índice sobre `active` + índice de trigramas GIN sobre `description` (mismo patrón ya usado en `Product.name`/`sku`) — pensado explícitamente para que un futuro buscador reutilice esta tabla sin ningún cambio estructural (confirmado con una consulta real `active + description contains`, sin error).
- **Script `prisma/import-cabys.ts`** (`npm run import-cabys -- --file=<ruta.csv>`):
  - Identifica las columnas obligatorias (código, descripción) **por nombre de encabezado**, no por posición — normaliza (mayúsculas, sin acentos, espacios colapsados) y acepta varios alias razonables por columna; ignora cualquier columna adicional. Si no puede identificar una columna obligatoria, aborta **antes de leer datos** con un error que lista exactamente cuál(es) faltan y los encabezados reales encontrados — sin modificar la base de datos.
  - **Análisis previo obligatorio:** lee el archivo completo, lo compara contra el estado actual de la tabla y muestra un resumen (registros nuevos, actualizados, sin cambios, que quedarían retirados, total procesado) **antes** de pedir confirmación.
  - **Confirmación explícita** en terminal antes de escribir; si no hay terminal interactiva o la respuesta no es afirmativa, aborta sin modificar ningún dato.
  - **Upsert por código** dentro de una única transacción Prisma. Códigos presentes en la base pero ausentes del archivo se marcan `active: false` (**nunca se borran físicamente** — un producto existente puede seguir referenciando ese código). Un código previamente retirado que vuelve a aparecer en un archivo posterior se reactiva automáticamente.
  - Se evitó deliberadamente agregar la librería `xlsx` (parseo de Excel) por tener vulnerabilidades de severidad alta/crítica sin parche disponible en la versión publicada en npm — el script trabaja sobre CSV (exportar el archivo oficial de Excel a CSV antes de importar); se usó `csv-parse` (sin vulnerabilidades reportadas) en su lugar.

**Validación funcional con evidencia real** (base de datos real, filas de prueba eliminadas al finalizar):
- Archivo con encabezado sin ninguna columna de descripción reconocible → abortó antes de tocar la base, listando exactamente la columna faltante y los encabezados reales del archivo.
- Archivo válido (alias distinto de encabezado + una columna extra ignorada), 3 códigos nuevos → resumen correcto (3 nuevos/0 actualizados/0 retirados) → sin terminal interactiva, abortó sin escribir nada (confirmado con un conteo real de la tabla: 0 filas).
- Misma carga ejecutada con confirmación (vía las funciones internas del script, invocadas directamente para esta validación): 3 filas insertadas dentro de una transacción — confirmado por relectura real de la tabla.
- Reimportar el mismo archivo → 0 nuevos/0 actualizados/3 sin cambios (idempotente).
- Archivo v2 (1 descripción modificada, 1 código ausente, 1 código nuevo) → diagnóstico correcto (1 actualizado/1 retirado/1 nuevo/1 sin cambios) → aplicado → el código retirado quedó con `active: false` **sin borrarse** (fila sigue presente con su descripción original).
- Reimportar el archivo original (v1) después del retiro → el código antes retirado se reactivó automáticamente (`active: true`, descripción restaurada) — confirma el ciclo completo retiro↔reactivación.

Validado con `tsc --noEmit`, `eslint . ` (0 problemas nuevos — los 213 preexistentes son todos de `load-tests/`/`tests/`, no relacionados con este bloque) y `npm run build` (backend) — todos limpios. Sin cambios en `carniceria-pos-front`, sin cambios en el endpoint/validación de `Product.cabysCode` (sigue siendo un `String?` simple, sin FK, tal como se aprobó — la validación de formato de 13 dígitos en `products.validation.ts` no cambia en este bloque).

### Bloque 2 — Asistente de búsqueda y selección de CABYS en Productos — ✅ CERRADO (06/08/2026)

**Backend (modulo `cabys`, solo lectura):** `src/modules/cabys/` (repository/service/controller/routes/types/validation), registrado en `modules/index.ts` bajo `/cabys`. Una única ruta, `GET /cabys/lookup`, reutilizando `resolveLookupParams` (mismo tope de 50 que el resto del proyecto) y protegida con el permiso **ya existente** `products.view` — no se creó ningún permiso `cabys.*` nuevo. Repositorio: `where: { active: true, OR: [{ code: startsWith }, { description: contains, insensitive }] }`, aprovechando el índice GIN de trigramas ya creado sobre `description` en el Bloque 1. Tipo de respuesta `CabysLookupItem { code, description }` — deliberadamente distinto del `LookupItem` genérico, mismo criterio que `ProductLookupItem`.

**Frontend:** `ProductCabysField.tsx` (nuevo, `features/products/components/`) reemplaza el `<Input>` de texto plano de `ProductForm.tsx` por un combobox inline — el propio campo es a la vez editable y el ancla de un `Popover` (`components/ui/Popover.tsx`) con las coincidencias de `useCabysLookup` (debounce de 300ms, `useDebouncedValue`). Sin botón adicional, sin diálogo modal. Búsqueda por código (prefijo) o descripción, resultados en vivo. Al seleccionar: se guarda únicamente el código de 13 dígitos, la descripción se muestra debajo como referencia (fuera del formulario/DTO, puramente informativa). Si el usuario escribe manualmente un código de 13 dígitos, se dispara automáticamente la misma búsqueda por coincidencia exacta: si existe, muestra su descripción; si no, muestra "Este código no pertenece al catálogo CABYS cargado." — sin bloquear el guardado ni asignar nada automáticamente. El campo sigue siendo editable manualmente, sin ninguna restricción nueva sobre el valor.

**Hallazgo real corregido durante la validación (fuera del alcance original, pero necesario para que la solución aprobada funcionara correctamente):** la primera implementación usaba `PopoverTrigger` (`render` prop) para que el propio `<Input>` actuara como disparador del popover. Validando contra el navegador real se confirmó que `PopoverTrigger` fuerza `role="button"` sobre el elemento que envuelve (via el `useButton` interno de `@base-ui/react`) — semánticamente incorrecto sobre un campo de texto editable (un lector de pantalla lo anunciaría como botón, no como campo). Corregido reemplazando `PopoverTrigger` por control directo del `Popover` (`open`/`onOpenChange`, ya controlado) con un `anchor` explícito (`ref` del propio `<Input>`) — se agregó un prop `anchor` opcional a `components/ui/Popover.tsx` (`PopoverContent`, forwardeado al `Positioner` de base-ui) para soportar este caso; `undefined` por defecto, sin efecto en ningún consumidor existente (`NotificationBell.tsx`/`PosHeader.tsx`/`RowMenu.tsx`, verificados). Revalidado: el `<input>` real ya no tiene ningún `role` inyectado.

**Validación funcional con evidencia real** (backend real con datos de prueba reales, eliminados al finalizar; frontend real en el navegador, con un token real emitido para el usuario ADMIN existente — sin tocar su contraseña):
- Catálogo CABYS vacío → `GET /cabys/lookup` responde `{data: []}` sin error; en el formulario, el popover muestra "No se encontraron códigos CABYS que coincidan con la búsqueda."
- Búsqueda por descripción ("frijol", "carne") → coincidencias correctas, incluidas múltiples filas para un mismo prefijo de código.
- Búsqueda por código (prefijo) → coincidencias correctas.
- Selección desde el listado → guarda únicamente el código de 13 dígitos en el campo, muestra la descripción debajo, cierra el popover.
- Escritura manual de un código de 13 dígitos existente → verificación automática, muestra su descripción.
- Escritura manual de un código de 13 dígitos inexistente → muestra el aviso de "no pertenece al catálogo", sin bloquear el campo.
- Campo vacío → sin popover, sin descripción, sin aviso.
- Guardado real del formulario (`PATCH /products/:id`) → confirmado por lectura directa de la base de datos que `Product.cabysCode` almacena únicamente la cadena de 13 dígitos (`"2011500000000"`), nada más — producto de prueba restaurado a su estado original (`cabysCode: null`) al finalizar.
- Rechazo sin token (`401 UNAUTHORIZED`) → confirma que el endpoint exige autenticación real.

Validado con `tsc -b`, `eslint .` (0 problemas nuevos frente al baseline conocido — 3 warnings preexistentes en `SalesPOSPage.tsx`, 1 error preexistente no relacionado en `button.tsx`) y `npm run build` (frontend) — todos limpios. Confirmado que el buscador construido reutiliza la tabla `CabysCode` del Bloque 1 sin ningún cambio estructural. Sin cambios en Alegra ni en la lógica de Facturación Electrónica — `Product.cabysCode` sigue siendo el mismo `String?` de 13 dígitos, con la misma validación de formato en `products.validation.ts`.

**Regresión reportada tras el cierre (06/08/2026) — analizada y resuelta, sin tocar la lógica del buscador:** se reportó que "carne"/"carnes" no devolvía resultados y que un CABYS real ya usado en Facturas Electrónicas (`2715000000300`) aparecía como "no pertenece al catálogo". Análisis con evidencia real: la tabla `CabysCode` tenía **0 registros** — el catálogo oficial nunca había sido importado en esta base, solo se habían usado filas de prueba temporales durante la validación de los Bloques 1 y 2 (eliminadas deliberadamente al cerrar cada validación). El buscador y la consulta (`code: startsWith` / `description: contains insensitive`) funcionaban exactamente como se validó — el síntoma era el estado real de una tabla vacía, no un bug.

**Carga real del catálogo oficial, con descarga automática (extensión aprobada a la arquitectura del Bloque 1):**
- **Fuente oficial confirmada:** el Banco Central de Costa Rica (BCCR) publica y mantiene el catálogo CABYS (Hacienda lo consume, no lo distribuye) en `https://www.bccr.fi.cr/indicadores-economicos/cabys/Catalogo-de-bienes-servicios.xlsx` — descarga directa por `GET` HTTPS, sin login/captcha (el sitio, en SharePoint, solo exige `User-Agent` + `Referer`), sin restricción de licencia declarada.
- `prisma/import-cabys.ts` — nuevo modo `--download` (además del `--file=<ruta>` manual ya existente): descarga el `.xlsx` real a un archivo temporal fuera del repositorio (`os.tmpdir()`), lo procesa, y lo borra al finalizar sin importar el resultado (éxito, cancelación o error) — nunca se versiona.
- **Formato real del archivo** (jerárquico, distinto del CSV simple asumido en el Bloque 1): encabezados en la fila 2 (no la primera), columnas `Categoría 1..9` + `Descripción (categoría 1..9)` — el código CABYS de 13 dígitos real es siempre el de `Categoría 9`. Se agregó soporte para `.xlsx` vía `exceljs` (auditado: sin vulnerabilidades — se descartó `xlsx`/SheetJS otra vez por las mismas razones ya documentadas en el Bloque 1); detección de la fila de encabezados real (explora las primeras 10 filas en vez de asumir la posición 1); normalización de celdas de código que Excel guarda como número, perdiendo ceros a la izquierda (4 de 20.502 filas reales). El formato CSV simple se mantiene soportado para uso manual/offline.
- **Bug real encontrado al importar el catálogo completo (20.506 códigos) y corregido en el mismo bloque:** `applyDiff` hacía un `create`/`update` por fila dentro de una única transacción interactiva de Prisma (timeout por defecto 5000ms) — con miles de filas, la transacción expiraba y se revertía entera (confirmado: 0 filas escritas). Corregido con procesamiento por lotes de 500: altas vía `createMany` (una sola instrucción por lote), actualizaciones en transacciones cortas por lote, retiros vía `updateMany` por lote — cada lote es atómico en sí mismo; ya no hay una única transacción para todo el archivo. El proceso sigue siendo idempotente por código, así que un lote fallido no deja el sistema inconsistente: repetir la misma importación retoma exactamente donde se interrumpió, sin duplicar ni corromper nada (mensaje de error explícito lo indica).
- **Validación funcional final con el catálogo oficial real:** descarga real ejecutada, **20.506 registros importados** (20.502 del formato normal + 4 recuperados de celdas numéricas), **20.506 activos**, 1 fila descartada (encabezado de una hoja auxiliar sin código válido). Confirmado que el código `2715000000300` (usado en Facturas Electrónicas reales, `alegraInvoiceId` presente en 5 ventas) ya existe en el catálogo con su descripción oficial real. Reimportación inmediata → 0 nuevos/0 actualizados/20.506 sin cambios (idempotente). Búsqueda real contra el catálogo completo: "carne" devuelve carnes de res reales (canales, cortes, carne molida); "pollo" también devuelve por ahora coincidencias por substring no deseadas (ej. "Repollo") — comportamiento esperado de una búsqueda por `contains` sin priorización, exactamente la motivación de la mejora de priorización para carnicería que sigue pendiente de aprobación (ver "Próximo paso" abajo).

Revalidado con `tsc --noEmit`, `eslint` (0 problemas nuevos) y `npm run build` (backend) — limpios.

### Bloque 3 — Ranking de relevancia en el buscador CABYS (genérico, sin reglas de rubro) — ✅ CERRADO (06/08/2026)

**Objetivo:** mejorar el orden de los resultados de `GET /cabys/lookup` (ej. que "pollo" no compita en igualdad con "repollo") **sin ocultar nunca ningún resultado que antes aparecía** y **sin ninguna regla o diccionario específico de carnicería** — la solución debe seguir siendo igual de útil para cualquier otro rubro que use el ERP.

**Causa raíz confirmada:** el filtro (`description: { contains }`) es correcto para no ocultar resultados, pero **no tiene ranking** — ordenaba por `code asc`, sin relación alguna con qué tan relevante es cada coincidencia. Al buscar por subcadena, "pollo" es literalmente una subcadena de "repollo", así que ambos compiten igual en el filtro; sin ranking de relevancia, cuál aparece primero es arbitrario.

**Estrategia implementada, siguiendo el orden de prioridad pedido (Prisma antes que SQL nativo):**
- **No hizo falta `$queryRaw` en ningún momento** — se confirmó empíricamente que el preview feature `fullTextSearchPostgres` de Prisma (habilitado en `schema.prisma`, generator `client`) expone tanto el filtro `search` como `orderBy: { _relevance: { fields, search, sort } }`, usando `to_tsquery`/`ts_rank` nativos de PostgreSQL por debajo — sin escribir SQL a mano.
- `cabys.repository.ts::buildTsQuery()` (nuevo): convierte el término de búsqueda libre en una expresión `tsquery` válida — separa por palabras, descarta cualquier caracter que no sea letra/dígito (evita que el usuario rompa la sintaxis de `tsquery` sin querer), une las palabras completas con `&` (deben aparecer todas) y trata la ÚLTIMA palabra como prefijo (`:*`, para busqueda en vivo mientras el usuario todavía la está escribiendo). Devuelve `null` si no queda ninguna palabra usable (ej. solo símbolos) — en ese caso no se aplica ningún ranking, mismo comportamiento que antes.
- `cabys.repository.ts::lookup()` — el `WHERE` (filtro) **no cambió en absoluto** (mismo `OR` de código-prefijo/descripción-subcadena de siempre, mismo índice de trigramas del Bloque 1). Solo se agregó `orderBy: [{ _relevance: {...} }, { code: 'asc' }]` cuando hay un término de búsqueda válido — Full Text Search tokeniza la descripción en palabras reales (lexemas), así que "pollo" y "repollo" son lexemas distintos y nunca se confunden, a diferencia de la subcadena simple.
- Sin nueva migración ni índice nuevo: Prisma calcula `to_tsvector`/`ts_rank` sobre el conjunto ya filtrado (normalmente pequeño), no sobre las 20.506 filas — confirmado con evidencia de rendimiento real (ver validación).
- **Sin ninguna palabra, categoría ni regla de carnicería en el código** — el ranking usa exclusivamente el motor de búsqueda de texto genérico de PostgreSQL; funciona igual de bien para cualquier término de cualquier rubro.

**Validación funcional con evidencia real, contra el catálogo oficial completo (20.506 códigos):**
- "pollo" → 8/8 y 20/20 resultados reales de pollo, cero contaminación de "repollo" (confirmado programáticamente, no solo a simple vista).
- "repollo" → 7/7 resultados reales de repollo, cero contaminación de "pollo".
- "carne", "carne molida", "corazón", "costilla", "bistec" → resultados correctos y relevantes en todos los casos (incluyendo búsqueda de dos palabras, "carne molida", devolviendo únicamente los 2 códigos reales de carne molida).
- Casos borde: campo vacío / solo espacios / solo símbolos (`"!!!"`) / una sola letra (`"a"`) → sin errores, con degradación correcta al comportamiento anterior (orden por código) cuando no hay ninguna palabra útil para rankear.
- **Rendimiento real medido** contra las 20.506 filas: 18-23ms por búsqueda, incluso con un término muy común que matchea 493 filas (`"fresco"`) — sin degradación relevante, sin necesidad de índice adicional.

Validado con `tsc --noEmit`, `eslint` (0 problemas nuevos) y `npm run build` (backend) — limpios. **Cero cambios en el frontend** (`ProductCabysField.tsx`, `useCabysLookup.ts`, `cabys.api.ts` intactos), **cero cambios en el contrato de la API** (`GET /cabys/lookup` devuelve exactamente la misma forma), **cero cambios en el permiso** (`products.view`), **cero cambios en la arquitectura del Bloque 2**.

### Bloque 4 — Pulido de UX de `ProductCabysField` (panel, cierre, foco) — ✅ CERRADO (06/08/2026)

**Investigación previa exigida por el bloque:** antes de agregar cualquier listener manual, se confirmó con evidencia real (navegador real, no solo lectura de código) si el descarte nativo de Escape/clic-afuera de base-ui funcionaba sin `PopoverTrigger` (deliberadamente no usado desde el Bloque 2, por el hallazgo de accesibilidad `role="button"`). Resultado: **no funciona en ninguno de los dos casos** — `useDismiss` de base-ui aplica sus props de "elemento de referencia" al `Trigger`, que este campo no renderiza; sin ese registro, ni Escape ni el clic-afuera llegan a disparar `onOpenChange`. Ambos casos se reprodujeron y confirmaron en el navegador real antes de escribir la solución manual (Escape: el panel seguía abierto tras la tecla; clic-afuera: el foco se movía correctamente a otro campo pero el panel quedaba abierto).

**Implementado, todo dentro de `ProductCabysField.tsx`:**
- **Ancho/alto del panel:** de `w-[var(--anchor-width)]` (atado al ancho angosto del campo, ~250-320px) a `w-[min(36rem,90vw)]` — generoso y acotado al viewport. Alto de `max-h-64` (~5 filas) a `max-h-[min(28rem,60vh)]`.
- **Sin scroll horizontal:** la descripción de cada fila ahora envuelve en varias líneas (`min-w-0 flex-1`, sin `truncate`) en vez de cortarse — nunca se desborda horizontalmente.
- **Jerarquía visual:** fila de dos columnas — código en un chip de ancho fijo (`w-[7.5rem]`, fondo `bg-muted`, monoespaciado) a la izquierda, descripción a la derecha ocupando el resto del ancho.
- **Más resultados:** `limit` subido de 20 a 50 — el tope máximo ya permitido por el backend (`LOOKUP_MAX_LIMIT`, sin cambios de backend).
- **Foco tras seleccionar:** `handleSelect` devuelve el foco al `<input>` (`inputRef.current?.focus()`) — antes quedaba perdido al desmontarse el botón clickeado.
- **Cierre manual (Escape/clic-afuera/perder foco):** `onKeyDown` (Escape) + un listener de `pointerdown` a nivel de documento (activo únicamente mientras el panel está abierto, con cleanup en el mismo `useEffect`) + `onBlur` con chequeo de `relatedTarget` — los tres identifican "dentro del panel" vía el atributo `data-slot="popover-content"` ya expuesto por `components/ui/Popover.tsx` (sin necesitar una ref nueva). Seleccionar un resultado sigue cerrando el panel como siempre (`handleSelect`).

**Validación funcional — completada solo parcialmente en el navegador real** (la sesión de validación se interrumpió a pedido explícito del usuario antes de cubrir el ciclo completo):
- ✅ **Confirmado en vivo:** ancho/alto del panel se ven correctamente ampliados, con envoltura de texto sin scroll horizontal y el chip de código separado visualmente. Escape cierra el panel mantiene el valor y el foco. Clic-afuera cierra el panel y mueve el foco correctamente al campo clickeado.
- ⚠️ **Sin confirmar en vivo** (validado solo por revisión de código, mismo patrón ya usado y probado en el Bloque 2 para `handleSelect`): selección de un resultado desde el listado ampliado, devolución de foco tras seleccionar, comportamiento al limpiar el campo, y cierre por pérdida de foco vía Tab. Deben confirmarse en una próxima sesión antes de considerar esto verificado con el mismo nivel de evidencia que el resto del bloque.

Validado con `tsc -b`, `eslint` (0 problemas nuevos frente al baseline conocido) y `npm run build` — limpios. Sin cambios en el backend, en el endpoint, en la lógica de búsqueda/ranking del Bloque 3, ni en el contrato de la API.

### Bloque 5 — Desacoplar el tipo de comprobante electrónico de `sale.customerId` — ✅ CERRADO (06/08/2026)

**Hallazgo de diseño real (reportado por el usuario a partir de rechazos reales de Hacienda):** desde el Bloque 8.4, el ERP decidía automáticamente Tiquete Electrónico vs Factura Electrónica según si `Sale.customerId` existía o no — regla de negocio incorrecta para una carnicería: un cliente puede estar identificado únicamente para historial/puntos/descuentos, sin que eso implique que deba facturarse. La investigación de la regresión reportada (varias rondas de análisis, ver conversación del bloque) no encontró una causa de código para los rechazos puntuales de Hacienda, pero sí este defecto de diseño real, independiente de esa investigación.

**Implementado (backend + frontend, arquitectura aprobada explícitamente, con un ajuste de UX pedido después):**
- **Backend** (`alegra.service.ts::emitInvoice`): se separaron las dos decisiones que antes compartían la misma condición `sale.customerId ? A : B`. QUIÉN es el receptor (`recipient`, contacto real de Alegra vs "Cliente General") sigue dependiendo de `sale.customerId`, sin cambios. QUÉ tipo de comprobante se emite (`numberTemplateId`) ahora depende de un nuevo parámetro explícito y obligatorio, `documentType: 'TICKET' | 'INVOICE'`, recibido en el body de `POST /integrations/alegra/sales/:saleId/emit` (antes sin body) y validado con un nuevo `EmitInvoiceSchema` (Zod, `alegra.validation.ts`). Guarda nueva: `documentType === 'INVOICE'` sin `sale.customerId` → `409 CONFLICT` con mensaje claro, verificada **antes** de cualquier llamada de red a Alegra. `documentType` no se persiste en `Sale` (decisión explícita del usuario).
- **Frontend** (`SaleDetailContent.tsx`, pestaña "Documentos"): el botón único y ambiguo "Emitir comprobante electrónico" se reemplazó, mientras la venta no tiene documento, por dos acciones separadas — **"Emitir Tiquete Electrónico"** (acción principal, un solo clic, siempre habilitada) y **"Emitir Factura Electrónica"** (acción secundaria, deshabilitada con tooltip explicativo si la venta sigue en "Público General" — mismo criterio que valida el backend, esto es solo la capa de UI). `useSaleDocumentActions.ts::handleEmitInvoice` pasó a recibir `documentType` como parámetro; el viejo booleano `isEmittingInvoice` se reemplazó por `emittingDocumentType: 'TICKET' | 'INVOICE' | null` para que cada botón sepa si es el que está en curso. `alegra.api.ts::emitInvoice` ahora envía `{ documentType }` en el body.
- **Sin cambios:** `resolveCustomerAlegraId`/`resolveGenericClient` (confirmado que son independientes de qué plantilla se use), `sendInvoiceEmail`/`SaleResendDialog.tsx` (operan sobre un comprobante ya emitido), asignación de cliente a una venta (Bloque 1 de la 1.0.5), reportes/Dashboard.

**Validación funcional con evidencia real, sin ninguna llamada de escritura real a Alegra** (la guarda nueva corre antes de cualquier llamada de red, así que se pudo validar con seguridad contra el backend real):
- Factura Electrónica sobre una venta real con items pero sin cliente (`VTA-000032`) → `409 CONFLICT`, mensaje exacto: *"No se puede emitir una Factura Electrónica sin un cliente identificado — asigná un cliente a esta venta o emití un Tiquete Electrónico."*
- `documentType` con un valor inválido (`"FACTURA"`) → `400`, detalle Zod claro (`Expected 'TICKET' | 'INVOICE'`).
- `documentType` ausente del body → `400`, mensaje de validación claro.

Validado con `tsc -b`/`tsc --noEmit`, `eslint` (0 problemas nuevos en ambos repos) y `npm run build` (ambos repos) — limpios. La emisión real de un Tiquete o de una Factura con cliente identificado no se probó de extremo a extremo (requeriría una llamada de escritura real a Alegra, fuera de alcance sin autorización explícita puntual para esa llamada específica).

---

## VERSIÓN 1.0.3 — INICIO DE LA ETAPA DE MANTENIMIENTO Y EVOLUCIÓN (06/08/2026)

La 1.0.0 quedó aprobada tras el programa completo de QA. La 1.0.1 implementó el sistema funcional de Backup & Restore (Splash/Modo Mantenimiento). La 1.0.2 agregó el acceso a Respaldos desde Configuración (el Splash no era alcanzable en una instalación sana). La **1.0.3 consolida esas dos mejoras y marca el inicio oficial de la etapa de mantenimiento y evolución del ERP** — a partir de acá no se vuelven a correr auditorías generales ni QA completos del sistema; cada bloque trabaja únicamente sobre una incidencia real detectada durante el uso.

### Nueva metodología del proyecto (permanente, reemplaza el criterio de "Bloques de QA" para todo trabajo futuro)

**Queda prohibido:**
- Buscar bugs de forma aleatoria o revisar módulos completos sin una incidencia concreta que lo justifique.
- Aprovechar un bloque para corregir otros problemas que aparezcan en el camino.
- Hacer refactors preventivos o cambiar arquitectura sin una necesidad real.
- Modificar el comportamiento de módulos ya estables.

**Flujo obligatorio para cada incidencia:**
1. Reporte del problema.
2. Análisis técnico — únicamente causa raíz, archivos involucrados, estrategia mínima, impacto, riesgos. Sin escribir código.
3. Esperar aprobación explícita.
4. Implementación.
5. Validaciones: `tsc -b` / `eslint` / `npm run build`.
6. Validación funcional únicamente del flujo relacionado con esa incidencia — nunca una pasada general.

Si durante el análisis de una incidencia aparece otro problema distinto: **no se corrige** — se documenta como backlog (en este mismo archivo, sección correspondiente) y se continúa únicamente con la incidencia en curso.

**Regla permanente de validación:** nunca afirmar que algo quedó probado si no se ejecutó completamente; si una limitación técnica impide verificar algo (p. ej. no hay herramienta para interactuar con una ventana nativa de Electron), decirlo explícitamente en vez de asumir. Todo cambio visible para el usuario (Electron, frontend, interfaz) se verifica personalmente antes de cerrar el bloque — si no es posible, se indica explícitamente que no se verificó.

### Backlog inicial de la 1.0.3 (cada punto es un bloque independiente — análisis → aprobación → implementación → validación, uno a la vez)

1. Registrar automáticamente el vuelto en efectivo como egreso de caja. — **✅ CERRADO (06/08/2026), ver "Bloque 1" abajo.**
2. Registrar automáticamente las devoluciones en efectivo como egreso de caja. — **✅ VERIFICADO, sin acción necesaria (06/08/2026), ver "Bloque 2" abajo.**
3. Ordenar alfabéticamente todos los productos del POS. — **⏸️ POSPUESTO para una versión futura, por decisión de producto (06/08/2026).** Análisis ya completo (causa raíz: `products.repository.ts::findMany` ordena por `createdAt desc`, no por nombre; ver conversación del bloque) — decisión explícita de no implementar por ahora. Retomar ese análisis si se reabre en una versión posterior.
4. Investigar y corregir el error HTTP 429 al anular múltiples ventas consecutivas. — **✅ CERRADO (06/08/2026), ver "Bloque 7" abajo.**
5. Corregir el botón de promociones activas para que muestre correctamente las promociones vigentes. — **✅ CERRADO (06/08/2026), ver "Bloque 6" abajo.**
6. Verificar si la Facturación Electrónica realmente no está enviando los datos del cliente antes de modificar cualquier código. — **Pendiente de análisis.**

Ninguno de estos seis puntos está implementado todavía — se espera aprobación explícita antes de empezar cada uno.

### Bloque 1 — Vuelto en efectivo no se registraba como egreso de caja — ✅ CERRADO (06/08/2026)

**Incidencia:** el vuelto entregado en una venta en efectivo se calculaba y persistía (`Sale.changeGiven`), pero nunca quedaba registrado como un movimiento de caja — invisible para cualquier auditoría de `CashMovement`, aunque el arqueo (`computeExpectedAmount`) ya era matemáticamente correcto (suma `Sale.total`, no `Sale.amountPaid`).

**Causa raíz:** omisión de trazabilidad, no un bug de cálculo — ver análisis completo en la conversación de este bloque (no repetido acá para no duplicar).

**Estrategia implementada** (solo backend, `carniceria-pos-backend`, cero cambios en este repositorio):
- Nuevo valor de enum `CashMovementType.CHANGE` (`prisma/schema.prisma`) — **exclusivamente de trazabilidad/auditoría**. `cash/service.ts::computeExpectedAmount` sigue exactamente igual, sin tocarlo: `CHANGE` nunca se suma/resta del arqueo (confirmado con evidencia real, ver validación abajo).
- Índice único parcial en `cash_movements` (`(reference_type, reference_id) WHERE deleted_at IS NULL AND type = 'CHANGE'`, migración `add_cash_movement_change_unique_index`) — nunca más de un `CHANGE` activo por venta, a nivel de base de datos.
- `sales/service.ts::createSaleTransaction` — crea el `CHANGE` dentro de la misma transacción de la venta, solo si `paymentMethod === 'CASH'` y `changeGiven > 0`. Mismo patrón exacto que `REFUND` (`returns/repository.ts`): escritura directa vía repositorio, sin servicio transversal nuevo.
- `sales/service.ts::update()` — ahora corre dentro de una transacción (antes no la tenía) y sincroniza el `CHANGE` activo tras cualquier edición: nunca lo muta, siempre borrado lógico del activo + creación de uno nuevo si corresponde (mismo criterio que el resto del proyecto usa para no reescribir un registro contable ya emitido). Cubre los 5 escenarios analizados (vuelto cambia / desaparece / aparece / cambio de `paymentMethod` / cambio de `cashSessionId`) — `total` no es editable hoy, ese escenario no aplica.

**Validación funcional** (contra un backend real corriendo, base de datos real, no simulada): 10 ventas reales vía `POST /sales`/`PATCH /sales/:id` cubriendo efectivo sin vuelto, efectivo con vuelto, tarjeta, mixta, venta anulada, y los 5 sub-escenarios de edición — inspeccionadas directamente en `cash_movements` después de cada operación. Los 10 casos se comportaron exactamente según lo diseñado (`CHANGE` creado/soft-deleteado/reasignado de sesión en cada caso correcto, ninguno en los casos que no correspondía). Chequeo global sobre toda la tabla: cero ventas con más de un `CHANGE` activo. Cierre de caja real (`PATCH /cash/sessions/:id/close`) sobre la sesión usada para las pruebas (144 ventas en efectivo completadas, 8 `CHANGE` reales por 4.960 en total): `expectedAmount` devuelto por el servidor coincidió exactamente con el cálculo independiente hecho a mano excluyendo `CHANGE` — confirma que el arqueo da el mismo resultado que sin este cambio.

**Nota (venta anulada):** anular una venta no toca su `CashMovement` `CHANGE` (queda activo) — mismo comportamiento que ya existía para cualquier otro efecto secundario de una venta anulada (tampoco se tocaba antes de este bloque); no forma parte del alcance aprobado para esta incidencia.

Validado con `tsc --noEmit`, `eslint` y `npm run build` del backend — limpios, sin warnings nuevos.

**Validación adicional desde la interfaz real (Chrome + frontend/backend reales, sin Electron — esta incidencia no tiene superficie específica de Electron):** venta en efectivo sin vuelto (`VTA-000241`) y con vuelto (`VTA-000242`, ₡3.000 recibidos, "Vuelto ₡980,00" mostrado correctamente antes de confirmar). En Caja → "Movimientos" apareció el `CHANGE` con motivo "Vuelto entregado en la venta VTA-000242" y monto ₡980,00; el "Esperado" del arqueo (₡9.595,00 = apertura + ventas en efectivo + ingresos − egresos) no incluyó el `CHANGE` en ningún renglón, confirmando desde la UI lo mismo que ya se había confirmado por API/base de datos.

### Bloque 2 — Reembolso en efectivo de devoluciones — ✅ VERIFICADO, SIN ACCIÓN (06/08/2026)

Incidencia reportada: el reembolso en efectivo de una devolución no quedaría reflejado como egreso de caja (misma omisión que tenía el vuelto). **Verificado contra el código real: no es así.** `returns/service.ts::createReturnTransaction` ya crea un `CashMovement` tipo `REFUND` dentro de la misma transacción de la devolución cuando `refundMethod === 'CASH'` (Bloque 4.1/4.2, previo a la 1.0.3); ya tiene etiqueta en el frontend ("Reembolso"); y `computeExpectedAmount` ya lo resta correctamente del efectivo esperado — a diferencia de `CHANGE`, un reembolso es una salida real de dinero no capturada por ningún otro cálculo, así que sí debe restarse (y ya se resta). Sin cambios de código. Backlog detectado (no corregido en este bloque): falta de protección de idempotencia ante un doble-submit de `POST /returns`, y la etiqueta incorrecta de `REFUND` en el Dashboard (ver Bloque 3, ya cerrado).

### Bloque 3 — `CashMovementType.CHANGE` no soportado en el frontend (+ `REFUND` mal clasificado en Dashboard) — ✅ CERRADO (06/08/2026)

**Incidencia:** tras el Bloque 1, `CashMovementType` del frontend (`cashSession.types.ts`) seguía siendo `'CASH_IN' | 'CASH_OUT' | 'REFUND'` — sin `'CHANGE'`. Efecto real confirmado: en `CashMovementsTable.tsx` un `CHANGE` se renderizaba con badge rojo de egreso, ícono genérico, y **sin texto** (`MOVEMENT_TYPE_LABELS['CHANGE']` era `undefined`); en `DashboardPage.tsx` (widget "Actividad reciente") tanto `CHANGE` como `REFUND` cayeron siempre en un ternario binario que los etiquetaba como **"Egreso de caja"** (la mala clasificación de `REFUND` ahí es preexistente al Bloque 1, no introducida por él — se corrigió en el mismo bloque por vivir en el mismo punto de presentación, autorizado explícitamente por el usuario).

**Estrategia implementada (solo presentación, cero cambios de cálculo/API/lógica de negocio):**
- `cashSession.types.ts` — se agregó `'CHANGE'` a la unión de `CashMovementType`.
- `CashMovementsTable.tsx` — la cadena de ternarios se reemplazó por `Record<CashMovementType, {label, badgeVariant, icon}>`: `CHANGE` → "Vuelto" (badge `accent`, ícono `Coins`), sin tocar `CASH_IN`/`CASH_OUT`/`REFUND`. Usar un `Record` tipado sobre la unión completa es deliberado — si se agrega un valor al enum sin actualizar este mapa, `tsc` falla al compilar, en vez de descubrirse un badge en blanco en producción (exactamente la causa raíz de este bloque).
- `DashboardPage.tsx` — mismo criterio (`Record<CashMovementType, {icon, title}>`): `CASH_IN` → "Ingreso de caja", `CASH_OUT` → "Egreso de caja", `REFUND` → "Reembolso", `CHANGE` → "Vuelto entregado".
- **`cashSessionInsights.ts` NO se tocó** — `CHANGE` sigue excluido a propósito de `isEgresoLike`/los totales en vivo, mismo criterio que `computeExpectedAmount` en el backend (documentado con un comentario nuevo en `cashSession.types.ts` para que quede explícito, no como omisión accidental).

Validado con `tsc -b`, `eslint` y `npm run build` — limpios, sin warnings nuevos.

### Bloque 5 — Calculadora de peso (decimal) + miniaturas de imagen — ✅ CERRADO (06/08/2026)

**Incidencia 1 (calculadora de peso):** al tocar la coma decimal en `ProductWeightDialog.tsx`, la pantalla parecía "reiniciarse" a `0.000` por un instante. Causa raíz: `<Input type="number">` nativo saneaba a `""` el string intermedio `"2."` (no es un número de punto flotante válido según la spec WHATWG) mientras el estado de React seguía siendo `"2."` sin corromperse — el placeholder se mostraba de más. Corregido cambiando ese input a `type="text"` (con `inputMode="decimal"` intacto); la validación real (`isValid`) no depende del tipo del input, así que no cambia ningún comportamiento funcional.

**Incidencia 2 (miniaturas de imagen):** el reporte inicial ("las miniaturas quedaron más chicas") llevó primero a una comparación visual real (misma tarjeta, mismas imágenes de producto, `aspect-[2/1]` vs `aspect-[4/3]` lado a lado) antes de tocar nada — **decisión de producto confirmada: el catálogo se mantiene en `aspect-[2/1]`**, no se reabre esa decisión ya aprobada en el rediseño del POS. La causa raíz real del recorte/descentrado reportado era otra: el editor de recorte (`ProductImageCropperDialog.tsx`) seguía forzando `4:3` (`PRODUCT_IMAGE_ASPECT_RATIO`, `productImageValidation.ts`) mientras el catálogo real ya mostraba `2:1` desde un rediseño posterior que nunca actualizó esa constante — el cajero recortaba "perfecto" en un marco que ya no coincidía con el catálogo. Corregido realineando `PRODUCT_IMAGE_ASPECT_RATIO` a `2/1` (mismo valor exacto que `MediaCard.tsx`, confirmado por grep) — editor y catálogo vuelven a ser WYSIWYG entre sí. Sin cambios de `object-fit`, sin procesamiento de imágenes en el backend, sin tocar el diseño general del catálogo.

**Pendiente para una versión posterior (no es un bug de la 1.0.3):** `CartItems.tsx` (miniatura del carrito) sigue en `aspect-[4/3]`, ahora desalineado del nuevo valor del cropper (`2/1`) igual que antes lo estaba del valor viejo. Unificar el aspecto del carrito con el del catálogo para dar consistencia visual entre ambos (mismo producto, misma miniatura) queda documentado como mejora visual futura — decisión explícita de no incluirla en este bloque.

Validado con `tsc -b`, `eslint` y `npm run build` — limpios, sin warnings nuevos.

### Bloque 6 — Botón/píldora "Promociones" del POS no mostraba promociones activas vigentes — ✅ CERRADO (06/08/2026)

**Incidencia:** una promoción activa se aplicaba correctamente al vender, pero la píldora "En promoción" (y potencialmente el botón "Promociones" del header, misma fuente de datos) podía mostrarla como inexistente.

**Análisis:** se identificaron **tres causas estructurales independientes**, no una sola: (A) las promociones de scope `COMBO`/`CART` quedan excluidas a propósito de la píldora (no identifican un producto individual); (B) la píldora solo evalúa contra el catálogo de productos ya cargado/paginado en pantalla; (C) — **la causa real del caso reportado** — `usePromotions()` pedía `GET /promotions` sin `limit` explícito, así que el backend aplicaba su default (`DEFAULT_LIMIT = 20`) sobre el catálogo completo de promociones (activas + inactivas mezcladas, sin filtrar), ordenado por `priority desc, createdAt desc`. Una promoción activa real podía quedar fuera de esas primeras 20 filas, mientras el motor de ventas (`findActiveForEvaluation`, sin paginar) la seguía aplicando sin problema.

Se compararon 4 estrategias (corregir solo la paginación / solo la píldora / que el POS consulte el mismo origen que el motor / alguna que resuelva las tres a la vez) — se eligió la de **menor riesgo y alcance más acotado**: corregir únicamente la causa C.

**Implementado:** `SalesPOSPage.tsx` — `usePromotions()` ahora pide `{ limit: 100 }` (el máximo ya soportado por el backend, sin cambios de backend, sin endpoints nuevos). Deliberadamente **sin** agregar `active: true` a esa misma llamada: la respuesta sin filtrar sigue alimentando `allPromotions`, necesaria para que `PromotionsActivationDialog.tsx` pueda seguir viendo y activando promociones inactivas — el filtro a "solo activas" para la píldora ya vivía del lado del cliente, sin cambios.

**Validado con evidencia real, no solo por código:** contra un backend real corriendo, se creó una promoción `PRODUCT` activa de baja prioridad + 21 promociones de relleno de prioridad alta (reproduciendo exactamente el escenario: más de 20 promociones en total) — confirmado que con el límite viejo (20) la promoción activa quedaba fuera del listado, con el nuevo (100) aparece correctamente, y que `POST /sales/quote` la aplicaba correctamente en ambos casos (10% de descuento real aplicado). Las 22 promociones de prueba se eliminaron al finalizar, dejando la base de datos como estaba.

**Backlog (fuera de alcance de este bloque, documentado para una versión futura):** las causas A (`COMBO`/`CART` excluidos de la píldora) y B (producto fuera de la ventana de catálogo cargada) siguen sin resolver — pueden reproducir un síntoma similar bajo esas condiciones específicas.

Validado con `tsc -b`, `eslint` (mismos 3 warnings preexistentes de `SalesPOSPage.tsx`, sin warnings nuevos) y `npm run build` — limpios.

### Bloque 7 — HTTP 429 al anular varias ventas consecutivas — ✅ CERRADO (06/08/2026)

**Incidencia:** tras varias anulaciones consecutivas, el sistema devolvía `429`. Reiniciar el backend lo "arreglaba" temporalmente.

**Causa raíz (backend, `carniceria-pos-backend`):** `POST /sales/:id/void` cae en la categoría de rate limiter `transactional` (cupo original: 150 peticiones / 5 min, contadas por `req.ip`, sin proxy inverso configurado). Esa misma categoría absorbe, por diseño, todas las escrituras del ERP (ventas, compras, caja, devoluciones, inventario) **y las 5 rutas de Facturación Electrónica** (emitir/ver estado/PDF/XML/reenviar de Alegra), consultadas desde la misma pantalla de detalle de venta que un administrador revisa antes de decidir anular. Una sesión real de limpieza (revisar el estado de Alegra + anular, venta por venta) puede consumir 2-3 unidades del cupo por venta revisada, no 1 — agotando las 150 con una racha de ~50-75 ventas, trabajo administrativo legítimo, no abuso. El store del rate limiter es el `MemoryStore` en memoria del proceso Node (sin Redis) — de ahí que reiniciar el backend reseteara los contadores y "arreglara" el síntoma temporalmente. Se descartaron por evidencia real: bucles, dobles-submit, reintentos automáticos, e integraciones externas disparándose solas.

**Estrategia implementada (mínima, aprobada explícitamente):** recalibrar únicamente `RATE_LIMIT_TRANSACTIONAL_MAX` de **150 a 450** (x3) — misma ventana (5 min), mismo `keyGenerator` (`req.ip`, sin cambios), mismo orden de middlewares, sin categorías nuevas, sin tocar ningún endpoint ni el frontend. 450 cubre holgadamente una racha administrativa intensa (~150 ventas revisadas+anuladas en 5 minutos — muy por encima de un turno real completo, ~60 ventas) sin dejar de acotar el tráfico: sigue siendo un tope fijo por IP y por ventana, no una desactivación del limitador.

**Archivos modificados:** `src/config/env.ts` (default de `RATE_LIMIT_TRANSACTIONAL_MAX`), `.env.example` (mismo valor, documentado).

Validado con `tsc --noEmit`, `eslint` y `npm run build` — limpios. Arranque real del backend confirmado sin errores de parseo de configuración.

### Roadmap futuro — versión 1.1 (fuera de alcance de la 1.0.3)

Se mantienen documentadas pero **no se empieza ninguna hasta cerrar completamente el backlog de la 1.0.3**: implementación de CABYS↔Impuesto, recuperación de contraseña/perfil, desglose completo de pagos mixtos, y el resto de propuestas de `docs/AUDITORIA_TECNICA_1.1.md` (ver esa auditoría para el detalle completo de cada una).

---

## REDISEÑO UX/UI DEL ERP (frontend) — ✅ CERRADO

**Metodología:** sprints por módulo ("Bloques"), cada uno cerrado con aprobación explícita del usuario antes de continuar con el siguiente. Estándar visual de referencia: módulo **Productos** (Sprint "UX/UI PIPASA V1"). Ver `CLAUDE.md` ("Working methodology" y "Decisiones ya tomadas") para las reglas permanentes de este proceso.

| Módulo | Estado |
|---|---|
| Dashboard | ✅ Rediseñado y aprobado |
| Productos | ✅ Rediseñado y aprobado (estándar de referencia del resto del ERP) |
| Categorías | ✅ Rediseñado y aprobado |
| Impuestos | ✅ Rediseñado y aprobado |
| Proveedores | ✅ Rediseñado y aprobado |
| Inventario | ✅ Rediseñado y aprobado |
| Promociones | ✅ Rediseñado y aprobado |
| Compras | ✅ Rediseñado y aprobado |
| Ventas (administración) | ✅ Rediseñado y aprobado — Centro de Operaciones (Canvas Workspace, Drawer de detalle con Tabs, historial/paginación/orden con memoria en proceso) |
| Caja | ✅ Rediseñado y aprobado — Centro de Control de efectivo, única fuente de verdad para sesiones (historial que antes vivía duplicado en Reportes fue consolidado acá); Hero de sesión activa, KPI inteligente, Drawer con Tabs (Resumen/Ventas/Movimientos/Auditoría), Timeline de sesión |
| Usuarios | ✅ Rediseñado y aprobado |
| Roles | ✅ Rediseñado y aprobado — Canvas Workspace, KPI Strip clicable, Switch Activo/Inactivo (mismo componente de Productos/Usuarios), Drawer con Tabs (Resumen/Permisos agrupados por módulo/Usuarios asociados) |
| Reportes | ✅ Rediseñado y aprobado |
| **POS (Punto de Venta)** | ✅ **Rediseñado y aprobado** — identidad propia de "terminal de venta profesional" (dock lateral flotante, catálogo a 5 columnas, carrito de ancho fijo, Modo Cobrar como panel deslizante, peso manual para KILOGRAMO). Iteración final de productividad: Header Operativo (Caja/Cajero/Cliente/Hora/Ítems/Total en vivo), catálogo inteligente (Favoritos/Recientes/Más vendidos/En promoción/Poco stock), teclados numéricos táctiles (cobro y peso), atajos F1–F6 en Modo Cobrar, diálogo de Movimiento de Caja con Hero propio |
| Sprint de Pulido Integral | ✅ Sin ítems pendientes — ningún Bloque generó un problema lo bastante menor como para diferirlo en vez de corregirlo en el momento |
| QA Final | ⏳ Pendiente — ver "ROADMAP OFICIAL HACIA 1.0" más abajo |
| Release 1.0 | ⏳ Pendiente — ver "ROADMAP OFICIAL HACIA 1.0" más abajo |

### Estándar de ordenamiento de tablas (`DataTable`)

`components/ui/DataTable.tsx` soporta ordenamiento por columna de forma reutilizable, vía la prop opcional `column.sortValue` (función que extrae el valor comparable de cada fila). El estado de orden (columna activa + dirección) y el comportamiento visual (indicador ▲/▼, sentido activo resaltado) viven **centralizados dentro de `DataTable`** — ningún módulo implementa su propia lógica de ordenamiento. Es ordenamiento client-side sobre los datos ya cargados de la página actual — no agrega parámetros a la API.

**Módulos que ya lo usan:** Productos, Categorías, Impuestos, Promociones, Ventas, Caja, Roles, y las tablas reutilizadas de Reportes dentro de esos módulos (`SalesTable`, `CashMovementsTable`).

### Backlog del Sprint de Pulido Integral

**Estado:** vacío. Ningún Bloque de rediseño (incluidos los de Ventas, Caja, Roles y POS) encontró un problema lo bastante menor como para diferirlo — los hallazgos menores se resolvieron dentro del propio Bloque o se documentaron como limitación técnica explícita (ver por ejemplo la nota sobre "lote utilizado"/"observaciones por línea" en el carrito del POS, no exponible sin cambios de backend).

---

## ROADMAP DE DISEÑO PENDIENTE (registrado 05/08/2026, durante el Bloque 7.25)

**Ninguno de estos puntos está implementado — quedan registrados a propósito para no perderlos ni redescubrirlos en un bloque futuro.** Ninguno se implementa hasta que el usuario lo apruebe explícitamente y de forma puntual, con el mismo proceso de análisis → layout → aprobación → implementación ya usado en este Bloque 7.25.

1. **Rediseño completo del Login** (`LoginForm.tsx`) — explícitamente fuera del alcance del Bloque 7.24 (seguridad de sesión) y del Bloque 7.25 (ventana de actualización); ninguno de los dos lo toca.
2. **Eliminar definitivamente cualquier referencia visual a Pipasa** — hoy vive en `src/assets/pipasa-logo.png`, usado únicamente por `LoginForm.tsx`. Depende del punto 1 (rediseño del Login).
3. **Branding definitivo de Carnicería POS** — un logo/identidad propia que reemplace a Pipasa en todas las superficies que hoy la usan o que hoy solo tienen texto plano ("Carnicería POS").
4. **Fondo profesional para el Login.**
5. **Fondo profesional para la ventana de actualización** — ver Bloque 7.25 abajo, layout ya aprobado con esta pieza pendiente de un asset real (sin generar con IA).
6. **Identidad visual única y consistente entre las 5 superficies del sistema:** Login, Splash/Mantenimiento (`carniceria-pos-desktop/splash/`), la nueva ventana de actualización (Bloque 7.25), el ERP (Backoffice) y el POS — hoy son 3 sistemas visuales distintos sin relación entre sí (Splash es vanilla CSS oscuro con paleta propia, no la del ERP; el POS tiene su propia identidad ya aprobada y cerrada — ver "Decisiones ya tomadas" de `CLAUDE.md`; el ERP usa los tokens de `index.css`). Decidir explícitamente qué se unifica y qué se mantiene deliberadamente distinto (el POS ya tiene una razón de diseño documentada para su identidad propia).
7. **Iconografía propia del sistema** — hoy se usa `lucide-react` (genérico) en todo el ERP/POS; no existe ningún ícono propio de Carnicería POS.
8. **Línea gráfica consistente para todas las pantallas** — consecuencia de resolver los 7 puntos anteriores, no un ítem independiente.

## Bloque 7.25 — Ventana de actualización — ✅ IMPLEMENTADO (05/08/2026), pendiente de validación end-to-end real

**Alcance:** exclusivamente visual/UX — la lógica de `electron-updater` (descarga automática, verificación de checksum, `allowDowngrade=false`, rollback) **no cambia**. Hoy este flujo no tiene ninguna ventana propia: es un diálogo nativo del sistema operativo (`dialog.showMessageBox`, `electron/main.ts:164-184`), sin barra de progreso, sin porcentaje, sin timeline, sin lista de novedades — solo aparece una vez, cuando la actualización ya se descargó y verificó por completo.

**Decisión 1 (aprobada 05/08/2026):** ventana/vista propia e independiente del Splash — **no** se reutiliza visualmente `carniceria-pos-desktop/splash/` (vanilla CSS/DOM, paleta oscura propia, sin relación con los tokens del ERP). Motivo: mantener el Splash y la ventana de actualización como piezas visuales separadas, cada una con su propia identidad a resolver (ver ítem 6 del roadmap de diseño arriba).

**Decisión 2 (aprobada 05/08/2026):** arquitectura — **React, dentro de `carniceria-pos-front`**, reutilizando componentes/tokens reales del ERP (`Dialog`/`Card`/`Button`, `--brand`/`--pos-*` de `index.css`), en vez de reconstruir la identidad visual a mano en CSS plano dentro de `carniceria-pos-desktop`. Confirmado técnicamente viable — `electron/preload.ts` ya expone `electronAPI.onUpdateReady`/`installUpdateNow`/`getAppInfo` sin ningún consumidor hoy (comentario propio del archivo: "expuesto ya mismo para que un futuro banner no necesite ninguna plomería nueva"). Única limitación técnica real encontrada (menor, no bloqueante): `updater.start()` corre antes de que la ventana principal (la que carga React) exista — si una actualización se descarga y verifica en esa ventana muy breve, el evento push (`onUpdateReady`) no tendría ningún listener React todavía para recibirlo. Mitigación mínima a incluir en el diseño de implementación (sin tocar lógica de actualización): además del evento push ya existente, exponer una consulta "pull" de una sola vez (`getPendingUpdate()`, leyendo el mismo `updateReadyVersion` que `AppUpdater` ya guarda en memoria) que el componente React llame una vez al montar — garantiza que ningún evento se pierda, sin cambiar cuándo/cómo se descarga o instala nada.

**Estructura del layout (aprobada como base, 05/08/2026):** fondo desenfocado + tarjeta central (tokens del ERP) + encabezado con versión instalada → nueva + timeline de 4 pasos (Descargando/Verificando/Instalando/Reiniciando) + barra de progreso + lista de novedades + mensaje de "no afecta la información del negocio" + botones "Actualizar ahora"/"Más tarde".

**Maqueta v1 → v2 (composición visual, 05/08/2026):** validada con una maqueta HTML/CSS estática (sin React, sin lógica — solo referencia visual, no se reutiliza en la implementación). La v1 usaba los tokens claro/oscuro del ERP alternables; se pidió una segunda iteración con más jerarquía y protagonismo. Cambios de la v2, ya aprobados como dirección visual:

- **Decisión 3 — pantalla de un solo tema (oscuro premium):** esta ventana NO alterna claro/oscuro como el resto del ERP — decisión explícita, mismo criterio ya usado para la identidad propia del POS (ver "Decisiones ya tomadas" en `CLAUDE.md`). Queda registrada también en el ítem 6 del roadmap de diseño arriba (identidad entre Login/Splash/ventana de actualización/ERP/POS): esta ventana suma una CUARTA identidad deliberadamente distinta, no una unificación.
- **Encabezado con más peso:** marca tipográfica "C" (placeholder, depende del ítem 3 del roadmap de diseño — branding definitivo) + wordmark en mayúsculas + titular grande (24px) con énfasis de color — ya no un texto plano de tamaño uniforme.
- **Progreso y timeline como protagonistas:** barra de 14px con gradiente de marca + ETA/MB junto al porcentaje; nodos de timeline de 40px con un ícono propio por paso (descarga/escudo/engranaje/reinicio, SVG inline, sin librería de iconos nueva).
- **Novedades como checklist:** ícono de check + una línea por ítem, se descarta el bloque de párrafo con viñetas de la v1.
- **Mensaje de seguridad como Alert/Info:** mismo patrón visual que `components/ui/ErrorAlert.tsx` (`border/40` + `bg/10` + texto del color semántico), usando el token `info` (`--accent-teal`) en vez de `destructive`.
- **Más aire:** padding de tarjeta aumentado (~40%), separadores (`<hr>`) explícitos entre secciones en vez de un único ritmo de `gap` uniforme.
- **Animación:** se mantiene únicamente el punto pulsante de "en progreso" ya presente en la v1 — nada nuevo agregado, a pedido explícito de no sumar animaciones sin valor real.

**Decisión 4 (aprobada 05/08/2026) — plomería mínima autorizada para datos reales:** se agregó (1) un listener a `download-progress` de `electron-updater` (relevo directo de `percent`/`transferred`/`total`, sin transformar nada) y (2) la captura de `releaseNotes` de `update-downloaded` — **solo si el feed publica un string plano**; si publica la forma estructurada (`ReleaseNoteInfo[]`) o no publica nada, queda `null` y la UI muestra un mensaje genérico ("Esta actualización incluye mejoras y correcciones"), nunca contenido inventado. El estado "Verificando" no tiene un evento propio de `electron-updater` — se infiere de forma honesta como el intervalo real entre `download-progress` llegando a 100% y `update-downloaded` disparando (un hueco real entre dos eventos reales, no un dato fabricado). "Instalando"/"Reiniciando" son una secuencia local de UI que arranca en el clic real de "Actualizar ahora" (ya se llamó a `installUpdateNow()`, que va a cerrar la app de verdad en segundos) — no representan ningún dato nuevo del actualizador.

**IMPLEMENTADO (05/08/2026):**
- **Backend/lógica del actualizador:** sin cambios de comportamiento — mismo `autoDownload`, `allowDowngrade=false`, verificación de checksum, rotación de instalador y rollback de siempre.
- **`carniceria-pos-desktop`:** `electron/updater.ts` (nuevo listener `download-progress`, captura de `releaseNotes`, getter `getPendingUpdate()`), `electron/ipc/contracts.ts` (`UpdateReadyEvent.releaseNotes`, nuevo `UpdateProgressEvent`), `electron/ipc/index.ts` (`getPendingUpdate` en `IpcContext` + handler `update:get-pending`), `electron/preload.ts` (`onUpdateProgress`, `getPendingUpdate`), `electron/main.ts` (se elimina el diálogo nativo (`dialog.showMessageBox`) — `promptInstallUpdate` se reemplaza por `notifyUpdateReady`/`notifyUpdateProgress`, que solo reenvían el evento real a la ventana principal vía IPC).
- **`carniceria-pos-front`:** nuevo `src/components/common/UpdateReadyDialog.tsx` (máquina de estados `idle/downloading/verifying/ready/installing/restarting`, reutiliza `lucide-react` ya instalado — `Download`/`ShieldCheck`/`Cog`/`RefreshCw`/`Check`, sin librería nueva), montado sin condición en `App.tsx` (no-op fuera de Electron). `src/index.css` gana `.update-ready-surface` (Decisión 3: identidad de un solo tema oscuro, mismo mecanismo que `.pos-surface` — reutiliza `--brand`/`--brand-hover`/`--brand-active`/`--brand-accent`/`--success`/`--accent-teal` ya existentes, solo define neutrales nuevos).
- **Validado:** `tsc`/`eslint`/`build` limpios en ambos repos; arranque real contra la aplicación instalada (empaquetada con el pipeline oficial `electron-builder --dir`, mismo método ya usado en el Bloque 7.24) confirmado sin regresión — login y flujo normal funcionando con el componente nuevo montado e inactivo (sin actualización pendiente, no renderiza nada).

**Pendiente, fuera de este bloque a propósito:** la validación end-to-end del ciclo completo real (búsqueda → descarga → progreso → verificación → instalación → reinicio) requiere una versión realmente más nueva publicada en el feed de producción — el usuario decidió explícitamente no publicar una versión solo para probar este bloque; se validará en la próxima publicación real (0.1.9), aprovechando esa actualización real para el flujo end-to-end. El fondo real (foto de carnes premium) y el branding definitivo (ítems 3/5 del roadmap de diseño) siguen pendientes — el componente usa el mismo placeholder ya aprobado en la maqueta v2.

---

## Bloque 7.26 — Rediseño del Login — ✅ IMPLEMENTADO (05/08/2026)

**Alcance:** exclusivamente visual/UX — lógica de autenticación (`useLogin.ts`, `auth.api.ts`, `auth.schema.ts`, `authStore.ts`) **no cambia**. Único consumidor de `AuthLayout.tsx` es la ruta `/login` (confirmado por grep) — se puede modificar sin afectar ninguna otra pantalla.

**Decisión 5 (aprobada 05/08/2026) — el Login SIGUE el tema claro/oscuro del ERP.** A diferencia de la ventana de actualización (Bloque 7.25, deliberadamente de un solo tema), el Login usa los mismos tokens `--background`/`--card`/`--border`/`--brand` que ya responden al `ThemeProvider` — sin token nuevo de "un solo tema". Motivo: el Login es parte del ERP normal, no una pieza de identidad propia como la ventana de actualización o el POS.

**Decisión 6 (aprobada 05/08/2026) — botón sin gradiente.** El botón principal mantiene el estilo plano real de `Button` (`bg-primary`/`hover:bg-brand-hover`/`active:bg-brand-active`) — nunca el gradiente que sí tiene la ventana de actualización. El Login debe sentirse "parte del ERP", no una pantalla con identidad visual propia.

**Decisión 7 (aprobada 05/08/2026) — mecanismo del fondo real.** El asset final vive en `public/` (ej. `login-background.webp`), referenciado por una ruta fija en string — Vite copia `public/` sin hashear el nombre de archivo, a diferencia de `src/assets/*.png` (import con hash de contenido, obliga a recompilar para cambiar el asset). Es la única forma real de que "reemplazar el archivo alcanza, sin tocar código", confirmado contra `vite.config.ts`. Placeholder actual (maqueta v2): 3 radiales superpuestos + grano + viñeta en tonos vino/negro, pensado para que el reemplazo por la foto real cambie lo mínimo posible en la composición.

**Branding viejo a eliminar:** `src/assets/pipasa-logo.png` (único asset de Pipasa realmente usado, en `LoginForm.tsx`). Hallazgo colateral, fuera de alcance de este bloque: `src/assets/pipasa-icon.png` y `src/assets/hero.png` existen en el repo pero ningún archivo los importa — huérfanos de antes, no se tocan acá.

**Maqueta v1 → v2 (05/08/2026):** validada con maquetas HTML/CSS estáticas (sin React, sin lógica, no se reutilizan en la implementación). Cambios de la v2, ya aprobados como dirección visual:
- **Tarjeta:** superficie con transparencia sutil (`color-mix(in oklch, var(--card) 88%, transparent)` + `backdrop-filter: blur(20px)`, efecto glass) en vez de un blanco/superficie 100% opaca — menos "blanco puro", legibilidad intacta.
- **Branding:** la marca "C" (placeholder, depende del ítem 3 del roadmap de diseño) bajó a un badge chico de bajo contraste; el wordmark "Carnicería POS" pasó a ser el elemento principal, con más peso tipográfico.
- **Distribución:** menos espacio vacío superior — padding reducido, bloque de marca compacto en fila en vez de columna centrada con gaps grandes. Sin cambiar la estructura general (fondo → overlay → tarjeta centrada).
- **Botón:** se mantiene el plano real de `Button` (Decisión 6) — se agregó `transition`/`hover`/`active`/`focus-visible` más presentes, mismo criterio que el componente real ya usa.
- **Fondo:** más "fotográfico" (3 radiales + grano + viñeta, tonos vino/negro) en vez de un degradado de 2 puntos — ver Decisión 7.
- **Pie de tarjeta:** separador fino + una sola línea centrada ("Carnicería POS · versión") en vez de dos textos en extremos opuestos.

**Maqueta v3 (05/08/2026) — últimos ajustes antes de implementar:** tarjeta menos transparente (93% en vez de 88%, blur bajado a 14px — "muy discreto" pedido explícitamente), sombra en dos capas (contacto cercano + ambiental larga), título "Iniciar sesión" → **"Bienvenido"** (subtítulo sin cambios), y confirmación explícita de que el estado de carga (`isPending` de `useLogin()`, spinner + "Iniciando sesión..." + inputs/botón deshabilitados) ya existía en `LoginForm.tsx` y se reutiliza sin ningún cambio de lógica.

**IMPLEMENTADO (05/08/2026):**
- `src/layouts/AuthLayout.tsx` — fondo configurable (`LOGIN_BACKGROUND_PATH = '/login-background.webp'`, sin archivo real todavía — placeholder deliberado, cae al degradado si el asset no existe, sin ningún cambio de código el día que se agregue) + capa de overlay separada.
- `src/features/auth/components/LoginForm.tsx` — se quita `pipasaLogo`/`<img>`, nuevo bloque de marca ("C" chica + wordmark protagonista), título "Bienvenido", tarjeta con `bg-card/90`/`backdrop-blur-md`/`border-border/50`/`shadow-black/15` (aproximación idiomática con utilidades de Tailwind ya existentes a los valores exactos de la maqueta — mismo resultado visual, sin CSS arbitrario innecesario), pie de tarjeta con separador — **sin número de versión**: el build web no tiene hoy ninguna fuente real de versión en tiempo de ejecución (a diferencia de la app de escritorio, que la lee de Electron vía `getAppInfo()`) y no se inventó un valor.
- **Sin cambios** en `useLogin.ts`, `auth.api.ts`, `auth.schema.ts`, `authStore.ts`, ni en ningún otro módulo.
- **Hallazgo, no corregido (fuera de alcance):** `src/assets/pipasa-logo.png` queda huérfano en disco (ya no lo importa nada) — se suma a `pipasa-icon.png`/`hero.png`, ya huérfanos desde antes. Los tres quedan como candidatos a limpieza en un bloque futuro, no se borraron acá (cambio mínimo, sin refactors no solicitados).
- Validado visualmente contra `npm run dev` (captura real) — coincide con la maqueta v3 aprobada.
- `tsc -b`, `eslint` y `npm run build` limpios.

**Decisión 8 (aprobada 05/08/2026) — foto definitiva del fondo, generada por IA.** Reemplaza la restricción original de este mismo bloque ("no quiero generar una imagen con IA... quiero una fotografía real"). El usuario confirmó explícitamente conocer el origen del asset (`ChatGPT Image 5 ago 2026, 10_54_59.png`) y autorizó su uso como fondo definitivo — para este proyecto el criterio pasa a ser calidad visual + licencia de uso del asset aprobado, no el método de generación. **Vale para cualquier bloque futuro que toque este mismo asset:** no volver a cuestionar el origen IA de `public/login-background.png`, ya es una decisión de producto cerrada, no un defecto.

**Foto definitiva implementada y "Sesión bloqueada" unificada visualmente con el Login (05/08/2026):**
- `public/login-background.png` — asset definitivo (formato PNG, no WebP: no hay codificador WebP disponible en el proyecto sin agregar una librería nueva, fuera de alcance; nombre equivalente autorizado explícitamente por el usuario). Composición: cortes premium crudos en las 4 esquinas, superficie oscura vacía en el centro — coincide naturalmente con dónde cae la tarjeta centrada.
- `src/layouts/AuthLayout.tsx` — se extrajo la capa de fondo (foto + degradados de respaldo + overlay/blur) a un componente exportado `AuthBackdrop`, ahora consumido por `AuthLayout` (Login) **y** por `LockScreen` (Sesión bloqueada) — una sola implementación, cero duplicación de CSS. Overlay reajustado (viñeta más suave: `transparent 45%`/tope `30%` en vez de `40%`/`35%`) para la foto real — más liviano que el usado con los degradados placeholder, buscando que la foto se sienta presente sin perder legibilidad (la legibilidad real la da `bg-card/90` + `backdrop-blur-md` de la tarjeta, no el overlay). `backgroundPosition` de la capa de foto ajustado a `center 35%` para que los cortes de las esquinas queden visibles sin que la tarjeta tape la parte más "vacía" de la composición.
- `src/features/auth/components/LockScreen.tsx` — ya no dibuja su propio fondo (`bg-background/95 backdrop-blur-sm` eliminado); monta `<AuthBackdrop />` como fondo. `Card` cambiado a exactamente la misma clase que `LoginForm.tsx` (`border border-border/50 bg-card/90 py-8 shadow-2xl shadow-black/15 backdrop-blur-md`). Header reemplazado: el candado grande en círculo (protagonista) se quita; se agrega el mismo bloque de marca de `LoginForm.tsx` ("C" + wordmark "Carnicería POS") como elemento principal, y el ícono `Lock` pasa a ser chico, en línea junto al texto "Sesión bloqueada" (acompañando, no protagonizando). Ningún cambio en `verifyPassword`, en el bloqueo de teclado, ni en ninguna otra lógica del componente.
- **Sin cambios** en autenticación, backend, lógica de sesión/bloqueo, el actualizador, ni ningún otro módulo.
- Validado: `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde. Login validado visualmente contra `npm run dev` real en tema claro y oscuro (screenshots) — la tarjeta queda legible y "premium" en ambos temas sobre la foto real. "Sesión bloqueada" no se pudo validar en vivo en este entorno (requiere sesión autenticada + backend corriendo, no disponible en esta validación) — verificada por revisión de código: reutiliza exactamente el mismo `AuthBackdrop` ya validado en Login, y el mismo patrón de `Card`/branding ya validado en `LoginForm.tsx`.

**Bloque 7.26 — CERRADO (05/08/2026).**

---

## Bloque 7.27 — Rediseño del Centro de Notificaciones — ✅ IMPLEMENTADO (05/08/2026)

**Alcance:** exclusivamente visual/UX sobre el feature existente (`src/features/notifications/`, 4 archivos: `api/notifications.api.ts`, `hooks/useNotifications.ts`, `types/notification.types.ts`, `components/NotificationBell.tsx`/`NotificationPanel.tsx`/`NotificationItem.tsx`) + el `Toaster` global (`src/App.tsx`). **Sin cambios** de backend, de contrato de datos, ni de arquitectura — se confirmó en el análisis previo (mismo bloque, fase de análisis) que no existe marcar-como-leída, eliminar, ni "Restablecer" en este feature; ninguno de los tres se implementó, según lo aprobado.

**1. Fix del bug del POS (toasts sobre la campana/"⋮"):** `src/App.tsx` — el `Toaster` de `sonner` pasó de sin `offset` (default de la librería, 24px desde el borde superior) a `offset={{ top: 88 }}`. Es configuración nativa de Sonner (prop ya tipada por la librería, `node_modules/sonner/dist/index.d.ts`), sin lógica nueva ni cambio de arquitectura. 88px deja la pila de toasts siempre por debajo tanto del header del POS (`PosHeader.tsx`, fila de controles ~64-72px de alto) como del header del Backoffice (`DashboardHeader.tsx`, ~60-64px) — mismo `Toaster` global, un solo valor que sirve para ambos.

**2-3. Modernización visual del panel:**
- `NotificationItem.tsx` — se agregó una etiqueta de categoría real (`NOTIFICATION_CATEGORY`, mapeo 1:1 de los 4 `NotificationType` ya existentes: `NEGATIVE_STOCK`/`LOW_STOCK` → "Inventario", `PENDING_PURCHASE` → "Compras", `CASH_SESSION_OPEN_TOO_LONG` → "Caja") junto a la fecha, como eyebrow encima del título — sin inventar categorías (Ventas/Facturación/Usuarios no aparecen porque hoy no existe ningún `NotificationType` de esos dominios). Espaciado ampliado (`p-4`→`px-4 py-3.5`, `gap-0.5`→`gap-1`), ícono de severidad más grande (`size-8`→`size-9`), estado hover en la fila (`hover:bg-muted/40`) para mejor affordance. Los íconos `warning`/`info` (antes `amber-500`/`sky-600` literales de Tailwind) pasaron a los tokens reales del proyecto `--color-warning`/`--color-info` (ya definidos en `index.css` desde la Etapa 5.4, sin ningún consumidor hasta ahora) — mismo color visual, ahora resuelto desde tokens en vez de un color arbitrario.
- `NotificationPanel.tsx` — encabezado con contador real ("N activas", mismo array ya recibido por props, sin query nueva); separadores entre grupos (`divide-y`) con color de token (`divide-border/70`) en vez del default.

**4. Badge de la campana:** `NotificationBell.tsx` — se agregó `ring-2 ring-background` al badge existente (token, no color nuevo) para separarlo visualmente de lo que haya detrás (bell/header claro u oscuro según dónde se monte). Variant/color/condición de aparición **sin cambios** — sigue siendo `destructive` si hay al menos una crítica, `accent` en el resto, visible solo si `alertCount > 0`.

**5. Agrupación por categoría real:** implementada como se describe en el punto 2-3 arriba — mapeo de frontend puro sobre los `type` que el backend ya emite, cero cambio de backend/contrato.

**6. Estado vacío:** `NotificationPanel.tsx` ahora reutiliza `components/common/EmptyState.tsx` (mismo componente ya usado en Productos/Categorías) — ícono `CheckCircle2`, título "Todo está en orden", descripción "No hay notificaciones pendientes." Reemplaza el texto plano anterior. Como `NotificationPanel` ya se reutiliza sin cambios en la tarjeta "Alertas" del Dashboard (`src/pages/DashboardPage.tsx`), ese estado vacío mejora ambas superficies automáticamente, sin tocar `DashboardPage.tsx`.

**Hallazgos (documentados, no implementados en este bloque, según lo pedido):**
- El badge de la campana no tenía, hasta este bloque, ningún elemento que lo separara visualmente del fondo variable detrás de él (bell del POS vs. del Backoffice, tema claro/oscuro) — corregido con el `ring-2 ring-background` de este mismo bloque (punto 4), no queda pendiente.
- **Mejora futura, requiere backend:** hoy una notificación solo desaparece cuando la condición de negocio deja de cumplirse en el backend (ej. stock recuperado, caja cerrada) — no hay ningún mecanismo de "descartar" ni "marcar como leída" del lado del usuario. Implementar cualquiera de los dos requiere que el backend agregue un campo de estado (`isRead`/`dismissedAt`) y un endpoint de mutación — cambio de contrato de datos, fuera de alcance de este bloque a propósito.
- **Mejora futura, requiere backend:** las categorías Ventas/Facturación/Usuarios/Sistema pedidas originalmente no se pueden agrupar hoy porque no existe ningún `NotificationType` de esos dominios — requeriría que `notifications.service.ts` (backend) empiece a emitir nuevos tipos.
- "Restablecer" no existe en este feature (confirmado en el análisis) — se descartó de este bloque; lo único existente con nombre similar es la acción rápida "Reabastecer" (`NEGATIVE_STOCK`/`LOW_STOCK`), que no se tocó.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde. Regresión visual de `/login` confirmada contra `npm run dev` real (el cambio de `App.tsx` es global) — sin cambios visuales inesperados. El panel de notificaciones y el fix del toast en el POS **no se pudieron validar en vivo** en este entorno (requieren backend corriendo + sesión autenticada, no disponibles en esta validación) — verificados por revisión de código y por los tipos reales de `sonner`/Tailwind (`offset` de `ToasterProps`, tokens `--color-warning`/`--color-info`/`--color-background` ya declarados en `index.css`).

**Bloque 7.27 — CERRADO (05/08/2026).**

---

## Bloque 7.28 — Corrección de bugs del POS — ✅ IMPLEMENTADO (05/08/2026)

Primer bloque del "Camino confirmado hacia la versión 1.0" (ver más abajo, sección "ROADMAP OFICIAL HACIA LA VERSIÓN 1.0"). Dos bugs reales, reportados desde la aplicación instalada, reproducidos y corregidos con causa raíz demostrada — sin refactors, sin cambios de arquitectura.

**Bug 1 — Montos rápidos duplicados (`src/features/sales/utils/payment.ts`).** Causa raíz demostrada matemáticamente, no era un problema de estado acumulado entre ventas: `getQuickCashAmounts(total)` es una función pura, recalculada en cada render de `CheckoutPanel.tsx` sin ningún `useState`/memoización involucrada. El bug real estaba en el relleno de respaldo (cuando `total` deja menos de 3 billetes reales en `billsAtOrAbove`, es decir, cualquier total entre ₡10.001 y ₡50.000): el multiplicador de relleno se calculaba a partir de `roundedTotal` en vez de a partir del mayor monto ya sugerido — como el arreglo de denominaciones está ordenado y el filtro `bill >= roundedTotal` siempre incluye ₡50.000 cuando quedan 1-2 candidatos, el primer valor de relleno terminaba siendo exactamente ese mismo ₡50.000 ya presente (ej. `total=45000` → `[50000, 50000, 100000]`). No dependía de "varias ventas" ni de dejar el POS abierto mucho tiempo — reproducía en un solo render con cualquier total en ese rango; salir/reentrar al POS solo "arreglaba" el síntoma por coincidencia (el carrito reinicia en `total=0`, fuera del rango problemático). **Fix:** el multiplicador de relleno ahora arranca después del mayor monto ya presente en `billsAtOrAbove` (o de `roundedTotal` cuando ese arreglo está vacío, igual que antes — ese caso nunca tuvo el bug). Verificado con un sweep exhaustivo (0 a ₡300.000, cada ₡37) sin un solo caso de duplicado o de menos de 3 sugerencias.

**Bug 2 — Foco del escáner no vuelve tras un producto por peso (`src/features/sales/pages/SalesPOSPage.tsx`).** Causa raíz confirmada: para productos por UNIDAD el foco ya volvía correctamente (el efecto de resolución de escaneo llama `searchInputRef.current?.focus()` sin importar el resultado). El hueco real era exclusivo de productos por KILOGRAMO: `ProductWeightDialog` captura el foco con su propio `autoFocus` al abrir (correcto, necesario para escribir el peso), pero ni `handleConfirmWeight` ni el `onOpenChange` (cancelar/Escape/click afuera) devolvían el foco al cerrarse — a diferencia de `handleReceiptOpenChange` y `handleCashMovementOpenChange`, que ya seguían ese mismo patrón en este archivo para sus propios diálogos. **Fix:** nuevo `handleWeightDialogClose()` (limpia `pendingWeightProduct` + `searchInputRef.current?.focus()`), reutilizado tanto por `handleConfirmWeight` (al confirmar con éxito) como por el `onOpenChange(false)` del diálogo (cancelar/Escape/click afuera) — un solo punto de cierre para las 4 formas de cerrar el diálogo. Sin tocar `ProductWeightDialog.tsx` ni el flujo de productos por unidad (`handleAddUnit`, confirmado sin cambios).

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos (los 3 `react-hooks/exhaustive-deps` de siempre en `SalesPOSPage.tsx`, mismo baseline documentado en `CLAUDE.md`), `npm run build` verde. Bug 1 validado con los 5 casos pedidos (₡8.000/₡15.000/₡45.000/₡55.000/>₡100.000) más un sweep exhaustivo, todos sin duplicados. Bug 2 verificado por revisión de código: los 4 caminos de cierre del diálogo (confirmar, cancelar, Escape, click afuera) pasan por el mismo `onOpenChange`/`handleConfirmWeight`, ambos ahora resueltos por `handleWeightDialogClose()` — no se pudo ejecutar en vivo contra la app real en este entorno (requiere backend + sesión autenticada, no disponibles). No se creó infraestructura de pruebas unitarias nueva (no existe en el proyecto) — se descartó explícitamente, según lo aprobado.

**Bloque 7.28 — CERRADO (05/08/2026).**

---

## Bloque 7.29A — Usabilidad de Inventario (búsqueda + orden) — ✅ IMPLEMENTADO (05/08/2026)

Primera parte del Bloque 7.29 ("Mejoras de usabilidad y consistencia visual", ver "Camino confirmado hacia la versión 1.0" arriba). **Único bloque de esta serie que tocó el backend** — autorización explícita y puntual del usuario, confirmada tras el análisis previo que demostró que ni la búsqueda por texto ni el orden alfabético eran posibles solo desde el frontend: `InventoryFilters` (tipo, backend y frontend) nunca tuvo un campo `search`, y `Inventory.findMany()` tenía `orderBy: { createdAt: 'desc' }` fijo, sin ningún parámetro configurable en ninguna punta.

**Backend (`carniceria-pos-backend`, cambio puntual autorizado):**
- `src/modules/inventory/validation.ts` — `ListInventoryQuerySchema` agrega `search: z.string().optional()` (mismo esquema que `search` en `products.validation.ts`).
- `src/modules/inventory/types.ts` — `ListInventoryFilters` agrega `search?: string`.
- `src/modules/inventory/controller.ts` — `findMany` pasa `query.search` a `filters`.
- `src/modules/inventory/repository.ts` — `buildWhere` agrega un filtro `OR` sobre la relación `product` (`name`/`sku`/`barcode`, `contains`/`insensitive`, mismo patrón que `products.repository.ts` pero relacional en vez de sobre las propias columnas de `Inventory`, que no tiene nombre/SKU/código de barras propios). `findMany` cambia `orderBy: { createdAt: 'desc' }` → `orderBy: { product: { name: 'asc' } }` — orden alfabético ascendente por nombre de producto, sin selector de orden ni parámetro nuevo, según lo pedido. Sin cambios de lógica de negocio, sin endpoints nuevos.

**Frontend (`carniceria-pos-front`):**
- `src/features/inventory/types/inventory.types.ts` — `InventoryFilters` agrega `search?: string`.
- `src/features/inventory/components/InventoryFilters.tsx` — nuevo campo de búsqueda (reutiliza `SearchInput`/`useDebouncedValue` ya existentes, cero componentes/hooks nuevos), integrado dentro del mismo `FilterBar` junto a Sucursal/Producto. Estado local `searchTerm` para respuesta instantánea al tipear; el término debounced es el que efectivamente dispara `onFiltersChange`. Sincronización explícita para que "Limpiar filtros" (ya existente en `InventoryPage.tsx`) siga limpiando también el campo de búsqueda, no solo Sucursal/Producto.
- `src/features/inventory/pages/InventoryPage.tsx` — `hasActiveFilters` ahora también considera `filters.search`, para que el estado vacío "Sin resultados para estos filtros" (ya existente) se muestre correctamente al buscar sin resultados, en vez del estado vacío genérico de catálogo. Ningún otro cambio — paginación, selección, columnas extra y el resto de los flujos de la página quedan intactos.

**Validado en vivo contra el backend real (`GET /inventory`, base de datos real, no solo lectura de código):** búsqueda por nombre (`search=pollo` → 10 coincidencias correctas), por SKU exacto y parcial (`search=POL-001` → 1 resultado; `search=POL` → 16 resultados), por código de barras (`search=23423424` → coincide un producto cuyo nombre/SKU no contienen ese texto, confirmando que el filtro alcanza el campo `barcode`), orden alfabético por defecto (`GET /inventory` sin parámetros → nombres en orden ascendente), filtros existentes sin regresión (`sucursalId` sigue devolviendo resultados correctos), paginación sin regresión (`page=2` devuelve la página siguiente correcta), combinación `search` + `sucursalId` (AND correcto), y `search` sin resultados (`total: 0`, meta de paginación coherente). `tsc -b`/`tsc --noEmit` (backend) y `eslint` limpios en ambos repos, `npm run build` verde en el frontend.

**Bloque 7.29A — CERRADO (05/08/2026).**

---

## Bloque 7.29B.1 — Paridad visual de Permisos con Productos — ✅ IMPLEMENTADO (05/08/2026)

Wireframe aprobado previamente (maqueta estática, sin código) — implementación exclusivamente visual/estructural, **sin backend, sin lógica de negocio, sin refactors** de `PermissionTable.tsx`/`PermissionsPage.tsx` más allá de lo necesario para el nuevo estilo. La agrupación por módulo (`<details>` + `groupPermissionsByModule`) se conserva sin cambios de arquitectura — es una decisión ya aprobada en un bloque anterior, no una debilidad a corregir.

**`src/features/permissions/pages/PermissionsPage.tsx`:**
- Se agrega `breadcrumb` al `PageHeader` (faltaba).
- KPIs + Toolbar (búsqueda + acción) + lista pasan a vivir dentro de un único Canvas Workspace (`rounded-2xl border border-border bg-card shadow-sm`, bandas separadas por `border-b`) — mismo patrón que `ProductsPage.tsx`/`RolesPage.tsx`/`InventoryPage.tsx`. Antes eran 3 bloques sueltos sin superficie compartida.
- "Expandir todo/Colapsar todo" se agrega al slot `actions` del `Toolbar`, junto al buscador — **los KPIs no se tocan como disparador de esta acción** (quedan como indicadores puros, sin `onClick`, según lo pedido explícitamente).
- Nuevo estado `expandedModuleKeys` (controla qué módulos están expandidos) + auto-expansión de los módulos con coincidencias mientras hay una búsqueda activa (los módulos sin coincidencias ya no se renderizan en absoluto — comportamiento de filtrado preexistente, sin cambios — así que "permanecer colappados" se cumple porque no llegan a aparecer; los que sí aparecen, por tener al menos una coincidencia, se auto-expanden). Al borrar la búsqueda vuelve a colapsar todo. Ajuste de estado implementado durante el render (patrón oficial de React, sin `useEffect`) para no disparar el lint `react-hooks/set-state-in-effect` de React 19.

**`src/features/permissions/components/PermissionsKpiRow.tsx`:** de 2 `KpiCard` independientes (`size="compact"`, borde propio) a una franja `bare`/`size="xs"`/`divide-x` de una sola fila — mismo patrón que `ProductsKpiRow.tsx`. Se mantienen exactamente las 2 tarjetas ya aprobadas ("Total de permisos"/"Total de módulos"), sin agregar una tercera por simetría y **sin volverlas clicables** (KPIs = únicamente indicadores, según lo pedido).

**`src/features/permissions/components/PermissionFilters.tsx`:** deja de dibujar su propio contenedor (`border-b border-border/60 pb-5`) — ahora vive dentro de `<Toolbar bare>`. El campo pasa de un `Input` + ícono manual a `SearchInput` (genérico, ya usado en el resto del proyecto), con un hint "Ctrl K" puramente visual (`KbdHint`, decorativo — **sin atajo real implementado**, según lo pedido explícitamente). Sigue buscando por código, descripción y módulo (`matchesPermissionSearch`, sin tocar).

**`src/features/permissions/components/PermissionTable.tsx`:**
- El contador "(N)" en texto plano de cada `<summary>` pasa a `Badge` (`variant="muted"`) — mismo componente de badge que el resto del ERP.
- `<summary>`/cuerpo del grupo restyleados al mismo lenguaje visual del resto del ERP (`rounded-xl`, `shadow-sm`, `hover:bg-muted`, `transition-colors duration-200`, chevron con rotación animada).
- Acciones de fila: de un único botón de lápiz suelto al mismo patrón exacto de `ProductsTable.tsx` — iconos Ver detalle/Editar en hover + `RowMenu` ("...") con las mismas dos acciones. Sin "Eliminar": esa acción no existía antes de este bloque y no se agrega (cero funcionalidad nueva, solo restyle).
- Estado vacío: reemplaza el `<div>` de solo texto por `EmptyState.tsx` (mismo componente que Productos/Inventario), con 2 variantes — sin resultados de una búsqueda (con acción "Limpiar búsqueda") vs. catálogo realmente vacío.
- `open`/toggle de cada `<details>` pasa a estar controlado por `expandedKeys`/`onToggleKey` (antes: no controlado) — necesario para que "Expandir todo" y la auto-expansión por búsqueda puedan afectar el mismo estado que un click manual; el click manual sigue funcionando igual.

**Sin cambios:** backend, `usePermissions`/`usePermissions.ts`, `PermissionDrawer.tsx` (ya estaba alineado con el patrón de Productos), flujo de creación/edición como página completa, permisos/gating de `<Can>`, ninguna funcionalidad eliminada.

**Único componente nuevo:** ninguno — se reutilizaron `Toolbar`, `SearchInput`, `KbdHint`, `Badge`, `RowMenu`/`RowMenuItem`, `EmptyState`, `KpiCard` (todos ya existentes). El skeleton de carga con forma de acordeón (identificado en el wireframe como la única pieza sin equivalente reutilizable) **no se implementó** en este bloque — no estaba en la lista de ajustes aprobados; `LoadingState` genérico se mantiene sin cambios.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloque 7.29B.1 — CERRADO (05/08/2026).**

---

## Bloque 7.29C.1 — Dashboard como Centro de Operación — ✅ IMPLEMENTADO (05/08/2026)

Wireframe aprobado previamente (maqueta estática, sin código), con 10 ajustes explícitos antes de implementar. **Cambio exclusivamente visual y de organización de la información** — mismos hooks, misma lógica de rol Cajero/Administrador, sin backend, sin refactors.

**`src/pages/DashboardPage.tsx`:**
- Se elimina la pestaña **"Analítica"** (2 gráficos de `recharts` + indicadores históricos) y la navegación por pestañas en general — el Dashboard deja de sentirse como una copia de Reportes; el análisis profundo sigue siendo exclusivo de `/reports`. `useSalesByCategory`/`useSalesByDate` (que solo alimentaban esos gráficos) se dejan de pedir en esta página — ambos hooks siguen intactos y en uso en `ReportsIndexPage.tsx`/sus páginas dedicadas.
- Se agrega `breadcrumb` al `PageHeader` (faltaba).
- **Orden de la pantalla, tal como se aprobó:** KPIs de hoy → "Necesita atención" → "Actividad reciente" → "Mi turno"/"Estado operativo" → "Acciones rápidas". Cada sección es su propio Canvas Workspace (`rounded-2xl border border-border bg-card shadow-sm`) — antes eran `Card` sueltas sin superficie compartida.
- **"Necesita atención"** es ahora el bloque protagonista: un solo Workspace con Alertas (`NotificationPanel`, banda completa) + Bajo stock/Promociones (banda dividida) — y ya no se duplica (antes `NotificationPanel` se renderizaba dos veces, en las pestañas "Resumen" y "Alertas").
- **"Mi turno"** agrega un indicador visual "Caja abierta"/"Caja cerrada" junto al título — reutiliza el componente `Badge` genérico (mismo patrón visual — punto de color + texto — que ya usa `ActiveStatusBadge.tsx` en el resto del ERP), solo visible en la vista de Cajero.
- **"Acciones rápidas"** se reordena por frecuencia de uso esperada (Nueva venta → Ir a caja/Abrir caja → Nueva compra → Nuevo producto) — criterio razonado explícitamente documentado en el código como una estimación, no como telemetría real medida (no existe ningún dato de uso real de estos botones en el sistema). Se corrige además `tracking-wider` → `tracking-wide` (inconsistencia de clase real, detectada en el análisis).

**`src/features/reports/components/DashboardLowStockPanel.tsx`:** ahora muestra el punto de reorden (`LowStockItem.reorderPoint`) debajo de la cantidad, únicamente cuando ese dato ya existe (`!= null`) — sin inventar ningún valor cuando no está configurado.

**`src/features/reports/components/DashboardPromotionsPanel.tsx`:** "Hasta DD/MM" pasa a "Vence en N días" (`describeTimeRemaining`, calculado a partir del mismo `Promotion.endDate` real que ya se mostraba) — sin fecha límite (`endDate` nulo) se mantiene "Sin fecha límite", sin cambios.

**Sin cambios:** `DashboardContextPanel.tsx`, `DashboardRecentActivity.tsx`, `DashboardTodayKpis.tsx`, `QuickActions.tsx` (lógica intacta, solo se reordenó el arreglo de acciones en la página), `DashboardSummaryCards.tsx` (sigue usándose sin cambios dentro de `DashboardContextPanel.tsx` para la vista de Administrador). Backend sin tocar.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloque 7.29C.1 — CERRADO (05/08/2026).**

---

## Bloque 7.29D.1 — Configuración como Centro de Configuración — ✅ IMPLEMENTADO (05/08/2026)

Wireframe aprobado previamente (maqueta estática, sin código), con 8 mejoras adicionales incorporadas directamente en la implementación (ninguna amplía el alcance funcional ni requiere backend). **El modelo de datos real no cambia** — `Configuration` sigue siendo el mismo catálogo clave-valor paginado (confirmado contra la base real: hoy 3 filas — `locale`/`company.name`/`currency`); este bloque es exclusivamente de organización visual.

**`src/features/settings/pages/SettingsPage.tsx`:**
- Se agrega `breadcrumb` al `PageHeader` (faltaba).
- La pantalla pasa de "una tabla con dos botones en el header" a **dos secciones nombradas**: "Integraciones" y "Parámetros del sistema (N)" — `N` es `data.meta.total`, ya incluido en la respuesta paginada existente, sin consulta nueva. Separación entre ambas secciones (`mt-3`) deliberadamente mayor que el `gap-5` general de la pantalla, para reforzar que son dos bloques distintos.
- **"Facturación Electrónica" deja de ser un botón secundario del header** y pasa a ser una tarjeta de estado real dentro de "Integraciones": icono protagonista (`size-12`), badge "Conectada"/"No configurada" (reutiliza `Badge`, mismo patrón visual que `ActiveStatusBadge.tsx`), email + fecha de última actualización cuando está configurada, botón "Administrar" bien jerarquizado (outline, alineado a la derecha) → `/settings/alegra`. Reutiliza `useAlegraConfigStatus()` (hook ya existente, mismo que usa `AlegraIntegrationPage.tsx`) — única llamada de datos adicional en esta pantalla, sin endpoint nuevo. Responsive verificado por código: `flex-col` en móvil → `sm:flex-row` en escritorio, `min-w-0`/`truncate` en el bloque de texto y `shrink-0` en el ícono y el botón evitan que la tarjeta rompa el layout en pantallas angostas.
- **"Nueva configuración"** se mantiene como única acción principal del `PageHeader` (ya usaba exactamente el mismo patrón de clases que "Nuevo Producto" — verificado, sin cambios necesarios ahí).
- **Toolbar**: `ConfigurationFilters` ahora vive dentro de `<Toolbar bare>` — idéntico al patrón ya usado en Productos/Permisos/Inventario, sin envoltorio propio.

**`src/features/settings/components/ConfigurationFilters.tsx`:** deja de dibujar su propio contenedor (`border-b border-border/60 pb-5`).

**`src/features/settings/components/ConfigurationsTable.tsx`:** espaciado/tipografía alineados a Productos (`px-4 py-2.5`/`py-3` en vez de `px-5 py-4`), sin borde/sombra propios (los aporta el Canvas Workspace), estado vacío con `EmptyState.tsx` (2 variantes: sin resultados de búsqueda vs. catálogo vacío) en vez del `emptyMessage` de texto plano anterior. Mismas columnas y única acción (Editar) de siempre — sin agregar selección, orden ni "Eliminar".

**`src/features/settings/components/ConfigurationsTableSkeleton.tsx`** (nuevo — único archivo nuevo de este bloque, mismo criterio que Permisos/Inventario: no existía ningún skeleton reutilizable para esta forma de tabla): mismo componente primitivo (`Skeleton.tsx`) y misma técnica que `ProductsTableSkeleton.tsx`, adaptado a las columnas reales de esta tabla.

**Documentado para un bloque futuro:** `AlegraIntegrationPage.tsx` (formulario propio, ya tiene breadcrumb) deberá recibir su propio pase de modernización visual (Canvas Workspace, espaciado, etc.) cuando le toque su bloque — no se tocó en este bloque, que fue exclusivamente sobre `SettingsPage.tsx`.

**Sin cambios:** backend, modelo `Configuration`, lógica de creación/edición/drawer, permisos/gating de `<Can>`.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloque 7.29D.1 — CERRADO (05/08/2026).**

---

## Bloque 7.30 — Reducción de scroll horizontal en el Reporte de Utilidad — ✅ IMPLEMENTADO (05/08/2026)

Wireframe aprobado previamente (maqueta estática comparando antes/después, sin código). **Cambio exclusivamente de espaciado/distribución dentro de `ProfitReportTable.tsx`** — mismas 14 columnas, misma información, sin tocar `DataTable.tsx` (componente compartido) ni ningún otro reporte.

**`src/features/reports/components/ProfitReportTable.tsx`:**
- Padding general: `px-4 py-4` (heredado del default de `DataTable` + los props propios de esta tabla) → `px-2.5 py-2.5` en `headerClassName`/`cellClassName` — override por instancia, único mecanismo usado, sin modificar el componente compartido. Afecta a las 14 columnas por igual.
- Encabezados en dos líneas **únicamente** en las 4 columnas donde el título (13-15 caracteres) es más ancho que el monto que encabeza: "Costo unitario", "Costo efectivo", "Precio unitario", "Costo total" — nueva constante `TWO_LINE_HEADER` (`text-right whitespace-normal max-w-[4.5rem] leading-tight`) aplicada solo a esas 4 `headerClassName`. El resto de los encabezados permanece en una sola línea, sin cambios.
- Todos los montos siguen alineados a la derecha (`text-right`) y en una sola línea (`whitespace-nowrap` en las celdas, sin cambios) — ninguna celda cambia de contenido, formato ni se corta.
- `scrollX` se mantiene en el componente — sigue siendo el respaldo real para las resoluciones donde, incluso con esta redistribución, las 14 columnas (9 monetarias reales, ninguna eliminada) no entran completas.

**Sin cambios:** lógica del reporte, `DataTable.tsx`, colores/tipografía/tamaños de fuente, cualquier otro reporte del módulo (`SalesReportTable.tsx`, `SalesByCashierTable.tsx`, `PurchasesReportTable.tsx`, etc. — ninguno importa ni depende de `ProfitReportTable.tsx`, confirmado por ser el único consumidor de sus propias columnas).

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde. Confirmación visual final (sidebar expandido/colapsado, 1920x1080, zoom 100%) realizada directamente por el usuario sobre el entorno de desarrollo real ("se ve bien asi ya") — no se completó una captura propia en este entorno de sesión.

**Bloque 7.30 — CERRADO (05/08/2026).**

---

## Bloque 7.31 — Corrección UX del módulo Caja — ✅ IMPLEMENTADO (05/08/2026)

Tres correcciones puntuales de UX en `src/features/cashSession/pages/CashSessionsPage.tsx` — sin lógica de negocio, sin backend, sin tocar componentes compartidos.

1. **"Ir al POS"** — pasa de `variant="outline"` tamaño default (`h-8`, se sentía secundario pese a ser la acción principal de la pantalla mientras hay una caja abierta) al mismo patrón de botón primario ya usado en el resto del ERP para la acción principal del header (`h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active` — mismas clases que "Nuevo Producto"/"Nuevo Permiso"). Mismo `onClick`/destino de siempre (`navigate('/sales/pos')`), sin cambios. **"Abrir caja"** (mismo slot del header, mutuamente excluyente con "Ir al POS" según haya o no una sesión abierta) recibe el mismo tratamiento por consistencia — ambos representan por igual "la acción principal de esta pantalla" según el estado.
2. **Filtro "Estado" por defecto** — `useReportMemoryState('cash-sessions-page-filters', { status: 'CLOSED' })` → `{ status: 'OPEN' }`. Único cambio: el valor inicial. `CashSessionFilters.tsx` (componente de Reportes, reutilizado, no se tocó) y `useCashReport` siguen funcionando exactamente igual — el usuario sigue pudiendo elegir cualquier estado después.
3. **Revisión de consistencia** — `CashSessionsPage.tsx` ya usa `PageHeader` con breadcrumb, Canvas Workspace (`rounded-2xl border bg-card shadow-sm`) y `Toolbar bare` para los filtros — confirmado que ya sigue el estándar del resto del ERP; no se encontraron espacios muertos ni desviaciones estructurales que requirieran corrección más allá del botón del punto 1.

**Sin cambios:** lógica de caja, backend, `CashSessionFilters.tsx`, `CashSessionsTable.tsx`, `useCashReport`/`useCashSessions`. Hallazgo menor documentado, no corregido (no era necesario tocar el archivo): el comentario de `CashSessionFilters.tsx` (líneas 51-54) sigue describiendo el default anterior ("por defecto esta pantalla muestra el historial de sesiones CERRADAS") — queda desactualizado tras este bloque, candidato a una limpieza menor en un futuro pase, no bloqueante.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloque 7.31 — CERRADO (05/08/2026).**

---

## Bloque 7.32 — Caja como pantalla de inicio del ERP — ✅ IMPLEMENTADO (05/08/2026)

**`src/features/auth/hooks/useLogin.ts`:** la navegación post-login pasa de `navigate(getDefaultRoute(...))` (Dashboard, si el usuario tiene `reports.view`) a preferir Caja (`/cash-session/open`) cuando el usuario tiene `cash.open` — el caso real de prácticamente todo el personal. Si no lo tiene, cae exactamente al comportamiento anterior (`getDefaultRoute`, sin cambios).

**Deliberadamente NO se tocó** `src/constants/navigation.ts` (`getDefaultRoute`) ni `src/routes/DashboardRoute.tsx` — ambos seguían usándose para una cosa distinta: el *gate* de permiso de la ruta `"/"` (evita que un usuario sin `reports.view` dispare las queries del Dashboard y reciba 403s). Si se hubiera reutilizado esa misma función para forzar Caja como destino, el link "Dashboard" del sidebar (que navega a `/`) habría quedado interceptado por ese mismo gate y jamás habría llegado al Dashboard — exactamente lo que la restricción "mantener el Dashboard completamente accesible desde el menú lateral" prohíbe. Al aislar el cambio únicamente en `useLogin.ts`, el gate de `/` sigue funcionando exactamente igual que antes, y el Dashboard sigue disponible sin ninguna restricción nueva.

**Sin cambios:** lógica de autenticación, permisos, protección de rutas, backend, el propio Dashboard (ni su contenido ni su ruta `/`).

**Validado en vivo contra el backend real:** login con `admin`/`Admin123!` → aterriza directamente en `/cash-session/open` (Caja), con el filtro "Estado" ya en "Abiertas" (Bloque 7.31) y el botón "Ir al POS" con la jerarquía visual prominente (Bloque 7.31) — confirmado por captura real del navegador. Cierre de sesión/recarga/restauración de sesión no fuerzan ninguna navegación propia (confirmado por código: `App.tsx` no llama a `navigate` en su flujo de refresh silencioso) — no se ven afectados por este cambio, que solo modifica el punto de entrada inmediatamente posterior a un login exitoso.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloque 7.32 — CERRADO (05/08/2026).**

---

## Bloque 7.33 — Correcciones finales de UX del POS — ✅ IMPLEMENTADO (05/08/2026)

Dos correcciones de UX puntuales, exclusivamente de presentación — sin backend, sin lógica de ventas/comprobante/resumen de sesión, sin refactors.

**1. Comprobante de venta (`src/features/sales/components/SaleReceiptDialog.tsx`):** el `overflow-y-auto` que antes vivía en el propio `Popup` hacía que, con muchos productos, todo el comprobante (encabezado + botones incluidos) scrolleara como una sola unidad. Se movió esa propiedad a un nuevo wrapper intermedio (`min-h-0 flex-1 overflow-y-auto`), dejando el encabezado ("Venta completada") y la fila de botones (Imprimir/Descargar PDF/Cerrar) como hermanos `shrink-0` del `Popup`, fuera de esa zona — siempre visibles sin importar la cantidad de productos. En la práctica esa zona intermedia casi nunca necesita su propio scroll: la tabla de "Detalle" (la única parte que crece con la cantidad de productos) ya tenía su propio scroll interno acotado desde antes (`detailMaxHeight="20rem"`, sin cambios); el nuevo wrapper es la red de seguridad que garantiza que el header/footer nunca se muevan incluso en un caso extremo. `DocumentRenderer.tsx` no se tocó.

**Impresión/PDF — confirmado sin regresión, por evidencia de código:** "Descargar PDF" (`useSaleDocumentActions.ts`) pide el PDF al backend (`POST /documents/pdf`, que construye su propio `DocumentData` del lado del servidor) — no depende en absoluto del DOM en pantalla, cambio irrelevante para esa ruta. "Imprimir" usa `window.print()` + la hoja `@media print` de `index.css`, que ya tiene una regla `*:has(:is([data-document-print-root]...))` que resetea `position`/`max-height`/`overflow` en **cualquier ancestro** del documento — el nuevo wrapper es un ancestro más de `DocumentRenderer`, así que esa misma regla ya existente lo neutraliza automáticamente durante la impresión, sin necesitar ningún cambio en `index.css`.

**2. Resumen de sesión del POS (`src/features/sales/components/CashSessionSummaryPanel.tsx`):** "Resumen general" + "Últimas ventas de la sesión" pasan a vivir dentro de un único Canvas Workspace (`rounded-2xl border bg-card shadow-sm`, misma superficie que Productos/Permisos/Dashboard/Caja) en vez de dos `<section>` sueltas. Los KPIs (`CashSessionSummaryKpis`) siguen recibiendo `variant="full"` (mismos 5-8 indicadores de siempre, mismos datos/cálculos de `useCashReportDetail`, sin cambios) pero ahora **también** `bare` — prop ya existente en ese componente compartido (agregada en un bloque anterior para `SalesKpiRow.tsx`, nunca antes combinada con `variant="full"`) que fuerza `size="xs"` sin descripción — la misma franja plana `divide-x/divide-y` que ya usa el resto del ERP, en vez de 8 tarjetas con borde propio y números de 28px (`size="default"`). Cero cambios en `CashSessionSummaryKpis.tsx`/`KpiCard.tsx` (componentes compartidos) — solo el call-site.

**Sin cambios:** `useCashReportDetail`, `useSales`, `useSaleDocumentActions.ts`, `DocumentRenderer.tsx`, `index.css`, backend.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde. Mecanismo de impresión/PDF verificado por evidencia de código (no reproducido con una impresión real en este entorno) — la conclusión de "sin regresión" se apoya en que ninguno de los dos cambios modificó `DocumentRenderer.tsx` ni `index.css`, y en que la regla CSS de impresión existente ya cubre genéricamente cualquier ancestro nuevo del documento.

**Bloque 7.33 — CERRADO (05/08/2026).**

---

## Bloque 7.35 — Corrección global de filtros por fecha — ✅ IMPLEMENTADO (05/08/2026)

Auditoría exhaustiva de **todo** el sistema (backend + frontend) buscando cualquier lugar con el mismo bug ya corregido y validado en `SalesReportTable.tsx` (05/08/2026): tratar un instante UTC real como si ya fuera el día calendario de Costa Rica, en vez de convertirlo correctamente (zona horaria `America/Costa_Rica`).

**Backend — ya estaba 100% correcto, sin cambios.** Los 11 puntos del backend que aceptan `dateFrom`/`dateTo` (Dashboard, Ventas, Compras, Ventas por categoría, Ventas por cajero, Top productos, Inventario/Mermas, Lotes, Utilidad, Caja) pasan todos por el mismo `buildDateRange()` (`reports.repository.ts`), que a su vez usa el único helper timezone-aware real (`costaRicaDayStartFromDateOnly`/`costaRicaDayEndExclusiveFromDateOnly`, `shared/utils/date.ts`) — el fix ya estaba centralizado ahí desde QA.13, sin ninguna implementación divergente. Ningún otro módulo del backend (Compras, Ventas, Caja, Inventario, Mermas, Auditoría, Devoluciones, Sync, Configuración, Alegra) tiene un filtro de rango de fechas propio. `startDate`/`endDate` de Promociones son fechas calendario puras (no un rango de instantes) con su propio mecanismo ya corregido en QA.9 (`resolveCostaRicaDateString`) — no aplica este fix.

**Frontend — 6 puntos corregidos, mismo patrón exacto que `SalesReportTable.tsx` (`formatDateTime(...).split(' ')[0]`):**
- `src/features/reports/components/ProfitReportTable.tsx` — columna "Fecha" (`item.sale.saleDate.slice(0,10)` → `formatDateTime`).
- `src/features/reports/components/PurchasesReportTable.tsx` — columna "Fecha" (`item.purchaseDate.slice(0,10)` → `formatDateTime`).
- `src/features/reports/pages/SalesReportPage.tsx` — columna "Fecha" del CSV exportado.
- `src/features/reports/pages/PurchasesReportPage.tsx` — columna "Fecha" del CSV exportado.
- `src/features/reports/pages/ProfitReportPage.tsx` — columna "Fecha" del CSV exportado.

**Hallazgo adicional dentro del mismo alcance (mismo bug de fondo, distinto lugar):** `src/features/reports/constants/reportPeriods.ts` — los presets "Hoy"/"7 días"/"30 días"/"Este mes" del Centro de Análisis (`ReportsIndexPage.tsx`) calculaban "hoy" con `new Date().toISOString().slice(0, 10)` — convierte a UTC antes de recortar, adelantando un día durante la ventana de 18:00 a medianoche hora de Costa Rica (el mismo síntoma, pero en el cálculo de un filtro en vez de en una celda de tabla). Corregido reutilizando exactamente la misma técnica ya aprobada en `DashboardPage.tsx` (`getTodayInCostaRica`, `Intl.DateTimeFormat` con `timeZone: 'America/Costa_Rica'`) — nueva función local `getCostaRicaTodayAnchor()`, duplicada (no exportada desde `DashboardPage.tsx`, mismo criterio ya documentado en `DashboardContextPanel.tsx` para no exportar utilidades desde un archivo de página) — verificado con un caso límite real (22:00 hora CR → "hoy" sigue devolviendo la fecha correcta, antes devolvía el día siguiente).

**Ya estaban correctos, confirmado, sin tocar:**
- Los 7 componentes `*Filters.tsx` con `<input type="date">` (Ventas, Compras, Caja, Utilidad, Top productos, Ventas por cajero, Ventas por categoría) — todos envían el string `YYYY-MM-DD` crudo, sin conversión `new Date()` de por medio; dependen enteramente del backend, que ya es correcto.
- `features/purchases/utils/purchase.utils.ts` (`formatPurchaseDate`), `features/batches/utils/batch.utils.ts`, `features/promotions/` (`EditPromotionPage.tsx`/`PromotionsTable.tsx`) — usan `slice(0,10)`/getters UTC a propósito, sobre campos que son fechas calendario puras (no instantes), exactamente como se decodifican en el backend — aplicarles `formatDateTime` ahí sería un bug nuevo (correrían el día), no una corrección.

**Sin cambios:** backend, endpoints, consultas SQL/Prisma, lógica de negocio, diseño visual.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde. Corrección de `reportPeriods.ts` verificada con un caso límite real simulado (venta a las 22:00 hora CR): antes devolvía `2026-08-04` (fecha equivocada), ahora devuelve `2026-08-03` (correcto).

**Bloque 7.35 — CERRADO (05/08/2026).**

---

## Bloque 7.35A/7.35B — Visual Polish de Productos — ✅ IMPLEMENTADO (05/08/2026)

Mejora exclusivamente visual (colores/sombras/bordes/contraste/opacidad) sobre el módulo de Productos, base para replicar el mismo lenguaje al resto del ERP en bloques futuros. **Cero cambios de layout, orden, tamaño, componentes, lógica, hooks o comportamiento** — mismos archivos, mismas props, mismos datos. Todo reutiliza tokens ya existentes del Design System; no se creó ningún color ni token nuevo.

**`src/index.css` (tema claro, `:root`) — único cambio de alcance global, intencional:**
- `--background`: `oklch(0.985 0.003 24)` → `oklch(0.96 0.004 24)`. Antes estaba a solo 0.01 de luminosidad de `--card` (0.995) — el Canvas Workspace casi no se distinguía de la página de fondo, a diferencia del tema oscuro (0.169 vs 0.210, una separación real y ya aprobada). Valor elegido para no colisionar con `--card-hover` (0.965, sin cambios).
- `--muted`: `oklch(0.955 0.004 24)` → `oklch(0.945 0.005 24)` — el header de las tablas casi no se distinguía del cuerpo.
- Tema oscuro: sin cambios (ya tenía la separación correcta).
- **Efecto esperado y aceptado:** al ser tokens globales, esta mejora de profundidad se ve de inmediato en cualquier otra pantalla que ya use el mismo Canvas Workspace (Permisos, Dashboard, Configuración, Caja, Inventario, Reportes) — es precisamente el mecanismo por el cual este Visual Polish "se replica sin trabajo adicional" al resto del ERP, tal como se acordó en el análisis.

**`src/features/products/pages/ProductsPage.tsx`:**
- Sombra del Workspace: `shadow-sm` (plana) → sombra en dos capas compuesta con `color-mix()` sobre los tokens existentes `--foreground`/`--brand` (sin color nuevo) — más presencia de "superficie elevada".
- Los 3 separadores internos (banda de KPIs, banda de Toolbar, banda de paginación): `border-border/70` → `border-border/90` — mismo token `--border`, más opaco, para que las 3 secciones se lean de un vistazo.

**`src/features/products/components/ProductsKpiRow.tsx`:** hover de las 4 celdas `hover:bg-brand/5` → `/8`. `divide-x divide-border` (separador entre celdas) ya usaba `--border` a máxima intensidad — sin modificador de opacidad que reforzar, se deja sin cambios.

**`src/features/products/components/ProductsTable.tsx`:** header de la tabla `text-foreground/85` → `/90` (mejor contraste); hover de fila `hover:bg-brand/5` → `/8` (mismo criterio que los KPIs). Ninguna columna, acción ni comportamiento de la tabla cambia.

**`src/features/products/components/ProductFilters.tsx`:** los 3 campos (buscador, Categoría, Impuesto) pasan de `border-transparent` a `border-border/60` — antes dependían casi enteramente del `shadow-sm`/hover para distinguirse del fondo del Toolbar en reposo.

**Deliberadamente NO tocado (transparencia sobre el alcance real):** el tinte de los íconos de KPI (`bg-brand/10`/`ring-brand/15`) vive dentro de `KpiCard.tsx` (componente compartido por Dashboard/Caja/Reportes/etc.) y la tipografía del título/descripción vive dentro de `PageHeader.tsx` (compartido por todo el ERP, sin prop de estilo por consumidor) — modificar cualquiera de los dos habría aplicado el cambio a todos los módulos ya aprobados antes de que les toque su propio bloque, en vez de quedar acotado a Productos como se pidió explícitamente. Quedan documentados aquí para su propio bloque de Visual Polish cuando corresponda.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde (confirmado además que las clases `shadow-[...color-mix...]` y `border-border/90` compilaron correctamente en el CSS final, con el fallback `@supports` que Tailwind genera automáticamente para `color-mix`).

**Bloque 7.35A/7.35B — CERRADO (05/08/2026).**

---

## Bloque 7.35C — Visual Polish de Productos, segunda y última pasada — ✅ IMPLEMENTADO (05/08/2026)

El Bloque 7.35B quedó, en palabras del usuario, "técnicamente correcto, pero visualmente casi imperceptible". Esta segunda pasada profundiza exactamente los mismos ejes (contraste, opacidad de bordes/hover, peso de íconos y tipografía) hasta que el cambio sea **claramente perceptible**, y — a diferencia de 7.35B — el usuario autorizó explícitamente esta vez tocar componentes compartidos (`KpiCard`, `PageHeader`, `Toolbar`, `DataTable`) si el resultado mejora todo el ERP y mantiene coherencia con el diseño ya aprobado. **Sigue sin haber ningún cambio de layout, posición, tamaño general, estructura, funcionalidad, hooks ni APIs** — solo tokens y clases ya existentes del Design System, ningún color/componente nuevo.

**`src/index.css` (tema claro, `:root`) — profundiza los 2 tokens de 7.35B y suma 2 más:**
- `--background`: `0.96` (valor de 7.35B) → `oklch(0.94 0.005 24)`.
- `--muted`: `0.945` (valor de 7.35B) → `oklch(0.92 0.006 24)`.
- `--muted-foreground`: `oklch(0.5 ...)` → `oklch(0.42 0.009 24)` (sin cambios hasta ahora) — mejor contraste de texto secundario.
- `--border`/`--input`: `oklch(0.9 ...)` → `oklch(0.85 0.006 24)` (sin cambios hasta ahora) — bordes/inputs mucho más reconocibles en reposo.
- `--card`/`--card-hover` sin cambios (evita colisión con `--background`). Tema oscuro sin cambios (ya correcto).

**`src/components/ui/DataTable.tsx` (componente compartido, cambio autorizado explícitamente):** las 3 apariciones de `bg-muted/50` (header de tabla + 2 fallbacks de sticky-header) → `bg-muted/80` — encabezados de tabla notoriamente más distinguibles del cuerpo en TODO el ERP, no solo Productos.

**`src/components/common/KpiCard.tsx` (componente compartido, cambio autorizado explícitamente):**
- `TONE_CLASSNAMES`: `brand`/`success` pasan de `bg-*/10 ring-*/15` → `bg-*/20 ring-*/30` (íconos de KPI con mucho más color). `muted` sin cambios.
- Valor numérico: `font-bold` → `font-extrabold` (sin cambio de tamaño de fuente).
- Variante no-`bare` (`Card`): `border-border/60` → `border-border/80`; `shadow-sm` → sombra en dos capas compuesta con `color-mix()` sobre `--foreground` (igual criterio que la sombra del Workspace en 7.35B).

**`src/components/common/PageHeader.tsx` (componente compartido, cambio autorizado explícitamente):** título `font-semibold` → `font-bold` (mismo `text-xl`, sin cambio de tamaño) — se ve en el título de toda página que use `PageHeader`.

**`src/features/products/pages/ProductsPage.tsx`:** sombra del Workspace intensificada (mismos tokens `--foreground`/`--brand` de 7.35B, capas más marcadas); los 3 separadores internos `border-border/90` (valor de 7.35B) → `border-border` sin modificador (máxima intensidad del mismo token).

**`src/features/products/components/ProductsKpiRow.tsx`:** hover de las 4 celdas `hover:bg-brand/8` (valor de 7.35B) → `/14`.

**`src/features/products/components/ProductsTable.tsx`:** header `text-foreground/90` (valor de 7.35B) → `text-foreground` sin modificador; hover de fila `hover:bg-brand/8` → `/12`.

**`src/features/products/components/ProductFilters.tsx`:** los 3 campos (buscador, Categoría, Impuesto) `border-border/60` (valor de 7.35B) → `border-border` sin modificador.

**Validado:**
- `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 8 archivos tocados, `npm run build` verde (CSS final: 120.84kB → 124.27kB, consistente con las nuevas clases de utilidad).
- Validación visual en vivo contra la app real corriendo (`npm run dev`), sesión logueada como `admin`, tema claro (donde aplican los deltas de tokens), página `/products`: bordes de KPIs/filtros/tabla notoriamente más marcados, franja de KPIs con hover/presión mucho más visibles, fondo y `muted` visiblemente más oscuros que antes — confirmado que el resultado ya es "claramente perceptible", no un cambio microscópico como en 7.35B.
- Sin regresiones: ningún otro módulo que consume `KpiCard`/`PageHeader`/`DataTable` (Dashboard, Caja, Permisos, Configuración, Reportes, etc.) cambia de layout, tamaño o comportamiento — solo hereda el mismo refuerzo de contraste/peso visual, exactamente el efecto buscado ("mejora todo el ERP, mantiene coherencia").

**Bloque 7.35C — CERRADO (05/08/2026). Visual Polish de Productos (7.35A→7.35C) queda cerrado en su totalidad.**

---

## Bloques 7.35B y 7.35C — REVERTIDOS por decisión de producto (05/08/2026)

Los Bloques 7.35B y 7.35C (Visual Polish de Productos, segunda y tercera pasada) fueron **revertidos en su totalidad** por decisión explícita del usuario: los cambios no aportaban una mejora visual suficientemente significativa frente al riesgo de tocar componentes compartidos de todo el ERP. El diseño vuelve exactamente al estado aprobado en el **Bloque 7.35A** (análisis) / previo a 7.35B (implementación) — el mismo estado visual validado durante toda la serie de rediseño de Productos y replicado al resto del ERP.

**Archivos revertidos a su valor previo a 7.35B, uno por uno:**
- `src/index.css` (tema claro, `:root`): `--background` → `oklch(0.985 0.003 24)`; `--muted` → `oklch(0.955 0.004 24)`; `--muted-foreground` → `oklch(0.5 0 0)`; `--border`/`--input` → `oklch(0.9 0.004 24)`. Tema oscuro no fue tocado por 7.35B/7.35C, sigue igual.
- `src/components/ui/DataTable.tsx`: header de tabla `bg-muted/80` → `bg-muted/50` (las 3 apariciones).
- `src/components/common/KpiCard.tsx`: tonos de ícono `bg-brand/20 ring-brand/30` / `bg-success/20 ring-success/30` → `/10`/`/15` originales; valor `font-extrabold` → `font-bold`; variante `Card` (no-`bare`) `border-border/80` + sombra compuesta → `border-border/60` + `shadow-sm` originales.
- `src/components/common/PageHeader.tsx`: título `font-bold` → `font-semibold`.
- `src/features/products/pages/ProductsPage.tsx`: sombra del Workspace → `shadow-sm` plana; los 3 separadores internos (KPIs/Toolbar/paginación) → `border-border/70`.
- `src/features/products/components/ProductsKpiRow.tsx`: hover de las 4 celdas `hover:bg-brand/14` → `/5`.
- `src/features/products/components/ProductsTable.tsx`: header `text-foreground` → `text-foreground/90`; hover de fila `hover:bg-brand/12` → `/5`.
- `src/features/products/components/ProductFilters.tsx`: los 3 campos (buscador, Categoría, Impuesto) `border-border` → `border-transparent` original.

Comentarios de código que documentaban 7.35B/7.35C en estos 8 archivos también fueron eliminados junto con el revert, para no dejar referencias a un cambio que ya no existe.

**No se modificó ningún otro archivo** — el revert se limitó estrictamente a los 8 archivos listados arriba, sin tocar ningún otro módulo, componente, hook, endpoint ni lógica de negocio.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos, `npm run build` verde.

**Bloques 7.35B/7.35C — REVERTIDOS y CERRADOS (05/08/2026). El diseño visual del ERP queda congelado en el estado aprobado hasta el Bloque 7.35A — no se implementará ningún ajuste visual adicional salvo que se abra un bloque nuevo explícito. Con esto, el proyecto pasa a la etapa de QA integral de la versión 1.0.**

---

## FASES COMPLETADAS

| Sprint / Fase | Foco | Estado |
|---|---|---|
| Sprint 1 | Seguridad y datos | ✅ Completado |
| Sprint 3 | Navegación y módulos inaccesibles | ✅ Completado |
| Sprint 4 | Feedback de usuario y correcciones de datos | ✅ Completado |
| Sprint 5 | Hardening y deuda técnica | ✅ Completado (14 ítems: 9 resueltos, 2 sin acción requerida, 3 pendientes de decisión de producto — no defectos de código) |
| Sprint 6 | Activación de RBAC granular | ✅ Completado |
| Sprint 7 | Seguridad de tokens JWT (A-01/A-02) | ✅ Completado |
| Fase 11 | Confirmaciones de infraestructura + QA-005 a QA-008 (paginación de Productos/Compras, Notificaciones, referencia de pago, restauración del entorno) | ✅ Completado |
| Fase 12 | Sincronización QA3 (Sprint QA 3.7) | ✅ Completado |
| Fase 13 | Módulo de Historial de Mermas (consulta) | ✅ Completado |
| **Fase 14** | **Motor de Promociones y Descuentos (P.1–P.8), integración visual en el POS, QA integral, base de datos oficial de pruebas, corrección del límite de selectores de productos** | ✅ **Completado — APTO PARA PRODUCCIÓN** |
| **Fase 15** | **Commercial Pricing Engine (PROMO-01 a PROMO-12): modelo comercial de promociones (proveedor/origen/financiamiento), coordinador `PricingAnalysis`, integración real en Ventas, snapshot histórico inmutable, QA integral** | ✅ **Completado — APTO PARA PRODUCCIÓN** |
| **Fase 16** | **Módulo de Lotes (Batch Management, LOTES-00 a LOTES-09): trazabilidad completa, consumo FEFO, reportes, control por lotes en Productos, trazabilidad de recepción, QA integral** | ✅ **Completado — APTO PARA PRODUCCIÓN** |
| **Fase 17** | **`FIXED_PRICE` en Promociones (PROMO-13): precio fijo por unidad** | ✅ **Completado — APTO PARA PRODUCCIÓN** |
| **Fase 18** | **Rediseño UX/UI de Ventas, Caja, Roles y POS** (ver tabla de arriba) — cierra por completo el eje de rediseño visual del ERP | ✅ **Completado y aprobado** |
| Fase 19 (backend) | Hardening de seguridad (31/07/2026): migraciones reales de Prisma, `authorizePermission()` conectado en 29 archivos de rutas, rotación/revocación de refresh tokens (`RefreshToken` + `User.tokenVersion`), auditoría de eventos negativos (`LOGIN_FAILED`/`ACCESS_DENIED`), rate limiting por categoría (`auth`/`transactional`/`reports`/`administrative`) | ✅ Completado — numeración propia del backend, independiente del eje de negocio Fases 11–18 de este documento; detalle completo en `docs/AUDIT_REPORT.md` §15 del repositorio backend |

> El detalle técnico de las Fases 14–17 (motor de promociones, pricing comercial, lotes, `FIXED_PRICE`) no se repite acá — ver `docs/AUDITORIA_FASE10_INFORME_EJECUTIVO.md`, secciones 17 a 20, sin cambios respecto a la versión anterior de este documento. La "Fase 19" es una numeración interna y separada del propio `docs/AUDIT_REPORT.md` del backend (hardening de seguridad, no funcionalidad de negocio) — se referencia acá solo para que ambos repos queden cruzados; no se renumeran las Fases 11–18 de este documento para acomodarla.

---

## FACTURACIÓN ELECTRÓNICA — INTEGRACIÓN CON ALEGRA (Bloques 7.1–7.22) — ✅ CERRADO (04/08/2026, extendido 05/08/2026)

**Repositorio:** principalmente `carniceria-pos-backend`, con cambios de UI reales en este repo desde el Bloque 7.16 en adelante (ver tabla). El ERP emite comprobantes electrónicos reales, **aceptados por Hacienda**, a través de la API de [Alegra](https://developer.alegra.com/) (Costa Rica, v4.4) — **no** mediante firma/envío directo a Hacienda (esa vía nunca se implementó; el módulo `invoicing/` preexistente del backend queda como utilidad local de numeración/PDF/XML sin uso real). Alegra es, por decisión explícita del Bloque 7.1, el **único** motor de facturación electrónica del sistema. Toda la lógica de comunicación con Alegra vive en `src/modules/integrations/alegra/` del backend — ver `docs/ARCHITECTURE.md` §6.9, `docs/DATABASE.md` §3.9/§3.2 y `docs/API.md` (sección `/integrations/alegra`) de ese repositorio para el detalle técnico completo.

**Cambio de diseño importante a mitad de camino:** el diseño original (Bloque 7.11) emitía automáticamente al confirmar cada venta del POS. Tras usar el sistema en condiciones reales, el Bloque 7.17 **revirtió esa decisión**: el flujo del POS es ahora exclusivamente *venta → guardar local → imprimir ticket → fin*, sin ninguna llamada a Alegra en ese camino — la emisión pasó a ser una acción explícita, disparada por el usuario desde Ventas → Documentos.

| Bloque | Alcance | Estado |
|---|---|---|
| 7.1 | Análisis: arquitectura base de integración (dónde guardar credenciales, cliente HTTP, endpoint de validación) | ✅ Cerrado |
| 7.2 | Análisis funcional: mapeo ERP → Alegra (endpoint de factura, campos obligatorios de Costa Rica v4.4, dependencias previas) | ✅ Cerrado |
| 7.3 | Base de integración: módulo `integrations/alegra`, cliente HTTP único (`createAlegraClient`), Basic Auth, endpoint de prueba de conexión | ✅ Cerrado |
| 7.4 | Configuración persistente y cifrada (`AlegraConfig`, AES-256-GCM) + pantalla Configuración → Facturación Electrónica → Alegra | ✅ Cerrado |
| 7.5 | Resolución y vinculación automática del cliente genérico ("Cliente General") — busca, crea si no existe, nunca duplica | ✅ Cerrado |
| 7.6 | Vinculación permanente de productos con Alegra (por SKU/referencia, con nombre como respaldo) — mismo patrón que 7.5 | ✅ Cerrado |
| 7.7 | Emisión real de facturas electrónicas (mapeo venta → payload de Alegra, paymentMethod/saleCondition de Costa Rica) | ✅ Cerrado |
| 7.8 | Consulta de estado de una factura ya emitida — actualiza solo lo que cambia, nunca sobrescribe la clave electrónica ya guardada | ✅ Cerrado |
| 7.9 | Descarga de PDF de factura bajo demanda (nunca cacheado) | ✅ Cerrado |
| 7.10 | Descarga de XML de factura, mismo patrón exacto que el PDF (mismo repositorio/validación/errores/permisos) | ✅ Cerrado |
| 7.11 | *(Superado por 7.17)* Integración automática con el flujo del POS: `POST /sales` disparaba `emitInvoice()` sin bloquear la venta si Alegra fallaba | ✅ Cerrado, luego revertido |
| 7.12 | Campo `Product.cabysCode` (13 dígitos, catálogo oficial de Hacienda) — obligatorio en el formulario de Productos; enviado como `productKey` a Alegra | ✅ Cerrado |
| 7.13/7.14 | Investigación real: por qué Alegra rechazaba la emisión con identificación falsa de "Cliente General" — se determinó que el documento correcto es **Tiquete Electrónico**, no Factura Electrónica (el POS no identifica clientes reales) | ✅ Cerrado |
| 7.15 | Payload de impuestos (`tax`) por línea, resuelto dinámicamente contra `GET /taxes` de la cuenta real — primera emisión real aceptada por Hacienda | ✅ Cerrado |
| 7.16 | Botones "Ver factura"/"Ver XML" conectados en Ventas → Documentos (`SaleDetailContent.tsx`), usando los campos de Alegra ya expuestos en `SaleResponse` | ✅ Cerrado |
| 7.17 | **Se elimina la emisión automática** — el POS ya no llama a Alegra al confirmar una venta; se agrega `POST /integrations/alegra/sales/:saleId/emit` y el botón "Emitir comprobante electrónico" | ✅ Cerrado |
| 7.18 | Registro de pago en la misma llamada de emisión (`payments[]`) — sin esto, la factura quedaba "Por cobrar" en Alegra pese a ser una venta de contado ya cobrada | ✅ Cerrado |
| 7.19 | Elimina los IDs de cuenta de pago hardcodeados — se resuelven dinámicamente por `type` contra `GET /bank-accounts` de la cuenta real y se persisten (`AlegraConfig.cashAccountId`/`bankAccountId`) | ✅ Cerrado |
| 7.20 | Reenvío por correo (`POST /invoices/{id}/email` de Alegra) — botón "Reenviar" con diálogo propio (`SaleResendDialog.tsx`), sin almacenar el correo del destinatario | ✅ Cerrado |
| 7.21 | **Hallazgo real (05/08/2026):** un producto con `cabysCode` de formato válido (13 dígitos) pero inexistente en el catálogo real de Alegra causaba un `502` real al emitir — confirmado comparando contra el catálogo oficial que Alegra publica. Sin corrección de código: se corrige editando el producto con un CABYS real | ✅ Cerrado (hallazgo documentado, sin cambio de código) |
| 7.22 | **Reconciliación de una emisión con resultado incierto por timeout.** `ALEGRA_REQUEST_TIMEOUT_MS` (10s) venció una vez ante una respuesta real de 14.5s, dejando una venta indefinidamente "Pendiente" con riesgo real de doble emisión si se reintentaba. Campo nuevo `Sale.alegraEmissionUncertainAt`; `reconcileEmission()`/`findExistingInvoiceForSale()` reconcilian contra `GET /invoices` (filtro por `date`/`client_id`, comparación de `total`) tanto reactivamente (tras un timeout nuevo) como proactivamente (antes de un reintento) — nunca se puede crear una segunda factura sin antes intentar confirmar contra Alegra. De paso, `checkInvoiceStatus()` (Bloque 7.8) dejó de ser código huérfano: expuesta por primera vez vía `GET /integrations/alegra/sales/:saleId/status` | ✅ Cerrado |
| 7.23 | **Falso negativo real en la reconciliación del Bloque 7.22, encontrado sobre la propia venta usada para validarlo (`VTA-000053`).** La reconciliación *inmediata* (misma petición del timeout) corría ~2s después del aborto — sin margen real frente a la certificación asíncrona de Alegra (esa factura terminó de certificarse, con número/clave/PDF/correo reales, varios segundos *después*) — y al no encontrar nada todavía, limpiaba igual `Sale.alegraEmissionUncertainAt`, dejando la venta sin `alegraInvoiceId` y sin ningún camino de reconciliación futura: un reintento habría creado una segunda factura real duplicada. Corregido con el cambio mínimo: `reconcileEmission()` solo limpia la marca cuando "no encontrado" es una confirmación válida (reconciliación proactiva, en una petición posterior con tiempo real transcurrido) — nunca en la reconciliación inmediata de la misma petición del timeout | ✅ Cerrado |

**Validado con pruebas reales contra la cuenta de Alegra en producción** (no simuladas): primera factura electrónica real aceptada por Hacienda (Bloque 7.15), venta en efectivo y venta con tarjeta ambas cerradas con `status: closed`/`balance: 0` tras registrar el pago (Bloques 7.18/7.19), reenvío por correo real usando un comprobante ya existente sin generar uno nuevo (Bloque 7.20). Bloques 7.21/7.22 (05/08/2026) validados contra logs reales de una instalación Electron real (respuesta real de Alegra de 14.5s capturada en log) y contra el catálogo oficial de `productKey` que la documentación de Alegra publica. **Bloque 7.23 (05/08/2026) validado de extremo a extremo contra la aplicación de escritorio instalada real** (no localhost/desarrollo): build corregido desplegado en `resources/backend/dist` de la instalación real (con backup reversible), una única factura electrónica real autorizada (`VTA-000050`, sin riesgo de duplicado — nunca había llegado a `POST /invoices` en sus intentos previos) emitida sin timeout (5.2s) con `alegraInvoiceId`/`alegraInvoiceNumber`/clave electrónica/`status: "closed"` reales persistidos, más `GET /status`, `POST /email` (reenvío real) y `GET /invoice-xml` confirmados en `200` contra el log real — cero regresión en el flujo normal. El escenario de timeout no se forzó artificialmente (riesgo real sobre la cuenta fiscal, decisión explícita del usuario) — queda respaldado por la traza completa ya recolectada de `VTA-000053` más la revisión de código. Se revisó el resto del módulo (`resolveGenericClient`/`resolveCustomerAlegraId`/`resolveProductAlegraId`/`resolveAlegraAccountId`) sin encontrar el mismo patrón en ningún otro punto — ninguna de esas funciones persiste un estado "incierto"; ante un timeout en su propia creación, la búsqueda por coincidencia exacta que ya hacen en cada llamada las vuelve a encontrar solas en el siguiente intento (no son documentos fiscales, sin riesgo de duplicado real).

**Decisiones de diseño clave:**
- Credenciales cifradas en reposo (AES-256-GCM) — primer secreto reversible del backend (los dos precedentes previos, `passwordHash`/`RefreshToken.tokenHash`, son hash de una vía).
- Resolución de cliente/producto/cuentas de pago genéricos es **permanente**: se busca/crea una única vez, el ID se persiste, nunca se vuelve a tocar la red para eso — **sin ningún ID hardcodeado en el código** (Bloque 7.19 eliminó los dos últimos que quedaban).
- **La emisión es bajo demanda, no automática** (Bloque 7.17) — decisión de negocio final tras revertir el diseño original del Bloque 7.11: el POS nunca debe depender de un servicio externo para completar una venta.
- ~~Se emite como **Tiquete Electrónico**, no Factura Electrónica — el documento correcto para ventas de mostrador sin identificación real del cliente (Bloques 7.13/7.14).~~ — **SUPERADO (07/08/2026).** Tiquete Electrónico fue retirado por completo (decisión de negocio, ver sección dedicada más abajo, "INVESTIGACIÓN 402/907 Y ELIMINACIÓN DE TIQUETE ELECTRÓNICO"). Toda venta que se factura electrónicamente hoy usa **exclusivamente Factura Electrónica**, y exige un cliente identificado — ya no existe la rama de "Cliente General" en la emisión.
- Código CABYS obligatorio por producto (Bloque 7.12) — Hacienda lo exige por línea de factura; nunca se inventa un valor por defecto.
- PDF y XML nunca se cachean ni se persisten — se piden a Alegra en cada solicitud. El reenvío por correo opera sobre el comprobante ya emitido, sin re-timbrar ni volver a comunicar con Hacienda.
- Sin cola de trabajos ni reintento automático en ningún punto de este eje — un fallo de emisión requiere que el usuario vuelva a presionar el botón. La reconciliación del Bloque 7.22 no es una cola de reintentos: solo evita crear una segunda factura real cuando el resultado de un intento anterior quedó sin confirmar por un timeout.

**Deuda técnica pendiente de este eje:**
- ~~El desempate automático entre dos cuentas de Alegra del mismo tipo (Bloque 7.19, heurístico de nombre)...~~ — **OBSOLETO (07/08/2026).** `resolveAlegraAccountId()` y todo el mecanismo de resolución de cuenta de pago fueron eliminados junto con el campo `payments` (ver sección dedicada más abajo) — ya no hay ninguna cuenta bancaria/de caja que resolver ni desempatar.
- Productos creados antes del Bloque 7.12 no tienen `cabysCode` — no se pueden facturar hasta editarlos y cargar el código real. Un CABYS presente pero **inválido** (formato correcto, no perteneciente al catálogo real) también bloquea la emisión con un `502` — Bloque 7.21, sin corrección de código posible más allá de cargar el código real.
- **Mejora identificada durante la validación del Bloque 7.23, no implementada (reportada, no autorizada):** no existe hoy ningún mecanismo — job programado ni indicador visual distinto de "Pendiente" normal — que resuelva o siquiera señale una venta que quede indefinidamente con `Sale.alegraEmissionUncertainAt` activo si el usuario nunca vuelve a intentar la emisión (la reconciliación solo corre cuando alguien reintenta manualmente). Riesgo bajo (la reconciliación sigue evitando la doble emisión en cuanto se reintenta) pero deja una ventana operativa donde una venta puede quedar "atascada" sin que nadie lo note.
- ~~"Reenviar" no persiste ni recuerda el último correo usado — se pide en cada envío (el ERP no tiene módulo de clientes).~~ — **RESUELTO PARCIALMENTE (Bloque 8.4, 04/08/2026).** Cuando la venta tiene un cliente asociado con correo cargado, "Reenviar" usa automáticamente `Customer.email`, sin pedirlo a mano. Sigue pidiéndose manualmente para "Público General" o un cliente sin correo cargado — no hay memoria de "último correo usado" para ese caso, correcto: no hay dónde persistirlo sin inventar un campo nuevo fuera de alcance.
- **Nueva (07/08/2026):** toda venta a "Público General" (sin `customerId`) ya no puede emitir ningún comprobante electrónico — bloqueado explícitamente antes de llamar a Alegra (`ConflictError`). Es una decisión de negocio deliberada (ver sección siguiente), no un defecto — documentado acá para que quede visible junto al resto de la deuda/decisiones de este eje.
- La factura queda registrada en Alegra como **"Por cobrar"**, nunca "Pagada" — consecuencia directa de haber eliminado `payments` (ver sección siguiente). No hay ningún mecanismo, hoy, que concilie ese estado con el hecho de que la venta ya se cobró de contado en el POS — es un dato que solo vive en Alegra, visualmente distinto del histórico de facturas emitidas antes del 07/08/2026 (que sí quedaban "Pagadas").

---

## FACTURACIÓN ELECTRÓNICA — INVESTIGACIÓN 402/907 Y ELIMINACIÓN DE TIQUETE ELECTRÓNICO (07/08/2026) — ✅ CERRADO

**Repositorio:** exclusivamente `carniceria-pos-backend/src/modules/integrations/alegra/` (`alegra.service.ts`, `alegra.controller.ts`, `alegra.validation.ts`), con un cambio de UI en este repo (`SaleDetailContent.tsx`, `useSaleDocumentActions.ts`, `alegra.api.ts`) para retirar el botón de Tiquete Electrónico. Ningún otro módulo (Productos, Ventas, Compras, Reportes, Dashboard) fue tocado.

### Qué problemas encontramos

1. **`HTTP 402` / código `907` ("Esta acción no se puede realizar en tu plan actual")** al intentar emitir cualquier comprobante electrónico (Tiquete o Factura), reproducible de forma consistente contra la cuenta real, con cualquier venta.
2. **Después de resolver el punto 1, un segundo error real:** `422` propio del ERP ("La cuenta de Alegra tiene múltiples numeraciones electrónicas configuradas para Factura Electrónica") — la cuenta real tenía dos plantillas de Factura Electrónica simultáneas (`isElectronic: true`), una vieja y una nueva, y la resolución dinámica de plantilla no sabía distinguirlas.
3. Una hipótesis de regresión de código (sospecha inicial: "algo se rompió al separar Tiquete/Factura Electrónica") que consumió la mayor parte de la investigación antes de descartarse con evidencia.

### Causa real de cada uno

1. **El campo `payments` del payload de `POST /invoices`.** Confirmado directamente por soporte de Alegra: el plan de la cuenta ("Solo Facturación Pro") no incluye el módulo de Bancos, y `payments[].account.id` exige una cuenta de ese módulo — Alegra rechazaba la emisión completa con `402`/`907` por ese campo, sin importar que el resto del payload (cliente, ítems, impuestos, `numberTemplate`) fuera perfectamente válido.
2. **`GET /number-templates` devuelve también numeraciones desactivadas**, y el filtro de `resolveElectronicNumberTemplateId()` solo miraba `documentType`/`isElectronic` — insuficiente para distinguir la plantilla vigente de una vieja que la empresa dejó de usar pero nunca borró de Alegra. Confirmado con el JSON real de la cuenta: dos plantillas con `documentType: 'invoice'` e `isElectronic: true`, diferenciables únicamente por `status`/`isDefault`.
3. **No era una regresión de código.** Se comparó línea por línea el código actual contra una copia de respaldo real de cuando "sí emitía" (`D:\carniceria backup\...`, tres veces, incluyendo los 8 archivos completos de la integración) — el flujo de emisión resultó ser funcionalmente idéntico en ambas versiones. La causa real vivía enteramente del lado de la cuenta de Alegra (configuración de plan y de numeraciones), no en este repositorio.

### Cómo se resolvió

- **Punto 1:** se eliminó el campo `payments` del payload de `POST /invoices` por completo, junto con todo el código que existía únicamente para construirlo (`resolveAlegraAccountId()`, `PAYMENT_METHOD_TO_ACCOUNT_KIND`, `AlegraPaymentAccountKind` — los tres borrados, no dejados inertes). Nada más del payload cambió (`numberTemplate`, `stamp`, `items`, `client`, `paymentMethod`, `saleCondition` intactos).
- **Punto 2:** el filtro de `resolveElectronicNumberTemplateId()` pasó a exigir simultáneamente `documentType === 'invoice'`, `isElectronic === true`, `status === 'active'` **e** `isDefault === true` — la combinación de los cuatro campos identifica exactamente una sola plantilla en la cuenta real (confirmado con el JSON real, capturado con instrumentación temporal ya retirada). La validación defensiva que exige exactamente una coincidencia (ni cero ni más de una) se mantuvo sin cambios.
- **Punto 3:** se cerró por descarte, no por corrección — no había nada que arreglar en el código de resolución de recursos (`resolveCustomerAlegraId`/`resolveProductAlegraId`/`resolveAlegraTaxId`), confirmado con el diff real contra el backup.

### Decisiones que quedaron implementadas definitivamente

- **El ERP ya no soporta Tiquete Electrónico.** Decisión de negocio explícita (no una limitación técnica): toda emisión es Factura Electrónica, siempre. `emitInvoice()` ya no recibe `documentType` — firma simplificada a `emitInvoice(saleId)`. `EmitInvoiceSchema` (backend) fue eliminado por quedar sin uso. El botón "Emitir Tiquete Electrónico" fue retirado de `SaleDetailContent.tsx`; queda un único botón "Emitir Factura Electrónica".
- **Una venta sin cliente identificado ("Público General") no puede emitir ningún comprobante electrónico.** El guard `if (!sale.customerId) throw ConflictError(...)` es incondicional — antes dependía de qué tipo de comprobante se pedía, ahora aplica siempre, porque Factura Electrónica (la única opción que queda) exige identificación real por regla de Hacienda.
- **`numberTemplateId` se resuelve dinámicamente, siempre, sin ningún ID hardcodeado en ningún lugar del proyecto** (verificado con grep exhaustivo en ambos repos) — contra `GET /number-templates`, filtrando `documentType`/`isElectronic`/`status`/`isDefault` los cuatro a la vez. Si Alegra cambia cuál plantilla es la principal activa, la próxima emisión la va a detectar sola, sin necesidad de tocar código.
- **El payload de `POST /invoices` ya no incluye `payments`.** La factura queda "Por cobrar" en Alegra — consecuencia aceptada y documentada del plan actual de la cuenta, no un efecto colateral no buscado.
- **Toda la instrumentación temporal de diagnóstico usada durante la investigación fue retirada** de ambos repos (verificado con grep, cero coincidencias de `console.log`/`DIAGNÓSTICO`/tags `[ALEGRA-*-DIAG]`) — incluyendo un bloque de diagnóstico en `useSaleDocumentActions.ts` que llevaba desde antes de esta investigación.

### Qué quedó descartado durante la investigación

- **Reconstruir la integración desde cero.** Se llegó a plantear un plan completo de reescritura (análisis de arquitectura ideal, separación en `createDraftInvoice`/`stampInvoice` en dos fases según el endpoint oficial `POST /invoices/stamp`) — nunca se implementó, porque la causa real (`payments`) se confirmó antes de empezar esa reconstrucción y la hacía innecesaria.
- **El enfoque de "crear en dos fases" (`POST /invoices` sin `stamp` + `POST /invoices/stamp` después).** Investigado contra la documentación oficial — es un endpoint real, pero pensado para timbrado en lote de facturas ya existentes (hasta 10), no como "la forma correcta" de una emisión individual. La documentación no aporta evidencia de que hubiera resuelto el `402`/`907` (la causa real era `payments`, presente en ambos enfoques).
- **La hipótesis de que el problema era el `numberTemplate.id` hardcodeado.** Se corrigió igual (buena práctica, ya no depende de IDs fijos) pero **no era la causa del `402`/`907`** — se probó en vivo con el ID real y verificado y el error persistió idéntico hasta remover `payments`.
- **La hipótesis de "cuenta en plan Consulta" (suscripción vencida).** Investigada contra la documentación pública de Alegra por ser la explicación genérica más común del código `907` — descartada como causa real una vez que soporte confirmó la causa puntual (módulo de Bancos).

### Estado final de la integración

**Código corregido y validado con evidencia real, por partes — sin una confirmación end-to-end final dentro de esta sesión que combine los dos fixes a la vez.** Lo que sí está confirmado con evidencia real:
- El fix de `payments` (causa del `402`/`907`) fue confirmado como resuelto por el usuario, probando en vivo contra la cuenta real, antes de pasar al siguiente bloque.
- El fix del filtro de 4 campos de `numberTemplate` fue construido y validado contra el JSON real de `GET /number-templates` de la cuenta (confirmado que selecciona exactamente una plantilla, la vigente).
- `tsc`/`eslint`/`build` limpios con el código final combinado (ambos fixes juntos).

Lo que **no** está confirmado dentro de esta sesión: una emisión real de `POST /invoices` con el código final combinado (sin `payments`, con el filtro de 4 campos) devolviendo `200`/factura timbrada real. Cada fix se probó en vivo por separado, en momentos distintos de la investigación — no hay un log de una emisión exitosa con ambos ya integrados. **Recomendado como próximo paso real, no asumido como ya hecho.**

### Pendientes conocidos

- **Confirmar con una emisión real, end-to-end, el código final combinado** (`payments` removido + filtro de 4 campos) — ver nota de "Estado final" arriba. Es la validación que falta para poder decir con evidencia, no solo con lógica, que la integración está cerrada.
- **La factura queda "Por cobrar" en Alegra, nunca "Pagada"** — consecuencia aceptada de no poder enviar `payments` con el plan actual. Si la cuenta cambia de plan y agrega el módulo de Bancos, reintroducir `payments` sería la única forma de revertir esto (no implementado, no solicitado).
- **Cambios sin commitear en `carniceria-pos-backend`.** Investigación de git aparte (07/08/2026) confirmó que el repositorio no recibe commits desde el 26/07/2026 — toda la integración de Alegra (y buena parte del resto del ERP) existe únicamente en el working tree, sin ningún commit. No es un problema de configuración de git, es que no se commiteó. Pendiente una decisión explícita de cómo escopar ese commit (no se ejecutó `git add`/`commit` durante esta investigación, a pedido explícito).
- **`resolveGenericClient`/`findGenericClient`/`createGenericClient`/`ALEGRA_GENERIC_CLIENT_NAME`/`AlegraGenericClientResult`** quedan como código sin ningún llamador real desde que se retiró la rama de "Cliente General" — identificados con evidencia (análisis arquitectónico previo a esta investigación) pero **no eliminados todavía**, pendiente de una pasada de limpieza explícitamente aprobada.
- **`AlegraConfig.genericClientId`/`cashAccountId`/`bankAccountId`** (columnas de base de datos) en la misma situación — sin ningún código que las lea o escriba desde hoy (`genericClientId` desde el retiro de "Cliente General"; `cashAccountId`/`bankAccountId` desde la eliminación de `payments`), requieren una migración de Prisma para eliminarlas, no ejecutada.

---

## LIMPIEZA DE DATOS DEMO — NUEVO ESQUEMA DE SEEDS (07/08/2026) — ✅ CERRADO

**Repositorio:** exclusivamente `carniceria-pos-backend/prisma/` (`seed.ts`, `seed-demo.ts` nuevo, `seedShared.ts` nuevo, `package.json`). Sin cambios de esquema (`schema.prisma` intacto, sin migraciones nuevas de este bloque) ni de lógica de negocio de ningún módulo.

### Problema

Toda instalación nueva real (incluida la del Desktop, vía `isFreshInstall`) ejecutaba `prisma/seed.ts` completo, que en un mismo script mezclaba dos cosas muy distintas: (1) el bootstrap real del sistema (Sucursal, Roles/Permisos, Usuario admin, Configuración) — necesario siempre — y (2) un dataset de demostración completo (6 proveedores, 80 productos reales de carnicería con inventario alto, 6 promociones), sembrado de forma **destructiva** (`resetCatalogData()` borraba Ventas/Compras/Cajas/Devoluciones/etc. existentes en cada corrida). Resultado: cualquier instalación nueva, real o de desarrollo, arrancaba con datos de prueba en vez de una base limpia — nunca pensada para producción.

### Causa

Decisión de diseño original (no un bug): un solo script hacía las dos cosas para simplificar el `onboarding` de desarrollo, sin distinguir "instalación real" de "entorno de prueba".

### Resolución

- **`prisma/seed.ts`** — recortado a solo el bootstrap no-destructivo + catálogo base (8 categorías, 2 impuestos). Cero `deleteMany()`. Es lo que corre automáticamente en una instalación nueva real.
- **`prisma/seed-demo.ts`** (nuevo) — todo el "Paso 2" original, movido **sin cambiar una línea de su contenido ni de su lógica**: `resetCatalogData()`, 6 proveedores, los 80 productos reales + inventario, 6 promociones. Exclusivamente manual (`npm run prisma:seed:demo`), nunca conectado al instalador.
- **`prisma/seedShared.ts`** (nuevo) — `seedCategories()`/`seedTaxes()` extraídas a un módulo sin auto-ejecución, porque `seed.ts` y `seed-demo.ts` son cada uno auto-ejecutables al importarse (no pueden importarse entre sí) y ambos necesitan estas dos funciones.
- **`package.json`** — nuevo script `"prisma:seed:demo": "tsx prisma/seed-demo.ts"`.

### Validado con evidencia real

- `npm run prisma:seed` corrido contra la base de desarrollo real: bootstrap + 8 categorías + 2 impuestos sembrados, cero productos/proveedores/promociones creados (confirmado por conteo antes/después).
- **Reset completo de la base de desarrollo** (`prisma migrate reset --force`, consentimiento explícito del usuario capturado según el propio guardrail de seguridad de Prisma para agentes de IA — el comando se niega a correr sin una confirmación textual fresca): drop + recreate del esquema, ~40 migraciones reaplicadas, `seed.ts` corrido automáticamente al final.
- `import-cabys-bootstrap.ts` (script ya existente, el mismo que usa el Desktop en cada arranque) corrido manualmente una vez después del reset, para dejar el catálogo CABYS real cargado (20.506 códigos oficiales del BCCR) — no es parte de `seed.ts` ni de `migrate reset`, es intencional que quede separado (ver Arquitectura más abajo).
- **Verificación de sanidad post-reset, con evidencia real de API, no solo de base de datos:** backend (`GET /health`) y frontend, ambos ya corriendo, respondieron `200`; login real con el usuario admin sembrado devolvió token + 47 permisos; conteos reales por API confirmaron `products/suppliers/promotions/inventory/purchases/sales/cashMovements/cashSessions/saleReturns/batches/inventoryMovements/inventoryWaste/documentSequences/customers` en `0` y `configurations: 3`/`roles: 3`/`permissions: 47`/`users: 1`/`categories: 8`/`taxes: 2`/`cabys: 20506`; creación manual real de una categoría, un impuesto y un producto de prueba, los tres persistidos y confirmados con un `GET` posterior (de paso, esto reconfirmó que la validación CABYS↔Impuesto sigue activa: rechazó un impuesto no coincidente antes de aceptar uno correcto). `tsc`/`eslint`/`build` limpios en los tres repos (backend/frontend/desktop), con solo warnings preexistentes y no relacionados (documentados como tales, no nuevos).
- Los 3 registros de prueba (`ZZ_TEST_CATEGORY`, `ZZTEST`, `ZZ-TEST-001`) fueron eliminados después, vía la API real (`DELETE`, no SQL manual) — igual que dos registros adicionales creados por el usuario en paralelo durante la verificación (un producto y un proveedor reales de prueba), con autorización explícita para borrarlos.

### Decisiones que quedaron implementadas definitivamente

- **Una instalación nueva (real o de desarrollo) ya no recibe datos de demostración automáticamente.** Solo bootstrap + catálogo base.
- **El dataset de demostración (80 productos reales) no se perdió** — sigue disponible completo, sin cambios, vía `npm run prisma:seed:demo`, para desarrollo/QA.
- **El catálogo CABYS real permanece fuera de `seed.ts`/`seed-demo.ts`**, a propósito — lo puebla `prisma/import-cabys-bootstrap.ts` (ya existente, sin cambios), que en el Desktop corre automáticamente en cada arranque, y que en un backend suelto (sin Electron) hay que correr manualmente una vez.

### Estado final

Base de desarrollo (`localhost:5432/carniceria_pos`) reconstruida desde cero y verificada con evidencia real: exactamente el estado de una instalación nueva de producción — bootstrap + catálogo base + CABYS real, cero datos operativos. `carniceria-pos-desktop` no requirió ningún cambio propio: ya apuntaba a `seed.ts`, que ahora es no-destructivo por definición.

### Pendientes conocidos

- **Instalaciones de Desktop ya existentes** (con `isFreshInstall: false`) no se benefician de este cambio retroactivamente — su base ya tiene, o no, el dataset viejo según cuándo se instalaron; este fix solo cambia el comportamiento de instalaciones **nuevas** a partir de hoy. No hay, ni se pidió, una migración de limpieza para instalaciones existentes.
- Mismo pendiente de git sin commitear que el resto de la sesión (ver sección anterior) — estos archivos nuevos (`seed-demo.ts`, `seedShared.ts`) tampoco están commiteados.

---

## MÓDULO DE CLIENTES — INTEGRACIÓN CON VENTAS Y FACTURACIÓN ELECTRÓNICA (Bloques 8.1–8.5) — ✅ CERRADO (04/08/2026)

**Repositorios:** ambos (`carniceria-pos-backend` y este repo). Objetivo: agregar clientes identificados al ERP y conectarlos con Ventas, el POS y la Facturación Electrónica ya existente (Bloques 7.1–7.20), sin duplicar lógica ni reabrir el diseño ya aprobado del POS. Ver `docs/ARCHITECTURE.md` §6.10, `docs/DATABASE.md` §3.2/§3.5/§3.9 y `docs/API.md` (sección `/customers`) del repositorio backend para el detalle técnico completo.

| Bloque | Alcance | Estado |
|---|---|---|
| 8.1 | Análisis y diseño: modelo funcional, identificación (CF/CJ/DIMEX/NITE/PE, catálogo real de Hacienda), estrategia de integración con POS/Facturación/Reenvío, riesgos | ✅ Cerrado (solo análisis) |
| 8.2 | Modelo `Customer` + migración + CRUD completo + validaciones + permisos + endpoints + pantalla de administración + `/customers/lookup`. ERP de una sola sucursal (sin `sucursalId`). Unicidad sobre `(identificationType, identificationNumber)`. Preferencia de comprobante por cliente (AUTO/FACTURA/TIQUETE) evaluada y **descartada** por agregar alcance sin necesidad real — documentada como deuda técnica no implementada | ✅ Cerrado |
| 8.3 | Integración con el POS: selector de cliente en el header (`PosHeader.tsx`), diálogo de búsqueda propio (`CustomerSearchDialog.tsx`, no el `SearchPickerPanel` compartido — ese componente fuerza un botón "Crear nuevo" fuera de alcance), "Público General" como valor por defecto, `customerId` enviado en `POST /sales`. Bug encontrado y corregido dentro del mismo bloque: `correctSale()` no preservaba el `customerId` original al corregir una venta | ✅ Cerrado |
| 8.4 | Integración con Facturación Electrónica: `customerId` nulo → Tiquete Electrónico (comportamiento idéntico al de antes); `customerId` presente → **Factura Electrónica** a nombre del cliente real, resolviendo/creando su contacto en Alegra una sola vez (`resolveCustomerAlegraId`, mismo patrón que productos, `Customer.alegraContactId`). "Reenviar" usa automáticamente el correo del cliente cuando existe. **Sin ninguna llamada de escritura real contra la cuenta de Alegra durante la validación** (restricción explícita del usuario, respetada) — validado con pruebas de solo lectura contra comprobantes ya existentes | ✅ Cerrado |
| Draft vs. emisión directa | Análisis puro (sin código): por qué los comprobantes dejaron de quedar en "Borrador" y se emiten directamente; se confirmó que es consecuencia deliberada del diseño ya aprobado (`stamp: generateStamp: true` en el Bloque 7.x), no un efecto colateral. Recomendación entregada: mantener la emisión directa bajo demanda; un `ConfirmDialog` de seguridad quedó propuesto pero **no implementado**, fuera del alcance del Bloque 8.5 | ✅ Cerrado (análisis, sin cambios de código) |
| 8.5 (fix XML) | Corrección de un bug real: `downloadInvoiceFile()` reutilizaba el cliente HTTP autenticado de Alegra para descargar una URL prefirmada de S3 (con su propia autenticación en la query string) — Axios adjuntaba el `Authorization` de Alegra a esa URL también, y S3 lo rechazaba (`400`, "Only one auth mechanism allowed"). Corregido con una descarga sin credenciales para ese paso específico. "Ver factura" (PDF) sin cambios; "Ver XML" confirmado funcionando contra un comprobante real ya emitido | ✅ Cerrado |
| 8.5 (QA Clientes×Ventas) | Ronda de QA integral del flujo de Clientes dentro de Ventas: revisión del POS, selector, creación de ventas, historial/detalle/corrección/impresión/documentos, casos límite (cliente inactivo, cliente eliminado, "Público General", cliente asociado, `customerId` inexistente). **Un bug real encontrado y corregido:** "ventas suspendidas" del POS (función solo de UI, sin persistencia en backend) no conservaba el cliente seleccionado al reanudar — el resto de los casos revisados ya se comportaban correctamente (incluido cliente eliminado, validado empíricamente con datos de prueba reales: una venta ya creada sigue mostrando el cliente aunque este se elimine después) | ✅ Cerrado |

**Decisiones de diseño clave:**
- ERP de una sola sucursal → `Customer` es global, sin lógica por sucursal (decisión explícita del Bloque 8.1, más simple que el resto del catálogo compartido).
- Unicidad sobre `(identificationType, identificationNumber)`, no solo el número — dos tipos de identificación distintos pueden coincidir en el número.
- "Público General" sigue siendo el valor por defecto en todo el sistema — el módulo de Clientes es aditivo, nunca lo reemplaza.
- El selector de clientes del POS se integró **sobre** las decisiones ya cerradas del rediseño del POS (ver "POS-specific decisions" en `CLAUDE.md`), sin reabrir su diseño visual/estructural.
- Mismo patrón "resolver una vez, persistir para siempre" que productos/cliente genérico/cuentas de pago (Bloques 7.5/7.6/7.19) aplicado ahora a clientes reales (Bloque 8.4).
- Ninguna prueba de este eje generó un comprobante electrónico real nuevo ni creó un contacto real en Alegra — toda la validación de Facturación Electrónica fue de solo lectura contra comprobantes/contactos ya existentes, por restricción explícita del usuario.

**Deuda técnica pendiente de este eje:**
- Preferencia de comprobante por cliente (AUTO/FACTURA/TIQUETE) — evaluada y descartada en el Bloque 8.2 por agregar alcance sin necesidad real; hoy el tipo de comprobante depende únicamente de si la venta tiene `customerId` o no.
- Creación rápida de cliente desde el POS — fuera de alcance en todos los bloques de esta serie (8.2/8.3/8.4/8.5), no implementada.
- La "ronda de QA controlada" con operaciones de escritura reales contra Alegra (crear un contacto real, emitir una Factura Electrónica real) sigue **pendiente de autorización explícita del usuario** — no se ejecutó en ningún bloque de esta serie.

---

## FASES EN PROGRESO

Ninguna. El eje de rediseño UX/UI y las fases de funcionalidad de negocio auditadas están cerrados. Lo que queda es exclusivamente lo listado en "ROADMAP OFICIAL HACIA 1.0" más abajo.

---

## QA INTEGRAL POR MÓDULOS (QA.1–QA.16B) — ✅ CERRADO (05/08/2026)

Revisión exhaustiva módulo por módulo de todo el ERP (backend + frontend), ejecutada como una secuencia de bloques — cada uno: revisión de código, reproducción empírica antes de corregir, corrección mínima del hallazgo real, validación (`tsc`/`eslint`/build), sin refactors ni cambios fuera de alcance. QA.1–QA.6 cubrieron Productos, Categorías, Inventario, POS, Compras y Caja sin dejar hallazgos críticos abiertos (consistente con el "Sprint de Pulido Integral" ya cerrado sin ítems, ver arriba). Desde QA.7, bugs reales encontrados y corregidos:

| Bloque | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| QA.7 | Proveedores | Error `P2002` (constraint único) sobre `legalId` de un proveedor soft-eliminado no se traducía a un mensaje claro | `translateUniqueConstraintError()` en `suppliers/service.ts` |
| QA.8 | Impuestos | Mismo patrón, sobre `code` | Mismo patrón en `taxes.service.ts` |
| QA.9 | Promociones | Comparación de rango de fechas de vigencia usaba instantes UTC crudos en vez de fecha calendario de Costa Rica — una promoción podía aparecer activa/inactiva hasta ~18h antes/después de lo esperado | `promotionEngine/conditions.ts`, comparación por fecha calendario CR |
| QA.10 | Usuarios | Un usuario podía desactivar su propia cuenta llamando la API directo (el frontend ya lo bloqueaba, el backend no) | Guard en `users.service.ts::changeStatus()` |
| QA.11 | Roles | Un rol de sistema (`ADMIN`/`MANAGER`/`CASHIER`) podía renombrarse, bypasseando en silencio dos salvaguardas de seguridad que comparaban por nombre literal — permitía escalamiento de privilegios | Guard en `roles.service.ts::update()` — ver también "DEUDA TÉCNICA DE ARQUITECTURA" abajo (limitación de fondo para roles personalizados, no resuelta) |
| QA.12 | Permisos | El `code` de un permiso podía modificarse después de creado, rompiendo cualquier verificación (`authorizePermission('code')`) ya escrita contra el código original | Guard en `permissions.service.ts::update()` |
| QA.13 | Reportes | Mismo bug de zona horaria que QA.9, versión más severa y sistémica: `buildDateRange()` afectaba todos los reportes filtrados por fecha | `reports.repository.ts`, mismo patrón de fecha calendario CR |
| QA.14 | Dashboard | Mismo bug de zona horaria en el KPI "Ventas de hoy" | `DashboardPage.tsx`, cálculo de fecha "hoy" vía `Intl.DateTimeFormat` con timezone CR |
| QA.15 | Configuración | Errores de mutación mostraban el mensaje crudo de Axios en vez de uno traducido; botones de gestión visibles sin el permiso correspondiente | Nuevo `settingsErrors.ts` + gating con `<Can>` |
| QA.16A | Prueba de estrés operativa (integración real, no solo revisión de código) | (1) Una merma sobre un producto con lote sin `batchId` desincronizaba `Inventory.quantity` y `Batch.availableQuantity` en silencio. (2) `emitInvoice()` (Alegra) no tenía protección contra reemitir una venta ya facturada — un error operativo durante la propia prueba llegó a emitir un comprobante electrónico real duplicado contra la cuenta de producción | (1) Guard en `inventoryWaste/service.ts` exigiendo `batchId` cuando el producto lo requiere. (2) Guard en `alegra.service.ts::emitInvoice()` — `409 CONFLICT` si `Sale.alegraInvoiceId` ya existe, antes de cualquier llamada a Alegra |
| QA.16B | Validación final y regresión completa | Ninguno nuevo — confirma que ninguna corrección de QA.7–QA.16A rompió otra funcionalidad | Sin cambios de código; solo documentación (ver deuda técnica registrada durante este bloque, abajo) |

**Veredicto final de QA.16B:** el ERP está listo para producción. No quedó ningún hallazgo crítico pendiente que impida liberarlo — la deuda técnica documentada (`checkInvoiceStatus()` huérfano, falta de validación UUID en `:id`, ver sección dedicada abajo) es de robustez, no bloqueante, y ninguno de los dos puede causar corrupción de datos ni pérdida de una venta/pago real en uso normal. Único punto pendiente de decisión de negocio (no técnico): la factura duplicada real emitida durante el incidente de QA.16A.

---

## AUDITORÍA DE ELECTRON PARA PRODUCCIÓN (QA.APP.1–QA.APP.6) — ✅ CERRADO (05/08/2026) — Release Candidate

**Repositorio:** `carniceria-pos-desktop` — ver su `README.md`, secciones "QA.APP.1–QA.APP.4", "QA.APP.5" y "QA.APP.6", para el detalle técnico completo (causa raíz, corrección exacta, evidencia de validación de cada bloque). Con el ERP ya cerrado (QA.1–QA.16B, arriba) y los Bloques 1–6.2 de Electron (instalador, persistencia, tema, actualizaciones, publicación a R2) ya dados por cerrados el 03/08/2026, se auditó la aplicación de escritorio específicamente para producción — sesión/autenticación, configuración de producción del backend empaquetado, estabilidad del ciclo de vida completo, el mecanismo de actualización automática, la integridad del propio proceso de publicación (QA.APP.5), y la sincronización de datos de sistema en actualizaciones (QA.APP.6) — en bloques secuenciales (análisis → aprobación → implementación mínima → validación contra un `.exe` empaquetado real o contra la base de datos real de una instalación existente, nunca solo revisión de código).

| Bloque | Foco | Bug real encontrado | Severidad |
|---|---|---|---|
| QA.APP.1 | Sesión/autenticación en Electron | La cookie de refresh se emitía con `sameSite: 'lax'` — funciona en localhost (mismo "site") pero nunca en Electron (`app://bundle` vs `http://127.0.0.1:*`, sitios distintos de verdad) — la sesión se perdía tras cualquier expiración del access token, no solo tras inactividad, y también en cada reinicio de la app | 🔴 Crítico |
| QA.APP.2 | Configuración de producción del backend empaquetado | El backend corría permanentemente en postura de desarrollo dentro de Electron (`NODE_ENV=development`/`CORS_ORIGIN=*` forzados siempre) — rate limit de login relajado (1000 vs 5 intentos/15min), detalle de errores expuesto, logging de cada query de Prisma. **Hallazgo colateral, bloqueante:** validando este fix se descubrió que a ninguna instalación empaquetada real se le inyectaba `INTEGRATIONS_ENCRYPTION_KEY` (requerida sin default desde la integración con Alegra) — **ninguna instalación empaquetada podía arrancar el backend en absoluto**, enmascarado hasta entonces por el modo desarrollo de ese repo | 🔴 Crítico (+ hallazgo colateral bloqueante) |
| QA.APP.3 | Estabilidad del ciclo de vida completo | Fuga de listeners en el singleton de `electron-updater` — cada "Reintentar" desde Modo Mantenimiento sumaba 4 listeners más sin quitar los anteriores, confirmado con evidencia real (1→2→3→4 disparos de un mismo evento) | 🟡 Medio |
| QA.APP.4 | Validación final + mecanismo de actualización automática | **Incidente real ocurrido durante la propia validación:** el relanzamiento automático tras aplicar una actualización no hereda overrides de entorno, volvió a apuntar al feed real de producción, y aplicó sola una versión anterior a la recién instalada — downgrade automático sin ningún guard | 🔴 Crítico (incidente real, sin pérdida de datos) |
| QA.APP.5 | Encontrado por el usuario ya usando la 0.1.4 real (post QA.APP.4) | La versión 0.1.4 se publicó con `carniceria-pos-front/dist` desactualizado por horas (compilado antes del Módulo de Clientes y del botón "Emitir comprobante electrónico") — el detalle de una venta sin comprobante mostraba directamente "Ver factura"/"Ver XML"/"Reenviar", como si ya estuviera emitido. Causa raíz: `prepare-package-resources.js` solo copiaba los `dist/` existentes, nunca los reconstruía ni verificaba su antigüedad | 🔴 Crítico (bug de empaquetado, no de lógica) |
| QA.APP.6 | Encontrado por el usuario usando una instalación real ya actualizada varias veces (0.1.4→0.1.5→0.1.6) | `GET /customers/lookup` devolvía `403` y "Clientes" no aparecía en el menú, incluso para `admin` — causa raíz demostrada con evidencia real contra la base de esa instalación: `Permission`/`Role`/`RolePermission` solo se sembraban una vez (`initdb` original de esa instalación, fechado ANTES de que existiera el Módulo de Clientes); ningún permiso agregado al catálogo después de ese momento llegaba nunca a esa base en ninguna actualización posterior, porque solo el esquema (`migrate deploy`) se sincroniza en cada arranque — los datos de permisos/roles quedaban congelados. Backend: nuevo `prisma/permissionsBootstrap.ts`/`seed-permissions.ts` (bootstrap 100% idempotente, sin tocar `Sucursal`/`User`/`Configuration`/catálogo de negocio); Electron: `runPermissionsBootstrap()` corre en cada arranque normal (no solo fresco) | 🔴 Crítico (afecta a toda instalación ya actualizada, no solo Clientes) |

**Los seis corregidos** con el cambio mínimo necesario en cada caso (cookie `SameSite=None`/`Secure` desacoplada de `isProduction`; `NODE_ENV`/`CORS_ORIGIN` condicionados a `app.isPackaged` + `INTEGRATIONS_ENCRYPTION_KEY` agregada a `app-secrets.ts`; `autoUpdater.removeAllListeners()`; `autoUpdater.allowDowngrade = false`; `prepare-package-resources.js` reconstruye backend y frontend siempre, antes de copiarlos; bootstrap de permisos separado del seed completo y corrido en cada arranque normal), y **revalidados contra un `.exe`/instalación real empaquetada o contra la base de datos real de la instalación afectada** en cada bloque — nunca solo revisión de código; QA.APP.5 además se revalidó publicando una versión real (0.1.5) al bucket de producción, y QA.APP.6 se validó corriendo el bootstrap nuevo contra la base real de la instalación reportada, confirmando conteos de datos de negocio idénticos antes/después. QA.APP.3 además auditó activamente memory leaks, listeners/timers duplicados, procesos huérfanos y condiciones de carrera entre Electron y el backend; los hallazgos que no eran bugs reproducibles a través del uso normal quedaron documentados como deuda técnica, no corregidos (ver sección dedicada inmediatamente abajo).

**Veredicto final (QA.APP.6):** la aplicación Electron queda lista para producción — **Release Candidate**. Los cuatro pilares auditados en QA.APP.1–4 (sesión estable, postura de producción real del backend, estabilidad del ciclo de vida, actualización segura contra downgrade), la integridad del propio proceso de publicación (QA.APP.5), y la sincronización de datos de sistema (permisos/roles) en actualizaciones (QA.APP.6) están confirmados con evidencia empírica real. Única salvedad operativa, no de código: al publicar una versión real con `npm run publish`, el número tiene que ser estrictamente mayor al ya publicado en el feed (`allowDowngrade = false` lo exige) — ver `README.md` de `carniceria-pos-desktop` para el procedimiento exacto de publicación. La versión real actualmente publicada en producción es **0.1.7**.

---

## QA FINAL 1.0 — Bloque 1: Login, Dashboard, Usuarios — ✅ IMPLEMENTADO (05/08/2026)

Primer bloque del QA final previo al Release 1.0 (distinto de QA.1–QA.16B, ya cerrado arriba: ese fue el QA integral por módulos durante el rediseño; este QA final revisa cada módulo una última vez, exclusivamente en el frontend, específicamente enfocado en produccionalizar — funcional, UX, permisos, formularios, estados vacíos/carga, accesibilidad básica — corrigiendo en el momento cualquier bug pequeño y localizado encontrado, sin refactors ni cambios de arquitectura). Revisión de código exhaustiva (sin prueba en navegador, a pedido explícito del usuario en este bloque) de los 3 módulos y sus archivos completos (`features/auth/`, `pages/DashboardPage.tsx` + `features/reports/components/Dashboard*.tsx`, `features/users/`, más `routes/index.tsx` en la parte que les aplica).

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Login | 🔧 Bug encontrado y corregido | Ninguno bloqueante — 1 ajuste de UX indirecto (ver Usuarios, comparten `getAuthErrorMessage`) |
| Dashboard | 🔧 3 bugs encontrados y corregidos | Ver tabla abajo |
| Usuarios | 🔧 3 bugs encontrados y corregidos | Ver tabla abajo |

**Bugs reales encontrados y corregidos en este bloque:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Usuarios | `/users/new` y `/users/:id/edit` eran alcanzables por URL directa sin el permiso `users.manage` — a diferencia de `/users`, que ya usa `RequirePermission`, esas dos rutas solo tenían `ProtectedRoute` (requiere sesión, no permiso). Un usuario autenticado sin ese permiso podía llegar al formulario completo (aunque el backend rechazaría el submit) | `routes/index.tsx`: se envuelven ambas rutas en `RequirePermission permission={PERMISSIONS.USERS_MANAGE}`, mismo patrón ya usado por `/users`, `/roles` y `/permissions` |
| 2 | Usuarios | Dos colores hardcodeados (`emerald-500`/`emerald-600`, Tailwind literal) en el botón "Activar" de `UsersTable.tsx` y `UserDrawer.tsx` — viola la regla del proyecto de "solo tokens del Design System" (`--success` ya existe y se usa para el mismo caso en `KpiCard`/`ProductsKpiRow`) | `UsersTable.tsx`/`UserDrawer.tsx`: `emerald-500`/`emerald-600` → `success` (token) |
| 3 | Usuarios | En edición, al pulsar "Cambiar contraseña" no había forma de volver atrás sin recargar la página — el campo quedaba obligatorio (`updateUserSchema.password` rechaza una cadena vacía) y bloqueaba el guardado de cualquier otro cambio del formulario hasta escribir una contraseña válida | `UserForm.tsx`: nuevo botón "Cancelar cambio de contraseña" que llama a `unregister('password')` (RHF) y colapsa la sección — el campo vuelve exactamente al estado "nunca tocado" que ya tenía por defecto, sin cambiar el esquema ni el DTO |
| 4 | Dashboard | El tono del KPI "Alertas activas" quedaba invertido: `'muted'` (gris, discreto) cuando SÍ había alertas críticas, `'brand'` (color de marca) cuando NO había ninguna — lo opuesto a lo que el color debería comunicar | `DashboardTodayKpis.tsx`: se invierte la condición (`brand` con críticas, `muted` sin ellas) |
| 5 | Dashboard | Color hardcodeado (`amber-600`, Tailwind literal) en el panel "Bajo stock" — mismo tipo de violación que el hallazgo #2, con el token correcto (`--accent-amber`) ya disponible y usado en el resto del ERP para advertencias | `DashboardLowStockPanel.tsx`: `amber-600` → `accent-amber` (2 apariciones) |
| 6 | Dashboard | El panel "Promociones activas" mostraba el descuento de tipo `FIXED_AMOUNT` como un número crudo sin formato de moneda ("Descuento fijo de 5000" en vez de "₡5.000,00") — inconsistente con el resto del ERP, que siempre usa `formatCurrency`, y con el mismo cálculo ya correcto en `promotionNarrative.ts` | `DashboardPromotionsPanel.tsx`: `describeEffect()` ahora usa `formatCurrency(promotion.effectValue ?? 0)` |
| 7 | Dashboard | Copy menor: el estado vacío de "Actividad reciente" decía "...registrados **hoy**", pero para la vista de Administrador esos datos no están filtrados por fecha (son las ventas más recientes de cualquier momento, no solo de hoy) — el mensaje podía ser técnicamente inexacto | `DashboardRecentActivity.tsx`: se quita "hoy" del texto |

**Sin hallazgos adicionales, revisado y confirmado correcto:** flujo de login (`useLogin`, redirección post-login del Bloque 7.32, `LoginForm.tsx`, `loginSchema`), `LockScreen.tsx` (bloqueo por inactividad), refresh-token silencioso y su gating contra un flash-redirect a `/login` (`App.tsx::isInitializing`), `ProtectedRoute`/`RequirePermission`, CRUD completo de Usuarios (crear/editar/activar-desactivar, con confirmación), validaciones de formulario (`user.schema.ts`, réplica exacta del backend), manejo de errores 409/403/400/404 (`userErrors.ts`, ya traduce el mensaje real del backend con prioridad sobre el fallback genérico), paginación y filtros de Usuarios (búsqueda/rol/estado, con chips y "Limpiar filtros"), estados vacíos y de carga (skeletons dedicados en ambos módulos), Drawer de Usuario (autoprotección real ya reforzada en backend desde QA.10), consistencia visual del Canvas Workspace en ambas páginas, KPIs clicables de ambos módulos, y accesibilidad básica (labels asociados a inputs, `aria-invalid`/`aria-label` en botones icon-only, foco visible heredado de los primitivos compartidos).

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, arquitectura de rutas, diseño visual aprobado (los 2 fixes de color usan tokens ya existentes, no cambian ningún valor del Design System).

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 8 archivos tocados (`routes/index.tsx`, `UsersTable.tsx`, `UserDrawer.tsx`, `UserForm.tsx`, `DashboardTodayKpis.tsx`, `DashboardLowStockPanel.tsx`, `DashboardRecentActivity.tsx`, `DashboardPromotionsPanel.tsx`), `npm run build` verde. Sin validación en navegador en este bloque (a pedido explícito del usuario) — recomendado una verificación visual puntual de los 7 fixes en un bloque posterior con acceso a Chrome.

**Bloque 1 (Login/Dashboard/Usuarios) — CERRADO (05/08/2026). Los tres módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — Bloque 2: Roles, Permisos, Configuración — ✅ IMPLEMENTADO (05/08/2026)

Segundo bloque del QA final previo al Release 1.0, mismo criterio que el Bloque 1 (revisión exhaustiva de código, corrección inmediata de bugs pequeños y localizados, sin refactors ni cambios de arquitectura). Revisión completa de `features/roles/`, `features/permissions/`, `features/settings/` y la parte de `routes/index.tsx` que les aplica.

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Roles | 🔧 Bug encontrado y corregido | Ver tabla abajo |
| Permisos | 🔧 2 bugs encontrados y corregidos | Ver tabla abajo |
| Configuración | 🔧 Bug encontrado y corregido | Ver tabla abajo |

**Bugs reales encontrados y corregidos en este bloque:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Roles | `/roles/new` y `/roles/:id/edit` eran alcanzables por URL directa sin el permiso `roles.manage` — mismo patrón de bug ya corregido para Usuarios en el Bloque 1: solo `/roles` (el listado) tenía `RequirePermission`, las dos rutas de formulario solo tenían `ProtectedRoute` | `routes/index.tsx`: se envuelven ambas rutas en `RequirePermission permission={PERMISSIONS.ROLES_MANAGE}` |
| 2 | Permisos | Mismo bug que #1, en `/permissions/new` y `/permissions/:id/edit` | `routes/index.tsx`: mismo fix, `RequirePermission permission={PERMISSIONS.ROLES_MANAGE}` en ambas rutas |
| 3 | Permisos | Inconsistencia visual: `CreatePermissionPage.tsx`/`EditPermissionPage.tsx` eran las únicas pantallas de creación/edición de este bloque sin `breadcrumb` en su `PageHeader` (Roles y Configuración sí lo tienen) | Se agrega `breadcrumb={[Inicio, Permisos, Nuevo/Editar permiso]}` a ambas, mismo patrón ya usado en `CreateRolePage.tsx`/`EditRolePage.tsx` |
| 4 | Configuración | Mismo bug que #1/#2, en `/settings/new` y `/settings/:id/edit` (a diferencia de `/settings` y `/settings/alegra`, que ya tenían `RequirePermission`) | `routes/index.tsx`: mismo fix, `RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}` en ambas rutas |

**Adicionalmente, por consistencia con el fix #3:** se agrega el mismo `breadcrumb` a `CreateConfigurationPage.tsx`/`EditConfigurationPage.tsx` (antes tampoco lo tenían).

**Limpieza de código muerto (Roles):** `RoleStatusBadge.tsx` no tenía ningún consumidor real en todo el repositorio (confirmado con búsqueda exhaustiva) — `RolesTable.tsx` usa un `Switch` inline en su lugar, no este componente. Eliminado.

**Verificado y descartado como bug (falsos positivos, documentados para no reinvestigarlos en un QA futuro):**
- El botón "Nuevo Rol" (`RolesPage.tsx`) y las acciones "Editar"/toggle de `RolesTable.tsx`/`PermissionTable.tsx` no están envueltas en `<Can>` — a diferencia de otros módulos (Usuarios, Productos), **esto no es explotable**: la propia ruta `/roles`/`/permissions` ya exige `roles.manage` vía `RequirePermission` para poder ver la página en absoluto, así que cualquiera que llegue a ver esos botones ya tiene el permiso. Gating adicional con `<Can>` sería puramente redundante, no una corrección real.
- El botón "Guardar permisos" de `RolePermissionsSection` (`EditRolePage.tsx`) se deshabilita cuando no hay ningún permiso seleccionado — parece una limitación pero replica exactamente una regla real del backend (`AssignRolePermissionsSchema.permissionIds.min(1, 'Debe incluir al menos un permiso.')`, `roles.validation.ts`): el endpoint rechaza una lista vacía. El frontend solo refleja esa regla, no es un bug de UI.
- Las query keys de `usePermissions`/`usePermission` (`['permissions', filters]`/`['permissions', id]`) no siguen el patrón documentado `[resource, action, ...params]` del resto del ERP — inconsistencia de estilo real, pero sin efecto funcional (no colisiona caché, las invalidaciones por prefijo `['permissions']` siguen alcanzando ambas queries). Se documenta como deuda técnica menor, no se toca (cambiar query keys es un ajuste de convención, no la corrección de un defecto real).

**Deuda técnica registrada (mismo bug sistémico, fuera del alcance de este bloque):** el mismo patrón corregido en los hallazgos #1/#2/#4 (rutas `/new`/`/:id/edit` sin `RequirePermission`, a diferencia de su listado) también está presente en Productos, Categorías, Impuestos, Promociones, Proveedores, Clientes y Compras — no corregido en este bloque porque esos módulos no forman parte de su alcance (Roles/Permisos/Configuración); queda para su propio bloque de QA final.

**Sin hallazgos adicionales, revisado y confirmado correcto:** CRUD completo de los tres módulos (crear/editar/activar-desactivar con confirmación en Roles; crear/editar en Permisos y Configuración), selector de permisos por rol (`RolePermissionSelector.tsx`, agrupado por módulo, "Seleccionar todo"/"Quitar todo"), guardas de rol de sistema (nombre no editable, no desactivable — ya reforzadas en backend desde QA.11), guardas de código de permiso no editable (QA.12), validaciones de formulario (los 3 `*.schema.ts`, réplica exacta del backend), manejo de errores 403/400/404/401 (`roleErrors.ts`/`permissionErrors.ts`/`settingsErrors.ts`, priorizan el mensaje real del backend), Drawers de los tres módulos (incluida la pestaña "Usuarios asignados" de Roles), integración de Alegra (`AlegraConfigForm.tsx` — token nunca precargado en texto plano, validación distinta para "Guardar" vs. "Probar conexión", ambas correctas), paginación y filtros de los tres módulos, estados vacíos y de carga, y accesibilidad básica (labels asociados, `aria-invalid`, tooltips en controles deshabilitados).

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado (los cambios son guardas de ruta ya usadas en otros módulos, breadcrumbs con el mismo componente ya existente, y la eliminación de un archivo sin consumidores).

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 5 archivos tocados (`routes/index.tsx`, `CreatePermissionPage.tsx`, `EditPermissionPage.tsx`, `CreateConfigurationPage.tsx`, `EditConfigurationPage.tsx`) más 1 archivo eliminado (`RoleStatusBadge.tsx`), `npm run build` verde.

**Bloque 2 (Roles/Permisos/Configuración) — CERRADO (05/08/2026). Los tres módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — Bloque 3: Productos, Categorías, Impuestos — ✅ IMPLEMENTADO (05/08/2026)

Tercer bloque del QA final previo al Release 1.0, mismo criterio que los Bloques 1-2. A diferencia de Roles/Permisos/Configuración (un único permiso "manage" por módulo, gate suficiente a nivel de ruta), Productos/Categorías/Impuestos tienen permisos granulares reales (`view`/`create`/`update`/`delete` por separado) — esto convirtió el hallazgo sistémico ya registrado como deuda técnica en el Bloque 2 en un bug de **seguridad de UI real y explotable** en estos tres módulos, no redundante como se había asumido. Se corrigió por completo, según instrucción explícita de este bloque.

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Productos | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Categorías | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Impuestos | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |

**Hallazgo raíz, común a los tres módulos:** `constants/permissions.ts` no incluía `CATEGORIES_CREATE`/`CATEGORIES_UPDATE`/`TAXES_CREATE`/`TAXES_UPDATE` — cuatro códigos de permiso que sí existen, reales, en el catálogo sembrado del backend (`prisma/permissionsBootstrap.ts`) y que los propios endpoints exigen (`categories.routes.ts`/`taxes.routes.ts`, `authorizePermission('categories.create')` etc.). Sin esos códigos declarados, el frontend no tenía ninguna forma de aplicar `<Can>`/`<RequirePermission>` sobre las acciones de creación/edición de esos dos módulos — la única gate real que existía era `view`, insuficiente. Se agregan los 4 códigos faltantes, exactamente como el backend los define.

**Bugs reales encontrados y corregidos:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Productos | `/products/new` y `/products/:id/edit` sin `RequirePermission` (patrón ya conocido de Bloques 1-2) | `routes/index.tsx`: `RequirePermission permission={PRODUCTS_CREATE}` / `PRODUCTS_UPDATE` |
| 2 | Productos | Botón "Nuevo Producto" (`ProductsPage.tsx`), acción "Editar" (icono hover + `RowMenu`, `ProductsTable.tsx`), botón "Editar producto" (`ProductDrawer.tsx`) y el CTA del estado vacío visibles para cualquier usuario con solo `products.view`, sin `products.create`/`products.update` | Gateados con `<Can>` (Nuevo/Editar) y `canCreateProduct ? handleCreateProduct : undefined` (CTA del estado vacío) |
| 3 | Productos | El `Switch` de Estado (activar/desactivar) en `ProductsTable.tsx` quedaba habilitado y accionable sin `products.update` | `disabled={!canUpdate}` + `title` explicando el motivo (visible, pero no accionable — se preserva la lectura del estado) |
| 4 | Categorías | Mismo bug que #1, en `/categories/new` y `/categories/:id/edit` (faltaba además declarar `CATEGORIES_CREATE`/`CATEGORIES_UPDATE`, ver hallazgo raíz) | Mismo fix, con los permisos ya agregados |
| 5 | Categorías | Mismo bug que #2: "Nueva Categoría", "Activar/Desactivar (N)" en lote, "Editar" (tabla y Drawer) y el CTA de los 2 estados vacíos (vista Lista y vista Árbol) sin gate | Mismo patrón de corrección que Productos |
| 6 | Categorías | Mismo bug que #3, en el `Switch` de `CategoriesTable.tsx` | Mismo fix |
| 7 | Impuestos | Mismo bug que #1, en `/taxes/new` y `/taxes/:id/edit` (con los permisos ya agregados) | Mismo fix |
| 8 | Impuestos | Mismo bug que #2: "Nuevo Impuesto", "Editar" (tabla y Drawer), el CTA del estado vacío, y además "Marcar como predeterminado" (`TaxDrawer.tsx`, también requiere `taxes.update` en el backend) sin gate | Mismo patrón de corrección |
| 9 | Impuestos | Mismo bug que #3, en el `Switch` de `TaxesTable.tsx` | Mismo fix |
| 10 | Productos/Categorías | Mensaje de error genérico (fallback cuando el backend no trae `error.message`) decía "Ocurrió un error **al crear**..." pese a que la misma función (`getProductErrorMessage`/`getCategoryErrorMessage`) también traduce errores de actualizar/eliminar/activar-desactivar — mensaje incorrecto en 3 de sus 4 usos reales. `taxErrors.ts` ya usaba la redacción correcta ("procesar") | `productErrors.ts`/`categoryErrors.ts`: "al crear el producto/la categoría" → "al procesar el producto/la categoría" |
| 11 | Categorías | Color hardcodeado (`amber-500`/`amber-600`, Tailwind literal) en `CategoryLowStockIndicator.tsx` — mismo tipo de violación ya corregido en el Bloque 1 (Dashboard) | `bg-amber-500/15`/`text-amber-600` → `bg-accent-amber/15`/`text-accent-amber` |

**Verificado y descartado como falso positivo:** el export a CSV de los tres módulos exporta valores numéricos crudos (`salePrice`, `rate`) sin `formatCurrency` — correcto a propósito, un CSV necesita números sin formato para que una hoja de cálculo pueda sumarlos/ordenarlos; ya es el mismo criterio usado en el resto del ERP. La regla de validación de `cabysCode` (13 dígitos exactos) replica al backend sin diferencias.

**Sin hallazgos adicionales, revisado y confirmado correcto:** CRUD completo de los tres módulos, formularios (`product.schema.ts`/`category.schema.ts`/`tax.schema.ts`, réplica exacta del backend), Drawers, filtros (búsqueda/categoría padre/estado en Categorías; búsqueda/estado/predeterminado en Impuestos; búsqueda/categoría/impuesto/estado en Productos), paginación, breadcrumbs ya presentes en las 6 páginas de creación/edición, estados vacíos y de carga (skeletons dedicados en los tres), accesibilidad básica.

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado. `constants/permissions.ts` no inventa ningún código nuevo — los 4 agregados ya existían, reales, en el catálogo sembrado del backend.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 14 archivos tocados (`constants/permissions.ts`, `routes/index.tsx`, `ProductsPage.tsx`, `ProductsTable.tsx`, `ProductDrawer.tsx`, `productErrors.ts`, `CategoriesPage.tsx`, `CategoriesTable.tsx`, `CategoryDrawer.tsx`, `CategoryLowStockIndicator.tsx`, `categoryErrors.ts`, `TaxesPage.tsx`, `TaxesTable.tsx`, `TaxDrawer.tsx`), `npm run build` verde.

**Bloque 3 (Productos/Categorías/Impuestos) — CERRADO (05/08/2026). Los tres módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — Bloque 4: Inventario, Promociones, Proveedores — ✅ IMPLEMENTADO (05/08/2026)

Cuarto bloque del QA final previo al Release 1.0, mismo criterio que los Bloques 1-3. Se repitió el mismo patrón sistémico ya encontrado en el Bloque 3 (permisos granulares reales sin gate de UI) en los tres módulos, más un hallazgo nuevo de mensajes de error en Inventario.

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Inventario | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Promociones | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Proveedores | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |

**Hallazgo raíz (mismo patrón que el Bloque 3):** `constants/permissions.ts` no incluía `SUPPLIERS_CREATE`/`SUPPLIERS_UPDATE` — códigos reales del catálogo sembrado del backend (`prisma/permissionsBootstrap.ts`), exigidos por `suppliers/routes.ts` (`authorizePermission('suppliers.create'/'suppliers.update')`). Se agregan ambos. Promociones ya tenía su catálogo completo (`PROMOTIONS_CREATE`/`UPDATE`/`DELETE`); Inventario/Lotes también (`INVENTORY_ADJUST`/`WASTE`, `BATCHES_ADJUST`) — el problema ahí fue exclusivamente de gating faltante, no de catálogo incompleto.

**Bugs reales encontrados y corregidos:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Inventario | `/inventory/:id/adjust` sin `RequirePermission` — un comentario de un sprint anterior documentaba este hallazgo como "explícitamente fuera de ese sprint" | `routes/index.tsx`: `RequirePermission permission={INVENTORY_ADJUST}`; comentario de `InventoryAdjustPage.tsx` actualizado |
| 2 | Inventario | En `InventoryTable.tsx`, el botón "Abrir detalle" (icono ojo), la fila completa (`onRowClick`) y "Ajustar existencia" (`RowMenu`) abrían el único Drawer de ajuste existente sin `inventory.adjust` — no hay una vista de solo lectura separada, el Drawer de ajuste es la única forma de ver el detalle de una fila | Los 3 puntos de entrada ahora requieren `canAdjust` (`hasPermission(INVENTORY_ADJUST)`) |
| 3 | Inventario | Mensajes de error de las mutaciones de ajuste y de registro de merma mostraban `error.message` — el mensaje **genérico de Axios** ("Request failed with status code 409"), nunca el mensaje real del backend (p.ej. "Ya existe un registro de inventario para este producto en esta sucursal.", o las validaciones reales de `inventoryWaste/service.ts`) — a diferencia de todos los demás módulos del ERP, que ya usan un traductor dedicado | Nuevo `features/inventory/utils/inventoryErrors.ts` (mismo patrón que `supplierErrors.ts`/`promotionErrors.ts`), wireado en `InventoryPage.tsx` (ajuste + merma) e `InventoryAdjustPage.tsx` |
| 4 | Promociones | `/promotions/new` y `/promotions/:id/edit` sin `RequirePermission` (patrón ya conocido) | `routes/index.tsx`: `RequirePermission permission={PROMOTIONS_CREATE}` / `PROMOTIONS_UPDATE` |
| 5 | Promociones | "Nueva Promoción" (Toolbar + CTA del estado vacío), "Editar" (tabla + Drawer) y el `Switch` de Estado visibles/accionables sin `promotions.create`/`promotions.update` | Mismo patrón de corrección que Bloque 3 (`<Can>` en botones/menú, `disabled` + `title` en el `Switch`, CTA condicional) |
| 6 | Proveedores | `/suppliers/new` y `/suppliers/:id/edit` sin `RequirePermission` (con los permisos ya agregados al catálogo) | Mismo fix |
| 7 | Proveedores | Mismo bug que #5: "Nuevo Proveedor" (Toolbar + CTA), "Editar" (tabla + Drawer) y el `Switch` de Estado sin gate | Mismo patrón de corrección |

**Verificado y descartado como falso positivo:** el shadow literal `rgba(0,0,0,0.12)` en el footer de `PromotionDrawer.tsx` no es un color hardcodeado aislado — es un patrón ya establecido, idéntico, en los 7 Drawers del ERP (`ProductDrawer`/`CategoryDrawer`/`TaxDrawer`/`SupplierDrawer`/`CustomerDrawer`/`PromotionDrawer`/`MediaCard`), ya aprobado como parte del Design System — no se toca, reabrir ese patrón sería un cambio de diseño fuera de alcance de este bloque, no la corrección de un bug real.

**Sin hallazgos adicionales, revisado y confirmado correcto:** CRUD completo de los tres módulos, formularios, filtros, paginación, exportaciones a CSV (números crudos sin `formatCurrency`, correcto para hojas de cálculo), estados vacíos y de carga, mensajes de error de Promociones/Proveedores (`promotionErrors.ts`/`supplierErrors.ts`, ya usaban la redacción correcta "procesar"), breadcrumbs ya presentes en las 6 páginas de creación/edición, accesibilidad básica, y — caso límite revisado a propósito — la regla de negocio real del backend que exige al menos 1 permiso al asignar permisos a un rol (documentada en el Bloque 2) no aplica aquí, ningún módulo de este bloque tiene un mecanismo análogo.

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 12 archivos tocados (`constants/permissions.ts`, `routes/index.tsx`, `InventoryTable.tsx`, `InventoryPage.tsx`, `InventoryAdjustPage.tsx`, `inventoryErrors.ts` [nuevo], `PromotionsPage.tsx`, `PromotionsTable.tsx`, `PromotionDrawer.tsx`, `SuppliersPage.tsx`, `SuppliersTable.tsx`, `SupplierDrawer.tsx`), `npm run build` verde.

**Bloque 4 (Inventario/Promociones/Proveedores) — CERRADO (05/08/2026). Los tres módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — Bloque 5: Ventas (POS), Caja, Clientes, Compras, Reportes — ✅ IMPLEMENTADO (05/08/2026)

Quinto y más extenso bloque del QA final previo al Release 1.0 — los cinco módulos de mayor riesgo operativo/financiero del ERP (cobros, comprobantes, apertura/cierre de caja, compras a proveedor, reportes). Mismo criterio que los Bloques 1-4, con foco adicional explícito en: flujo completo del POS, cobros/comprobantes/impresión, apertura/cierre de caja y sus movimientos, clientes durante la venta, timezone en reportes, y manejo de errores del backend.

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Ventas (POS) | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Caja | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Clientes | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Compras | 🔧 Bug encontrado y corregido | Ver tabla abajo |
| Reportes | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |

**Bugs reales encontrados y corregidos:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Clientes | `/customers/new` y `/customers/:id/edit` sin `RequirePermission` (patrón ya conocido); "Nuevo Cliente" (Toolbar + CTA), "Editar" (tabla + Drawer) y el `Switch` de Estado visibles/accionables sin `customers.create`/`customers.update` | `routes/index.tsx`: `RequirePermission` en ambas rutas; `<Can>`/`disabled`+`title` en `CustomersPage.tsx`/`CustomersTable.tsx`/`CustomerDrawer.tsx`, mismo patrón que Bloques 3-4 |
| 2 | Compras | `PATCH /purchases/:id` está restringido en el backend por **rol literal** `SystemRole.ADMIN` (`purchases/routes.ts`, usa `authorize`, no `authorizePermission` — no existe un código de permiso para esta acción), pero `/purchases/:id/edit` no tenía ningún guard, y el botón "Editar" (detalle + tabla) era visible para cualquier usuario con `purchases.view` | Nuevo `routes/RequireRole.tsx` (mismo patrón exacto que `RequirePermission.tsx`, para el único caso del ERP con esta restricción por rol) — gatea la ruta; "Editar" ahora condicionado a `isAdmin` en `PurchaseDetailPage.tsx`/`PurchasesTable.tsx` |
| 3 | Caja | `/cash-session/open` y `/cash-session/:id/close` no tenían **ningún** `RequirePermission`, a pesar de que el propio ítem del Sidebar ("Caja", `navigation.ts`) ya declara `permission: CASH_OPEN` como su gate — un usuario sin ese permiso no veía el link, pero podía llegar por URL directa y operar toda la pantalla (KPIs, sesiones, movimientos) | `routes/index.tsx`: `RequirePermission permission={CASH_OPEN}` / `CASH_CLOSE` en ambas rutas |
| 4 | Caja | Cerrar una sesión de caja (`CloseCashSessionPage.tsx`) fallaba **en completo silencio** ante un error del backend — la mutación (`useCloseCashSession`) ni siquiera desestructuraba `error`/`isError`, y no había ningún `ErrorAlert`/`toast.error` para ese caso; un fallo se veía idéntico a que no pasara nada | Se desestructura `isError`/`error` de la mutación y se agrega el `ErrorAlert` correspondiente, mismo patrón que el resto de las páginas de edición del ERP |
| 5 | Caja | Los mensajes de error de abrir caja (`OpenCashSessionForm.tsx`) y registrar un movimiento (`CashMovementForm.tsx`) mostraban `error.message` — el mensaje **genérico de Axios**, nunca el real del backend (p.ej. "Ya existe una sesion de caja abierta para esta caja registradora.", "No se pueden registrar movimientos en una sesion de caja cerrada.") | Nuevo `features/cashSession/utils/cashSessionErrors.ts` (mismo patrón que `inventoryErrors.ts`/`supplierErrors.ts`), wireado en ambos formularios y en el fix del hallazgo #4 |
| 6 | Ventas (POS) | Anular una venta (`SaleVoidPanel.tsx`) y registrar una devolución (`SaleReturnForm.tsx`) mostraban `error.message` en vez del mensaje real del backend — a diferencia del resto del flujo de Ventas (cotización, confirmación, corrección), que ya usa `getSaleErrorMessage` correctamente | `SaleVoidPanel.tsx`: ahora usa `getSaleErrorMessage` (ya existente). Nuevo `features/returns/utils/returnErrors.ts` (no existía ninguna utilidad de errores para Devoluciones), wireado en `SaleReturnForm.tsx` |
| 7 | Ventas (POS) | 6 colores hardcodeados (`emerald-400`/`500`/`600`/`700`, Tailwind literal) en `CheckoutPanel.tsx` (chip de "Vuelto"/"Pago exacto"), `PosHeader.tsx` (chip "Cliente" con `tone="success"`), `SaleReceiptDialog.tsx` (ícono de éxito) y `SaleResendDialog.tsx` (confirmación de envío) — ninguno adaptado al tema, a diferencia del resto del ERP | Los 4 archivos migrados al token `--success` ya existente (`bg-success`/`text-success`/`border-success`, con sus variantes de opacidad) |
| 8 | Reportes | `/reports` y sus 8 sub-rutas (`low-stock`, `top-products`, `sales-by-category`, `sales-by-cashier`, `sales`, `purchases`, `inventory`, `profit`) no tenían **ningún** `RequirePermission`, pese a que el ítem "Reportes" del Sidebar ya declara `permission: REPORTS_VIEW` como su gate | `routes/index.tsx`: `RequirePermission permission={REPORTS_VIEW}` en las 9 rutas |
| 9 | Reportes | Color hardcodeado (`amber-600`, Tailwind literal) en la columna "Cantidad" de `LowStockTable.tsx` — mismo hallazgo ya documentado como deuda técnica en el Bloque 1 (fuera de alcance en ese momento porque Reportes no era parte de ese bloque) | `LowStockTable.tsx`: `amber-600` → token `accent-amber` — deuda técnica cerrada |

**Verificado y confirmado correcto (sin regresión):** flujo completo del POS (cotización → confirmación → recibo → impresión/PDF, todo ya usa `getSaleErrorMessage`/`getAlegraActionErrorMessage` correctamente); anulación/corrección de venta ya gateadas por `SALES_VOID`/`SALES_CORRECT`; búsqueda de clientes durante la venta (`CustomerSearchDialog.tsx`); CRUD completo de Compras (ya gateaba correctamente "Nueva compra" y su estado vacío desde un bloque anterior); recibir/cancelar compra (`PurchaseDetailPage.tsx`, ya usa `getPurchaseErrorMessage`); las correcciones de timezone en filtros de fecha y KPIs de Reportes (QA.13/QA.14, Bloque 7.35 — auditoría global ya cerrada, sin evidencia de regresión); exportaciones CSV de todos los módulos (valores numéricos crudos sin `formatCurrency`, correcto para hojas de cálculo); accesibilidad básica.

**Verificado y descartado como falso positivo:** el toast genérico (sin extraer el mensaje real del backend) al activar/desactivar una promoción desde el POS (`PromotionsActivationDialog.tsx`) es una simplificación ya documentada y aprobada en un bloque anterior ("Bloque POS-08"), no un hallazgo nuevo — no se toca.

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado.

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 21 archivos tocados (`routes/index.tsx`, `routes/RequireRole.tsx` [nuevo], `PurchaseDetailPage.tsx`, `PurchasesTable.tsx`, `PurchaseForm.tsx`, `CustomersPage.tsx`, `CustomersTable.tsx`, `CustomerDrawer.tsx`, `CheckoutPanel.tsx`, `PosHeader.tsx`, `SaleReceiptDialog.tsx`, `SaleResendDialog.tsx`, `SaleVoidPanel.tsx`, `SaleReturnForm.tsx`, `LowStockTable.tsx`, `inventoryErrors.ts`, `cashSessionErrors.ts` [nuevo], `OpenCashSessionForm.tsx`, `CashMovementForm.tsx`, `CloseCashSessionPage.tsx`, `returnErrors.ts` [nuevo]), `npm run build` verde.

**Bloque 5 (Ventas/Caja/Clientes/Compras/Reportes) — CERRADO (05/08/2026). Los cinco módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — Bloque 6: Lotes, Notificaciones, Facturación Electrónica (Alegra), Integraciones, Componentes compartidos — ✅ IMPLEMENTADO (05/08/2026)

Sexto y último bloque del QA final previo al Release 1.0. Foco especial en Facturación Electrónica sin consumir ninguna emisión real adicional (revisión exclusivamente por código — validaciones, estados, manejo de errores — sin ejecutar `POST /integrations/alegra/sales/:saleId/emit` ni ninguna otra llamada de escritura real contra Alegra durante este bloque).

| Módulo | Veredicto | Hallazgos |
|---|---|---|
| Lotes | 🔧 Bugs encontrados y corregidos | Ver tabla abajo |
| Notificaciones | 🔧 Bug encontrado y corregido | Ver tabla abajo |
| Facturación Electrónica (Alegra) | ✅ Sin hallazgos nuevos | Documentación desactualizada corregida (ver abajo) |
| Integraciones | ✅ Sin hallazgos nuevos | Ya cubierto en el Bloque 2 (`/settings/alegra`, `AlegraConfigForm.tsx`) |
| Componentes compartidos | ✅ Sin hallazgos | Ver verificación abajo |

**Bugs reales encontrados y corregidos:**

| # | Módulo | Bug real encontrado | Corrección |
|---|---|---|---|
| 1 | Lotes | "Ajustar / Bloquear" (tabla y Drawer) visible/accionable sin `batches.adjust` — la ruta `/inventory/batches/:id/adjust` ya estaba correctamente gateada desde un bloque anterior, pero la UI que lleva a ella no lo estaba | `<Can permission={PERMISSIONS.BATCHES_ADJUST}>` en `BatchesTable.tsx`/`BatchDrawer.tsx` |
| 2 | Lotes | El mensaje de error al guardar un ajuste de lote (`BatchAdjustPage.tsx`) mostraba `error.message` — el mensaje genérico de Axios, nunca el real del backend (validaciones reales de `batches/service.ts`, p.ej. "La cantidad disponible no puede ser negativa.") | Nuevo `features/batches/utils/batchErrors.ts` (mismo patrón que `inventoryErrors.ts`), wireado en `BatchAdjustPage.tsx` |
| 3 | Notificaciones | `GET /notifications` exige `reports.view` en el backend, pero `useNotifications()` se disparaba sin condición alguna desde `NotificationBell.tsx` — siempre montado en el header de Backoffice y POS — generando un `403` evitable para cualquier usuario sin ese permiso (rol personalizado o `CASHIER` reconfigurado sin `reports.view`). Mismo patrón de bug ya corregido una vez para el Dashboard (`navigation.ts`/`getDefaultRoute`, "evita multiples 403 justo despues del login") | `useNotifications()`: `enabled: hasPermission(REPORTS_VIEW)`; `NotificationBell.tsx`: no se renderiza sin ese permiso (mismo criterio que el resto del ERP oculta funcionalidad sin permiso, en vez de una campana sin datos) |

**Hallazgo de documentación (no de código) — Facturación Electrónica:** durante la revisión del flujo de Documentos/Alegra se confirmó que **`checkInvoiceStatus()` ya NO es código huérfano** — la deuda técnica registrada en el Bloque 1 (QA.16A/QA.16B, "implementado pero inalcanzable, sin ruta HTTP") está resuelta: existe `GET /integrations/alegra/sales/:saleId/status` (backend, mismo permiso `sales.view` que PDF/XML) y el frontend ya la consume completa (`alegraApi.checkInvoiceStatus`, `useSaleDocumentActions.ts::handleCheckInvoiceStatus`, botón "Actualizar estado" visible en "Documentos y comprobantes" cuando ya hay un comprobante emitido). Esta resolución ocurrió fuera de los bloques de este QA Final (fechada "Fix 05/08/2026" en el propio código, sin autoría de este bloque) — se corrige únicamente la entrada de deuda técnica en este documento, que había quedado desactualizada.

**Revisión de Facturación Electrónica (exclusivamente por código, sin emisiones reales):** los 6 botones de "Documentos y comprobantes" (Comprobante/PDF/Factura electrónica/XML/Reenviar/Actualizar estado) usan permisos correctos (todos `sales.view` en el backend, coherente con no tener ningún `<Can>` adicional — la propia pantalla de detalle ya exige ese permiso); manejo de errores correcto y consistente en los 6 (`getAlegraActionErrorMessage`/`parseBlobError`, con el mensaje real del backend priorizado sobre cualquier fallback); "Emitir comprobante electrónico" sigue siendo bajo pedido (nunca automático, Bloque 7.11/7.17) y el backend sigue teniendo el guard `409 CONFLICT` contra reemisión (QA.16A) — no se encontró ninguna regresión de los hallazgos ya cerrados en bloques anteriores; "Reenviar" (`SaleResendDialog.tsx`) resuelve correctamente el correo del cliente asociado o pide uno manual, sin duplicar el estado de envío.

**Verificación de componentes compartidos:** búsqueda exhaustiva de colores hardcodeados en `src/components/ui/`/`src/components/common/` — sin hallazgos (ya venían limpios de bloques anteriores de rediseño). `components/ui/switch.tsx` confirmado con estilo `disabled` real (`disabled:opacity-50`), validando que los fixes de `disabled={!canUpdate}` aplicados en los Bloques 3-5 sobre distintas tablas tienen efecto visual real, no solo funcional. `components/ui/ErrorAlert.tsx`/`ConfirmDialog.tsx`/`EmptyState.tsx` sin cambios necesarios.

**Verificado y descartado como falso positivo:** los permisos `cash-registers.create`/`cash-registers.update` (reales en el catálogo del backend) no tienen ningún consumidor en el frontend — el módulo de Cajas Registradoras es de solo lectura en toda la UI (`cashRegisters.api.ts` solo expone `getCashRegisters`) — no se agregan esos códigos a `constants/permissions.ts` porque no hay ninguna acción real que gatear con ellos (mismo criterio que `batches.create`, sembrado en el backend pero sin ruta HTTP ni UI que lo use).

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado. **Ninguna llamada de escritura real contra Alegra durante este bloque.**

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 6 archivos tocados (`useNotifications.ts`, `NotificationBell.tsx`, `BatchesTable.tsx`, `BatchDrawer.tsx`, `BatchAdjustPage.tsx`, `batchErrors.ts` [nuevo]), `npm run build` verde.

**Bloque 6 (Lotes/Notificaciones/Facturación Electrónica/Integraciones/Componentes compartidos) — CERRADO (05/08/2026). Los cinco módulos quedan APROBADOS para la versión 1.0.**

---

## QA FINAL 1.0 — CIERRE DEL PROGRAMA COMPLETO (05/08/2026)

Con el Bloque 6 cerrado, **no quedan módulos pendientes de revisar** en el QA Final 1.0. Los 6 bloques cubrieron la totalidad del ERP:

- **Bloque 1:** Login, Dashboard, Usuarios.
- **Bloque 2:** Roles, Permisos, Configuración.
- **Bloque 3:** Productos, Categorías, Impuestos.
- **Bloque 4:** Inventario, Promociones, Proveedores.
- **Bloque 5:** Ventas (POS), Caja, Clientes, Compras, Reportes.
- **Bloque 6:** Lotes, Notificaciones, Facturación Electrónica (Alegra), Integraciones, Componentes compartidos.

**Patrón sistémico encontrado y corregido de forma consistente en los 6 bloques:** rutas mutables (`/new`, `/:id/edit`, `/:id/adjust`, y equivalentes) sin `RequirePermission`/`RequireRole`, a pesar de que el ítem correspondiente del Sidebar ya declaraba el permiso correcto — corregido en Usuarios, Roles, Permisos, Configuración, Productos, Categorías, Impuestos, Promociones, Proveedores, Clientes, Compras (por rol, caso único), Caja, Reportes e Inventario/Lotes. Ningún módulo del ERP queda con este patrón sin corregir.

**Otros patrones sistémicos corregidos:** colores hardcodeados de Tailwind (`amber-*`/`emerald-*`) reemplazados por tokens del Design System (`--accent-amber`/`--success`) en 7 archivos a través de 3 bloques distintos; mensajes de error de mutaciones mostrando el texto genérico de Axios en vez del mensaje real del backend, corregido con nuevos traductores de error (`inventoryErrors.ts`, `cashSessionErrors.ts`, `returnErrors.ts`, `batchErrors.ts`) siguiendo el mismo patrón ya establecido en el resto del ERP; acciones de UI (botones "Editar"/`Switch` de Estado) visibles sin el permiso de `update` correspondiente en módulos con permisos granulares reales.

**El sistema queda preparado para el QA Final Integral (End-to-End)** — la validación de extremo a extremo de los flujos completos (login → operación diaria → cierre de caja → reportes, con los distintos roles reales) antes de declarar la versión 1.0 lista para producción. Ningún bloque de este QA Final requirió cambios de arquitectura, de reglas de negocio ni del backend (salvo lo ya documentado como fuera de estos bloques, p.ej. el fix de `checkInvoiceStatus`) — el alcance de los 6 bloques fue exclusivamente correcciones de código frontend ya localizadas y confirmadas.

---

## QA FINAL 1.0 — BLOQUE FINAL (END-TO-END) — ✅ IMPLEMENTADO (05/08/2026)

QA integral del negocio completo, a diferencia de los Bloques 1-6 (por módulo): en vez de revisar pantallas/componentes aislados, se trazó el flujo real de datos **a través de los límites entre módulos** — apertura de caja → proveedor → compra → inventario/lotes → cliente → promoción → venta (unidad/peso/promoción/con-sin cliente/efectivo/tarjeta/SINPE/mixto) → comprobante/PDF → Facturación Electrónica (sin emitir ningún documento nuevo) → Dashboard → Reportes → Notificaciones → cierre de caja → resumen de sesión → exportaciones → navegación entre módulos.

**Método:** revisión por código (sin ejecutar el sistema en navegador ni emitir ninguna factura electrónica real, según lo indicado) del mecanismo central que conecta todos los módulos entre sí — el registro de invalidación de queries por evento de dominio (`features/reports/constants/reportQueryKeys.ts`, la única fuente de verdad de "qué pantallas debe refrescar cada mutación") — verificando que cada uno de los 14 hooks de mutación relevantes (`useCreateSale`/`useVoidSale`/`useCorrectSale`/`useUpdateSale`/`useCreateReturn`/`useCreatePurchase`/`useUpdatePurchase`/`useCreateInventory`/`useUpdateInventory`/`useCreateInventoryWaste`/`useDeleteInventoryWaste`/`useUpdateBatch`/`useCloseCashSession`/`useCreateCashMovement`) usa exactamente la constante que le corresponde a su propio evento de dominio, sin cruces. **Resultado: los 14 coinciden exactamente — cero desalineaciones.** Esto confirma, con evidencia directa de código (no solo por inspección visual módulo por módulo), que una venta con cualquier combinación de escenarios (unidad/peso, con/sin promoción, con/sin cliente, cualquier método de pago) refresca correctamente Dashboard, Reportes (ventas/ganancia/inventario/bajo stock), Notificaciones e Inventario; que recibir una compra refresca además Lotes (`batches`) — invalidación que en un momento anterior del proyecto había faltado y ya fue corregida; y que cerrar caja o registrar un movimiento refresca el reporte de caja.

**Hallazgo real, encontrado únicamente por seguir el flujo de extremo a extremo (invisible en cualquier revisión por módulo aislado):**

| # | Flujo afectado | Hallazgo | Por qué no se corrige en este QA |
|---|---|---|---|
| 1 | Ventas con pago mixto → Cierre de caja / Arqueo | El modelo de datos actual (`Sale`, backend) no registra CUÁNTO de una venta con `paymentMethod: 'MIXED'` fue efectivo vs. tarjeta/SINPE — ni el formulario de cobro (`CheckoutPanel.tsx`) ni el esquema del backend (`sales/validation.ts`, documentado explícitamente: "un pago mixto no tiene una única referencia bien definida y queda fuera de este alcance") capturan ese desglose. El reporte de caja (`paymentBreakdown.CASH.total`, `reports.service.ts`) agrupa estrictamente por `paymentMethod === 'CASH'` — la porción en efectivo de una venta mixta queda enteramente fuera de ese total. **Efecto real:** en una sesión de caja con al menos una venta de pago mixto, el "Efectivo esperado" (`DashboardContextPanel.tsx`/`CashSessionsPage.tsx`/`CashArqueoPanel.tsx`) queda por debajo del efectivo físico real recibido, en la magnitud de la porción en efectivo de cada venta mixta de esa sesión — un arqueo que en la práctica "no cierra" sin que el sistema explique por qué. | Requiere un campo nuevo en el esquema de `Sale` (o una entidad de desglose de pago) + una regla de negocio nueva sobre cómo se registra/valida esa distribución — cambio de arquitectura y de reglas de negocio, ambos fuera del alcance de un QA sin esos cambios. Documentado con un comentario en el código (`CashSessionsPage.tsx`/`DashboardPage.tsx`, sin cambiar ningún cálculo) para que quede visible para quien continúe el proyecto. |

**Verificado y confirmado correcto (end-to-end, sin hallazgos):** creación automática de lotes al recibir una compra de un producto con `requiresBatch: true` (idempotente por `purchaseItemId`, transaccional, invariante `SUM(Batch.availableQuantity ACTIVA) = Inventory.quantity` mantenido atómicamente — mismo código ya cerrado en el histórico de Lotes LOTES-00..09); cotización de venta (`POST /sales/quote`) como única fuente de verdad de totales/impuestos/promociones, sin ningún recálculo del lado del cliente para ningún escenario (unidad, peso, con promoción); resolución de Tiquete vs. Factura Electrónica según `Sale.customerId` (Bloques 8.3/8.4); movimientos de caja correctamente acotados a la sesión abierta actual (`cashSessionId`, sin fuga entre sesiones); navegación cruzada entre módulos (Categorías/Impuestos/Proveedores → Productos filtrados, Roles → Usuarios filtrados, todas ya construidas sobre el mismo mecanismo `location.state`); exportaciones CSV con valores numéricos crudos en los 8 módulos que las tienen (correcto para hojas de cálculo, no es un bug).

**Sin cambios:** backend, endpoints, DTOs, esquemas de validación, lógica de negocio, diseño visual aprobado. **Ninguna llamada de escritura real contra Alegra durante este bloque** (la emisión ya fue validada en bloques anteriores, no se repite).

**Validado:** `tsc -b` limpio, `eslint` sin warnings/errores nuevos en los 2 archivos tocados (`CashSessionsPage.tsx`, `DashboardPage.tsx` — ambos cambios son comentarios de documentación, cero cambio de comportamiento), `npm run build` verde.

**Riesgo pendiente (único, ya documentado arriba):** el arqueo de caja no refleja correctamente sesiones con ventas de pago mixto — riesgo real, con impacto operativo (el cajero puede ver una diferencia de caja que no es un error suyo), pero no bloqueante para operar el sistema (las sesiones sin pagos mixtos, o donde el cajero conoce y tolera esta limitación, arquean correctamente) y no compromete la integridad de los datos ya guardados (ninguna venta, cobro ni comprobante se calcula mal — solo el resumen agregado de caja).

**Veredicto — Release Candidate:** ✅ **el sistema queda APROBADO como Release Candidate.** Los 6 bloques por módulo más este bloque End-to-End no encontraron ningún hallazgo crítico o bloqueante pendiente — todo lo encontrado en los 7 bloques fue corregido en el momento, salvo el único riesgo de arqueo con pago mixto (documentado arriba, no bloqueante, requiere una decisión de producto explícita antes de resolverse, no una corrección de QA). **El ERP queda listo para generar la versión 1.0.0.**

---

## AUDITORÍA TÉCNICA POST-1.0 — ROADMAP HACIA LA VERSIÓN 1.1 (06/08/2026)

Con la 1.0.0 aprobada, se realizó una auditoría técnica y funcional de planificación (sin código, sin implementación) de los tres repositorios como un solo sistema, para definir el roadmap hacia la 1.1. Documento completo: **`docs/AUDITORIA_TECNICA_1.1.md`** — 20 propuestas evaluadas (problema/beneficio/impacto/complejidad/riesgo/cambios de BD-backend-frontend), clasificadas en Prioridad Alta/Media/Baja, más deuda técnica real, funcionalidades mejorables, y oportunidades de automatización/rendimiento/simplificación.

**Hallazgo crítico que no debería esperar a la 1.1:** no existe ningún backup automático funcional en una instalación real (el script es `bash`, no se empaqueta, `pg_dump.exe` no se incluye) y el restore está explícitamente sin implementar — confirmado contra una instalación real (`Backups/` vacía). Recomendado como corrección urgente independiente (parche 1.0.1), no como parte de la 1.1.

**Prioridad Alta recomendada para la 1.1** (además del backup): registrar el desglose real del pago mixto (cierra el hallazgo de arqueo de caja del Bloque Final End-to-End), conectar el botón de rollback ya implementado pero inalcanzable en la pantalla de mantenimiento de Electron, agregar un Error Boundary global al frontend (hoy un error de render puede dejar la pantalla en blanco, incluido el POS a mitad de un cobro), y corregir que desactivar un rol personalizado no revoca sus permisos en la práctica.

Ver el documento completo para el resto de las 20 propuestas (Prioridad Media/Baja), la deuda técnica identificada, y los riesgos pendientes.

---

## PARCHE 1.0.1 — Backup & Restore reales (Electron) — ✅ IMPLEMENTADO (06/08/2026)

Resuelve el único riesgo crítico identificado en la auditoría post-1.0 (ver sección anterior): no había backup automático funcional en una instalación real, y el restore estaba explícitamente sin implementar. **Cero cambios en este repositorio** — todo el trabajo fue en `carniceria-pos-backend` y `carniceria-pos-desktop`.

**Backend (`carniceria-pos-backend`):** `jobs/backup.job.ts` reescrito para invocar `pg_dump` directamente vía Node (`execFileAsync`, sin `bash`), con `POSTGRES_BIN_DIR` (nueva var opcional en `config/env.ts`) para ubicar el binario sin depender del `PATH`. Validación de tamaño de archivo > 0 bytes tras cada backup (si falla, se borra el archivo y se reporta error). `scripts/backup.sh`/`scripts/restore.sh` (bash) eliminados junto con sus npm scripts — ya sin uso.

**Desktop (`carniceria-pos-desktop`):** `pg_dump.exe`/`pg_restore.exe` vendoreados desde el paquete oficial de binarios de PostgreSQL 18.1 de EnterpriseDB (`vendor/postgres-client-tools/`, checksums documentados) y empaquetados dentro del instalador sin depender de nada externo al usuario. Nuevo `electron/backup-manager.ts` (`runBackup`/`runRestore`) orquesta ambas operaciones con las credenciales ya generadas por `PostgresManager`. El restore real (antes un stub `{implemented:false}`) queda así: selector nativo de archivo → **backup de seguridad automático del estado actual** (si falla, se aborta antes de tocar la base) → backend detenido → `pg_restore --clean` → reinicio completo del ERP (reutiliza la misma secuencia de arranque que "Reintentar"). Mientras dura la operación, la ventana de mantenimiento muestra "Restaurando respaldo... No cierre la aplicación" y bloquea sus propios botones y su cierre (`close`/`before-quit`) — sumado a que `mainWindow` ya queda cerrada/null en Modo Mantenimiento por diseño previo. Cada paso (inicio/éxito/error de backup y de restore) se registra con el `MainLogger` ya existente.

Validado con `tsc -b`/`tsc --noEmit` + `eslint` limpios en ambos repos (sin warnings nuevos) y `npm run build` verde en los tres. Backup y Restore quedan completamente funcionales para la 1.0.1.

**Corrección al cierre de este bloque:** el reporte inicial no había expuesto ningún botón en la interfaz para generar un respaldo manual — `runBackup()` solo se usaba internamente como respaldo de seguridad previo a un restore. Agregado un botón **"Crear respaldo"** en la misma pantalla de Mantenimiento/Splash, junto a "Restaurar respaldo": selector nativo de carpeta destino → `runBackup()` (mismo camino, sin implementación paralela) → estado "Generando respaldo..." con los 4 botones de mantenimiento deshabilitados → mensaje final con la ruta exacta del archivo generado, o el error correspondiente. Mismo `MainLogger` para cada paso. Cero cambios al frontend del ERP, ningún permiso nuevo. Splash: `.actions` con `flex-wrap` y ventana +40px de alto para que el cuarto botón no quede recortado. Revalidado con `tsc -b`/`eslint`/`npm run build`, sin warnings nuevos.

**Segunda corrección — causa raíz real (probado contra la instalación real, no solo compilación):** el Splash/Modo Mantenimiento solo es alcanzable cuando el arranque real FALLA — con una instalación sana, nunca se ve. Ni "Crear respaldo" ni "Restaurar respaldo" eran descubribles en el uso normal. Se agregó **Configuración → Respaldos** (`BackupsPage.tsx`, ruta `/settings/backups`, mismo permiso ya existente `SETTINGS_MANAGE`, mismo patrón visual/arquitectónico que `/settings/alegra`) como punto de entrada normal — el Splash y sus dos botones se mantienen intactos para cuando el ERP no llegue a arrancar. El frontend consume únicamente `window.electronAPI.pickBackupDestination/createBackup/pickBackupFile/restoreBackup` — los mismos 4 métodos ya expuestos por `preload.ts` desde la primera corrección, compartido por la ventana principal desde siempre; cero lógica nueva de backup/restore, cero IPC nuevo. Se oculta automáticamente fuera de Electron (mismo criterio de guard que `UpdateReadyDialog.tsx`). Único ajuste real del lado de Electron: `restoreBackup()` en `main.ts` ahora cierra `mainWindow` antes de reiniciar (si el restore se disparó con el ERP vivo) para no abrir una segunda ventana, y llama a `activateMaintenance()` si falla (para que el error quede visible en algún lado, dado que la ventana que lo disparó ya se cerró).

Probado contra la aplicación real corriendo (`npm run dev`, PostgreSQL/backend/ERP reales, no solo compilación): se encontró y corrigió un bug real — `pg_dump.exe`/`pg_restore.exe` vendoreados no traen sus propias DLLs (por diseño, ver su README) y, en desarrollo, `resolveClientTool()` cae al `.exe` vendoreado tal cual, en una carpeta sin esas DLLs — fallaba con `liblz4.dll: cannot open shared object file` (reproducido ejecutándolo a mano). No afecta la instalación real empaquetada (los `.exe` se copian dentro de `resources/postgres/bin/`, la misma carpeta que ya tiene esas DLLs), pero sí cualquier prueba en desarrollo. Corregido agregando `binDir` al `PATH` del proceso hijo en `backup-manager.ts` (`execEnvWithPassword()`) — inofensivo en producción, necesario en desarrollo. Confirmado con `runBackup()`/`runRestore()` reales contra el Postgres administrado de una sesión `npm run dev` real (respaldo real generado y restaurado con éxito, backend sano después). Revalidado `tsc -b`/`eslint`/`npm run build` en ambos repos.

---

## PARCHE 1.0.9 — Reporte de Utilidad (descuento por promoción) + UX del editor de imágenes del catálogo POS — ✅ IMPLEMENTADO (07/08/2026)

Dos incidencias reales reportadas por el usuario durante uso normal del sistema, analizadas y aprobadas por separado. **Cero cambios en `carniceria-pos-desktop`** — ambas son exclusivamente de este repositorio; esta versión del Desktop solo empaqueta el frontend actualizado.

**Incidencia 1 — Reporte de Utilidad no reflejaba descuentos por promoción automática.** Causa raíz: `ProfitReportItem.discount` solo expone `SaleItem.discount` (descuento MANUAL de línea) — un descuento aplicado por una promoción automática vive exclusivamente en `SaleAppliedPromotion.amountApplied`, nunca incluido en el `include` del Reporte de Utilidad. El Detalle de Venta sí lo mostraba (`getLineItemDiscount`, `features/sales/utils/saleDiscount.ts`); el reporte no. Corregido reutilizando el mismo criterio ya escrito para el Reporte de Ventas (`getSalesReport`, `reports.service.ts`): se agregó `appliedPromotions` al `include` de `profitReportInclude` (`reports.repository.ts`) y se derivó `discountPercent` (no-nulo solo cuando hay exactamente una promoción automática porcentual y ningún descuento manual, mismo criterio de "único porcentaje determinable sin ambigüedad"). Frontend: `ProfitReportTable.tsx` muestra una indicación pequeña bajo el nombre del producto — sin columnas nuevas, sin cambiar el ancho de la tabla, sin tocar la columna "Descuento" existente ni ningún cálculo de costo/utilidad/margen. Validado con una venta real (promoción automática temporalmente activada sobre datos de prueba ya existentes de QA16, revertida después) contra el backend real de localhost, coincidiendo exactamente con el % mostrado en el Detalle de Venta, y contra el backend real de la instalación Desktop (deploy temporal reversible de los `.js` compilados afectados).

**Incidencia 2 — Recorte agresivo de imágenes en las tarjetas del catálogo POS.** Causa raíz real (confirmada, no asumida): `ProductThumbnail.tsx` usa `object-fit: cover` sin excepción sobre un contenedor `aspect-[2/1]` (`MediaCard.tsx`) — cualquier imagen que no calce exacto con esa proporción se recorta agresivamente; afecta sobre todo a imágenes cargadas antes del editor de recorte del Bloque 10.1, o durante la ventana en que ese editor estuvo desalineado en 4:3. Tres iteraciones hasta la solución aprobada:
1. Se evaluó (y descartó tras revisión) tocar `object-fit` globalmente en `ProductThumbnail.tsx` — el componente tiene realmente 7 consumidores, no 2 como decía su propio comentario desactualizado; dos de ellos (`ProductSearchDialog.tsx`/`PurchaseItemCard.tsx`) son avatares `rounded-full`, donde `object-contain` se ve roto. Se agregó en su lugar una prop opcional aditiva `imageFit?: 'cover' | 'contain'` (default `'cover'`, sin cambios para los 6 consumidores existentes), usada únicamente por `MediaCard.tsx`.
2. Un primer intento de zoom inicial "contain" puro en el editor de recorte (`ProductImageCropperDialog.tsx`) sí eliminó el recorte agresivo, pero dejaba el producto chico dentro del marco (mostraba el 100% de la foto original, fondo incluido) — rechazado tras prueba real por no cumplir el objetivo real ("maximizar el producto", no solo "no cortarlo").
3. **Solución final aprobada:** interpolación lineal entre el zoom "contain" (foto completa) y "cover" (comportamiento agresivo original), vía una única constante `INITIAL_ZOOM_SAFETY_MARGIN = 0.8` en `ProductImageCropperDialog.tsx` — con el recorte centrado en ambos extremos, subir el zoom desde "contain" recorta primero el aire/fondo sobrante por igual en los 4 lados, acercándose al comportamiento tipo "autofit" de catálogos comerciales (Shopify/Square) sin agregar ninguna librería nueva ni analizar contenido de la imagen (asume producto razonablemente centrado, igual que el "cover" de siempre). El piso del zoom manual (`minZoom`) se mantiene calculado de forma dinámica y por imagen (nunca más bajo de lo indispensable) para que el usuario siempre pueda volver a "contain" completo a mano en casos excepcionales. `cropImage.ts` (el recorte real al confirmar), `ProductThumbnail.tsx` y `MediaCard.tsx` quedaron sin cambios en esta última iteración.

Validado con `tsc -b`/`eslint`/`npm run build` limpios en cada iteración, y con deploys temporales reversibles sobre la instalación Desktop real (backup previo, reversión verificada byte a byte contra el backup tras cada prueba) — nunca localhost/Chrome para la validación funcional final, según lo pedido explícitamente para este bloque.

**Incidencia 3 — Vuelto no reflejado como egreso en el Arqueo de caja — queda pendiente, sin implementar.** Confirmado con evidencia de código que NO es un bug de cálculo: `Sale.total` (usado por `sumCashSalesAmount`) ya es neto del vuelto (`amountPaid - changeGiven`), así que sumar `CHANGE` en Egresos duplicaría la resta — diseño ya deliberado y documentado en `schema.prisma`. El problema es puramente de percepción/UX (un movimiento real no tiene reflejo visual en el panel de Arqueo). Tres variantes de solución comparadas (línea nueva independiente / anotación bajo "Ventas en efectivo" / etiqueta en la propia pestaña Movimientos) — el usuario no eligió variante todavía; queda como bloque separado a retomar.

**Generación de versión (07/08/2026):** con las Incidencias 1 y 2 aprobadas, se documentaron los bloques cerrados, se subió `carniceria-pos-desktop/package.json` de `1.0.8` a `1.0.9`, y se generó un instalador local (`CarniceriaPOS-Setup-1.0.9.exe`, 451MB) sin publicar nada. **Superado por la versión 1.0.10** (ver sección siguiente y "VERSIÓN 1.0.10" más abajo): ese instalador 1.0.9 no incluía los Bloques 1-3 de la auditoría de riesgos críticos, generados después — la 1.0.10 los incorpora a todos. El `.exe` de 1.0.9 queda en `carniceria-pos-desktop/release/` como artefacto histórico, no destinado a publicarse.

---

## AUDITORÍA DE RIESGOS CRÍTICOS ANTES DE V1 (07/08/2026)

Auditoría técnica profunda (no cosmética) de matemática financiera, integridad de datos, atomicidad de transacciones y condiciones de carrera — Ventas, Compras, Devoluciones, Mermas, Caja, Promociones, Reportes. El método de pago "Mixto" fue **explícitamente excluido del alcance** por decisión del usuario (no forma parte de la V1) — cualquier hallazgo relacionado con Mixto fue descartado sin implementar, no quedó pendiente.

**5 hallazgos reales** (severidad tras foco exclusivo en flujos de producción, sin Mixto):

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Condición de carrera: Devoluciones, Cancelación de compras `RECEIVED` y Mermas verificaban stock con una lectura simple (sin bloqueo de fila), a diferencia de Ventas (`reserveIfSufficient`, atómico) | 🟠 Alto | ✅ **CERRADO** (Bloque 1) |
| 2 | El descuento acumulado de promociones `stackable` no se limita al valor real de la línea en `SaleAppliedPromotion.amountApplied` — el precio cobrado sí está protegido (nunca negativo), pero la cifra "auditada" por promoción puede sobrestimar el descuento real, afectando reportes de rentabilidad/subsidio de proveedor | 🟠 Alto | ⏳ **Pospuesto a v1.1** — no se modifica código hasta contar con un caso reproducible real (hoy es un análisis teórico de código, no un incidente observado) |
| 3 | Dos motores de redondeo monetario con precisión distinta: Ventas usa `Prisma.Decimal`, el Motor de Promociones usa `number`/`Math.round(v*100)/100` (riesgo clásico de precisión IEEE754 en casos puntuales) | 🟡 Medio | ⏳ **Pospuesto a v1.1** — no bloquea la V1 |
| 4 | División por cero teórica en el costo promedio ponderado (`updateProductCostsFromPurchase`) si el inventario llegara a quedar negativo — el Hallazgo 1 demuestra que ese estado era alcanzable en la práctica | 🟠 Alto | ✅ **CERRADO** (Bloque 2, red de seguridad defensiva) |
| 5 | Cierre de sesión de caja sin escritura condicional — dos solicitudes de "Cerrar caja" casi simultáneas podían sobrescribirse sin aviso de conflicto | 🟡 Medio | ✅ **CERRADO** (Bloque 3) |

### Bloque 1 — Condición de carrera en Inventario (Devoluciones/Compras/Mermas) — ✅ CERRADO (07/08/2026)

Mismo patrón atómico ya usado en Ventas (`inventory/repository.ts::reserveIfSufficient`, un `UPDATE` condicional que no cambia el valor pero toma el bloqueo de fila hasta el commit), extendido a los tres flujos que antes hacían "leer stock → validar en memoria → escribir después":
- **Devoluciones** (`returns/repository.ts`/`service.ts`): nueva `lockSaleItemsForUpdate()` — bloquea los `SaleItem` involucrados ANTES de leer cuánto se devolvió previamente (invariante distinto al de `Inventory`, mismo principio de bloqueo).
- **Cancelación de compra `RECEIVED`** (`purchases/service.ts`): reemplaza la lectura simple por `reserveIfSufficient()` por producto, dentro del mismo loop que ya existía.
- **Mermas** (`inventoryWaste/service.ts`): mismo reemplazo, con el mensaje de error informativo idéntico al anterior.

Validado con `tsc -b`/`eslint`/`npm run build` limpios y, contra la aplicación Desktop real (deploy temporal reversible): una devolución real (con segundo intento sobre la misma línea correctamente rechazado), una merma real (con intento de exceso correctamente rechazado con el stock real actualizado), y una cancelación de compra `RECEIVED` real (inventario revertido exactamente, 104→54 kg) — sin cambio de comportamiento visible, mismos mensajes de error.

### Bloque 2 — Protección del costo promedio ponderado — ✅ CERRADO (07/08/2026)

Red de seguridad defensiva en `updateProductCostsFromPurchase` (`purchases/service.ts`): antes de dividir, verifica que el inventario actual no sea negativo, que la cantidad comprada sea mayor a 0, y que el denominador de la fórmula sea mayor a 0 — si alguna falla, `ValidationError` claro en vez de la excepción cruda de `Prisma.Decimal` ante una división por cero. Cero cambio en la fórmula ni en su resultado para casos válidos.

Validado contra la aplicación Desktop real: compra real creada (10 kg a ₡5.000 sobre un producto con histórico real) → costo resultante ₡4.647,06, idéntico al calculado manualmente con la fórmula original — cero cambio de comportamiento en el caso válido.

### Bloque 3 — Cierre de caja atómico — ✅ CERRADO (07/08/2026)

Nueva `cashRepository.closeSessionIfOpen()` (`UPDATE ... WHERE status: 'OPEN'` en una sola sentencia, mismo principio que `reserveIfSufficient`) usada exclusivamente por `closeSession()` — `updateSession()` (compartida con la edición genérica de notas) queda intacta. Si otra transacción ya cerró la sesión, `count === 0` y se lanza el mismo `ConflictError` de siempre, sin sobrescribir el cierre ya realizado.

Validado contra la aplicación Desktop real disparando **dos cierres simultáneos reales** contra la misma sesión abierta: uno completó el cierre (200), el otro fue rechazado con el mismo error funcional de siempre (409, "La sesión de caja ya se encuentra cerrada") — estado final consistente, sin duplicar el cierre.

### Hallazgo 2 (Promociones acumulables) — ✅ CERRADO (07/08/2026) — ver "DEUDA TÉCNICA Y DECISIONES PENDIENTES"

En este bloque original quedó pospuesto hasta contar con un caso reproducible real — ese caso se obtuvo después (análisis dedicado, 07/08/2026) y el hallazgo se corrigió e implementó. Detalle técnico completo en "DEUDA TÉCNICA Y DECISIONES PENDIENTES" más abajo.

### Hallazgo 3 (Precisión monetaria) — pospuesto, sigue documentado como riesgo teórico

Pospuesto por no ser bloqueante para la V1. Analizado en detalle (07/08/2026): sin caso reproducible encontrado en este sistema — sigue como deuda técnica documentada, no requiere implementación por el momento. Ver "DEUDA TÉCNICA Y DECISIONES PENDIENTES" más abajo.

**Nota de alcance:** el hallazgo original de esta auditoría sobre pagos "Mixto" (invisibilidad en el Arqueo de Caja) fue **excluido explícitamente** por el usuario — ese flujo no forma parte de la V1, no se va a corregir, y no se va a volver a analizar. No es deuda técnica pendiente, es una decisión de alcance ya cerrada.

Detalle técnico completo (incluyendo el hallazgo de pago Mixto descartado, para referencia histórica) también en `carniceria-pos-backend/docs/AUDIT_REPORT.md`, sección 18.

---

## VERSIÓN 1.0.10 — Release Candidate (07/08/2026)

**Objetivo de esta versión:** empaquetar los Bloques 1, 2 y 3 de la "AUDITORÍA DE RIESGOS CRÍTICOS ANTES DE V1" (arriba) en un instalador real — ninguno de los tres estaba incluido en el instalador 1.0.9 ya generado (ver nota en "PARCHE 1.0.9"). `carniceria-pos-desktop/package.json` sube de `1.0.9` a **`1.0.10`**.

**Bloques cerrados incluidos:** Bloque 1 (condición de carrera en Inventario — Devoluciones/Compras/Mermas), Bloque 2 (protección del costo promedio ponderado), Bloque 3 (cierre de caja atómico) — los tres ✅ corregidos, validados (`tsc -b`/`eslint`/`npm run build` limpios) y probados contra la aplicación Desktop real, sin cambios de comportamiento visible para el usuario.

**Hallazgo 2 (Promociones acumulables) — ✅ CERRADO (07/08/2026)**, ver sección dedicada más abajo. **Hallazgo 3 (Precisión monetaria) — sigue pospuesto a v1.1** (no bloquea ni la 1.0.10 ni la V1): analizado en detalle, sin caso reproducible encontrado, se mantiene como riesgo teórico documentado.

**Fuera de alcance, decisión cerrada:** pago Mixto — no se implementa, no se vuelve a analizar.

Ver "Generación del instalador 1.0.10" más abajo para el resultado real del empaquetado y la validación funcional.

---

## VALIDACIÓN FISCAL CABYS ↔ IMPUESTO — ✅ COMPLETADA (07/08/2026)

**Objetivo:** cerrar el único riesgo fiscal real pendiente para la V1 (ver "🔴 DEUDA TÉCNICA CRÍTICA" más abajo, ahora resuelta) — que el ERP permitía guardar cualquier combinación CABYS/impuesto sin verificar su coherencia tributaria, con riesgo real de rechazo de comprobantes electrónicos ante Hacienda.

Ejecutado en tres bloques secuenciales, cada uno analizado, aprobado e implementado por separado:

1. **Extensión de la importación oficial de CABYS (backend).** El catálogo `CabysCode` solo guardaba `code`/`description`; el archivo oficial del BCCR trae además una columna "Impuesto" (verificado abriendo el `.xlsx` real completo, 20.507 filas: mezcla números decimales — `0.01`/`0.02`/`0.04`/`0.13` — y texto — `"Exento"`/`"1%"`/`"13%"`/`"na"`). Se agregó `CabysCode.taxIndicator` (`String?`, migración `20260807155805_add_cabys_tax_indicator`) y se extendió `import-cabys.ts` para capturarlo como columna **opcional** (el formato CSV simple sigue funcionando exactamente igual, sin esa columna). Sin cambios en el comportamiento de descarga/diff/aplicación ya existente.
2. **Validación CABYS ↔ Impuesto al crear/editar productos (backend).** Nuevo `modules/products/cabysTaxCoherence.ts`: interpreta `taxIndicator` (mismos 8 valores reales del catálogo, tabla de equivalencias documentada en el propio archivo) y compara contra el impuesto elegido. Si el catálogo no tiene información utilizable (`null`/`"na"`/código no importado), **nunca bloquea**. Si hay información y no coincide, `ValidationError` (422) con el código CABYS, el impuesto seleccionado y el impuesto oficial. Integrado en `products.service.ts::create()`/`update()` — sin tocar Facturación Electrónica, Alegra, Ventas, Compras, Reportes, ni productos existentes.
3. **Indicador visual preventivo en el formulario (frontend, con una extensión mínima de backend autorizada aparte).** `GET /cabys/lookup` ahora expone `taxIndicator` (cambio aditivo, de solo lectura, sin tocar filtro/orden/paginación). `ProductCabysField.tsx` muestra el impuesto oficial del BCCR debajo del CABYS elegido y compara en vivo contra el impuesto seleccionado: indicador verde si coincide, ámbar (nunca rojo) si no — puramente informativo, el `ValidationError` real al guardar no cambió.

**Catálogo real cargado de forma permanente:** el catálogo CABYS de la instalación Desktop real fue poblado con `taxIndicator` real del archivo oficial del BCCR (20.506 códigos, 20.506 con dato poblado, misma distribución que el archivo oficial) — ya no es un dato de prueba, es información fiscal real y persistente.

**Validado:** `tsc -b`/`eslint`/`npm run build` limpios en los tres bloques (backend y frontend). Los 8 casos de negocio (CABYS+impuesto correcto en 13%/1%/Exento, incorrecto, `"na"`, código inexistente, edición modificando solo el impuesto, edición sin tocar CABYS ni impuesto) probados contra la API real dentro de la aplicación Desktop instalada, y el resultado final confirmado visualmente por el usuario en la interfaz gráfica real de Productos (creación y edición) antes de aprobar el cierre del bloque.

**Estado:** el instalador `1.0.10` ya generado (ver sección de arriba) es anterior a este bloque y no lo incluye — el código ya está en los repos `carniceria-pos-front`/`carniceria-pos-backend`, pendiente de un nuevo build para empaquetarse formalmente (no generado en este cierre de documentación, a pedido explícito).

### 🟡 PENDIENTE — Actualización automática del catálogo CABYS (registrado 07/08/2026) — Prioridad Media, no bloqueante

**Objetivo:** permitir actualizar el catálogo oficial CABYS directamente desde la aplicación, sin depender de procesos manuales ni scripts (`import-cabys.ts` sigue siendo hoy la única vía, ejecutado a mano desde terminal).

**Estado actual (base sobre la que se construiría):** el sistema ya puede importar el catálogo oficial del BCCR; el bootstrap automático (`import-cabys-bootstrap.ts`) carga el catálogo cuando la tabla está vacía; el catálogo almacena `code`/`description`/`taxIndicator`; la validación fiscal CABYS ↔ Impuesto (sección de arriba) ya consume esa información.

**Alcance esperado:**
- Acción administrativa "Actualizar catálogo CABYS" desde la interfaz (no expuesta hoy — `import-cabys.ts` no tiene ruta HTTP).
- Descarga automática del archivo oficial más reciente del BCCR, reutilizando `downloadOfficialCatalog()`/`readCabysFile()`/`computeDiff()`/`applyDiff()` ya existentes (mismo proceso, sin reimplementar lógica).
- Actualiza códigos nuevos, descripciones, `taxIndicator` y cualquier otra información oficial disponible del archivo.
- Resumen del resultado tras ejecutar: registros agregados, actualizados, sin cambios, y fecha de la actualización.

**Mejora adicional recomendada (parte del mismo pedido, no implementada):** después de actualizar el catálogo, detectar productos existentes cuyo impuesto ya no coincida con el nuevo `taxIndicator` oficial de su CABYS (reutilizando `cabysTaxCoherence.ts`) y mostrar un reporte de revisión para que el administrador los corrija antes de emitir nuevas facturas — **nunca modificar automáticamente el impuesto de ningún producto**; la actualización solo informa diferencias, la decisión final es siempre del administrador. Esto es exactamente la "sincronización automática de productos existentes" que los bloques de la Validación fiscal CABYS ↔ Impuesto excluyeron explícitamente de su alcance.

**Cuándo implementarse:** no bloquea el funcionamiento actual del sistema ni el cierre de la V1 — pendiente de implementación futura, sin Bloque/Sprint agendado todavía.

---

## MÓDULO DE DESPIECE (08/08/2026, backend-only hasta ahora) — Plan v3 aprobado, Bloques 1-3 ✅ CERRADOS, Bloque 4 PRÓXIMO

**Qué es:** nuevo módulo de negocio para carnicerías que reciben animales/canales completos y necesitan despiezarlos en múltiples cortes/subproductos con trazabilidad de peso, costos y merma — antes del análisis que originó este trabajo, el sistema **no** soportaba este flujo (confirmado con una investigación explícita del código real de Inventario/Compras/Productos antes de proponer cualquier solución). Trabajo ejecutado como una secuencia de Bloques, mismo método que el resto del proyecto: análisis → plan escrito → corrección del plan (dos rondas, ver abajo) → aprobación explícita → implementación mínima por bloque → validación → reporte → aprobación → siguiente bloque.

**Este módulo es independiente de la lista "ROADMAP OFICIAL HACIA 1.0"** (sección más abajo) — no es un requisito de Release 1.0, es una funcionalidad nueva en curso. No confundir su estado "en progreso" con el resto del ERP, que es Release Candidate.

### Plan v3 — historia de las dos correcciones antes de la aprobación final

El plan de implementación pasó por dos rondas de corrección explícita del usuario antes de aprobarse como "v3":
1. **v1 → v2:** `InventoryMovementType.PROCESSING_IN`/`PROCESSING_OUT` estaban invertidos respecto al precedente ya establecido por `TRANSFER_IN`/`TRANSFER_OUT` (`IN` = el stock aumenta, `OUT` = disminuye) — corregido; y el ejemplo numérico de distribución de costos fue re-verificado matemáticamente de punta a punta (sin redondear porcentajes antes de multiplicar).
2. **v2 → v3 (final):** tres correcciones más — (a) `inputBatchId` obligatorio **por regla de negocio, no por schema** (columna nullable a propósito) cuando `Product.requiresBatch` es `true`, validado tanto al crear como al completar; (b) definición explícita y separada de MERMA (peso genuinamente perdido, sin valor — hueso/grasa/recorte) vs. SUBPRODUCTO (recuperable/vendible, se convierte en una línea de salida con su propio lote); (c) el ejemplo numérico completo reescrito sin ningún valor truncado, con el algoritmo de "la última línea absorbe el residuo de redondeo" (mismo patrón ya usado por `promotionApplication.service.ts::translateEngineResult`) y una demostración algebraica de que el margen resultante es idéntico en todas las líneas de salida por construcción.

### Bloque 1 — Schema/Migración — ✅ COMPLETADO Y APROBADO

100% aditivo, sin tocar ningún campo/tabla existente. `prisma/schema.prisma`:
- `enum ProcessingStatus { DRAFT COMPLETED CANCELLED }` (nuevo).
- `enum InventoryMovementType`: `+PROCESSING_IN` (stock de un corte/subproducto entra), `+PROCESSING_OUT` (stock del canal de entrada sale).
- `enum WasteReason`: `+PROCESSING_LOSS`.
- `model ProcessingOperation` (nuevo): cabecera de la operación — `code`, `sucursalId`, `userId`, `inputProductId`, `inputBatchId` (nullable a nivel de columna, obligatorio por regla de negocio cuando aplica, ver Bloque 2), `inputQuantity`, `inputUnitCost` (snapshot), `status`, `completedAt`, `notes`.
- `model ProcessingOutputItem` (nuevo): una línea de salida (corte/subproducto) — `outputProductId`, `quantity`, `salePriceSnapshot`, `allocatedCost` (nullable, se llena al completar), `outputBatchId` (`@unique`, nullable).
- `Batch.parentBatchId` (columna aditiva, nullable, self-relation `BatchLineage`) — trazabilidad de linaje: qué lote de entrada originó este lote de salida.
- `InventoryWaste.processingOperationId` (columna aditiva, nullable) — vincula una merma a la operación que la originó.
- Migración: `20260808175831_add_processing_module_despiece` — revisada línea por línea antes de aplicar (`prisma migrate dev --create-only` → revisión manual → `prisma migrate deploy`), confirmada 100% aditiva (solo `CREATE TABLE`/`ALTER TYPE ... ADD VALUE`/`ADD COLUMN` nullable, ningún `DROP`/`ALTER` destructivo).
- Validado: `prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`, `npm run build`, y una verificación puntual de que ningún módulo existente (conteos de registros, endpoints existentes) cambió de comportamiento.

### Bloque 2 — Backend Core (`processing/service.ts` + `repository.ts` + `types.ts`) — ✅ COMPLETADO Y APROBADO

Implementado, sin endpoints HTTP todavía (ver Bloque 3):
- **Ciclo de vida del `DRAFT`:** crear (`create`), consultar (`findById`/`findMany`), editar cabecera (`update`, solo `notes`), cancelar (`cancel`).
- **Líneas de salida** (`ProcessingOutputItem`): `addOutputItem`/`updateOutputItem`/`removeOutputItem` — el producto de salida debe existir y ser distinto del producto de entrada; `salePriceSnapshot` se captura de `Product.salePrice` al agregar la línea (nunca se relee después, para que el cálculo de costo sea estable).
- **Líneas de merma** (`ProcessingWasteItem`) — **corrección de alcance aprobada durante la revisión de este bloque:** originalmente implementada como un valor derivado implícito (`inputQuantity - Σsalidas`); el usuario pidió líneas reales, individualmente editables, con cantidad + motivo (`WasteReason`) + notas — se agregó el modelo `ProcessingWasteItem` (migración adicional `20260808183926_add_processing_waste_items`, también 100% aditiva) y `addWasteLine`/`updateWasteLine`/`removeWasteLine`.
- **Balance de peso — igualdad EXACTA** (no un residuo tolerado): `inputQuantity === Σ(outputItems.quantity) + Σ(wasteLines.quantity)`, validada durante la edición (límite superior) y de forma definitiva en `complete()`. **Importante — corrección de precisión aprobada:** toda esta aritmética usa `Prisma.Decimal` (nunca `number` nativo), mismo criterio que el dominio de dinero del proyecto (`shared/utils/money.ts`) aplicado ahora también a cantidades — evita falsos positivos/negativos por imprecisión de punto flotante, tanto en la comparación de igualdad exacta de `complete()` como en las validaciones de límite superior durante la edición del borrador.
- **Validación de lote de entrada:** `inputBatchId` obligatorio cuando `Product.requiresBatch` es `true` (ver Bloque 1), validado tanto en `create()` como de nuevo, releído dentro de la transacción, en `complete()`.
- **Validación de stock:** mismo patrón atómico ya usado por Ventas/Mermas (`reserveIfSufficient`, un `UPDATE` condicional que toma el bloqueo de fila sin cambiar el valor).
- **`complete()` — transacción atómica única:** revalida `DRAFT` + balance exacto dentro de la transacción → reserva/valida stock → consume el canal de entrada completo (`PROCESSING_OUT`) → distribuye el costo total del canal (`inputQuantity × inputUnitCost`) entre las salidas por el **método de valor relativo de venta** (`quantity × salePriceSnapshot` de cada línea), con la última línea absorbiendo el residuo de redondeo (mismo algoritmo que `promotionApplication.service.ts::translateEngineResult`) → crea un `Batch` nuevo por cada línea de salida y acredita su stock (`PROCESSING_IN`, `skipBatchQuantitySync: true`, mismo patrón que Compras/Devoluciones) → materializa cada línea de merma como su propia `InventoryWaste` (documental, **sin** volver a llamar `recordMovement` — el descuento ya ocurrió completo con `PROCESSING_OUT`, evita duplicar la pérdida) → marca `COMPLETED`.
- **Regla de costeo aprobada:** una línea de salida individual puede tener `salePriceSnapshot = 0` (un subproducto sin precio de venta definido todavía puede existir e ingresar a inventario, recibe `allocatedCost = 0`, método de valor neto realizable estándar) — solo se bloquea con `ValidationError` el caso degenerado en que **todas** las salidas están en 0 (sin ninguna base no arbitraria para prorratear). Deliberadamente **sin** ningún fallback por peso u otro método alternativo.
- **`COMPLETED` es inmutable** — ninguna función del servicio permite modificar una operación que no sea `DRAFT`. **`CANCELLED` nunca toca inventario** — cancelar un `DRAFT` es solo un cambio de `status`, sin `recordMovement`/`Batch`/`InventoryWaste` de por medio (nada se había descontado todavía).
- **Corrección de alcance aprobada (`parentBatchId`):** la primera implementación extendía el DTO compartido `batches/types.ts::CreateBatchDto` con un campo opcional `parentBatchId` — el usuario pidió evitar tocar el módulo `batches` y usar un mecanismo más acotado dentro de `processing/`. Se revirtió esa extensión (`batches/types.ts`/`batches/service.ts` confirmados sin ninguna diferencia contra su estado previo, verificado con `git diff`) y se reemplazó por `processing/repository.ts::linkOutputBatchParent`, que escribe `Batch.parentBatchId` directamente vía el cliente Prisma compartido, dentro de la misma transacción de `complete()` — ese campo no tiene ninguna regla de negocio asociada en el módulo `batches`, así que escribirlo ahí no requiere conocer ni duplicar lógica de ese módulo.
- Validado en cada iteración: `prisma validate`/`generate`, `tsc --noEmit`, `eslint`, `npm run build` — siempre limpio, sin warnings nuevos.

### Bloque 3 — API + Permisos — ✅ COMPLETADO Y APROBADO

`src/modules/processing/controller.ts`/`routes.ts` (nuevos) — delegan al `service.ts` del Bloque 2, sin duplicar lógica de negocio. Montado bajo `/processing` en `modules/index.ts` como módulo de primer nivel (no subordinado a Inventario, a diferencia de `batches`/`inventoryWaste` — el plan v3 lo trata como su propio dominio, mismo criterio que Compras/Ventas/Devoluciones).

**12 endpoints finales** (todos con `authenticate` + `authorizePermission` + rate limiter, mismo patrón que `sales/routes.ts`/`batches/routes.ts`):

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/processing` | `processing.create` |
| GET | `/processing` | `processing.view` |
| GET | `/processing/:id` | `processing.view` |
| PATCH | `/processing/:id` | `processing.create` |
| POST | `/processing/:id/complete` | `processing.complete` |
| POST | `/processing/:id/cancel` | `processing.create` |
| POST | `/processing/:id/output-items` | `processing.create` |
| PATCH | `/processing/:id/output-items/:itemId` | `processing.create` |
| DELETE | `/processing/:id/output-items/:itemId` | `processing.create` |
| POST | `/processing/:id/waste-items` | `processing.create` |
| PATCH | `/processing/:id/waste-items/:itemId` | `processing.create` |
| DELETE | `/processing/:id/waste-items/:itemId` | `processing.create` |

**Corrección de alcance aprobada:** la primera entrega de este bloque solo cubrió los 6 endpoints de cabecera (crear/listar/ver/editar/completar/cancelar) — el usuario notó, correctamente, que sin endpoints para las líneas de salida/merma (ya implementadas en el Bloque 2) ninguna operación podía completarse nunca vía API. Se agregaron las 6 rutas de `output-items`/`waste-items` en una segunda pasada del mismo bloque, reutilizando exactamente los services del Bloque 2 sin ningún cambio a `service.ts`/`repository.ts`.

**Permisos** (`prisma/permissionsBootstrap.ts`, sembrados en `INITIAL_PERMISSIONS`, corren en cada arranque vía `seedPermissionsAndRoles()`):
- `processing.view` — ver/listar operaciones.
- `processing.create` — cubre **todo** el ciclo de vida del `DRAFT`: crear, `PATCH`, cancelar, y el CRUD completo de líneas de salida/merma.
- `processing.complete` — permiso separado y más elevado, exclusivo de `POST /:id/complete` (la única acción que efectivamente descuenta/acredita inventario real) — mismo criterio que `sales.void`/`sales.correct` siendo permisos distintos de `sales.create`.

Asignación por rol: **ADMIN** los tres (hereda automáticamente todo `INITIAL_PERMISSIONS`); **MANAGER** los tres (mismo criterio que `batches.*`); **CASHIER** ninguno.

Validado: `tsc --noEmit`, `eslint`, `npm run build` — limpio en ambas pasadas del bloque.

### Estructura actual de `src/modules/processing/` (backend)

```
types.ts        # DTOs y formas de respuesta (ProcessingOperation/OutputItem/WasteItem)
repository.ts    # acceso a datos puro (incl. linkOutputBatchParent, createWasteRecord)
service.ts       # toda la lógica de negocio (Bloque 2)
validation.ts    # esquemas Zod, para create/update de operación, output-items y waste-items
controller.ts    # 12 handlers HTTP (Bloque 3), delegan a service.ts
routes.ts        # router Express, 12 rutas
index.ts         # barrel — único punto de import desde fuera del módulo
```

### Migraciones creadas (backend, `prisma/migrations/`)

- `20260808175831_add_processing_module_despiece` (Bloque 1) — `ProcessingStatus`, `ProcessingOperation`, `ProcessingOutputItem`, `Batch.parentBatchId`, `InventoryWaste.processingOperationId`, `PROCESSING_IN`/`PROCESSING_OUT`/`PROCESSING_LOSS`.
- `20260808183926_add_processing_waste_items` (Bloque 2, corrección de mermas) — `ProcessingWasteItem`.

Ambas revisadas manualmente antes de aplicar, ambas 100% aditivas.

### Qué NO debe modificarse sin una razón real nueva

- Las decisiones ya aprobadas de los Bloques 1-3 de este módulo (schema, algoritmo de costeo, balance exacto con `Decimal`, `parentBatchId` vía `linkOutputBatchParent`, la matriz de permisos) — no se reabren salvo un conflicto real descubierto durante la implementación del Bloque 4 en adelante.
- `batches/types.ts`/`batches/service.ts` — confirmados sin ninguna diferencia respecto a su estado antes de este módulo; no reintroducir la extensión de `CreateBatchDto` que se revirtió.
- No avanzar a ningún Bloque 5+ (frontend) sin autorización explícita — "seguir con el roadmap" no es autorización para arrancar el siguiente bloque.

### Roadmap restante del módulo (ninguno iniciado)

- **Bloque 4 — Inventario + Trazabilidad + Auditoría (🔴 PRÓXIMO):** validar de punta a punta los movimientos `PROCESSING_OUT`/`PROCESSING_IN` ya generados, la trazabilidad completa (`parentBatchId`/`inputBatchId`/`outputBatchId`/`InventoryWaste`/`referenceType`+`referenceId`), auditoría, y un reporte de rendimiento del despiece (peso/costo/margen por línea de salida).
- **Bloque 5 — Frontend Data Layer:** `api/processing.api.ts`, hooks TanStack Query, `types/processing.types.ts`, `schemas/processing.schema.ts` — mismo patrón ya establecido por el resto de `src/features/` en este repo.
- **Bloque 6 — Frontend Listado + Creación:** listado de operaciones, filtros, paginación, creación de `DRAFT` (selección de producto/canal, lote, cantidad de entrada).
- **Bloque 7 — Frontend Despiece:** detalle de una operación, gestión de cortes/subproductos y mermas, balance de peso en vivo, validaciones, completar.
- **Bloque 8 — Navegación + Reportes:** entrada en `NAV_ITEMS`, permisos en el sidebar (`Can`), reporte de rendimiento, trazabilidad visible.
- **Bloque 9 — QA final:** prueba end-to-end real (compra de canal → lote → despiece → cortes/subproductos/mermas → costos → inventario → trazabilidad → auditoría), `tsc`/`eslint`/`build` en los repos afectados, regresión de funcionalidades existentes.

---

## DEUDA TÉCNICA Y DECISIONES PENDIENTES

Decisiones de producto/arquitectura, no defectos de código (reconfirmadas en Fase 12, sin cambios desde entonces salvo donde se indica):

- **M-06** — vistas SQL sin aplicación automática (decisión de despliegue/CI-CD).
- **M-15** — timeout de inactividad de sesión (mecanismo y duración).
- **M-17** — paginación de `getLowStock` (comportamiento actual ya intencional según el código; decisión de producto confirma o cambia).
- **M-21** — ventana temporal de `vw_dashboard` (período a mostrar, sin definición documentada).
- **M-31** — `roles.service.ts` ignora `permissionIds` en `update()`. **No es un bloqueante real**: el frontend ya lo rodea desde el propio rediseño de Roles — la edición de permisos de un rol existente usa el endpoint dedicado `PATCH /roles/:id/permissions` (`useAssignRolePermissions`), nunca `update()`. Sigue abierto como limpieza de contrato de la función, sin impacto funcional.
- **A-17 — bug de UI del `Select` de "Tipo de movimiento" (Movimiento de caja).** Registrado como bloqueante en la auditoría original; **no se reprodujo en ninguno de los bloques recientes de Caja/POS**, donde ese mismo `Select` (`CashMovementForm.tsx`) fue reestilizado y quedó en uso activo en 3 pantallas distintas sin incidentes — es el mismo primitivo (`components/ui/select.tsx`) que ya funciona en ~20 formularios del resto del sistema. Se mantiene documentado en vez de cerrarlo sin evidencia directa; recomendado una verificación puntual final antes de darlo por cerrado formalmente, pero **ya no se considera un bloqueante de Release 1.0**.
- Permiso granular propio para `audit` (hoy sin ningún código en el catálogo).
- ~~Facturación Electrónica (Hacienda, Costa Rica) — no integrada~~ — **RESUELTO (04/08/2026).** Ver "FACTURACIÓN ELECTRÓNICA — INTEGRACIÓN CON ALEGRA (Bloques 7.1–7.20)" arriba. Integrada vía Alegra, no vía firma/envío directo a Hacienda.
- ~~**Crash bajo carga tras compras consecutivas (registrado 2026-08-02, sin investigar).**~~ — **RESUELTO (03/08/2026).** Ver "✅ Bloques críticos de estabilidad — CERRADOS" abajo — reemplaza la sección "Deuda técnica prioritaria" que documentaba este hallazgo como abierto.
- ~~**Hallazgo 2 (registrado 07/08/2026, Auditoría de riesgos críticos antes de V1)** — el descuento acumulado de promociones `stackable` no se limita al valor real de la línea en `SaleAppliedPromotion.amountApplied`~~ — **✅ CERRADO (07/08/2026).** Ver sección dedicada "HALLAZGO 1 — PROMOCIONES ACUMULABLES (amountApplied)" más abajo (nota: ese análisis dedicado lo llamó "Hallazgo 1" por ser el primero de dos hallazgos financieros re-analizados ese día — es el mismo ítem que este "Hallazgo 2" de la auditoría original).
- **Hallazgo 3 (registrado 07/08/2026, Auditoría de riesgos críticos antes de V1)** — el Motor de Promociones (`shared/services/promotionEngine/calculation.ts`, `modules/promotions/promotionApplication.service.ts`) redondea con `number`/`Math.round(v*100)/100`, no con `Prisma.Decimal` como el resto del dominio de Ventas (`shared/utils/money.ts`) — riesgo clásico de precisión IEEE754 (ej. `1.005`) en casos puntuales, ya corregido una vez del lado de `Decimal` pero no replicado acá. Impacto bajo (discrepancias de un centavo en casos raros), reabrir la decisión de arquitectura ya documentada de mantener el motor desacoplado de `@prisma/client` requiere justificación de peso. **Reanalizado en detalle (07/08/2026, ver sección dedicada más abajo): sin caso reproducible encontrado en este sistema — 🟡 se mantiene documentado como riesgo teórico, no requiere implementación por el momento.**

### ✅ HALLAZGO 1 — PROMOCIONES ACUMULABLES (`amountApplied`) — CERRADO (07/08/2026)

(Llamado "Hallazgo 2" en la auditoría original de riesgos críticos del 07/08/2026 — mismo ítem, ver arriba.) Analizado con un caso reproducible real y corregido en el mismo día: dos o más promociones `stackable` sobre una misma línea se evaluaban de forma independiente sobre el subtotal bruto original, sin descontar lo que ya aplicó otra promoción acumulable — la suma de `amountApplied` podía superar el subtotal real de la línea, aunque `adjustedLineSubtotal` (lo efectivamente cobrado) ya estaba protegido por `Math.max(0, ...)`.

**Corrección implementada, localizada únicamente en `translateEngineResult`** (`modules/promotions/promotionApplication.service.ts`, backend): cuando la suma de `amountApplied` de una línea supera su subtotal real, se prorratean los montos ya calculados de esa línea (proporcional a su peso, la última entrada absorbe el residuo de redondeo) para que la suma coincida exactamente con el subtotal real.

**Sin cambios en:** el motor de promociones (`promotionEngine/`), las reglas `stackable`/no-`stackable`, `adjustedLineSubtotal`, el monto pagado por el cliente, Facturación Electrónica, Alegra, el schema ni la base de datos.

**Efecto en consumidores existentes (sin tocar su código):** el Reporte de Utilidad, el ticket/recibo y el cálculo del aporte de proveedor (`pricingAnalysis.ts`) ahora usan el descuento real de cada promoción — ya no pueden quedar inflados por promociones acumulables que sumen más del 100% de una línea.

**Validado:** `tsc -b`/`eslint`/`npm run build` limpios. Casos probados contra datos reales (dev y aplicación Desktop real, con promociones temporales creadas y eliminadas): stackable 60%+50% sobre ₡1.000 → `amountApplied` total = ₡1.000 exacto (antes ₡1.100), `adjustedLineSubtotal` sin cambios (₡0); stackable sin exceder subtotal, una sola promoción, y dos promociones no-stackable — los tres casos dan resultados idénticos a los de antes del fix, confirmando que no hubo regresión. Sin residuos de datos de prueba en ninguna de las dos bases. Ver `carniceria-pos-backend/docs/AUDIT_REPORT.md`, sección 18 (punto 2, actualizado), para el detalle técnico completo.

### 🟡 HALLAZGO 2 — PRECISIÓN MONETARIA (Decimal vs number) — reanalizado, sigue pendiente sin caso reproducible

(Llamado "Hallazgo 3" en la auditoría original de riesgos críticos del 07/08/2026 — mismo ítem, ver arriba.) Reanalizado en detalle el 07/08/2026, junto con el Hallazgo 1: se revisaron todos los usos de `Decimal`/`number`/`Math.round`/conversiones en el dominio de Ventas y Promociones. Conclusión: **sin caso reproducible encontrado en este sistema** — el ejemplo numérico probado (₡1.005 con descuento de 33,33%) da el mismo resultado con `number`+`Math.round` que con `Prisma.Decimal`. Es un riesgo de clase conocida (precisión IEEE754), ya identificado y aceptado explícitamente en un comentario del propio código (`calculation.ts`), no un descuido oculto. **No requiere implementación por el momento** — corregirlo implicaría reabrir la decisión arquitectónica ya documentada de mantener el motor de promociones desacoplado de `@prisma/client`, sin que exista hoy un incidente real que lo justifique.

### 🔴 DEUDA TÉCNICA CRÍTICA (registrada 04/08/2026, durante la fase de QA por módulos) — ✅ RESUELTA (07/08/2026)

~~**Validación CABYS ↔ Impuesto.** El ERP permite hoy asignar **cualquier** impuesto a **cualquier** código CABYS al crear/editar un producto (`features/products/`, `products.validation.ts` del backend) — no existe ninguna verificación de que la combinación sea tributariamente coherente. Esto puede producir productos con una combinación CABYS/impuesto inválida ante Hacienda, provocando el rechazo de comprobantes electrónicos reales al facturar esa línea vía Alegra (Bloques 7.1–7.20/8.4), o inconsistencias fiscales silenciosas en productos que nunca llegan a facturarse electrónicamente.~~

**RESUELTO (07/08/2026).** Ver sección dedicada "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO" más arriba para el detalle completo de los tres bloques implementados (extensión de importación, validación al crear/editar, indicador visual preventivo). El backend valida la coherencia CABYS↔impuesto al crear y editar productos (`ValidationError`, sigue siendo la protección final); el formulario ahora además muestra el impuesto oficial del BCCR y un indicador de coincidencia antes de guardar. Validado contra la aplicación Desktop real, incluida confirmación visual del usuario en la interfaz. Era la única deuda de esta lista con riesgo fiscal/de negocio real (rechazo de comprobantes ante Hacienda) — el resto de los ítems de "DEUDA TÉCNICA Y DECISIONES PENDIENTES" son decisiones de producto o limpiezas de contrato sin ese riesgo.

### 🟡 DEUDA TÉCNICA DE ARQUITECTURA (registrada 04/08/2026, durante QA.11 — Roles) — no bloqueante para Release 1.0

**Resolución de permisos por `roleId` en vez de por nombre de rol.** Durante QA.11 se confirmó que las sesiones activas almacenan el **nombre** del rol en el JWT, y que la resolución de permisos (`roles.service.ts::hasPermission()`, consumida por `middlewares/authorize.middleware.ts`) busca el rol por ese mismo nombre. Esto provoca que un cambio de nombre de rol invalide de inmediato la resolución de permisos de todas las sesiones activas bajo ese nombre, hasta que cada usuario vuelva a iniciar sesión.

- **Mitigación ya aplicada (QA.11, 04/08/2026):** se bloqueó renombrar un rol de sistema (`ADMIN`/`MANAGER`/`CASHIER`) — el escenario de mayor riesgo real, porque además de la invalidación de sesiones descrita arriba, renombrar específicamente el rol `ADMIN` bypasseaba en silencio dos salvaguardas de seguridad ya establecidas que comparan por nombre literal contra `SystemRole.ADMIN` (`users.service.ts::assertRoleAssignable` y `roles.service.ts::assignPermissions`), permitiendo que un usuario sin privilegios de ADMIN se autoasignara (o asignara a otra cuenta) un rol con todos los permisos de ADMIN, incluido `roles.manage`. Confirmado y corregido — ver histórico de QA.11.
- **Limitación de fondo, todavía sin resolver:** para roles **personalizados** (no de sistema), la limitación arquitectónica sigue existiendo tal cual — renombrar cualquiera de ellos con sesiones activas bajo ese nombre las deja sin poder pasar ninguna verificación de permiso hasta el próximo login. No representa el mismo riesgo de escalamiento de privilegios que el caso ADMIN (ya cerrado), pero sigue siendo un comportamiento incorrecto/confuso en producción.
- **Objetivo futuro:** migrar la resolución de permisos para que use el identificador interno del rol (`roleId`) en vez de su nombre — un cambio de nombre de rol no debería afectar ninguna sesión activa ni su resolución de permisos.
- **Alcance esperado (versión mayor futura):** JWT usando `roleId` en vez de `role.name`; resolución de permisos basada en `roleId`; cache de permisos (`shared/services/permissionCache.service.ts`) adaptada a `roleId`; `middlewares/authorize.middleware.ts` actualizado; mantener la compatibilidad con la invalidación de sesiones vía `tokenVersion` (mecanismo ya existente e independiente de este cambio).
- **Cuándo implementarse:** **no en el Release 1.0.** Es un cambio de arquitectura de autenticación/autorización — deliberadamente **no implementado** al registrar este hallazgo (04/08/2026), documentado únicamente como deuda técnica de arquitectura para una futura versión mayor del sistema.

### 🟡 DEUDA TÉCNICA (registrada 04/08/2026, durante QA.16A/QA.16B) — no bloqueante para Release 1.0

~~**1. `checkInvoiceStatus()` (Alegra, Bloque 7.8) es código huérfano — implementado pero inalcanzable.**~~ — **RESUELTO (05/08/2026, "Fix 05/08/2026", fuera de los bloques de este QA Final).** Confirmado durante la revisión de Facturación Electrónica del Bloque 6: la ruta `GET /integrations/alegra/sales/:saleId/status` ya existe (`alegra.routes.ts`/`alegra.controller.ts`, mismo permiso `sales.view` que PDF/XML) y el frontend ya la consume — `alegraApi.checkInvoiceStatus()`, `useSaleDocumentActions.ts::handleCheckInvoiceStatus`, botón "Actualizar estado" (ícono `RefreshCw`) visible en "Documentos y comprobantes" de `SaleDetailContent.tsx`. Este hallazgo de deuda técnica queda cerrado — no requirió ningún cambio en este bloque, solo se corrige la documentación que había quedado desactualizada.

**2. Falta de validación de formato UUID en parámetros `:id` de rutas — en prácticamente todo el backend.** Ningún controlador `findById`/`update`/etc. (`Products`, `Categories`, `Suppliers`, `Inventory`, y virtualmente todos los demás módulos) valida que `req.params.id` tenga formato UUID antes de pasarlo a Prisma. Un id malformado en la URL produce un `500 INTERNAL_ERROR` que **filtra un stack trace interno de Prisma** (ruta de archivo del backend, nombre de la consulta, mensaje crudo del motor) en el campo `details` de la respuesta, en vez de un `400`/`404` limpio. Reproducido y confirmado durante QA.16A (`GET /inventory/movements` — interpretado como `GET /inventory/:id` con `id="movements"` — devolvió ese 500 con detalles internos).
- **Alcance esperado:** validación centralizada de `:id` como UUID (Zod, a nivel de middleware o de cada schema de ruta) aplicada de forma transversal a todos los módulos — es, por naturaleza, un cambio que toca decenas de archivos, por eso queda fuera de cualquier bloque de QA puntual.
- **Cuándo implementarse:** evaluar antes de una versión futura (no bloqueante para Release 1.0, pero mejora la robustez/seguridad de la API frente a clientes que envíen ids malformados).

### 🟡 DEUDA TÉCNICA (registrada 05/08/2026, durante QA.APP.3 — estabilidad del ciclo de vida de Electron) — no bloqueante para Release 1.0

Contexto: QA.APP.3 auditó el ciclo de vida completo de `carniceria-pos-desktop` (suspend/resume, recuperación automática del backend, memory leaks, procesos huérfanos, cierre limpio) contra un `.exe` empaquetado real. Se encontró y corrigió un bug real y reproducible (ver el bloque QA.APP.3 para el detalle completo — `electron/updater.ts`: fuga de listeners del singleton `autoUpdater` en cada "Reintentar" desde Modo Mantenimiento, confirmada con evidencia real y corregida con `removeAllListeners()`). Los siguientes hallazgos, en cambio, **no se corrigieron** por no ser bugs reales reproducibles a través del uso normal de la app (instrucción explícita del bloque: "solo corregí bugs reales reproducidos o riesgos críticos demostrables") — quedan documentados como deuda técnica:

**1. `openMainWindow()` (`main.ts`) no verifica si `mainWindow` ya existe antes de crear una ventana nueva.** Reproducido de forma sintética invocando `retryStartup()` (la misma función IPC detrás del botón "Reintentar" de Modo Mantenimiento) varias veces mientras la ventana principal ya estaba abierta y sana — cada llamada creó una `BrowserWindow` adicional en vez de reutilizar/reemplazar la existente (confirmado: 4 ventanas `app://bundle` simultáneas tras 3 llamadas). **No es alcanzable a través del flujo real de la UI**: el único disparador real de `retryStartup()` es el botón "Reintentar" de la pantalla de Modo Mantenimiento, y `activateMaintenance()` siempre anula `mainWindow` (`mainWindow.close(); mainWindow = null;`) antes de mostrar esa pantalla — así que en el uso normal, `mainWindow` siempre es `null` en el único momento real en que `retryStartup()` puede dispararse.
- **Alcance esperado:** un guard defensivo simple en `openMainWindow()` (cerrar/reutilizar `mainWindow` si ya existe antes de crear uno nuevo) — cambio de una función, sin riesgo.
- **Cuándo implementarse:** oportunidad de robustez de bajo costo, no urgente — evaluar en un futuro bloque de pulido de Electron.

**2. El PostgreSQL administrado por Electron queda huérfano ante una terminación abrupta del proceso Main (crash, `taskkill /F`, corte de energía).** Confirmado empíricamente varias veces durante QA.APP.1/QA.APP.2/QA.APP.3 (forzar el cierre de `electron.exe`/`Carniceria POS.exe` deja `postgres.exe` y sus procesos hijos corriendo indefinidamente, con el puerto 55432 aún escuchando). Causa: a diferencia del backend (`utilityProcess.fork`, cuyo ciclo de vida Electron ata nativamente al proceso Main — confirmado que un cierre abrupto SÍ lo termina limpiamente), el Postgres administrado se lanza vía `child_process.spawn` + `pg_ctl start`, que además demoniza `postgres.exe` como un proceso independiente no atado a ningún Job Object del proceso Main. **No rompe el próximo arranque** — `PostgresManager.ensureRunning()` ya detecta correctamente que el puerto sigue alcanzable y lo reutiliza sin intentar arrancar uno nuevo (validado leyendo el propio código) — es una fuga de recursos (un proceso extra en RAM hasta el próximo reinicio de Windows o un `pg_ctl stop`/kill manual), no un bug funcional.
- **Alcance esperado:** atar el ciclo de vida de `postgres.exe` al proceso Main vía un Job Object de Windows (mismo mecanismo que ya protege al backend a través de `utilityProcess`), o alguna señal equivalente de limpieza ante una terminación anormal.
- **Cuándo implementarse:** mejora preventiva, no una corrección de bug — evaluar en un futuro bloque, no bloqueante para Release 1.0.

**3. Ventana teórica de condición de carrera en `BackendWatchdog.attemptRestart()`** (`watchdog.ts`): `backend.stop()` seguido inmediatamente de `backend.start()`, sin confirmar que el proceso anterior ya liberó el puerto 4737 antes de intentar el siguiente `listen()`. Evaluada y buscada activamente: se forzó el crash real del backend dos veces contra una instalación empaquetada real y ambas veces se recuperó limpiamente en ~6 segundos, sin ningún error `EADDRINUSE`. **No se logró reproducir** pese a intentarlo — queda documentada como riesgo teórico de baja probabilidad, no como bug confirmado.
- **Cuándo implementarse:** no implementar salvo que se reproduzca con evidencia real en el futuro.

### ✅ Bloques críticos de estabilidad — CERRADOS (03/08/2026)

**Registrado:** 2 de agosto de 2026 (primer episodio). **Investigado y corregido:** 3 de agosto de 2026, en dos bloques separados, cada uno con su propia investigación empírica previa a la implementación (evidencia de `pg_stat_activity`/`pg_locks`/logs antes de tocar código, sin excepciones). Detalle técnico completo en el repositorio backend: `docs/AUDIT_REPORT.md` sección 16, `docs/ARCHITECTURE.md` §6.7, `docs/LOAD_TESTING.md`.

**Ambos hallazgos fueron descubiertos y validados mediante uso real e intensivo del sistema** (no únicamente escenarios automatizados de `load-tests/`) — el primero durante ~31 compras consecutivas de alto volumen intercaladas con ventas/devoluciones/anulaciones; el segundo, en una sesión posterior, durante ~60 ventas reales navegando repetidamente entre POS y Dashboard para verificar KPIs después de cada venta (a diferencia del primer episodio, que se autorrecuperó en ~1 minuto, este segundo no se recuperaba solo).

- **Bloque 1 — Agotamiento del pool de conexiones de Prisma:** causa raíz confirmada con evidencia empírica (no solo hipótesis): `createSaleTransaction()` mantenía **dos conexiones del pool abiertas simultáneamente por cada venta** — la de su propia transacción y una segunda para leer catálogo/promociones (`computeSaleQuote()`, hoy `computeSaleQuoteCalculation()`, hardcodeada al cliente Prisma singleton en vez de recibir la transacción). Bajo ventas concurrentes, esto duplicaba la presión real sobre el pool. La hipótesis original (contención sobre `DocumentSequence`) fue descartada — cero evidencia en más de 500 muestras de `pg_stat_activity`/`pg_locks`. El HTTP 429 del episodio original también se descartó como causa (nunca se disparó durante la reproducción) — era consecuencia visible, no origen. Corregido en `sales/service.ts`/`sales/repository.ts` (backend): la cotización se calcula ahora **antes** de abrir la transacción de venta, reduciendo al mínimo el tiempo real que cada venta mantiene una conexión de escritura ocupada. Verificado 35/35 y 80/80 ventas concurrentes exitosas post-corrección, contra hasta 34/35 fallos antes.
- **Bloque 2 — Recalibración del Rate Limiter:** el rate limiter por categoría (ya existente desde la Fase 19 del backend) tenía sus 4 categorías (`auth`/`transactional`/`reports`/`administrative`) compartiendo exactamente el mismo `windowMs`/`max`, pese a patrones de uso completamente distintos. Causa concreta confirmada: `POST /sales/quote` (cotización del carrito, llamada en cada edición) competía por el mismo cupo que `POST /sales` (la venta real) bajo `transactional`, agotándolo mucho antes de completar un turno real de ~60 ventas. Se revisó también el Dashboard/sistema de invalidación de React Query (`reportQueryKeys.ts`) — descartado como defecto: la invalidación granular ya estaba correctamente acotada desde un bloque previo aprobado, el volumen observado era tráfico legítimo. Corrección: nueva categoría `salesQuote`, exclusiva de `POST /sales/quote`; las 5 categorías dejaron de compartir presupuesto — cada una tiene ahora su propio `windowMs`/`max` calibrado a su volumen real de uso (ver tabla en `docs/AUDIT_REPORT.md` sección 16.2 del backend).
- **Ningún cambio de lógica de negocio, cálculos, APIs públicas, permisos ni rutas** en ninguno de los dos bloques — ambos fueron correcciones de arquitectura interna (manejo de transacciones/pool, calibración de rate limiting), no de comportamiento funcional.

### ✅ Validación final — Niveles 2 y 3 de QA de estabilidad (03/08/2026) — ETAPA DE ESTABILIZACIÓN DEL BACKEND CERRADA

Siguiendo con "continuar con las pruebas de estabilidad del ERP" (el paso pendiente que dejaban los Bloques 1 y 2 de arriba), se ejecutó una suite oficial de QA de estabilidad bajo **uso real** (no concurrencia/volumen artificial de k6): `load-tests/realistic-session/` en el repositorio backend, conservada permanentemente como parte del proceso oficial de QA. Detalle técnico completo, métricas y reportes JSON en `docs/AUDIT_REPORT.md` sección 17 y `docs/LOAD_TESTING.md` sección 8 del backend.

- **Nivel 2 — sesión realista de un cajero (~12 min) — ✅ APROBADO:** secuencia aleatoria de búsqueda de productos, armado/edición de carrito, cotización, confirmación de venta, historial, Dashboard, Reportes, movimientos de caja. Resultado: 39 ventas, 634 consultas, 673 operaciones, **0 errores de cualquier tipo**.
- **Nivel 3 — jornada intensiva de un cajero (~26 min, prueba definitiva) — ✅ APROBADO:** además de lo anterior, anulaciones, correcciones, devoluciones y **compras grandes >₡8.000.000 cada una** (para estresar Inventario/Lotes/FEFO/Costos/Promociones/Kardex de verdad), con Dashboard+Inventario+Reportes forzados a recalcular después de cada operación de ese tipo. Mínimos exigidos ampliamente superados: 184 ventas (mín. 100), 85 anulaciones (mín. 40), 59 correcciones (mín. 20), 41 devoluciones (mín. 20), 59 compras grandes (mín. 30) — 3942 operaciones totales, **0 errores de cualquier tipo** (0 4xx, 0 429, 0 5xx, 0 timeouts), memoria y pool de PostgreSQL estables, sin degradación progresiva.
- Scripts oficiales conservados permanentemente: `load-tests/realistic-session/cashier-realistic-session.mjs` (Nivel 2), `cashier-intensive-shift.mjs` (Nivel 3), helpers compartidos en `lib/common.mjs`/`lib/monitor.mjs`. Reportes JSON completos conservados en `load-tests/realistic-session/reports/`.
- **Conclusión técnica:** el backend queda validado para uso intensivo real de un único cajero. Combinado con los Bloques 1 y 2 de arriba, **la etapa de estabilización del backend queda oficialmente CERRADA (03/08/2026)**.

---

## ESTADO ACTUAL DEL PROYECTO

### Módulos completamente terminados y listos para producción (✅)

Autenticación, Dashboard, Usuarios, Roles, Permisos, Productos (incluido control por lotes desde Fase 16), Categorías, Impuestos, Proveedores, **Clientes** (Bloques 8.1–8.5, incluida su integración con Ventas/POS/Facturación Electrónica), Inventario (incluida consulta de mermas), Compras (incluida trazabilidad de recepción de lotes), Ventas (administración), Caja, Reportes (incluidos los de Lotes), Configuración, Auditoría, Promociones (incluido modelo comercial y `FIXED_PRICE`), POS, Lotes.

**Es decir: todos los módulos del sistema.** El rediseño UX/UI y las fases de funcionalidad de negocio auditadas están cerrados para el catálogo completo de módulos.

### Módulos pendientes / fuera de alcance actual (❌)

Ninguno — **Facturación Electrónica quedó integrada vía Alegra el 04/08/2026** (Bloques 7.1–7.20, ver sección dedicada arriba); ya no es un módulo pendiente.

### Lo que falta, estrictamente, antes de la versión 1.0

Ver "ROADMAP OFICIAL HACIA 1.0" abajo — sección única y autoritativa, reemplaza cualquier lista previa de pendientes de este documento.

---

# ROADMAP OFICIAL HACIA LA VERSIÓN 1.0

**Con el rediseño UX/UI del ERP y del POS cerrados, y las Fases 1–18 completas, esto es todo lo que queda para llegar a producción.** Ordenado por prioridad.

## Camino confirmado hacia la versión 1.0 (aprobado 05/08/2026)

Orden explícito, acordado antes de comenzar el Bloque 7.28 — cualquier sesión futura debe seguir esta secuencia salvo que el usuario la reordene explícitamente:

1. **Bloque 7.28 — Corrección de bugs del POS.** Dos bugs reales reportados desde la aplicación instalada: (1) los botones de montos rápidos se duplican tras muchas ventas consecutivas; (2) el foco del lector de código de barras no vuelve automáticamente al campo de escaneo después de agregar un producto.
2. **Bloque 7.29 — Mejoras de usabilidad y consistencia visual:** Inventario (búsqueda por nombre/SKU + orden alfabético), Configuración, Permisos, Dashboard, KPIs de Corte de Caja.
3. **QA Integral** — pase de QA final sobre el sistema completo, posterior a 7.28/7.29.
4. **Corrección de los últimos bugs encontrados en QA.**
5. **Release Candidate.**
6. **Versión 1.0.**

Esta secuencia **no reemplaza** los ítems 1.3-1.4 de "1. Obligatorio antes de producción" más abajo (A-17, ronda de escritura real contra Alegra — el ítem 1.5, validación CABYS↔Impuesto, ya quedó resuelto el 07/08/2026, ver sección dedicada) — conviven en paralelo; el orden 1-6 de arriba es específico para el trabajo de UI/bugs iniciado el 05/08/2026, no sustituye la lista de obligatorios ya registrada en este documento.

## 1. Obligatorio antes de producción

| # | Tarea | Por qué es obligatoria |
|---|---|---|
| 1.1 | ~~Investigar y resolver el crash bajo carga~~ — **RESUELTO Y VALIDADO (03/08/2026)**, ver "✅ Validación final — Niveles 2 y 3" arriba. Los dos hallazgos de estabilidad (pool de Prisma, calibración del rate limiter) fueron corregidos y validados con dos niveles de prueba de uso real (39 y 184 ventas respectivamente, 0 errores en ambos) — **la etapa de estabilización del backend queda oficialmente cerrada**, sin pendientes. | Los dos hallazgos de estabilidad ya fueron corregidos y verificados empíricamente bajo un patrón de uso real e intensivo (no solo reproducción puntual) — ítem completamente cerrado. |
| 1.2 | ~~**QA integral final** end-to-end sobre el sistema completo~~ — **RESUELTO (05/08/2026).** QA.16A ejecutó exactamente esto: una prueba de estrés operativa real, en una sola sesión continua, sobre Caja→Catálogo→Compras→Inventario→Promociones→POS→Facturación Electrónica→Caja→Reportes→Dashboard, con datos de volumen real (encontró y corrigió 2 bugs reales, ver "QA INTEGRAL POR MÓDULOS" arriba). QA.16B confirmó después, con una regresión completa sobre ese mismo sistema ya unificado, que nada se rompió. | Ya no aplica — ver columna anterior. |
| 1.3 | **Verificación final de A-17** (Select de "Tipo de movimiento" en Movimiento de Caja) — confirmar en DevTools que el problema histórico no se reproduce, y cerrar formalmente el hallazgo. | Bajo riesgo (no reproducido en los últimos bloques), pero sigue abierto en el registro de auditoría — cerrarlo requiere evidencia, no solo inferencia. |
| 1.4 | **Ronda de QA controlada con operaciones de escritura reales contra Alegra** (Bloques 8.4/8.5): crear un contacto real de cliente y emitir al menos una Factura Electrónica real a nombre de un cliente identificado, con autorización explícita del usuario. | La integración de Facturación Electrónica para clientes identificados (Bloque 8.4) fue implementada y validada solo con llamadas de lectura — nunca se emitió una Factura Electrónica real ni se creó un contacto real de cliente en la cuenta de Alegra en producción. |
| 1.5 | ~~🔴 **Validación CABYS ↔ Impuesto**~~ — **RESUELTO (07/08/2026)**, ver sección dedicada "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO" arriba. El backend valida la coherencia CABYS↔impuesto al crear/editar productos, con indicador visual preventivo en el formulario — validado contra la aplicación Desktop real. | Ya no aplica — ver columna anterior. |
| 1.6 | 🔒 ~~**Seguridad de sesión del escritorio**~~ — **✅ CERRADO (05/08/2026), Bloque 7.24 — implementado y validado contra la app de escritorio instalada real.** Reemplaza/formaliza la decisión pendiente **M-15**. | Riesgo real de negocio para un ERP/POS de escritorio compartido: cualquiera que tenga acceso físico a la máquina heredaba la sesión completa (incluida una caja ya abierta) sin ninguna fricción. |

### 1.6 — Bloque 7.24: seguridad de sesión del escritorio — ✅ CERRADO (05/08/2026)

**Síntoma reportado (05/08/2026):** la app de escritorio mantiene la sesión iniciada y, al reabrirla, entra directamente al POS (incluida una caja ya abierta) sin pedir contraseña.

**Causa raíz, contra la arquitectura real (`src/lib/htpp/`, `stores/authStore.ts`, `App.tsx`):** es un comportamiento **intencional preexistente**, no un bug — `authStore` nunca persiste `accessToken` (vive solo en memoria, se pierde en cada recarga, "A-01"), pero `App.tsx` dispara `refreshAccessToken()` una vez al montar, usando *únicamente* la cookie `httpOnly`/`Secure`/`SameSite=None` del refresh token (persistida por Electron entre reinicios, ya que la sesión/partición del navegador embebido sobrevive al cierre de la app). Ese refresh silencioso reconstruye `user`/`accessToken` sin ninguna interacción del usuario. La sesión de caja, por su parte, vive enteramente en el backend (`CashSession` real, no en `cashSessionStore` persistido) — si había una caja abierta, sigue abierta ahí, así que `RequireCashSession` la deja pasar directo al POS en cuanto el refresh silencioso restaura la sesión.

**Opciones evaluadas (siguiendo la arquitectura ya existente, sin rediseñarla):**

1. **No intentar el refresh silencioso al reiniciar la app — pedir contraseña siempre, recordando solo el usuario.** Cambio más simple y de menor riesgo: gatear (o eliminar) el `refreshAccessToken()` de `App.tsx` al montar cuando la app arranca de cero (distinto de una recarga en caliente dentro de la misma sesión, donde sí tiene sentido mantenerlo). `authUser` (ya persistido en `localStorage` desde antes) sigue precargando el email/usuario en el login, por comodidad — solo cambia que la contraseña se vuelve a pedir. Reutiliza 100% de lo que ya existe (`LoginPage`, `authStore`, `refreshManager`), sin backend nuevo.
2. **Checkbox "Recordar sesión" en el login (opt-in, default apagado).** Igual que la opción 1, pero configurable por el usuario — requeriría que el backend emita la cookie de refresh como cookie de sesión (sin `Max-Age`, se pierde al cerrar el proceso) cuando no se marca la casilla, vs. persistente cuando sí. Más flexible, pero toca el backend (`POST /auth/login`, `refreshTokenCookieOptions`) y agrega una decisión de UI nueva en el login — mayor superficie de cambio que la opción 1 para un beneficio marginal en un ERP de un solo puesto por sucursal.
3. **Bloqueo automático por inactividad (pantalla de bloqueo, no logout).** Un hook de inactividad (`mousemove`/`keydown`, mismo patrón que los atajos de teclado ya usados en el proyecto) dispara una pantalla de bloqueo tras N minutos sin actividad, pidiendo la contraseña del usuario ya autenticado para desbloquear — sin destruir `accessToken`/`refreshToken` ni la caja abierta, solo una superposición visual que bloquea la interacción. Complementa (no sustituye) la opción 1: resuelve el riesgo de "máquina desatendida mientras la app sigue abierta", que la opción 1 no cubre (esa solo protege el reinicio de la app).
4. **Mantener el comportamiento actual.** Descartada — es exactamente el riesgo que el usuario pidió corregir antes del Release 1.0.

**Recomendación:** combinar **1 + 3** — son complementarias, no alternativas. La opción 1 cierra el hueco de "reinicio de la app" (el síntoma reportado), la opción 3 cierra el hueco de "máquina desatendida mientras la app sigue corriendo" (mismo riesgo real, distinto momento). La opción 2 queda documentada como alternativa más flexible pero de mayor alcance, a considerar solo si el usuario la prefiere explícitamente sobre la combinación recomendada.

**Investigación adicional (05/08/2026), antes de implementar — dos puntos revisados a pedido del usuario:**

1. **Detección de "cold boot" real, sin depender de `sessionStorage`/una marca en memoria del renderer.** Se investigó el código real de `carniceria-pos-desktop` — `electron/preload.ts` ya expone `window.__DESKTOP_API_BASE_URL__` vía `ipcRenderer.sendSync('app:get-api-base-url')`, resuelto por `electron/ipc/index.ts::registerIpcHandlers` con un valor calculado una sola vez en `main.ts` al arrancar. El mismo patrón, más robusto que cualquier heurística del renderer, sirve para "cold boot": una bandera de un solo uso a nivel de módulo en `electron/ipc/index.ts` (`let coldBootConsumed = false`, un nuevo handler `app:get-is-cold-boot` que devuelve `true` la primera vez y `false` después, sin resetearse hasta que el proceso Main termine de verdad), expuesta como `window.__DESKTOP_IS_COLD_BOOT__` en `preload.ts`. Es la autoridad real (el proceso principal de Electron), no una heurística de almacenamiento web. Para el build web sin Electron, `sessionStorage` sigue siendo el fallback correcto (no un hack — por spec, cerrar la pestaña destruye genuinamente el *browsing context*).
2. **¿Reutilizar `POST /auth/login` completo para el desbloqueo, o algo más simple?** Investigación confirmó un riesgo real, no solo conceptual: `login()` pasa por `loginRateLimiter` (5 intentos/15min, sin `keyGenerator` propio → por IP) — en esta arquitectura on-premise todo el tráfico es loopback, así que ese cupo lo comparte el terminal **entero**; además `login()` deja el refresh token anterior sin revocar y genera ruido de auditoría (`LOGIN` idéntico a un inicio de sesión real). **Implementado: `POST /auth/verify-password`** (`carniceria-pos-backend`, Bloque 7.24, 05/08/2026) — endpoint mínimo nuevo, detrás de `authenticate` (no es superficie anónima) y `authRateLimiter` (cupo generoso, mismo que `/refresh`/`/logout`), reutilizando `authRepository.findById` y `bcrypt.compare` ya existentes (sin duplicar lógica, no se encontró ninguna función de comparación de contraseña reutilizable previa — solo esa única llamada inline en `login()`). Nunca emite ni rota tokens. Ver `docs/ARCHITECTURE.md` §6.7 y `docs/API.md` del backend para el detalle completo.

**Segunda revisión (05/08/2026), antes de implementar el frontend/Electron — tres puntos a pedido del usuario:**

1. **¿`isLocked` en `authStore` o estado local de `App.tsx`?** Se confirmó que ningún otro consumidor (refresh, interceptor, watchdog, actualizador) necesita conocer el estado de bloqueo — queda como `useState` local de `App.tsx`, sin tocar `authStore`.
2. **¿Existe ya un hook reutilizable de listeners globales/timers?** Se revisaron `src/hooks/` (`useDebouncedValue`/`usePagination`/`usePermissions`) y los ocho archivos con `window.addEventListener` del proyecto — todos son atajos de teclado puntuales por página, ninguno genérico ni de inactividad. Se creó `src/hooks/useIdleTimer.ts`, genérico (no sabe nada de autenticación), mismo estilo que `useDebouncedValue`.
3. **¿El overlay realmente bloquea toda interacción sin afectar procesos de fondo?** Confirmado con un riesgo real encontrado: los atajos de teclado de las páginas (`SalesPOSPage.tsx` y otras) son listeners crudos en `window` sin ninguna noción de "hay un diálogo/bloqueo activo" — una superposición visual **no** los detiene (un `keydown` llega a `window` sin importar el z-index). `LockScreen.tsx` agrega su propio listener de captura (`{ capture: true }` + `stopImmediatePropagation()`) que corre antes que esos listeners y los neutraliza mientras está montado, sin tocar ninguna página existente. El mouse queda bloqueado por semántica normal de DOM/CSS (overlay `fixed inset-0` de alto z-index). Refresh silencioso/actualizador/watchdog/sync no escuchan eventos de teclado/mouse — confirmado sin afectación.

**IMPLEMENTADO (05/08/2026):** `src/hooks/useIdleTimer.ts` (nuevo), `src/features/auth/components/LockScreen.tsx` (nuevo), `src/features/auth/api/auth.api.ts` (`verifyPassword`), `src/App.tsx` (cold-boot vía `window.__DESKTOP_IS_COLD_BOOT__`/fallback `sessionStorage` + integración del bloqueo por inactividad), `src/features/auth/components/LoginForm.tsx` (precarga de usuario recordado) — frontend. `carniceria-pos-desktop/electron/ipc/index.ts` (handler `app:get-is-cold-boot`) y `electron/preload.ts` (`window.__DESKTOP_IS_COLD_BOOT__`) — Electron.

**Primera validación real (05/08/2026): la sesión seguía restaurándose sola pese al fix.** Causa raíz real, demostrada con evidencia de proceso (`Win32_Process`, PID nuevo confirmado) y de log (`POST /auth/refresh` real 0.4s después de un arranque genuinamente nuevo): `electron/preload.ts` es compartido por la ventana de Splash/Mantenimiento y por la ventana principal (mismo `preloadPath()` en `main.ts`) — el splash, que carga primero en TODO arranque, consumía la bandera de un solo uso antes de que la ventana principal (la única que ejecuta `App.tsx`/React real) pudiera leerla. **Corregido:** `webPreferences.additionalArguments` (mecanismo nativo de Electron, sin IPC nuevo) marca únicamente la ventana principal en `createMainWindow` (`windows/main-window.ts`, constante `MAIN_WINDOW_ARG`); `preload.ts` solo consulta `app:get-is-cold-boot` cuando esa marca está presente en `process.argv` — el splash nunca la consulta ni la consume.

**Segunda validación real (05/08/2026): regresión real introducida por el fix anterior — login roto ("No se pudo conectar con el servidor").** Causa raíz: el primer intento de la corrección importaba `MAIN_WINDOW_ARG` directamente desde `windows/main-window.ts` en `preload.ts` — ese archivo también importa `{ BrowserWindow, shell } from 'electron'` (API exclusiva del proceso principal); acceder a `BrowserWindow` desde un preload **sandboxed** lanza una excepción real al cargar el módulo, matando la ejecución de **todo** el archivo de preload — incluida la línea que expone `window.__DESKTOP_API_BASE_URL__`, dejando al cliente HTTP caer al `VITE_API_URL` de build (puerto incorrecto). **Corregido:** la misma constante (`MAIN_WINDOW_ARG = '--carniceria-main-window'`) declarada de forma independiente en ambos archivos, sin ningún import cruzado entre proceso principal y preload.

**Empaquetado real:** se descartó repackear `app.asar` manualmente (`asar extract`+`pack` materializa y re-incluye contenido que electron-builder mantiene deliberadamente fuera del archivo en `app.asar.unpacked` — un intento real infló el archivo de 2.8MB a 112MB, abandonado sin desplegar). Validado con el pipeline oficial (`electron-builder --win --x64 --dir`), copiando únicamente `resources/app.asar`/`app.asar.unpacked` regenerados sobre la instalación real (con backup reversible del `app.asar` original).

**Validación final contra la app instalada real, aprobada por el usuario (05/08/2026):** abrir → iniciar sesión → cerrar completamente con la X → volver a abrir → pide contraseña de nuevo, recordando solo el usuario; refresh silencioso y pantalla de bloqueo por inactividad siguen funcionando con normalidad. `tsc`/`eslint`/`build` limpios en los tres repos. **Bloque cerrado.**

## 2. Recomendado antes de producción (no bloqueante técnico, pero de alto valor)

| # | Tarea | Motivo |
|---|---|---|
| 2.1 | Resolver decisiones de producto pendientes: **M-06** (vistas SQL en CI/CD), ~~M-15 (timeout de sesión)~~ — **movida a 1.6** (obligatoria, no solo recomendada), **M-17** (paginación de `getLowStock`), **M-21** (ventana temporal del dashboard). | Ninguna bloquea técnicamente, pero dejarlas sin decidir antes de producción real genera comportamiento no especificado en producción. |
| 2.2 | Limpieza de contrato: `roles.service.ts` debería aceptar o rechazar explícitamente `permissionIds` en `update()` (**M-31**) en vez de ignorarlo en silencio — hoy no causa bugs porque el frontend no lo usa, pero es una trampa para cualquier futuro consumidor de la API (ej. una integración externa). | Deuda de claridad de API, no de funcionalidad. |
| 2.3 | Permiso granular propio para el módulo `audit` (hoy sin código en el catálogo de permisos). | Consistencia de RBAC granular con el resto del sistema. |

## 3. Puede quedar para versiones posteriores (post-1.0)

- **Tipos avanzados de promociones (UI de administración para `BUY_X_PAY_Y`/`COMBO`)** — el motor ya los soporta; falta exclusivamente la pantalla de administración cómoda y datos de ejemplo.
- **Módulo de Rendimientos** (cuánto rinde un corte original vs. sus sub-cortes) — requiere análisis de dominio desde cero, no existe hoy en ninguna forma.
- **Módulo de Precios Programados** (cambios automáticos de precio por fecha) — requiere análisis desde cero.
- **Ledger unificado de `InventoryMovement`** (vista combinada de compras/ventas/ajustes/mermas por producto) — hoy cada tipo se consulta por separado.
- **Reportes/Dashboard de rentabilidad comercial** — exponer `PricingAnalysis` (hoy solo en la cotización de Ventas) en Reportes/Dashboard.
- **Módulo profesional de Caja Chica / Cash Management avanzado** — integración con gaveta de efectivo física (Epson TM-T88V, puerto DK), apertura automática/manual con auditoría. El resto del alcance originalmente previsto para este ítem (apertura con monto inicial, pago en efectivo con vuelto, movimientos completos, arqueo, historial, reportes de diferencias) **ya está implementado** como parte del rediseño de Caja — este punto queda acotado exclusivamente a la integración de hardware de gaveta.
- ~~**Facturación Electrónica** (Hacienda, Costa Rica) — sin iniciar~~ — **CERRADO (04/08/2026)**, ver "FACTURACIÓN ELECTRÓNICA — INTEGRACIÓN CON ALEGRA (Bloques 7.1–7.20)" arriba.
- Deuda menor de QA de Promociones (limpieza de promociones de prueba sin endpoint de borrado; caso límite sin validar de `CART` + `SUPPLIER_SUBSIDY_PER_UNIT`).
- 🟡 **Resolución de permisos por `roleId` en vez de por nombre de rol** (registrada 04/08/2026, durante QA.11 — ver "DEUDA TÉCNICA DE ARQUITECTURA" más arriba) — cambio de arquitectura de autenticación/autorización, explícitamente fuera del alcance de Release 1.0.

## 4. Deuda técnica que debe resolverse antes de liberar el sistema

Coincide con la sección "1. Obligatorio antes de producción" — **1.1 (crash bajo carga) ya fue resuelto (03/08/2026)**, ver "✅ Bloques críticos de estabilidad — CERRADOS", y **1.5 (Validación CABYS ↔ Impuesto, registrada 04/08/2026) también quedó resuelto (07/08/2026)**, ver sección dedicada "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO". Ambos eran, de toda esta lista, la única deuda técnica que representaba una falla real de comportamiento con riesgo de negocio (rechazo de comprobantes electrónicos ante Hacienda), no una decisión de producto sin tomar — el resto de la deuda técnica identificada en el proyecto (M-06/M-15/M-17/M-21/M-31, permiso de `audit`) son decisiones o limpiezas de contrato, no fallas — quedan en la sección 2 (recomendado, no bloqueante).

---

## PRÓXIMOS DESARROLLOS PROPUESTOS (post-1.0, sin comprometer fecha)

Mismo contenido que la sección 3 de arriba ("Puede quedar para versiones posteriores"), en formato lista para referencia rápida — ver esa sección para el detalle completo de cada ítem.

---

# PRÓXIMA GRAN ETAPA DEL PROYECTO (a partir del 03/08/2026): Electron

Con el rediseño UX/UI del ERP cerrado y la etapa de estabilización del backend cerrada (ver arriba), la siguiente gran etapa deja de ser "corrección/estabilización" y pasa a ser **empaquetado y distribución como aplicación de escritorio**. Se ejecuta en un repositorio propio, `carniceria-pos-desktop` (hermano de este repo y de `carniceria-pos-backend`, no reimplementa lógica de negocio ni UI — solo orquesta los dos repos ya existentes) — ver su `README.md` para el detalle técnico completo.

1. **Electron + Sistema de instalación — ✅ CERRADO (Bloques 1-6.2, 2026-08-03).** Frontend y backend ya existentes envueltos como aplicación de escritorio nativa para Windows, con instalador NSIS real (`electron-builder`, sin privilegios de administrador) y PostgreSQL completamente administrado por Electron como proceso propio (sin servicio de Windows, sin `%ProgramData%`, sin depender de que el operador conozca Node/PostgreSQL manualmente). Validado con una instalación limpia real de punta a punta (desinstalación + borrado completo de `userData` + instalación silenciosa `/S` + primer arranque): login exitoso, navegación entre módulos, creación de una compra real, datos iniciales e imágenes correctos. Ocho causas raíz reales encontradas y corregidas durante la validación del Bloque 3 (identidad de Windows del servicio, `pg_ctl` colgado, puerto viejo en disco, secretos/seed faltantes en el paquete, `src/` faltante en el backend empaquetado, pantalla en blanco por rutas de Vite bajo `file://`, pantalla negra por el pathname inicial de `BrowserRouter`, y login fallido por `VITE_API_URL` horneado en build vs. puerto real en runtime) — detalle completo de cada una en el `README.md` de `carniceria-pos-desktop`, sección "Causas raíz encontradas durante el Bloque 3".
   - **Auditoría de producción, posterior a este cierre — ✅ CERRADA (QA.APP.1–QA.APP.4, 05/08/2026), Release Candidate.** El cierre de Bloques 1-6.2 validaba que la app funcionara; no auditaba específicamente que estuviera lista para producción real. Esa auditoría dedicada encontró y corrigió 4 bugs reales, 2 críticos (sesión que se perdía tras inactividad solo dentro de Electron; backend empaquetado corriendo permanentemente en postura de desarrollo, con un hallazgo colateral que impedía arrancar cualquier instalación empaquetada) — ver sección dedicada "AUDITORÍA DE ELECTRON PARA PRODUCCIÓN" más arriba para la tabla completa y el `README.md` de `carniceria-pos-desktop` para el detalle técnico de cada uno.
   - **Bloque 4 (persistencia de datos entre arranques):** compras/cajas creadas en una sesión real desaparecían al reabrir la app — causa raíz: `prisma/seed.ts` (destructivo por diseño en su segundo paso, `resetCatalogData()`, pensado para reiniciar una base de desarrollo entre pruebas) corría en **cada** arranque, no solo el primero, bajo la premisa incorrecta de que era idempotente. Corregido en `carniceria-pos-desktop` (sin tocar la lógica del seed): `PostgresManager` ahora expone si esta ejecución tuvo que correr `initdb` (señal explícita, atada al ciclo de vida real de la base, sin depender de `NODE_ENV`) — el seed solo corre cuando esa señal es verdadera. `migrate deploy` sigue corriendo en cada arranque, sin cambios. Validado: una compra y una sesión de caja creadas tras el primer arranque siguen intactas después de cerrar y reabrir la app. Ver `CHANGELOG.md` para el detalle completo.
   - **Bloque 5 (tema por defecto unificado):** el ERP instalado abría en modo oscuro mientras la versión web (localhost) abría en modo claro, mismo build en ambos casos — causa raíz: `defaultTheme="system"` + `enableSystem` en `next-themes` (`theme-provider.tsx`) resolvía el tema vía `prefers-color-scheme` del sistema operativo cuando no había preferencia guardada, y cada entorno tenía un SO/perfil de navegador distinto. Corregido con `defaultTheme="light"` + `enableSystem={false}` — un cambio de una línea en un único archivo del frontend, sin tocar nada de `carniceria-pos-desktop`. Validado en localhost, Electron en desarrollo, y la app instalada (primer y segundo arranque): los cuatro renderizan tema claro de entrada; una preferencia manual futura se sigue persistiendo correctamente. Ver `docs/UI_DESIGN_SYSTEM.md` sección 11.4 para el detalle completo.
2. **Sistema de actualizaciones — ✅ CERRADO (Bloque 6, 2026-08-03; Bloque 6.1, 2026-08-03).** `electron-updater`, detección + descarga + verificación de checksum en segundo plano (nunca condiciona el arranque), instalar al cerrar o "Actualizar ahora" (cierre ordenado real, mismo `before-quit` ya existente, reapertura automática). Proveedor de publicación **desacoplado del código** (variable de entorno, `updater.ts` es el único lugar que lo traduce — cambiar de proveedor no toca lógica), canales (`stable`/`beta`/`dev`) soportados desde el día 1, y una estrategia de recuperación honesta: si una actualización no arranca, se ofrece revertir al instalador anterior cacheado **solo** cuando no cambió la cantidad de migraciones de Prisma desde que se aplicó (revertir código es seguro; revertir un esquema ya migrado no se automatiza). Validado de punta a punta con dos versiones reales del instalador y un servidor de actualizaciones local real (no simulado): detección, descarga, checksum, instalación silenciosa y reapertura automática, los cuatro confirmados con evidencia real. Un hallazgo real durante la validación (`pg_ctl.exe` no encontrado por una fracción de segundo justo tras el relanzamiento, con un paquete grande todavía terminando de escribirse en disco) quedó corregido con una espera acotada antes de iniciar Postgres. Sin UI en el frontend todavía (hoy es un diálogo nativo; el IPC ya está expuesto para un banner futuro sin plomería adicional). Ver `README.md` de `carniceria-pos-desktop`, sección "Bloque 6", para el detalle completo.
   - **Bloque 6.1 (configuración definitiva de producción):** el Bloque 6 solo chequeaba actualizaciones si `DESKTOP_UPDATE_*` existían como variables de entorno — una instalación real nunca las tenía, así que nunca chequeaba nada sin abrir PowerShell a mano en cada PC. Corregido con una URL de producción **por defecto** (`DEFAULT_UPDATE_PROVIDER`/`_CHANNEL`/`_URL`, único punto de configuración en `electron/config.ts`), aplicada solo cuando la app está empaquetada — en desarrollo, sin override explícito, el chequeo sigue deshabilitado (para no consultar el servidor real de producción desde cualquier `npm run dev`). Las variables de entorno de siempre siguen funcionando igual, como *override* en cualquier entorno. Único cambio de código necesario para apuntar al bucket real o cambiar de proveedor en el futuro: reemplazar el placeholder `DEFAULT_UPDATE_URL` en ese mismo archivo. Ver `README.md` de `carniceria-pos-desktop`, sección "Bloque 6.1", para el detalle completo.
   - **Bloque 6.2 (dominio real + publicación automática a R2):** `DEFAULT_UPDATE_URL` pasó de placeholder a `https://updates.micarniceriapos.com` (dominio custom sobre el bucket R2 `micarniceriapos-updates`). Se agregó `npm run publish` (`scripts/publish.js`) — un único comando que compila, empaqueta, genera el instalador + `stable.yml`, y los sube directo al bucket vía el proveedor `s3` de `electron-builder` (R2 es compatible-S3), reemplazando la versión anterior; nunca más una subida manual. Credenciales del R2 API Token (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, permisos mínimos `Object Read & Write` acotados a ese único bucket) viven en `.env.publish`, gitignoreado, nunca en el repo ni hardcodeadas — el script valida que existan y que el endpoint ya no tenga placeholder ANTES de compilar nada (fail-fast, nunca un build a medias). **Actualizado (05/08/2026):** las credenciales reales de Cloudflare ya están configuradas y este flujo ya publicó versiones reales al bucket de producción — ya no está pendiente. Ver `README.md` de `carniceria-pos-desktop`, sección "Bloque 6.2", para el paso a paso completo de creación del token.
   - **QA.APP.3/QA.APP.4/QA.APP.5 (05/08/2026):** auditando el ciclo de vida, el mecanismo de actualización, y finalmente el propio proceso de publicación, se encontraron y corrigieron tres bugs reales más sobre este mismo sistema — una fuga de listeners en el singleton de `electron-updater` en cada "Reintentar" desde Modo Mantenimiento; un downgrade automático sin ningún guard (confirmado con un incidente real durante la propia validación: una instalación real quedó temporalmente en una versión anterior, sin pérdida de datos); y (QA.APP.5, encontrado ya con la 0.1.4 real publicada) `prepare-package-resources.js` empaquetando un `dist/` del frontend desactualizado por horas, sin reconstruirlo ni verificar su antigüedad. Los tres corregidos y revalidados contra un `.exe`/instalación real empaquetada, el último además con una publicación real (0.1.5) al bucket de producción — ver "AUDITORÍA DE ELECTRON PARA PRODUCCIÓN" más arriba.
3. **Funcionamiento offline / sincronización — ✅ CERRADO (Bloque 4, 2026-08-03), mecánica genérica.** El modelo de datos ya había previsto esto desde el diseño original (`sync_status: PENDING/SYNCED/FAILED` en las tablas transaccionales, ver `docs/DATABASE.md` del backend, sección 1) pero nunca se había implementado el mecanismo real. Implementado como cola de salida (patrón *outbox*, tabla `sync_jobs`) + un worker permanente que se despierta de inmediato al encolar un trabajo o al recuperar conectividad (no un cron de intervalo fijo) + un dispatcher de handlers por tipo de trabajo — probado de punta a punta con `Sale` como ejemplo real, encolado atómicamente en la misma transacción que crea la venta. El handler real de envío a la nube (`CLOUD_PUSH`) sigue siendo un *stub*: la API de nube destino todavía no está definida (ninguna hipótesis de contrato fue inventada), así que lo único pendiente para que sincronice de verdad es agregar ese handler el día que exista el contrato — el motor de la cola no necesita cambios. Ver `docs/ARCHITECTURE.md` §6.4 y `docs/DATABASE.md` §7.1 del backend para el detalle técnico completo.
   - **Mejora futura documentada, NO implementada — "Centro de sincronización":** un dashboard operativo sobre la misma cola `sync_jobs`, sin cambios al motor. Alcance previsto: conteo de jobs por estado (pendientes/procesando/sincronizados/fallidos), reintento manual de un job específico, reintentar todos los fallidos de una vez, historial de sincronización, filtros por tipo de job (Cloud, Hacienda, etc. — ya soportado por `jobType` del dispatcher) y vista de estado por sucursal (ya soportado por `sync_jobs.sucursalId`, preparado desde el Bloque 4 para cuando haya más de una sucursal real). Sin Bloque/Sprint agendado todavía.
4. **Release 1.0** — versión formal distribuible, una vez completados los puntos anteriores.

El punto 2 y la implementación real del handler `CLOUD_PUSH` todavía no tienen un Bloque/Sprint de trabajo iniciado — quedan como punto de partida para cuando se decida agendar el próximo. La facturación electrónica **ya no es parte de esta lista**: quedó cerrada el 04/08/2026 vía Alegra (Bloques 7.1–7.20, sección dedicada arriba) — deliberadamente **sin** integrarse a `sync_jobs`/`CLOUD_PUSH` (la emisión se dispara bajo demanda desde Ventas → Documentos, no automáticamente al confirmar la venta desde el Bloque 7.17 en adelante, ver esa sección).

**Estado real hacia Release 1.0, con esta actualización (07/08/2026):** los puntos 1-3 de esta lista están cerrados, incluida la auditoría de producción de Electron (QA.APP.1–QA.APP.6, incluida la sincronización de permisos en actualizaciones) — **`carniceria-pos-desktop` es Release Candidate, versión real publicada 1.0.8, versión 1.0.10 generada localmente (incluye los Bloques 1-3 de la auditoría de riesgos críticos), no bloquea nada**. La Validación CABYS↔Impuesto (antes ítem 1.5) quedó **resuelta (07/08/2026)** — ver sección dedicada "VALIDACIÓN FISCAL CABYS ↔ IMPUESTO". Lo único que falta para el Release 1.0 del producto completo son los ítems ya listados en "ROADMAP OFICIAL HACIA 1.0" más arriba (1.3 verificación final de A-17, 1.4 ronda de escritura real contra Alegra con autorización explícita) — ambos del lado del ERP, ninguno del lado de Electron.
