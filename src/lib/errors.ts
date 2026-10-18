export type DomainErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'play_first'
  | 'not_found'
  | 'new_day'
  | 'already_played'
  | 'stale_round'
  | 'handle_taken'
  | 'already_named'
  | 'rate_limited'
  | 'no_quiz'
  | 'quiz_closed'
  | 'stale_question'
  | 'no_risk';

const STATUS: Record<DomainErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  play_first: 403,
  not_found: 404,
  new_day: 409,
  already_played: 409,
  stale_round: 409,
  handle_taken: 409,
  already_named: 409,
  rate_limited: 429,
  no_quiz: 409,
  quiz_closed: 409,
  stale_question: 409,
  no_risk: 409,
};

export class DomainError extends Error {
  readonly status: number;

  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
    this.status = STATUS[code];
  }
}

/** Maps any thrown value to an HTTP status + JSON body. Unexpected errors never leak internals. */
export function toErrorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof DomainError) {
    return { status: err.status, body: { error: err.code } };
  }
  console.error('Unhandled error', err);
  return { status: 500, body: { error: 'internal_error' } };
}
