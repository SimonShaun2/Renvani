/**
 * FS-57 outside delivery of a Growth Check report (email/SMS). Disabled by design: the adapter map is empty,
 * nothing reads env or keys at import, and every request is refused before any network call.
 */
import { AppError, ErrorCode, GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY } from "@fsm/types";

export interface GrowthCheckReportDeliveryAdapter {
  readonly channel: string;
  deliver(input: { companyId: string; shareId: string }): Promise<{ providerRef: string }>;
}

/** Empty on purpose. Wiring an adapter requires product approval, consent capture and a separate PR. */
const ADAPTERS: Readonly<Record<string, GrowthCheckReportDeliveryAdapter>> = Object.freeze({});

export function getGrowthCheckReportDeliveryAdapter(channel: string): GrowthCheckReportDeliveryAdapter | null {
  const definition = GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY.find((c) => c.key === channel);
  if (!definition || !definition.enabled) return null;
  return Object.prototype.hasOwnProperty.call(ADAPTERS, channel) ? ADAPTERS[channel]! : null;
}

export function assertGrowthCheckReportDeliveryAvailable(channel: string): GrowthCheckReportDeliveryAdapter {
  const adapter = getGrowthCheckReportDeliveryAdapter(channel);
  if (!adapter) {
    throw new AppError(ErrorCode.POLICY_DENIED, "Report delivery is not enabled; export or copy the report instead", {
      reason: "delivery_disabled",
      channel: channel.slice(0, 32)
    });
  }
  return adapter;
}
