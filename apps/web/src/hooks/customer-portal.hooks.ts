"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CustomerPortalAccount,
  CustomerPortalEstimate,
  CustomerPortalInvoice,
  CustomerPortalVisits
} from "@fsm/types";

import { customerPortalGet, isPortalLinkExpired } from "@/src/lib/customer-portal-session";

function usePortalQuery<T>(name: string, path: string, token: string | null) {
  return useQuery({
    // Token deliberately not in the query key (keys can surface in devtools/logs).
    queryKey: ["customer-portal", name],
    enabled: Boolean(token),
    retry: (count, error) => !isPortalLinkExpired(error) && count < 1,
    queryFn: () => customerPortalGet<T>(path, token as string)
  });
}

export const useCustomerPortalAccount = (token: string | null) =>
  usePortalQuery<{ account: CustomerPortalAccount }>("me", "/me", token);
export const useCustomerPortalVisits = (token: string | null) =>
  usePortalQuery<{ visits: CustomerPortalVisits }>("visits", "/me/visits", token);
export const useCustomerPortalEstimates = (token: string | null) =>
  usePortalQuery<{ estimates: CustomerPortalEstimate[] }>("estimates", "/me/estimates", token);
export const useCustomerPortalInvoices = (token: string | null) =>
  usePortalQuery<{ invoices: CustomerPortalInvoice[] }>("invoices", "/me/invoices", token);
