import { and, eq, inArray, isNull } from "drizzle-orm";

import { db, productCatalog } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

type PriceBookScopeExecutor = Pick<typeof db, "select">;

/**
 * FS-147: a client-supplied priceBookItemId must belong to the caller's company and not be
 * soft-deleted. The product_catalog FK only proves the row exists in some tenant.
 */
export async function findLivePriceBookItemIds(
  executor: PriceBookScopeExecutor,
  companyId: string,
  priceBookItemIds: ReadonlyArray<string | null | undefined>
): Promise<Set<string>> {
  const ids = [...new Set(priceBookItemIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) {
    return new Set();
  }

  const rows = await executor
    .select({ id: productCatalog.id })
    .from(productCatalog)
    .where(
      and(
        eq(productCatalog.companyId, companyId),
        inArray(productCatalog.id, ids),
        isNull(productCatalog.deletedAt)
      )
    );

  return new Set(rows.map((row) => row.id));
}

export async function assertPriceBookItemsInCompany(
  executor: PriceBookScopeExecutor,
  companyId: string,
  priceBookItemIds: ReadonlyArray<string | null | undefined>
): Promise<void> {
  const ids = [...new Set(priceBookItemIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) {
    return;
  }

  const found = await findLivePriceBookItemIds(executor, companyId, ids);
  if (ids.some((id) => !found.has(id))) {
    throw new AppError(ErrorCode.NOT_FOUND, "Price book item not found");
  }
}
