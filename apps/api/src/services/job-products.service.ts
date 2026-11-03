import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  db,
  emitEventWithExecutor,
  jobProducts,
  jobs,
  productCatalog,
  users
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AddJobProductInput,
  type JobProduct,
  type ProductCategory,
  type UpdateJobProductInput
} from "@fsm/types";

const MAX_RESULT_WINDOW = 10_000;

type JobRow = typeof jobs.$inferSelect;
type JobProductRow = typeof jobProducts.$inferSelect;
type ProductRow = typeof productCatalog.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type JobProductSnapshot = {
  productCatalogId: string | null;
  name: string;
  description: string | null;
  category: ProductCategory;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  isUpsell: boolean;
};

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toQuantityString(value: number | string): string {
  return new Decimal(value).toFixed(3);
}

function toMoneyString(value: number | string | Decimal): string {
  return new Decimal(value).toFixed(2);
}

function normalizeAddJobProductInput(input: AddJobProductInput) {
  return {
    productCatalogId: input.productCatalogId,
    name: normalizeOptionalString(input.name),
    description: normalizeOptionalString(input.description) ?? null,
    category: input.category ?? "service",
    quantity: input.quantity ?? 1,
    unitPrice: input.unitPrice,
    isTaxable: input.isTaxable ?? true,
    isUpsell: input.isUpsell ?? false
  };
}

function normalizeUpdateJobProductInput(input: UpdateJobProductInput) {
  return {
    name: input.name !== undefined ? normalizeOptionalString(input.name) ?? null : undefined,
    description: input.description !== undefined ? normalizeOptionalString(input.description) ?? null : undefined,
    category: input.category,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    isTaxable: input.isTaxable,
    isUpsell: input.isUpsell
  };
}

function toJobProduct(row: JobProductRow): JobProduct {
  return row;
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow | null> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  return actor ?? null;
}

