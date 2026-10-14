import { z } from 'zod';
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

export const MAX_LEADERBOARD_LIMIT = 100;

export function clampLimit(limit: number): number {
  return Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, limit));
}
