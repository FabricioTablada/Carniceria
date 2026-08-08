# Auditoría técnica y funcional post-1.0.0 — Roadmap hacia la versión 1.1

**Fecha:** 6 de agosto de 2026
**Alcance:** los tres repositorios del proyecto (`carniceria-pos-front`, `carniceria-pos-backend`, `carniceria-pos-desktop`), como un solo sistema.
**Estado de partida:** versión **1.0.0 — Release Candidate — APROBADA**, tras el programa completo de QA Final 1.0 (7 bloques: 6 por módulo + 1 End-to-End, ver `ROADMAP.md`).
**Naturaleza de este documento:** auditoría de planificación, **sin código**. No se implementó, refactorizó ni modificó nada del sistema para producir este documento — es exclusivamente investigación, lectura de código real (con cita de archivo/línea) y análisis.

---

## 1. Metodología

Cada hallazgo de este documento está respaldado por evidencia directa del código real (no supuestos ni prácticas "genéricas de la industria" traídas de afuera). Antes de calificar algo como una carencia se verificó activamente si ya era una **decisión de alcance deliberada y documentada** (`README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/AUDIT_REPORT.md`, `ROADMAP.md` de los tres repos) — este proyecto documenta sus decisiones de alcance de forma extensa, así que gran parte de lo que una auditoría genérica marcaría como "falta esto" ya es, en realidad, una decisión tomada y razonada. Esos casos se listan al final de cada sección como **"Verificado y descartado"**, no como propuestas.

Se investigó exhaustivamente:
- **Backend** (`carniceria-pos-backend`): arquitectura, permisos, base de datos, seguridad, escalabilidad, multi-sucursal, offline/sync, backups, logs, integración con Alegra, hardware.
- **Desktop** (`carniceria-pos-desktop`): seguridad de Electron, actualizaciones automáticas, gestión de PostgreSQL local, backups desde el lado de escritorio, hardware, multi-terminal, resiliencia, logs, instalador, rendimiento de arranque.
- **Frontend** (`carniceria-pos-front`): manejo de errores global, tamaño de bundle/code-splitting, cobertura de pruebas, soporte de multi-sucursal en la UI — complementando el conocimiento ya construido durante los 7 bloques del QA Final 1.0 (permisos, UX de cajero/administrador, Reportes, Caja, POS, Facturación Electrónica).

---

## 2. Resumen ejecutivo

El sistema es sólido donde importa más para un POS de un solo local: el flujo de venta, caja, inventario y Facturación Electrónica ya pasaron por rondas reales de estabilización bajo carga y por un QA integral de 7 bloques sin hallazgos críticos pendientes. La arquitectura del backend es limpia, en capas, sin inyección SQL, con manejo de errores centralizado y una integración con Alegra genuinamente madura (protección contra doble emisión, reconciliación de incertidumbre, cifrado de credenciales en reposo).

Dicho esto, esta auditoría encontró **un hallazgo crítico real que no debería esperar a la 1.1**: **hoy no existe ningún backup automático funcional en una instalación real** — el mecanismo existe en el código pero no puede ejecutarse en Windows empaquetado (`bash` no disponible, script ausente del paquete, `pg_dump.exe` ni siquiera se incluye), y el restore está explícitamente sin implementar. Confirmado contra la instalación real: la carpeta de backups está vacía. Esto significa que, para el usuario real de este sistema, **una falla de disco hoy es pérdida total de datos del negocio** (ventas, compras, caja, clientes, todo). Se recomienda una mitigación mínima **antes** de seguir sumando funcionalidad nueva, no como parte de la 1.1 sino como un parche 1.0.1 aparte — ver sección 4, ítem 1.

El resto de los hallazgos son mejoras reales y justificadas, pero de menor urgencia: una revocación de permisos que no se aplica al desactivar un rol personalizado, cobertura de auditoría incompleta (acciones definidas pero nunca emitidas), un bug real ya confirmado durante el QA End-to-End (el arqueo de caja no cierra correctamente cuando hay ventas de pago mixto), ausencia de manejo global de errores en el frontend (un solo error de render deja la pantalla en blanco), un bundle de JavaScript sin dividir por rutas, y la ausencia total de impresión térmica/gaveta de efectivo real (todo pasa por el diálogo de impresión del navegador).

Ningún hallazgo de esta auditoría requiere reabrir una decisión de arquitectura ya cerrada (multi-sucursal real, sincronización a la nube, microservicios) — esas decisiones están correctamente documentadas y siguen siendo las correctas para el alcance actual del negocio (un local, con posibilidad de crecer a más adelante).

---

## 3. Hallazgos por categoría

### Arquitectura
Backend modular por dominio (27 módulos), capas consistentes (`routes → controller → service → repository → Prisma`), un único cliente Prisma bien configurado. Existe una mezcla real entre autorización por **código de permiso** (`authorizePermission`, 124 usos) y por **rol literal** (`authorize(SystemRole.X)`, ~13 rutas administrativas/sensibles) — pero está **documentada como deliberada** (`docs/ARCHITECTURE.md`). Su consecuencia real (no un rol personalizado no puede recibir acceso a esas ~13 rutas sin llamarse literalmente "ADMIN") es el único ángulo nuevo. La identidad de sesión basada en `role.name` (no `roleId`) sigue siendo deuda de arquitectura ya documentada para una versión mayor futura — no se repite acá.

