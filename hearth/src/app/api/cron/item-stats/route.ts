import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { isAuthorisedCron } from '@/lib/cron';
import { refreshItemStats } from '@/lib/stats/item-stats';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorisedCron(request)) return new NextResponse('Unauthorized', { status: 401 });
  await refreshItemStats(await getDb());
  return NextResponse.json({ ok: true });
}
