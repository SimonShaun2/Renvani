import { and, desc, eq, isNull } from "drizzle-orm";

import {
  assets,
  customerNotes,
  customers,
  db,
  emitEventWithExecutor,
  invoices,
  maintenancePlans,
  properties,
  users
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CreateCustomerInput,
  type Customer,
  type CustomerNote,
  type CustomerWithGraph,
  type ListCustomersQuery,
  type PaginatedResult,
  type UpdateCustomerInput
} from "@fsm/types";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";

const MAX_RESULT_WINDOW = 10_000;
const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const DEFAULT_SORT_BY = "lastName";
const DEFAULT_SORT_ORDER = "asc";

type CustomerRow = typeof customers.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type MaintenancePlanRow = typeof maintenancePlans.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type NormalizedListCustomersQuery = {
  search?: string | undefined;
  tags?: string[] | undefined;
  status?: "active" | "dormant" | undefined;
  hasActiveMaintenancePlan?: boolean | undefined;
  hasOverdueInvoice?: boolean | undefined;
  sortBy: NonNullable<ListCustomersQuery["sortBy"]>;
  sortOrder: NonNullable<ListCustomersQuery["sortOrder"]>;
  page: number;
  limit: number;
};

const DORMANT_DAYS_THRESHOLD = 180;

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalEmail(value: string | undefined): string | null | undefined {
  const normalizedValue = normalizeOptionalString(value);

  if (normalizedValue === undefined || normalizedValue === null) {
    return normalizedValue;
  }

  return normalizedValue.toLowerCase();
}

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) {
    return undefined;
  }

  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, values) => tag.length > 0 && values.indexOf(tag) === index);
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeListCustomersQuery(query: ListCustomersQuery): NormalizedListCustomersQuery {
  return {
    search: normalizeOptionalString(query.search) ?? undefined,
    tags: normalizeTags(query.tags),
    ...(query.status ? { status: query.status } : {}),
    hasActiveMaintenancePlan: query.hasActiveMaintenancePlan,
    hasOverdueInvoice: query.hasOverdueInvoice,
    sortBy: query.sortBy ?? DEFAULT_SORT_BY,
    sortOrder: query.sortOrder ?? DEFAULT_SORT_ORDER,
    page: Math.max(query.page ?? DEFAULT_LIST_PAGE, DEFAULT_LIST_PAGE),
    limit: Math.min(Math.max(query.limit ?? DEFAULT_LIST_LIMIT, DEFAULT_LIST_PAGE), MAX_LIST_LIMIT)
  };
}

function isCustomerDormant(customer: CustomerRow, currentDate: Date = new Date()): boolean {
  if (!customer.lastServiceDate) {
    return true;
  }

  const lastServiceDate = new Date(`${customer.lastServiceDate}T00:00:00.000Z`);

  if (Number.isNaN(lastServiceDate.getTime())) {
    return true;
  }

  const diffMs = currentDate.getTime() - lastServiceDate.getTime();
  return diffMs > DORMANT_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
}

function hasOverdueInvoice(invoice: InvoiceRow, currentDate: Date = new Date()): boolean {
  if (invoice.status === "overdue") {
    return true;
  }

  const balanceDue = Number(invoice.balanceDue ?? "0");

  if (!(balanceDue > 0) || !invoice.dueAt) {
    return false;
  }

  return invoice.dueAt.getTime() < currentDate.getTime();
}

function matchesCustomerSearch(customer: CustomerRow, search: string): boolean {
  const haystacks = [
    customer.firstName,
    customer.lastName,
    customer.displayName,
    customer.email,
    customer.phone,
    customer.altPhone
  ];

  return haystacks.some((value) => normalizeSearchValue(value).includes(search));
}

function matchesTagFilter(customer: CustomerRow, tags: string[]): boolean {
  const customerTags = customer.tags ?? [];
  return tags.some((tag) => customerTags.includes(tag));
}

function compareNullableStrings(left: string | null, right: string | null, sortOrder: "asc" | "desc"): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return sortOrder === "asc" ? 1 : -1;
  }

  if (right === null) {
    return sortOrder === "asc" ? -1 : 1;
  }

  return sortOrder === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