async function getJobRow(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobRow> {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  return job;
}

async function getCatalogProductRow(
  companyId: string,
  productId: string,
  executor: SelectExecutor
): Promise<ProductRow> {
  const [row] = await executor
    .select()
    .from(productCatalog)
    .where(and(eq(productCatalog.companyId, companyId), eq(productCatalog.id, productId), isNull(productCatalog.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Catalog product not found");
  }

  return row;
}

async function getJobProductRow(
  companyId: string,
  jobId: string,
  jobProductId: string,
  executor: SelectExecutor
): Promise<JobProductRow> {
  const [row] = await executor
    .select()
    .from(jobProducts)
    .where(
      and(
        eq(jobProducts.companyId, companyId),
        eq(jobProducts.jobId, jobId),
        eq(jobProducts.id, jobProductId),
        isNull(jobProducts.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job product not found");
  }

  return row;
}

async function listJobProductRows(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<JobProductRow[]> {
  return executor
    .select()
    .from(jobProducts)
    .where(and(eq(jobProducts.companyId, companyId), eq(jobProducts.jobId, jobId), isNull(jobProducts.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

function sortJobProducts(rows: JobProductRow[]): JobProductRow[] {
  return [...rows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

async function emitJobProductEvent(
  executor: TransactionExecutor,
  job: JobRow,
  product: JobProductRow,
  eventType: "job.product_added" | "job.product_removed" | "job.upsell_approved",
  summary: string,
  actorId?: string
): Promise<void> {
  const actor = actorId ? await getActor(job.companyId, actorId, executor) : null;

  await emitEventWithExecutor(executor, {
    companyId: job.companyId,
    eventType,
    ...(actorId ? { actorId } : {}),
    ...(actor ? { actorName: buildActorName(actor.firstName, actor.lastName) } : {}),
    entityType: "job",
    entityId: job.id,
    customerId: job.customerId,
    jobId: job.id,
    payload: {
      jobProductId: product.id,
      productCatalogId: product.productCatalogId
    },
    summary
  });
}

function buildSnapshotFromCatalogRow(
  row: ProductRow,
  quantity: number,
  isUpsell: boolean
): JobProductSnapshot {
  const quantityString = toQuantityString(quantity);
  const unitPriceString = row.unitPrice;

  return {
    productCatalogId: row.id,
    name: row.name,
    description: row.description,
    category: row.category as ProductCategory,
    quantity: quantityString,
    unitPrice: unitPriceString,
    total: new Decimal(quantityString).mul(unitPriceString).toFixed(2),
    isTaxable: row.isTaxable,
    isUpsell,
  };
}

function assertPositiveNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `${fieldName} must be greater than zero`, {
      [fieldName]: `${fieldName} must be greater than zero`
    });
  }
}

export async function listJobProducts(companyId: string, jobId: string): Promise<JobProduct[]> {
  await getJobRow(companyId, jobId, db);
  const rows = await listJobProductRows(companyId, jobId, db);
  return sortJobProducts(rows).map((row) => toJobProduct(row));
}

export async function addProduct(
  companyId: string,
  jobId: string,
  actorId: string,
  input: AddJobProductInput
): Promise<JobProduct> {
  return db.transaction(async (tx) => {
    const job = await getJobRow(companyId, jobId, tx);
    return insertJobProductInTransaction(tx, companyId, job, actorId, input);
  });
}

/** Adds one line item inside the caller's transaction (used by addProduct and job create). */
export async function insertJobProductInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: string,
  job: JobRow,
  actorId: string,
  input: AddJobProductInput
): Promise<JobProduct> {
  const jobId = job.id;
  const normalizedInput = normalizeAddJobProductInput(input);
  assertPositiveNumber(normalizedInput.quantity, "quantity");
  {
    const actor = await getActor(companyId, actorId, tx);
    let snapshot: JobProductSnapshot;

    if (normalizedInput.productCatalogId) {
      const catalogProduct = await getCatalogProductRow(companyId, normalizedInput.productCatalogId, tx);
      snapshot = buildSnapshotFromCatalogRow(catalogProduct, normalizedInput.quantity, normalizedInput.isUpsell);
    } else {
      if (!normalizedInput.name || normalizedInput.unitPrice === undefined) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Manual job products require name and unitPrice",
          {
            name: "name is required",
            unitPrice: "unitPrice is required"
          }
        );
      }

      assertPositiveNumber(normalizedInput.unitPrice, "unitPrice");

      const quantityString = toQuantityString(normalizedInput.quantity);
      const unitPriceString = toMoneyString(normalizedInput.unitPrice);
      snapshot = {
        productCatalogId: null,
        name: normalizedInput.name,
        description: normalizedInput.description,
        category: normalizedInput.category,
        quantity: quantityString,
        unitPrice: unitPriceString,
        total: new Decimal(quantityString).mul(unitPriceString).toFixed(2),
        isTaxable: normalizedInput.isTaxable,
        isUpsell: normalizedInput.isUpsell
      };
    }

    const [jobProduct] = await tx
      .insert(jobProducts)
      .values({
        companyId,
        jobId,
        productCatalogId: snapshot.productCatalogId,
        name: snapshot.name,
        description: snapshot.description,
        category: snapshot.category,
        quantity: snapshot.quantity,
        unitPrice: snapshot.unitPrice,
        total: snapshot.total,
        isTaxable: snapshot.isTaxable,
        addedById: actor?.id ?? actorId,
        isUpsell: snapshot.isUpsell
      })
      .returning();

    if (!jobProduct) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to add job product");
    }

    await emitJobProductEvent(tx, job, jobProduct, "job.product_added", `Added product ${jobProduct.name}`, actorId);

    return toJobProduct(jobProduct);
  }
}

export async function updateJobProduct(
  companyId: string,
  jobId: string,
  productId: string,
  input: UpdateJobProductInput
): Promise<JobProduct> {
  const normalizedInput = normalizeUpdateJobProductInput(input);

  return db.transaction(async (tx) => {
    await getJobRow(companyId, jobId, tx);
    const existingJobProduct = await getJobProductRow(companyId, jobId, productId, tx);

    if (normalizedInput.quantity !== undefined) {
      assertPositiveNumber(normalizedInput.quantity, "quantity");
    }

    if (normalizedInput.unitPrice !== undefined) {
      assertPositiveNumber(normalizedInput.unitPrice, "unitPrice");
    }

    const quantityString =
      normalizedInput.quantity !== undefined
        ? toQuantityString(normalizedInput.quantity)
        : existingJobProduct.quantity;
    const unitPriceString =
      normalizedInput.unitPrice !== undefined
        ? toMoneyString(normalizedInput.unitPrice)
        : existingJobProduct.unitPrice;
    const [updatedJobProduct] = await tx
      .update(jobProducts)
      .set({
        ...(normalizedInput.name !== undefined ? { name: normalizedInput.name ?? existingJobProduct.name } : {}),
        ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
        ...(normalizedInput.category !== undefined ? { category: normalizedInput.category } : {}),
        ...(normalizedInput.quantity !== undefined ? { quantity: quantityString } : {}),
        ...(normalizedInput.unitPrice !== undefined ? { unitPrice: unitPriceString } : {}),
        ...(normalizedInput.isTaxable !== undefined ? { isTaxable: normalizedInput.isTaxable } : {}),
        ...(normalizedInput.isUpsell !== undefined ? { isUpsell: normalizedInput.isUpsell } : {}),
        total: new Decimal(quantityString).mul(unitPriceString).toFixed(2),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(jobProducts.companyId, companyId),
          eq(jobProducts.jobId, jobId),
          eq(jobProducts.id, productId),
          isNull(jobProducts.deletedAt)
        )
      )
      .returning();

    if (!updatedJobProduct) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update job product");
    }

    return toJobProduct(updatedJobProduct);
  });
}

export async function removeJobProduct(companyId: string, jobId: string, productId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const job = await getJobRow(companyId, jobId, tx);
    const existingJobProduct = await getJobProductRow(companyId, jobId, productId, tx);

    await tx
      .update(jobProducts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(jobProducts.companyId, companyId),
          eq(jobProducts.jobId, jobId),
          eq(jobProducts.id, productId),
          isNull(jobProducts.deletedAt)
        )
      );

    await emitJobProductEvent(
      tx,
      job,
      existingJobProduct,
      "job.product_removed",
      `Removed product ${existingJobProduct.name}`
    );
  });
}

export async function approveUpsell(
  companyId: string,
  jobId: string,
  productId: string,
  actorId: string
): Promise<JobProduct> {
  return db.transaction(async (tx) => {
    const job = await getJobRow(companyId, jobId, tx);
    await getActor(companyId, actorId, tx);
    const existingJobProduct = await getJobProductRow(companyId, jobId, productId, tx);
    const [updatedJobProduct] = await tx
      .update(jobProducts)
      .set({
        upsellApproved: true,
        upsellApprovedAt: existingJobProduct.upsellApprovedAt ?? new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(jobProducts.companyId, companyId),
          eq(jobProducts.jobId, jobId),
          eq(jobProducts.id, productId),
          isNull(jobProducts.deletedAt)
        )
      )
      .returning();

    if (!updatedJobProduct) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to approve upsell");
    }

    await emitJobProductEvent(
      tx,
      job,
      updatedJobProduct,
      "job.upsell_approved",
      `Approved upsell ${updatedJobProduct.name}`,
      actorId
    );

    return toJobProduct(updatedJobProduct);
  });
}

