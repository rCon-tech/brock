import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Affiliate disclosure' };

export default function Disclosure() {
  return (
    <article className="flex flex-col gap-4 [&_p]:text-muted">
      <h1 className="text-3xl font-bold">Affiliate disclosure</h1>
      <p>
        Some of the links to products on Hearth are affiliate links. If you buy something after
        clicking one, the retailer may pay Hearth a commission. It doesn’t cost you anything extra.
      </p>
      <p>
        This never changes what we suggest. Suggestions come from your swipes and the style you
        share, not from what pays us. We don’t rank, remove or add products because of commission,
        and a retailer can’t pay to appear.
      </p>
      <p>Buy buttons are marked, and open the retailer in a new tab.</p>
    </article>
  );
}
