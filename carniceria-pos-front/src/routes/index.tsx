import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PosLayout } from '@/layouts/PosLayout'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { UsersPage } from '@/features/users/pages/UsersPage'
import { CreateUserPage } from '@/features/users/pages/CreateUserPage'
import { EditUserPage } from '@/features/users/pages/EditUserPage'
import { RolesPage } from '@/features/roles/pages/RolesPage'
import { CreateRolePage } from '@/features/roles/pages/CreateRolePage'
import { EditRolePage } from '@/features/roles/pages/EditRolePage'
import { PermissionsPage } from '@/features/permissions/pages/PermissionsPage'
import { CreatePermissionPage } from '@/features/permissions/pages/CreatePermissionPage'
import { EditPermissionPage } from '@/features/permissions/pages/EditPermissionPage'
import { ProductsPage } from '@/features/products/pages/ProductsPage'
import { CreateProductPage } from '@/features/products/pages/CreateProductPage'
import { EditProductPage } from '@/features/products/pages/EditProductPage'
import { CategoriesPage } from '@/features/categories/pages/CategoriesPage'
import { CreateCategoryPage } from '@/features/categories/pages/CreateCategoryPage'
import { EditCategoryPage } from '@/features/categories/pages/EditCategoryPage'
import { TaxesPage } from '@/features/taxes/pages/TaxesPage'
import { CreateTaxPage } from '@/features/taxes/pages/CreateTaxPage'
import { EditTaxPage } from '@/features/taxes/pages/EditTaxPage'
import { PromotionsPage } from '@/features/promotions/pages/PromotionsPage'
import { CreatePromotionPage } from '@/features/promotions/pages/CreatePromotionPage'
import { EditPromotionPage } from '@/features/promotions/pages/EditPromotionPage'
import { SuppliersPage } from '@/features/suppliers/pages/SuppliersPage'
import { CreateSupplierPage } from '@/features/suppliers/pages/CreateSupplierPage'
import { EditSupplierPage } from '@/features/suppliers/pages/EditSupplierPage'
import { CustomersPage } from '@/features/customers/pages/CustomersPage'
import { CreateCustomerPage } from '@/features/customers/pages/CreateCustomerPage'
import { EditCustomerPage } from '@/features/customers/pages/EditCustomerPage'
import { InventoryPage } from '@/features/inventory/pages/InventoryPage'
import { InventoryAdjustPage } from '@/features/inventory/pages/InventoryAdjustPage'
import { InventoryAlertsPage } from '@/features/inventory/pages/InventoryAlertsPage'
import { InventoryWastesPage } from '@/features/inventory/pages/InventoryWastesPage'
import { BatchesPage } from '@/features/batches/pages/BatchesPage'
import { BatchAdjustPage } from '@/features/batches/pages/BatchAdjustPage'
import { PurchasesPage } from '@/features/purchases/pages/PurchasesPage'
import { CreatePurchasePage } from '@/features/purchases/pages/CreatePurchasePage'
import { EditPurchasePage } from '@/features/purchases/pages/EditPurchasePage'
import { PurchaseDetailPage } from '@/features/purchases/pages/PurchaseDetailPage'
import { SalesPage } from '@/features/sales/pages/SalesPage'
import { SalesPOSPage } from '@/features/sales/pages/SalesPOSPage'
import { CashSessionsPage } from '@/features/cashSession/pages/CashSessionsPage'
import { CloseCashSessionPage } from '@/features/cashSession/pages/CloseCashSessionPage'
import { RequireCashSession } from '@/features/cashSession/components/RequireCashSession'
import { LowStockPage } from '@/features/reports/pages/LowStockPage'
import { TopProductsPage } from '@/features/reports/pages/TopProductsPage'
import { SalesByCategoryPage } from '@/features/reports/pages/SalesByCategoryPage'
import { SalesByCashierPage } from '@/features/reports/pages/SalesByCashierPage'
import { SalesReportPage } from '@/features/reports/pages/SalesReportPage'
import { PurchasesReportPage } from '@/features/reports/pages/PurchasesReportPage'
import { InventoryReportPage } from '@/features/reports/pages/InventoryReportPage'
import { ProfitReportPage } from '@/features/reports/pages/ProfitReportPage'
import { CashSessionRedirect } from '@/features/cashSession/pages/CashSessionRedirect'
import { ReportsIndexPage } from '@/features/reports/pages/ReportsIndexPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { CreateConfigurationPage } from '@/features/settings/pages/CreateConfigurationPage'
import { EditConfigurationPage } from '@/features/settings/pages/EditConfigurationPage'
import { AlegraIntegrationPage } from '@/features/settings/pages/AlegraIntegrationPage'
import { BackupsPage } from '@/features/settings/pages/BackupsPage'
import { CabysCatalogPage } from '@/features/settings/pages/CabysCatalogPage'
import { ProtectedRoute } from './ProtectedRoute'
import { RequirePermission } from './RequirePermission'
import { RequireRole } from './RequireRole'
import { DashboardRoute } from './DashboardRoute'
import { PERMISSIONS } from '@/constants/permissions'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginForm />
            </AuthLayout>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </DashboardRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
                <DashboardLayout>
                  <CreateUserPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
                <DashboardLayout>
                  <EditUserPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roles"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <RolesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roles/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <CreateRolePage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roles/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <EditRolePage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/permissions"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <PermissionsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/permissions/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <CreatePermissionPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/permissions/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.ROLES_MANAGE}>
                <DashboardLayout>
                  <EditPermissionPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PRODUCTS_VIEW}>
                <DashboardLayout>
                  <ProductsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/products/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PRODUCTS_CREATE}>
                <DashboardLayout compactBottomSpacing>
                  <CreateProductPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/products/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PRODUCTS_UPDATE}>
                <DashboardLayout compactBottomSpacing>
                  <EditProductPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CATEGORIES_VIEW}>
                <DashboardLayout>
                  <CategoriesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CATEGORIES_CREATE}>
                <DashboardLayout>
                  <CreateCategoryPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CATEGORIES_UPDATE}>
                <DashboardLayout>
                  <EditCategoryPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/taxes"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.TAXES_VIEW}>
                <DashboardLayout>
                  <TaxesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/taxes/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.TAXES_CREATE}>
                <DashboardLayout>
                  <CreateTaxPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/taxes/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.TAXES_UPDATE}>
                <DashboardLayout>
                  <EditTaxPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/promotions"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PROMOTIONS_VIEW}>
                <DashboardLayout>
                  <PromotionsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/promotions/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PROMOTIONS_CREATE}>
                <DashboardLayout>
                  <CreatePromotionPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/promotions/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PROMOTIONS_UPDATE}>
                <DashboardLayout>
                  <EditPromotionPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SUPPLIERS_VIEW}>
                <DashboardLayout>
                  <SuppliersPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SUPPLIERS_CREATE}>
                <DashboardLayout>
                  <CreateSupplierPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/suppliers/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SUPPLIERS_UPDATE}>
                <DashboardLayout>
                  <EditSupplierPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CUSTOMERS_VIEW}>
                <DashboardLayout>
                  <CustomersPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CUSTOMERS_CREATE}>
                <DashboardLayout>
                  <CreateCustomerPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CUSTOMERS_UPDATE}>
                <DashboardLayout>
                  <EditCustomerPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.INVENTORY_VIEW}>
                <DashboardLayout>
                  <InventoryPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/:id/adjust"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.INVENTORY_ADJUST}>
                <DashboardLayout>
                  <InventoryAdjustPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/alerts"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.INVENTORY_VIEW}>
                <DashboardLayout>
                  <InventoryAlertsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/waste"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.INVENTORY_VIEW}>
                <DashboardLayout>
                  <InventoryWastesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/batches"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.BATCHES_VIEW}>
                <DashboardLayout>
                  <BatchesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/batches/:id/adjust"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.BATCHES_ADJUST}>
                <DashboardLayout>
                  <BatchAdjustPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchases"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PURCHASES_VIEW}>
                <DashboardLayout>
                  <PurchasesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchases/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PURCHASES_CREATE}>
                <DashboardLayout>
                  <CreatePurchasePage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchases/:id"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.PURCHASES_VIEW}>
                <DashboardLayout>
                  <PurchaseDetailPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/purchases/:id/edit"
          element={
            <ProtectedRoute>
              <RequireRole role="ADMIN">
                <DashboardLayout>
                  <EditPurchasePage />
                </DashboardLayout>
              </RequireRole>
            </ProtectedRoute>
          }
        />

        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SALES_VIEW}>
                <DashboardLayout>
                  <SalesPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
  path="/sales/pos"
  element={
    <ProtectedRoute>
      <PosLayout>
        <RequireCashSession>
          <SalesPOSPage />
        </RequireCashSession>
      </PosLayout>
    </ProtectedRoute>
  }
