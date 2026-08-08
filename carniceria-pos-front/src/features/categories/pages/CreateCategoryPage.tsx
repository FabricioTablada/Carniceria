import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateCategory } from '../hooks/useCreateCategory'
import { useCategories } from '../hooks/useCategories'
import { CategoryForm } from '../components/CategoryForm'
import { getCategoryErrorMessage } from '../utils/categoryErrors'
import type { CreateCategoryDto } from '../types/category.types'

export function CreateCategoryPage() {
  const navigate = useNavigate()
  const {
    mutate: createCategory,
    isPending,
    isError,
    error,
  } = useCreateCategory()

  // Categorias activas, vía el endpoint ya existente GET /categories
  // (filtro `active` soportado por el backend), para poblar el selector
  // de categoria padre. A diferencia de Products (sin modulo de
  // Categorias/Impuestos), acá el modulo si existe.
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  const handleSubmit = (values: CreateCategoryDto) => {
    createCategory(values, {
      onSuccess: () => {
        toast.success('Categoría creada correctamente.')
        navigate('/categories')
      },
    })
  }

  const handleCancel = () => {
    navigate('/categories')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Categorías', href: '/categories' },
          { label: 'Nueva categoría' },
        ]}
        title="Nueva categoría"
        description="Registra una nueva categoría en el catálogo."
      />

      {isError && <ErrorAlert>{getCategoryErrorMessage(error)}</ErrorAlert>}

      <CategoryForm
        mode="create"
        categories={categories}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}