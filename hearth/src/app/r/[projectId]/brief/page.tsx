import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getDb } from '@/db';
import { CardImage } from '@/components/CardImage';
import { PrintButton } from '@/components/PrintButton';
import { getBoard } from '@/lib/board';
import { buildBrief } from '@/lib/brief';
import { env } from '@/lib/env';
import { formatDimensions, formatPrice } from '@/lib/locale';
import { requireMember } from '@/lib/permissions';
import { resolveParticipant } from '@/lib/resolve-participant';
import { getSessionUser } from '@/lib/session';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Style brief' };

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-bold tracking-wide text-clay uppercase">{title}</h2>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i} className="chip">
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const [{ projectId }, { as }] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  if (!user) redirect('/');
  const db = await getDb();
  const hosted = await requireMember(db, projectId, user.id);
  const me = resolveParticipant(hosted, as);
  const board = await getBoard(db, projectId, me.id);
  if (!board) redirect(`/r/${projectId}`);
  const brief = buildBrief(board);
  const url = `${env.NEXT_PUBLIC_SITE_URL}/r/${projectId}/board`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, width: 96 });
  const room = ROOM_LABELS[board.project.roomType as RoomType];

  return (
    <article className="print-page flex flex-col gap-5">
      <div className="no-print flex flex-wrap gap-2">
        <PrintButton />
        <a
          href={`/r/${projectId}/brief/image?as=${me.id}&download=1`}
          className="btn btn-secondary"
        >
          Save as image
        </a>
        <Link href={`/r/${projectId}/board?as=${me.id}`} className="btn btn-ghost">
          Back to the board
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-sand pb-4">
        <div>
          <p className="eyebrow">
            Style brief · {room}
            {board.project.name ? ` · ${board.project.name}` : ''}
          </p>
          <h1 className="text-4xl font-bold">{brief.title}</h1>
          <p className="font-display text-lg text-clay-dark">{brief.tagline}</p>
        </div>
        <div
          className="w-24 shrink-0"
          role="img"
          aria-label="QR code linking to the live board"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </header>

      <section>
        <h2 className="text-sm font-bold tracking-wide text-clay uppercase">Palette</h2>
        <ul className="mt-2 flex flex-wrap gap-4">
          {brief.palette.map((c) => (
            <li key={c.hex + c.label} className="flex items-center gap-2 text-sm">
              <span
                className="h-10 w-10 rounded-full border border-ink/10"
                style={{ background: c.hex }}
              />
              <span>
                {c.label}
                <span className="block text-xs text-muted">{c.hex}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Materials" items={brief.materials} />
        <List title="The feel" items={brief.feel} />
        <List title="Do: lean into" items={brief.dos} />
        <List title="Avoid" items={brief.avoids} />
      </div>

      {brief.pieces.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold tracking-wide text-clay uppercase">Pieces to look at</h2>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {brief.pieces.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-xl border border-sand p-2">
                <CardImage
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
                <span className="text-sm">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="text-muted">
                    {[
                      p.retailer?.replace(/-/g, ' '),
                      formatPrice(p.pricePence),
                      formatDimensions(p.widthCm, p.depthCm, p.heightCm),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief.notes.length > 0 ? (
        <section>
          <h2 className="text-sm font-bold tracking-wide text-clay uppercase">About the room</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {brief.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-sand pt-3 text-xs text-muted">
        Made with Hearth. Scan the code for the live board.
      </footer>
    </article>
  );
}
