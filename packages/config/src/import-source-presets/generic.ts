import type { ImportSourcePreset } from "./types.js";

export const GENERIC_NOTES_PRESET: ImportSourcePreset = {
  id: "generic",
  entity: "notes",
  label: "Generic notes CSV",
  headerAliases: {
    "note id": "sourceId",
    id: "sourceId",
    "customer id": "customerSourceId",
    "client id": "customerSourceId",
    "job id": "jobSourceId",
    "work order id": "jobSourceId",
    note: "content",
    body: "content",
    text: "content",
    visibility: "visibility",
    type: "visibility",
    internal: "isInternal",
    "created at": "notedAt",
    created: "notedAt",
    date: "notedAt"
  }
};

export const GENERIC_SERVICE_AGREEMENTS_PRESET: ImportSourcePreset = {
  id: "generic",
  entity: "service_agreements",
  label: "Generic service agreements CSV",
  headerAliases: {
    "agreement id": "sourceId",
    agreement_id: "sourceId",
    id: "sourceId",
    "plan id": "sourceId",
    "customer id": "customerSourceId",
    customer_id: "customerSourceId",
    "client id": "customerSourceId",
    "plan name": "name",
    plan_name: "name",
    name: "name",
    agreement: "name",
    "next service": "nextServiceDate",
    "next service date": "nextServiceDate",
    "next due": "nextServiceDate",
    "next due date": "nextServiceDate",
    next_due_date: "nextServiceDate",
    "start date": "startDate",
    start_date: "startDate",
    started: "startDate",
    frequency: "frequency",
    cadence: "frequency",
    status: "status",
    price: "price",
    amount: "price",
    "annual price": "price",
    annual_price: "price",
  },
};

export const GENERIC_CUSTOMER_PRESET: ImportSourcePreset = {
  id: "generic",
  entity: "customers",
  label: "Generic CSV",
  headerAliases: {
    firstname: "firstName",
    "first name": "firstName",
    lastname: "lastName",
    "last name": "lastName",
    email: "email",
    phone: "phone",
    address: "addressLine1",
    city: "city",
    state: "state",
    zip: "zip"
  }
};
