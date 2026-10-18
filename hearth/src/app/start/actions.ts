'use server';

import { redirect } from 'next/navigation';
import { run } from '@/lib/action';
import { clientIp } from '@/lib/ip';
import { createProject } from '@/lib/projects';
import { enforce, LIMITS } from '@/lib/rate-limit';

export interface StartState {
  error?: string;
}

export async function createProjectAction(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  let context: unknown = {};
  try {
    context = JSON.parse(text('context') || '{}');
  } catch {
    return { error: 'Something went wrong with the room details. Please try again.' };
  }
  const isQuiz = text('quiz') === '1';
  const ip = await clientIp();

  const result = await run(
    async ({ db, userId }) => {
      await enforce(
        db,
        `create:user:${userId}`,
        LIMITS.createProject.limit,
        LIMITS.createProject.windowMs,
      );
      await enforce(
        db,
        `create:ip:${ip}`,
        LIMITS.createProject.limit * 3,
        LIMITS.createProject.windowMs,
      );
      return createProject(db, userId, {
        roomType: text('roomType') as 'living_room',
        name: text('name') || undefined,
        budgetBand: (text('budgetBand') || null) as 'low' | null,
        context: context as never,
        mode: (text('mode') || 'remote') as 'remote',
        displayName: text('displayName'),
        isQuiz,
        refPartner: text('refPartner') || undefined,
      });
    },
    { guest: true },
  );
  if (!result.ok) return { error: result.error };
  // The quiz goes straight to the cards; everything else lands on the hub with the invite link.
  redirect(isQuiz ? `/r/${result.data.projectId}/swipe` : `/r/${result.data.projectId}`);
}
