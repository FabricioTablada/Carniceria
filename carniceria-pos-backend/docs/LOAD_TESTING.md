# Plan de Pruebas de Carga — Fase 15, Bloque D

Auditoría de validación de los Bloques A (infraestructura crítica de Prisma/timeouts/errores no manejados), B (optimización de transacciones) y C (invalidación granular de React Query, frontend). Este documento **no implementa optimizaciones nuevas** — solo define y deja lista la infraestructura para medir objetivamente si esos tres bloques mejoraron el comportamiento real del sistema bajo uso intensivo.

Todo lo referenciado aquí (`load-tests/`) son archivos nuevos, aislados de la aplicación — ningún archivo de producción fue modificado para este bloque.

---

## 1. Estrategia de pruebas

No se puede validar "estabilidad bajo un turno de 8 horas" con una sola prueba: cada bloque aprobado ataca un síntoma distinto, así que cada uno necesita un tipo de prueba distinto para confirmarse:

- **Bloque A** (pool de conexiones, timeouts de transacción, manejo de errores no capturados) se valida con **carga sostenida concurrente** — el síntoma que motivó el bloque era agotamiento de conexiones/timeouts bajo transacciones simultáneas, no bajo tráfico bajo.
- **Bloque B** (round-trips de `recordMovements`/`createSale`/`createPurchase`/`createReturn`) se valida específicamente con **carritos grandes** (muchas líneas), que es el caso que más se beneficia de agrupar lecturas/escrituras.
- **Bloque C** (invalidación granular de React Query) es un cambio de **frontend puro** — un generador de carga que golpea la API directamente (k6) no lo ejercita, porque la invalidación ocurre en el navegador, no en el backend. Se valida por un camino distinto (sección 3, "Validación específica de Bloque C").
- El síntoma original más grave ("deja de responder, hay que reiniciar") solo aparece con el tiempo, no con una ráfaga corta — de ahí la necesidad de una prueba de **resistencia (soak)** de duración real, no solo pruebas de segundos/minutos.

Por eso el plan combina cuatro tipos de prueba (smoke, carga sostenida, estrés progresivo, soak/resistencia) en vez de una sola.

## 2. Herramientas seleccionadas

| Herramienta | Uso | Por qué esta y no otra |
|---|---|---|
| **k6** | Generador de carga HTTP con escenarios | Scripting en JavaScript (mismo lenguaje que el resto del proyecto, sin curva de aprendizaje adicional), soporta flujos de negocio con dependencias entre pasos (login → abrir sesión de caja → crear venta referenciando esa sesión) mucho mejor que herramientas de un solo endpoint. Tiene `stages`/`executors` nativos para ramp-up/ramp-down/soak, `thresholds` que hacen fallar la corrida automáticamente si se cruza un límite, y métricas custom (`Counter`, `Trend`) — necesario para contar 429 exactamente y medir p95/p99 de duración de transacción. No requiere agregarse como dependencia del proyecto (binario standalone), por lo que no toca `package.json`. |
| `psql` (script `monitor-postgres.sh`) | Muestreo de `pg_stat_activity` | Acceso directo a las vistas de sistema de Postgres — ninguna librería intermedia agrega valor aquí. |
| PowerShell (`monitor-process.ps1`) | CPU/memoria del proceso Node | El entorno objetivo es Windows on-premise (`docs/DEPLOYMENT.md`); usa contadores del sistema operativo sobre el proceso ya corriendo, sin agregar ningún endpoint de métricas al backend. |

**Por qué no autocannon**: autocannon es excelente para saturar un único endpoint con el mismo payload, pero este sistema necesita flujos con estado (login una sola vez, abrir/reutilizar una sesión de caja, referenciar su id en cada venta) — autocannon no tiene un modelo de "script con pasos" comparable al de k6, se quedaría corto para simular un carrito de compras con líneas aleatorias o una venta que dependa de una sesión ya abierta.

