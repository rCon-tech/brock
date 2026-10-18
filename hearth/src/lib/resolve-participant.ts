import type { ParticipantRow } from '@/lib/permissions';

/**
 * Which of the people this session controls is acting. The `as` query parameter picks one
 * (needed on a shared phone); otherwise it's the only one, or the first who isn't finished.
 */
export function resolveParticipant(hosted: ParticipantRow[], as?: string): ParticipantRow {
  const picked = as ? hosted.find((p) => p.id === as) : undefined;
  if (picked) return picked;
  if (hosted.length === 1) return hosted[0];
  return hosted.find((p) => !(p.macroDoneAt && p.microDoneAt)) ?? hosted[0];
}
