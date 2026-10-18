import Anthropic from '@anthropic-ai/sdk';
import { and, asc, isNull, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { catalogueItem } from '@/db/schema';
import { applyTags, parseTagResponse, tagRequest } from '@/lib/ai/tag-item';
import { args, need, run } from './args';

// pnpm catalogue:tag [--limit 500]
// Tags untagged items with Claude through the Message Batches API (half price, asynchronous).
run(async () => {
  need('ANTHROPIC_API_KEY');
  const limit = Number(args().limit ?? 500);
  const db = await getDb();
  const items = await db
    .select()
    .from(catalogueItem)
    .where(and(isNull(catalogueItem.taggedAt), ne(catalogueItem.status, 'retired')))
    .orderBy(asc(catalogueItem.createdAt))
    .limit(limit);
  if (items.length === 0) return console.log('Nothing to tag.');

  const client = new Anthropic();
  const batch = await client.messages.batches.create({ requests: items.map(tagRequest) });
  console.log(`Batch ${batch.id} submitted with ${items.length} items. Waiting…`);

  let status = batch.processing_status;
  while (status !== 'ended') {
    await new Promise((r) => setTimeout(r, 30_000));
    status = (await client.messages.batches.retrieve(batch.id)).processing_status;
    console.log(`  ${status}`);
  }

  const tally = { tagged: 0, retired: 0, unusable: 0, failed: 0 };
  for await (const entry of await client.messages.batches.results(batch.id)) {
    if (entry.result.type !== 'succeeded') {
      tally.failed++;
      continue;
    }
    const block = entry.result.message.content.find((b) => b.type === 'text');
    const tags = block && 'text' in block ? parseTagResponse(block.text) : null;
    if (!tags) {
      tally.unusable++;
      continue;
    }
    tally[await applyTags(db, entry.custom_id, tags)]++;
  }
  console.log(tally);
});
