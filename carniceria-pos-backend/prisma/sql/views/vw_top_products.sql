/*
===============================================================================
VIEW: vw_top_products
-------------------------------------------------------------------------------
Productos mas vendidos (cantidad e importe), agregados por producto sobre
el historico de ventas completadas. Uso exclusivo Power BI (decision #3);
el ordenamiento/limite de "top N" lo aplica Power BI, no la vista.
===============================================================================
*/

DROP VIEW IF EXISTS vw_top_products CASCADE;

CREATE VIEW vw_top_products AS

SELECT

    p.id AS product_id,
    p.sku,
    p.barcode,
    p.name AS producto,

    c.id AS category_id,
    c.name AS categoria,

    COUNT(DISTINCT si.sale_id)::INTEGER AS sales_count,

    COALESCE(SUM(si.quantity), 0) AS total_quantity_sold,

    COALESCE(SUM(si.line_total), 0)::NUMERIC(14,2) AS total_sales_amount,

    COALESCE(SUM(si.line_total - (p.cost * si.quantity)), 0)::NUMERIC(14,2) AS total_profit

FROM sale_items si

INNER JOIN sales s
ON s.id = si.sale_id

INNER JOIN products p
ON p.id = si.product_id

LEFT JOIN categories c
ON c.id = p.category_id

WHERE s.status = 'COMPLETED'
AND s.deleted_at IS NULL

GROUP BY p.id, p.sku, p.barcode, p.name, c.id, c.name;