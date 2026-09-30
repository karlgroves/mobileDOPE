/**
 * An empty optional column, as the models expect it.
 *
 * SQLite returns `null` for an empty column, but every model types its optional
 * fields `?: T` and every reader tests them with `!== undefined`. Each
 * `fromRow` passes its nullable columns through this, so a null never reaches
 * a model: one that did crashed DOPE Log Details and skewed the confidence
 * score (see `__tests__/unit/models/fromRowNulls.test.ts`).
 */
export const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;