**Hallazgo nuevo:** desactivar un **rol personalizado** no revoca sus permisos — ver sección 4, ítem 2.

### UX — Cajero
El flujo de venta (unidad, peso, promoción, cliente/público general, los 4 métodos de pago) ya está aprobado y validado end-to-end. La brecha real está en la interacción con hardware: cada comprobante pasa por el diálogo de impresión del sistema operativo (`window.print()`), sin corte automático ni apertura de gaveta — fricción real y medible en un local de alto volumen (una carnicería vende decenas de tickets por turno). Durante una reconexión del backend (el watchdog de Electron reinicia el proceso automáticamente), el cajero no ve ningún aviso — solo el error genérico de la operación puntual que falló, sin contexto de que el sistema se está recuperando solo.

### UX — Administrador
Reportes, Dashboard y Caja ya pasaron por un rediseño completo y aprobado. La brecha real es de **confiabilidad de los datos que el administrador ve**: el arqueo de caja no refleja correctamente sesiones con pago mixto (hallazgo del QA End-to-End, sección 4 ítem 6), y la cobertura de auditoría no registra quién cambió un precio, quién abrió/cerró una caja puntual, ni quién registró una compra — información que un administrador esperaría poder consultar.

### Inventario
El módulo de Lotes (LOTES-00..09) está cerrado y bien construido — creación automática de lotes al recibir compras, idempotente, transaccional, con el invariante `SUM(Batch.availableQuantity) = Inventory.quantity` mantenido por código de aplicación. No existe, sin embargo, ningún job que **verifique** que ese invariante se mantiene en el tiempo — es una red de seguridad razonable para una 1.1, no urgente. La tabla de mayor crecimiento real (`InventoryMovement`) es la única tabla transaccional del sistema sin índice de fecha, a diferencia de todas las demás (`Sale`, `Purchase`, `CashSession`, `AuditLog`, `Batch` ya lo tienen).

### POS
Ya cerrado y aprobado en su totalidad (identidad visual propia, atajos de teclado, checkout como panel deslizante, etc.) — sin hallazgos nuevos de este bloque más allá de lo ya corregido en el QA Final 1.0.

### Caja
El mecanismo central (apertura, cierre, movimientos, resumen de sesión) funciona correctamente **salvo por el pago mixto** (ítem 6). El watchdog que reinicia el backend automáticamente ante una caída es robusto, pero Postgres mismo no tiene ningún mecanismo de reinicio si el proceso de base de datos muere en medio de un turno — solo el proceso de backend se supervisa, no la base de datos que lo sostiene.

### Reportes
Motor de reportes ya bien optimizado (agregaciones con `groupBy`/`aggregate`, sin patrones N+1, paginado). El único ángulo real es que ninguno de los reportes actuales expone visualmente el riesgo de facturas electrónicas "inciertas" sin resolver (ver ítem 5) ni el estado de sincronización pendiente (ver ítem 10) — ambos datos ya existen en la base, solo no se muestran.

### Facturación Electrónica
El módulo más maduro del sistema, con protección real contra doble emisión y reconciliación de incertidumbre ya validada contra la cuenta real de Alegra. La brecha documentada (no oculta) es la ausencia de reintento automático — una emisión fallida requiere que un humano vuelva a apretar el botón, indefinidamente, sin ninguna notificación proactiva ni cola de reintentos, a pesar de que el sistema ya tiene la infraestructura de cola (`SyncJob`) que podría usarse para esto y hoy no se usa.

### Integraciones
Alegra es la única integración real y está cifrada en reposo correctamente (AES-256-GCM). No hay integración con hardware de ningún tipo (impresoras, básculas, lectores) en ningún repositorio — todo pasa por capacidades genéricas del sistema operativo o del navegador.

### Base de datos
Esquema extremadamente bien documentado y consistente (1779 líneas, convenciones uniformes). Índices en general buenos, con dos excepciones puntuales ya mencionadas (Inventory Movement, ítem 8). El soft-delete es deliberadamente parcial (6 de ~29 modelos) — decisión ya documentada, no una carencia oculta. No existen restricciones `CHECK` a nivel de base de datos para invariantes de negocio (cantidades/montos no negativos) — se confía enteramente en la capa de aplicación, razonable con un único proceso escritor, pero sin defensa adicional si algo escribe directo a la base en el futuro.

### Electron
Postura de seguridad de Electron ya endurecida (contextIsolation, sandbox, sin nodeIntegration, sin contenido remoto). Se encontraron dos brechas de seguridad concretas y no documentadas: la ventana principal no tiene ninguna Content-Security-Policy, y el manejador del protocolo `app://` no sanea rutas con `..` codificado — en principio explotable solo si ya existiera una inyección de script en el React, pero es una capa de defensa ausente que sería trivial agregar. Las credenciales de base de datos y los secretos de la aplicación se escriben en disco en texto plano sin permisos restringidos.

