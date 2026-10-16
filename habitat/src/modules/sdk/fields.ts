import { z } from 'zod';
import type { Field, FieldSpec } from './types';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoDateTime = z
  .string()
  .refine(
    (s) => !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s),
    'Expected an ISO date-time',
  )
  .transform((s) => new Date(s).toISOString());

const money = z.object({
  amountMinor: z.number().int().min(0).max(1_000_000_000_00),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

/** Compile one field to a Zod type. Optional unless the field says `required`. */
export function compileField(field: Field): z.ZodType {
  let base: z.ZodType;
  let required = false;
  switch (field.type) {
    case 'text':
      base = z
        .string()
        .trim()
        .min(field.required ? 1 : 0)
        .max(field.max);
      required = !!field.required;
      break;
    case 'longtext':
      base = z
        .string()
        .trim()
        .min(field.required ? 1 : 0)
        .max(field.max);
      required = !!field.required;
      break;
    case 'integer':
    case 'number': {
      let n = field.type === 'integer' ? z.number().int() : z.number().finite();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      base = n;
      required = !!field.required;
      break;
    }
    case 'boolean':
      return z.boolean().default(field.default ?? false);
    case 'date':
      base = isoDate;
      required = !!field.required;
      break;
    case 'datetime':
      base = isoDateTime;
      required = !!field.required;
      break;
    case 'enum':
      base = z.enum(field.options as [string, ...string[]]);
      required = !!field.required;
      break;
    case 'url':
      base = z
        .string()
        .trim()
        .max(2000)
        .refine((s) => {
          try {
            const u = new URL(s);
            return u.protocol === 'http:' || u.protocol === 'https:';
          } catch {
            return false;
          }
        }, 'Expected an http(s) URL');
      required = !!field.required;
      break;
    case 'media':
      base = uuid;
      required = !!field.required;
      break;
    case 'media-list':
      return z.array(uuid).max(field.max).default([]);
    case 'member':
      base = uuid;
      required = !!field.required;
      break;
    case 'member-list':
      return field.min
        ? z
            .array(uuid)
            .min(field.min)
            .max(field.max ?? 150)
        : z
            .array(uuid)
            .max(field.max ?? 150)
            .default([]);
    case 'text-list': {
      const list = z.array(z.string().trim().min(1).max(field.maxLength)).max(field.maxItems);
      return field.minItems ? list.min(field.minItems) : list.default([]);
    }
    case 'money':
      base = money;
      required = !!field.required;
      break;
  }
  return required ? base : base.optional();
}

/** Compile a field spec to a Zod object. Unknown keys are stripped. */
export function compileFields(spec: FieldSpec): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, field] of Object.entries(spec)) shape[name] = compileField(field);
  return z.object(shape);
}

/** Field names whose values are ids that must belong to the current Habitat. */
export function referenceFields(spec: FieldSpec): {
  media: string[];
  members: string[];
} {
  const media: string[] = [];
  const members: string[] = [];
  for (const [name, f] of Object.entries(spec)) {
    if (f.type === 'media' || f.type === 'media-list') media.push(name);
    if (f.type === 'member' || f.type === 'member-list') members.push(name);
  }
  return { media, members };
}
