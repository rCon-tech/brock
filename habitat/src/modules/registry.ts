import type { ModuleManifest } from './sdk/types';
import { parseManifest } from './sdk/manifest-schema';
import { manifest as feed } from './feed/manifest';
import { manifest as photos } from './photos/manifest';
import { manifest as events } from './events/manifest';
import { manifest as chat } from './chat/manifest';
import { manifest as polls } from './polls/manifest';
import { manifest as birthdays } from './birthdays/manifest';
import { manifest as recommendations } from './recommendations/manifest';
import { manifest as wishlist } from './wishlist/manifest';
import { manifest as splitCosts } from './split-costs/manifest';
import { loadMdl } from './declarative/load';
import bucketListDoc from './bucket-list/module.json';

/** Server-safe: manifests only, no React. The UI registry lives in `ui-registry.ts`. */
const BUILT_IN: unknown[] = [
  feed,
  photos,
  events,
  chat,
  polls,
  birthdays,
  recommendations,
  wishlist,
  splitCosts,
  loadMdl(bucketListDoc).manifest,
];

const byId = new Map<string, ModuleManifest>();
for (const m of BUILT_IN) {
  const parsed = parseManifest(m); // fail at boot, naming the bad path, if a manifest is wrong
  byId.set(parsed.id, parsed);
}

export function getManifest(id: string): ModuleManifest | undefined {
  return byId.get(id);
}

/** Every module a Habitat can choose from, defaults first. */
export function listLibrary(): ModuleManifest[] {
  return [...byId.values()].sort(
    (a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || a.name.localeCompare(b.name),
  );
}

export function defaultModuleIds(): string[] {
  return listLibrary()
    .filter((m) => m.isDefault)
    .map((m) => m.id);
}
