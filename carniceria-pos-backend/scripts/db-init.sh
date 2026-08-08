#!/usr/bin/env bash
# ============================================================================
#  db-init.sh - Crea la base de datos local si no existe.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

echo "[db-init] Verificando/creando base de datos $DB_NAME"
PGPASSWORD="${POSTGRES_PASSWORD:-}" createdb \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  "$DB_NAME" 2>/dev/null && echo "[db-init] Base creada." || echo "[db-init] La base ya existe o no se pudo crear."
