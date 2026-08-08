#!/usr/bin/env bash
#
# load-tests/monitoring/monitor-postgres.sh
# -----------------------------------------------------------------------------
# Fase 15, Bloque D. Muestrea pg_stat_activity cada N segundos mientras corre
# un escenario de k6 en otra terminal, y escribe una fila CSV por muestra.
# Correr en paralelo al escenario de k6, nunca antes/despues: el objetivo es
# ver la evolucion de las conexiones DURANTE la carga.
#
# Requiere el cliente `psql` disponible en el PATH y apuntando a la MISMA
# base de datos de pruebas de carga que usa el backend bajo prueba (revisar
# DATABASE_URL). Si `psql` no esta instalado (ocurre en algunos entornos de
# desarrollo Windows sin herramientas de PostgreSQL en el PATH), usar en su
# lugar `pg-stat-snapshot.sql` desde cualquier cliente grafico (pgAdmin,
# DBeaver, la extension de PostgreSQL de VS Code) tomando capturas manuales
# cada pocos minutos.
#
# Uso:
#   ./monitor-postgres.sh <connection-string> <output.csv> [interval-seconds]
#
# Ejemplo:
#   ./monitor-postgres.sh "postgresql://postgres:pass@localhost:5432/carniceria_pos_loadtest" pg-metrics.csv 5

set -euo pipefail

CONN="${1:?Uso: monitor-postgres.sh <connection-string> <output.csv> [interval-seconds]}"
OUT="${2:?Uso: monitor-postgres.sh <connection-string> <output.csv> [interval-seconds]}"
INTERVAL="${3:-5}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql no esta disponible en el PATH. Ver el comentario de este" >&2
  echo "script para la alternativa manual (pg-stat-snapshot.sql)." >&2
  exit 1
fi

echo "timestamp,total_connections,active,idle,idle_in_transaction,waiting_on_lock,longest_query_seconds,longest_tx_seconds,max_connections" > "$OUT"

echo "Muestreando cada ${INTERVAL}s hacia ${OUT}. Ctrl+C para detener."

while true; do
  ROW=$(psql "$CONN" -tA -F',' -c "
    SELECT
      now(),
      count(*) FILTER (WHERE datname = current_database()),
      count(*) FILTER (WHERE datname = current_database() AND state = 'active'),
      count(*) FILTER (WHERE datname = current_database() AND state = 'idle'),
      count(*) FILTER (WHERE datname = current_database() AND state = 'idle in transaction'),
      count(*) FILTER (WHERE datname = current_database() AND wait_event_type = 'Lock'),
      COALESCE(EXTRACT(EPOCH FROM max(now() - query_start)) FILTER (WHERE datname = current_database() AND state = 'active'), 0),
      COALESCE(EXTRACT(EPOCH FROM max(now() - xact_start)) FILTER (WHERE datname = current_database()), 0),
      (SELECT setting FROM pg_settings WHERE name = 'max_connections')
    FROM pg_stat_activity;
  ")

  echo "$ROW" >> "$OUT"
  sleep "$INTERVAL"
done