### Offline
El diseño "todo corre en la misma máquina" está correctamente implementado y es la decisión correcta para el alcance actual (documentado explícitamente como decisión de arquitectura, no like una limitación accidental). Existe una cola de sincronización (`SyncJob`) genuinamente bien construida (workers con backoff, recuperación de trabajos atascados) pero su único handler real es un stub — hoy no sincroniza nada a ningún lado, y un trabajo que falla queda invisible y nunca se reintenta.

### Backups
**El hallazgo más grave de toda la auditoría** — ver ítem 1 más abajo. No hay backup funcional ni restore implementado en ninguna instalación real.

### Auditoría
El modelo de datos (`AuditLog`) es correcto y bien indexado, pero de las 15 acciones definidas solo 6 se usan alguna vez en todo el código — nadie deja rastro de crear/editar un producto, cambiar un precio, abrir/cerrar caja o registrar una compra.

### Logs
Buena base técnica (Pino estructurado, redacción de credenciales, rotación diaria con retención). La debilidad real es que solo son accesibles desde la pantalla de mantenimiento (cuando el sistema ya está roto) — durante el uso normal, no hay ninguna forma de que un administrador o soporte técnico exporte un diagnóstico sin que alguien le explique dónde está la carpeta de AppData.

### Permisos
Correctamente diseñado en general (catálogo real, verificado exhaustivamente durante el QA Final 1.0 y ya sin brechas de UI conocidas). El hallazgo nuevo de este bloque es que desactivar un rol personalizado no revoca nada en la práctica (ítem 2).

### Multiusuario
Bien resuelto — sesiones independientes, tokens revocables, invalidación de caché de permisos. Sin hallazgos nuevos.

### Multi-sucursal
El modelo de datos está genuinamente preparado para múltiples sucursales (columna `sucursalId` en todas las tablas transaccionales), pero el **runtime** es de una sola sucursal por diseño (una instalación = una base de datos = una sucursal, documentado explícitamente). Las lecturas/reportes toman `sucursalId` como un filtro opcional, no como algo derivado de la sesión — invisible hoy porque solo existe una sucursal por instalación, pero sería una fuga de datos entre sucursales el día que dos sucursales compartan una sola base de datos (escenario que hoy no ocurre, pero que valdría la pena bloquear explícitamente en código antes de que alguien lo intente).

### Hardware
Confirmado en los tres repositorios: no existe ningún código de integración con impresoras térmicas, gavetas de efectivo, básculas ni lectores de código de barras dedicados. Todo funciona hoy gracias a que un lector de barras emula un teclado y a que la impresión pasa por el diálogo estándar del sistema operativo. No hay ni siquiera un stub o plan documentado para esto en ningún repositorio — es la única categoría de esta lista de 20 que no tiene ninguna mención previa en ningún documento del proyecto.

---

## 4. Propuestas de mejora

Cada propuesta incluye los 8 campos solicitados. Complejidad y riesgo son evaluaciones de planificación, no estimaciones de horas.

---

### 1. Backup automático real (Windows-nativo) + restore funcional

- **Problema que resuelve:** hoy no existe ningún backup que efectivamente corra en una instalación real (el script es `bash`, no está empaquetado, y `pg_dump.exe` no se incluye en los binarios de Postgres embebidos) — confirmado contra una instalación real (`Backups/` vacía). El restore está explícitamente sin implementar.
- **Beneficio real:** la única copia de todos los datos del negocio deja de depender exclusivamente de que el disco de una sola máquina nunca falle.
- **Impacto para el negocio:** **crítico** — sin esto, una falla de hardware es pérdida total e irrecuperable de ventas, compras, clientes, caja y comprobantes históricos.
- **Complejidad:** Media (reescribir el mecanismo en Node/PowerShell en vez de bash, empaquetar `pg_dump.exe`, implementar el restore ya con la UI/IPC existente).
- **Riesgo:** bajo si se hace bien (es un mecanismo aislado, no toca lógica de negocio); alto si se sigue postergando.
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí (reemplazar `backup.job.ts`/`backup.sh` por un mecanismo multiplataforma real).
- **Cambios de frontend:** No (la UI de "Restaurar respaldo" ya existe en la pantalla de mantenimiento, solo falta que el handler deje de devolver `implemented:false`).

### 2. Revocación real de permisos al desactivar un rol personalizado

- **Problema que resuelve:** desactivar un rol personalizado no revoca sus permisos en la práctica — la consulta de permisos no filtra por `active`, y no se invalida ninguna sesión de sus usuarios.
- **Beneficio real:** cierra un hueco de seguridad real y silencioso — hoy "desactivar un rol" es una acción que aparenta funcionar (el switch cambia) pero no hace lo que promete.
- **Impacto para el negocio:** medio-alto — un administrador que cree haber revocado el acceso de un rol (por ejemplo, tras un cambio de personal) puede estar equivocado, y no hay ninguna señal visible de que el problema exista.
- **Complejidad:** Baja.
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí (filtrar por `active` en la resolución de permisos; considerar invalidar el `tokenVersion` de los usuarios de ese rol al desactivarlo).
- **Cambios de frontend:** No.

