/*
===============================================================================
VIEW: vw_sales_by_cashier
-------------------------------------------------------------------------------
Ventas agregadas por cajero (cantidad de ventas e importe total), sobre el
historico de ventas completadas. Uso exclusivo Power BI (decision #3); el
ordenamiento lo aplica Power BI, no la vista.

NO incluye ticket promedio: es una razon calculada sobre datos ya
agrupados por cajero (SUM(total_sales_amount) / total_sales), y ninguna
vista de este proyecto precalcula ese tipo de razon agregada -- deja de
ser correcta en cuanto Power BI vuelve a agrupar por otra dimension
(mes, sucursal, etc.). El ticket promedio se calcula en Power BI mediante
una medida DAX (DIVIDE(SUM(total_sales_amount), SUM(total_sales))), que
se recalcula correctamente bajo cualquier filtro o nivel de agregacion.
===============================================================================
*/

DROP VIEW IF EXISTS vw_sales_by_cashier CASCADE;

CREATE VIEW vw_sales_by_cashier AS

SELECT

    u.id AS cashier_id,
    u.full_name AS cashier_name,

    COUNT(s.id)::INTEGER AS total_sales,

    COALESCE(SUM(s.total), 0)::NUMERIC(14,2) AS total_sales_amount

FROM sales s

INNER JOIN users u
ON u.id = s.user_id

WHERE s.status = 'COMPLETED'
AND s.deleted_at IS NULL

GROUP BY u.id, u.full_name;