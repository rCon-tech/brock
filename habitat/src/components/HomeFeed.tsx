'use client';

import { Timeline } from '@/components/Timeline';
import { getModule } from '@/modules/ui-registry';
import { Composer } from '@/modules/feed/Composer';

/** The Habitat home: composer, then the merged timeline, with each installed module's widget beside it. */
export function HomeFeed({ installed }: { installed: string[] }) {
  const widgets = installed.flatMap((id) => {
    const Widget = getModule(id)?.Widget;
    return Widget ? [{ id, Widget }] : [];
  });
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-3">
        {installed.includes('feed') && <Composer />}
        {widgets.length > 0 && (
          <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 lg:hidden" aria-label="At a glance">
            {widgets.map(({ id, Widget }) => (
              <div key={id} className="w-64 shrink-0 snap-start">
                <Widget />
              </div>
            ))}
          </div>
        )}
        <Timeline />
      </div>
      <aside className="hidden space-y-3 lg:block" aria-label="At a glance">
        {widgets.map(({ id, Widget }) => (
          <Widget key={id} />
        ))}
      </aside>
    </div>
  );
}
