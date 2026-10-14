'use server';

import { redirect } from 'next/navigation';
import { DomainError } from '@/lib/errors';
import { claimHandle } from '@/lib/players';
import { requireUser } from '@/lib/session';

export interface HandleFormState {
  error?: string;
}

export async function claimHandleAction(
  _prev: HandleFormState,
  formData: FormData,
): Promise<HandleFormState> {
  try {
    const user = await requireUser();
    await claimHandle(user.id, String(formData.get('handle') ?? ''));
  } catch (err) {
    if (err instanceof DomainError) {
      if (err.code === 'already_onboarded') redirect('/');
      if (err.code === 'unauthorized') redirect('/');
      return { error: err.code === 'handle_taken' ? 'Handle taken' : err.message };
    }
    throw err;
  }
  redirect('/');
}