/>

        <Route
          path="/cash-session/open"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CASH_OPEN}>
                <DashboardLayout>
                  <CashSessionsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cash-session/:id/close"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.CASH_CLOSE}>
                <DashboardLayout>
                  <CloseCashSessionPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <ReportsIndexPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/low-stock"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <LowStockPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/top-products"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <TopProductsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/sales-by-category"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <SalesByCategoryPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/sales-by-cashier"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <SalesByCashierPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/sales"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <SalesReportPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/purchases"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <PurchasesReportPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/inventory"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <InventoryReportPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/profit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.REPORTS_VIEW}>
                <DashboardLayout>
                  <ProfitReportPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        {/* Wireframe aprobado "Caja — Centro de Control": Caja
            (`/cash-session/open`) pasa a ser la única fuente de verdad
            para sesiones de caja — estas dos rutas siguen registradas
            (mismos paths, ningún link externo se toca) pero ahora
            redirigen ahí en vez de renderizar una pantalla propia. */}
        <Route path="/reports/cash" element={<Navigate to="/cash-session/open" replace />} />
        <Route path="/reports/cash/:id" element={<CashSessionRedirect />} />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/new"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <CreateConfigurationPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/:id/edit"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <EditConfigurationPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        {/* Bloque 7.4: Configuración → Facturación Electrónica → Alegra. */}
        <Route
          path="/settings/alegra"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <AlegraIntegrationPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        {/* Parche 1.0.1 (acceso desde la UI): Configuración → Respaldos —
            mismo patrón que /settings/alegra, mismo permiso existente. */}
        <Route
          path="/settings/backups"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <BackupsPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />

        {/* Bloque "Actualización inteligente del catálogo CABYS": Configuración →
            Catálogo CABYS — mismo patrón que /settings/alegra, mismo permiso existente. */}
        <Route
          path="/settings/cabys-catalog"
          element={
            <ProtectedRoute>
              <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                <DashboardLayout>
                  <CabysCatalogPage />
                </DashboardLayout>
              </RequirePermission>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}