### 3. Cobertura real de auditoría (crear/editar producto, cambio de precio, apertura/cierre de caja, compras)

- **Problema que resuelve:** 6 de las 15 acciones de auditoría definidas nunca se emiten — nadie deja rastro de quién creó/editó un producto, cambió un precio, abrió/cerró una caja puntual o registró una compra.
- **Beneficio real:** trazabilidad real para disputas internas ("¿quién cambió este precio?") y para cualquier auditoría externa futura del negocio.
- **Impacto para el negocio:** medio — no bloquea la operación diaria, pero es exactamente el tipo de dato que se necesita justo cuando ya es tarde para generarlo retroactivamente.
- **Complejidad:** Baja-Media (el mecanismo de auditoría ya existe y funciona; es agregar las llamadas faltantes en los servicios correspondientes).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí.
- **Cambios de frontend:** No (opcionalmente, mostrar más de este historial en las pantallas de detalle ya existentes — Bloque separado, no incluido aquí).

### 4. Notificación proactiva de facturas electrónicas "inciertas" sin resolver

- **Problema que resuelve:** una venta que quedó con emisión incierta ante Alegra (timeout, sin confirmación) solo se resuelve si un humano vuelve a intentar la emisión de esa venta puntual — no hay ninguna señal proactiva de que existan ventas en ese estado.
- **Beneficio real:** visibilidad real de un problema fiscal potencial (una venta que nunca se facturó ante Hacienda) antes de que se descubra por accidente, semanas después.
- **Impacto para el negocio:** medio-alto — riesgo fiscal real si se acumulan ventas sin facturar y nadie las revisa.
- **Complejidad:** Baja (el dato `alegraEmissionUncertainAt` ya existe; es una consulta + una notificación, reutilizando el Centro de Notificaciones ya construido).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí (nuevo tipo de notificación, o un endpoint de conteo).
- **Cambios de frontend:** Sí (mostrarlo en el Centro de Notificaciones/Dashboard ya existente).

### 5. Cola de reintentos real para Alegra (en vez de "el usuario vuelve a apretar el botón")

- **Problema que resuelve:** una emisión fallida (Alegra caído, timeout) no se reintenta sola — el sistema ya tiene una cola de trabajos (`SyncJob`) diseñada exactamente para este propósito y hoy no se usa para esto.
- **Beneficio real:** menos intervención manual, y ventas que se facturan solas apenas Alegra vuelve a estar disponible, sin que el cajero/administrador tenga que acordarse de volver a intentarlo.
- **Impacto para el negocio:** medio — reduce trabajo manual y el riesgo de "se me olvidó reintentar esa factura".
- **Complejidad:** Media (conectar `emitInvoice` al `SyncJob` ya existente, con su propio handler en vez del stub actual).
- **Riesgo:** medio — tocar el flujo de emisión de Alegra ya tuvo un incidente real en el pasado (factura duplicada); requiere la misma disciplina de validación contra la cuenta real que se usó entonces.
- **Cambios de base de datos:** No (la tabla `SyncJob` ya existe).
- **Cambios de backend:** Sí.
- **Cambios de frontend:** No (opcionalmente, un indicador de "reintentando" — no incluido aquí).

### 6. Registrar el desglose real del pago mixto (efectivo vs. electrónico)

- **Problema que resuelve:** hallazgo real confirmado durante el QA End-to-End previo a esta auditoría — una venta con `paymentMethod: MIXED` no registra cuánto de esa venta fue efectivo, así que el arqueo de caja ("Efectivo esperado") queda por debajo del efectivo físico real recibido en cualquier sesión con al menos una venta de pago mixto.
- **Beneficio real:** el arqueo de caja cierra correctamente siempre, no solo cuando no hubo pagos mixtos en el turno.
- **Impacto para el negocio:** alto — hoy el cajero puede ver una "diferencia de caja" que no es un error suyo, sino un límite del sistema; esto genera desconfianza real en el proceso de cierre de caja.
- **Complejidad:** Media (nuevo campo/estructura en `Sale` para el desglose, regla de validación de que la suma coincida con el total, ajuste del cálculo de `paymentBreakdown` en reportes).
- **Riesgo:** medio — toca el modelo de datos de `Sale` y el flujo de cobro del POS, ambos ya muy probados; requiere la misma disciplina de no-regresión que el resto del POS.
- **Cambios de base de datos:** Sí.
- **Cambios de backend:** Sí.
- **Cambios de frontend:** Sí (el formulario de pago mixto en el POS ya existe — hoy captura un solo monto recibido, necesitaría capturar la porción de cada método).

### 7. Botón de rollback visible en la pantalla de mantenimiento

