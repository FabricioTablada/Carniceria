import { useEffect, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { cropImageToFile } from '../utils/cropImage'
import { PRODUCT_IMAGE_ASPECT_RATIO } from '../utils/productImageValidation'

const INITIAL_CROP: Point = { x: 0, y: 0 }
/** Piso histórico del zoom manual (slider/botón "-") — se mantiene como
 * valor por defecto para cualquier imagen que no lo necesite mas bajo. */
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

interface NaturalSize {
  width: number
  height: number
}

/**
 * Incidencia 2 (UX del editor, 07/08/2026): que tan cerca del "cover"
 * (recorte agresivo original) arranca el encuadre automatico, en vez de
 * "contain" puro (foto completa, con margen — probado y descartado por
 * dejar el producto chico dentro del marco). `0` = identico a "contain";
 * `1` = identico al "cover" original de siempre. Es el UNICO numero
 * pensado para afinarse mirando fotos reales del catalogo — no requiere
 * tocar ninguna otra logica de este archivo.
 */
const INITIAL_ZOOM_SAFETY_MARGIN = 0.8

/**
 * Zoom "contain" (relativo al `zoom=1` de `react-easy-crop`, que
 * internamente significa "cover" — ver `getMediaZoom` en la librería) que
 * muestra la imagen COMPLETA dentro del marco `PRODUCT_IMAGE_ASPECT_RATIO`,
 * sin recortar nada. Formula: para que la imagen quepa entera, el factor de
 * escala necesario es `min(cropW/imgW, cropH/imgH)`; el de "cover" (zoom=1)
 * es `max(cropW/imgW, cropH/imgH)` — su cociente, que es lo que necesitamos
 * relativo al zoom=1 de la libreria, se simplifica a
 * `min(aspectoRecorte/aspectoImagen, aspectoImagen/aspectoRecorte)`
 * (siempre <= 1). Devuelve `1` (equivalente a "cover") si la imagen ya
 * coincide exactamente con el recorte — sigue siendo el piso real del
 * zoom manual (`minZoom`, ver abajo), nunca el punto de partida visible. */
function getContainZoom(natural: NaturalSize): number {
  const imageAspect = natural.width / natural.height
  return Math.min(
    PRODUCT_IMAGE_ASPECT_RATIO / imageAspect,
    imageAspect / PRODUCT_IMAGE_ASPECT_RATIO,
  )
}

/**
 * Zoom de ARRANQUE real del editor: interpolacion lineal entre "contain"
 * (`getContainZoom`, margen 0) y "cover" (`zoom=1`, margen 1), segun
 * `INITIAL_ZOOM_SAFETY_MARGIN`. Con `crop` centrado en ambos extremos,
 * subir el zoom desde "contain" recorta primero el aire/fondo sobrante por
 * los 4 lados por igual — recien cerca de margen=1 empieza a comerse
 * contenido real. Asume que el producto esta razonablemente centrado en la
 * foto original (igual que el "cover" de siempre) — sigue sin analizar el
 * contenido de la imagen, por diseño (sin librerias nuevas). */
function getInitialZoom(natural: NaturalSize): number {
  const containZoom = getContainZoom(natural)
  return containZoom + INITIAL_ZOOM_SAFETY_MARGIN * (1 - containZoom)
}

interface ProductImageCropperDialogProps {
  /** Archivo ORIGINAL recien elegido/soltado — todavia no reemplaza nada
   * del formulario (Bloque 10.1, ajuste 4): mientras este dialogo esta
   * abierto, `ProductImageField.tsx` no toca su archivo pendiente ni su
   * vista previa. Solo se usa para leer `type`/`name`. */
  file: File
  /** URL de objeto local (`URL.createObjectURL(file)`) — la crea y libera
   * `ProductImageField.tsx`, no este componente. */
  imageSrc: string
  /** Se dispara al confirmar "Guardar recorte", con el archivo YA
   * recortado (mismo `type`/`name` que `file`). */
  onConfirm: (croppedFile: File) => void
  /** Se dispara al cancelar (boton "Cancelar" o cerrar el dialogo) — el
   * padre no debe cambiar ningun estado del formulario en respuesta a
   * esto (Bloque 10.1, ajuste 5): el usuario vuelve exactamente a como
   * estaba antes de elegir este archivo. */
  onCancel: () => void
}

/**
 * features/products/components/ProductImageCropperDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 10.1: editor de encuadre antes de guardar la imagen de un
 * producto, sobre `react-easy-crop` (arrastrar para reencuadrar + zoom con
 * rueda/pellizco ya incluidos por la libreria; los botones +/- de aca
 * abajo son un control explicito adicional). Relacion fija 2:1
 * (`PRODUCT_IMAGE_ASPECT_RATIO`, misma que `MediaCard.tsx`) — el marco de
 * recorte es la vista previa exacta ("WYSIWYG") de como va a quedar la
 * imagen en el catalogo.
 *
 * El recorte real (`cropImageToFile`, canvas en el navegador) solo corre
 * al presionar "Guardar recorte" — hasta ese momento, este componente no
 * le devuelve nada a `ProductImageField.tsx`, que sigue mostrando lo que
 * tenia antes de que el usuario eligiera este archivo.
 */
export function ProductImageCropperDialog({
  file,
  imageSrc,
  onConfirm,
  onCancel,
}: ProductImageCropperDialogProps) {
  const [crop, setCrop] = useState<Point>(INITIAL_CROP)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Dimensiones reales del archivo elegido — se cargan una sola vez desde
  // `imageSrc` (ya es una URL de objeto local, sin red de por medio, asi
  // que resuelve casi al instante) para calcular el zoom de arranque ANTES
  // de montar el `Cropper`. `null` mientras carga: el `Cropper` no se
  // monta todavia (ver render abajo), evitando cualquier parpadeo entre un
  // zoom por defecto y el zoom calculado.
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null)

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled) {
        const natural = { width: image.naturalWidth, height: image.naturalHeight }
        setNaturalSize(natural)
        setZoom(getInitialZoom(natural))
      }
    }
    image.src = imageSrc

    return () => {
      cancelled = true
    }
  }, [imageSrc])

  // Incidencia 2 (zoom inicial inteligente, 07/08/2026): piso de zoom SOLO
  // bajado lo indispensable para la imagen actual — si ya calza con el
  // recorte (o es mas angosta que el), `minZoom` sigue siendo `MIN_ZOOM`
  // (1, sin cambios respecto al comportamiento historico); si es mas ancha
  // o mas alta que el recorte, se permite justo el zoom minimo necesario
  // para volver a "contain" completo a mano — el punto de partida visible
  // usa `getInitialZoom` (con el margen de seguridad), nunca este piso.
  const minZoom = naturalSize ? Math.min(MIN_ZOOM, getContainZoom(naturalSize)) : MIN_ZOOM

  const handleReset = () => {
    setCrop(INITIAL_CROP)
    setZoom(naturalSize ? getInitialZoom(naturalSize) : MIN_ZOOM)
  }

  const handleZoomBy = (delta: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(minZoom, Number((current + delta).toFixed(2)))))
  }

  const handleConfirm = async () => {
    if (!croppedAreaPixels || isSaving) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const croppedFile = await cropImageToFile(imageSrc, croppedAreaPixels, file.type, file.name)
      onConfirm(croppedFile)
    } catch {
      setSaveError('No se pudo generar el recorte. Intenta de nuevo.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar imagen</DialogTitle>
        </DialogHeader>

        <div className="relative h-80 w-full overflow-hidden rounded-lg bg-black/90">
          {/* Incidencia 2 (zoom inicial inteligente): el `Cropper` recien se
              monta cuando ya conocemos `naturalSize` — el estado `zoom` ya
              arranca en `getInitialZoom()` (interpolacion contain/cover via
              `INITIAL_ZOOM_SAFETY_MARGIN`, calculado en el `onload` de la
              imagen), en vez del `cover` agresivo por defecto de la
              libreria. El usuario sigue pudiendo mover/zoomear despues
              exactamente igual que antes — esto solo cambia el punto de
              partida. */}
          {naturalSize && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={PRODUCT_IMAGE_ASPECT_RATIO}
              minZoom={minZoom}
              maxZoom={MAX_ZOOM}
              zoomWithScroll
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Reducir zoom"
            disabled={zoom <= minZoom}
            onClick={() => handleZoomBy(-ZOOM_STEP)}
          >
            <Minus className="size-3.5" />
          </Button>

          <div className="flex flex-1 flex-col items-center gap-1">
            <input
              type="range"
              min={minZoom}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Nivel de zoom"
              className="w-full accent-brand"
            />
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Aumentar zoom"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => handleZoomBy(ZOOM_STEP)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="w-fit text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Restablecer
        </Button>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSaving || !croppedAreaPixels}>
            {isSaving ? 'Guardando...' : 'Guardar recorte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
