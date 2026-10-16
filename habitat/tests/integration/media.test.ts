import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { completeUpload, createUploads, purgePendingMedia, signedMediaUrl } from '@/lib/media';
import { setStorage, type Storage } from '@/lib/storage';
import { makeHabitat, makeUser } from './factories';

function fakeStorage(existing: Record<string, { bytes: number; mime: string }> = {}) {
  const removed: string[] = [];
  const storage: Storage = {
    presignPut: async (key) => `https://put.test/${key}`,
    presignGet: async (key, ttl) => `https://get.test/${key}?ttl=${ttl}`,
    head: async (key) => existing[key] ?? null,
    remove: async (key) => void removed.push(key),
  };
  return { storage, removed, existing };
}

const jpeg = { mime: 'image/jpeg', bytes: 5000, width: 800, height: 600 };

afterEach(() => setStorage(undefined));

describe('media', () => {
  it('creates pending rows and presigned URLs inside the habitat’s folder', async () => {
    setStorage(fakeStorage().storage);
    const h = await makeHabitat();
    const [u] = await createUploads(h.members[0]!, [jpeg]);
    expect(u!.putFull).toContain(`${h.id}/${u!.mediaId}/full.jpg`);
    expect(u!.putThumb).toContain('/thumb.jpg');
    const [row] = await getDb().select().from(s.media);
    expect(row).toMatchObject({ status: 'pending', habitatId: h.id });
  });

  it('validates type, size, dimensions and count', async () => {
    setStorage(fakeStorage().storage);
    const m = (await makeHabitat()).members[0]!;
    await expect(createUploads(m, [{ ...jpeg, mime: 'image/gif' }])).rejects.toMatchObject({
      status: 422,
    });
    await expect(createUploads(m, [{ ...jpeg, mime: 'image/svg+xml' }])).rejects.toMatchObject({
      status: 422,
    });
    await expect(createUploads(m, [{ ...jpeg, bytes: 11 * 1024 * 1024 }])).rejects.toMatchObject({
      status: 422,
    });
    await expect(createUploads(m, [{ ...jpeg, width: 9000 }])).rejects.toMatchObject({
      status: 422,
    });
    await expect(createUploads(m, [])).rejects.toMatchObject({ status: 422 });
    await expect(createUploads(m, Array(11).fill(jpeg))).rejects.toMatchObject({ status: 422 });
  });

  it('503 when storage is not configured', async () => {
    const m = (await makeHabitat()).members[0]!;
    await expect(createUploads(m, [jpeg])).rejects.toMatchObject({ status: 503 });
  });

  it('rate limits to 20 uploads an hour', async () => {
    setStorage(fakeStorage().storage);
    const m = (await makeHabitat()).members[0]!;
    const now = new Date('2026-06-01T12:00:00Z');
    await createUploads(m, Array(10).fill(jpeg), now);
    await createUploads(m, Array(10).fill(jpeg), now);
    await expect(createUploads(m, [jpeg], now)).rejects.toMatchObject({ status: 429 });
  });

  it('completing checks both objects exist with the right type, and only the uploader may', async () => {
    const f = fakeStorage();
    setStorage(f.storage);
    const h = await makeHabitat({ members: 2 });
    const [u] = await createUploads(h.members[0]!, [jpeg]);
    const [row] = await getDb().select().from(s.media);
    await expect(completeUpload(h.members[0]!, u!.mediaId)).rejects.toMatchObject({ status: 422 }); // nothing uploaded
    f.existing[row!.keyFull] = { bytes: 5000, mime: 'image/jpeg' };
    await expect(completeUpload(h.members[0]!, u!.mediaId)).rejects.toMatchObject({ status: 422 }); // no thumb
    f.existing[row!.keyThumb] = { bytes: 100, mime: 'text/html' };
    await expect(completeUpload(h.members[0]!, u!.mediaId)).rejects.toMatchObject({ status: 422 }); // wrong type
    f.existing[row!.keyThumb] = { bytes: 100, mime: 'image/jpeg' };
    await expect(completeUpload(h.members[1]!, u!.mediaId)).rejects.toMatchObject({ status: 403 });
    await completeUpload(h.members[0]!, u!.mediaId);
    const [after] = await getDb().select().from(s.media);
    expect(after!.status).toBe('ready');
  });

  it('signed URLs only for members, only once ready, and expire in an hour', async () => {
    const f = fakeStorage();
    setStorage(f.storage);
    const h = await makeHabitat();
    const other = await makeHabitat();
    const [u] = await createUploads(h.members[0]!, [jpeg]);
    const [row] = await getDb().select().from(s.media);
    await expect(signedMediaUrl(h.members[0]!.userId, u!.mediaId, 'thumb')).rejects.toMatchObject({
      status: 404,
    }); // pending
    await getDb().update(s.media).set({ status: 'ready' }).where(eq(s.media.id, u!.mediaId));
    expect(await signedMediaUrl(h.members[0]!.userId, u!.mediaId, 'thumb')).toBe(
      `https://get.test/${row!.keyThumb}?ttl=3600`,
    );
    expect(await signedMediaUrl(h.members[0]!.userId, u!.mediaId, 'full')).toContain('full.jpg');
    await expect(
      signedMediaUrl(other.members[0]!.userId, u!.mediaId, 'full'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(signedMediaUrl((await makeUser()).id, u!.mediaId, 'full')).rejects.toMatchObject({
      status: 404,
    });
    await expect(signedMediaUrl(h.members[0]!.userId, 'nope', 'full')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('purges abandoned pending uploads after a day', async () => {
    const f = fakeStorage();
    setStorage(f.storage);
    const h = await makeHabitat();
    const t = new Date('2026-06-01T00:00:00Z');
    await createUploads(h.members[0]!, [jpeg, jpeg], t);
    expect(await purgePendingMedia(new Date(t.getTime() + 3600_000))).toBe(0);
    expect(await purgePendingMedia(new Date(t.getTime() + 25 * 3600_000))).toBe(2);
    expect(f.removed).toHaveLength(4);
    expect(await getDb().select().from(s.media)).toHaveLength(0);
  });
});