- **Problema que resuelve:** el mecanismo de rollback tras una actualización fallida ya está completamente implementado (instalador anterior en caché, verificación de que no hubo migraciones de por medio) pero no tiene ningún botón que lo dispare — la pantalla de mantenimiento solo ofrece reintentar, ver logs, o restaurar un backup (que a su vez no está implementado, ítem 1).
- **Beneficio real:** una actualización que deja la app "rota" (entra en modo mantenimiento) hoy se queda así indefinidamente sin intervención manual fuera de la app; con el botón, se resuelve sola, en la propia pantalla, con la lógica que ya existe y ya fue diseñada para esto.
- **Impacto para el negocio:** alto — es la diferencia entre "una actualización mala te deja sin POS por horas hasta que alguien con acceso remoto intervenga" y "un clic y volvés a la versión anterior".
- **Complejidad:** Baja (es exclusivamente wiring de UI — el `canRollback`/`rollbackUpdate` ya existen en el proceso principal e IPC).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No (es Electron, no el backend de la API).
- **Cambios de frontend:** Sí (agregar el botón a la pantalla de mantenimiento de Electron — no es el React del ERP, es la pantalla de splash/mantenimiento).

### 8. Aviso visible en el ERP cuando el backend se está reiniciando

- **Problema que resuelve:** el proceso de backend puede caerse y el watchdog de Electron ya lo reinicia solo (mecanismo robusto, ya probado) — pero durante esa ventana (10-45 segundos) el usuario no ve ningún aviso, solo errores genéricos de "no se pudo conectar" en la operación puntual que estaba haciendo.
- **Beneficio real:** el cajero entiende que el sistema se está recuperando solo, en vez de pensar que rompió algo o perder confianza en medio de una venta.
- **Impacto para el negocio:** medio — mejora la experiencia en un escenario que ya está resuelto técnicamente, solo falta comunicarlo.
- **Complejidad:** Baja (el evento ya se emite desde Electron; falta que el frontend lo escuche y muestre un banner).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí.

### 9. Manejo global de errores (Error Boundary) en el frontend

- **Problema que resuelve:** no existe ningún `ErrorBoundary` de React en toda la aplicación — un error de render no capturado en cualquier componente deja la pantalla completamente en blanco, sin ningún mensaje ni forma de recuperarse salvo recargar la página entera (perdiendo el contexto de lo que se estaba haciendo, por ejemplo una venta en curso en el POS).
- **Beneficio real:** un error localizado en una pantalla ya no tumba la aplicación completa — se puede mostrar un mensaje de error contenido y una acción de recuperación.
- **Impacto para el negocio:** alto en POS específicamente — una pantalla en blanco en medio de un cobro es el peor momento posible para eso.
- **Complejidad:** Baja.
- **Riesgo:** bajo (es una adición, no modifica ningún flujo existente).
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí.

### 10. División del bundle de JavaScript por rutas (code-splitting)

- **Problema que resuelve:** toda la aplicación se compila hoy en un solo archivo JavaScript de ~1.95MB (confirmado en cada build de esta sesión) — el usuario descarga y parsea el código de los 24 módulos del ERP para poder usar cualquiera de ellos, incluido el POS.
- **Beneficio real:** arranque más rápido, especialmente relevante en hardware de terminal POS modesto (no una estación de trabajo potente).
- **Impacto para el negocio:** medio — mejora percibida de velocidad, más notable cuanto más módulos se sigan agregando.
- **Complejidad:** Media (dividir por ruta con `React.lazy`/`Suspense` es mecánico, pero exige revisar cada ruta para no romper transiciones ni el estado compartido).
- **Riesgo:** medio — es un cambio transversal a TODAS las rutas; requiere validación cuidadosa de que ninguna pantalla quede con una pantalla de carga inesperada o un salto visual.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí.

### 11. Impresión térmica real (sin diálogo, corte automático) y apertura de gaveta de efectivo

- **Problema que resuelve:** hoy cada comprobante se imprime a través del diálogo estándar de impresión del sistema operativo — un paso manual extra en cada venta, sin corte automático de papel ni apertura automática de la gaveta de efectivo.
- **Beneficio real:** el flujo real de un mostrador de carnicería de alto volumen (imprimir y entregar el ticket sin fricción, abrir la gaveta al cobrar en efectivo) — hoy ninguna de las dos cosas existe.
- **Impacto para el negocio:** alto para la experiencia real del cajero en el día a día, aunque no bloquea la operación (el flujo actual funciona, solo es más lento).
- **Complejidad:** Alta (requiere integración con hardware real vía Electron — drivers ESC/POS o de gaveta, sin ningún código existente de referencia en ninguno de los tres repositorios).
- **Riesgo:** medio-alto — depende del hardware específico que use cada instalación real (marcas/modelos de impresora varían), así que probablemente no sea "una" solución sino soporte incremental por modelo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí (Electron específicamente, no el React web puro — rompería la compatibilidad con el build web si no se aísla bien).

### 12. Verificación periódica del invariante de inventario (`SUM(Batch.availableQuantity) = Inventory.quantity`)

- **Problema que resuelve:** el invariante se mantiene por código de aplicación en cada transacción, pero no existe ningún job que confirme que efectivamente se mantiene en el tiempo — si algún camino no probado lo rompiera, nadie se entera hasta que alguien note un número raro.
- **Beneficio real:** una red de seguridad real contra la corrupción silenciosa de datos de inventario.
- **Impacto para el negocio:** medio — es prevención, no corrige nada hoy roto, pero el costo de no tenerlo es "el inventario está mal y nadie sabe desde cuándo".
- **Complejidad:** Baja (un job de solo-lectura que compara y alerta, sin tocar ningún dato).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí.
- **Cambios de frontend:** No (opcionalmente, mostrar el resultado en algún panel de administración — no incluido aquí).

