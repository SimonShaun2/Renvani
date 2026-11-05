import { runTransactionWithTenantSession } from "@fsm/db";
import {
  EstimateGroupsQuerySchema,
  EstimateGroupsResponseSchema,
  type EstimateGroupsQuery,
  type EstimateGroupsResponse,
} from "@fsm/types";
import {
  assertEstimateOfficeRole,
  requireCurrentEstimateOfficeActor,
  type EstimateStaffActor,
} from "./estimate-access.js";
import { buildEstimateGroupsQuery } from "./estimate-groups.query.js";

export async function listEstimateGroups(
  actor: EstimateStaffActor,
  input: EstimateGroupsQuery,
): Promise<EstimateGroupsResponse> {
  assertEstimateOfficeRole(actor);
  const query = EstimateGroupsQuerySchema.parse(input);
  return runTransactionWithTenantSession(actor.companyId, async (tx) => {
    await requireCurrentEstimateOfficeActor(actor, tx);
    const rows = await tx.execute<{ payload: unknown }>(
      buildEstimateGroupsQuery(actor.companyId, query),
    );
    return EstimateGroupsResponseSchema.parse(rows[0]?.payload);
  });
}
