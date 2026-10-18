import type { ProjectContext } from '@/lib/context';
import { CATEGORY_LABELS, type Category } from '@/lib/taxonomy';
import { harmonyScore } from './harmony';
import { householdRiskScore, householdRisks } from './household';
import { meanAffinity, type Profile } from './profile';
import type { EngineItem, Pick } from './types';
import { cosine, dot, mean } from './vector';

export const PICK_COUNT = 12;
export const SWAP_QUEUE_SIZE = 10;
const MAX_PER_CATEGORY = 2;
const MMR_LAMBDA = 0.7;
const AFFINITY_WEIGHT = 0.3;

export interface CompromiseInput {
  /** Already filtered for stock, budget, size and kept categories. */
  candidates: EngineItem[];
  profiles: Profile[];
  /** Vetoed items, items anyone swiped left on, swapped-out items. */
  excludeItemIds: Set<string>;
  vetoedAttributes: Set<string>;
  context: ProjectContext;
  /** Smoothed "works for couples" signal from item_stats, around 0. */
  statsBoost?: Map<string, number>;
  /** What each person brings (R21): a pick carrying it is guaranteed. */
  brings: Record<string, string | null>;
  count?: number;
}

export interface CompromiseResult {
  picks: Pick[];
  swapQueue: Record<string, string[]>;
}

/** How well item `i` suits person `p`. Never shown to users (R20). */
export function fitFor(p: Profile, item: EngineItem): number {
  const cos = p.taste ? cosine(item.embedding, p.taste) : 0;
  return cos + AFFINITY_WEIGHT * meanAffinity(p, item.attributes);
}

function anchorLabel(context: ProjectContext, item: EngineItem): string | null {
  for (const kept of context.keeping) {
    const anchors = [
      kept.colour ? `colour:${kept.colour}` : null,
      kept.material ? `material:${kept.material}` : null,
    ].filter((a): a is string => !!a);
    if (anchors.some((a) => harmonyScore(a, item.attributes) > 0)) {
      const noun = CATEGORY_LABELS[kept.category as Category]?.toLowerCase() ?? kept.category;
      return `${kept.colour ? `${kept.colour} ` : ''}${noun}`;
    }
  }
  return null;
}

/** Builds a pick record for an item chosen outside the main selection, e.g. a swap (R28). */
export function describePick(item: EngineItem, profiles: Profile[], context: ProjectContext): Pick {
  const fit: Record<string, number> = {};
  for (const p of profiles) fit[p.personId] = fitFor(p, item);
  return {
    itemId: item.id,
    category: item.category!,
    goesWith: anchorLabel(context, item),
    householdRisks: householdRisks(context.household, item.attributes),
    fit,
  };
}

/**
 * Picks products that work for everyone (maximin), then balances them so total satisfaction stays
 * even between people instead of one person's favourites dominating. Diversity comes from MMR and
 * a per-category cap.
 */
