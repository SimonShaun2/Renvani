import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  CreateAssetInput,
  CreateCustomerInput,
  CreatePropertyInput,
  ListCustomersQuery,
  UpdateAssetInput,
  UpdateCustomerInput,
  UpdatePropertyInput
} from "@fsm/types";

import {
  createAsset,
  deleteAsset,
  getAsset,
  updateAsset
} from "../../services/asset.service.js";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerNotes,
  listCustomers,
  searchCustomers,
  updateCustomer
} from "../../services/customer.service.js";
import { getCustomerImportedHistory } from "../../services/customer-imported-history.service.js";
import {
  createProperty,
  deleteProperty,
  getProperty,
  listProperties,
  updateProperty
} from "../../services/property.service.js";
import type {
  AssetIdParams,
  CustomerIdParams,
  PropertyIdParams,
  SearchCustomersQuery,
} from "./schemas.js";

function toCustomerListItem(customer: {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  lifetimeValue: string | null;
  totalJobs: number | null;
  lastServiceDate: string | null;
  doNotContact: boolean | null;
  createdAt: Date;
}) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    tags: customer.tags ?? [],
    lifetimeValue: customer.lifetimeValue ?? "0",
    totalJobs: customer.totalJobs ?? 0,
    lastServiceDate: customer.lastServiceDate,
    doNotContact: customer.doNotContact ?? false,
    createdAt: customer.createdAt.toISOString()
  };
}

function toAssetResponse(asset: {
  id: string;
  companyId: string;
  propertyId: string;
  customerId: string;
  name: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiration: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "failed" | null;
  conditionNotes: string | null;
  conditionScore: number | null;
  replacementProbability: string | null;
  photoUrls: string[] | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: asset.id,
    companyId: asset.companyId,
    propertyId: asset.propertyId,
    customerId: asset.customerId,
    name: asset.name,
    assetType: asset.assetType,
    brand: asset.brand,
    model: asset.model,
    serialNumber: asset.serialNumber,
    installDate: asset.installDate,
    warrantyExpiration: asset.warrantyExpiration,
    lastServiceDate: asset.lastServiceDate,
    nextServiceDate: asset.nextServiceDate,
    condition: asset.condition,
    conditionNotes: asset.conditionNotes,
    conditionScore: asset.conditionScore,
    replacementProbability: asset.replacementProbability,
    photoUrls: asset.photoUrls ?? [],
    notes: asset.notes,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    deletedAt: asset.deletedAt?.toISOString() ?? null
  };
}

function toPropertyResponse(property: {
  id: string;
  companyId: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string | null;
  lat: string | null;
  lng: string | null;
  type: "residential" | "commercial" | "industrial" | "multi_family";
  sqft: number | null;
  yearBuilt: number | null;
  accessNotes: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: property.id,
    companyId: property.companyId,
    customerId: property.customerId,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    state: property.state,
    zip: property.zip,
    country: property.country,
    lat: property.lat,
    lng: property.lng,
    type: property.type,
    sqft: property.sqft,
    yearBuilt: property.yearBuilt,
    accessNotes: property.accessNotes,
    notes: property.notes,
    isPrimary: property.isPrimary,
    isActive: property.isActive,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    deletedAt: property.deletedAt?.toISOString() ?? null
  };
}

function toPropertyWithAssetsResponse(property: {
  id: string;
  companyId: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string | null;
  lat: string | null;
  lng: string | null;
  type: "residential" | "commercial" | "industrial" | "multi_family";
  sqft: number | null;
  yearBuilt: number | null;
  accessNotes: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  assets: Array<Parameters<typeof toAssetResponse>[0]>;
}) {
  return {
    ...toPropertyResponse(property),
    assets: property.assets.map((asset) => toAssetResponse(asset))
  };
}

function toCustomerResponse(customer: {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  leadSource: string | null;
  referredBy: string | null;
  tags: string[] | null;
  internalNotes: string | null;
  lifetimeValue: string | null;
  totalJobs: number | null;
  lastServiceDate: string | null;
  firstServiceDate: string | null;
  prefersSms: boolean | null;
  prefersEmail: boolean | null;
  doNotContact: boolean | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: customer.id,
    companyId: customer.companyId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    altPhone: customer.altPhone,
    leadSource: customer.leadSource,
    referredBy: customer.referredBy,
    tags: customer.tags ?? [],
    internalNotes: customer.internalNotes,
    lifetimeValue: customer.lifetimeValue ?? "0",
    totalJobs: customer.totalJobs ?? 0,
    lastServiceDate: customer.lastServiceDate,
    firstServiceDate: customer.firstServiceDate,
    prefersSms: customer.prefersSms ?? true,
    prefersEmail: customer.prefersEmail ?? true,
    doNotContact: customer.doNotContact ?? false,
    stripeCustomerId: customer.stripeCustomerId,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    deletedAt: customer.deletedAt?.toISOString() ?? null
  };
}