**Por qué no Artillery**: viable, pero k6 tiene mejor ergonomía de `thresholds`/`checks` y es más usado en este tipo de validación backend-only; no hay ninguna razón del proyecto (stack, plataforma) que favorezca a Artillery sobre k6.

## 3. Escenarios de carga

Todos viven en `load-tests/k6/scenarios/` (ver `load-tests/README.md` para el orden de ejecución exacto):

| Escenario | Qué simula | Qué valida | Duración sugerida |
|---|---|---|---|
| `smoke.js` | 1 usuario, 3 iteraciones | El entorno de prueba está bien armado (login, seeds, endpoints responden) — correr siempre primero | ~10s |
| `cashier-workday.js` | El flujo COMPLETO y en orden de un cajero real: apertura de caja → ventas (carritos variables, mezcla CASH/CARD) → compras de reposición → devoluciones contra ventas del propio turno → ajuste manual de inventario → merma → consulta de reportes → cierre de caja | Corrección **funcional** de punta a punta bajo los Bloques A/B/C ya aplicados — no es un escenario de volumen (`VUS=1` por defecto, ver limitación de una sola caja registradora sembrada) | ~1-2 min por turno; `ITERATIONS` para varios turnos consecutivos |
| `sales-load.js` | Varias cajas vendiendo de forma continua y concurrente contra la misma sesión de caja abierta, carritos de 1-12 líneas (algunas repitiendo producto, a propósito) | Bloques A y B bajo el tráfico que más estresa el pool/transacciones | 3-5 min |
| `purchases-load.js` | Compras concurrentes con carritos deliberadamente grandes (5-30 líneas) | Bloque B específicamente (el caso que motivó agrupar `recordMovements`) | 3-5 min |
| `stress-to-429.js` | Rampa de 10 → 100 VUs y vuelta a 10, sin pausas realistas | En qué punto exacto aparece el 429, y si el sistema se recupera solo al bajar la carga (sin necesitar reinicio) | ~5 min |
| `mixed-soak.js` | Ventas continuas + compras ocasionales + una "pantalla de Dashboard" abierta consultando reportes repetidamente (el patrón exacto del diagnóstico original de la Fase 15) | Comportamiento tras cientos de operaciones sostenidas — degradación progresiva, fugas de memoria/conexiones | 30-60 min (turno de 8h comprimido) |

`cashier-workday.js` cubre un ángulo que los demás no cubren: **corrección**
bajo un flujo de negocio realista y completo (los otros cuatro se enfocan en
volumen/concurrencia de un solo tipo de operación a la vez). Debe correr
antes que los escenarios de volumen — si algo en el flujo funcional está
roto, no tiene sentido medir qué tan rápido se rompe bajo carga.

### Validación específica del Bloque C (frontend)

`mixed-soak.js` reproduce el patrón de tráfico que la invalidación granular del Bloque C debía reducir (una pantalla de reportes abierta mientras hay ventas/compras), pero mide el resultado **desde el backend** (menos requests de reportes por venta/compra). Para confirmar el efecto del lado del **navegador** (menos refetch disparados por React Query), no hace falta un script nuevo — basta con:

1. Abrir el frontend real con DevTools → pestaña Network, filtrando por `reports`.
2. Registrar una venta desde el POS.
3. Contar cuántas requests a `/reports/*` dispara esa única acción.
4. Comparar contra el número esperado documentado en el Bloque C (10 en vez de 12 para ventas; 5 para compras; 2 para inventario/mermas; 1 para caja).

Esto es una verificación puntual (no un script de carga) porque el Bloque C es un cambio de comportamiento del cliente, no de capacidad del servidor — no tiene sentido automatizarlo con k6.

## 4. Métricas que se medirán

