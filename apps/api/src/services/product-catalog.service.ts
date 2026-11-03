import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  customers,
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
  type CreateProductInput,
  type JobStatus,
  type ListProductsQuery,
  type PaginatedResult,
  type Product,
  type ProductCategory,
  type UpdateProductInput
} from "@fsm/types";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;

type ProductRow = typeof productCatalog.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type JobProductRow = typeof jobProducts.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type NormalizedListProductsQuery = {
  category?: ProductCategory;
  isActive: boolean;
  search?: string;
  page: number;
  limit: number;
};

export interface ProductRecentJobUsage {
  jobId: string;
  jobNumber: string;
  customerName: string;
  usedAt: Date;
  totalRevenue: string;
}

export interface ProductUsageStats {
  usedOnJobs: number;
  totalRevenue: string;
  averageRevenuePerJob: string;
  lastUsedAt: Date | null;
  recentJobs: ProductRecentJobUsage[];
}

type ProductUsageAccumulator = {
  totalRevenue: Decimal;
  jobs: Map<
    string,
    {
      jobId: string;
      jobNumber: string;
      customerName: string;
      usedAt: Date;
      totalRevenue: Decimal;
    }
  >;
  lastUsedAt: Date | null;
};

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = value.trim();

    if (normalizedValue.length === 0 || normalizedValues.includes(normalizedValue)) {
      continue;
    }

    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}

