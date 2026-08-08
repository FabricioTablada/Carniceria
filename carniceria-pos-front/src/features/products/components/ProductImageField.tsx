import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { cn } from '@/lib/utils'
import { ProductImageCropperDialog } from './ProductImageCropperDialog'
import {
  PRODUCT_IMAGE_ALLOWED_FORMATS_LABEL,
  PRODUCT_IMAGE_MAX_SIZE_MB,
  validateProductImageFile,
} from '../utils/productImageValidation'

interface ProductImageFieldProps {
  /** Imagen ya guardada en el servidor (con `?v=` de cache-busting ya
   * resuelto por el backend) — `null`/`undefined` sin imagen, o (en
   * creacion) mientras el producto todavia no existe. */
  currentImageUrl?: string | null
  /** Nombre del producto — alt de la imagen / inicial del placeholder. */
  productName: string
  /** Se dispara con el archivo YA validado (formato/tamaño) apenas el
   * usuario lo selecciona o lo suelta. Este componente no decide que
   * hacer con el archivo (subirlo ya mismo, o guardarlo hasta que el
   * producto exista) — eso lo resuelve quien lo usa
   * (`CreateProductPage.tsx`/`EditProductPage.tsx`). */
  onFileSelected: (file: File) => void
  /** Se dispara al presionar "Eliminar imagen". */
  onRemove: () => void
  isUploading?: boolean
  isDeleting?: boolean
  /** Error de servidor de la ultima operacion (subida o borrado) — el
   * padre lo controla para poder mostrar tambien fallos de red, no solo
   * de validacion local. */
  error?: string | null
  /** Rediseño de Productos: tamaño del contenedor de la miniatura —
   * aditivo, por defecto el mismo de siempre (`size-24 shrink-0 rounded-xl
   * border`). La pestaña "Imagen" (`ProductForm.tsx`) pasa un tamaño mayor
   * para darle prioridad visual a la imagen, sin cambiar ningún otro
   * comportamiento de este componente. */
  thumbnailContainerClassName?: string
}

/**
 * features/products/components/ProductImageField.tsx
 * -----------------------------------------------------------------------------
 * Bloque 10 (gestion completa de imagenes de productos). Componente
 * reutilizable — usado por `ProductForm.tsx` en modo creacion y edicion —
 * que cubre: imagen actual, placeholder (`ProductThumbnail`, mismo
 * componente que ya usa el catalogo del POS y el panel de Resumen), vista
 * previa local inmediata (`URL.createObjectURL`, antes de cualquier
 * respuesta del servidor), cambiar/eliminar imagen, selector de archivo, y
 * arrastrar y soltar.
 *
 * La vista previa local se descarta automaticamente en cuanto
 * `currentImageUrl` cambia (ajuste de estado durante el render, no en un
 * efecto — mismo patron ya usado en el resto del modulo POS): eso pasa
 * quando una subida/reemplazo/borrado se confirma en el servidor y
 * `useProduct`/`useProducts` refresca con la `imageUrl` real — a partir de
 * ahi el componente vuelve a mostrar el dato del servidor, no el local.
 *
 * Manejo de fallos (para no dejar una experiencia confusa): si la subida
 * falla, la vista previa local NO se descarta — el usuario sigue viendo lo
 * que eligio, con un mensaje de error claro y un boton "Reintentar" que
 * reenvia el mismo archivo sin tener que volver a seleccionarlo.
 *
 * Bloque 10.1 (editor de imagenes): elegir/soltar un archivo YA NO genera
 * la vista previa ni llama a `onFileSelected` de inmediato — primero abre
 * `ProductImageCropperDialog.tsx` (`react-easy-crop`) para que el usuario
 * defina el encuadre en una relacion 4:3. El archivo pendiente/vista
 * previa de este componente solo se reemplaza al confirmar "Guardar
 * recorte" (`handleCropConfirm`, con el archivo YA recortado); si el
 * usuario cancela el editor, no se toca ningun estado — el campo queda
 * exactamente como estaba antes de elegir ese archivo.
 */
