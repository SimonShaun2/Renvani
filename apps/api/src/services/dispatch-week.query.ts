import { sql, type SQL } from "drizzle-orm";
import type { DispatchWeekQuery } from "@fsm/types";

export const MAX_DISPATCH_WEEK_JOBS = 5000;
export function buildDispatchWeekJobsQuery(
  companyId: string,
  start: string,
  endExclusive: string,
  technician: DispatchWeekQuery["technician"],
): SQL {
  const filter =
    technician === "all"
      ? sql`true`
      : technician === "unassigned"
        ? sql`(j.technician_id is null or t.id is null)`
        : sql`j.technician_id = ${technician}::uuid`;
  return sql`
    select jsonb_build_object(
      'id',j.id,'jobNumber',j.job_number,'title',j.title,'status',j.status::text,
      'scheduledStart',to_char(j.scheduled_start,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'scheduledEnd',to_char(j.scheduled_end,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timingWarning',case when j.scheduled_end is null then 'missing_end'
        when j.scheduled_end <= j.scheduled_start then 'invalid_end' else null end,
      'technicianId',t.id,'technicianName',case when t.id is null then null else concat_ws(' ',t.first_name,t.last_name) end,
      'assignmentState',case when j.technician_id is null then 'unassigned' when t.id is null then 'unavailable'
        when t.status::text = 'inactive' then 'inactive' else 'assigned' end,
      'customerName',case when c.id is null then null else coalesce(nullif(c.display_name,''),concat_ws(' ',c.first_name,c.last_name)) end,
      'address',case when p.id is null then null else concat_ws(', ',p.address_line_1,p.city) end
    ) as payload
    from jobs j
    left join customers c on c.id=j.customer_id and c.company_id=${companyId}::uuid and c.deleted_at is null
    left join technicians t on t.id=j.technician_id and t.company_id=${companyId}::uuid and t.deleted_at is null
    left join properties p on p.id=j.property_id and p.company_id=${companyId}::uuid and p.deleted_at is null
    where j.company_id=${companyId}::uuid and j.deleted_at is null and j.status::text <> 'cancelled'
      and j.scheduled_start < (${endExclusive}::timestamptz at time zone 'UTC')
      and (case when j.scheduled_end > j.scheduled_start
        then j.scheduled_end > (${start}::timestamptz at time zone 'UTC')
        else j.scheduled_start >= (${start}::timestamptz at time zone 'UTC') end)
      and ${filter}
    order by j.scheduled_start,j.id
    limit ${MAX_DISPATCH_WEEK_JOBS + 1}::integer
  `;
}
