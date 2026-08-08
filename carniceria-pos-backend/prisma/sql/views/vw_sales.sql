/*
===============================================================================
VIEW: vw_sales
===============================================================================
*/

DROP VIEW IF EXISTS vw_sales CASCADE;

CREATE VIEW vw_sales AS

SELECT

    s.id,
    s.document_number,
    s.sale_date,

    suc.id   AS sucursal_id,
    suc.name AS sucursal,

    u.id         AS user_id,
    u.full_name  AS vendedor,

    s.payment_method,
    s.status,

    s.subtotal,
    s.tax_total,
    s.discount_total,
    s.total,

    s.amount_paid,
    s.change_given,

    s.created_at

FROM sales s

INNER JOIN sucursales suc
ON suc.id = s.sucursal_id

INNER JOIN users u
ON u.id = s.user_id

WHERE s.status = 'COMPLETED'
AND s.deleted_at IS NULL;