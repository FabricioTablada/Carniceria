import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { KbdHint } from '@/components/ui/KbdHint'
import { Pagination } from '@/components/ui/Pagination'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { usePermissions } from '@/hooks/usePermissions'
import { useCustomers } from '../hooks/useCustomers'
import { useUpdateCustomerStatus } from '../hooks/useUpdateCustomerStatus'
import { CustomerDrawer } from '../components/CustomerDrawer'
import { CustomersKpiRow } from '../components/CustomersKpiRow'
import { CustomersTable } from '../components/CustomersTable'
import { CustomersTableSkeleton } from '../components/CustomersTableSkeleton'
import { CustomerFilters } from '../components/CustomerFilters'
import { exportToCsv } from '@/utils/exportToCsv'
import type { Customer, CustomerFilters as CustomerFiltersValue } from '../types/customer.types'

/**
 * features/customers/pages/CustomersPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo Workspace unico que `SuppliersPage.tsx`: un solo
 * contenedor exterior (`rounded-2xl border bg-card shadow-sm`), con
 * KPIs/Toolbar/tabla/Paginación como franjas internas.
 */
export function CustomersPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<CustomerFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useCustomers({ ...filters, page })
  const { mutate: updateCustomerStatus } = useUpdateCustomerStatus()

  const hasActiveFilters = Boolean(filters.search || filters.active !== undefined)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleFiltersChange = (nextFilters: CustomerFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const { hasPermission } = usePermissions()
  const canCreateCustomer = hasPermission(PERMISSIONS.CUSTOMERS_CREATE)

  const handleCreateCustomer = useCallback(() => {
    navigate('/customers/new')
  }, [navigate])

  const handleEdit = (customer: Customer) => {
    navigate(`/customers/${customer.id}/edit`)
  }

  const handleRowClick = (customer: Customer) => {
    setDrawerCustomer(customer)
  }

  const handleToggleStatus = (customer: Customer) => {
    updateCustomerStatus({ id: customer.id, dto: { active: !customer.active } })
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((customer) => selectedIds.includes(customer.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Nombre', value: (customer) => customer.name },
        { header: 'Tipo de identificación', value: (customer) => customer.identificationType },
        { header: 'Identificación', value: (customer) => customer.identificationNumber },
        { header: 'Correo', value: (customer) => customer.email ?? '' },
        { header: 'Teléfono', value: (customer) => customer.phone ?? '' },
        { header: 'Estado', value: (customer) => (customer.active ? 'Activo' : 'Inactivo') },
      ],
      `clientes-pagina-${page}.csv`,
    )
  }

  // Mismo patron que `SuppliersPage.tsx`: atajos de teclado sin libreria,
  // `Esc` cierra el Drawer gratis via `@base-ui/react/dialog`.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (!isTextField && !drawerCustomer && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateCustomer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerCustomer, handleCreateCustomer])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Clientes' }]}
        title="Clientes"
        description="Administra el catálogo de clientes del sistema."
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <CustomersKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <CustomerFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                searchInputRef={searchInputRef}
              />
            }
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExport}
                  disabled={!data?.data.length}
                  className="h-10 gap-2 rounded-xl"
                >
                  <Download className="size-4" />
                  {selectedIds.length > 0 ? `Exportar (${selectedIds.length})` : 'Exportar'}
                </Button>
                <Can permission={PERMISSIONS.CUSTOMERS_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreateCustomer}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nuevo Cliente
                    <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                      N
                    </KbdHint>
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <CustomersTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los clientes.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <CustomersTable
              customers={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={UserRound}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: handleClearFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={UserRound}
                    title="Todavía no hay clientes"
                    description="Registrá tu primer cliente para empezar a facturarle."
                    action={
                      canCreateCustomer
                        ? { label: 'Nuevo Cliente', onClick: handleCreateCustomer, variant: 'brand' }
                        : undefined
                    }
                  />
                )
              }
              onRowClick={handleRowClick}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="clientes" />
              </div>
            )}
          </div>
        )}
      </div>

      <CustomerDrawer
        customer={drawerCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerCustomer(null)
          }
        }}
        onEdit={(customer) => {
          setDrawerCustomer(null)
          handleEdit(customer)
        }}
      />
    </div>
  )
}
