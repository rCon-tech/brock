import type { CollectionDef, HabitatModule, ModuleManifest } from './types';

/** Identity helpers: they exist so manifests are type-checked where they are written. */
export function defineCollection<T extends CollectionDef>(def: T): T {
  return def;
}

export function defineModule<T extends HabitatModule>(mod: T): T {
  return mod;
}

export function defineManifest<T extends ModuleManifest>(manifest: T): T {
  return manifest;
}
