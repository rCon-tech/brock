import { cronRoute } from '@/lib/cron';
import { sendDigests } from '@/lib/digest';

export const GET = cronRoute(async () => ({ digests: await sendDigests() }));
