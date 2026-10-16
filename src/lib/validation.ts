import { z } from 'zod';
import { DomainError } from './errors';
import { THROWS } from './game';

export const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export const HandleInput = z
  .string()
  .trim()
  .regex(HANDLE_PATTERN, 'Use 3–20 letters, numbers or underscores');

export const ThrowBody = z.object({
  roundNo: z.number().int().min(1),
  throw: z.enum(THROWS),
});

export type ThrowBody = z.infer<typeof ThrowBody>;

export const ClaimHandleBody = z.object({ handle: HandleInput });

export const LoginBody = z.object({ handle: z.string().trim().min(1).max(40) });

/** A quiz answer: which question, and the option's index (null when the clock ran out). */
export const QuizAnswerBody = z.object({
  index: z.number().int().min(0).max(9),
  choice: z.number().int().min(0).max(3).nullable(),
});

export const LeaderboardBoard = z.enum(['today', 'all']).catch('today');
export type LeaderboardBoard = z.infer<typeof LeaderboardBoard>;

export const MAX_LEADERBOARD_LIMIT = 100;

export function clampLimit(limit: number): number {
  return Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, limit));
}

/**
 * Parses a JSON request body, refusing anything not sent as `application/json`. Cross-site HTML
 * forms can only send form encodings, so this stops them from triggering state changes
 * (notably the cookie-setting login route) on a visitor's behalf.
 */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new DomainError('invalid_request');
  }
  return request.json().catch(() => {
    throw new DomainError('invalid_request');
  });
}
