# load-tests/

Infraestructura de prueba de carga (Fase 15, Bloque D). Nada de este
directorio se importa desde `src/` ni desde el frontend — es completamente
externo a la aplicación, pensado para ejecutarse contra un backend ya
levantado (`npm run start` o `npm run dev`).

Ver **`docs/LOAD_TESTING.md`** para el plan completo (estrategia, escenarios,
métricas, criterios de estabilidad). Este archivo es solo la referencia
rápida de cómo ejecutar lo que ya está armado.

## Requisitos

- [k6](https://k6.io/docs/get-started/installation/) instalado (`k6 version` para confirmar).
- Backend corriendo contra una **base de datos dedicada a pruebas de carga**
  (nunca la de producción ni la de desarrollo con datos reales — ver riesgos
  en `docs/LOAD_TESTING.md`), ya sembrada con `prisma/seed.ts` (el seed
  principal del proyecto).
- Opcional para el monitoreo de PostgreSQL: `psql` en el PATH.

## Orden de ejecución recomendado

```bash
# 1. Prueba de humo — SIEMPRE primero, confirma que el entorno está bien armado
k6 run load-tests/k6/scenarios/smoke.js

# 2. Flujo funcional completo de un cajero (apertura → ventas → compras →
#    devoluciones → ajuste → merma → reportes → cierre) — correr antes que
#    los escenarios de volumen, valida CORRECCIÓN funcional end-to-end
k6 run load-tests/k6/scenarios/cashier-workday.js
k6 run -e ITERATIONS=5 load-tests/k6/scenarios/cashier-workday.js   # 5 turnos consecutivos

# 3. Carga sostenida de ventas (Bloques A/B)
k6 run load-tests/k6/scenarios/sales-load.js

# 4. Compras con carritos grandes (Bloque B)
k6 run load-tests/k6/scenarios/purchases-load.js

# 5. Encontrar el techo (rate limiter, recuperación tras el pico)
k6 run load-tests/k6/scenarios/stress-to-429.js

# 6. Turno de 8h comprimido (el más importante — correr al final, con más tiempo disponible)
k6 run -e DURATION=45m load-tests/k6/scenarios/mixed-soak.js
```

`cashier-workday.js` corre con `VUS=1` por defecto: solo hay una caja
registradora sembrada por defecto (`prisma/seed.ts`) y una `CashSession` no
puede tener más de una sesión abierta a la vez para la misma caja — ver el
comentario al inicio del script para el detalle.

Todas las variables de entorno (`BASE_URL`, `VUS`, `DURATION`, etc.) tienen
un default razonable — ver `k6/config.js` y el encabezado de cada escenario.

## Monitoreo en paralelo

Mientras corre cualquier escenario (en otra terminal):

```bash
# PostgreSQL (requiere psql)
./load-tests/monitoring/monitor-postgres.sh "postgresql://user:pass@localhost:5432/carniceria_pos_loadtest" pg-metrics.csv 5
```

```powershell
# Proceso Node (CPU/memoria) — PowerShell
./load-tests/monitoring/monitor-process.ps1 -OutFile process-metrics.csv -IntervalSeconds 5
```

Ambos escriben CSV que se puede abrir en Excel/Sheets para graficar la
evolución en el tiempo junto al resumen que imprime k6 al finalizar.
