import { created, parseBody, userRoute } from '@/lib/api';
import { createHabitat, listMyHabitats } from '@/lib/habitats';
import { CreateHabitatBody } from '@/lib/validation';

export const GET = userRoute(async ({ user }) => ({ habitats: await listMyHabitats(user.id) }));

export const POST = userRoute(async ({ req, user }) => {
  const h = await createHabitat(user.id, await parseBody(req, CreateHabitatBody));
  return created({ habitat: { id: h.id, slug: h.slug } });
});