| Métrica | Cómo se captura | De qué bloque es evidencia |
|---|---|---|
| Tiempo de respuesta (avg, p95, p99) por tipo de operación | k6 (`http_req_duration` + `Trend` custom por endpoint: `sale_create_duration`, `purchase_create_duration`, `report_fetch_duration`) | A, B |
| Cantidad de requests / throughput (req/s) | Resumen de k6 al finalizar (`http_reqs`) | Volumen general |
| Errores 429 | `Counter` custom `rate_limited_429` en cada escenario | Backend (rate limiter), no un bloque en sí — línea base para futuras fases |
| Errores 5xx | `Counter` custom `server_errors_5xx` (solo en `stress-to-429.js`) | A (deben ser 0 — un 5xx bajo carga indica que algo distinto al rate limiter está fallando) |
| Conexiones activas/idle/idle-in-transaction de PostgreSQL | `monitor-postgres.sh` (o `pg-stat-snapshot.sql` manual), muestreo cada 5s | A (pool de conexiones) |
| Duración de transacciones/queries en curso | Incluido en `monitor-postgres.sh` (`longest_query_seconds`, `longest_tx_seconds`) | B (¿se acercan al `timeout`/`maxWait` de `transactionConfig`?) |
| Locks activos | `pg-stat-snapshot.sql`, sección 3 | B (contención sobre `Inventory` bajo ventas concurrentes) |
| CPU y memoria (working set) del proceso Node | `monitor-process.ps1`, muestreo cada 5s | A (¿la memoria crece de forma sostenida a lo largo del soak, o se estabiliza?) |
| Cantidad de refetch de reportes por venta/compra | Verificación manual en DevTools (sección 3) | C |

## 5. Criterios para considerar el sistema estable

Un escenario se considera **aprobado** si, al finalizar, se cumple todo lo siguiente (los `thresholds` de cada script de k6 ya codifican la mayoría):

1. **Cero errores 5xx** en cualquier escenario, en cualquier momento (incluido el pico de `stress-to-429.js`) — un 500 bajo carga indica una excepción no manejada o una conexión de pool agotada sin traducirse a un error controlado, no un límite de tráfico legítimo.
2. **429 solo bajo `stress-to-429.js`**, y en ningún otro escenario (`sales-load.js`, `purchases-load.js`, `mixed-soak.js` tienen el threshold `rate_limited_429: ['count==0']`) — si aparecen 429 en tráfico "realista", el rate limiter sigue mal calibrado para el uso real, independientemente de los Bloques A/B/C.
3. **Latencia estable en el tiempo durante `mixed-soak.js`**: el p95 de los primeros 5 minutos y el de los últimos 5 minutos no deben diferir en más de ~30%. Un crecimiento sostenido indica degradación progresiva (justo el síntoma original de la Fase 15).
4. **Memoria del proceso Node estable o con crecimiento acotado** durante el soak: se espera una curva que crece al inicio (JIT warmup, caches) y luego se aplana — una pendiente positiva sostenida hasta el final del soak es indicio de fuga.
5. **Conexiones de PostgreSQL nunca alcanzan `max_connections`**, y el número de conexiones `idle in transaction` vuelve a 0 (o cerca) entre picos de carga — conexiones `idle in transaction` que se acumulan y no bajan indican transacciones que no cierran correctamente.
6. **Recuperación sin intervención manual** tras el pico de `stress-to-429.js`: en la etapa de "vuelta a 10 VUs", la tasa de error y la latencia deben volver a los niveles de la etapa inicial de 10 VUs, sin necesidad de reiniciar el proceso backend.
7. **Ninguna transacción excede el `timeout` configurado** en `transactionConfig` del Bloque B (10s para `standard`, 20s para `bulk`) — visible como `P2028` en los logs del backend si ocurriera; el `longest_tx_seconds` de `monitor-postgres.sh` debería mantenerse claramente por debajo de esos valores incluso bajo carga.

Si **cualquiera** de estos siete puntos falla, el sistema **no** se considera validado para un turno de 8 horas real — el punto que falló indica exactamente qué bloque (o qué configuración, ej. `RATE_LIMIT_MAX`) necesita revisarse en una fase posterior (fuera de alcance de este Bloque D, que es solo de medición).

