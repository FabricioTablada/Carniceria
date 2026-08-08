/**
 * components/ui/RequiredMark.tsx
 * -----------------------------------------------------------------------------
 * Asterisco rojo para marcar un campo requerido junto a su `Label`, ej.
 * `<Label>Proveedor<RequiredMark /></Label>`. Puramente visual: no valida
 * nada — el campo ya es requerido por su schema de Zod correspondiente,
 * esto solo lo hace visible de un vistazo. Primer uso en
 * `features/purchases/components/PurchaseHeaderFields.tsx`; se extrae
 * aca (en vez de quedar duplicado ahi) porque `features/products/
 * components/ProductForm.tsx` lo necesita igual — es el mismo atomo
 * visual, no una variante nueva por modulo.
 */
export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {' '}
      *
    </span>
  )
}
