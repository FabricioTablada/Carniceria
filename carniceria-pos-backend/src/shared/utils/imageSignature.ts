/**
 * shared/utils/imageSignature.ts
 * -----------------------------------------------------------------------------
 * Hallazgo de seguridad #7 (auditoria 31/07/2026): verifica el contenido
 * REAL de un archivo contra un mimetype declarado, comparando los primeros
 * bytes (magic numbers/firma de formato) — el `mimetype` que reporta
 * `multer` (`productImage.middleware.ts`) viene del `Content-Type` que el
 * cliente elige libremente en el `multipart/form-data`, nunca del
 * contenido real del archivo, asi que por si solo no prueba nada.
 *
 * Sin dependencias externas (`file-type`/`sharp`): solo cubre los 3
 * formatos de `PRODUCT_IMAGE_ALLOWED_MIME_TYPES` (`config/productImages.ts`),
 * la unica whitelist que hoy consume esta verificacion. No es una
 * validacion completa de imagen (no decodifica el archivo), pero rechaza
 * el caso relevante: un archivo cuyo contenido no coincide en absoluto con
 * el tipo declarado (ej. HTML/script disfrazado de `.png`).
 */
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii');
const WEBP_FORMAT_SIGNATURE = Buffer.from('WEBP', 'ascii');

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

/**
 * `true` unicamente si `buffer` empieza con los bytes de firma esperados
 * para `mimeType`. Un mimetype fuera de los 3 soportados devuelve `false`
 * — mismo criterio conservador que `extensionForMimeType` (`null` si no
 * esta en la whitelist).
 */
export function matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return startsWith(buffer, JPEG_SIGNATURE);
    case 'image/png':
      return startsWith(buffer, PNG_SIGNATURE);
    case 'image/webp':
      // RIFF....WEBP: "RIFF" en el byte 0, tamaño (4 bytes, ignorado), "WEBP" en el byte 8.
      return (
        startsWith(buffer, WEBP_RIFF_SIGNATURE) &&
        buffer.length >= 12 &&
        buffer.subarray(8, 12).equals(WEBP_FORMAT_SIGNATURE)
      );
    default:
      return false;
  }
}
