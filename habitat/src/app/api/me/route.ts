import { deleteAccount, updateProfile } from '@/lib/account';
import { parseBody, userRoute } from '@/lib/api';
import { MePatchBody } from '@/lib/validation';

export const GET = userRoute(async ({ user }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  onboarded: !!user.onboardedAt,
  emailPrefs: user.emailPrefs,
}));

export const PATCH = userRoute(async ({ req, user }) => {
  await updateProfile(user.id, await parseBody(req, MePatchBody));
});

export const DELETE = userRoute(async ({ url, user }) => {
  await deleteAccount(user.id, { deleteContent: url.searchParams.get('deleteContent') === '1' });
});