function normalizeMoney(value: number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return new Decimal(value).toFixed(2);
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function buildCustomerName(customer: CustomerRow | undefined): string {
  if (!customer) {
    return "Unknown customer";
  }

  const displayName = customer.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const fallbackName = `${customer.firstName} ${customer.lastName}`.trim();
  return fallbackName || "Unknown customer";
}

function normalizeListProductsQuery(query: ListProductsQuery): NormalizedListProductsQuery {
  const normalizedSearch = normalizeOptionalString(query.search)?.toLowerCase();

  return {
    isActive: query.isActive ?? true,
    ...(query.category ? { category: query.category } : {}),
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    page: query.page ?? DEFAULT_PAGE,
    limit: Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  };
}

function normalizeCreateProductInput(input: CreateProductInput) {
  return {
    name: input.name.trim(),
    description: normalizeOptionalString(input.description) ?? null,
    category: input.category ?? "service",
    sku: normalizeOptionalString(input.sku) ?? null,
    unitPrice: new Decimal(input.unitPrice).toFixed(2),
    cost: normalizeMoney(input.cost) ?? null,
    unit: normalizeOptionalString(input.unit) ?? "each",
    isTaxable: input.isTaxable ?? true,
    isActive: input.isActive ?? true,
    applicableAssetTypes: normalizeStringArray(input.applicableAssetTypes) ?? [],
    sortOrder: input.sortOrder ?? 0
  };
}

function normalizeUpdateProductInput(input: UpdateProductInput) {
  return {
    name: input.name !== undefined ? input.name.trim() : undefined,
    description: input.description !== undefined ? normalizeOptionalString(input.description) ?? null : undefined,
    category: input.category,
    sku: input.sku !== undefined ? normalizeOptionalString(input.sku) ?? null : undefined,
    unitPrice: normalizeMoney(input.unitPrice),
    cost: input.cost !== undefined ? normalizeMoney(input.cost) ?? null : undefined,
    unit: input.unit !== undefined ? normalizeOptionalString(input.unit) ?? null : undefined,
    isTaxable: input.isTaxable,
    isActive: input.isActive,
    applicableAssetTypes:
      input.applicableAssetTypes !== undefined
        ? normalizeStringArray(input.applicableAssetTypes) ?? []
        : undefined,
    sortOrder: input.sortOrder
  };
}

function isActiveJobStatus(status: JobStatus): boolean {
  return !["completed", "invoiced", "paid", "cancelled", "closed"].includes(status);
}

function toProduct(row: ProductRow): Product {
  return {
    ...row,
    applicableAssetTypes: row.applicableAssetTypes ?? []
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow | null> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  return actor ?? null;
}

async function listCompanyProducts(companyId: string, executor: SelectExecutor): Promise<ProductRow[]> {
  return executor
    .select()
    .from(productCatalog)
    .where(and(eq(productCatalog.companyId, companyId), isNull(productCatalog.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function listCompanyCustomers(companyId: string, executor: SelectExecutor): Promise<CustomerRow[]> {
  return executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function getProductRow(
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
    throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
  }

  return row;
}

async function assertUniqueSku(
  companyId: string,
  sku: string | null,
  executor: SelectExecutor,
  excludeProductId?: string
): Promise<void> {
  if (!sku) {
    return;
  }

  const normalizedSku = sku.toLowerCase();
  const existingProducts = await listCompanyProducts(companyId, executor);
  const duplicate = existingProducts.find(
    (row) => row.sku?.toLowerCase() === normalizedSku && row.id !== excludeProductId
  );

  if (duplicate) {
    throw new AppError(ErrorCode.CONFLICT, "SKU already exists", {
      sku: "SKU must be unique within the company"
    });
  }
}

async function listJobProductsForCatalogProduct(
  companyId: string,
  productId: string,
  executor: SelectExecutor
): Promise<JobProductRow[]> {
  return executor
    .select()
    .from(jobProducts)
    .where(
      and(
        eq(jobProducts.companyId, companyId),
        eq(jobProducts.productCatalogId, productId),
        isNull(jobProducts.deletedAt)
      )
    )
    .limit(MAX_RESULT_WINDOW);
}

async function listCompanyJobs(companyId: string, executor: SelectExecutor): Promise<JobRow[]> {
  return executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function listCompanyJobProducts(companyId: string, executor: SelectExecutor): Promise<JobProductRow[]> {
  return executor
    .select()
    .from(jobProducts)
    .where(and(eq(jobProducts.companyId, companyId), isNull(jobProducts.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

function buildEmptyUsageStats(): ProductUsageStats {
  return {
    usedOnJobs: 0,
    totalRevenue: "0.00",
    averageRevenuePerJob: "0.00",
    lastUsedAt: null,
    recentJobs: []
  };
}

async function buildProductUsageStatsMap(
  companyId: string,
  executor: SelectExecutor
): Promise<Map<string, ProductUsageStats>> {
  const [companyJobs, companyCustomers, companyJobProducts] = await Promise.all([
    listCompanyJobs(companyId, executor),
    listCompanyCustomers(companyId, executor),
    listCompanyJobProducts(companyId, executor)
  ]);

  const jobsById = new Map(companyJobs.map((row) => [row.id, row]));
  const customersById = new Map(companyCustomers.map((row) => [row.id, row]));
  const usageByProductId = new Map<string, ProductUsageAccumulator>();

  for (const row of companyJobProducts) {
    if (!row.productCatalogId) {
      continue;
    }

    const job = jobsById.get(row.jobId);

    if (!job) {
      continue;
    }

    const customer = customersById.get(job.customerId);
    const revenue = new Decimal(row.total);
    const usedAt = row.createdAt;
    const usage =
      usageByProductId.get(row.productCatalogId) ??
      {
        totalRevenue: new Decimal(0),
        jobs: new Map(),
        lastUsedAt: null
      };

    usage.totalRevenue = usage.totalRevenue.add(revenue);

    if (!usage.lastUsedAt || usedAt.getTime() > usage.lastUsedAt.getTime()) {
      usage.lastUsedAt = usedAt;
    }

    const existingJobUsage = usage.jobs.get(job.id);

    if (existingJobUsage) {
      existingJobUsage.totalRevenue = existingJobUsage.totalRevenue.add(revenue);

      if (usedAt.getTime() > existingJobUsage.usedAt.getTime()) {
        existingJobUsage.usedAt = usedAt;
      }
    } else {
      usage.jobs.set(job.id, {
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: buildCustomerName(customer),
        usedAt,
        totalRevenue: revenue
      });
    }

    usageByProductId.set(row.productCatalogId, usage);
  }

  const usageStatsByProductId = new Map<string, ProductUsageStats>();

  for (const [productId, usage] of usageByProductId.entries()) {
    const usedOnJobs = usage.jobs.size;
    const recentJobs = [...usage.jobs.values()]
      .sort((left, right) => right.usedAt.getTime() - left.usedAt.getTime())
      .slice(0, 4)
      .map((jobUsage) => ({
        jobId: jobUsage.jobId,
        jobNumber: jobUsage.jobNumber,
        customerName: jobUsage.customerName,
        usedAt: jobUsage.usedAt,
        totalRevenue: jobUsage.totalRevenue.toFixed(2)
      }));

    usageStatsByProductId.set(productId, {
      usedOnJobs,
      totalRevenue: usage.totalRevenue.toFixed(2),
      averageRevenuePerJob:
        usedOnJobs > 0 ? usage.totalRevenue.div(usedOnJobs).toFixed(2) : "0.00",
      lastUsedAt: usage.lastUsedAt,
      recentJobs
    });
  }

  return usageStatsByProductId;
}

export async function listProducts(
  companyId: string,
  query: ListProductsQuery
): Promise<PaginatedResult<Product>> {
  const normalizedQuery = normalizeListProductsQuery(query);
  const companyProducts = await listCompanyProducts(companyId, db);

  const filteredProducts = companyProducts.filter((row) => {
    if (row.isActive !== normalizedQuery.isActive) {
      return false;
    }

    if (normalizedQuery.category && row.category !== normalizedQuery.category) {
      return false;
    }

    if (normalizedQuery.search) {
      const searchTarget = `${row.name} ${row.sku ?? ""}`.toLowerCase();

      if (!searchTarget.includes(normalizedQuery.search)) {
        return false;
      }
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((left, right) => {
    const leftSortOrder = left.sortOrder ?? 0;
    const rightSortOrder = right.sortOrder ?? 0;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return left.name.localeCompare(right.name);
  });
  const total = sortedProducts.length;
  const offset = (normalizedQuery.page - 1) * normalizedQuery.limit;

  return {
    data: sortedProducts.slice(offset, offset + normalizedQuery.limit).map((row) => toProduct(row)),
    total,
    page: normalizedQuery.page,
    limit: normalizedQuery.limit,
    totalPages: Math.ceil(total / normalizedQuery.limit)
  };
}

export async function searchProducts(companyId: string, q: string): Promise<Product[]> {
  const normalizedQuery = normalizeOptionalString(q)?.toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const companyProducts = await listCompanyProducts(companyId, db);

  return companyProducts
    .filter((row) => {
      if (!row.isActive) {
        return false;
      }

      const searchTarget = `${row.name} ${row.sku ?? ""} ${row.description ?? ""}`.toLowerCase();
      return searchTarget.includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftSortOrder = left.sortOrder ?? 0;
      const rightSortOrder = right.sortOrder ?? 0;

      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 20)
    .map((row) => toProduct(row));
}

export async function getProduct(companyId: string, productId: string): Promise<Product> {
  const row = await getProductRow(companyId, productId, db);
  return toProduct(row);
}

export async function listProductUsageCounts(companyId: string): Promise<Map<string, number>> {
  const usageStatsByProductId = await buildProductUsageStatsMap(companyId, db);

  return new Map(
    [...usageStatsByProductId.entries()].map(([productId, stats]) => [productId, stats.usedOnJobs])
  );
}

export async function getProductUsageStats(
  companyId: string,
  productId: string
): Promise<ProductUsageStats> {
  await getProductRow(companyId, productId, db);

  const usageStatsByProductId = await buildProductUsageStatsMap(companyId, db);
  return usageStatsByProductId.get(productId) ?? buildEmptyUsageStats();
}

export async function createProduct(
  companyId: string,
  actorId: string,
  input: CreateProductInput
): Promise<Product> {
  const normalizedInput = normalizeCreateProductInput(input);

  return db.transaction(async (tx) => {
    await assertUniqueSku(companyId, normalizedInput.sku, tx);

    const [product] = await tx
      .insert(productCatalog)
      .values({
        companyId,
        name: normalizedInput.name,
        description: normalizedInput.description,
        category: normalizedInput.category,
        sku: normalizedInput.sku,
        unitPrice: normalizedInput.unitPrice,
        cost: normalizedInput.cost,
        unit: normalizedInput.unit,
        isTaxable: normalizedInput.isTaxable,
        isActive: normalizedInput.isActive,
        applicableAssetTypes: normalizedInput.applicableAssetTypes,
        sortOrder: normalizedInput.sortOrder
      })
      .returning();

    if (!product) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create product");
    }

    const actor = await getActor(companyId, actorId, tx);

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "product.created",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "product",
      entityId: product.id,
      payload: {
        category: product.category
      },
      summary: `Created product ${product.name}`
    });

    return toProduct(product);
  });
}

export async function updateProduct(
  companyId: string,
  actorId: string,
  productId: string,
  input: UpdateProductInput
): Promise<Product> {
  const normalizedInput = normalizeUpdateProductInput(input);

  return db.transaction(async (tx) => {
    const existingProduct = await getProductRow(companyId, productId, tx);

    if (normalizedInput.sku !== undefined) {
      await assertUniqueSku(companyId, normalizedInput.sku, tx, productId);
    }

    const [updatedProduct] = await tx
      .update(productCatalog)
      .set({
        ...(normalizedInput.name !== undefined ? { name: normalizedInput.name } : {}),
        ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
        ...(normalizedInput.category !== undefined ? { category: normalizedInput.category } : {}),
        ...(normalizedInput.sku !== undefined ? { sku: normalizedInput.sku } : {}),
        ...(normalizedInput.unitPrice !== undefined ? { unitPrice: normalizedInput.unitPrice } : {}),
        ...(normalizedInput.cost !== undefined ? { cost: normalizedInput.cost } : {}),
        ...(normalizedInput.unit !== undefined ? { unit: normalizedInput.unit } : {}),
        ...(normalizedInput.isTaxable !== undefined ? { isTaxable: normalizedInput.isTaxable } : {}),
        ...(normalizedInput.isActive !== undefined ? { isActive: normalizedInput.isActive } : {}),
        ...(normalizedInput.applicableAssetTypes !== undefined
          ? { applicableAssetTypes: normalizedInput.applicableAssetTypes }
          : {}),
        ...(normalizedInput.sortOrder !== undefined ? { sortOrder: normalizedInput.sortOrder } : {}),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(productCatalog.companyId, companyId),
          eq(productCatalog.id, existingProduct.id),
          isNull(productCatalog.deletedAt)
        )
      )
      .returning();

    if (!updatedProduct) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update product");
    }

    const actor = await getActor(companyId, actorId, tx);

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "product.updated",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "product",
      entityId: updatedProduct.id,
      payload: {
        category: updatedProduct.category
      },
      summary: `Updated product ${updatedProduct.name}`
    });

    return toProduct(updatedProduct);
  });
}

export async function deleteProduct(companyId: string, actorId: string, productId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await getProductRow(companyId, productId, tx);
    const linkedJobProducts = await listJobProductsForCatalogProduct(companyId, productId, tx);

    if (linkedJobProducts.length > 0) {
      const companyJobs = await listCompanyJobs(companyId, tx);
      const jobsById = new Map(companyJobs.map((row) => [row.id, row]));
      const activeLinkedJob = linkedJobProducts.find((row) => {
        const job = jobsById.get(row.jobId);
        return job ? isActiveJobStatus(job.status) : false;
      });

      if (activeLinkedJob) {
        throw new AppError(ErrorCode.CONFLICT, "Product is used on active jobs");
      }
    }

    await tx
      .update(productCatalog)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(productCatalog.companyId, companyId), eq(productCatalog.id, productId), isNull(productCatalog.deletedAt)));

    await getActor(companyId, actorId, tx);
  });
}
