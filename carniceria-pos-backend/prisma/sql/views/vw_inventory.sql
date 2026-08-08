/*
===============================================================================
VIEW: vw_inventory
===============================================================================
*/

DROP VIEW IF EXISTS vw_inventory CASCADE;

CREATE VIEW vw_inventory AS

SELECT

    i.id,

    suc.id AS sucursal_id,
    suc.name AS sucursal,

    p.id AS product_id,
    p.sku,
    p.barcode,
    p.name AS producto,

    c.id AS category_id,
    c.name AS categoria,

    i.quantity,
    i.reorder_point,

    p.cost,
    p.sale_price,

    (i.quantity * p.cost) AS inventory_cost,

    (i.quantity * p.sale_price) AS inventory_sale_value,

    i.updated_at

FROM inventory i

INNER JOIN products p
ON p.id = i.product_id

INNER JOIN categories c
ON c.id = p.category_id

INNER JOIN sucursales suc
ON suc.id = i.sucursal_id

WHERE i.deleted_at IS NULL;