export function chooseCompromise(input: CompromiseInput): CompromiseResult {
  const { profiles, context } = input;
  const count = input.count ?? PICK_COUNT;

  const pool = input.candidates.filter((c) => {
    if (input.excludeItemIds.has(c.id)) return false;
    if (c.attributes.some((a) => input.vetoedAttributes.has(a))) return false;
    if (context.hidePracticalRisks && householdRiskScore(context.household, c.attributes) > 0) {
      return false;
    }
    return true;
  });

  const fit = new Map<string, Record<string, number>>();
  const base = new Map<string, number>();
  const goesWith = new Map<string, string | null>();
  for (const item of pool) {
    const f: Record<string, number> = {};
    for (const p of profiles) f[p.personId] = fitFor(p, item);
    fit.set(item.id, f);
    const anchor = anchorLabel(context, item);
    goesWith.set(item.id, anchor);
    const worst = profiles.length ? Math.min(...Object.values(f)) : 0;
    base.set(
      item.id,
      worst +
        0.1 * (anchor ? 1 : 0) -
        0.15 * householdRiskScore(context.household, item.attributes) +
        0.15 * (input.statsBoost?.get(item.id) ?? 0),
    );
  }

  const picks: Pick[] = [];
  const chosen: EngineItem[] = [];
  const perCategory = new Map<string, number>();
  const cumulative: Record<string, number> = Object.fromEntries(
    profiles.map((p) => [p.personId, 0]),
  );

  const take = (item: EngineItem, reservedFor?: string) => {
    chosen.push(item);
    perCategory.set(item.category!, (perCategory.get(item.category!) ?? 0) + 1);
    for (const p of profiles) cumulative[p.personId] += fit.get(item.id)![p.personId];
    picks.push({
      itemId: item.id,
      category: item.category!,
      goesWith: goesWith.get(item.id) ?? null,
      householdRisks: householdRisks(context.household, item.attributes),
      fit: fit.get(item.id)!,
      ...(reservedFor ? { reservedFor } : {}),
    });
  };
  const hasRoom = (item: EngineItem) =>
    !chosen.includes(item) && (perCategory.get(item.category!) ?? 0) < MAX_PER_CATEGORY;

  // Reserve a pick carrying what each person brings, so everyone sees something of theirs.
  for (const p of profiles) {
    const attr = input.brings[p.personId];
    if (!attr || chosen.some((c) => c.attributes.includes(attr))) continue;
    const best = pool
      .filter((i) => hasRoom(i) && i.attributes.includes(attr))
      .sort((a, b) => base.get(b.id)! - base.get(a.id)! || a.id.localeCompare(b.id))[0];
    if (best) take(best, p.personId);
  }

  while (picks.length < count) {
    const k = picks.length;
    let best: { item: EngineItem; score: number } | null = null;
    for (const item of pool) {
      if (!hasRoom(item)) continue;
      const f = fit.get(item.id)!;
      const balance = profiles.length
        ? Math.min(...profiles.map((p) => (cumulative[p.personId] + f[p.personId]) / (k + 1)))
        : 0;
      const relevance = base.get(item.id)! + balance;
      const maxSim = chosen.length
        ? Math.max(...chosen.map((c) => dot(c.embedding, item.embedding)))
        : 0;
      const score = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;
      if (!best || score > best.score || (score === best.score && item.id < best.item.id)) {
        best = { item, score };
      }
    }
    if (!best) break;
    take(best.item);
  }

  // "Show me another" candidates: the best remaining items per category (R28).
  const taken = new Set(chosen.map((c) => c.id));
  const byCategory = new Map<string, EngineItem[]>();
  for (const item of pool) {
    if (taken.has(item.id)) continue;
    byCategory.set(item.category!, [...(byCategory.get(item.category!) ?? []), item]);
  }
  const swapQueue: Record<string, string[]> = {};
  for (const [category, items] of byCategory) {
    swapQueue[category] = items
      .sort((a, b) => base.get(b.id)! - base.get(a.id)! || a.id.localeCompare(b.id))
      .slice(0, SWAP_QUEUE_SIZE)
      .map((i) => i.id);
  }

  return { picks, swapQueue };
}

/** Mean fit per person across a set of picks. Used by tests to check the board is balanced. */
export function meanFitPerPerson(picks: Pick[]): Record<string, number> {
  const ids = picks.length ? Object.keys(picks[0].fit) : [];
  return Object.fromEntries(ids.map((id) => [id, mean(picks.map((p) => p.fit[id]))]));
}

/** The best photos for everyone, by the same maximin rule (hybrid rooms). */
export function chooseHybridRooms(
  photos: EngineItem[],
  profiles: Profile[],
  excludeItemIds: Set<string>,
  vetoedAttributes: Set<string>,
  n = 4,
): string[] {
  return photos
    .filter((p) => !excludeItemIds.has(p.id) && !p.attributes.some((a) => vetoedAttributes.has(a)))
    .map((p) => ({
      id: p.id,
      score: profiles.length ? Math.min(...profiles.map((pr) => fitFor(pr, p))) : 0,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((x) => x.id);
}
