import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { usePromotion } from '../hooks/usePromotion'
import { useUpdatePromotion } from '../hooks/useUpdatePromotion'
import { PromotionForm } from '../components/PromotionForm'
import { getPromotionErrorMessage } from '../utils/promotionErrors'
import type { CreatePromotionDto } from '../types/promotion.types'

export function EditPromotionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: promotion, isLoading, isError, error } = usePromotion(id ?? '')
  const {
    mutate: updatePromotion,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdatePromotion()

  const handleSubmit = (values: CreatePromotionDto) => {
    if (!id) {
      return
    }

    updatePromotion(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Promoción actualizada correctamente.')
          navigate('/promotions')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/promotions')
  }

  if (isLoading) {
    return <LoadingState message="Cargando promoción..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar la promoción.'}
      </ErrorAlert>
    )
  }

  if (!promotion) {
    return <p className="text-sm text-muted-foreground">La promoción no existe.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Promociones', href: '/promotions' },
          { label: 'Editar promoción' },
        ]}
        title="Editar promoción"
        description="Actualiza los datos de la promoción seleccionada."
      />

      {isUpdateError && <ErrorAlert>{getPromotionErrorMessage(updateError)}</ErrorAlert>}

      <PromotionForm
        mode="update"
        currentStatus={promotion.active}
        defaultValues={{
          name: promotion.name,
          description: promotion.description,
          scopeType: promotion.scopeType,
          effectType: promotion.effectType,
          effectValue: promotion.effectValue,
          buyQuantity: promotion.buyQuantity,
          payQuantity: promotion.payQuantity,
          minQuantity: promotion.minQuantity,
          startDate: promotion.startDate?.slice(0, 10) ?? null,
          endDate: promotion.endDate?.slice(0, 10) ?? null,
          startTime: promotion.startTime,
          endTime: promotion.endTime,
          daysOfWeek: promotion.daysOfWeek,
          priority: promotion.priority,
          stackable: promotion.stackable,
          exclusiveGroup: promotion.exclusiveGroup,
          sucursalId: promotion.sucursalId,
          // PROMO-07 (Commercial Pricing Engine).
          supplierId: promotion.supplierId,
          commercialOrigin: promotion.commercialOrigin,
          fundingType: promotion.fundingType,
          supplierSubsidyValue: promotion.supplierSubsidyValue,
          productIds: promotion.products.map((item) => ({
            productId: item.productId,
            requiredQuantity: item.requiredQuantity,
          })),
          categoryIds: promotion.categories.map((item) => item.categoryId),
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialSupplier={promotion.supplier}
      />
    </div>
  )
}
