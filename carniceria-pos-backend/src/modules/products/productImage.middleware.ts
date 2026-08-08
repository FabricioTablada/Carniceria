/**
 * modules/products/productImage.middleware.ts
 * -----------------------------------------------------------------------------
 * Middleware de `multer` para `POST /products/:id/image` (Bloque 10).
 * `memoryStorage`: el archivo llega completo en `req.file.buffer`, sin
 * tocar disco por su cuenta — quien escribe el archivo final es siempre
 * `productImageStorage.ts` (unico punto que decide el nombre/ubicacion).
 *
 * `fileFilter` rechaza cualquier mimetype fuera de la whitelist ANTES de
 * terminar de recibir el archivo (no despues, con el archivo ya en
 * memoria) — el error se pasa como `ValidationError` (`AppError`), que el
 * `errorHandler` global ya sabe traducir a una respuesta 422 consistente,
 * igual que un error de Zod.
 */
import multer from 'multer';
import { PRODUCT_IMAGE_ALLOWED_MIME_TYPES, PRODUCT_IMAGE_MAX_SIZE_BYTES } from '@/config';
import { ValidationError } from '@/shared/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_IMAGE_MAX_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number])) {
      callback(
        new ValidationError(
          `Formato de imagen no soportado. Usa ${PRODUCT_IMAGE_ALLOWED_MIME_TYPES.join(', ')}.`,
        ),
      );
      return;
    }

    callback(null, true);
  },
});

/** Campo `image` del `multipart/form-data` — un unico archivo por peticion. */
export const productImageUpload = upload.single('image');
