/**
 * modules/integrations/alegra/alegra.crypto.ts
 * -----------------------------------------------------------------------------
 * Cifrado en reposo del token de Alegra (Bloque 7.4). A diferencia de
 * `User.passwordHash`/`RefreshToken.tokenHash` (hash de una via, solo para
 * verificar), este token debe poder RECUPERARSE en texto plano para
 * autenticar cada llamada saliente a Alegra — no hay ningun precedente de
 * secreto reversible en este backend (confirmado en el analisis del
 * Bloque 7.1), asi que este archivo es la primera implementacion.
 *
 * AES-256-GCM con la clave de `env.INTEGRATIONS_ENCRYPTION_KEY` (32 bytes
 * hex, validada en `config/env.ts`). El blob persistido en
 * `AlegraConfig.token` tiene la forma `"<iv>:<authTag>:<cipher>"`, cada
 * segmento en base64 — un unico string, sin columnas separadas, para
 * mantener el modelo Prisma minimo (ver `schema.prisma`).
 */
import crypto from 'node:crypto';
import { env } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

function getKey(): Buffer {
  return Buffer.from(env.INTEGRATIONS_ENCRYPTION_KEY, 'hex');
}

/** Cifra un texto plano (el token de Alegra) a un blob persistible. */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Descifra un blob generado por `encryptSecret` de vuelta a texto plano. */
export function decryptSecret(blob: string): string {
  const [ivB64, authTagB64, cipherB64] = blob.split(':');

  if (!ivB64 || !authTagB64 || !cipherB64) {
    throw new Error('Formato de credencial cifrada invalido.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/** Ultimos 4 caracteres del token en texto plano, para mostrar en la UI sin
 * exponer el valor completo (ver Bloque 7.4, punto 6: "el token no debe
 * mostrarse en texto plano"). */
export function maskSecret(plainText: string): string {
  const visible = plainText.slice(-4);
  return `••••••••${visible}`;
}
