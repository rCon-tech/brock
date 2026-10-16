import { z } from 'zod';
import { manifestSchema } from '../sdk/manifest-schema';
import type { ModuleManifest } from '../sdk/types';

/**
 * The Module Definition Language: a module as plain JSON. No HTML, no JavaScript, no expressions.
 * Everything here is data the platform validates and renders itself, which is what makes it safe
 * to accept from a chatbot. See docs/writing-a-module.md.
 */

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/);
const literal = z.union([z.string().max(200), z.number(), z.boolean()]);

export const filterSchema = z.object({
  field: name,
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
  value: literal,
});
export type Filter = z.infer<typeof filterSchema>;

/** What to show for one field of a record inside a list. */
const cellSchema = z.object({
  field: name,
  as: z
    .enum(['title', 'text', 'muted', 'badge', 'link', 'toggle', 'image', 'money', 'date'])
    .default('text'),
});
export type Cell = z.infer<typeof cellSchema>;

export type ViewNode =
  | { type: 'stack'; children: ViewNode[] }
  | { type: 'text'; text: string; style?: 'title' | 'muted' | 'body' }
  | { type: 'form'; collection: string; title?: string; submitLabel?: string; fields?: string[] }
  | {
      type: 'list';
      collection: string;
      order?: string;
      filter?: Filter;
      empty?: string;
      cells: Cell[];
    }
  | { type: 'tabs'; tabs: Array<{ label: string; view: ViewNode }> }
  | { type: 'counter'; collection: string; filter?: Filter; label: string }
  | { type: 'image-grid'; collection: string; field: string };

const MAX_DEPTH = 4;

export const viewSchema: z.ZodType<ViewNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('stack'), children: z.array(viewSchema).min(1).max(12) }),
    z.object({
      type: z.literal('text'),
      text: z.string().max(500),
      style: z.enum(['title', 'muted', 'body']).optional(),
    }),
    z.object({
      type: z.literal('form'),
      collection: name,
      title: z.string().max(80).optional(),
      submitLabel: z.string().max(30).optional(),
      fields: z.array(name).max(20).optional(),
    }),
    z.object({
      type: z.literal('list'),
      collection: name,
      order: z.string().max(60).optional(),
      filter: filterSchema.optional(),
      empty: z.string().max(200).optional(),
      cells: z.array(cellSchema).min(1).max(8),
    }),
    z.object({
      type: z.literal('tabs'),
      tabs: z
        .array(z.object({ label: z.string().min(1).max(30), view: viewSchema }))
        .min(1)
        .max(6),
    }),
    z.object({
      type: z.literal('counter'),
      collection: name,
      filter: filterSchema.optional(),
      label: z.string().max(60),
    }),
    z.object({ type: z.literal('image-grid'), collection: name, field: name }),
  ]),
) as z.ZodType<ViewNode>;

export const mdlSchema = z
  .object({ manifest: manifestSchema, views: z.object({ main: viewSchema }) })
  .superRefine((m, ctx) => {
    const manifest = m.manifest as ModuleManifest;
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path: ['views', ...path], message });

    const check = (node: ViewNode, path: (string | number)[], depth: number) => {
      if (depth > MAX_DEPTH) return issue(path, `Views can nest at most ${MAX_DEPTH} levels deep`);
      const col = (c: string) => {
        const def = manifest.collections[c];
        if (!def) issue([...path, 'collection'], `Unknown collection "${c}"`);
        return def;
      };
      const field = (
        def: ModuleManifest['collections'][string] | undefined,
        f: string,
        where: (string | number)[],
      ) => {
        const spec = def?.fields[f];
        if (def && !spec) issue(where, `"${f}" is not a field of this collection`);
        return spec;
      };
      const filter = (def: ReturnType<typeof col>, f: Filter | undefined) => {
        if (!f) return;
        const spec = field(def, f.field, [...path, 'filter', 'field']);
        if (
          spec &&
          (spec.type === 'money' || spec.type.endsWith('list') || spec.type === 'media')
        ) {
          issue([...path, 'filter', 'field'], `Cannot filter on a "${spec.type}" field`);
        }
      };
      switch (node.type) {
        case 'stack':
          node.children.forEach((c, i) => check(c, [...path, 'children', i], depth + 1));
          break;
        case 'tabs':
          node.tabs.forEach((t, i) => check(t.view, [...path, 'tabs', i, 'view'], depth + 1));
          break;
        case 'form': {
          const def = col(node.collection);
          if (def?.parent)
            issue([...path, 'collection'], 'Forms can only create top-level records');
          for (const [i, f] of (node.fields ?? []).entries()) field(def, f, [...path, 'fields', i]);
          break;
        }
        case 'list': {
          const def = col(node.collection);
          filter(def, node.filter);
          for (const [i, c] of node.cells.entries()) {
            const spec = field(def, c.field, [...path, 'cells', i, 'field']);
            if (spec && c.as === 'toggle' && spec.type !== 'boolean')
              issue([...path, 'cells', i, 'as'], 'toggle needs a yes/no field');
            if (spec && c.as === 'image' && spec.type !== 'media')
              issue([...path, 'cells', i, 'as'], 'image needs a photo field');
            if (spec && c.as === 'money' && spec.type !== 'money')
              issue([...path, 'cells', i, 'as'], 'money needs a money field');
            if (spec && c.as === 'link' && spec.type !== 'url')
              issue([...path, 'cells', i, 'as'], 'link needs a link field');
          }
          break;
        }
        case 'counter':
          filter(col(node.collection), node.filter);
          break;
        case 'image-grid': {
          const def = col(node.collection);
          const spec = field(def, node.field, [...path, 'field']);
          if (spec && spec.type !== 'media' && spec.type !== 'media-list')
            issue([...path, 'field'], 'image-grid needs a photo field');
          break;
        }
      }
    };
    check(m.views.main, ['main'], 1);
  });

export type MdlModule = { manifest: ModuleManifest; views: { main: ViewNode } };

/** Parse an MDL document, throwing an error that names the bad path (it is also what the AI builder is told). */
export function parseMdl(input: unknown): MdlModule {
  const r = mdlSchema.safeParse(input);
  if (!r.success) {
    throw new Error(
      `Invalid module: ${r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`,
    );
  }
  return r.data as unknown as MdlModule;
}