/** Prices line-item inputs without writing (catalog price wins, else manual unitPrice). Used by create/invoice previews. */
export async function priceJobProductInputs(
  companyId: string,
  inputs: AddJobProductInput[],
  executor: SelectExecutor = db
): Promise<{ lines: Array<{ name: string; quantity: string; unitPrice: string; total: string }>; subtotal: string }> {
  const lines: Array<{ name: string; quantity: string; unitPrice: string; total: string }> = [];
  let subtotal = new Decimal(0);
  for (const input of inputs) {
    const normalizedInput = normalizeAddJobProductInput(input);
    assertPositiveNumber(normalizedInput.quantity, "quantity");
    let line: { name: string; quantity: string; unitPrice: string; total: string };
    if (normalizedInput.productCatalogId) {
      const row = await getCatalogProductRow(companyId, normalizedInput.productCatalogId, executor);
      const snapshot = buildSnapshotFromCatalogRow(row, normalizedInput.quantity, normalizedInput.isUpsell);
      line = { name: snapshot.name, quantity: snapshot.quantity, unitPrice: snapshot.unitPrice, total: snapshot.total };
    } else {
      if (!normalizedInput.name || normalizedInput.unitPrice === undefined) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Manual job products require name and unitPrice");
      }
      assertPositiveNumber(normalizedInput.unitPrice, "unitPrice");
      const quantity = toQuantityString(normalizedInput.quantity);
      const unitPrice = toMoneyString(normalizedInput.unitPrice);
      line = { name: normalizedInput.name, quantity, unitPrice, total: new Decimal(quantity).mul(unitPrice).toFixed(2) };
    }
    subtotal = subtotal.plus(line.total);
    lines.push(line);
  }
  return { lines, subtotal: subtotal.toFixed(2) };
}