function compareNullableNumbers(left: number | string | null, right: number | string | null, sortOrder: "asc" | "desc"): number {
  const leftNumber = left === null ? null : Number(left);
  const rightNumber = right === null ? null : Number(right);

  if (leftNumber === rightNumber) {
    return 0;
  }

  if (leftNumber === null) {
    return sortOrder === "asc" ? 1 : -1;
  }

  if (rightNumber === null) {
    return sortOrder === "asc" ? -1 : 1;
  }

  return sortOrder === "asc" ? leftNumber - rightNumber : rightNumber - leftNumber;
}

function compareDates(left: Date, right: Date, sortOrder: "asc" | "desc"): number {
  return sortOrder === "asc" ? left.getTime() - right.getTime() : right.getTime() - left.getTime();
}

function sortCustomersList(
  list: CustomerRow[],
  sortBy: NonNullable<ListCustomersQuery["sortBy"]>,
  sortOrder: NonNullable<ListCustomersQuery["sortOrder"]>
): CustomerRow[] {
  return [...list].sort((left, right) => {
    switch (sortBy) {
      case "lastName":
        return compareNullableStrings(left.lastName, right.lastName, sortOrder);
      case "lastServiceDate":
        return compareNullableStrings(left.lastServiceDate, right.lastServiceDate, sortOrder);
      case "lifetimeValue":
        return compareNullableNumbers(left.lifetimeValue, right.lifetimeValue, sortOrder);
      case "createdAt":
        return compareDates(left.createdAt, right.createdAt, sortOrder);
    }
  });
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow | null> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  return actor ?? null;
}

async function getCustomerRecord(
  companyId: string,
  customerId: string,
  executor: SelectExecutor
): Promise<CustomerRow> {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  return customer;
}

