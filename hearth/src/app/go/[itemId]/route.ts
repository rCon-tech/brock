import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { catalogueItem, outboundClick } from '@/db/schema';
import { clientIp } from '@/lib/ip';
import { newId } from '@/lib/ids';
import { allow, LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SURFACES = ['board', 'share', 'email', 'seo', 'brief'] as const;

/**
 * Every buy button goes through here: log the click, then redirect to the retailer (R12). The
 * affiliate link is only ever used for the redirect, never shown or used to rank anything.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const db = await getDb();
  if (!(await allow(db, `go:${await clientIp()}`, LIMITS.go.limit, LIMITS.go.windowMs))) {
    return new NextResponse('Slow down a little and try again.', { status: 429 });
  }
  const [item] = await db.select().from(catalogueItem).where(eq(catalogueItem.id, itemId));
  const target = item?.affiliateUrl ?? item?.productUrl;
  if (!item || !target || !/^https?:\/\//i.test(target))
    return new NextResponse('Not found', { status: 404 });

  const q = request.nextUrl.searchParams;
  const surface = SURFACES.find((s) => s === q.get('s')) ?? 'board';
  await db.insert(outboundClick).values({
    id: newId(),
    itemId,
    projectId: q.get('p')?.slice(0, 64) || null,
    participantId: q.get('a')?.slice(0, 64) || null,
    surface,
  });
  return NextResponse.redirect(target, {
    status: 302,
    headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
  });
}
