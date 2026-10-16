import { z } from 'zod';
import type { ModuleManifest } from './types';

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, 'Field names are letters and digits');
const bool = z.boolean().optional();

export const fieldSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), max: z.number().int().min(1).max(2000), required: bool }),
  z.object({
    type: z.literal('longtext'),
    max: z.number().int().min(1).max(10000),
    required: bool,
  }),
  z.object({
    type: z.enum(['integer', 'number']),
    min: z.number().optional(),
    max: z.number().optional(),
    required: bool,
  }),
  z.object({ type: z.literal('boolean'), default: bool }),
  z.object({ type: z.enum(['date', 'datetime']), required: bool }),
  z.object({
    type: z.literal('enum'),
    options: z.array(z.string().min(1).max(40)).min(1).max(30),
    required: bool,
  }),
  z.object({ type: z.literal('url'), required: bool }),
  z.object({ type: z.literal('media'), required: bool }),
  z.object({ type: z.literal('media-list'), max: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal('member'), required: bool }),
  z.object({
    type: z.literal('member-list'),
    min: z.number().int().min(1).max(150).optional(),
    max: z.number().int().min(1).max(150).optional(),
  }),
  z.object({
    type: z.literal('text-list'),
    minItems: z.number().int().min(1).max(50).optional(),
    maxItems: z.number().int().min(1).max(50),
    maxLength: z.number().int().min(1).max(500),
  }),
  z.object({ type: z.literal('money'), required: bool }),
]);

export const fieldSpecSchema = z.record(name, fieldSchema);

const collectionSchema = z.object({
  fields: fieldSpecSchema,
  parent: z.string().optional(),
  atLeastOne: z.array(name).min(1).optional(),
  lockedAfterParentField: name.optional(),
  unique: z.enum(['per-member', 'per-parent', 'per-member-per-parent']).optional(),
  showInTimeline: bool,
  realtime: bool,
  permissions: z
    .object({
      create: z.enum(['member', 'admin']).optional(),
      update: z.enum(['author', 'admin', 'author-or-admin', 'member']).optional(),
      delete: z.enum(['author', 'admin', 'author-or-admin', 'member']).optional(),
      hiddenFrom: z.literal('parent-author').optional(),
    })
    .optional(),
  notify: z
    .array(
      z.object({
        on: z.literal('create'),
        to: z.enum(['all-members', 'parent-author', 'mentioned']),
        text: z.string().min(1).max(200),
      }),
    )
    .optional(),
  limits: z
    .object({
      perMemberPerDay: z.number().int().min(1).optional(),
      maxPerHabitat: z.number().int().min(1).optional(),
    })
    .optional(),
});

export const manifestSchema = z
  .object({
    id: z.string().regex(/^(custom:[0-9a-f-]{36}|[a-z][a-z0-9-]{1,38})$/),
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    icon: z.string().regex(/^[a-z0-9-]{1,40}$/),
    category: z.enum(['social', 'plans', 'fun', 'practical']),
    version: z.number().int().min(1),
    isDefault: bool,
    collections: z.record(name, collectionSchema).refine((c) => Object.keys(c).length >= 1, {
      message: 'A module needs at least one collection',
    }),
    settings: fieldSpecSchema.optional(),
    nav: z
      .union([z.literal(false), z.object({ label: z.string().min(1).max(30), order: z.number() })])
      .optional(),
  })
  .superRefine((m, ctx) => {
    for (const [cname, c] of Object.entries(m.collections)) {
      if (c.parent && !(c.parent in m.collections)) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', cname, 'parent'],
          message: `Parent collection "${c.parent}" does not exist`,
        });
      }
      if (c.lockedAfterParentField) {
        const parent = c.parent ? m.collections[c.parent] : undefined;
        if (parent?.fields[c.lockedAfterParentField]?.type !== 'datetime') {
          ctx.addIssue({
            code: 'custom',
            path: ['collections', cname, 'lockedAfterParentField'],
            message: 'Must name a datetime field on the parent collection',
          });
        }
      }
      for (const f of c.atLeastOne ?? []) {
        if (!(f in c.fields)) {
          ctx.addIssue({
            code: 'custom',
            path: ['collections', cname, 'atLeastOne'],
            message: `"${f}" is not a field of this collection`,
          });
        }
      }
      if (c.parent === cname) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', cname, 'parent'],
          message: 'A collection cannot be its own parent',
        });
      }
      if (c.unique && c.unique !== 'per-member' && !c.parent) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', cname, 'unique'],
          message: `"${c.unique}" needs a parent collection`,
        });
      }
      if (c.permissions?.hiddenFrom && !c.parent) {
        ctx.addIssue({
          code: 'custom',
          path: ['collections', cname, 'permissions', 'hiddenFrom'],
          message: 'hiddenFrom needs a parent collection',
        });
      }
      for (const [i, n] of (c.notify ?? []).entries()) {
        if (n.to === 'parent-author' && !c.parent) {
          ctx.addIssue({
            code: 'custom',
            path: ['collections', cname, 'notify', i, 'to'],
            message: 'parent-author needs a parent collection',
          });
        }
      }
    }
  });

/** Parse a manifest, throwing a readable error that names the bad path. */
export function parseManifest(input: unknown): ModuleManifest {
  const r = manifestSchema.safeParse(input);
  if (!r.success) {
    const msg = r.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid module manifest: ${msg}`);
  }
  return r.data as ModuleManifest;
}
