import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useCreateProduct } from '../hooks/useCreateProduct'
import { useUploadProductImage } from '../hooks/useUploadProductImage'
import { useTaxLookup } from '@/features/taxes/hooks/useTaxLookup'
import { useTaxes } from '@/features/taxes/hooks/useTaxes'
import { ProductForm } from '../components/ProductForm'
import { getProductErrorMessage, getProductImageErrorMessage } from '../utils/productErrors'
import { duplicateProductToDto } from '../utils/duplicateProduct'
import type { CreateProductDto, Product } from '../types/product.types'

export function CreateProductPage() {
  const navigate = useNavigate()
  // Rediseño de Productos: "Duplicar producto" (`ProductDrawer.tsx`)
  // navega aca con el `Product` de origen en el estado de la ruta —
  // `duplicateProductToDto` lo traduce a `CreateProductDto` para precargar
  // el formulario, mismo patrón ya aprobado en Compras
  // (`duplicatePurchaseToDto`).
  const location = useLocation()
  const duplicateFrom = (location.state as { duplicateFrom?: Product } | null)?.duplicateFrom
  const {
    mutate: createProduct,
    isPending,
    isError,
    error,
  } = useCreateProduct()

  // Bloque 10 (gestion de imagenes): en creacion el producto todavia no
  // tiene `id` -> no hay a que endpoint subir la imagen. El archivo
  // elegido se guarda aca (nunca se sube solo) hasta que `createProduct`
  // confirma un producto real; recien ahi se sube, como segundo paso del
  // mismo submit — un solo boton "Guardar" para el usuario.
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const { mutateAsync: uploadImage, isPending: isImageUploading } = useUploadProductImage()

  // Arquitectura de selectores, Bloque 3: impuestos como catalogo de
  // referencia acotado — consume el patron de lookup
  // (`GET /taxes/lookup`), no `GET /taxes`. Las opciones del `<Select>`
  // siguen viniendo exclusivamente de aca, sin cambios.
  const { data: taxesResponse } = useTaxLookup({ active: true })
  // Mejora UX (indicador visual del impuesto oficial CABYS): `GET /taxes/lookup`
  // no trae `rate` (solo `{id,label}`) — se resuelve aparte con el listado
  // completo ya existente (`GET /taxes`, mismo que usa `TaxesTable.tsx`),
  // sin tocar el backend ni la fuente del `<Select>` de arriba. Solo se usa
  // para mapear `id -> rate`, puramente informativo/preventivo.
  const { data: taxesFullResponse } = useTaxes({ active: true, limit: 100 })
  const taxRateById = new Map(
    (taxesFullResponse?.data ?? []).map((tax) => [tax.id, tax.rate]),
  )
  const taxes = (taxesResponse?.data ?? []).map((tax) => ({
    id: tax.id,
    name: tax.label,
    rate: taxRateById.get(tax.id),
  }))

  // Rediseño de Impuestos (aprobado): "autorizar que el impuesto por
  // defecto se use realmente" — mismo hook/filtro que ya usan
  // `TaxesKpiRow.tsx`/`TaxDefaultHero.tsx` (`useTaxes({ isDefault: true,
  // active: true, limit: 1 })`), no `useTaxLookup` (esa respuesta no trae
  // `isDefault`). El usuario siempre puede cambiarlo manualmente: esto
  // solo fija el valor INICIAL del campo `taxId`, el `<Select>` sigue
  // editable como siempre.
  //
  // QA.8: `active: true` agregado (mismo hallazgo que `TaxDefaultHero.tsx`)
  // — sin el, un impuesto marcado como predeterminado pero luego
  // desactivado (el backend no lo impide) seguia preseleccionandose aca
  // como `taxId` inicial, aunque `taxes` (arriba, filtrado por
  // `active: true`) ya no lo incluyera entre sus opciones. El `<Select>`
  // terminaba mostrando el UUID crudo del impuesto en vez de un nombre —
  // y si el usuario no notaba el problema y guardaba igual, el producto
  // se creaba con un impuesto inactivo, inconsistente con el selector que
  // el propio usuario veia.
  const { data: defaultTaxResponse, isLoading: isDefaultTaxLoading } = useTaxes({
    isDefault: true,
    active: true,
    limit: 1,
  })
  const defaultTaxId = defaultTaxResponse?.data[0]?.id

  const handleSubmit = (values: CreateProductDto) => {
    createProduct(values, {
      onSuccess: async (createdProduct) => {
        if (!pendingImageFile) {
          toast.success('Producto creado correctamente.')
          navigate('/products')
          return
        }

        try {
          await uploadImage({ id: createdProduct.id, file: pendingImageFile })
          toast.success('Producto creado correctamente.')
          navigate('/products')
        } catch (uploadError) {
          // El producto SI se creo — no lo escondemos detras de un error
          // generico ni dejamos al usuario sin saber que paso. Se
          // redirige a Editar, donde la imagen se puede reintentar de
          // inmediato (subida ya inmediata en modo edicion), en vez de
          // dejarlo en una pagina de creacion que ya cumplio su proposito.
          toast.error(
            `Producto creado, pero no se pudo subir la imagen: ${getProductImageErrorMessage(uploadError)}`,
          )
          navigate(`/products/${createdProduct.id}/edit`)
        }
      },
    })
  }

  // Rediseño de Productos: "Guardar y crear otro" — misma mutación
  // (`createProduct`), pero en `onSuccess` no navega: reinicia el
  // formulario (`resetForm`, provisto por `ProductForm.tsx`) para cargar
  // el siguiente producto sin salir de la pantalla. La imagen pendiente
  // (si la había) también se limpia — corresponde al producto que ya se
  // guardó, no al siguiente.
  const handleSubmitAndCreateAnother = (values: CreateProductDto, resetForm: () => void) => {
    createProduct(values, {
      onSuccess: async (createdProduct) => {
        if (pendingImageFile) {
          try {
            await uploadImage({ id: createdProduct.id, file: pendingImageFile })
          } catch (uploadError) {
            toast.error(
              `Producto creado, pero no se pudo subir la imagen: ${getProductImageErrorMessage(uploadError)}`,
            )
          }
        }

        toast.success('Producto creado correctamente. Podés cargar el siguiente.')
        setPendingImageFile(null)
        resetForm()
      },
    })
  }

  const handleCancel = () => {
    navigate('/products')
  }

  const handleImageFileSelected = (file: File) => {
    setPendingImageFile(file)
  }

  const handleImageRemove = () => {
    setPendingImageFile(null)
  }

  // Rediseño de Impuestos (aprobado): `defaultValues` de react-hook-form
  // solo se toma en cuenta en el primer render — se espera a que resuelva
  // la consulta del impuesto por defecto antes de montar `ProductForm`
  // (mismo criterio que ya usan las páginas de edición, que esperan su
  // propio `isLoading` antes de renderizar el formulario) para no dejar el
  // campo sin preseleccionar por una carrera de datos. Sin efecto cuando
  // se duplica un producto (`duplicateFrom` ya resuelto, sin red).
  if (!duplicateFrom && isDefaultTaxLoading) {
    return <LoadingState message="Cargando..." />
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/products' },
          { label: 'Nuevo producto' },
        ]}
        title="Nuevo producto"
        description="Registra un nuevo producto en el catálogo."
      />

      {isError && <ErrorAlert>{getProductErrorMessage(error)}</ErrorAlert>}

      <ProductForm
        mode="create"
        defaultValues={
          duplicateFrom
            ? duplicateProductToDto(duplicateFrom)
            : defaultTaxId
              ? { taxId: defaultTaxId }
              : undefined
        }
        taxes={taxes}
        isSubmitting={isPending || isImageUploading}
        onSubmit={handleSubmit}
        onSubmitAndCreateAnother={handleSubmitAndCreateAnother}
        onCancel={handleCancel}
        onImageFileSelected={handleImageFileSelected}
        onImageRemove={handleImageRemove}
      />
    </div>
  )
}