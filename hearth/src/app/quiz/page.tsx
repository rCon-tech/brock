import type { Metadata } from 'next';
import { getDb } from '@/db';
import { StartForm } from '@/components/StartForm';
import { availableRoomTypes } from '@/lib/catalogue/load';
import { ROOM_TYPES, type RoomType } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Style quiz' };

export default async function Page({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const { with: partner } = await searchParams;
  const rooms = (await availableRoomTypes(await getDb(), ROOM_TYPES)) as RoomType[];
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">What’s your room style?</h1>
        <p className="text-muted">
          30 swipes, about three minutes. Then you can see how it fits with someone else’s.
        </p>
      </header>
      {rooms.length === 0 ? (
        <p className="card p-4">We’re still stocking the catalogue. Please check back soon.</p>
      ) : (
        <StartForm rooms={rooms} quiz={true} partner={partner} />
      )}
    </div>
  );
}
