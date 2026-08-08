# Vistas SQL para Power BI

Power BI se conecta **directamente a PostgreSQL** (decision #3) y lee estas
vistas, no la API. Cada reporte pesado se define aqui como una vista SQL y se
aplica mediante `scripts/apply-views.sh` o como migracion SQL.

La aplicacion NO sirve el BI pesado; el modulo `reports` cubre solo los
reportes operativos rapidos que el POS necesita al instante.

Vistas ya definidas en este directorio (aplicadas via `apply-views.sql` /
`npm run db:views`): `vw_cash_summary`, `vw_dashboard`, `vw_inventory`,
`vw_profit`, `vw_purchases`, `vw_sales`, `vw_sales_by_cashier`,
`vw_sales_by_category`, `vw_top_products`. Se agregaran vistas nuevas
conforme surjan necesidades adicionales de reporting.