export async function listCustomersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await listCustomers(request.company.id, request.query as ListCustomersQuery);

  return reply.send({
    data: result.data.map((customer) => toCustomerListItem(customer)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function searchCustomersHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await searchCustomers(request.company.id, (request.query as SearchCustomersQuery).q);

  return reply.send({
    customers: result.map((customer) => toCustomerListItem(customer))
  });
}

export async function createCustomerHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const customer = await createCustomer(
    request.company.id,
    request.user.id,
    request.body as CreateCustomerInput
  );

  return reply.status(201).send({
    customer: toCustomerResponse(customer)
  });
}

export async function getCustomerHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const customer = await getCustomer(request.company.id, params.id);

  return reply.send({
    customer: {
      ...toCustomerResponse(customer),
      properties: customer.properties.map((property) => toPropertyWithAssetsResponse(property))
    }
  });
}

export async function getCustomerImportedHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const history = await getCustomerImportedHistory(request.company.id, params.id);
  return reply.send(history);
}

export async function getCustomerNotesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const notes = await getCustomerNotes(request.company.id, params.id);

  return reply.send({
    notes: notes.map((note) => ({
      id: note.id,
      companyId: note.companyId,
      customerId: note.customerId,
      authorId: note.authorId,
      content: note.content,
      isInternal: note.isInternal,
      notedAt: note.notedAt?.toISOString() ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      deletedAt: note.deletedAt?.toISOString() ?? null
    }))
  });
}

export async function updateCustomerHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const customer = await updateCustomer(
    request.company.id,
    request.user.id,
    params.id,
    request.body as UpdateCustomerInput
  );

  return reply.send({
    customer: toCustomerResponse(customer)
  });
}

export async function deleteCustomerHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  await deleteCustomer(request.company.id, request.user.id, params.id);

  return reply.status(204).send();
}

export async function listPropertiesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const result = await listProperties(request.company.id, params.id);

  return reply.send({
    properties: result.map((property) => toPropertyResponse(property))
  });
}

export async function createPropertyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as CustomerIdParams;
  const property = await createProperty(
    request.company.id,
    request.user.id,
    params.id,
    request.body as CreatePropertyInput
  );

  return reply.status(201).send({
    property: toPropertyResponse(property)
  });
}

export async function getPropertyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as PropertyIdParams;
  const property = await getProperty(request.company.id, params.id, params.propertyId);

  return reply.send({
    property: toPropertyWithAssetsResponse(property)
  });
}

export async function updatePropertyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as PropertyIdParams;
  const property = await updateProperty(
    request.company.id,
    request.user.id,
    params.id,
    params.propertyId,
    request.body as UpdatePropertyInput
  );

  return reply.send({
    property: toPropertyResponse(property)
  });
}

export async function deletePropertyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as PropertyIdParams;
  await deleteProperty(request.company.id, request.user.id, params.id, params.propertyId);

  return reply.status(204).send();
}

export async function createAssetHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as PropertyIdParams;
  const asset = await createAsset(
    request.company.id,
    request.user.id,
    params.id,
    params.propertyId,
    request.body as CreateAssetInput
  );

  return reply.status(201).send({
    asset: toAssetResponse(asset)
  });
}

export async function getAssetHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as AssetIdParams;
  const asset = await getAsset(request.company.id, params.id, params.propertyId, params.assetId);

  return reply.send({
    asset: {
      ...toAssetResponse(asset),
      jobCount: asset.jobCount
    }
  });
}

export async function updateAssetHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as AssetIdParams;
  const asset = await updateAsset(
    request.company.id,
    request.user.id,
    params.id,
    params.propertyId,
    params.assetId,
    request.body as UpdateAssetInput
  );

  return reply.send({
    asset: toAssetResponse(asset)
  });
}

export async function deleteAssetHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as AssetIdParams;
  await deleteAsset(request.company.id, request.user.id, params.id, params.propertyId, params.assetId);

  return reply.status(204).send();
}
