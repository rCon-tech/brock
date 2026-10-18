import { CardImage } from '@/components/CardImage';
import type { ItemCard } from '@/lib/catalogue/load';
import { formatDimensions, formatPrice } from '@/lib/locale';
import { CATEGORY_LABELS, type Category } from '@/lib/taxonomy';

interface Props {
  item: ItemCard;
  /** Short notes under the title: "Goes with your grey sofa", "May not suit pets". */
  badges?: { text: string; tone?: 'sage' | 'clay' }[];
  buyHref?: string;
  /** A size limit applies but this item's size is unknown (R16). */
  checkSize?: boolean;
  children?: React.ReactNode;
}

/** One product on the board. Buying always goes through /go so clicks are logged and disclosed (R12). */
export function ProductCard({ item, badges = [], buyHref, checkSize, children }: Props) {
  const size = formatDimensions(item.widthCm, item.depthCm, item.heightCm);
  return (
    <article className="card flex flex-col overflow-hidden">
      {/* overflow-hidden stops the image's natural height overriding the 4:3 box inside this flex column */}
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        <CardImage src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        {!item.inStock ? (
          <span className="chip absolute top-2 left-2 bg-paper/95">Out of stock</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="font-display text-lg leading-snug font-bold">{item.title}</h3>
          <p className="text-xs text-muted">
            {[
              item.category ? CATEGORY_LABELS[item.category as Category] : null,
              item.retailer?.replace(/-/g, ' '),
              size,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {badges.length > 0 || checkSize ? (
          <ul className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <li
                key={b.text}
                className={`chip ${b.tone === 'sage' ? 'chip-sage' : b.tone === 'clay' ? 'chip-clay' : ''}`}
              >
                {b.text}
              </li>
            ))}
            {checkSize ? <li className="chip chip-clay">Check the size</li> : null}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-semibold">{formatPrice(item.pricePence)}</span>
          {buyHref && item.inStock ? (
            <a
              href={buyHref}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="btn btn-primary btn-sm"
            >
              Buy
              <span className="sr-only"> {item.title} (opens the retailer, affiliate link)</span>
            </a>
          ) : null}
        </div>
        {children}
      </div>
    </article>
  );
}
