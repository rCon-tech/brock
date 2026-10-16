import { created, habitatRoute, parseBody, parseQuery } from '@/lib/api';
import { createRecord, queryRecords } from '@/lib/records';
import { RecordCreateBody, RecordQuery, whereFromUrl } from '@/lib/validation';

type P = { habitatId: string };

/** `?module=events&collection=event&where[startsAt][gte]=…&order=startsAt:asc&limit=20&cursor=…` */
export const GET = habitatRoute<P>(async ({ url, member }) => {
  const q = parseQuery(url, RecordQuery);
  return queryRecords(member, { ...q, where: whereFromUrl(url) });
});

export const POST = habitatRoute<P>(async ({ req, member }) =>
  created({ record: await createRecord(member, await parseBody(req, RecordCreateBody)) }),
);
