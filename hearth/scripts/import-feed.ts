import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { getDb } from '@/db';
import { parseFeed } from '@/lib/catalogue/feeds';
import { retireMissing, upsertFeedItems } from '@/lib/catalogue/upsert';
import { args, run } from './args';

async function load(source: string): Promise<string> {
  const bytes = /^https?:\/\//.test(source)
    ? Buffer.from(await (await fetch(source)).arrayBuffer())
    : readFileSync(source);
  // Awin serves gzipped CSV.
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8');
}

// pnpm catalogue:feed --merchant dunelm --name Dunelm --source https://… (or a local .csv)
// Or set AWIN_FEED_URLS="dunelm=https://…,ikea=https://…" and pass --all.
run(async () => {
  const a = args();
  const feeds: { id: string; name: string; source: string }[] = [];
  if (a.all) {
    for (const pair of (process.env.AWIN_FEED_URLS ?? '').split(',').filter(Boolean)) {
      const [id, ...rest] = pair.split('=');
      feeds.push({ id, name: id, source: rest.join('=') });
    }
  } else if (typeof a.merchant === 'string' && typeof a.source === 'string') {
    feeds.push({
      id: a.merchant,
      name: typeof a.name === 'string' ? a.name : a.merchant,
      source: a.source,
    });
  }
  if (feeds.length === 0) {
    console.error(
      'Usage: --merchant <id> [--name <name>] --source <url|file>, or --all with AWIN_FEED_URLS.',
    );
    process.exit(1);
  }
  const db = await getDb();
  for (const feed of feeds) {
    const { items, skipped } = parseFeed(await load(feed.source));
    const { created, updated } = await upsertFeedItems(db, feed, items);
    const retired = await retireMissing(
      db,
      feed.id,
      items.map((i) => i.sourceId),
    );
    console.log(
      `${feed.id}: ${created} new drafts, ${updated} refreshed, ${retired} retired.`,
      skipped,
    );
  }
});