async function listCustomerProperties(
  companyId: string,
  customerId: string,
  executor: SelectExecutor
): Promise<PropertyRow[]> {
  return executor
    .select()
    .from(properties)
    .where(and(eq(properties.companyId, companyId), eq(properties.customerId, customerId), isNull(properties.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function listCustomerAssets(
  companyId: string,
  customerId: string,
  executor: SelectExecutor
): Promise<AssetRow[]> {
  return executor
    .select()
    .from(assets)
    .where(and(eq(assets.companyId, companyId), eq(assets.customerId, customerId), isNull(assets.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

function buildCustomerGraph(customer: CustomerRow, propertyRows: PropertyRow[], assetRows: AssetRow[]): CustomerWithGraph {
  const assetsByPropertyId = new Map<string, AssetRow[]>();

  for (const asset of assetRows) {
    const existingAssets = assetsByPropertyId.get(asset.propertyId) ?? [];
    existingAssets.push(asset);
    assetsByPropertyId.set(asset.propertyId, existingAssets);
  }

  return {
    ...customer,
    properties: propertyRows.map((property) => ({
      ...property,
      assets: assetsByPropertyId.get(property.id) ?? []
    }))
  };
}

export async function listCustomers(
  companyId: string,
  query: ListCustomersQuery
): Promise<PaginatedResult<Customer>> {
  const normalizedQuery = normalizeListCustomersQuery(query);
  const companyCustomers = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
  const normalizedSearch = normalizedQuery.search ? normalizeSearchValue(normalizedQuery.search) : null;
  const normalizedTags = normalizedQuery.tags ? normalizeTags(normalizedQuery.tags) ?? [] : null;

  let filteredCustomers = companyCustomers.filter((customer) => {
    if (normalizedSearch && !matchesCustomerSearch(customer, normalizedSearch)) {
      return false;
    }

    if (normalizedTags && normalizedTags.length > 0 && !matchesTagFilter(customer, normalizedTags)) {
      return false;
    }

    return true;
  });

  if (normalizedQuery.status !== undefined) {
    filteredCustomers = filteredCustomers.filter((customer) =>
      normalizedQuery.status === "active" ? !isCustomerDormant(customer) : isCustomerDormant(customer)
    );
  }

  if (normalizedQuery.hasActiveMaintenancePlan !== undefined) {
    const companyPlans = await db
      .select()
      .from(maintenancePlans)
      .where(and(eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
      .limit(MAX_RESULT_WINDOW);
    const activePlanCustomerIds = new Set(
      companyPlans.filter((plan) => plan.status === "active").map((plan) => plan.customerId)
    );

    filteredCustomers = filteredCustomers.filter((customer) =>
      normalizedQuery.hasActiveMaintenancePlan
        ? activePlanCustomerIds.has(customer.id)
        : !activePlanCustomerIds.has(customer.id)
    );
  }

  if (normalizedQuery.hasOverdueInvoice !== undefined) {
    const companyInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
      .limit(MAX_RESULT_WINDOW);
    const overdueInvoiceCustomerIds = new Set(
      companyInvoices.filter((invoice) => hasOverdueInvoice(invoice)).map((invoice) => invoice.customerId)
    );

    filteredCustomers = filteredCustomers.filter((customer) =>
      normalizedQuery.hasOverdueInvoice
        ? overdueInvoiceCustomerIds.has(customer.id)
        : !overdueInvoiceCustomerIds.has(customer.id)
    );
  }

  const sortedCustomers = sortCustomersList(filteredCustomers, normalizedQuery.sortBy, normalizedQuery.sortOrder);
  const total = sortedCustomers.length;
  const offset = (normalizedQuery.page - 1) * normalizedQuery.limit;
  const paginatedCustomers = sortedCustomers.slice(offset, offset + normalizedQuery.limit);

  return {
    data: paginatedCustomers,
    total,
    page: normalizedQuery.page,
    limit: normalizedQuery.limit,
    totalPages: Math.ceil(total / normalizedQuery.limit)
  };
}

export async function searchCustomers(companyId: string, query: string): Promise<Customer[]> {
  const normalizedQuery = normalizeSearchValue(query);
  const companyCustomers = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(MAX_RESULT_WINDOW);

  return companyCustomers.filter((customer) => matchesCustomerSearch(customer, normalizedQuery)).slice(0, 10);
}

export async function getCustomer(companyId: string, customerId: string): Promise<CustomerWithGraph> {
  const customer = await getCustomerRecord(companyId, customerId, db);
  const [propertyRows, assetRows] = await Promise.all([
    listCustomerProperties(companyId, customerId, db),
    listCustomerAssets(companyId, customerId, db)
  ]);

  return buildCustomerGraph(customer, propertyRows, assetRows);
}

export async function createCustomer(
  companyId: string,
  actorId: string,
  input: CreateCustomerInput
): Promise<Customer> {
  const normalizedTags = normalizeTags(input.tags) ?? [];

  return runTenantAwareTransaction(companyId, async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const insertedCustomers = await tx
      .insert(customers)
      .values({
        companyId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        displayName: normalizeOptionalString(input.displayName) ?? null,
        email: normalizeOptionalEmail(input.email) ?? null,
        phone: normalizeOptionalString(input.phone) ?? null,
        altPhone: normalizeOptionalString(input.altPhone) ?? null,
        leadSource: normalizeOptionalString(input.leadSource) ?? null,
        tags: normalizedTags,
        internalNotes: normalizeOptionalString(input.internalNotes) ?? null,
        prefersSms: input.prefersSms ?? true,
        prefersEmail: input.prefersEmail ?? true,
        doNotContact: input.doNotContact ?? false,
        firstServiceDate: null
      })
      .returning();
    const customer = insertedCustomers[0];

    if (!customer) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create customer");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "customer.created",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "customer",
      entityId: customer.id,
      customerId: customer.id,
      payload: {
        email: customer.email,
        phone: customer.phone
      },
      summary: `Customer ${customer.firstName} ${customer.lastName} created`
    });

    return customer;
  });
}

export async function updateCustomer(
  companyId: string,
  actorId: string,
  customerId: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  const existingCustomer = await getCustomerRecord(companyId, customerId, db);
  const normalizedTags = input.tags ? normalizeTags(input.tags) ?? [] : undefined;
  const updateValues = {
    ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
    ...(input.displayName !== undefined ? { displayName: normalizeOptionalString(input.displayName) ?? null } : {}),
    ...(input.email !== undefined ? { email: normalizeOptionalEmail(input.email) ?? null } : {}),
    ...(input.phone !== undefined ? { phone: normalizeOptionalString(input.phone) ?? null } : {}),
    ...(input.altPhone !== undefined ? { altPhone: normalizeOptionalString(input.altPhone) ?? null } : {}),
    ...(input.leadSource !== undefined ? { leadSource: normalizeOptionalString(input.leadSource) ?? null } : {}),
    ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
    ...(input.internalNotes !== undefined ? { internalNotes: normalizeOptionalString(input.internalNotes) ?? null } : {}),
    ...(input.prefersSms !== undefined ? { prefersSms: input.prefersSms } : {}),
    ...(input.prefersEmail !== undefined ? { prefersEmail: input.prefersEmail } : {}),
    ...(input.doNotContact !== undefined ? { doNotContact: input.doNotContact } : {})
  };

  if (Object.keys(updateValues).length === 0) {
    return existingCustomer;
  }

  return db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updatedCustomers = await tx
      .update(customers)
      .set({
        ...updateValues,
        updatedAt: new Date()
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .returning();
    const updatedCustomer = updatedCustomers[0];

    if (!updatedCustomer) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "customer.updated",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "customer",
      entityId: updatedCustomer.id,
      customerId: updatedCustomer.id,
      payload: updateValues,
      summary: `Customer ${updatedCustomer.firstName} ${updatedCustomer.lastName} updated`
    });

    return updatedCustomer;
  });
}

export async function deleteCustomer(companyId: string, actorId: string, customerId: string): Promise<void> {
  const existingCustomer = await getCustomerRecord(companyId, customerId, db);

  await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const [propertyRows, assetRows] = await Promise.all([
      listCustomerProperties(companyId, customerId, tx),
      listCustomerAssets(companyId, customerId, tx)
    ]);
    const deletedAt = new Date();

    await tx
      .update(customers)
      .set({
        deletedAt,
        updatedAt: deletedAt
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)));

    await tx
      .update(properties)
      .set({
        deletedAt,
        updatedAt: deletedAt
      })
      .where(and(eq(properties.companyId, companyId), eq(properties.customerId, customerId), isNull(properties.deletedAt)));

    await tx
      .update(assets)
      .set({
        deletedAt,
        updatedAt: deletedAt
      })
      .where(and(eq(assets.companyId, companyId), eq(assets.customerId, customerId), isNull(assets.deletedAt)));

    for (const asset of assetRows) {
      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "asset.deleted",
        actorId,
        actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
        entityType: "asset",
        entityId: asset.id,
        customerId,
        payload: {
          propertyId: asset.propertyId
        },
        summary: `Asset ${asset.name} deleted`
      });
    }

    for (const property of propertyRows) {
      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "property.deleted",
        actorId,
        actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
        entityType: "property",
        entityId: property.id,
        customerId,
        payload: {
          addressLine1: property.addressLine1
        },
        summary: `Property ${property.addressLine1} deleted`
      });
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "customer.deleted",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "customer",
      entityId: existingCustomer.id,
      customerId: existingCustomer.id,
      summary: `Customer ${existingCustomer.firstName} ${existingCustomer.lastName} deleted`
    });
  });
}