## 6. Archivos creados

```
carniceria-pos-backend/
├── docs/
│   └── LOAD_TESTING.md                          (este documento)
└── load-tests/
    ├── README.md                                 (guía rápida de ejecución)
    ├── k6/
    │   ├── config.js                             (BASE_URL, credenciales, fixtures via env vars)
    │   ├── lib/
    │   │   └── auth.js                            (login único + bootstrap de fixtures + refresh de token)
    │   └── scenarios/
    │       ├── smoke.js
    │       ├── cashier-workday.js
    │       ├── sales-load.js
    │       ├── purchases-load.js
    │       ├── stress-to-429.js
    │       └── mixed-soak.js
    └── monitoring/
        ├── monitor-postgres.sh                    (requiere psql)
        ├── pg-stat-snapshot.sql                    (alternativa manual sin psql)
        └── monitor-process.ps1                     (CPU/memoria del proceso Node, Windows)
```

Ninguno de estos archivos es importado por `src/` ni por el frontend — son completamente externos a la aplicación.

## 7. Riesgos

- **El más importante: estos scripts generan cientos/miles de filas de `Sale`/`Purchase`/`InventoryMovement` reales.** Deben correr contra una base de datos **dedicada a pruebas de carga** (ej. `carniceria_pos_loadtest`), nunca contra producción ni contra la base de desarrollo con datos reales del negocio. `config.js` no fuerza esto por código (sería necesario modificar el backend para impedirlo, fuera de alcance de este bloque, que no toca código de producción) — es una responsabilidad operativa de quien ejecute las pruebas.
- **`psql` no está disponible en el PATH de esta máquina de desarrollo** (verificado durante la preparación de este bloque) — `monitor-postgres.sh` requiere instalarlo, o usar la alternativa manual (`pg-stat-snapshot.sql`) desde un cliente gráfico.
- **El rate limiter (`RATE_LIMIT_MAX=300/15min`, hallazgo original de la Fase 15) no fue tocado** — es intencional (Bloque D es de medición, no de optimización), pero significa que `sales-load.js`/`mixed-soak.js` con VUs altos probablemente SÍ van a toparse con 429 hoy, incluso con los Bloques A/B/C aplicados, porque ese hallazgo específico sigue sin resolverse. Este plan está diseñado para hacer esa brecha visible con números concretos, no para ocultarla.
  **Actualización (Fase 19, posterior a este Bloque D):** el rate limiter dejó de ser un único limiter global — ahora hay cuatro políticas independientes por categoría de tráfico (`auth`/`transactional`/`reports`/`administrative`, ver `config/rateLimitPolicies.ts`), declaradas por endpoint. Las cuatro siguen usando el mismo valor numérico (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`) — se cambió la arquitectura, no la calibración. Un caso real de uso (no un escenario de `load-tests/`) volvió a producir 429 y no-respuesta temporal bajo compras/ventas/devoluciones/anulaciones intercaladas en volumen — registrado como hallazgo abierto, sin causa raíz confirmada, en `docs/AUDIT_REPORT.md` sección 15.
  **Actualización (03/08/2026, RESUELTO — ver `docs/AUDIT_REPORT.md` sección 16):** ambos hallazgos de estabilidad bajo carga real (agotamiento del pool de Prisma por doble conexión en `createSaleTransaction()`, y la falta de calibración por categoría del rate limiter) fueron investigados con evidencia empírica y corregidos antes de la versión 1.0 — incluyendo la separación de una 5ª categoría, `salesQuote`, exclusiva de `POST /sales/quote` (antes competía por el mismo cupo que `POST /sales` bajo `transactional`, la causa concreta que agotaba el cupo en un turno real de ~60 ventas). Las 5 categorías ya no comparten `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` — cada una tiene su propio par de variables, calibrado a su volumen real (ver tabla en `docs/AUDIT_REPORT.md` sección 16.2). **Ambos hallazgos fueron descubiertos y validados mediante uso real e intensivo del ERP, no mediante estos escenarios de `load-tests/` — correr `stress-to-429.js`/`mixed-soak.js`/`sales-load.js` contra el sistema ya corregido queda como el siguiente paso de las pruebas de estabilidad del ERP**, para confirmar de forma reproducible y automatizada que ambos problemas quedan resueltos bajo volumen sostenido (no solo bajo la reproducción puntual usada durante la investigación).
- **`stress-to-429.js` sube hasta 100 VUs deliberadamente** — correrlo contra un servidor compartido con otros usos (o contra la base de desarrollo real) afectaría a quien esté usando ese entorno al mismo tiempo. Correr únicamente en un entorno aislado.
- **El escenario de soak asume que el backend corre con `npm run start`** (build de producción), no `npm run dev` (`tsx watch`, que además tiene overhead propio de recarga en caliente que contaminaría las métricas de CPU/memoria).
- **Los fixtures (`PRODUCT_SKU`, proveedor, caja registradora) dependen de que `prisma/seed.ts` (el seed principal del proyecto) ya haya corrido** contra la base de pruebas — si no, `smoke.js` falla con un mensaje explícito indicando qué falta, en vez de fallar de forma confusa más adelante.
- **`cashier-workday.js` corre con `VUS=1` por defecto**: solo hay una caja registradora sembrada por defecto (`prisma/seed.ts`, "Caja Principal") y el esquema no permite más de una `CashSession` abierta a la vez para la misma caja. Correr varios cajeros en paralelo con este escenario específico requeriría sembrar cajas registradoras adicionales — deliberadamente fuera de alcance (no se modifican seeds de producción en este bloque). Con `ITERATIONS>1` sí se validan varios turnos consecutivos, uno detrás del otro.

**Actualización (03/08/2026):** ninguno de los escenarios de `load-tests/k6/` listados en este documento (sección 3) se ejecutó todavía — siguen siendo infraestructura lista, a la espera de aprobación. Lo que sí se ejecutó y aprobó es una suite distinta, complementaria, de **uso real** (no de concurrencia/volumen artificial): `load-tests/realistic-session/` (Niveles 2 y 3, ver sección 8 más abajo) — la etapa de estabilización del backend quedó **cerrada oficialmente** en base a esos dos niveles, sin necesidad de ejecutar los escenarios k6 de esta sección. Correr `stress-to-429.js`/`mixed-soak.js`/`sales-load.js` en el futuro seguiría siendo válido como validación adicional de concurrencia/volumen (un ángulo que los Niveles 2/3 no cubren a propósito), pero no es un requisito pendiente de esta etapa ya cerrada.

---

## 8. Suite de uso real ejecutada y aprobada — `load-tests/realistic-session/` (Niveles 2 y 3, 03/08/2026)

A diferencia de los escenarios k6 de este documento (secciones 1-7, orientados a concurrencia/volumen y todavía no ejecutados), esta suite simula el comportamiento de **un único cajero real** operando el ERP durante una sesión larga, con una secuencia **aleatoria** (no un patrón fijo) de acciones de negocio genuinas — el objetivo explícito era dar por **validado el backend para uso intensivo real** antes de continuar con la siguiente etapa del proyecto (Electron, ver `ROADMAP.md`).

Ambos niveles reutilizan la misma infraestructura: cliente HTTP mínimo (fetch nativo de Node, sin dependencias nuevas), login/bootstrap de fixtures, PRNG determinístico (semilla reproducible), utilidades estadísticas (`load-tests/realistic-session/lib/common.mjs`), y — a partir del Nivel 3 — monitoreo de memoria del proceso backend y del pool de PostgreSQL (`lib/monitor.mjs`). Ambos corrieron contra una base de datos aislada (`carniceria_pos_realuse`), nunca contra desarrollo/producción, con el backend compilado (`npm run build` + `node dist/server.js`, no `tsx watch`).

### Nivel 2 — `cashier-realistic-session.mjs` — ✅ APROBADO

Sesión de ~12 minutos: búsqueda de productos, armado/edición de carrito, cotización (`POST /sales/quote`), confirmación de venta, historial de ventas, Dashboard, Reportes, movimientos de caja, vuelta al catálogo del POS. Resultado: **39 ventas, 634 consultas, 673 operaciones totales, 0 errores de ningún tipo** (0 4xx, 0 429, 0 5xx, 0 timeouts). Reporte JSON conservado en `load-tests/realistic-session/reports/cashier-realistic-session_2026-08-03T14-40-46-531Z.json`.

### Nivel 3 — `cashier-intensive-shift.mjs` — ✅ APROBADO (prueba definitiva de validación)

Jornada intensiva de ~26 minutos (mínimo 25 min, tope de seguridad 45 min si algún mínimo tardaba en cumplirse — no hizo falta), agregando anulaciones, correcciones, devoluciones y **compras grandes** (>₡8.000.000 cada una, para estresar de verdad Inventario/Lotes/FEFO/Costos/Promociones/Kardex) — naciendo `RECEIVED` directamente para disparar creación de lotes y movimientos en el mismo paso. Después de cada compra/anulación/corrección/devolución se fuerza una consulta de Dashboard + Inventario + Reportes, para obligar al backend a recalcular continuamente.

Mínimos exigidos y resultado real:

| | Mínimo exigido | Resultado |
|---|---|---|
| Ventas | 100 | **184** |
| Anulaciones | 40 | **85** |
| Correcciones | 20 | **59** |
| Devoluciones | 20 | **41** |
| Compras (>₡8M c/u) | 30 | **59** |

**Métricas obtenidas** (3942 operaciones totales, 3514 consultas): tiempo promedio general 17.8 ms (p95 31.9 ms, p99 50.3 ms); por tipo — venta 25.3ms/35.2ms/43.8ms (prom/p95/p99), compra 43.6/55.8/82.5ms, anulación 28.2/36.2/50.9ms, corrección 50.1/74.6/81.4ms, devolución 35.6/47.0/50.0ms. Memoria del proceso backend estable (131.7MB → 183.4MB, sin indicio de fuga). Pool de PostgreSQL: máximo 11 conexiones simultáneas, nunca cerca del límite (`connection_limit=20`). Degradación progresiva: +2.7% entre el primer y el último cuarto de la corrida — no relevante.

**Errores encontrados: cero** — 0 errores 4xx, 0 respuestas 429, 0 errores 5xx, 0 timeouts, 0 excepciones. Reporte JSON conservado en `load-tests/realistic-session/reports/cashier-intensive-shift_2026-08-03T15-42-10-243Z.json`.

**Nota metodológica (hallazgo del propio proceso de prueba, no del backend):** la primera corrida del Nivel 3 (26 min) cruzó la vida útil del `accessToken` JWT (`JWT_EXPIRES_IN=15min`), generando 401 en cascada y una ráfaga de 429 derivada — artefacto del cliente de prueba, no un defecto del backend. Se corrigió agregando refresco periódico de token (`POST /auth/refresh`, cada 8 min) al script, mismo patrón ya usado en `load-tests/k6/lib/auth.js` para `mixed-soak.js`, y se volvió a correr la prueba completa — el resultado documentado arriba es el de la corrida ya corregida.

### Conclusión técnica y cierre de la etapa

**El backend queda validado para uso intensivo real de un único cajero.** Combinado con los hallazgos de estabilidad ya corregidos y documentados en `docs/AUDIT_REPORT.md` sección 16 (agotamiento del pool de Prisma, recalibración del Rate Limiter), y verificado ahora bajo una jornada realista de 26 minutos con 184 ventas, 59 compras grandes, 85 anulaciones, 59 correcciones y 41 devoluciones sin un solo error de ningún tipo — **la etapa de estabilización del backend queda oficialmente cerrada** (03/08/2026). Ver `ROADMAP.md` para el detalle de la siguiente gran etapa del proyecto (Electron).
