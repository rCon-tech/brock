import { randomUUID } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { media } from '@/db/schema';
import { DomainError, forbidden, invalid, notFound } from './errors';
import { rateLimit } from './rate-limit';
import { requireMember, type MemberCtx } from './session';
import { GET_URL_TTL, getStorage } from './storage';

export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_FULL_BYTES = 10 * 1024 * 1024;
export const MAX_THUMB_BYTES = 1024 * 1024;
export const MAX_DIMENSION = 8192;
export const UPLOADS_PER_HOUR = 20;

const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' } as const;
export type Mime = keyof typeof EXT;

export interface UploadRequest {
  mime: string;
  bytes: number;
  width: number;
  height: number;
}

function requireStorage() {
  try {
    getStorage();
  } catch {
    throw new DomainError(
      'photos_unavailable',
      503,
      'Photo uploads aren’t set up on this server yet.',
    );
  }
}

/** Create pending media rows and presigned PUT URLs for the original and a 480px thumbnail. */
export async function createUploads(ctx: MemberCtx, files: UploadRequest[], now = new Date()) {
  requireStorage();
  if (files.length < 1 || files.length > MAX_FILES_PER_UPLOAD) {
    throw invalid(`Upload between 1 and ${MAX_FILES_PER_UPLOAD} photos at a time.`);
  }
  for (const f of files) {
    if (!(f.mime in EXT)) throw invalid('Photos must be JPEG, PNG or WebP.');
    if (f.bytes < 1 || f.bytes > MAX_FULL_BYTES) throw invalid('Photos can be at most 10 MB.');
    if (f.width < 1 || f.height < 1 || f.width > MAX_DIMENSION || f.height > MAX_DIMENSION) {
      throw invalid('That photo’s dimensions aren’t supported.');
    }
  }
  for (let i = 0; i < files.length; i++)
    await rateLimit(`up:${ctx.userId}`, UPLOADS_PER_HOUR, 3600, now);

  const storage = getStorage();
  const out = [];
  for (const f of files) {
    const id = randomUUID();
    const ext = EXT[f.mime as Mime];
    const keyFull = `${ctx.habitatId}/${id}/full.${ext}`;
    const keyThumb = `${ctx.habitatId}/${id}/thumb.${ext}`;
    await getDb()
      .insert(media)
      .values({
        id,
        habitatId: ctx.habitatId,
        uploaderId: ctx.userId,
        keyFull,
        keyThumb,
        mime: f.mime as Mime,
        bytes: f.bytes,
        width: f.width,
        height: f.height,
        createdAt: now,
      });
    out.push({
      mediaId: id,
      putFull: await storage.presignPut(keyFull, f.mime, f.bytes),
      // The thumbnail's exact size isn't known up front, so it is capped when verified in completeUpload.
      putThumb: await storage.presignPut(keyThumb, f.mime, Math.min(f.bytes, MAX_THUMB_BYTES)),
    });
  }
  return out;
}

/** Confirm both objects really exist with the right type and size, then mark the photo ready. */
export async function completeUpload(ctx: MemberCtx, mediaId: string) {
  const db = getDb();
  const [m] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.habitatId, ctx.habitatId)));
  if (!m) throw notFound();
  if (m.uploaderId !== ctx.userId) throw forbidden();
  if (m.status === 'ready') return;
  const storage = getStorage();
  const [full, thumb] = await Promise.all([storage.head(m.keyFull), storage.head(m.keyThumb)]);
  if (!full || !thumb) throw invalid('The upload didn’t finish. Try again.');
  if (full.mime !== m.mime || thumb.mime !== m.mime)
    throw invalid('That file isn’t the type it claimed to be.');
  if (full.bytes > MAX_FULL_BYTES || thumb.bytes > MAX_THUMB_BYTES)
    throw invalid('That file is too large.');
  await db.update(media).set({ status: 'ready', bytes: full.bytes }).where(eq(media.id, mediaId));
}

/** Membership check, then a signed URL good for an hour. Non-members get the same 404 as a missing photo. */
export async function signedMediaUrl(userId: string, mediaId: string, variant: 'thumb' | 'full') {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) throw notFound();
  const db = getDb();
  const [m] = await db.select().from(media).where(eq(media.id, mediaId));
  if (!m || m.status !== 'ready') throw notFound();
  await requireMember(db, m.habitatId, userId);
  return getStorage().presignGet(variant === 'thumb' ? m.keyThumb : m.keyFull, GET_URL_TTL);
}

/** Nightly: pending uploads older than a day were abandoned. */
export async function purgePendingMedia(now = new Date()): Promise<number> {
  const db = getDb();
  const stale = await db
    .select()
    .from(media)
    .where(
      and(eq(media.status, 'pending'), lt(media.createdAt, new Date(now.getTime() - 86400_000))),
    );
  for (const m of stale) {
    try {
      const storage = getStorage();
      await Promise.allSettled([storage.remove(m.keyFull), storage.remove(m.keyThumb)]);
    } catch {
      // storage not configured: nothing was uploaded
    }
    await db.delete(media).where(eq(media.id, m.id));
  }
  return stale.length;
}