type CustomerNoteRow = typeof customerNotes.$inferSelect;

function toCustomerNote(row: CustomerNoteRow): CustomerNote {
  return {
    id: row.id,
    companyId: row.companyId,
    customerId: row.customerId,
    authorId: row.authorId,
    content: row.content,
    isInternal: row.isInternal,
    notedAt: row.notedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

export interface CreateCustomerNoteInput {
  content: string;
  isInternal?: boolean | undefined;
  notedAt?: string | undefined;
}

/** Create a native (non-imported) note on a tenant-owned customer. 404 when the customer is not in this company. */
export async function createCustomerNote(
  companyId: string,
  actorId: string,
  customerId: string,
  input: CreateCustomerNoteInput
): Promise<CustomerNote> {
  await getCustomerRecord(companyId, customerId, db);

  const [row] = await db
    .insert(customerNotes)
    .values({
      companyId,
      customerId,
      authorId: actorId,
      content: input.content.trim(),
      isInternal: input.isInternal ?? true,
      notedAt: input.notedAt ? new Date(input.notedAt) : new Date()
    })
    .returning();

  if (!row) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create customer note");
  }

  return toCustomerNote(row);
}

export async function getCustomerNotes(companyId: string, customerId: string): Promise<CustomerNote[]> {
  await getCustomerRecord(companyId, customerId, db);

  const rows = await db
    .select()
    .from(customerNotes)
    .where(
      and(eq(customerNotes.companyId, companyId), eq(customerNotes.customerId, customerId), isNull(customerNotes.deletedAt))
    )
    .orderBy(desc(customerNotes.notedAt), desc(customerNotes.createdAt));

  return rows.map(toCustomerNote);
}
