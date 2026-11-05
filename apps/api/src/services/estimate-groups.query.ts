import { sql, type SQL } from "drizzle-orm";
import {
  ESTIMATE_GROUP_STATUS_PRIORITY,
  type EstimateGroupsQuery,
} from "@fsm/types";

/** One SQL statement gives count and complete option-set pages the same MVCC snapshot.
 * Search is literal (not LIKE wildcards). Every member of a matching group is retained.
 * Old row-paged /estimates consumers are deliberately unchanged.
 */
export function buildEstimateGroupsQuery(
  companyId: string,
  query: EstimateGroupsQuery,
): SQL {
  const ranks = sql.join(
    ESTIMATE_GROUP_STATUS_PRIORITY.map(
      (status, rank) => sql`when ${status} then ${rank}::integer`,
    ),
    sql` `,
  );
  const search = (query.search ?? "").trim().toLowerCase();
  const statusFilter =
    query.status === "sent"
      ? sql`g.status_rank in (2, 3)`
      : query.status
        ? sql`g.status_rank = ${ESTIMATE_GROUP_STATUS_PRIORITY.indexOf(query.status)}::integer`
        : sql`true`;
  return sql`
    with eligible as materialized (
      select e.*, c.first_name, c.last_name,
        case when e.tier_group_id is null then 'estimate:' || e.id::text
          else 'group:' || e.tier_group_id::text || ':' || e.customer_id::text end as group_key,
        case e.status::text ${ranks} else 7 end as status_rank,
        case lower(e.tier_label) when 'good' then 0 when 'better' then 1 when 'best' then 2 else 3 end as tier_rank,
        (${search} = '' or position(${search} in lower(concat_ws(' ',
          e.estimate_number, e.title, c.first_name, c.last_name, c.display_name))) > 0) as matches_search
      from estimates e
      inner join customers c on c.id = e.customer_id and c.company_id = ${companyId}::uuid and c.deleted_at is null
      where e.company_id = ${companyId}::uuid and e.deleted_at is null
    ), grouped as (
      select group_key, min(status_rank) as status_rank, max(created_at) as sort_created,
        count(*)::integer as tier_count, bool_or(matches_search) as matches_search,
        (array_agg(id order by
          case when status::text in ('approved','converted') then 0 when lower(tier_label) = 'better' then 1 else 2 end,
          tier_rank, created_at, id))[1] as primary_id,
        array_agg(id order by tier_rank, created_at, id) as estimate_ids,
        min(approved_at) as approved_at
      from eligible group by group_key
    ), filtered as (
      select g.* from grouped g where g.matches_search and ${statusFilter}
    ), selected as (
      select * from filtered order by sort_created desc, group_key asc
      limit ${query.limit}::integer offset ${(query.page - 1) * query.limit}::integer
    ), page_rows as (
      select s.sort_created, s.group_key,
        jsonb_build_object(
          'id', s.group_key, 'estimateId', e.id, 'estimateIds', s.estimate_ids,
          'estimateNumber', e.estimate_number, 'title', e.title,
          'status', (array['converted','approved','viewed','sent','declined','expired','revised','draft'])[s.status_rank + 1],
          'total', e.total::text, 'subtotal', e.subtotal::text,
          'customer', jsonb_build_object('id', e.customer_id, 'firstName', e.first_name, 'lastName', e.last_name),
          'sentAt', to_char(e.sent_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'expiresAt', to_char(e.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'approvedAt', to_char(s.approved_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'declinedAt', to_char(e.declined_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'createdAt', to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'tierCount', s.tier_count, 'tierLabel', e.tier_label, 'tierGroupId', e.tier_group_id
        ) as item
      from selected s join eligible e on e.id = s.primary_id
    )
    select jsonb_build_object(
      'data', coalesce((select jsonb_agg(item order by sort_created desc, group_key asc) from page_rows), '[]'::jsonb),
      'total', (select count(*)::integer from filtered),
      'page', ${query.page}::integer, 'limit', ${query.limit}::integer,
      'totalPages', (select ceil(count(*)::numeric / ${query.limit}::numeric)::integer from filtered)
    ) as payload
  `;
}
