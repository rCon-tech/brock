import type { ComponentType } from 'react';

export type Field =
  | { type: 'text'; max: number; required?: boolean }
  | { type: 'longtext'; max: number; required?: boolean }
  | { type: 'integer' | 'number'; min?: number; max?: number; required?: boolean }
  | { type: 'boolean'; default?: boolean }
  | { type: 'date' | 'datetime'; required?: boolean }
  | { type: 'enum'; options: string[]; required?: boolean }
  | { type: 'url'; required?: boolean }
  | { type: 'media'; required?: boolean }
  | { type: 'media-list'; max: number }
  | { type: 'member'; required?: boolean }
  | { type: 'member-list'; max?: number }
  | { type: 'text-list'; maxItems: number; maxLength: number }
  | { type: 'money'; required?: boolean };

export type FieldSpec = Record<string, Field>;

export type WriteScope = 'member' | 'admin';
export type OwnerScope = 'author' | 'admin' | 'author-or-admin';

export interface CollectionDef {
  fields: FieldSpec;
  /** The collection this one hangs off, e.g. `rsvp.parent = 'event'` (same module). */
  parent?: string;
  unique?: 'per-member' | 'per-parent' | 'per-member-per-parent';
  showInTimeline?: boolean;
  realtime?: boolean;
  permissions?: {
    create?: WriteScope;
    update?: OwnerScope;
    delete?: OwnerScope;
    /** Hide these records from the author of the parent record (wishlist claims). */
    hiddenFrom?: 'parent-author';
  };
  notify?: Array<{
    on: 'create';
    to: 'all-members' | 'parent-author' | 'mentioned';
    text: string;
  }>;
  limits?: { perMemberPerDay?: number; maxPerHabitat?: number };
}

export type ModuleCategory = 'social' | 'plans' | 'fun' | 'practical';

export interface ModuleManifest {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  category: ModuleCategory;
  version: number;
  isDefault?: boolean;
  collections: Record<string, CollectionDef>;
  settings?: FieldSpec;
  nav?: { label: string; order: number } | false;
}

export interface MemberDTO {
  id: string;
  name: string;
  image: string | null;
  nickname: string | null;
}

export interface RecordDTO {
  id: string;
  module: string;
  collection: string;
  parentId: string | null;
  author: MemberDTO | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  reactionCounts: Record<string, number>;
  myReactions: string[];
  commentCount: number;
}

export interface PageProps {
  path: string[];
}

export interface FeedCardProps {
  record: RecordDTO;
}

export interface HabitatModule {
  manifest: ModuleManifest;
  Page?: ComponentType<PageProps>;
  FeedCard?: ComponentType<FeedCardProps>;
  Widget?: ComponentType;
}
