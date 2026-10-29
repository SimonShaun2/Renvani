"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useCustomer, useCustomerProperties } from "@/src/hooks/customers.hooks";
import { useCustomerSearch } from "@/src/hooks/dispatch.hooks";
import { useCreateJob } from "@/src/hooks/jobs.hooks";
import { useTechnicians } from "@/src/hooks/technicians.hooks";

import {
  NEW_JOB_COPY,
  NEW_JOB_FIELDS,
  buildCreateJobPayload,
  emptyNewJobValues,
  validateNewJob,
  type NewJobErrors,
  type NewJobField,
  type NewJobFieldKey,
  type NewJobValues
} from "./newJob.config";

const inputClass =
  "w-full rounded-[10px] border border-[#e6dccb] bg-white px-3.5 py-3 text-[15px] text-[#0f1530] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f1530] disabled:bg-[#f3eadc]";

function customerName(c: { firstName: string; lastName: string; displayName: string | null }): string {
  return c.displayName?.trim() || `${c.firstName} ${c.lastName}`.trim();
}

export function NewJobPanel({ initialCustomerId = "" }: { initialCustomerId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<NewJobValues>(() => emptyNewJobValues(initialCustomerId));
  const [errors, setErrors] = useState<NewJobErrors>({});
  const [search, setSearch] = useState("");
  const createJob = useCreateJob();

  const customer = useCustomer(values.customerId || null);
  const properties = useCustomerProperties(values.customerId || null);
  const customerSearch = useCustomerSearch(values.customerId ? "" : search);
  const technicians = useTechnicians({ status: "active", page: 1, limit: 100, sortBy: "firstName", sortOrder: "asc" });

  const selectedCustomer = customer.data?.customer.id === values.customerId ? customer.data.customer : null;
  const customerLookupError = values.customerId && customer.isError ? "Customer unavailable. Choose another customer." : undefined;
  const fieldError = (key: NewJobFieldKey) => key === "customerId" ? customerLookupError ?? errors.customerId : errors[key];
  const propertyList = properties.data?.properties ?? [];
  useEffect(() => {
    if (propertyList.length === 1 && !values.propertyId) setValues((v) => ({ ...v, propertyId: propertyList[0]!.id }));
  }, [propertyList, values.propertyId]);

  const set = (key: NewJobFieldKey, value: string) => {
    setValues((v) => ({ ...v, [key]: value, ...(key === "customerId" ? { propertyId: "" } : {}) }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateNewJob(values);
    if (values.customerId && !selectedCustomer) {
      nextErrors.customerId = customerLookupError ?? "Wait for the customer to load";
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    createJob.mutate(buildCreateJobPayload(values), {
      onSuccess: (data) => router.push(`/jobs/${data.job.id}`)
    });
  };

  const busy = createJob.isPending;
  const customerLoading = Boolean(values.customerId && !selectedCustomer && !customer.isError);

  const renderControl = (field: NewJobField) => {
    const id = `new-job-${field.key}`;
    const describedBy = fieldError(field.key) ? `${id}-error` : undefined;
    const common = { id, "aria-invalid": Boolean(fieldError(field.key)) || undefined, "aria-describedby": describedBy, disabled: busy };

    switch (field.kind) {
      case "customer":
        if (values.customerId) {
          return (
            <div className="flex items-center justify-between rounded-[10px] border border-[#e6dccb] bg-white px-3.5 py-3" role="group" aria-labelledby="new-job-customerId-label" aria-describedby={describedBy} data-testid="new-job-customer">
              <div>
                <p className="text-[15px] font-semibold text-[#0f1530]">{selectedCustomer ? customerName(selectedCustomer) : customer.isError ? "Customer unavailable" : "Loading…"}</p>
                {selectedCustomer?.phone || selectedCustomer?.email ? <p className="text-[13px] text-[#5e6684]">{selectedCustomer.phone ?? selectedCustomer.email}</p> : null}
              </div>
              <button type="button" className="text-sm font-semibold text-[#2a3360] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f1530]" onClick={() => set("customerId", "")} disabled={busy}>
                {NEW_JOB_COPY.customerChange}
              </button>
            </div>
          );
        }
        return (
          <div>
            <input
              {...common}
              type="search"
              className={inputClass}
              placeholder={NEW_JOB_COPY.customerSearchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {(customerSearch.data?.customers ?? []).length > 0 ? (
              <ul className="mt-1 divide-y divide-[#e6dccb] rounded-[10px] border border-[#e6dccb] bg-white" aria-label="Customers">
                {customerSearch.data!.customers.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#fbf6ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f1530]" onClick={() => set("customerId", c.id)}>
                      <span className="font-medium text-[#0f1530]">{customerName(c)}</span>
                      {c.phone || c.email ? <span className="ml-2 text-[#5e6684]">{c.phone ?? c.email}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      case "property":
        return (
          <select {...common} className={inputClass} value={values.propertyId} onChange={(e) => set("propertyId", e.target.value)} disabled={busy || !values.customerId || propertyList.length === 0}>
            <option value="">{values.customerId && properties.isSuccess && propertyList.length === 0 ? NEW_JOB_COPY.noProperties : "—"}</option>
            {propertyList.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.addressLine1, p.city, p.state].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
        );
      case "technician":
        return (
          <select {...common} className={inputClass} value={values.technicianId} onChange={(e) => set("technicianId", e.target.value)}>
            <option value="">{NEW_JOB_COPY.unassigned}</option>
            {(technicians.data?.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{`${t.firstName} ${t.lastName}`.trim()}</option>
            ))}
          </select>
        );
      case "select":
        return (
          <select {...common} className={inputClass} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)}>
            {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "datetime":
        return <input {...common} type="datetime-local" className={inputClass} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)} />;
      case "textarea":
        return <textarea {...common} rows={3} maxLength={field.maxLength} placeholder={field.placeholder} className={inputClass} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)} />;
      default:
        return <input {...common} type="text" maxLength={field.maxLength} placeholder={field.placeholder} className={inputClass} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)} />;
    }
  };

  return (
    <section aria-labelledby="new-job-title" className="new-job-panel rounded-[14px] border border-[#e6dccb] bg-white p-6" data-new-job-reveal>
      <p className="font-mono text-[10px] font-medium tracking-wide text-[#5e6684]">{NEW_JOB_COPY.eyebrow}</p>
      <h2 id="new-job-title" className="mt-1 text-[20px] font-semibold text-[#0f1530]">{NEW_JOB_COPY.title}</h2>
      <p className="mt-1 text-sm text-[#5e6684]">{NEW_JOB_COPY.subtitle}</p>

      <form className="mt-5 grid grid-cols-2 gap-4" onSubmit={onSubmit} noValidate>
        {NEW_JOB_FIELDS.map((field) => (
          <div key={field.key} className={field.span === 2 ? "col-span-2" : "col-span-1"}>
            {field.key === "customerId" && values.customerId ? (
              <p id="new-job-customerId-label" className="mb-1.5 block text-[13px] font-medium text-[#2a3360]">
                {field.label} <span aria-hidden="true">*</span>
              </p>
            ) : (
              <label htmlFor={`new-job-${field.key}`} className="mb-1.5 block text-[13px] font-medium text-[#2a3360]">
                {field.label}
                {field.required ? <span aria-hidden="true"> *</span> : null}
              </label>
            )}
            {renderControl(field)}
            {fieldError(field.key) ? (
              <p id={`new-job-${field.key}-error`} role={field.key === "customerId" && customerLookupError ? "alert" : undefined} className="mt-1 text-[13px] text-[#b42318]">{fieldError(field.key)}</p>
            ) : null}
          </div>
        ))}

        {createJob.isError ? (
          <p role="alert" className="col-span-2 rounded-[10px] bg-[#fdecea] px-3.5 py-3 text-sm font-medium text-[#b42318]">
            {NEW_JOB_COPY.submitError}
          </p>
        ) : null}

        <div className="col-span-2 flex justify-end gap-3">
          <Link href="/jobs" className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
            {NEW_JOB_COPY.cancel}
          </Link>
          <button type="submit" disabled={busy || customerLoading} className="rounded-[10px] bg-[#0f1530] px-[18px] py-3 text-sm font-semibold text-white hover:bg-[#2a3360] disabled:opacity-60">
            {busy ? NEW_JOB_COPY.submitting : NEW_JOB_COPY.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
