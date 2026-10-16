import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as s from '@/db/schema';
import { createInvite } from '@/lib/invites';
import { addComment } from '@/lib/interactions';
import { propose } from '@/lib/proposals';
import { createRecord } from '@/lib/records';
import { createReport } from '@/lib/reports';
import { makeHabitat, makeMedia } from './factories';

// Authentication itself is Better Auth's job. Here a header names the signed-in user, so these
// tests exercise everything after that: the membership gate and each route's handling of ids.
vi.mock('@/lib/current-user', () => ({
  userFromRequest: async (req: Request) => {
    const id = req.headers.get('x-test-user');
    if (!id) return null;
    const [u] = await getDb().select().from(s.user).where(eq(s.user.id, id));
    return u ?? null;
  },
}));

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;
const routes = import.meta.glob<Record<string, Handler>>('../../src/app/api/**/route.ts');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const pathOf = (file: string) => file.replace('../../src/app', '').replace('/route.ts', '');

async function call(
  file: string,
  method: string,
  user: string,
  params: Record<string, string>,
  body?: unknown,
) {
  const mod = await routes[file]!();
  const url = `http://localhost${pathOf(file).replace(/\[(\w+)\]/g, (_, k) => params[k] ?? 'x')}`;
  return mod[method]!(
    new Request(url, {
      method,
      headers: { 'x-test-user': user, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve(params) },
  );
}

let A: Awaited<ReturnType<typeof makeHabitat>>;
let B: Awaited<ReturnType<typeof makeHabitat>>;
let ids: Record<string, string>;

beforeEach(async () => {
  A = await makeHabitat({ members: 2, extraModules: ['wishlist'] });
  B = await makeHabitat({ members: 2, extraModules: ['wishlist'] });
  const bOwner = B.members[0]!;
  const post = await createRecord(bOwner, {
    module: 'feed',
    collection: 'post',
    data: { text: 'secret' },
  });
  const comment = await addComment(bOwner, post.id, { body: 'secret comment' });
  const proposal = await propose(bOwner, { kind: 'install', moduleId: 'polls' });
  const { invite } = await createInvite(bOwner);
  const report = await createReport(B.members[1]!, {
    targetType: 'record',
    targetId: post.id,
    reason: 'x',
  });
  ids = {
    recordId: post.id,
    commentId: comment.id,
    proposalId: proposal.id,
    inviteId: invite.id,
    mediaId: await makeMedia(B.id, bOwner.userId),
    reportId: report.id,
    userId: B.members[1]!.userId,
  };
});

describe('every habitat route refuses a member of another Habitat', () => {
  it('returns 404 for B’s habitat id on every /habitats/[habitatId]/* route', async () => {
    const files = Object.keys(routes).filter((f) => f.includes('[habitatId]'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const mod = await routes[file]!();
      for (const method of METHODS.filter((m) => mod[m])) {
        const res = await call(
          file,
          method,
          A.members[0]!.userId,
          { habitatId: B.id, ...ids },
          method === 'GET' || method === 'DELETE' ? undefined : {},
        );
        expect(res.status, `${method} ${pathOf(file)}`).toBe(404);
      }
    }
  });

  it('returns 401 without a signed-in user', async () => {
    for (const file of Object.keys(routes).filter((f) => f.includes('[habitatId]'))) {
      const mod = await routes[file]!();
      for (const method of METHODS.filter((m) => mod[m])) {
        const res = await (mod[method] as Handler)(new Request('http://localhost/x', { method }), {
          params: Promise.resolve({ habitatId: A.id, ...ids }),
        });
        expect(res.status, `${method} ${pathOf(file)}`).toBe(401);
      }
    }
  });
});

/** Routes that take another id besides the Habitat's. Each must treat B's id, used inside A, as not found. */
const FOREIGN_ID: Record<string, Array<{ method: string; body?: unknown }>> = {
  '/api/habitats/[habitatId]/records/[recordId]': [
    { method: 'GET' },
    { method: 'PATCH', body: { data: { text: 'x' } } },
    { method: 'DELETE' },
  ],
  '/api/habitats/[habitatId]/records/[recordId]/comments': [
    { method: 'GET' },
    { method: 'POST', body: { body: 'hi' } },
  ],
  '/api/habitats/[habitatId]/records/[recordId]/reactions': [
    { method: 'PUT', body: { emoji: '❤️' } },
    { method: 'DELETE', body: { emoji: '❤️' } },
  ],
  '/api/habitats/[habitatId]/records/[recordId]/pin': [{ method: 'PUT' }, { method: 'DELETE' }],
  '/api/habitats/[habitatId]/comments/[commentId]': [
    { method: 'PATCH', body: { body: 'x' } },
    { method: 'DELETE' },
  ],
  '/api/habitats/[habitatId]/proposals/[proposalId]': [{ method: 'GET' }, { method: 'DELETE' }],
  '/api/habitats/[habitatId]/proposals/[proposalId]/vote': [
    { method: 'PUT', body: { vote: 'yes' } },
  ],
  '/api/habitats/[habitatId]/invites/[inviteId]': [{ method: 'DELETE' }],
  '/api/habitats/[habitatId]/members/[userId]': [
    { method: 'PATCH', body: { role: 'admin' } },
    { method: 'DELETE' },
  ],
  '/api/habitats/[habitatId]/uploads/[mediaId]': [{ method: 'POST' }],
  '/api/habitats/[habitatId]/reports/[reportId]': [{ method: 'PATCH' }],
  // Not Habitat-scoped in the path, but still guarded by membership of the media's own Habitat.
  '/api/media/[mediaId]': [{ method: 'GET' }],
};
// Routes whose extra parameter is a global name, not a per-Habitat id.
const GLOBAL_PARAM = new Set([
  '/api/habitats/[habitatId]/modules/[moduleId]',
  '/api/invites/[code]',
  '/api/auth/[...all]',
]);

describe('ids from another Habitat are never found', () => {
  it('treats B’s ids, used from inside A, as 404', async () => {
    for (const [route, calls] of Object.entries(FOREIGN_ID)) {
      const file = `../../src/app${route}/route.ts`;
      expect(routes[file], route).toBeDefined();
      for (const { method, body } of calls) {
        const caller = A.members[0]!.userId; // the owner, so a refusal can only be about the id
        const res = await call(file, method, caller, { habitatId: A.id, ...ids }, body);
        expect(res.status, `${method} ${route}`).toBe(404);
      }
    }
  });

  it('a record from B cannot be used as a parent, a media id or a member in A', async () => {
    const a = A.members[0]!;
    const res = await call(
      '../../src/app/api/habitats/[habitatId]/records/route.ts',
      'POST',
      a.userId,
      { habitatId: A.id },
      { module: 'events', collection: 'rsvp', parentId: ids.recordId, data: { status: 'going' } },
    );
    expect(res.status).toBe(422);
    const photo = await call(
      '../../src/app/api/habitats/[habitatId]/records/route.ts',
      'POST',
      a.userId,
      { habitatId: A.id },
      { module: 'feed', collection: 'post', data: { text: 'x', mediaIds: [ids.mediaId] } },
    );
    expect(photo.status).toBe(422);
  });

  it('B’s timeline and record lists are empty for A, and A’s query cannot reach B’s rows', async () => {
    const tl = await call(
      '../../src/app/api/habitats/[habitatId]/timeline/route.ts',
      'GET',
      A.members[0]!.userId,
      { habitatId: A.id },
    );
    expect((await tl.json()).items).toEqual([]);
    const list = await call(
      '../../src/app/api/habitats/[habitatId]/records/route.ts',
      'GET',
      A.members[0]!.userId,
      { habitatId: A.id },
    );
    expect(list.status).toBe(422); // module/collection are required
  });

  it('every route with an extra id parameter is covered above (add new routes to FOREIGN_ID)', () => {
    const withIds = Object.keys(routes)
      .map(pathOf)
      .filter((p) => /\[(?!habitatId\])\w+\]/.test(p))
      .filter((p) => !GLOBAL_PARAM.has(p) && !/\[\.\.\./.test(p));
    const uncovered = withIds.filter((p) => !(p in FOREIGN_ID));
    expect(uncovered, 'These routes take an id but are not in FOREIGN_ID').toEqual([]);
  });
});
