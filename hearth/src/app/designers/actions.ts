'use server';

import { run } from '@/lib/action';
import { clientIp } from '@/lib/ip';
import { allow } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';
import { joinWaitlist } from '@/lib/waitlist';

export interface WaitlistState {
  done?: boolean;
  error?: string;
}

export async function waitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const feature = String(formData.get('feature')) === 'designers' ? 'designers' : 'see_in_room';
  const ip = await clientIp();
  const result = await run(
    async ({ db }) => {
      if (!(await allow(db, `waitlist:${ip}`, 10, 3_600_000)))
        throw new AppError('Slow down a little and try again.');
      await joinWaitlist(db, {
        email: String(formData.get('email') ?? ''),
        feature,
        projectId: String(formData.get('projectId') ?? '') || undefined,
        details:
          feature === 'designers'
            ? {
                practiceSize: String(formData.get('practiceSize') ?? '').slice(0, 100),
                clientsPerMonth: String(formData.get('clientsPerMonth') ?? '').slice(0, 100),
                wouldPay: String(formData.get('wouldPay') ?? '').slice(0, 200),
              }
            : undefined,
      });
    },
    { guest: true },
  );
  return result.ok ? { done: true } : { error: result.error };
}
