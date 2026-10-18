import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { AppError } from '@/lib/errors';
import { requireMember } from '@/lib/permissions';
import { getProjectState } from '@/lib/project-state';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const user = await getSessionUser();
    if (!user) throw new AppError('Not found', 404);
    const db = await getDb();
    await requireMember(db, projectId, user.id);
    return NextResponse.json(await getProjectState(db, projectId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
