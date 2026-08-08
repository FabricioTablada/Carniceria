/*
===============================================================================
VIEW: vw_purchases
===============================================================================
*/

DROP VIEW IF EXISTS vw_purchases CASCADE;

CREATE VIEW vw_purchases AS

SELECT

    p.id,
    p.document_number,
    p.purchase_date,

    suc.id AS sucursal_id,
    suc.name AS sucursal,

    sup.id AS supplier_id,
    sup.name AS proveedor,

    u.id AS user_id,
    u.full_name AS usuario,

    p.status,

    p.subtotal,
    p.tax_total,
    p.total,

    p.created_at

FROM purchases p

INNER JOIN sucursales suc
ON suc.id = p.sucursal_id

INNER JOIN suppliers sup
ON sup.id = p.supplier_id

INNER JOIN users u
ON u.id = p.user_id

WHERE p.deleted_at IS NULL;