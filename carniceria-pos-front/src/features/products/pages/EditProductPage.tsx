import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, CircleCheck, Copy } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { useProduct } from '../hooks/useProduct'
import { useUpdateProduct } from '../hooks/useUpdateProduct'
import { useUpdateProductStatus } from '../hooks/useUpdateProductStatus'
import { useUploadProductImage } from '../hooks/useUploadProductImage'
import { useDeleteProductImage } from '../hooks/useDeleteProductImage'
import { useTaxLookup } from '@/features/taxes/hooks/useTaxLookup'
import { useTaxes } from '@/features/taxes/hooks/useTaxes'
import { ProductForm } from '../components/ProductForm'
import { getProductErrorMessage, getProductImageErrorMessage } from '../utils/productErrors'
import type { CreateProductDto } from '../types/product.types'

export function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useProduct(id ?? '')
  const {
    mutate: updateProduct,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateProduct()

  // Rediseño de Productos: "Activar/Desactivar" visible (no escondido en
  // un menú) — misma mutación/confirmación ya usadas en `ProductsTable.tsx`.
  const { mutate: updateProductStatus, isPending: isTogglingStatus } = useUpdateProductStatus()
  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = useState(false)

  const handleToggleStatus = () => {
    if (!id || !product) {
      return
    }

    updateProductStatus(
      { id, dto: { active: !product.active } },
      {
        onSuccess: () => {
          toast.success(product.active ? 'Producto desactivado.' : 'Producto activado.')
          setIsToggleConfirmOpen(false)
        },
        onError: (error) => toast.error(getProductErrorMessage(error)),
      },
    )
  }

  // Rediseño de Productos: "Duplicar producto" — mismo destino/patrón que
  // el botón equivalente de `ProductDrawer.tsx`.
  const handleDuplicate = () => {
    if (!product) {
      return
    }

    navigate('/products/new', { state: { duplicateFrom: product } })
  }

  // Bloque 10 (gestion de imagenes): en edicion, el producto ya existe —
  // elegir/quitar una imagen la sube/borra de inmediato (no espera al
  // submit del formulario, que solo maneja los campos de texto/numero).
  const {
    mutate: uploadImage,
    isPending: isImageUploading,
    error: uploadImageError,
  } = useUploadProductImage()
  const {
    mutate: deleteImage,
    isPending: isImageDeleting,
    error: deleteImageError,
  } = useDeleteProductImage()

  const handleImageFileSelected = (file: File) => {
    if (!id) {
      return
    }

    uploadImage({ id, file })
  }

  const handleImageRemove = () => {
    if (!id) {
      return
    }

    deleteImage({ id })
  }

  const imageError = uploadImageError
    ? getProductImageErrorMessage(uploadImageError)
    : deleteImageError
      ? getProductImageErrorMessage(deleteImageError)
      : null

  // Arquitectura de selectores, Bloque 3: impuestos como catalogo de
  // referencia acotado — consume el patron de lookup
  // (`GET /taxes/lookup`), no `GET /taxes`. Sin esto, el Select de
  // Impuesto no tenia con que resolver el nombre del `taxId` precargado.
  // La categoria ya no necesita este tratamiento: `ProductCategoryField.tsx`
  // resuelve el nombre de `categoryId` por su propio id (`useCategory`),
  // no contra una lista pasada por prop.
  const { data: taxesResponse } = useTaxLookup({ active: true })
  // Mejora UX (indicador visual del impuesto oficial CABYS): mismo criterio
  // que `CreateProductPage.tsx` — `GET /taxes/lookup` no trae `rate`, se
  // resuelve aparte con `GET /taxes` (ya existente), sin tocar el backend
  // ni la fuente del `<Select>` de arriba.
  const { data: taxesFullResponse } = useTaxes({ active: true, limit: 100 })
  const taxRateById = new Map(
    (taxesFullResponse?.data ?? []).map((tax) => [tax.id, tax.rate]),
  )
  const taxes = (taxesResponse?.data ?? []).map((tax) => ({
    id: tax.id,
    name: tax.label,
    rate: taxRateById.get(tax.id),
  }))

  const handleSubmit = (values: CreateProductDto) => {
    if (!id) {
      return
    }

    updateProduct(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Producto actualizado correctamente.')
          navigate('/products')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/products')
  }

  if (isLoading) {
    return <LoadingState message="Cargando producto..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el producto.'}
      </ErrorAlert>
    )
  }

  if (!product) {
    return (
      <p className="text-sm text-muted-foreground">
        El producto no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/products' },
          { label: 'Editar producto' },
        ]}
        title="Editar producto"
        description="Actualiza los datos del producto seleccionado."
      />

      {isUpdateError && <ErrorAlert>{getProductErrorMessage(updateError)}</ErrorAlert>}

      <ProductForm
        mode="update"
        defaultValues={{
          categoryId: product.categoryId,
          taxId: product.taxId,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          unitOfMeasure: product.unitOfMeasure,
          salePrice: product.salePrice,
          cost: product.cost,
          cabysCode: product.cabysCode ?? undefined,
          expectedWastePercent: product.expectedWastePercent,
          applyExpectedWasteToCost: product.applyExpectedWasteToCost,
          isVariableWeight: product.isVariableWeight,
          trackInventory: product.trackInventory,
          requiresBatch: product.requiresBatch,
        }}
        taxes={taxes}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        imageUrl={product.imageUrl}
        initialActive={product.active}
        onImageFileSelected={handleImageFileSelected}
        onImageRemove={handleImageRemove}
        isImageUploading={isImageUploading}
        isImageDeleting={isImageDeleting}
        imageError={imageError}
        productId={product.id}
        updatedAt={product.updatedAt}
        secondaryActions={
          <>
            <Button type="button" variant="outline" onClick={handleDuplicate} className="gap-2">
              <Copy className="size-4" />
              Duplicar producto
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsToggleConfirmOpen(true)}
              className="gap-2"
            >
              {product.active ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
              {product.active ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={isToggleConfirmOpen}
        onOpenChange={setIsToggleConfirmOpen}
        title={product.active ? 'Desactivar producto' : 'Activar producto'}
        description={
          product.active
            ? `¿Seguro que querés desactivar "${product.name}"?`
            : `¿Seguro que querés activar "${product.name}"?`
        }
        confirmText={product.active ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
        onConfirm={handleToggleStatus}
        loading={isTogglingStatus}
      />
    </div>
  )
}