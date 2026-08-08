import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useCategory } from '../hooks/useCategory'
import { useUpdateCategory } from '../hooks/useUpdateCategory'
import { useCategories } from '../hooks/useCategories'
import { CategoryForm } from '../components/CategoryForm'
import { getCategoryErrorMessage } from '../utils/categoryErrors'
import type { CreateCategoryDto } from '../types/category.types'

export function EditCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: category,
    isLoading,
    isError,
    error,
  } = useCategory(id ?? '')
  const {
    mutate: updateCategory,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateCategory()

  // Categorias activas, vía el endpoint ya existente GET /categories
  // (filtro `active` soportado por el backend), para poblar el selector
  // de categoria padre.
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
  }))

  const handleSubmit = (values: CreateCategoryDto) => {
    if (!id) {
      return
    }

    updateCategory(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Categoría actualizada correctamente.')
          navigate('/categories')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/categories')
  }

  if (isLoading) {
    return <LoadingState message="Cargando categoría..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar la categoría.'}
      </ErrorAlert>
    )
  }

  if (!category) {
    return (
      <p className="text-sm text-muted-foreground">
        La categoría no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Categorías', href: '/categories' },
          { label: 'Editar categoría' },
        ]}
        title="Editar categoría"
        description="Actualiza los datos de la categoría seleccionada."
      />

      {isUpdateError && <ErrorAlert>{getCategoryErrorMessage(updateError)}</ErrorAlert>}

      <CategoryForm
        mode="update"
        defaultValues={{
          name: category.name,
          description: category.description,
          color: category.color,
          parentId: category.parentId,
        }}
        categories={categories}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        categoryId={category.id}
        initialActive={category.active}
      />
    </div>
  )
}