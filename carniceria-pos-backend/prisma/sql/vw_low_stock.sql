/*
===============================================================================
VIEW: vw_low_stock
===============================================================================
*/

DROP VIEW IF EXISTS vw_low_stock CASCADE;

CREATE VIEW vw_low_stock AS

SELECT

    i.id AS inventory_id,

    suc.id AS sucursal_id,
    suc.name AS sucursal_name,

    p.id AS product_id,
    p.sku,
    p.name AS product_name,

    c.id AS category_id,
    c.name AS category_name,

    i.quantity,
    i.reorder_point

FROM inventory i

INNER JOIN products p
ON p.id = i.product_id

INNER JOIN categories c
ON c.id = p.category_id

INNER JOIN sucursales suc
ON suc.id = i.sucursal_id

WHERE i.deleted_at IS NULL
AND i.reorder_point IS NOT NULL
AND i.quantity <= i.reorder_point;