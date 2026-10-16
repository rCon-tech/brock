import type { HabitatModule } from './sdk/types';
import feed from './feed';
import photos from './photos';
import events from './events';
import chat from './chat';
import polls from './polls';
import birthdays from './birthdays';
import recommendations from './recommendations';
import wishlist from './wishlist';
import splitCosts from './split-costs';
import bucketList from './bucket-list';

/** The client-side registry: manifests plus their React components. Server code uses `registry.ts`. */
const MODULES: HabitatModule[] = [
  feed,
  photos,
  events,
  chat,
  polls,
  birthdays,
  recommendations,
  wishlist,
  splitCosts,
  bucketList,
];
const byId = new Map(MODULES.map((m) => [m.manifest.id, m]));

export function getModule(id: string): HabitatModule | undefined {
  return byId.get(id);
}
