import { ZodError } from 'zod';
import { getDb, type Db } from '@/db';
import { AppError } from '@/lib/errors';
import { ensureUserId, requireUserId } from '@/lib/session';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

interface Context {
  db: Db;
  userId: string;
}

/**
 * Wraps a server action: resolves the database and the signed-in person (a guest session is
 * created for first-time visitors when `guest` is set), and turns expected errors into messages
 * the UI can show. Unexpected errors, and redirects, propagate as usual.
 */
export async function run<T>(
  fn: (ctx: Context) => Promise<T>,
  opts: { guest?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const userId = opts.guest ? await ensureUserId() : await requireUserId();
    const db = await getDb();
    return { ok: true, data: await fn({ db, userId }) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? 'Please check what you entered.' };
    }
    throw error;
  }
}
