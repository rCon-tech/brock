/** A failure the caller can act on. `api.ts` maps these to the one JSON error shape. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const unauthenticated = () => new DomainError('unauthenticated', 401, 'Please sign in.');
/** Used for "doesn't exist" and "you aren't a member" alike, so outsiders learn nothing. */
export const notFound = (message = 'Not found.') => new DomainError('not_found', 404, message);
export const forbidden = (message = 'You can’t do that here.') => new DomainError('forbidden', 403, message);
export const conflict = (code: string, message: string) => new DomainError(code, 409, message);
export const gone = (code: string, message: string) => new DomainError(code, 410, message);
export const invalid = (message: string, fields?: Record<string, string[]>) =>
  new DomainError('invalid', 422, message, fields);
export const badRequest = (code: string, message: string) => new DomainError(code, 400, message);
export const tooMany = (message = 'Slow down a little and try again soon.') =>
  new DomainError('rate_limited', 429, message);

/** True for a Postgres unique-violation (SQLSTATE 23505), however the driver wraps it. */
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === 'object' && (cur as { code?: string }).code === '23505') return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
