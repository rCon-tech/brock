import { habitatRoute, parseBody } from '@/lib/api';
import { changeRole, removeMember, setNickname } from '@/lib/members';
import { forbidden } from '@/lib/errors';
import { MemberPatchBody } from '@/lib/validation';

type P = { habitatId: string; userId: string };

export const PATCH = habitatRoute<P>(async ({ req, member, params }) => {
  const body = await parseBody(req, MemberPatchBody);
  if (body.nickname !== undefined) {
    if (params.userId !== member.userId) throw forbidden('You can only change your own nickname.');
    await setNickname(member, body.nickname || null);
  }
  if (body.role) await changeRole(member, params.userId, body.role);
});

/** Remove a member, or leave when `userId` is you. `?deleteContent=1` when leaving. */
export const DELETE = habitatRoute<P>(async ({ url, member, params }) => {
  await removeMember(member, params.userId, {
    deleteContent: url.searchParams.get('deleteContent') === '1',
  });
});
