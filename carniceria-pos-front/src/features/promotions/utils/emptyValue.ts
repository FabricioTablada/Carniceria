/**
 * features/promotions/utils/emptyValue.ts
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones. Arregla el bug de
 * wiring detectado durante el analisis: `PromotionForm.tsx` registraba
 * los campos numericos opcionales con `valueAsNumber: true`, que
 * convierte un input vacio ("") en `NaN` — Zod rechaza `NaN` con un
 * mensaje crudo ("Invalid input: expected number, received NaN") aunque
 * el campo sea opcional (`.nullish()` en `promotion.schema.ts`, sin
 * cambios). Los campos de fecha/hora (`register('startDate')` simple)
 * tenian el mismo problema con `""` en vez de `undefined` contra un
 * regex que no acepta cadena vacia.
 *
 * Estas dos funciones se usan como `setValueAs` en `register(...)` de
 * cada campo opcional afectado (`ScopeCards`/`EffectCards`/
 * `VigenciaSection`/`AdvancedRulesSection`/`PromotionForm`): NO cambian
 * ninguna regla de `promotion.schema.ts` — solo hacen que "el usuario no
 * escribio nada" se traduzca a `undefined` (que el schema ya acepta)
 * en vez de a `NaN`/`""` (que el schema ya rechazaba, solo que por un
 * motivo distinto al que el usuario esperaba).
 */
export function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value
}

export function emptyToUndefinedNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}
