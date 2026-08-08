/**
 * shared/utils/password.ts
 * -----------------------------------------------------------------------------
 * Unica fuente de verdad para hashear contraseñas — bcrypt +
 * `env.BCRYPT_SALT_ROUNDS`. Antes esta llamada estaba duplicada, inline, en
 * los dos lugares de `users.service.ts` que hasheaban una contraseña (alta
 * y edicion de usuario). Se extrae aca para que cualquier otro punto del
 * sistema que necesite hashear una contraseña con la MISMA politica (ej.
 * `prisma/reset-password.ts`) use exactamente esta funcion, no una copia
 * del llamado a bcrypt.
 */
import bcrypt from 'bcrypt';
import { env } from '@/config';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}
