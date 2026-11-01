/**
 * FS-212 customer financing. Disabled by design: only the "disabled" provider exists, nothing reads env or
 * keys at import, no network calls are made, and there is no fee math on this path (the Service Fee is applied
 * at checkout on what the customer pays; fees on financed amounts are deferred to Legal).
 */
import {
  AppError,
  ErrorCode,
  FINANCING_DISABLED_REASON,
  FINANCING_PROVIDER_REGISTRY,
  type EstimateFinancingQuotesResponse,
  type EstimateFinancingSummary,
  type FinancingProviderId,
  type FinancingQuote
} from "@fsm/types";

export interface FinancingAdapter {
  readonly id: FinancingProviderId;
  readonly enabled: boolean;
  quote(input: { companyId: string; estimateId: string; amount: string; currency: "USD" }): Promise<FinancingQuote[]>;
  startApplication(input: { companyId: string; estimateId: string }): Promise<never>;
}

const disabledFinancingAdapter: FinancingAdapter = Object.freeze({
  id: "disabled" as const,
  enabled: false,
  async quote() {
    return [];
  },
  async startApplication(): Promise<never> {
    throw financingDisabledError();
  }
});

const ADAPTERS: Readonly<Record<string, FinancingAdapter>> = Object.freeze({ disabled: disabledFinancingAdapter });

export function financingDisabledError(): AppError {
  return new AppError(ErrorCode.POLICY_DENIED, "Customer financing is not enabled", { reason: FINANCING_DISABLED_REASON });
}

/** Active provider. Always "disabled" until a provider is approved and wired in a separate PR. */
export function getActiveFinancingAdapter(): FinancingAdapter {
  return disabledFinancingAdapter;
}

export function getFinancingAdapter(id: string): FinancingAdapter | null {
  if (!Object.prototype.hasOwnProperty.call(FINANCING_PROVIDER_REGISTRY, id)) return null;
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id) ? ADAPTERS[id]! : null;
}

export function financingProviderReady(adapter: FinancingAdapter = getActiveFinancingAdapter()): boolean {
  return adapter.enabled && FINANCING_PROVIDER_REGISTRY[adapter.id].enabled;
}

export function financingSummary(offered: boolean, adapter: FinancingAdapter = getActiveFinancingAdapter()): EstimateFinancingSummary {
  const ready = financingProviderReady(adapter);
  return {
    offered: offered && ready,
    provider: adapter.id,
    providerReady: ready,
    monthlyFrom: null,
    ...(ready ? {} : { reason: FINANCING_DISABLED_REASON })
  };
}

export async function quoteFinancing(
  input: { companyId: string; estimateId: string; amount: string },
  adapter: FinancingAdapter = getActiveFinancingAdapter()
): Promise<EstimateFinancingQuotesResponse> {
  if (!financingProviderReady(adapter)) {
    return { quotes: [], provider: adapter.id, providerReady: false, reason: FINANCING_DISABLED_REASON };
  }
  return { quotes: await adapter.quote({ ...input, currency: "USD" }), provider: adapter.id, providerReady: true };
}

export async function startFinancingApplication(
  input: { companyId: string; estimateId: string },
  adapter: FinancingAdapter = getActiveFinancingAdapter()
): Promise<never> {
  if (!financingProviderReady(adapter)) throw financingDisabledError();
  return adapter.startApplication(input);
}
