'use client';

import { RichText } from '@/components/RichText';
import { getModule } from '@/modules/ui-registry';
import type { RecordDTO } from '@/modules/sdk/types';

/** Render a record through its module's FeedCard, or a plain fallback for modules without one. */
export function CardFor({ record }: { record: RecordDTO }) {
  const Card = getModule(record.module)?.FeedCard;
  if (Card) return <Card record={record} />;
  const text = Object.values(record.data).find((v) => typeof v === 'string') as string | undefined;
  return text ? <RichText text={text} /> : null;
}
