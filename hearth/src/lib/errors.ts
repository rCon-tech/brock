export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code: string = 'bad_request',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFound extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'not_found');
  }
}

export class Forbidden extends AppError {
  constructor(message = 'Not allowed') {
    super(message, 403, 'forbidden');
  }
}

export class Conflict extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'conflict');
  }
}

export class RateLimited extends AppError {
  constructor(message = 'Slow down a little and try again.') {
    super(message, 429, 'rate_limited');
  }
}
