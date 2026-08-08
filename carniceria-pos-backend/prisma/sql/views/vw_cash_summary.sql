/*
===============================================================================
VIEW: vw_cash_summary
===============================================================================
*/

DROP VIEW IF EXISTS vw_cash_summary CASCADE;

CREATE VIEW vw_cash_summary AS

SELECT

    cs.id,

    suc.id AS sucursal_id,
    suc.name AS sucursal,

    cr.id AS cash_register_id,
    cr.name AS cash_register,

    uo.full_name AS opened_by,
    uc.full_name AS closed_by,

    cs.status,

    cs.opened_at,
    cs.closed_at,

    cs.opening_amount,
    cs.expected_amount,
    cs.closing_amount,
    cs.difference,

    cs.created_at

FROM cash_sessions cs

INNER JOIN sucursales suc
ON suc.id = cs.sucursal_id

INNER JOIN cash_registers cr
ON cr.id = cs.cash_register_id

INNER JOIN users uo
ON uo.id = cs.opened_by_user_id

LEFT JOIN users uc
ON uc.id = cs.closed_by_user_id

WHERE cs.deleted_at IS NULL;