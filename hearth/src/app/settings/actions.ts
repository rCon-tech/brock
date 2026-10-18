'use server';

import { redirect } from 'next/navigation';
import { run } from '@/lib/action';
import { deleteMyData } from '@/lib/my-data';

/** Deletes the signed-in person and what they added, then sends them home (R37). */
export async function deleteMyDataAction() {
  const result = await run(async ({ db, userId }) => {
    await deleteMyData(db, userId);
  });
  if (result.ok) redirect('/');
  return result;
}
