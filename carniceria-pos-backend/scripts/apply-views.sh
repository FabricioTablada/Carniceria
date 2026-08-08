#!/usr/bin/env bash
# ============================================================================
#  apply-views.sh - Aplica las vistas SQL de reporting (Power BI, decision #3)
#  Ejecuta todos los .sql de prisma/sql/views contra la base de datos.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VIEWS_DIR="$PROJECT_ROOT/prisma/sql/views"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-carniceria_pos}"
DB_USER="${POSTGRES_USER:-pos_user}"

shopt -s nullglob
FILES=("$VIEWS_DIR"/*.sql)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "[views] No hay vistas SQL para aplicar todavia."
  exit 0
fi

for sql in "${FILES[@]}"; do
  if [ "$(basename "$sql")" = "apply-views.sql" ]; then
    continue
  fi

  echo "[views] Aplicando $(basename "$sql")"
  PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
    --dbname="$DB_NAME" --file="$sql"
done

echo "[views] Completado."
