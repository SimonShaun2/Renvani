"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { api } from "@/src/lib/api";
import { useCustomer, useCustomerProperties } from "@/src/hooks/customers.hooks";
import { useCustomerSearch } from "@/src/hooks/dispatch.hooks";
import { useCreateJob } from "@/src/hooks/jobs.hooks";
import { usePriceBookItemSearch } from "@/src/hooks/price-book.hooks";
import { useStripeConnectStatus } from "@/src/hooks/stripe-connect.hooks";
import { useTechnicians } from "@/src/hooks/technicians.hooks";

import {
  NEW_JOB_COPY,
  NEW_JOB_FIELDS,
  addLineItem,
  buildCreateJobPayload,
  emptyNewJobValues,
  formatMoney,
  isMissingRequired,
  lineItemsSubtotal,
  newJobServiceFeeLabel,
  toAddJobProductInput,
  validateNewJob,
  type NewJobErrors,
  type NewJobField,
  type NewJobFieldKey,
  type NewJobLineItem,
  type NewJobValues
} from "./newJob.config";

const inputBase =
  "w-full rounded-[10px] border bg-white px-3.5 py-3 text-[15px] text-[#0f1530] placeholder:text-[#8a90a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f1530] disabled:bg-[#f3eadc]";
const inputClass = (invalid: boolean) => `${inputBase} ${invalid ? "border-[#b42318]" : "border-[#e6dccb]"}`;

function customerName(c: { firstName: string; lastName: string; displayName: string | null }): string {
  return c.displayName?.trim() || `${c.firstName} ${c.lastName}`.trim();
}

