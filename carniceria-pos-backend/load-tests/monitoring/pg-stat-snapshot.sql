-- load-tests/monitoring/pg-stat-snapshot.sql
-- -----------------------------------------------------------------------------
-- Fase 15, Bloque D. Alternativa manual a monitor-postgres.sh para cuando no
-- hay `psql` disponible en el PATH: pegar en cualquier cliente grafico
-- (pgAdmin, DBeaver, extension de PostgreSQL de VS Code) conectado a la base
-- de datos de PRUEBAS DE CARGA, y ejecutar cada 1-2 minutos mientras corre un
-- escenario de k6, guardando el resultado (captura de pantalla o exportar
-- fila) con su hora.

-- 1. Resumen de conexiones por estado (lo mas importante: total vs max_connections)
SELECT
  count(*) FILTER (WHERE state = 'active')              AS active,
  count(*) FILTER (WHERE state = 'idle')                AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction')  AS idle_in_transaction,
  count(*)                                                AS total_this_db,
  (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS max_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- 2. Transacciones/queries mas largas en curso ahora mismo (para detectar
--    si alguna transaccion de venta/compra se esta quedando colgada mas de
--    lo esperado bajo carga — comparar contra transactionConfig.bulk del
--    Bloque B: timeout 20s, maxWait 5s).
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  now() - xact_start AS tx_duration,
  now() - query_start AS query_duration,
  left(query, 120) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND state <> 'idle'
ORDER BY xact_start ASC
LIMIT 20;

-- 3. Locks activos (para confirmar que no hay contencion inesperada entre
--    ventas concurrentes sobre la misma fila de Inventory).
SELECT
  locktype,
  relation::regclass AS relation,
  mode,
  granted,
  pid
FROM pg_locks
WHERE NOT granted
   OR relation IS NOT NULL
ORDER BY granted, relation;
