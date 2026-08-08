/*
===============================================================================
VIEW: vw_profit
-------------------------------------------------------------------------------
NOTA: usa si.line_total / si.line_subtotal (ya calculados por
sales.service.ts, netos de descuento) en lugar de recalcular
unit_price * quantity. La version anterior ignoraba si.discount y
sobreestimaba la utilidad en cualquier linea con descuento.
===============================================================================
*/

DROP VIEW IF EXISTS vw_profit CASCADE;

CREATE VIEW vw_profit AS

SELECT

    si.id,

    s.id AS sale_id,
    s.document_number,
    s.sale_date,

    p.id AS product_id,
    p.sku,
    p.name AS producto,

    si.quantity,

    p.cost,

    si.unit_price,
    si.discount,

    (p.cost * si.quantity) AS total_cost,

    si.line_total AS total_sale,

    (si.line_total - (p.cost * si.quantity)) AS profit,

    CASE
        WHEN si.line_total = 0 THEN 0
        ELSE ROUND(
            (((si.line_total - (p.cost * si.quantity)) / si.line_total) * 100)::numeric,
            2
        )
    END AS profit_margin

FROM sale_items si

INNER JOIN sales s
ON s.id = si.sale_id

INNER JOIN products p
ON p.id = si.product_id

WHERE s.status = 'COMPLETED'
AND s.deleted_at IS NULL;