### 13. Índice de fecha en `InventoryMovement`

- **Problema que resuelve:** es la única tabla transaccional de alto crecimiento sin índice sobre su columna de fecha, a diferencia de `Sale`, `Purchase`, `CashSession`, `AuditLog` y `Batch`, que ya lo tienen.
- **Beneficio real:** consultas de kardex/trazabilidad más rápidas a medida que la tabla crece (es la tabla que crece más rápido de todo el sistema: una fila por cada línea de venta, compra, merma y devolución).
- **Impacto para el negocio:** bajo hoy (volumen todavía moderado), pero crece con el tiempo — es barato resolverlo ahora.
- **Complejidad:** Baja.
- **Riesgo:** bajo.
- **Cambios de base de datos:** Sí (una migración de índice, sin cambiar ningún dato).
- **Cambios de backend:** No.
- **Cambios de frontend:** No.

### 14. Content-Security-Policy en la ventana principal de Electron + saneamiento del protocolo `app://`

- **Problema que resuelve:** la ventana principal del ERP no tiene ninguna política de seguridad de contenido, y el manejador del protocolo `app://` no bloquea rutas con `..` codificado, lo que en teoría permitiría leer archivos fuera de la carpeta de la aplicación si alguna vez existiera una inyección de script en el React.
- **Beneficio real:** una capa de defensa adicional, barata de agregar, para un escenario que hoy requiere que ya exista otra vulnerabilidad para ser explotable — pero que no cuesta nada cerrar de una vez.
- **Impacto para el negocio:** bajo probabilidad hoy, alto impacto si algún día se combina con otra falla (podría exponer credenciales de base de datos).
- **Complejidad:** Baja.
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** No (es exclusivamente configuración de Electron).

### 15. Permisos de archivo restringidos para credenciales y secretos en disco

- **Problema que resuelve:** las credenciales de la base de datos y los secretos de la aplicación (incluida la contraseña inicial de administrador) se escriben en disco en texto plano con los permisos por defecto del sistema de archivos, sin restricción adicional.
- **Beneficio real:** cualquier otro usuario/proceso con acceso a esa máquina no puede leer esos archivos con solo mirarlos.
- **Impacto para el negocio:** bajo en un escenario de "una sola persona usa esa computadora", más relevante si la terminal es compartida.
- **Complejidad:** Baja.
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** No (Electron).

### 16. Diagnóstico exportable y acceso a logs desde la aplicación en uso normal

- **Problema que resuelve:** hoy los logs solo se pueden abrir desde la pantalla de mantenimiento (cuando el sistema ya está roto) — durante el uso normal, no hay ninguna forma de que un administrador o soporte técnico exporte un diagnóstico sin que alguien le explique dónde está la carpeta de AppData.
- **Beneficio real:** soporte remoto más rápido ("mandame el archivo de diagnóstico" en vez de una guía paso a paso para encontrar una carpeta oculta).
- **Impacto para el negocio:** medio — reduce el tiempo de resolución de cualquier incidente real que necesite soporte técnico externo.
- **Complejidad:** Baja-Media (empaquetar los logs relevantes en un solo archivo exportable, con un punto de entrada visible en la app en uso normal).
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí (Electron + un punto de entrada en el menú/configuración del ERP).

### 17. Cobertura de pruebas automatizadas en el frontend (hoy: cero)

- **Problema que resuelve:** el backend ya tiene 20 archivos de prueba (unitarias + integración); el frontend no tiene ningún test runner configurado ni ningún archivo de prueba.
- **Beneficio real:** protección real contra regresiones en los flujos más críticos (cálculo del carrito, checkout, apertura/cierre de caja) a medida que el proyecto sigue creciendo — hoy esa protección depende enteramente de QA manual.
- **Impacto para el negocio:** medio-largo plazo — no es urgente para operar hoy, pero el costo de no tenerlo crece con cada bloque nuevo de funcionalidad.
- **Complejidad:** Media (configurar el runner es rápido; escribir pruebas útiles de los flujos críticos reales toma tiempo real).
- **Riesgo:** bajo (es aditivo, no cambia comportamiento).
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí (solo tooling/tests, sin tocar componentes de producción).

### 18. Verificación real de salud de PostgreSQL (no solo TCP) + reinicio si el proceso muere

- **Problema que resuelve:** el chequeo de salud de Postgres hoy solo abre un socket TCP y lo da por saludable — un Postgres que escucha pero rechaza conexiones (recuperación, corrupción, fallo de autenticación) se reporta como sano; y si el proceso de Postgres muere durante un turno, nada lo reinicia (el watchdog de Electron solo supervisa el backend).
- **Beneficio real:** detección real de una base de datos rota, y recuperación automática de un Postgres caído a mitad de turno, en vez de que el negocio quede sin sistema hasta que alguien reinicie manualmente la aplicación completa.
- **Impacto para el negocio:** medio-alto — es exactamente el tipo de falla que ocurre sin aviso y en el peor momento (mitad de una venta).
- **Complejidad:** Media.
- **Riesgo:** medio (tocar el ciclo de vida de Postgres dentro de Electron requiere cuidado para no introducir un reinicio en bucle).
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí (Electron).

