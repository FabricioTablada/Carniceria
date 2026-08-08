import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreatePromotion } from '../hooks/useCreatePromotion'
import { PromotionForm } from '../components/PromotionForm'
import { getPromotionErrorMessage } from '../utils/promotionErrors'
import type { CreatePromotionDto } from '../types/promotion.types'

export function CreatePromotionPage() {
  const navigate = useNavigate()
  const { mutate: createPromotion, isPending, isError, error } = useCreatePromotion()

  const handleSubmit = (values: CreatePromotionDto) => {
    createPromotion(values, {
      onSuccess: () => {
        toast.success('Promoción creada correctamente.')
        navigate('/promotions')
      },
    })
  }

  const handleCancel = () => {
    navigate('/promotions')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Promociones', href: '/promotions' },
          { label: 'Nueva promoción' },
        ]}
        title="Nueva promoción"
        description="Registra una nueva promoción en el catálogo."
      />

      {isError && <ErrorAlert>{getPromotionErrorMessage(error)}</ErrorAlert>}

      <PromotionForm
        mode="create"
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}
