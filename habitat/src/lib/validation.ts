import { z } from 'zod';
import { REACTIONS } from '@/db/schema';

export const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb colour');
const emoji = z.string().trim().min(1).max(16);
const uuid = z.string().uuid();

export const CreateHabitatBody = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(60),
  emoji: emoji.default('🌿'),
  accent: hexColour.default('#e8590c'),
  modules: z.array(z.string().max(40)).max(20).optional(),
});

export const UpdateHabitatBody = z
  .object({
    name: z.string().trim().min(2).max(60),
    emoji,
    accent: hexColour,
    description: z.string().trim().max(300).nullable(),
    membersCanInvite: z.boolean(),
    memberCap: z.number().int().min(2).max(150),
    voteWindowHours: z.number().int().min(1).max(168),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to change');

export const TransferBody = z.object({ userId: z.string().min(1) });

export const MemberPatchBody = z
  .object({ role: z.enum(['admin', 'member']), nickname: z.string().trim().max(40).nullable() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to change');

export const CreateInviteBody = z.object({
  expiresInDays: z.number().int().min(1).max(30).default(7),
  maxUses: z.number().int().min(1).max(150).nullable().default(null),
  /** Optionally email the link to this address. */
  email: z.string().trim().toLowerCase().email().max(200).optional(),
});

export const ProposeBody = z.object({
  kind: z.enum(['install', 'uninstall', 'settings', 'governance']),
  moduleId: z.string().max(60).optional(),
  reason: z.string().trim().max(500).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const VoteBody = z.object({ vote: z.enum(['yes', 'no']) });

export const ModuleOrderBody = z.object({ order: z.array(z.string().max(60)).max(50) });

export const RecordCreateBody = z.object({
  module: z.string().min(1).max(60),
  collection: z.string().min(1).max(40),
  parentId: uuid.nullish(),
  data: z.record(z.string(), z.unknown()),
});

export const RecordPatchBody = z.object({ data: z.record(z.string(), z.unknown()) });

export const RecordQuery = z.object({
  module: z.string().min(1).max(60),
  collection: z.string().min(1).max(40),
  parentId: z.string().optional(),
  authorId: z.string().optional(),
  pinned: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  order: z.string().max(60).optional(),
  limit: z.coerce.number().int().optional(),
  cursor: z.string().max(500).optional(),
});

/** `where[field][op]=value` pairs from the query string. */
export function whereFromUrl(url: URL): Record<string, Record<string, string>> {
  const where: Record<string, Record<string, string>> = {};
  for (const [k, v] of url.searchParams) {
    const m = /^where\[([a-zA-Z0-9]{1,40})\]\[([a-z]{2,3})\]$/.exec(k);
    if (m) (where[m[1]!] ??= {})[m[2]!] = v;
  }
  return where;
}

export const CommentBody = z.object({
  body: z.string(),
  parentCommentId: uuid.nullish(),
});
export const CommentPatchBody = z.object({ body: z.string() });

export const ReactionBody = z.object({ emoji: z.enum(REACTIONS) });

export const ReportBody = z.object({
  targetType: z.enum(['record', 'comment', 'member']),
  targetId: z.string().min(1).max(64),
  reason: z.string().max(1000),
});

export const UploadBody = z.object({
  files: z
    .array(
      z.object({
        mime: z.string().max(40),
        bytes: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
      }),
    )
    .min(1)
    .max(10),
});

export const MePatchBody = z
  .object({
    name: z.string().trim().min(1).max(60),
    image: z.string().url().max(500).nullable(),
    onboarded: z.literal(true),
    emailPrefs: z.object({ digest: z.boolean(), events: z.boolean(), proposals: z.boolean() }),
  })
  .partial();

export const MarkReadBody = z.object({ ids: z.union([z.literal('all'), z.array(uuid).max(100)]) });

export const MediaQuery = z.object({ v: z.enum(['thumb', 'full']).default('thumb') });