### 19. Timeout en la carga de la ventana principal (arranque de Electron)

- **Problema que resuelve:** la espera de que el frontend termine de cargar dentro de Electron no tiene ningún límite de tiempo — es el único paso del arranque sin timeout; si el bundle está corrupto o el protocolo `app://` falla, la aplicación se queda esperando indefinidamente en la pantalla de splash, sin pasar nunca a modo mantenimiento ni mostrar ningún error.
- **Beneficio real:** un fallo real en esa etapa puntual pasa a ser detectable y recuperable (modo mantenimiento) en vez de un cuelgue silencioso e indefinido.
- **Impacto para el negocio:** medio — el escenario es raro, pero cuando ocurre, hoy no hay ninguna salida visible para el usuario.
- **Complejidad:** Baja.
- **Riesgo:** bajo.
- **Cambios de base de datos:** No.
- **Cambios de backend:** No.
- **Cambios de frontend:** Sí (Electron).

### 20. Derivar `sucursalId` de la sesión en lecturas/reportes, en vez de un filtro opcional

- **Problema que resuelve:** hoy los endpoints de lectura/reportes aceptan `sucursalId` como un parámetro opcional en vez de derivarlo siempre de la sesión del usuario — invisible mientras solo exista una sucursal por instalación (el caso real hoy), pero sería una fuga de datos entre sucursales el día que dos sucursales comparten una sola base de datos.
- **Beneficio real:** cierra una vía de fuga de datos entre sucursales antes de que exista una segunda sucursal real que la exponga, en vez de descubrirla en producción.
- **Impacto para el negocio:** bajo hoy (no aplica con una sola sucursal); se vuelve alto el día que el negocio decida abrir una segunda sucursal compartiendo la misma base de datos/instalación.
- **Complejidad:** Media (tocar todos los endpoints de lectura/reportes para que ignoren el parámetro externo y usen siempre el de la sesión).
- **Riesgo:** bajo (es una restricción, no un cambio de comportamiento para el caso de una sola sucursal).
- **Cambios de base de datos:** No.
- **Cambios de backend:** Sí.
- **Cambios de frontend:** No.

---

## 5. Clasificación por prioridad

### Prioridad Alta (deberían entrar en la 1.1, y el ítem 1 antes incluso de eso)

| # | Propuesta | Por qué es Alta |
|---|---|---|
| 1 | Backup automático real + restore funcional | Riesgo de pérdida total de datos del negocio. Se recomienda como parche 1.0.1 separado, no esperar a la 1.1. |
| 6 | Registrar el desglose real del pago mixto | Bug real ya confirmado con impacto directo en el cierre de caja diario. |
| 7 | Botón de rollback visible en mantenimiento | Mecanismo ya construido, solo falta conectarlo — altísimo valor por muy poco esfuerzo. |
| 9 | Error Boundary global en el frontend | Un solo error de render hoy puede tumbar toda la app, incluido el POS en medio de un cobro. |
| 2 | Revocación real de permisos al desactivar un rol | Hueco de seguridad silencioso, bajo esfuerzo de corrección. |

### Prioridad Media (1.2 o posteriores)

| # | Propuesta |
|---|---|
| 3 | Cobertura real de auditoría |
| 4 | Notificación proactiva de facturas inciertas en Alegra |
| 5 | Cola de reintentos real para Alegra |
| 8 | Aviso visible cuando el backend se reinicia solo |
| 10 | Code-splitting del bundle de JavaScript |
| 12 | Verificación periódica del invariante de inventario |
| 16 | Diagnóstico exportable / acceso a logs en uso normal |
| 18 | Verificación real de salud de Postgres + reinicio automático |
| 20 | Derivar `sucursalId` de la sesión en lecturas/reportes |

### Baja prioridad (solo si aportan valor / oportunistas)

| # | Propuesta |
|---|---|
| 11 | Impresión térmica real + gaveta de efectivo (alto valor de UX, pero complejidad y riesgo altos, y depende del hardware de cada instalación) |
| 13 | Índice de fecha en `InventoryMovement` |
| 14 | CSP + saneamiento de `app://` |
| 15 | Permisos de archivo para secretos |
| 17 | Cobertura de pruebas automatizadas en el frontend |
| 19 | Timeout en la carga de la ventana principal |

---

## 6. Deudas técnicas reales

Distintas de las propuestas de arriba — esto es código que funciona hoy pero que representa una obligación pendiente real:

