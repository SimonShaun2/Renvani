import type { ColumnMapping } from "@fsm/types";

export interface CustomerImportRow {
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  tags: string[];
}

export interface ExistingCustomerForDedupe {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
}

export interface CustomerDuplicateMatch {
  customer: ExistingCustomerForDedupe;
  reason: "email" | "phone" | "name";
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeEmailValue(value: string | null | undefined): string | null {
  const normalized = normalizeTextValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizePhoneValue(value: string | null | undefined): string | null {
  const normalized = normalizeTextValue(value);
  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/\D/gu, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function normalizeCustomerNameValue(value: string | null | undefined): string | null {
  const normalized = normalizeTextValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

function getMappedCustomerName(mappedRow: CustomerImportRow): string | null {
  if (mappedRow.displayName) {
    return mappedRow.displayName;
  }

  const fullName = `${mappedRow.firstName} ${mappedRow.lastName}`.trim();
  return fullName.length > 0 ? fullName : null;
}

export function mapCustomerRow(values: Record<string, string>, columnMapping: ColumnMapping): CustomerImportRow {
  const mappedValues: Record<string, string> = {};

  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }

    mappedValues[fieldName] = values[csvColumn] ?? "";
  }

  const firstName = normalizeTextValue(mappedValues.firstName);
  const lastName = normalizeTextValue(mappedValues.lastName);
  const displayName = normalizeTextValue(mappedValues.displayName);

  return {
    firstName: firstName ?? (displayName ?? ""),
    lastName: lastName ?? "",
    displayName,
    email: normalizeEmailValue(mappedValues.email),
    phone: normalizeTextValue(mappedValues.phone),
    altPhone: normalizeTextValue(mappedValues.altPhone),
    addressLine1: normalizeTextValue(mappedValues.addressLine1),
    city: normalizeTextValue(mappedValues.city),
    state: normalizeTextValue(mappedValues.state),
    zip: normalizeTextValue(mappedValues.zip),
    notes: normalizeTextValue(mappedValues.notes),
    tags:
      normalizeTextValue(mappedValues.tags)
        ?.split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? []
  };
}

export function buildCustomerLookupMaps(existingCustomers: ExistingCustomerForDedupe[]) {
  const emailMap = new Map<string, ExistingCustomerForDedupe>();
  const phoneMap = new Map<string, ExistingCustomerForDedupe>();
  const nameMap = new Map<string, ExistingCustomerForDedupe>();

  for (const customer of existingCustomers) {
    const normalizedEmail = normalizeEmailValue(customer.email);
    const normalizedPhone = normalizePhoneValue(customer.phone);
    const normalizedName = normalizeCustomerNameValue(
      customer.displayName ?? `${customer.firstName} ${customer.lastName}`.trim()
    );

    if (normalizedEmail && !emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, customer);
    }

    if (normalizedPhone && !phoneMap.has(normalizedPhone)) {
      phoneMap.set(normalizedPhone, customer);
    }

    if (normalizedName && !nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, customer);
    }
  }

  return {
    emailMap,
    phoneMap,
    nameMap
  };
}

export function findDuplicateCustomer(
  mappedRow: CustomerImportRow,
  lookupMaps: ReturnType<typeof buildCustomerLookupMaps>
): CustomerDuplicateMatch | null {
  const normalizedEmail = normalizeEmailValue(mappedRow.email);
  if (normalizedEmail) {
    const customer = lookupMaps.emailMap.get(normalizedEmail);
    if (customer) {
      return { customer, reason: "email" };
    }
  }

  const normalizedPhone = normalizePhoneValue(mappedRow.phone);
  if (normalizedPhone) {
    const customer = lookupMaps.phoneMap.get(normalizedPhone);
    if (customer) {
      return { customer, reason: "phone" };
    }
  }

  const normalizedName = normalizeCustomerNameValue(getMappedCustomerName(mappedRow));
  if (normalizedName) {
    const customer = lookupMaps.nameMap.get(normalizedName);
    if (customer) {
      return { customer, reason: "name" };
    }
  }

  return null;
}

export function buildDedupeCollisionKey(importSessionId: string, rowNumber: number): string {
  return `${importSessionId}:${rowNumber}`;
}
