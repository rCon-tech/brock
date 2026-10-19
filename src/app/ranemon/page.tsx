import { RanemonBattle } from '@/components/RanemonBattle';

export const metadata = { title: 'Ranemon' };

export default function RanemonPage() {
  return (
    <section className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="comic-heading -rotate-2 text-6xl">RANEMON</h1>
        <p className="tagline">Battle prototype · placeholder art</p>
      </div>
      <RanemonBattle />
    </section>
  );
}