export function NewJobPanel({ initialCustomerId = "" }: { initialCustomerId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<NewJobValues>(() => emptyNewJobValues(initialCustomerId));
  const [errors, setErrors] = useState<NewJobErrors>({});
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<NewJobLineItem[]>([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [itemsFailed, setItemsFailed] = useState(false);
  const [addingItems, setAddingItems] = useState(false);
  const createJob = useCreateJob();

  const customer = useCustomer(values.customerId || null);
  const properties = useCustomerProperties(values.customerId || null);
  const customerSearch = useCustomerSearch(values.customerId ? "" : search);
  const technicians = useTechnicians({ status: "active", page: 1, limit: 100, sortBy: "firstName", sortOrder: "asc" });
  const priceBook = usePriceBookItemSearch(itemPickerOpen ? itemSearch.trim() : "");
  const connect = useStripeConnectStatus();
  const feeLabel = newJobServiceFeeLabel(connect.data?.platformFeePercent);

  const propertyList = properties.data?.properties ?? [];
  const autofilled = propertyList.length === 1 && values.propertyId === propertyList[0]!.id;
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
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    createJob.mutate(buildCreateJobPayload(values), {
      onSuccess: async (data) => {
        const jobId = data.job.id;
        if (items.length > 0) {
          setAddingItems(true);
          const results = await Promise.allSettled(items.map((item) => api.post(`/api/v1/jobs/${jobId}/products`, toAddJobProductInput(item))));
          setAddingItems(false);
          if (results.some((r) => r.status === "rejected")) setItemsFailed(true);
        }
        router.push(`/jobs/${jobId}`);
      }
    });
  };

  const busy = createJob.isPending || addingItems;
  const subtotal = lineItemsSubtotal(items);
  const showBanner = isMissingRequired(errors);

  const hint = (text: string) => <p className="mt-1 font-mono text-[11px] text-[#5e6684]">{text}</p>;

  const renderControl = (field: NewJobField) => {
    const id = `new-job-${field.key}`;
    const invalid = Boolean(errors[field.key]);
    const describedBy = invalid ? `${id}-error` : undefined;
    const common = { id, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, disabled: busy };

    switch (field.kind) {
      case "customer":
        if (values.customerId) {
          const record = customer.data?.customer;
          return (
            <>
              <div className="flex items-center justify-between rounded-[10px] border border-[#e6dccb] bg-white px-3.5 py-3" data-testid="new-job-customer">
                <div>
                  <p className="text-[15px] text-[#0f1530]">{record ? customerName(record) : customer.isError ? "—" : "Loading…"}</p>
                  {record?.phone || record?.email ? <p className="text-[13px] text-[#5e6684]">{record.phone ?? record.email}</p> : null}
                </div>
                <button type="button" className="text-sm font-semibold text-[#2a3360] underline" onClick={() => set("customerId", "")} disabled={busy}>
                  {NEW_JOB_COPY.customerChange}
                </button>
              </div>
              {initialCustomerId && values.customerId === initialCustomerId ? hint(NEW_JOB_COPY.customerPreselected) : null}
            </>
          );
        }
        return (
          <div>
            <input
              {...common}
              type="search"
              className={inputClass(invalid)}
              placeholder={NEW_JOB_COPY.customerSearchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {(customerSearch.data?.customers ?? []).length > 0 ? (
              <ul className="mt-1 divide-y divide-[#e6dccb] rounded-[10px] border border-[#e6dccb] bg-white" role="listbox" aria-label="Customers">
                {customerSearch.data!.customers.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#fbf6ef]" onClick={() => set("customerId", c.id)}>
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
          <>
            <select {...common} className={inputClass(invalid)} value={values.propertyId} onChange={(e) => set("propertyId", e.target.value)} disabled={busy || !values.customerId || propertyList.length === 0}>
              <option value="">
                {!values.customerId ? NEW_JOB_COPY.addressNeedsCustomer : properties.isSuccess && propertyList.length === 0 ? NEW_JOB_COPY.noProperties : "—"}
              </option>
              {propertyList.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.addressLine1, p.city, p.state].filter(Boolean).join(", ")}
                </option>
              ))}
            </select>
            {autofilled ? hint(NEW_JOB_COPY.addressAutofilled) : null}
          </>
        );
      case "technician":
        return (
          <select {...common} className={inputClass(invalid)} value={values.technicianId} onChange={(e) => set("technicianId", e.target.value)}>
            <option value="">{NEW_JOB_COPY.unassigned}</option>
            {(technicians.data?.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{`${t.firstName} ${t.lastName}`.trim()}</option>
            ))}
          </select>
        );
      case "select":
        return (
          <select {...common} className={inputClass(invalid)} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)}>
            {field.placeholder ? <option value="">{field.placeholder}</option> : null}
            {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "datetime":
        return (
          <input
            {...common}
            type="datetime-local"
            aria-label={values[field.key] ? undefined : NEW_JOB_COPY.notScheduled}
            className={inputClass(invalid)}
            value={values[field.key]}
            onChange={(e) => set(field.key, e.target.value)}
          />
        );
      case "textarea":
        return <textarea {...common} rows={2} maxLength={field.maxLength} placeholder={field.placeholder} className={inputClass(invalid)} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)} />;
      default:
        return <input {...common} type="text" maxLength={field.maxLength} placeholder={field.placeholder} className={inputClass(invalid)} value={values[field.key]} onChange={(e) => set(field.key, e.target.value)} />;
    }
  };

  // "Ends" only appears once a start is picked (API needs both or neither).
  const visibleFields = NEW_JOB_FIELDS.filter((f) => f.key !== "scheduledEnd" || Boolean(values.scheduledStart) || Boolean(errors.scheduledEnd));

  return (
    <section
      aria-labelledby="new-job-title"
      className="new-job-panel w-full max-w-[520px] rounded-[14px] border border-[#e6dccb] bg-white p-5 sm:p-7"
      data-new-job-reveal
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="new-job-title" className="text-[24px] font-semibold text-[#0f1530]">{NEW_JOB_COPY.title}</h2>
      </div>
      <p className="mt-2 font-mono text-[12px] text-[#5e6684]" data-testid="new-job-number">{NEW_JOB_COPY.jobNumberPending}</p>

      <form className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
        {showBanner ? (
          <p role="alert" className="new-job-banner rounded-[10px] bg-[#fde3dc] px-3.5 py-3 text-sm text-[#b42318] sm:col-span-2">
            {NEW_JOB_COPY.missingBanner}
          </p>
        ) : null}

        {visibleFields.map((field) => (
          <div key={field.key} className={field.span === 2 ? "sm:col-span-2" : undefined}>
            <label htmlFor={`new-job-${field.key}`} className={`mb-1.5 block text-[13px] font-medium ${errors[field.key] ? "text-[#b42318]" : "text-[#2a3360]"}`}>
              {field.label}
            </label>
            {renderControl(field)}
            {errors[field.key] ? (
              <p id={`new-job-${field.key}-error`} className="mt-1 font-mono text-[11px] text-[#b42318]">{errors[field.key]}</p>
            ) : null}
          </div>
        ))}

        <div className="rounded-[12px] bg-[#fbf6ef] px-3.5 py-3 sm:col-span-2" data-testid="new-job-line-items">
          <p className="font-mono text-[10px] tracking-wide text-[#5e6684]">{NEW_JOB_COPY.lineItemsEyebrow}</p>
          {items.length === 0 ? <p className="mt-1.5 text-sm text-[#5e6684]">{NEW_JOB_COPY.noItems}</p> : null}
          <ul className="mt-1.5 space-y-2">
            {items.map((item) => (
              <li key={item.priceBookItemId} className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#0f1530]">
                <span className="min-w-0 flex-1">{item.name}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    aria-label={`Quantity for ${item.name}`}
                    className="w-14 rounded-[8px] border border-[#e6dccb] bg-white px-2 py-1 text-right"
                    value={item.quantity}
                    disabled={busy}
                    onChange={(e) => {
                      const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      setItems((list) => list.map((i) => (i.priceBookItemId === item.priceBookItemId ? { ...i, quantity: q } : i)));
                    }}
                  />
                  <span className="tabular-nums">× {formatMoney(item.unitPrice)}</span>
                  <button type="button" className="text-xs text-[#5e6684] underline" disabled={busy} onClick={() => setItems((list) => list.filter((i) => i !== item))}>
                    {NEW_JOB_COPY.removeItem}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {itemPickerOpen ? (
            <div className="mt-2">
              <input
                type="search"
                aria-label="Search price book"
                className={inputClass(false)}
                placeholder={NEW_JOB_COPY.itemSearchPlaceholder}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                autoComplete="off"
              />
              {(priceBook.data?.items ?? []).length > 0 ? (
                <ul className="mt-1 divide-y divide-[#e6dccb] rounded-[10px] border border-[#e6dccb] bg-white" role="listbox" aria-label="Price book items">
                  {priceBook.data!.items.map((seed) => (
                    <li key={seed.priceBookItemId} role="option" aria-selected={false}>
                      <button
                        type="button"
                        className="flex w-full justify-between px-3.5 py-2.5 text-left text-sm hover:bg-[#fbf6ef]"
                        onClick={() => {
                          setItems((list) => addLineItem(list, seed));
                          setItemPickerOpen(false);
                          setItemSearch("");
                        }}
                      >
                        <span className="text-[#0f1530]">{seed.name}</span>
                        <span className="tabular-nums text-[#5e6684]">{formatMoney(Number(seed.unitPrice) || 0)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <button type="button" className="mt-2 text-sm font-semibold text-[#2f4fd8]" disabled={busy} onClick={() => setItemPickerOpen(true)}>
              {NEW_JOB_COPY.addItem}
            </button>
          )}
          {items.length > 0 ? (
            <dl className="mt-2 space-y-1 text-sm" data-testid="new-job-totals">
              <div className="flex justify-between">
                <dt className="text-[#0f1530]">{NEW_JOB_COPY.subtotal}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              {feeLabel ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#0f1530]">{feeLabel}</dt>
                  <dd className="tabular-nums" title={NEW_JOB_COPY.totalAfterTax}>—</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold">
                <dt>{NEW_JOB_COPY.customerPays}</dt>
                <dd className="tabular-nums" title={NEW_JOB_COPY.totalAfterTax}>—</dd>
              </div>
              <p className="font-mono text-[11px] text-[#5e6684]">{NEW_JOB_COPY.totalAfterTax}</p>
            </dl>
          ) : null}
        </div>

        {createJob.isError ? (
          <p role="alert" className="rounded-[10px] bg-[#fdecea] px-3.5 py-3 text-sm font-medium text-[#b42318] sm:col-span-2">
            {NEW_JOB_COPY.submitError}
          </p>
        ) : null}
        {itemsFailed ? <p role="status" className="text-sm text-[#b42318] sm:col-span-2">{NEW_JOB_COPY.itemsError}</p> : null}

        <div className="flex justify-end gap-3 sm:col-span-2">
          <Link href="/jobs" className="rounded-[10px] border border-[#e6dccb] bg-white px-5 py-3 text-sm font-semibold text-[#0f1530]">
            {NEW_JOB_COPY.cancel}
          </Link>
          <button type="submit" disabled={busy} className="rounded-[10px] bg-[#0f1530] px-[18px] py-3 text-sm font-semibold text-white hover:bg-[#2a3360] disabled:opacity-60">
            {busy ? NEW_JOB_COPY.submitting : NEW_JOB_COPY.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
