import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db';
import { JoinForm } from '@/components/JoinForm';
import { inviteInfo } from '@/lib/invites';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Join', robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await inviteInfo(await getDb(), token);

  if (!info) {
    return (
      <div className="card mt-6 flex flex-col gap-3 p-5">
        <h1 className="text-2xl font-bold">This link has expired</h1>
        <p className="text-muted">Ask them to send you a fresh one, or start your own room.</p>
        <Link href="/start" className="btn btn-primary self-start">
          Start a room
        </Link>
      </div>
    );
  }
  if (info.full) {
    return (
      <div className="card mt-6 flex flex-col gap-3 p-5">
        <h1 className="text-2xl font-bold">This room is full</h1>
        <p className="text-muted">
          Four people is the limit. Ask {info.creatorName} what to do, or start your own.
        </p>
        <Link href="/start" className="btn btn-primary self-start">
          Start a room
        </Link>
      </div>
    );
  }
  const room = ROOM_LABELS[info.roomType as RoomType] ?? 'room';
  return (
    <div className="mt-4 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{info.creatorName} invited you</p>
        <h1 className="text-3xl font-bold">
          {info.creatorName} wants your take on the {room.toLowerCase()}.
        </h1>
        <p className="text-muted">
          Swipe through about 30 cards. Hearth then finds the style you both like.
          {info.projectName ? ` (${info.projectName})` : ''}
        </p>
      </header>
      <JoinForm token={token} />
    </div>
  );
}
