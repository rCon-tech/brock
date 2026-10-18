import { ImageResponse } from 'next/og';
import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db';
import { getBoard } from '@/lib/board';
import { buildBrief } from '@/lib/brief';
import { AppError } from '@/lib/errors';
import { requireMember } from '@/lib/permissions';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const INK = '#26211c';
const CLAY = '#b4553a';

/** The brief as a PNG, for "Save as image" on a phone (R30). Text and swatches only. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const user = await getSessionUser();
    if (!user) throw new AppError('Not found', 404);
    const db = await getDb();
    const hosted = await requireMember(db, projectId, user.id);
    const me = resolveParticipant(hosted, request.nextUrl.searchParams.get('as') ?? undefined);
    const board = await getBoard(db, projectId, me.id);
    if (!board) throw new AppError('Not found', 404);
    const b = buildBrief(board);

    const section = (title: string, items: string[]) =>
      items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 22, color: CLAY, fontWeight: 700 }}>{title.toUpperCase()}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {items.map((i) => (
              <div
                key={i}
                style={{
                  background: '#e6dac8',
                  borderRadius: 999,
                  padding: '8px 18px',
                  fontSize: 26,
                }}
              >
                {i}
              </div>
            ))}
          </div>
        </div>
      ) : null;

    const image = new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          padding: 64,
          background: '#f7f1e8',
          color: INK,
        }}
      >
        <div style={{ fontSize: 24, color: CLAY, fontWeight: 700 }}>STYLE BRIEF</div>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>{b.title}</div>
        <div style={{ fontSize: 34, color: '#8f3f28' }}>{b.tagline}</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {b.palette.map((c) => (
            <div
              key={c.hex + c.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                fontSize: 22,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  background: c.hex,
                  border: '2px solid rgba(0,0,0,0.1)',
                }}
              />
              {c.label}
            </div>
          ))}
        </div>
        {section('Materials', b.materials)}
        {section('Lean into', b.dos)}
        {section('Avoid', b.avoids)}
        {section(
          'Pieces',
          b.pieces.slice(0, 6).map((p) => p.title),
        )}
        <div style={{ marginTop: 'auto', fontSize: 22, color: '#6b6258' }}>Made with Hearth</div>
      </div>,
      { width: 1080, height: 1440 },
    );
    if (request.nextUrl.searchParams.get('download')) {
      image.headers.set('Content-Disposition', 'attachment; filename="hearth-style-brief.png"');
    }
    return image;
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