- **Identidad de sesión por `role.name` en vez de `roleId`** (ya documentada en `ROADMAP.md` del backend) — renombrar un rol invalida la resolución de permisos de sus sesiones activas hasta el próximo login. Ya mitigado para los roles de sistema (bloqueados de renombrarse); sigue abierto para roles personalizados.
- **Mezcla de autorización por rol literal y por código de permiso** en ~13 rutas administrativas — deliberada, pero significa que ningún rol personalizado puede recibir acceso a esas rutas sin llamarse literalmente "ADMIN".
- **Backup por script bash** — código muerto en la práctica en el entorno real (Windows empaquetado). Reemplazarlo (propuesta 1) también elimina esta deuda.
- **`node_modules` del backend sin recortar en el paquete de escritorio** — no afecta funcionalidad, sí el tamaño del instalador.
- **Ausencia total de restricciones `CHECK` a nivel de base de datos** para invariantes de negocio (cantidades/montos no negativos) — hoy se confía enteramente en la capa de aplicación.

## 7. Funcionalidades que hoy funcionan pero pueden mejorarse

- **Impresión de comprobantes** — funciona (vía diálogo del sistema operativo), pero con fricción real en el mostrador (propuesta 11).
- **Sincronización a la nube (`SyncJob`)** — la cola funciona correctamente como mecanismo, pero su único handler real es un stub; hoy no sincroniza nada a ningún destino real.
- **Reconciliación de facturas inciertas en Alegra** — funciona, pero de forma reactiva (solo si alguien vuelve a intentar la emisión); podría ser proactiva (propuestas 4 y 5).
- **Logs y diagnóstico** — existen y son de buena calidad técnica, pero solo son accesibles en el peor momento posible (cuando el sistema ya está en modo mantenimiento).

## 8. Oportunidades de automatización

- Backup automático real (propuesta 1) — hoy "automático" existe solo en el nombre.
- Reintento automático de emisión de Alegra vía la cola ya existente (propuesta 5), en vez de depender de que un humano se acuerde de reintentar.
- Verificación periódica automática del invariante de inventario (propuesta 12), en vez de descubrir una inconsistencia por casualidad.
- Reinicio automático de Postgres si el proceso muere (propuesta 18), extendiendo el mismo patrón de watchdog que ya existe para el backend.

## 9. Oportunidades de rendimiento

- Índice de fecha en `InventoryMovement` (propuesta 13) — la tabla de mayor crecimiento del sistema, la única sin ese índice.
- Code-splitting del bundle de JavaScript (propuesta 10) — arranque más rápido en hardware de terminal modesto.
- Observabilidad del pool de conexiones a la base de datos — hoy no hay ninguna métrica ni alerta si el pool vuelve a saturarse (ya ocurrió una vez, causa raíz corregida, pero sin monitoreo para detectarlo temprano si vuelve a pasar por otro motivo).

## 10. Oportunidades para simplificar código

- Reemplazar el script de backup en bash por una única implementación multiplataforma (Node o PowerShell) elimina un camino de código que hoy no puede funcionar nunca en el entorno real.
- Consolidar gradualmente la mezcla de autorización por rol literal y por permiso (documentada como deliberada, pero es una superficie de código con dos formas de expresar lo mismo) — no urgente, pero cada middleware nuevo agrega otra decisión "¿esto va por permiso o por rol?" que no debería existir en un sistema maduro.
- El watchdog de Electron y el `AppHealthMonitor` hoy son dos mecanismos de supervisión paralelos con responsabilidades que se solapan parcialmente (uno reinicia el backend, el otro solo observa sin actuar) — vale la pena revisarlos juntos cuando se implemente la propuesta 18, para no terminar con tres mecanismos de supervisión en vez de uno bien hecho.

---

## 11. Riesgos pendientes

- **Backup/restore (propuesta 1):** riesgo crítico ya en producción hoy, no algo que la 1.1 "introduciría" — cada día sin resolver es un día de exposición real a pérdida total de datos.
- **Pago mixto (propuesta 6):** riesgo operativo real y ya confirmado, con impacto de confianza en el proceso de cierre de caja mientras no se resuelva.
- **Rollback inalcanzable (propuesta 7):** una actualización futura que falle deja el sistema en mantenimiento sin salida propia hasta que se conecte el botón — el riesgo crece con cada actualización nueva que se publique antes de resolver esto.
- Todo lo demás en esta auditoría es mejora, no riesgo activo — el sistema es seguro de operar hoy en su forma actual para el resto de los hallazgos.

---

## 12. Conclusión

**La versión 1.0.0 queda confirmada como lista para producción** — esta auditoría no encontró ningún hallazgo que invalide esa aprobación ya otorgada tras el QA Final 1.0. Los hallazgos de este documento son, con una sola excepción, mejoras genuinas para planificar la 1.1, no defectos que bloqueen el uso real del sistema hoy.

La excepción es el backup/restore (propuesta 1): se recomienda tratarlo como una corrección urgente independiente de la 1.1 — idealmente un parche 1.0.1 — dado que representa el único riesgo de esta lista con potencial de pérdida total e irreversible de los datos del negocio, y su corrección es de complejidad media, no alta.

Con esa salvedad, el roadmap hacia la 1.1 propuesto en la sección 5 (Prioridad Alta) es alcanzable sin reabrir ninguna decisión de arquitectura ya cerrada, y sin comprometer ninguna de las reglas de negocio ya validadas en producción.
