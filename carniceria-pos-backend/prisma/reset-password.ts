/**
 * prisma/reset-password.ts
 * -----------------------------------------------------------------------------
 * Herramienta de soporte/desarrollo: restablece la contraseña de UN usuario
 * ya existente, identificado por `--username` o `--email` (exactamente uno
 * de los dos). Reutiliza `hashPassword` (`shared/utils/password.ts`, la
 * MISMA funcion que usa `users.service.ts` al crear/editar un usuario desde
 * la API) y `usersRepository.findByUsername`/`findByEmail`/`update` — no
 * duplica logica de hasheo, no escribe SQL/Prisma a mano, no toca ningun
 * otro campo del usuario (el `update` solo envia `passwordHash`).
 *
 * Valida que el usuario exista ANTES de escribir nada — si no existe, no se
 * modifica la base de datos y se informa el error con codigo de salida
 * distinto de 0.
 *
 * Uso:
 *   npm run reset-password -- --username=admin --password="NuevaClave123!"
 *   npm run reset-password -- --email=admin@carniceria.local --password="NuevaClave123!"
 *
 * (el `--` despues de `reset-password` es necesario para que npm reenvie
 * los flags al script en vez de interpretarlos como propios).
 */
import { logger } from '../src/config';
import { prisma } from '../src/database/prisma.client';
import { hashPassword } from '../src/shared/utils/password';
import * as usersRepository from '../src/modules/users/users.repository';

interface ParsedArgs {
  username?: string;
  email?: string;
  password: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const username = values.get('username');
  const email = values.get('email');
  const password = values.get('password');

  if (!username && !email) {
    throw new Error('Debes indicar --username=<usuario> o --email=<correo>.');
  }

  if (username && email) {
    throw new Error('Indica solo uno: --username o --email, no ambos.');
  }

  if (!password) {
    throw new Error('Debes indicar --password=<nueva contraseña>.');
  }

  if (password.length < 8) {
    throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
  }

  return { username, email, password };
}

async function main(): Promise<void> {
  const { username, email, password } = parseArgs(process.argv.slice(2));

  const user = username
    ? await usersRepository.findByUsername(username)
    : await usersRepository.findByEmail(email!);

  if (!user) {
    const label = username ? `username "${username}"` : `email "${email}"`;
    throw new Error(`No existe ningun usuario con ${label}. No se modifico nada.`);
  }

  const passwordHash = await hashPassword(password);

  await usersRepository.update(user.id, { passwordHash });

  logger.info(
    `✅ Contraseña restablecida correctamente para "${user.username}" (${user.email ?? 'sin correo'}, id ${user.id}).`,
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, `❌ No se pudo restablecer la contraseña: ${(error as Error).message}`);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
