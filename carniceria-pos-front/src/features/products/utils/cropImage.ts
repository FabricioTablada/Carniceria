/**
 * features/products/utils/cropImage.ts
 * -----------------------------------------------------------------------------
 * Bloque 10.1 (editor de imagenes): recorta una imagen en el NAVEGADOR con
 * `<canvas>`, a partir del rectangulo que devuelve `react-easy-crop`
 * (`onCropComplete`, en pixeles NATIVOS de la imagen original, no de
 * pantalla) — nada de esto toca el backend, que sigue recibiendo un
 * `File` normal por el mismo endpoint de siempre.
 *
 * Calidad: se dibuja el rectangulo 1:1 (sin reescalar de mas salvo que el
 * usuario haga zoom mas alla del 100% del original, inherente a cualquier
 * editor de este tipo) y se reexporta con el MISMO mimetype del archivo
 * elegido, a `quality` alto para formatos con perdida — un unico paso de
 * recompresion, no una cadena de reencodes.
 */

export interface PixelCropArea {
  x: number
  y: number
  width: number
  height: number
}

/** Calidad de exportacion para mimetypes con compresion con perdida
 * (jpeg/webp) — PNG la ignora (siempre sin perdida). */
const EXPORT_QUALITY = 0.92

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar la imagen para recortarla.'))
    image.src = src
  })
}

/**
 * Recorta `imageSrc` (una URL de objeto local, `URL.createObjectURL`) al
 * area indicada y devuelve un `File` nuevo — mismo `fileName`/`mimeType`
 * que el original, listo para reemplazar el archivo sin recortar en el
 * flujo de subida existente (`ProductImageField.tsx`).
 */
export async function cropImageToFile(
  imageSrc: string,
  cropArea: PixelCropArea,
  mimeType: string,
  fileName: string,
): Promise<File> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cropArea.width)
  canvas.height = Math.round(cropArea.height)

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('No se pudo preparar el recorte de la imagen.')
  }

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, EXPORT_QUALITY)
  })

  if (!blob) {
    throw new Error('No se pudo generar el recorte de la imagen.')
  }

  return new File([blob], fileName, { type: mimeType })
}
