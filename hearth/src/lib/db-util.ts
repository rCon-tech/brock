/** `db.execute` returns `{ rows }` on PGlite and an array-like on postgres.js. */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
