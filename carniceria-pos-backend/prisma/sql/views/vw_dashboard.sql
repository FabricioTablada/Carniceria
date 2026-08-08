/*
===============================================================================
VIEW: vw_dashboard
-------------------------------------------------------------------------------
Dashboard Ejecutivo (uso exclusivo Power BI, decision #3 -- el backend NO
consume esta vista; el dashboard operativo de la API usa count()/aggregate()
de Prisma directamente, ver reports.repository.ts).
Proyecto: Carniceria POS

NOTA: DROP + CREATE (no CREATE OR REPLACE) para poder cambiar tipos de
columna en reaplicaciones futuras sin el error "cannot change data type of
view column".
===============================================================================
*/

DROP VIEW IF EXISTS vw_dashboard CASCADE;

CREATE VIEW vw_dashboard AS

SELECT

    /* Ventas */
    (
        SELECT COUNT(*)::INTEGER
        FROM sales
        WHERE status = 'COMPLETED'
        AND deleted_at IS NULL
    ) AS total_sales,

    (
        SELECT COALESCE(SUM(total), 0)::NUMERIC(14,2)
        FROM sales
        WHERE status = 'COMPLETED'
        AND deleted_at IS NULL
    ) AS total_sales_amount,

    /* Compras */
    (
        SELECT COUNT(*)::INTEGER
        FROM purchases
        WHERE status = 'RECEIVED'
        AND deleted_at IS NULL
    ) AS total_purchases,

    (
        SELECT COALESCE(SUM(total), 0)::NUMERIC(14,2)
        FROM purchases
        WHERE status = 'RECEIVED'
        AND deleted_at IS NULL
    ) AS total_purchase_amount,

    /* Productos */
    (
        SELECT COUNT(*)::INTEGER
        FROM products
        WHERE active = TRUE
        AND deleted_at IS NULL
    ) AS total_products,

    /* Categorias */
    (
        SELECT COUNT(*)::INTEGER
        FROM categories
        WHERE active = TRUE
        AND deleted_at IS NULL
    ) AS total_categories,

    /* Proveedores */
    (
        SELECT COUNT(*)::INTEGER
        FROM suppliers
        WHERE active = TRUE
        AND deleted_at IS NULL
    ) AS total_suppliers,

    /* Usuarios */
    (
        SELECT COUNT(*)::INTEGER
        FROM users
        WHERE active = TRUE
        AND deleted_at IS NULL
    ) AS total_users,

    /* Caja */
    (
        SELECT COUNT(*)::INTEGER
        FROM cash_sessions
        WHERE status = 'OPEN'
        AND deleted_at IS NULL
    ) AS open_cash_sessions;