export function ProductImageField({
  currentImageUrl,
  productName,
  onFileSelected,
  onRemove,
  isUploading = false,
  isDeleting = false,
  error,
  thumbnailContainerClassName = 'size-24 shrink-0 rounded-xl border',
}: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Archivo ORIGINAL recien elegido, en lo que el usuario define el
  // encuadre — separado de `pendingFile` (el que YA se recorto y se
  // reporta al padre) a proposito, ver doc del componente arriba.
  const [cropperFile, setCropperFile] = useState<File | null>(null)
  const [cropperObjectUrl, setCropperObjectUrl] = useState<string | null>(null)

  const [trackedImageUrl, setTrackedImageUrl] = useState(currentImageUrl)
  if (trackedImageUrl !== currentImageUrl) {
    setTrackedImageUrl(currentImageUrl)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPendingFile(null)
    setPreviewUrl(null)
    setLocalError(null)
  }

  const isBusy = isUploading || isDeleting

  /** Solo valida formato/tamaño del archivo ORIGINAL y abre el editor de
   * encuadre — no toca `pendingFile`/`previewUrl` ni llama a
   * `onFileSelected` todavia (eso pasa recien en `handleCropConfirm`). */
  const handleRawFileSelected = (file: File) => {
    const validationError = validateProductImageFile(file)

    if (validationError) {
      setLocalError(validationError)
      return
    }

    setLocalError(null)
    setCropperFile(file)
    setCropperObjectUrl(URL.createObjectURL(file))
  }

  const closeCropper = () => {
    if (cropperObjectUrl) {
      URL.revokeObjectURL(cropperObjectUrl)
    }

    setCropperFile(null)
    setCropperObjectUrl(null)
  }

  /** El usuario confirmo "Guardar recorte" — recien aca el archivo
   * (YA recortado) reemplaza al pendiente y se reporta al padre. */
  const handleCropConfirm = (croppedFile: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPendingFile(croppedFile)
    setPreviewUrl(URL.createObjectURL(croppedFile))
    setLocalError(null)
    onFileSelected(croppedFile)
    closeCropper()
  }

  /** El usuario cancelo el editor — no se toca ningun otro estado del
   * campo, queda exactamente como antes de elegir este archivo. */
  const handleCropCancel = () => {
    closeCropper()
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Permite volver a elegir EL MISMO archivo dos veces seguidas (ej.
    // reintentar tras un error sin usar el boton "Reintentar").
    event.target.value = ''

    if (file) {
      handleRawFileSelected(file)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)

    if (isBusy) {
      return
    }

    const file = event.dataTransfer.files?.[0]
    if (file) {
      handleRawFileSelected(file)
    }
  }

  const handleRemoveClick = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPendingFile(null)
    setPreviewUrl(null)
    setLocalError(null)
    onRemove()
  }

  const handleRetry = () => {
    if (pendingFile) {
      onFileSelected(pendingFile)
    }
  }

  const displayedError = localError ?? error
  const displayedImageUrl = previewUrl ?? currentImageUrl
  const canRemove = Boolean(displayedImageUrl) && !isBusy

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-4">
        <div className="relative">
          <ProductThumbnail
            imageUrl={displayedImageUrl}
            title={productName || '?'}
            containerClassName={thumbnailContainerClassName}
            textClassName="text-3xl text-brand/40"
          />
          {isBusy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              if (!isBusy) {
                setIsDraggingOver(true)
              }
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors',
              isDraggingOver ? 'border-brand bg-brand/5' : 'border-input',
              isBusy && 'pointer-events-none opacity-60',
            )}
          >
            <Upload className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Arrastra una imagen aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
                className="font-semibold text-brand underline-offset-2 hover:underline disabled:pointer-events-none"
              >
                selecciona un archivo
              </button>
            </p>
            <p className="text-[0.6875rem] text-muted-foreground/70">
              {PRODUCT_IMAGE_ALLOWED_FORMATS_LABEL} · Máximo {PRODUCT_IMAGE_MAX_SIZE_MB}MB
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleInputChange}
            disabled={isBusy}
            aria-label="Seleccionar imagen del producto"
          />

          {canRemove && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveClick}
              disabled={isBusy}
              className="w-fit"
            >
              <Trash2 className="size-3.5" />
              Eliminar imagen
            </Button>
          )}
        </div>
      </div>

      {displayedError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">{displayedError}</p>
          {!localError && pendingFile && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isBusy}
              className="shrink-0 text-xs font-semibold text-destructive underline-offset-2 hover:underline disabled:pointer-events-none"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {cropperFile && cropperObjectUrl && (
        <ProductImageCropperDialog
          file={cropperFile}
          imageSrc={cropperObjectUrl}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
