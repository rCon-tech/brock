'use client';

import { format } from 'date-fns';
import { MediaImage } from '@/components/MediaImage';
import { Badge } from '@/components/ui/card';
import { RichText } from '@/components/RichText';
import { formatMoney } from '../../split-costs/settle';
import type { Cell } from '../mdl-schema';

/** One field of one record, shown the way the module's definition asks. Always plain text or links, never HTML. */
export function FieldText({ cell, value }: { cell: Cell; value: unknown }) {
  if (value === undefined || value === null || value === '') return null;
  switch (cell.as) {
    case 'title':
      return <div className="font-semibold">{String(value)}</div>;
    case 'muted':
      return <RichText text={String(value)} className="text-sm text-ink-soft" />;
    case 'badge':
      return <Badge>{String(value)}</Badge>;
    case 'link':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-accent underline underline-offset-2"
        >
          {String(value)}
        </a>
      );
    case 'image':
      return <MediaImage id={String(value)} alt="" className="h-24 w-24 rounded-xl" />;
    case 'money': {
      const m = value as { amountMinor: number; currency: string };
      return <span className="font-semibold">{formatMoney(m.amountMinor, m.currency)}</span>;
    }
    case 'date':
      return <span className="text-sm">{format(new Date(String(value)), 'd MMM yyyy')}</span>;
    default:
      return <RichText text={String(value)} />;
  }
}
