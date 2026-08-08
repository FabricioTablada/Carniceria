/*
===============================================================================
VIEW: vw_sales_by_category
-------------------------------------------------------------------------------
Ventas agregadas por categoria (cantidad, importe y numero de ventas
distintas), sobre el historico de ventas completadas. Uso exclusivo Power
BI (decision #3); el ordenamiento lo aplica Power BI, no la vista.

`sales_count` usa COUNT(DISTINCT si.sale_id): representa cuantas VENTAS
distintas incluyeron productos de esta categoria, no cuantas lineas de
detalle -- mismo criterio ya usado en vw_top_products.sales_count.
===============================================================================
*/

DROP VIEW IF EXISTS vw_sales_by_category CASCADE;

CREATE VIEW vw_sales_by_category AS

SELECT

    c.id AS category_id,
    c.name AS category_name,

    COALESCE(SUM(si.quantity), 0) AS total_quantity_sold,

    COALESCE(SUM(si.line_total), 0)::NUMERIC(14,2) AS total_sales_amount,

    COUNT(DISTINCT si.sale_id)::INTEGER AS sales_count

FROM sale_items si

INNER JOIN sales s
ON s.id = si.sale_id

INNER JOIN products p
ON p.id = si.product_id

LEFT JOIN categories c
ON c.id = p.category_id

WHERE s.status = 'COMPLETED'
AND s.deleted_at IS NULL

GROUP BY c.id, c.name;