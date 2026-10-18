import { getDb } from '@/db';
import { seedCatalogue } from '@/lib/seed/load';
import { run } from './args';

// A synthetic catalogue for development: no API keys, no network.
run(async () => {
  const db = await getDb();
  const n = await seedCatalogue(db, { microPerCategoryPerStyle: 2 });
  console.log(`Seeded ${n} synthetic items.`);
});
