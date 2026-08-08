/**
 * jobs/backup.job.ts
 * -----------------------------------------------------------------------------
 * Respaldo automatico de la base de datos (requisito #8).
 *
 * Parche 1.0.1 (Backup & Restore real): reemplaza la version anterior, que
 * delegaba en `scripts/backup.sh` via `spawn('bash', ...)` — inejecutable en
 * una instalacion real de Windows (sin bash, sin `pg_dump` en el PATH, y el
 * propio script nunca se empaquetaba). Este archivo invoca `pg_dump`
 * directamente desde Node, sin bash y sin depender de que el usuario tenga
 * nada instalado: en una instalacion de escritorio, `carniceria-pos-desktop`
 * inyecta `POSTGRES_BIN_DIR` apuntando a la carpeta donde ya empaqueta
 * `pg_dump.exe`/`pg_restore.exe` junto al resto de PostgreSQL portable (ver
 * `prepare-package-resources.js` de ese repo). Sin esa variable (desarrollo
 * local, o un despliegue futuro sin Electron), se asume que `pg_dump` ya
 * esta en el PATH del sistema, igual que cualquier instalacion normal de
 * PostgreSQL.
 *
 * `DATABASE_URL` (ya validada como URL por `config/env.ts`) es la unica
 * fuente de credenciales/host/puerto/nombre de base — se parsea con el
 * mismo mecanismo que ya usa `buildDatabaseUrl` (desktop) para construirla,
 * sin inventar variables nuevas de conexion.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { env, logger } from '@/config';

const execFileAsync = promisify(execFile);

/** Igual que `pg_ctl`/`postgres`/`initdb` en `postgres-manager.ts`
 * (desktop): el nombre del ejecutable depende del sistema operativo, `.exe`
 * unicamente en Windows. */
function resolvePgDumpPath(): string {
  const exeName = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
  return env.POSTGRES_BIN_DIR ? path.join(env.POSTGRES_BIN_DIR, exeName) : exeName;
}

interface ParsedDatabaseUrl {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/** `db-credentials.ts` (desktop) codifica la contrasena con
 * `encodeURIComponent` al construir `DATABASE_URL` — se decodifica de
 * vuelta aca, mismo criterio inverso. */
function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Aplica la retencion configurada (`BACKUP_RETENTION_DAYS`) sobre los
 * archivos `.dump` de `BACKUP_DIR` — mismo criterio que el `find -mtime`
 * del script anterior, ahora en Node. Errores de retencion se registran
 * pero no hacen fallar el respaldo que ya se completo. */
function applyRetention(): void {
  const cutoff = Date.now() - env.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(env.BACKUP_DIR).filter((file) => file.endsWith('.dump'));

    for (const file of files) {
      const filePath = path.join(env.BACKUP_DIR, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoff) {
        fs.rmSync(filePath, { force: true });
        logger.info(`Respaldo antiguo eliminado por retencion (${env.BACKUP_RETENTION_DAYS} dias): ${filePath}`);
      }
    }
  } catch (err) {
    logger.warn({ err }, 'No se pudo aplicar la politica de retencion de respaldos.');
  }
}

/**
 * Corre `pg_dump` contra `DATABASE_URL` y valida el resultado real (Parche
 * 1.0.1, adicion obligatoria #1): un respaldo cuyo archivo no existe, o
 * existe con 0 bytes, se considera fallido y se descarta — nunca se deja un
 * archivo vacio en `BACKUP_DIR` haciendose pasar por un respaldo valido.
 *
 * Nunca lanza: cada rama de error se registra con el logger existente
 * (adicion obligatoria #4: inicio/exito/error) y la funcion retorna
 * normalmente, igual que la version anterior — `scheduler.ts` la invoca con
 * `void runBackupJob()`, sin `await`/manejo de rechazo.
 */
export async function runBackupJob(): Promise<void> {
  if (!env.BACKUP_ENABLED) {
    logger.info('Respaldo automatico deshabilitado (BACKUP_ENABLED=false).');
    return;
  }

  const { host, port, user, password, database } = parseDatabaseUrl(env.DATABASE_URL);
  const pgDump = resolvePgDumpPath();

  fs.mkdirSync(env.BACKUP_DIR, { recursive: true });
  const outFile = path.join(env.BACKUP_DIR, `${database}_${backupTimestamp()}.dump`);

  logger.info(`Iniciando respaldo automatico de la base de datos -> ${outFile}`);

  try {
    await execFileAsync(
      pgDump,
      ['--host', host, '--port', port, '--username', user, '--format=custom', '--file', outFile, database],
      {
        env: { ...process.env, PGPASSWORD: password },
        windowsHide: true,
        timeout: 5 * 60_000,
      },
    );
  } catch (err) {
    logger.error({ err }, `El respaldo automatico fallo al ejecutar pg_dump (-> "${outFile}").`);
    return;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(outFile);
  } catch (err) {
    logger.error({ err }, `El respaldo automatico no genero ningun archivo en "${outFile}".`);
    return;
  }

  if (stat.size === 0) {
    fs.rmSync(outFile, { force: true });
    logger.error(`El respaldo automatico genero un archivo vacio (0 bytes) en "${outFile}" — se descarta como fallido.`);
    return;
  }

  logger.info(`Respaldo completado correctamente: ${outFile} (${stat.size} bytes).`);
  applyRetention();
}
