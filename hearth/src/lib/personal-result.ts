import { eq, inArray } from 'drizzle-orm';
import { participant, project, swipe, veto } from '@/db/schema';
import type { Db } from '@/db';
import { loadCentroids } from '@/lib/catalogue/load';
import { buildProfile, describeTaste, tasteSentence } from '@/lib/engine/profile';
import { NotFound } from '@/lib/errors';
import { attributeFamily, styleLabel } from '@/lib/taxonomy';
import { projectItems } from '@/lib/synthesis';

export interface PersonalResult {
  /** "You lean Japandi, with a soft spot for brass and clean lines." */
  sentence: string;
  style: string | null;
  styleName: string | null;
  softSpots: string[];
  /** Colours and materials from the cards this person said yes to, most common first. */
  palette: string[];
  materials: string[];
}

function topFamily(attrs: string[], family: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const a of attrs) if (attributeFamily(a) === family) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([a]) => a);
}

/**
 * The reward for finishing (R23): your own style, shown while you wait. It uses only your
 * swipes, so it never reveals anything about anyone else's (R10).
 */
export async function personalResult(db: Db, participantId: string): Promise<PersonalResult> {
  const [me] = await db.select().from(participant).where(eq(participant.id, participantId));
  if (!me) throw new NotFound();
  const [proj] = await db.select().from(project).where(eq(project.id, me.projectId));
  const items = await projectItems(db, proj);
  const byId = new Map(items.map((i) => [i.id, i]));
  const swipes = await db.select().from(swipe).where(eq(swipe.participantId, participantId));
  const vetoes = await db
    .select()
    .from(veto)
    .where(inArray(veto.participantId, [participantId]));
  const profile = buildProfile(
    {
      id: me.id,
      name: me.displayName,
      swipes: swipes.map((s) => ({ itemId: s.itemId, value: s.value as 1 | -1, round: s.round })),
      vetoes: vetoes.map((v) => ({ itemId: v.itemId, attribute: v.attribute })),
    },
    byId,
    await loadCentroids(db, items),
  );
  const liked = profile.likedIds.flatMap((id) => byId.get(id)?.attributes ?? []);
  const { style, softSpots } = describeTaste(profile);
  return {
    sentence: tasteSentence(profile),
    style,
    styleName: style ? styleLabel(style) : null,
    softSpots,
    palette: topFamily(liked, 'colour', 5),
    materials: topFamily(liked, 'material', 4),
  };
}
