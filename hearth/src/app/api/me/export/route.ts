import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { exportMyData } from '@/lib/my-data';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data = await exportMyData(await getDb(), user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="hearth-my-data.json"',
      'Cache-Control': 'no-store',
    },
  });
}
