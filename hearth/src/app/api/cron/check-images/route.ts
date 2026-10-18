import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { isAuthorisedCron } from '@/lib/cron';
import { env } from '@/lib/env';
import { checkImages } from '@/lib/images/check';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorisedCron(request)) return new NextResponse('Unauthorized', { status: 401 });
  const result = await checkImages(await getDb(), fetch, { siteUrl: env.NEXT_PUBLIC_SITE_URL });
  return NextResponse.json({ ok: true, ...result });
}
