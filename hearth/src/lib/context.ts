import { z } from 'zod';
import { ATTRIBUTE_FAMILIES, CATEGORIES } from '@/lib/taxonomy';

/** Room context (R14–R16): what's staying, who lives there, tight spaces. */
export const projectContextSchema = z.object({
  keeping: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        colour: z.enum(ATTRIBUTE_FAMILIES.colour).optional(),
        material: z.enum(ATTRIBUTE_FAMILIES.material).optional(),
      }),
    )
    .max(10)
    .default([]),
  household: z
    .object({
      dog: z.boolean().default(false),
      cat: z.boolean().default(false),
      youngKids: z.boolean().default(false),
    })
    .default({ dog: false, cat: false, youngKids: false }),
  maxSize: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        widthCm: z.number().int().positive().max(1000).optional(),
        depthCm: z.number().int().positive().max(1000).optional(),
      }),
    )
    .max(10)
    .default([]),
  hidePracticalRisks: z.boolean().default(false),
});
export type ProjectContext = z.infer<typeof projectContextSchema>;

export const EMPTY_CONTEXT: ProjectContext = {
  keeping: [],
  household: { dog: false, cat: false, youngKids: false },
  maxSize: [],
  hidePracticalRisks: false,
};
