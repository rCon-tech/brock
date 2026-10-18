import { sql } from 'drizzle-orm';
import type { Db } from '@/db';

/**
 * Nightly aggregates behind the data flywheel (§12): how often each card is liked, how often a
 * suggestion becomes a mutual yes in a tie-breaker, and what gets clicked and bought. Plain SQL
 * over counts only, so nothing personal is kept in the result.
 */
export async function refreshItemStats(db: Db): Promise<void> {
  await db.execute(sql`
    insert into item_stats (item_id, exposures, rights, tiebreak_shown, tiebreak_mutual_yes, clicks, bought, updated_at)
    select i.id,
           coalesce(s.exposures, 0), coalesce(s.rights, 0),
           coalesce(t.shown, 0), coalesce(t.mutual, 0),
           coalesce(c.clicks, 0), coalesce(b.bought, 0), now()
    from catalogue_item i
    left join (
      select item_id, count(*)::int as exposures, (count(*) filter (where value = 1))::int as rights
      from swipe where round in ('macro', 'micro') group by item_id
    ) s on s.item_id = i.id
    left join (
      select item_id, count(*)::int as shown, (count(*) filter (where all_yes))::int as mutual
      from (
        select sw.item_id, p.project_id, bool_and(sw.value = 1) as all_yes
        from swipe sw join participant p on p.id = sw.participant_id
        where sw.round = 'bridge'
        group by sw.item_id, p.project_id
      ) per_room
      group by item_id
    ) t on t.item_id = i.id
    left join (select item_id, count(*)::int as clicks from outbound_click group by item_id) c on c.item_id = i.id
    left join (
      select item_id, count(*)::int as bought from shopping_list_item where bought_at is not null group by item_id
    ) b on b.item_id = i.id
    where s.item_id is not null or t.item_id is not null or c.item_id is not null or b.item_id is not null
    on conflict (item_id) do update set
      exposures = excluded.exposures,
      rights = excluded.rights,
      tiebreak_shown = excluded.tiebreak_shown,
      tiebreak_mutual_yes = excluded.tiebreak_mutual_yes,
      clicks = excluded.clicks,
      bought = excluded.bought,
      updated_at = now()`);
}
