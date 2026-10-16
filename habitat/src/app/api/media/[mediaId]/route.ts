import { NextResponse } from 'next/server';
import { parseQuery, userRoute } from '@/lib/api';
import { signedMediaUrl } from '@/lib/media';
import { MediaQuery } from '@/lib/validation';

/** Membership check, then a redirect to a short-lived signed URL. Never public. */
export const GET = userRoute<{ mediaId: string }>(async ({ url, user, params }) => {
  const { v } = parseQuery(url, MediaQuery);
  const target = await signedMediaUrl(user.id, params.mediaId, v);
  return NextResponse.redirect(target, { status: 302, headers: { 'Cache-Control': 'private, max-age=3000' } });
});
