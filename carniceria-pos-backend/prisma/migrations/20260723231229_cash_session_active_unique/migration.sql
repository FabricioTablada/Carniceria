-- This is an empty migration.

CREATE UNIQUE INDEX "cash_sessions_active_unique"
ON "cash_sessions"("cash_register_id")
WHERE "status" = 'OPEN';
