/**
 * load-tests/realistic-session/lib/monitor.mjs
 * -----------------------------------------------------------------------------
 * Muestreo periódico de recursos del sistema durante el Nivel 3 ("jornada
 * intensiva"): memoria del proceso Node del backend (vía PowerShell
 * `Get-Process`, mismo criterio ya documentado en `docs/LOAD_TESTING.md`
 * para `monitor-process.ps1`) y uso del pool de conexiones de Prisma/
 * PostgreSQL (vía `pg_stat_activity`, mismo criterio que
 * `monitor-postgres.sh`/`pg-stat-snapshot.sql`).
 *
 * Ambos son OPCIONALES y se degradan con una advertencia (no interrumpen la
 * prueba) si no se puede detectar el PID del backend o si no se provee
 * `MONITOR_DATABASE_URL` — deliberado: este script nunca hardcodea
 * credenciales reales de PostgreSQL (a diferencia de los scripts
 * diagnósticos temporales de sesiones anteriores, este archivo se conserva
 * permanentemente en el repositorio).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);

async function runPowerShell(command) {
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', command], {
    timeout: 8000,
  });
  return stdout.trim();
}

/** Detecta el PID que escucha `port` en localhost (Windows). Devuelve `null`
 * si no se pudo determinar (no interrumpe la prueba). */
export async function detectListeningPid(port) {
  try {
    const out = await runPowerShell(
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`,
    );
    const pid = Number(out);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Memoria del proceso `pid` en MB (working set). `null` si el proceso ya
 * no existe o no se pudo consultar. */
export async function sampleProcessMemoryMb(pid) {
  try {
    const out = await runPowerShell(
      `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty WorkingSet64)`,
    );
    const bytes = Number(out);
    return Number.isFinite(bytes) ? bytes / (1024 * 1024) : null;
  } catch {
    return null;
  }
}

/** Cliente de solo-monitoreo contra la misma base de datos aislada de la
 * prueba (nunca contra la base real) — únicamente lee `pg_stat_activity`,
 * nunca escribe. */
export function createPoolMonitor(monitorDatabaseUrl) {
  if (!monitorDatabaseUrl) {
    return {
      enabled: false,
      sample: async () => null,
      dispose: async () => {},
    };
  }

  const prisma = new PrismaClient({ datasourceUrl: monitorDatabaseUrl });

  async function sample() {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT state, count(*)::int AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
         GROUP BY state`,
      );
      const byState = {};
      let total = 0;
      for (const row of rows) {
        const key = row.state || 'unknown';
        byState[key] = row.count;
        total += row.count;
      }
      return { total, byState };
    } catch (err) {
      return { error: err.message };
    }
  }

  return {
    enabled: true,
    sample,
    dispose: () => prisma.$disconnect(),
  };
}

/**
 * Arranca un intervalo de muestreo combinado (memoria + pool). Devuelve
 * `{ samples, stop }` — `samples` es el arreglo que se va llenando en vivo
 * (se puede leer en cualquier momento, incluso antes de `stop()`).
 */
export function startResourceMonitor({ pid, poolMonitor, intervalMs, startedAt }) {
  const samples = [];

  const timer = setInterval(async () => {
    const [memoryMb, pool] = await Promise.all([
      pid ? sampleProcessMemoryMb(pid) : Promise.resolve(null),
      poolMonitor.enabled ? poolMonitor.sample() : Promise.resolve(null),
    ]);
    samples.push({
      elapsedMs: performance.now() - startedAt,
      memoryMb,
      pool,
    });
  }, intervalMs);

  return {
    samples,
    stop: () => clearInterval(timer),
  };
}
