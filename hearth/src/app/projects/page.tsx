import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { listProjects } from '@/lib/projects';
import { getSessionUser } from '@/lib/session';
import { isFinished } from '@/lib/synthesis';
import { ROOM_LABELS, type RoomType } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My rooms' };

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/');
  const projects = await listProjects(await getDb(), user.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My rooms</h1>
        <Link href="/start" className="btn btn-primary btn-sm">
          New room
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="card flex flex-col gap-3 p-5">
          <p className="text-muted">You haven’t started a room yet.</p>
          <Link href="/start" className="btn btn-primary self-start">
            Start your first room
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const mine = p.participants.filter((x) => x.hostUserId === user.id);
            const others = p.participants.filter((x) => x.hostUserId !== user.id);
            const status = p.revealedAt
              ? 'Board ready'
              : mine.every(isFinished)
                ? others.length === 0
                  ? 'Waiting for someone to join'
                  : `Waiting for ${
                      others
                        .filter((o) => !isFinished(o))
                        .map((o) => o.displayName)
                        .join(', ') || 'everyone to be ready'
                    }`
                : 'Swiping';
            return (
              <li key={p.id}>
                <Link
                  href={`/r/${p.id}`}
                  className="card flex items-center justify-between gap-3 p-4 hover:bg-blush/40"
                >
                  <span>
                    <span className="block font-display text-lg font-bold">
                      {p.name || ROOM_LABELS[p.roomType as RoomType]}
                    </span>
                    <span className="text-sm text-muted">
                      {p.participants.map((x) => x.displayName).join(' · ')}
                    </span>
                  </span>
                  <span className={`chip ${p.revealedAt ? 'chip-sage' : ''}`}>{status}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
